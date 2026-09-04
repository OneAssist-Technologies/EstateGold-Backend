const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const AdmZip = require("adm-zip");
const Property = require("../models/Property");
const SystemSettings = require("../models/SystemSettings");
const { cleanPropertyDetails } = require("../controllers/propertyController");
const { checkPropertyServiceability } = require("../utils/geoUtils");

/**
 * Helper to extract field value using multiple potential header keys.
 */
/**
 * Helper to extract field value using multiple potential header keys,
 * supporting exact matches, normalized matches (ignoring case, spaces, symbols), and substring matches.
 */
const getVal = (row, targetAliases, defaultVal = "") => {
  if (!row || typeof row !== "object") return defaultVal;

  const rowKeys = Object.keys(row);

  // 1. Direct exact match
  for (const alias of targetAliases) {
    if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== "") {
      return String(row[alias]).trim();
    }
  }

  // Helper to normalize strings (lowercase, alphanumeric only)
  const normalize = (str) => String(str).toLowerCase().replace(/[^a-z0-9]/g, "");
  const normAliases = targetAliases.map(normalize);

  // 2. Normalized match (ignoring spaces, casing, special chars like asterisks or parentheses)
  for (const key of rowKeys) {
    const normKey = normalize(key);
    if (normAliases.includes(normKey)) {
      const val = row[key];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return String(val).trim();
      }
    }
  }

  // 3. Substring match (e.g., if header is "Listing Purpose (Sale, Rent, Lease...)" or "Purpose*")
  for (const key of rowKeys) {
    const normKey = normalize(key);
    for (const alias of targetAliases) {
      const normAlias = normalize(alias);
      if (normAlias.length >= 3 && (normKey.includes(normAlias) || normAlias.includes(normKey))) {
        const val = row[key];
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          return String(val).trim();
        }
      }
    }
  }

  return defaultVal;
};

/**
 * Parses uploaded Excel (.xlsx) or CSV (.csv) file or buffer into JSON objects.
 * Automatically locates the correct data sheet and header row.
 */
const parseUploadedFile = (fileInput) => {
  let workbook;
  if (fileInput && fileInput.path && fs.existsSync(fileInput.path)) {
    workbook = xlsx.readFile(fileInput.path);
  } else if (fileInput && fileInput.buffer) {
    workbook = xlsx.read(fileInput.buffer, { type: "buffer" });
  } else if (Buffer.isBuffer(fileInput)) {
    workbook = xlsx.read(fileInput, { type: "buffer" });
  } else if (typeof fileInput === "string") {
    workbook = xlsx.readFile(fileInput);
  } else {
    throw new Error("Invalid or unreadable Excel file input.");
  }

  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("The uploaded file does not contain any readable sheets.");
  }

  // Find sheet containing property data (prefer sheet named "Property Data", "Properties", or "Data")
  const dataSheetName =
    workbook.SheetNames.find(
      (s) => s.toLowerCase().includes("property data") || s.toLowerCase().includes("properties")
    ) ||
    workbook.SheetNames.find(
      (s) => s.toLowerCase().includes("property") || s.toLowerCase().includes("data")
    ) ||
    workbook.SheetNames[workbook.SheetNames.length > 1 && workbook.SheetNames[0].toLowerCase().includes("instruction") ? 1 : 0];

  const worksheet = workbook.Sheets[dataSheetName];

  // Raw 2D array parsing to detect header row index if there are instruction/title rows at top
  const rawRows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
    const rowStr = (rawRows[r] || []).join(" ").toLowerCase();
    if (
      rowStr.includes("purpose") ||
      rowStr.includes("title") ||
      rowStr.includes("city") ||
      rowStr.includes("property number") ||
      rowStr.includes("property type") ||
      rowStr.includes("price")
    ) {
      headerRowIndex = r;
      break;
    }
  }

  const jsonRows = xlsx.utils.sheet_to_json(worksheet, { range: headerRowIndex, defval: "" });
  return jsonRows;
};

/**
 * Parses uploaded Images ZIP file and maps files by folder name / property number.
 */
