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
const getVal = (row, keys, defaultVal = "") => {
  if (!row || typeof row !== "object") return defaultVal;
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
      return String(row[k]).trim();
    }
  }
  return defaultVal;
};

/**
 * Parses uploaded Excel (.xlsx) or CSV (.csv) file or buffer into JSON objects.
 */
const parseUploadedFile = (fileInput) => {
  let workbook;
  if (fileInput && fileInput.path && fs.existsSync(fileInput.path)) {
    workbook = xlsx.readFile(fileInput.path);
  } else if (fileInput && fileInput.buffer) {
    workbook = xlsx.read(fileInput.buffer, { type: "buffer" });
  } else if (Buffer.isBuffer(fileInput)) {
    workbook = xlsx.read(fileInput, { type: "buffer" });
  } else if (typeof fileInput === "string" && fs.existsSync(fileInput)) {
    workbook = xlsx.readFile(fileInput);
  } else {
    throw new Error("Invalid or unreadable Excel file input.");
  }

  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("The uploaded file does not contain any readable sheets.");
  }

  // Find sheet containing property data
  const dataSheetName =
    workbook.SheetNames.find((s) => s.toLowerCase().includes("property") || s.toLowerCase().includes("data")) ||
    workbook.SheetNames[0];

  const worksheet = workbook.Sheets[dataSheetName];
  const jsonRows = xlsx.utils.sheet_to_json(worksheet, { defval: "" });
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
 * Generates the official EstateGold Bulk Property Upload Template Excel workbook.
 */