const parseImagesZip = (zipInput) => {
  if (!zipInput) {
    return { folderMap: {}, allFolderNames: [], totalImages: 0 };
  }

  let zip;
  try {
    if (zipInput.path && fs.existsSync(zipInput.path)) {
      zip = new AdmZip(zipInput.path);
    } else if (zipInput.buffer) {
      zip = new AdmZip(zipInput.buffer);
    } else if (Buffer.isBuffer(zipInput)) {
      zip = new AdmZip(zipInput);
    } else if (typeof zipInput === "string" && fs.existsSync(zipInput)) {
      zip = new AdmZip(zipInput);
    } else {
      return { folderMap: {}, allFolderNames: [], totalImages: 0 };
    }
  } catch (err) {
    console.error("Error opening ZIP archive:", err);
    throw new Error("Failed to read Images ZIP archive. Please ensure it is a valid .zip file.");
  }

  const entries = zip.getEntries();
  const folderMap = {};
  const allFolderNamesSet = new Set();
  let totalImages = 0;

  entries.forEach((entry) => {
    if (entry.isDirectory) return;

    // Security: sanitize path against traversal
    const entryPath = entry.entryName.replace(/\\/g, "/");
    if (entryPath.includes("../") || entryPath.includes("..\\")) return;

    // Ignore hidden system files like __MACOSX or .DS_Store
    if (entryPath.includes("__MACOSX/") || entryPath.split("/").some((p) => p.startsWith("."))) {
      return;
    }

    const parts = entryPath.split("/").filter(Boolean);
    if (parts.length < 2) return; // Must be inside a property folder (e.g. "Property 1/image.jpg")

    const folderName = parts[0];
    const fileName = parts[parts.length - 1];

    const ext = path.extname(fileName).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return;

    allFolderNamesSet.add(folderName);

    // Extract Property Number from folder name (e.g., "Property 1", "Property_1", "1", "Folder 1")
    const match = folderName.match(/(?:property|prop|folder|num|no)?[\s\-_]*(\d+)/i);
    const propNumKey = match ? String(parseInt(match[1], 10)) : folderName.trim().toLowerCase();

    if (!folderMap[propNumKey]) {
      folderMap[propNumKey] = [];
    }

    folderMap[propNumKey].push({
      entryName: entry.entryName,
      fileName,
      folderName,
      getData: () => entry.getData(),
    });

    totalImages++;
  });

  return {
    folderMap,
    allFolderNames: Array.from(allFolderNamesSet),
    totalImages,
  };
};

/**
 * Generates/Serves the official EstateGold Bulk Property Upload Template Excel workbook.
 * Uses the official user template file if available, or dynamically generates it.
 */
const generateBulkTemplate = () => {
  const possiblePaths = [
    path.join(process.cwd(), "public/EstateGold_Bulk_Property_Upload_User_Template.xlsx"),
    path.join(process.cwd(), "../PropertyListing-Frontend/public/EstateGold_Bulk_Property_Upload_User_Template.xlsx"),
    path.join(__dirname, "../../public/EstateGold_Bulk_Property_Upload_User_Template.xlsx"),
  ];

  for (const tPath of possiblePaths) {
    if (fs.existsSync(tPath)) {
      console.log("[BULK] Serving official template file from:", tPath);
      return fs.readFileSync(tPath);
    }
  }

  // Fallback to dynamic workbook generation if file is missing
  const workbook = xlsx.utils.book_new();

  const instructionsData = [
    ["ESTATEGOLD BULK PROPERTY UPLOAD INSTRUCTIONS"],
    [""],
    ["Welcome to the EstateGold Bulk Property Upload System!"],
    ["Fill out the property listings in the 'Bulk Property Upload' sheet."],
    ["One row = One property listing."],
    ["Do not rename column headers."],
  ];

  const instructionsSheet = xlsx.utils.aoa_to_sheet(instructionsData);
  xlsx.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

  return xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
};

/**
 * Validates each property row independently and matches Property Number <-> ZIP folder.
 */
const validateBulkProperties = async (excelFileInput, zipFileInput = null, publisherDetails = {}) => {
  const rawRows = parseUploadedFile(excelFileInput);

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return {
      success: false,
      message: "The uploaded Excel file is empty or contains no readable rows.",
      summary: {
        totalRows: 0,
        readyToPublishCount: 0,
        needsFixingCount: 0,
        unmappedFoldersCount: 0,
        totalZipImagesFound: 0,
      },
      readyToPublish: [],
      needsFixing: [],
      unmappedFolders: [],
    };
  }

  // Parse ZIP archive if provided
  let zipData = { folderMap: {}, allFolderNames: [], totalImages: 0 };
  if (zipFileInput) {
    try {
      zipData = parseImagesZip(zipFileInput);
    } catch (zipErr) {
      console.error("ZIP parsing error:", zipErr);
    }
  }

  const readyToPublish = [];
  const needsFixing = [];
  const processedPropertyNumbers = new Set();

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const excelRowIndex = i + 2;

    // Extract Property Number / Reference (e.g., PROP-001 or 1)
    const rawPropNum = getVal(row, ["Property Reference", "Property Number *", "Property Number", "Property Ref No", "PropertyRefNo", "PropertyNo", "Property #", "PropertyID", "PropNum", "S.No", "Ref No", "RefNo"]);
    
    // Check if empty row (skip completely blank rows)
    const rawTitleCheck = getVal(row, ["Property Title *", "Property Title", "Title", "title"]);
    const rawCityCheck = getVal(row, ["City *", "City", "city"]);
    if (!rawPropNum && !rawTitleCheck && !rawCityCheck) {
      continue; // Skip blank template row
    }

    let propNum = String(i + 1);
    if (rawPropNum) {
      const matchNum = rawPropNum.match(/\d+/);
      propNum = matchNum ? String(parseInt(matchNum[0], 10)) : rawPropNum.trim();
    }
    processedPropertyNumbers.add(propNum);

    const errors = [];

    // Owner Details
    const ownerName = getVal(row, ["Property Owner Name", "Owner Name", "ownerName", "Owner"]);
    const ownerPhone = getVal(row, ["Owner Phone Number", "Owner Phone", "ownerPhone", "Phone"]).replace(/\D/g, "");
    const ownerEmail = getVal(row, ["Owner Gmail", "Owner Email", "ownerEmail", "Email"]);
    const ownerAddress = getVal(row, ["Owner Address", "ownerAddress"]);
    const pan = getVal(row, ["Owner PAN Number", "PAN", "pan"]);
    const ownerType = getVal(row, ["Owner Type", "ownerType"]);
    const agentRelation = getVal(row, ["Agent Relation", "agentRelation"]);
    const role = getVal(row, ["Publisher Role", "Role", "role"], "seller");

    // Purpose & Listing Type
    let rawPurpose = getVal(row, [
      "Purpose",
      "Listing Purpose *",
      "Listing Purpose",
      "purpose",
      "listingPurpose",
      "Property Purpose",
      "transactionType",
      "Intent",
      "For",
      "Sale/Rent",
    ]);
    const rawListingType = getVal(row, ["Listing Mode", "Listing Type", "listingType", "Ownership"]);

    let purpose = "";
    let listingType = "my_own";

    const combinedPurposeStr = `${rawPurpose} ${rawListingType}`.toLowerCase();

    if (combinedPurposeStr.includes("pg") || combinedPurposeStr.includes("co-living") || combinedPurposeStr.includes("hostel") || combinedPurposeStr.includes("coliving")) {
      purpose = "PG / Co-Living";
    } else if (combinedPurposeStr.includes("rent")) {
      purpose = "Rent";
    } else if (combinedPurposeStr.includes("lease")) {
      purpose = "Lease";
    } else if (combinedPurposeStr.includes("sale") || combinedPurposeStr.includes("buy") || combinedPurposeStr.includes("sell")) {
      purpose = "Sale";
    } else if (rawPurpose.trim()) {
      purpose = rawPurpose.trim();
    }

    if (["my_own", "another_owner"].includes(rawListingType.toLowerCase())) {
      listingType = rawListingType.toLowerCase();
    }

    if (!purpose) {
      errors.push("Listing Purpose is required (Sale, Rent, Lease, or PG / Co-Living).");
    }

    // Property Type
    const rawPropType = getVal(row, ["Property Type *", "Property Type", "propertyType", "Type"]);
    let propertyType = rawPropType;

    const tLower = rawPropType.toLowerCase();
    if (tLower.includes("apartment") || tLower.includes("flat")) propertyType = "Apartment / Flat";
    else if (tLower.includes("villa")) propertyType = "Villa";
    else if (tLower.includes("builder") && tLower.includes("floor")) propertyType = "Builder Floor";
    else if (tLower.includes("house") || tLower.includes("independent")) propertyType = "Independent House";
    else if (tLower.includes("agricultural")) propertyType = "Agricultural Land";
    else if (tLower.includes("plot") || tLower.includes("land")) propertyType = "Plot / Land";
    else if (tLower.includes("office") || tLower.includes("commercial space")) propertyType = "Commercial Space / Office Space";
    else if (tLower.includes("shop") || tLower.includes("retail")) propertyType = "Shop / Retail";
    else if (tLower.includes("warehouse")) propertyType = "Warehouse";
    else if (tLower.includes("industrial")) propertyType = "Industrial Property / Shed";
    else if (tLower.includes("hotel") || tLower.includes("resort")) propertyType = "Hotel / Resort";
    else if (tLower.includes("pg") || tLower.includes("hostel")) propertyType = "PG / Hostel";
    else if (tLower.includes("project") || tLower.includes("builder")) propertyType = "Builder / New Project";

    if (!propertyType) {
      errors.push("Property Type is required.");
    }

    const title = getVal(row, ["Property Title *", "Property Title", "Title", "title"]);
    const description = getVal(row, ["Description", "description"]);
    const state = getVal(row, ["State *", "State", "state"], publisherDetails.state || "Tamil Nadu");
    const city = getVal(row, ["City *", "City", "city"]);
    const locality = getVal(row, ["Locality *", "Locality", "locality"]);
    const society = getVal(row, ["Society", "society"]);
    const address = getVal(row, ["Address *", "Address", "address"]);

    if (!title) errors.push("Property Title is required.");
    if (!city) errors.push("City is required.");
    if (!locality) errors.push("Locality is required.");
    if (!address) errors.push("Address is required.");

    const price = parseFloat(getVal(row, ["Price *", "Price", "Base Price", "price", "Rent", "Amount"])) || 0;
    if (price <= 0) {
      errors.push("Valid Price / Rent is required (must be greater than 0).");
    }

    // Generic Dimensions & Areas
    const area = parseFloat(getVal(row, ["Area (sq.ft)", "Area (sq ft)", "Built-up Area (sq ft)", "area", "Area"])) || 0;
    const carpetArea = parseFloat(getVal(row, ["Carpet Area (sq.ft)", "Carpet Area (sq ft)", "Carpet Area", "carpetArea"])) || area;
    const plotArea = parseFloat(getVal(row, ["Plot Area (sq.ft)", "Plot Area (sq ft)", "Plot Area", "plotArea"])) || (["Plot / Land", "Agricultural Land"].includes(propertyType) ? area : 0);

    const bedrooms = parseInt(getVal(row, ["Bedrooms", "bedrooms"])) || 0;
    const bathrooms = parseInt(getVal(row, ["Bathrooms", "bathrooms"])) || 0;
    const balconies = parseInt(getVal(row, ["Balconies", "balconies"])) || 0;
    const floor = parseInt(getVal(row, ["Floor", "floor"])) || 0;
    const totalFloors = parseInt(getVal(row, ["Total Floors", "totalFloors"])) || 1;

    const facing = getVal(row, ["Facing", "facing", "Plot Facing"], "");
    const furnishing = getVal(row, ["Furnishing", "furnishing"], "");

    const parseBool = (val) => {
      if (!val) return false;
      const s = String(val).trim().toLowerCase();
      return s === "yes" || s === "true" || s === "1";
    };

    const parking = parseBool(getVal(row, ["Parking Spaces", "Parking", "parking"]));
    const lift = parseBool(getVal(row, ["Lift", "lift"]));
    const powerBackup = getVal(row, ["Power Backup", "powerBackup"], "");
    const security = getVal(row, ["Security", "security"], "");
    const propertyAge = getVal(row, ["Property Age", "propertyAge"], "");
    const maintenance = parseFloat(getVal(row, ["Maintenance", "Maintenance Charges", "maintenance"])) || 0;
    const waterAvailability = getVal(row, ["Water Availability", "waterAvailability"], "");
    const electricityAvailability = getVal(row, ["Electricity Availability", "electricityAvailability"], "");

    const length = parseFloat(getVal(row, ["Length (ft)", "Length", "length"])) || 0;
    const width = parseFloat(getVal(row, ["Width (ft)", "Width", "width"])) || 0;
    const roadWidth = parseFloat(getVal(row, ["Road Width (ft)", "Road Width", "roadWidth"])) || 0;
    const frontage = parseFloat(getVal(row, ["Frontage (ft)", "Frontage", "frontage"])) || 0;

    const cornerPlot = parseBool(getVal(row, ["Corner Plot", "cornerPlot"]));
    const boundaryWall = parseBool(getVal(row, ["Boundary Wall", "boundaryWall"]));
    const compoundWall = parseBool(getVal(row, ["Compound Wall", "compoundWall"]));
    const garden = parseBool(getVal(row, ["Garden", "garden"]));
    const terrace = parseBool(getVal(row, ["Terrace", "terrace"]));
    const solar = parseBool(getVal(row, ["Solar", "solar"]));
    const borewell = parseBool(getVal(row, ["Borewell", "borewell"]));
    const community = getVal(row, ["Community", "community"], "");
    const privatePool = parseBool(getVal(row, ["Private Pool", "privatePool"]));
    const servantRoom = parseBool(getVal(row, ["Servant Room", "servantRoom"]));
    const numberOfUnits = parseInt(getVal(row, ["Number of Units", "numberOfUnits"])) || 0;

    // Land / Plots Specific
    const plotFacing = getVal(row, ["Plot Facing", "plotFacing"], facing);
    const plotType = getVal(row, ["Plot Type", "plotType"], "");
    const landApproval = getVal(row, ["Land Approval", "landApproval"], "");
    const layoutName = getVal(row, ["Layout Name", "layoutName"], "");
    const gatedLayout = parseBool(getVal(row, ["Gated Layout", "gatedLayout"]));
    const drainage = parseBool(getVal(row, ["Drainage", "drainage"]));
    const roadAccess = getVal(row, ["Road Access", "roadAccess"], "");
    const gps = getVal(row, ["GPS", "GPS Coordinates", "gps"], "");
    const surveyNumber = getVal(row, ["Survey Number", "surveyNumber"], "");
    const subdivisionNumber = getVal(row, ["Subdivision Number", "subdivisionNumber"], "");
    const landClassification = getVal(row, ["Land Classification", "landClassification"], "");
    const zoning = getVal(row, ["Zoning", "zoning"], "");

    // Agricultural Specific
    const pricePerAcre = parseFloat(getVal(row, ["Price Per Acre", "pricePerAcre"])) || 0;
    const village = getVal(row, ["Village", "village"], "");
    const taluk = getVal(row, ["Taluk", "taluk"], "");
    const district = getVal(row, ["District", "district"], "");
    const irrigation = getVal(row, ["Irrigation", "irrigation"], "");
    const fencing = parseBool(getVal(row, ["Fencing", "fencing"]));
    const crops = getVal(row, ["Crops", "crops"], "");
    const soilType = getVal(row, ["Soil Type", "soilType"], "");
    const farmhouse = parseBool(getVal(row, ["Farmhouse", "farmhouse"]));

    // Commercial & Industrial Specific
    const workstations = parseInt(getVal(row, ["Workstations", "workstations"])) || 0;
    const cabins = parseInt(getVal(row, ["Cabins", "cabins"])) || 0;
    const meetingRooms = parseInt(getVal(row, ["Meeting Rooms", "meetingRooms"])) || 0;
    const reception = parseBool(getVal(row, ["Reception", "reception"]));
    const pantry = parseBool(getVal(row, ["Pantry", "pantry"]));
    const serverRoom = parseBool(getVal(row, ["Server Room", "serverRoom"]));
    const washrooms = parseInt(getVal(row, ["Washrooms", "washrooms"])) || 0;
    const ac = parseBool(getVal(row, ["AC", "ac"]));
    const internet = parseBool(getVal(row, ["Internet", "internet"]));
    const fireSafety = parseBool(getVal(row, ["Fire Safety", "fireSafety"]));
    const powerLoad = parseFloat(getVal(row, ["Power Load (kW)", "Power Load", "powerLoad"])) || 0;
    const entranceWidth = parseFloat(getVal(row, ["Entrance Width (ft)", "Entrance Width", "entranceWidth"])) || 0;
    const ceilingHeight = parseFloat(getVal(row, ["Ceiling Height (ft)", "Ceiling Height", "ceilingHeight"])) || 0;
    const mainRoadFacing = parseBool(getVal(row, ["Main Road Facing", "mainRoadFacing"]));
    const cornerShop = parseBool(getVal(row, ["Corner Shop", "cornerShop"]));
    const shutters = parseInt(getVal(row, ["Shutters", "shutters"])) || 0;
    const signboard = parseBool(getVal(row, ["Signboard", "signboard"]));
    const footfallEstimate = getVal(row, ["Footfall Estimate", "footfallEstimate"], "");
    const suitableBusiness = getVal(row, ["Suitable Business", "suitableBusiness"], "");
    const loadingUnloading = parseBool(getVal(row, ["Loading / Unloading", "loadingUnloading"]));
    const dock = parseBool(getVal(row, ["Dock", "dock"]));
    const truckAccess = getVal(row, ["Truck Access", "truckAccess"], "");
    const storageCapacity = getVal(row, ["Storage Capacity", "storageCapacity"], "");
    const flooring = getVal(row, ["Flooring", "flooring"], "");
    const officeArea = parseFloat(getVal(row, ["Office Area (sq.ft)", "Office Area (sq ft)", "officeArea"])) || 0;
    const industrialType = getVal(row, ["Industrial Type", "industrialType"], "");
    const transformer = parseBool(getVal(row, ["Transformer", "transformer"]));
    const productionArea = parseFloat(getVal(row, ["Production Area (sq.ft)", "Production Area (sq ft)", "productionArea"])) || 0;
    const crane = parseBool(getVal(row, ["Crane", "crane"]));
    const workerFacilities = parseBool(getVal(row, ["Worker Facilities", "workerFacilities"]));
    const pollutionCompliance = getVal(row, ["Pollution Compliance", "pollutionCompliance"], "");
    const machineryIncluded = parseBool(getVal(row, ["Machinery Included", "machineryIncluded"]));

    // Hospitality Specific
    const numberOfRooms = parseInt(getVal(row, ["Number of Rooms", "numberOfRooms"])) || 0;
    const roomTypes = getVal(row, ["Room Types", "roomTypes"], "");
    const restaurant = parseBool(getVal(row, ["Restaurant", "restaurant"]));
    const kitchen = parseBool(getVal(row, ["Kitchen", "kitchen"]));
    const banquetHall = parseBool(getVal(row, ["Banquet Hall", "banquetHall"]));
    const gym = parseBool(getVal(row, ["Gym", "gym"]));
    const occupancy = getVal(row, ["Occupancy", "Occupancy Rate", "occupancy"], "");
    const revenue = parseFloat(getVal(row, ["Revenue", "Annual Revenue", "revenue"])) || 0;

    // PG Details
    let pgDetails = null;
    if (purpose === "PG / Co-Living" || propertyType === "PG / Hostel") {
      const pgName = getVal(row, ["PG Name", "pgName"], title);
      const publisherType = getVal(row, ["Publisher Role", "publisherType"], "PG Owner");
      const accommodationType = getVal(row, ["Accommodation Type", "accommodationType"], "PG / Co-Living");
      const genderType = getVal(row, ["Gender Type", "genderType"], "Boys");
      const occupantType = getVal(row, ["Occupant Type", "occupantType"], "Working Professionals");
      const foodAvailability = getVal(row, ["Food Availability", "foodAvailability"], "Available");
      const mealsRaw = getVal(row, ["Meals Included", "Food Included", "mealsIncluded"]);
      const mealsIncluded = mealsRaw ? mealsRaw.split(",").map((m) => m.trim()).filter(Boolean) : ["Breakfast", "Dinner"];

      pgDetails = {
        pgName,
        publisherType,
        accommodationType,
        suitableFor: genderType,
        occupantType,
        foodAvailability,
        mealsIncluded,
        furnishing,
        rooms: [
          {
            roomId: `room_${Date.now()}_1`,
            roomType: propertyType,
            sharingType: getVal(row, ["Room Sharing Type", "roomSharingType"], "Double Sharing"),
            roomCount: numberOfRooms || 1,
            totalBeds: parseInt(getVal(row, ["Total Beds", "totalBeds"])) || 2,
            occupiedBeds: 0,
            reservedBeds: 0,
            availableBeds: parseInt(getVal(row, ["Available Beds", "availableBeds"])) || 2,
            pricePerPerson: price,
            securityDeposit: parseFloat(getVal(row, ["Deposit", "Security Deposit", "deposit"])) || 0,
            bathroomType: "Attached Bath",
            ac: ac,
            status: "AVAILABLE",
          },
        ],
        facilities: ["WiFi", "Power Backup", "Washing Machine", "CCTV"],
        charges: {
          securityDeposit: parseFloat(getVal(row, ["Deposit", "Security Deposit", "deposit"])) || 0,
          maintenanceCharges: maintenance,
          noticePeriod: getVal(row, ["Notice Period", "noticePeriod"], "1 Month"),
        },
      };
    }

    // Projects Specific
    const projectName = getVal(row, ["Project Name", "projectName"], "");
    const towers = parseInt(getVal(row, ["Towers", "Towers Count", "towers"])) || 0;
    const totalUnits = parseInt(getVal(row, ["Total Units", "totalUnits"])) || 0;
    const availableUnits = parseInt(getVal(row, ["Available Units", "availableUnits"])) || 0;
    const bhkTypes = getVal(row, ["BHK Types", "BHK Configurations", "bhkTypes"], "");
    const constructionStatus = getVal(row, ["Construction Status", "constructionStatus"], "");
    const possessionDate = getVal(row, ["Possession Date", "possessionDate"], "");
    const paymentPlan = getVal(row, ["Payment Plan", "paymentPlan"], "");

    // Parse Amenities Array
    const rawAmenities = getVal(row, ["Amenities", "amenities"]);
    const amenities = rawAmenities ? rawAmenities.split(",").map((a) => a.trim()).filter(Boolean) : [];

    // CHECK SERVICEABILITY
    let serviceability = null;
    try {
      const serviceCheck = await checkPropertyServiceability({
        city,
        locality,
        propertyType,
        purpose,
        state,
        address,
      });
      if (!serviceCheck.isServiceable) {
        errors.push(serviceCheck.message || `Location ${locality}, ${city} is currently not in a serviceable area.`);
      } else {
        serviceability = serviceCheck;
      }
    } catch (geoErr) {
      console.error("Geo check error during bulk validation:", geoErr);
    }

    // MATCH PROPERTY NUMBER AGAINST ZIP FOLDERS
    const zipImages = zipData.folderMap[propNum] || zipData.folderMap[String(i + 1)] || [];
    const imageFolderFound = zipImages.length > 0;

    const propertyPayload = {
      propertyNumber: propNum,
      excelRowIndex,
      purpose,
      propertyType,
      listingType,
      title,
      description,
      ownerName: ownerName || publisherDetails.ownerName || publisherDetails.contactName || publisherDetails.fullName || publisherDetails.name || "",
      ownerPhone: ownerPhone || publisherDetails.ownerPhone || publisherDetails.contactPhone || publisherDetails.phone || "",
      ownerEmail: ownerEmail || publisherDetails.ownerEmail || publisherDetails.contactEmail || publisherDetails.email || "",
      ownerAddress: ownerAddress || publisherDetails.ownerAddress || publisherDetails.contactAddress || "",
      pan,
      ownerType,
      agentRelation,
      role,
      state,
      city,
      locality,
      society,
      address,
      price,
      area,
      carpetArea,
      plotArea,
      bedrooms,
      bathrooms,
      balconies,
      floor,
      totalFloors,
      facing,
      furnishing,
      parking,
      lift,
      powerBackup,
      security,
      maintenance,
      propertyAge,
      waterAvailability,
      electricityAvailability,
      length,
      width,
      roadWidth,
      frontage,
      cornerPlot,
      boundaryWall,
      compoundWall,
      garden,
      terrace,
      solar,
      borewell,
      community,
      privatePool,
      servantRoom,
      numberOfUnits,
      plotFacing,
      plotType,
      landApproval,
      layoutName,
      gatedLayout,
      drainage,
      roadAccess,
      gps,
      surveyNumber,
      subdivisionNumber,
      landClassification,
      zoning,
      pricePerAcre,
      village,
      taluk,
      district,
      irrigation,
      fencing,
      crops,
      soilType,
      farmhouse,
      workstations,
      cabins,
      meetingRooms,
      reception,
      pantry,
      serverRoom,
      washrooms,
      ac,
      internet,
      fireSafety,
      powerLoad,
      entranceWidth,
      ceilingHeight,
      mainRoadFacing,
      cornerShop,
      shutters,
      signboard,
      footfallEstimate,
      suitableBusiness,
      loadingUnloading,
      dock,
      truckAccess,
      storageCapacity,
      flooring,
      officeArea,
      industrialType,
      transformer,
      productionArea,
      crane,
      workerFacilities,
      pollutionCompliance,
      machineryIncluded,
      numberOfRooms,
      roomTypes,
      restaurant,
      kitchen,
      banquetHall,
      gym,
      occupancy,
      revenue,
      pgDetails,
      projectName,
      towers,
      totalUnits,
      availableUnits,
      bhkTypes,
      constructionStatus,
      possessionDate,
      paymentPlan,
      amenities,
      imageFolderFound,
      imagesCount: zipImages.length,
      zipImages: zipImages.map((img) => img.fileName),
    };

    if (errors.length === 0) {
      readyToPublish.push(propertyPayload);
    } else {
      needsFixing.push({
        ...propertyPayload,
        errors,
      });
    }
  }

  // IDENTIFY UNMAPPED ZIP FOLDERS
  const unmappedFolders = (zipData.allFolderNames || []).filter((folderName) => {
    const match = folderName.match(/(?:property|prop|folder|num|no)?[\s\-_]*(\d+)/i);
    const folderNumKey = match ? String(parseInt(match[1], 10)) : folderName.trim().toLowerCase();
    return !processedPropertyNumbers.has(folderNumKey);
  });

  return {
    success: true,
    summary: {
      totalRows: readyToPublish.length + needsFixing.length,
      readyToPublishCount: readyToPublish.length,
      needsFixingCount: needsFixing.length,
      unmappedFoldersCount: unmappedFolders.length,
      totalZipImagesFound: zipData.totalImages || 0,
    },
    readyToPublish,
    needsFixing,
    unmappedFolders,
  };
};