const generateBulkTemplate = () => {
  const workbook = xlsx.utils.book_new();

  // SHEET 1: INSTRUCTIONS
  const instructionsData = [
    ["ESTATEGOLD BULK PROPERTY UPLOAD INSTRUCTIONS"],
    [""],
    ["Welcome to the EstateGold Bulk Property Upload System!"],
    ["Follow these simple steps to list multiple properties with automated image mapping:"],
    [""],
    ["1. DO NOT MODIFY PROPERTY NUMBERS:"],
    ["   - Keep the system-generated 'Property Number' column intact (1, 2, 3, 4, 5...)."],
    ["   - The Property Number acts as the unique mapping key between Excel rows and image folders."],
    [""],
    ["2. FILL PROPERTY INFORMATION:"],
    ["   - Fill out the property details for each row in the 'Property Data' sheet."],
    ["   - Supported Purposes: Sale, Rent, Lease, PG / Co-Living."],
    ["   - Required Fields: Purpose, Property Type, Title, City, Locality, Address, Price/Rent."],
    [""],
    ["3. PREPARE PROPERTY-WISE IMAGE FOLDERS:"],
    ["   - Create a separate folder for each property on your computer."],
    ["   - Folder names MUST match the Property Number (e.g. 'Property 1' or '1' for Property Number 1)."],
    ["   - Example Folder Structure:"],
    ["       my_properties.zip"],
    ["       ├── Property 1/"],
    ["       │   ├── photo1.jpg"],
    ["       │   └── photo2.jpg"],
    ["       ├── Property 2/"],
    ["       │   ├── photo1.jpg"],
    ["       │   └── photo2.jpg"],
    ["       └── Property 3/"],
    ["           ├── photo1.jpg"],
    ["           └── photo2.jpg"],
    [""],
    ["4. UPLOAD EXCEL & IMAGES ZIP:"],
    ["   - Upload your filled Excel file (.xlsx) and your Images ZIP file (.zip) on the Bulk Upload page."],
    ["   - Click 'Validate' to review your data and automatic image folder matching."],
    ["   - Click 'Publish' to complete the upload!"],
  ];

  const instructionsSheet = xlsx.utils.aoa_to_sheet(instructionsData);
  xlsx.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

  // SHEET 2: PROPERTY DATA (With Pre-Populated Property Numbers & Sample Data)
  const templateRows = [];

  for (let i = 1; i <= 15; i++) {
    if (i === 1) {
      // Sample Row 1: Residential Rent
      templateRows.push({
        "Property Number": i,
        "Purpose": "Rent",
        "Property Type": "Apartment / Flat",
        "Listing Type": "my_own",
        "Title": "(SAMPLE) Luxury 3 BHK Flat in Prime Location",
        "Description": "Spacious 3 BHK apartment with modern amenities and cross-ventilation.",
        "Owner Name": "Ramakrishnan",
        "Owner Phone": "9876543210",
        "Owner Email": "owner1@example.com",
        "Owner Address": "12 MG Road, RS Puram",
        "State": "Tamil Nadu",
        "City": "Coimbatore",
        "Locality": "RS Puram",
        "Society": "Green Valley Apartments",
        "Address": "124 DB Road, RS Puram",
        "Price": 35000,
        "Built-up Area (sq ft)": 1500,
        "Carpet Area (sq ft)": 1350,
        "Plot Area (sq ft)": "",
        "Bedrooms": 3,
        "Bathrooms": 3,
        "Balconies": 2,
        "Floor": 4,
        "Total Floors": 10,
        "Facing": "East",
        "Furnishing": "Semi-Furnished",
        "Parking": "Yes",
        "Property Age": "0-1 Years",
        "Maintenance Charges": 2500,
        "Agreement Type": "Rental Agreement",
        "Security Deposit": 150000,
        "Advance Amount": 35000,
        "Duration": "11 Months",
        "Notice Period": "2 Months",
        "PG Name": "",
        "Publisher Role": "",
        "Accommodation Type": "",
        "Suitable For": "",
        "Occupant Type": "",
        "Food Availability": "",
        "Meals Included": "",
      });
    } else if (i === 2) {
      // Sample Row 2: Residential Sale
      templateRows.push({
        "Property Number": i,
        "Purpose": "Sale",
        "Property Type": "Villa",
        "Listing Type": "another_owner",
        "Title": "(SAMPLE) Premium 4 BHK Gated Community Villa",
        "Description": "Independent luxury villa with private garden and clubhouse access.",
        "Owner Name": "Suresh Kumar",
        "Owner Phone": "9812345678",
        "Owner Email": "owner2@example.com",
        "Owner Address": "45 Race Course Road",
        "State": "Tamil Nadu",
        "City": "Coimbatore",
        "Locality": "Race Course",
        "Society": "Royal Palms Villa",
        "Address": "45 Race Course Road",
        "Price": 18500000,
        "Built-up Area (sq ft)": 3200,
        "Carpet Area (sq ft)": 2800,
        "Plot Area (sq ft)": 2400,
        "Bedrooms": 4,
        "Bathrooms": 4,
        "Balconies": 3,
        "Floor": 2,
        "Total Floors": 2,
        "Facing": "North",
        "Furnishing": "Fully Furnished",
        "Parking": "Yes",
        "Property Age": "1-3 Years",
        "Maintenance Charges": 5000,
        "Agreement Type": "",
        "Security Deposit": "",
        "Advance Amount": "",
        "Duration": "",
        "Notice Period": "",
        "PG Name": "",
        "Publisher Role": "",
        "Accommodation Type": "",
        "Suitable For": "",
        "Occupant Type": "",
        "Food Availability": "",
        "Meals Included": "",
      });
    } else if (i === 3) {
      // Sample Row 3: PG / Co-Living
      templateRows.push({
        "Property Number": i,
        "Purpose": "PG / Co-Living",
        "Property Type": "PG / Hostel",
        "Listing Type": "my_own",
        "Title": "(SAMPLE) Green Oasis Premium Men's PG",
        "Description": "Fully furnished PG for working professionals with 3 meals & high speed WiFi.",
        "Owner Name": "Karthik Raja",
        "Owner Phone": "9765432109",
        "Owner Email": "owner3@example.com",
        "Owner Address": "88 Saibaba Colony",
        "State": "Tamil Nadu",
        "City": "Coimbatore",
        "Locality": "Saibaba Colony",
        "Society": "Green Oasis PG",
        "Address": "88 NSR Road, Saibaba Colony",
        "Price": 7500,
        "Built-up Area (sq ft)": 2400,
        "Carpet Area (sq ft)": 2200,
        "Plot Area (sq ft)": "",
        "Bedrooms": "",
        "Bathrooms": 4,
        "Balconies": 1,
        "Floor": 1,
        "Total Floors": 3,
        "Facing": "North-East",
        "Furnishing": "Fully Furnished",
        "Parking": "Yes",
        "Property Age": "0-1 Years",
        "Maintenance Charges": 0,
        "Agreement Type": "",
        "Security Deposit": 15000,
        "Advance Amount": "",
        "Duration": "",
        "Notice Period": "1 Month",
        "PG Name": "Green Oasis Men's PG",
        "Publisher Role": "PG Owner",
        "Accommodation Type": "PG / Co-Living",
        "Suitable For": "Boys",
        "Occupant Type": "Working Professionals",
        "Food Availability": "Available",
        "Meals Included": "Breakfast, Lunch, Dinner",
      });
    } else {
      // Blank Template Row with Property Number pre-filled
      templateRows.push({
        "Property Number": i,
        "Purpose": "",
        "Property Type": "",
        "Listing Type": "my_own",
        "Title": "",
        "Description": "",
        "Owner Name": "",
        "Owner Phone": "",
        "Owner Email": "",
        "Owner Address": "",
        "State": "Tamil Nadu",
        "City": "Coimbatore",
        "Locality": "",
        "Society": "",
        "Address": "",
        "Price": "",
        "Built-up Area (sq ft)": "",
        "Carpet Area (sq ft)": "",
        "Plot Area (sq ft)": "",
        "Bedrooms": "",
        "Bathrooms": "",
        "Balconies": "",
        "Floor": "",
        "Total Floors": "",
        "Facing": "",
        "Furnishing": "",
        "Parking": "Yes",
        "Property Age": "",
        "Maintenance Charges": "",
        "Agreement Type": "",
        "Security Deposit": "",
        "Advance Amount": "",
        "Duration": "",
        "Notice Period": "",
        "PG Name": "",
        "Publisher Role": "",
        "Accommodation Type": "",
        "Suitable For": "",
        "Occupant Type": "",
        "Food Availability": "",
        "Meals Included": "",
      });
    }
  }

  const propertyDataSheet = xlsx.utils.json_to_sheet(templateRows);
  xlsx.utils.book_append_sheet(workbook, propertyDataSheet, "Property Data");

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

    // Extract Property Number
    const rawPropNum = getVal(row, ["Property Number", "PropertyNo", "Property #", "PropertyID", "PropNum", "S.No"]);
    const propNum = rawPropNum ? String(parseInt(rawPropNum, 10) || rawPropNum) : String(i + 1);
    processedPropertyNumbers.add(propNum);

    const errors = [];

    // Owner Details
    const ownerName = getVal(row, ["Owner Name", "Property Owner Name", "ownerName", "Owner"]);
    const ownerPhone = getVal(row, ["Owner Phone", "Owner Phone Number", "ownerPhone", "Phone"]).replace(/\D/g, "");
    const ownerEmail = getVal(row, ["Owner Email", "ownerEmail", "Email"]);
    const ownerAddress = getVal(row, ["Owner Address", "ownerAddress"]);

    // Purpose & Listing Type
    const rawPurpose = getVal(row, ["Purpose", "purpose", "Listing Purpose"]);
    const rawListingType = getVal(row, ["Listing Type", "listingType"]);

    let purpose = "";
    let listingType = "my_own";

    const pLower = rawPurpose.toLowerCase();
    if (pLower.includes("pg") || pLower.includes("co-living") || pLower.includes("hostel")) {
      purpose = "PG / Co-Living";
    } else if (pLower.includes("rent")) {
      purpose = "Rent";
    } else if (pLower.includes("lease")) {
      purpose = "Lease";
    } else if (pLower.includes("sale") || pLower.includes("buy")) {
      purpose = "Sale";
    }

    if (["my_own", "another_owner"].includes(rawListingType.toLowerCase())) {
      listingType = rawListingType.toLowerCase();
    }

    if (!purpose) {
      errors.push("Listing Purpose is required (Sale, Rent, Lease, or PG / Co-Living).");
    }

    // Property Type
    const rawPropType = getVal(row, ["Property Type", "propertyType", "Type"]);
    let propertyType = rawPropType;

    const tLower = rawPropType.toLowerCase();
    if (tLower.includes("apartment") || tLower.includes("flat")) propertyType = "Apartment / Flat";
    else if (tLower.includes("villa")) propertyType = "Villa";
    else if (tLower.includes("house") || tLower.includes("independent")) propertyType = "Independent House";
    else if (tLower.includes("builder") || tLower.includes("floor")) propertyType = "Builder Floor";
    else if (tLower.includes("plot") || tLower.includes("land")) propertyType = "Plot / Land";
    else if (tLower.includes("commercial") || tLower.includes("office") || tLower.includes("shop")) propertyType = "Commercial Space";
    else if (tLower.includes("pg") || tLower.includes("hostel")) propertyType = "PG / Hostel";

    if (!propertyType) {
      errors.push("Property Type is required.");
    }

    const title = getVal(row, ["Title", "Property Title", "title"]);
    const description = getVal(row, ["Description", "description"]);
    const state = getVal(row, ["State", "state"], "Tamil Nadu");
    const city = getVal(row, ["City", "city"]);
    const locality = getVal(row, ["Locality", "locality"]);
    const society = getVal(row, ["Society", "society"]);
    const address = getVal(row, ["Address", "address"]);

    if (!title) errors.push("Property Title is required.");
    if (!city) errors.push("City is required.");
    if (!locality) errors.push("Locality is required.");
    if (!address) errors.push("Address is required.");

    const price = parseFloat(getVal(row, ["Price", "price", "Rent", "Amount"])) || 0;
    if (price <= 0) {
      errors.push("Valid Price / Rent is required (must be greater than 0).");
    }

    const area = parseFloat(getVal(row, ["Area (sq ft)", "Built-up Area (sq ft)", "area"])) || 0;
    const carpetArea = parseFloat(getVal(row, ["Carpet Area (sq ft)", "carpetArea"])) || area;
    const plotArea = parseFloat(getVal(row, ["Plot Area (sq ft)", "plotArea"])) || (propertyType === "Plot / Land" ? area : 0);

    const bedrooms = parseInt(getVal(row, ["Bedrooms", "bedrooms"])) || 0;
    const bathrooms = parseInt(getVal(row, ["Bathrooms", "bathrooms"])) || 0;
    const balconies = parseInt(getVal(row, ["Balconies", "balconies"])) || 0;
    const floor = parseInt(getVal(row, ["Floor", "floor"])) || 0;
    const totalFloors = parseInt(getVal(row, ["Total Floors", "totalFloors"])) || 1;

    const facing = getVal(row, ["Facing", "facing"], "East");
    const furnishing = getVal(row, ["Furnishing", "furnishing"], "Semi-Furnished");
    const parkingVal = getVal(row, ["Parking", "parking"]);
    const parking = parkingVal.toLowerCase() === "yes" || parkingVal.toLowerCase() === "true" || parkingVal === "1";
    const propertyAge = getVal(row, ["Property Age", "propertyAge"], "1-3 Years");
    const maintenance = parseFloat(getVal(row, ["Maintenance Charges", "maintenance"])) || 0;

    // PG Details
    let pgDetails = null;
    if (purpose === "PG / Co-Living") {
      const pgName = getVal(row, ["PG Name", "pgName"], title);
      const publisherType = getVal(row, ["Publisher Role", "publisherType"], "PG Owner");
      const accommodationType = getVal(row, ["Accommodation Type", "accommodationType"], "PG / Co-Living");
      const suitableFor = getVal(row, ["Suitable For", "suitableFor"], "Anyone");
      const occupantType = getVal(row, ["Occupant Type", "occupantType"], "Students & Professionals");
      const foodAvailability = getVal(row, ["Food Availability", "foodAvailability"], "Available");
      const mealsRaw = getVal(row, ["Meals Included", "mealsIncluded"]);
      const mealsIncluded = mealsRaw ? mealsRaw.split(",").map((m) => m.trim()).filter(Boolean) : ["Breakfast", "Dinner"];

      pgDetails = {
        pgName,
        publisherType,
        accommodationType,
        suitableFor,
        occupantType,
        foodAvailability,
        mealsIncluded,
        furnishing,
        rooms: [
          {
            roomId: `room_${Date.now()}_1`,
            roomType: propertyType,
            sharingType: "Single Sharing",
            roomCount: 1,
            totalBeds: 1,
            occupiedBeds: 0,
            reservedBeds: 0,
            availableBeds: 1,
            pricePerPerson: price,
            securityDeposit: parseFloat(getVal(row, ["Security Deposit", "securityDeposit"])) || 0,
            bathroomType: "Attached Bath",
            ac: true,
            status: "AVAILABLE",
          },
        ],
        facilities: ["WiFi", "Power Backup", "Washing Machine", "CCTV"],
        charges: {
          securityDeposit: parseFloat(getVal(row, ["Security Deposit", "securityDeposit"])) || 0,
          maintenanceCharges: maintenance,
          noticePeriod: getVal(row, ["Notice Period", "noticePeriod"], "1 Month"),
        },
      };
    }

    // CHECK SERVICEABILITY
    let serviceability = null;
    try {
      const serviceCheck = await checkPropertyServiceability(city, locality);
      if (!serviceCheck.isServiceable) {
        errors.push(`Location ${locality}, ${city} is currently not in a serviceable area.`);
      } else {
        serviceability = serviceCheck;
      }
    } catch (geoErr) {
      // Ignore geo lookup errors during bulk validation
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
      ownerName: ownerName || publisherDetails.contactName || "Property Owner",
      ownerPhone: ownerPhone || publisherDetails.contactPhone || "9876543210",
      ownerEmail: ownerEmail || publisherDetails.contactEmail || "",
      ownerAddress: ownerAddress || publisherDetails.contactAddress || "",
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
      propertyAge,
      maintenance,
      pgDetails,
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
      totalRows: rawRows.length,
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
 * Creates MongoDB property documents and uploads folder images to Cloudinary / Local storage.
 */
const publishBulkProperties = async (eligibleProperties, user, publisherDetails = {}, zipFileInput = null) => {
  if (!Array.isArray(eligibleProperties) || eligibleProperties.length === 0) {
    throw new Error("No eligible properties provided for publishing.");
  }

  // Parse ZIP archive if provided for image extraction
  let zipData = { folderMap: {} };
  if (zipFileInput) {
    try {
      zipData = parseImagesZip(zipFileInput);
    } catch (e) {
      console.error("Failed to parse ZIP file during publish:", e);
    }
  }

  const uploadDir = path.join(process.cwd(), "uploads/properties");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const publishedResults = [];
  const failedResults = [];
  let totalImagesUploaded = 0;

  for (let i = 0; i < eligibleProperties.length; i++) {
    const item = eligibleProperties[i];
    try {
      const serviceCheck = await checkPropertyServiceability(item.city, item.locality);

      let lat = 11.0168;
      let lng = 76.9558;
      let areaId = null;

      if (serviceCheck && serviceCheck.isServiceable && serviceCheck.matchedLocation) {
        lat = serviceCheck.latitude || lat;
        lng = serviceCheck.longitude || lng;
        areaId = serviceCheck.matchedLocation._id;
      }

      // Check if approval is required
      let approvalRequired = true;
      try {
        const sysSettings = await SystemSettings.findOne({ key: "approval_settings" });
        if (sysSettings && sysSettings.value) {
          approvalRequired = Boolean(sysSettings.value.requirePropertyApproval);
        }
      } catch (sysErr) {
        // Fallback
      }

      const initialStatus = approvalRequired ? "pending" : "approved";
      const cleanedData = cleanPropertyDetails(item.propertyType, item);

      // Save property images from ZIP
      const propNum = String(item.propertyNumber);
      const zipImageEntries = zipData.folderMap[propNum] || zipData.folderMap[String(i + 1)] || [];
      const savedPhotoFilenames = [];

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
          console.error(`Failed to save image ${imgEntry.fileName} for property ${propNum}:`, imgErr);
        }
      }

      const newProperty = await Property.create({
        ...cleanedData,
        ownerName: item.ownerName || publisherDetails.contactName || user.name || "Property Owner",
        ownerPhone: item.ownerPhone || publisherDetails.contactPhone || user.phone || "9876543210",
        ownerEmail: item.ownerEmail || publisherDetails.contactEmail || user.email || "",
        ownerAddress: item.ownerAddress || publisherDetails.contactAddress || "",
        ownerId: user._id || user.id,
        createdBy: user._id || user.id,
        status: initialStatus,
        availabilityStatus: "on_sale",
        latitude: lat,
        longitude: lng,
        serviceableAreaId: areaId,
        photos: savedPhotoFilenames.length > 0 ? savedPhotoFilenames : ["default_property.jpg"],
        pgDetails: item.pgDetails || undefined,
      });

      publishedResults.push({
        propertyNumber: propNum,
        propertyId: newProperty._id,
        title: newProperty.title || item.title,
        imagesCount: savedPhotoFilenames.length,
        status: newProperty.status,
      });
    } catch (err) {
      console.error(`Failed to publish property row ${item.propertyNumber}:`, err);
      failedResults.push({
        propertyNumber: item.propertyNumber,
        title: item.title || `Property ${item.propertyNumber}`,
        error: err.message || "Failed to create property document.",
      });
    }
  }

  return {
    success: true,
    message: `Bulk property publishing completed. ${publishedResults.length} properties published successfully.`,
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