/**
 * Creates MongoDB property documents and uploads folder images to storage.
 */
const publishBulkProperties = async (eligibleProperties, user, publisherDetails = {}, zipFileInput = null) => {
  console.log("[BULK] Excel file received");
  console.log("[BULK] ZIP file received:", Boolean(zipFileInput));
  console.log("[BULK] Eligible properties count:", Array.isArray(eligibleProperties) ? eligibleProperties.length : 0);

  if (!Array.isArray(eligibleProperties) || eligibleProperties.length === 0) {
    throw new Error("No eligible properties provided for publishing.");
  }

  // Parse ZIP archive if provided for image extraction
  let zipData = { folderMap: {} };
  if (zipFileInput) {
    try {
      zipData = parseImagesZip(zipFileInput);
    } catch (e) {
      console.error("[BULK] Failed to parse ZIP file during publish:", e);
    }
  }

  const uploadDir = path.join(process.cwd(), "uploads/properties");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const publishedResults = [];
  const failedResults = [];
  let totalImagesUploaded = 0;

  // Check system settings for property approval requirement
  let approvalRequired = true;
  try {
    const sysSettings = await SystemSettings.findOne();
    if (sysSettings) {
      approvalRequired = sysSettings.propertyApprovalRequired ?? true;
    }
  } catch (sysErr) {
    console.error("[BULK] Failed to fetch SystemSettings:", sysErr);
  }

  const initialStatus = approvalRequired ? "pending" : "approved";

  for (let i = 0; i < eligibleProperties.length; i++) {
    const item = eligibleProperties[i];
    const propNum = String(item.propertyNumber || (i + 1));
    console.log(`[BULK] Publishing property number ${propNum}`);

    try {
      const serviceCheck = await checkPropertyServiceability({
        city: item.city,
        locality: item.locality,
        propertyType: item.propertyType,
        purpose: item.purpose,
        state: item.state,
        address: item.address,
      });

      let lat = serviceCheck?.latitude || 0;
      let lng = serviceCheck?.longitude || 0;
      let areaId = serviceCheck?.matchedLocation?._id || null;

      const propTitle = item.title || `${item.bedrooms ? `${item.bedrooms} BHK ` : ""}${item.propertyType || "Property"} in ${item.locality || item.city || "Location"}`;

      const cleanedData = cleanPropertyDetails(item.propertyType, item);

      console.log("[BULK] Creating MongoDB property");

      // 1. Create Property Document First
      const newProperty = await Property.create({
        ...cleanedData,
        purpose: item.purpose || cleanedData.purpose,
        propertyType: item.propertyType || cleanedData.propertyType,
        title: propTitle,
        description: item.description || cleanedData.description || "",
        ownerName: item.ownerName || publisherDetails.ownerName || publisherDetails.contactName || (user ? (user.fullName || user.name) : "") || "Agent Listing",
        ownerPhone: item.ownerPhone || publisherDetails.ownerPhone || publisherDetails.contactPhone || (user ? user.phone : "") || "",
        ownerEmail: item.ownerEmail || publisherDetails.ownerEmail || publisherDetails.contactEmail || (user ? user.email : "") || "",
        ownerAddress: item.ownerAddress || publisherDetails.ownerAddress || publisherDetails.contactAddress || "",
        state: item.state || cleanedData.state,
        city: item.city || cleanedData.city,
        locality: item.locality || cleanedData.locality,
        address: item.address || cleanedData.address,
        price: item.price !== undefined ? Number(item.price) : cleanedData.price,
        area: item.area !== undefined ? Number(item.area) : cleanedData.area,
        createdBy: user._id || user.id,
        ownerId: user._id || user.id,
        role: "agent",
        listingType: item.listingType || cleanedData.listingType || "my_own",
        status: initialStatus,
        availabilityStatus: item.availabilityStatus || "on_sale",
        latitude: lat,
        longitude: lng,
        serviceableAreaId: areaId,
        isDraft: false,
        isDeleted: false,
        photos: ["default_property.jpg"],
        pgDetails: item.pgDetails || undefined,
      });

      console.log(`[BULK] Property created with ID ${newProperty._id}`);

      // 2. Process ZIP Images AFTER Property Creation (Image failure must not prevent creation)
      const zipImageEntries = zipData.folderMap[propNum] || zipData.folderMap[String(i + 1)] || [];
      const savedPhotoFilenames = [];

      if (zipImageEntries.length > 0) {
        for (let j = 0; j < zipImageEntries.length; j++) {
          const imgEntry = zipImageEntries[j];
          try {
            const imgBuffer = imgEntry.getData();
            const ext = path.extname(imgEntry.fileName).toLowerCase() || ".jpg";
            const uniqueFilename = `${Date.now()}_prop${propNum}_${j + 1}${ext}`;
            const filePath = path.join(uploadDir, uniqueFilename);

            fs.writeFileSync(filePath, imgBuffer);
            savedPhotoFilenames.push(uniqueFilename);
            totalImagesUploaded++;
          } catch (imgErr) {
            console.error(`[BULK] Image processing failed for ${imgEntry.fileName} on property ${propNum}:`, imgErr);
          }
        }
      }

      if (savedPhotoFilenames.length > 0) {
        newProperty.photos = savedPhotoFilenames;
        await newProperty.save();
        console.log(`[BULK] Images processed: ${savedPhotoFilenames.length} photo(s) attached to Property ${newProperty._id}`);
      } else {
        console.log(`[BULK] Images processed: 0 ZIP photos attached for Property ${newProperty._id} (using default)`);
      }

      publishedResults.push({
        propertyNumber: propNum,
        propertyId: newProperty._id,
        title: newProperty.title,
        imagesCount: savedPhotoFilenames.length,
        status: newProperty.status,
      });
    } catch (err) {
      console.error(`[BULK] Property publish failed for row ${item.propertyNumber || (i + 1)}:`, err);
      failedResults.push({
        propertyNumber: item.propertyNumber || (i + 1),
        title: item.title || `Property ${item.propertyNumber || (i + 1)}`,
        error: err.message || "Failed to create property document.",
      });
    }
  }

  const isSuccess = publishedResults.length > 0;
  return {
    success: isSuccess,
    message: isSuccess
      ? `Bulk property publishing completed. ${publishedResults.length} properties published successfully.`
      : "Bulk property publishing failed for all submitted properties.",
    summary: {
      totalSubmitted: eligibleProperties.length,
      successfullyPublished: publishedResults.length,
      failedCount: failedResults.length,
      totalImagesUploaded,
    },
    publishedResults,
    failedResults,
  };
};

module.exports = {
  parseUploadedFile,
  parseImagesZip,
  generateBulkTemplate,
  validateBulkProperties,
  publishBulkProperties,
};
