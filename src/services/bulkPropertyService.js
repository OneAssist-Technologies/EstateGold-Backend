const fs = require("fs");
const xlsx = require("xlsx");
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
    throw new Error("Invalid or unreadable file input. Please upload a valid Excel or CSV file.");
  }

  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("The uploaded file does not contain any readable sheets.");
  }

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonRows = xlsx.utils.sheet_to_json(worksheet, { defval: "" });
  return jsonRows;
};

/**
 * Generates the standard EstateGold Bulk Property Upload Template Excel buffer.
 */
const generateBulkTemplate = () => {
  const templateHeaders = [
    {
      "Owner Name": "Mr. K. Ramakrishnan",
      "Owner Phone": "9876543210",
      "Owner Email": "owner1@example.com",
      "Owner Address": "12 MG Road, RS Puram, Coimbatore",
      "Purpose": "Rent",
      "Property Type": "Apartment / Flat",
      "Listing Type": "my_own",
      "Title": "Luxury 3 BHK Flat in Prime Location",
      "Description": "Spacious 3 BHK apartment with modern amenities and cross-ventilation.",
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
      "Lock-in Period": "6 Months",
      "Rent Escalation": "5% per annum",
      "Photos (URLs comma-separated)": "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2",
    },
    {
      "Owner Name": "Suresh Kumar",
      "Owner Phone": "9812345678",
      "Owner Email": "owner2@example.com",
      "Owner Address": "45 Race Course Road, Coimbatore",
      "Purpose": "Sale",
      "Property Type": "Villa",
      "Listing Type": "another_owner",
      "Title": "Premium 4 BHK Gated Community Villa",
      "Description": "Independent luxury villa with private garden and clubhouse access.",
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
      "Lock-in Period": "",
      "Rent Escalation": "",
      "Photos (URLs comma-separated)": "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9",
    },
    {
      "Owner Name": "Anand Vardhan",
      "Owner Phone": "9765432109",
      "Owner Email": "owner3@example.com",
      "Owner Address": "88 Avinashi Road, Coimbatore",
      "Purpose": "Lease",
      "Property Type": "Commercial Space",
      "Listing Type": "my_own",
      "Title": "Prime Commercial Office Space for Long Term Lease",
      "Description": "Fully fitted office space suitable for IT / Corporate back-office.",
      "State": "Tamil Nadu",
      "City": "Coimbatore",
      "Locality": "Avinashi Road",
      "Society": "Tech Park Tower",
      "Address": "88 Avinashi Road, TIDEL Park Zone",
      "Price": 120000,
      "Built-up Area (sq ft)": 2500,
      "Carpet Area (sq ft)": 2200,
      "Plot Area (sq ft)": "",
      "Bedrooms": "",
      "Bathrooms": 2,
      "Balconies": 0,
      "Floor": 3,
      "Total Floors": 8,
      "Facing": "East",
      "Furnishing": "Fully Furnished",
      "Parking": "Yes",
      "Property Age": "1-3 Years",
      "Maintenance Charges": 8000,
      "Agreement Type": "Lease Agreement",
      "Security Deposit": 600000,
      "Advance Amount": 120000,
      "Duration": "3 Years",
      "Notice Period": "3 Months",
      "Lock-in Period": "1 Year",
      "Rent Escalation": "10% every 3 years",
      "Photos (URLs comma-separated)": "https://images.unsplash.com/photo-1497366216548-37526070297c",
    },
  ];

  const worksheet = xlsx.utils.json_to_sheet(templateHeaders);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Template");
  return xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
};

/**
 * Validates each property row independently against EstateGold rules.
 */
const validateBulkProperties = async (rawRows, publisherDetails = {}) => {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return {
      success: false,
      message: "The uploaded file is empty or contains no valid rows.",
      totalProperties: 0,
      eligibleProperties: [],
      invalidProperties: [],
    };
  }

  // MANDATORY BUSINESS RULE: Must contain MORE THAN 1 property (at least 2)
  if (rawRows.length < 2) {
    return {
      success: false,
      isMinPropertyViolation: true,
      message: "Bulk upload requires more than one property. Please upload a file containing at least 2 properties.",
      totalProperties: rawRows.length,
      eligibleProperties: [],
      invalidProperties: [],
    };
  }

  const eligibleProperties = [];
  const invalidProperties = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNumber = i + 2; // Row number in Excel (header is row 1)
    const missingFields = [];
    const errorDetails = [];

    // Extract Owner Details (Flexible keys)
    const ownerName = getVal(row, ["Owner Name", "Property Owner Name", "ownerName", "Owner", "Publisher Name"]);
    const ownerPhone = getVal(row, ["Owner Phone", "Owner Phone Number", "ownerPhone", "Phone Number", "Phone"]).replace(/\D/g, "");
    const ownerEmail = getVal(row, ["Owner Email", "Owner Gmail", "ownerEmail", "Email", "Gmail", "Email Address"]);
    const ownerAddress = getVal(row, ["Owner Address", "ownerAddress", "Owner Location", "Owner Residence"]);

    // Extract Purpose & Listing Type (Flexible keys)
    const rawPurpose = getVal(row, ["Purpose", "purpose", "Listing Purpose", "Property Purpose"]);
    const rawListingType = getVal(row, ["Listing Type", "listingType", "Ownership Type"]);

    let purpose = "";
    let listingType = "my_own";

    if (["rent", "lease", "sale"].includes(rawPurpose.toLowerCase())) {
      purpose = rawPurpose.charAt(0).toUpperCase() + rawPurpose.slice(1).toLowerCase();
    } else if (["rent", "lease", "sale"].includes(rawListingType.toLowerCase())) {
      purpose = rawListingType.charAt(0).toUpperCase() + rawListingType.slice(1).toLowerCase();
    }

    if (["my_own", "another_owner"].includes(rawListingType.toLowerCase())) {
      listingType = rawListingType.toLowerCase();
    }

    // Extract Property Type (Flexible keys)
    const rawPropType = getVal(row, ["Property Type", "propertyType", "Type", "Category"]);
    let propertyType = rawPropType;
    if (rawPropType.toLowerCase().includes("apartment") || rawPropType.toLowerCase().includes("flat")) {
      propertyType = "Apartment / Flat";
    } else if (rawPropType.toLowerCase().includes("villa")) {
      propertyType = "Villa";
    } else if (rawPropType.toLowerCase().includes("house")) {
      propertyType = "Independent House";
    } else if (rawPropType.toLowerCase().includes("plot") || rawPropType.toLowerCase().includes("land")) {
      propertyType = "Plot / Land";
    } else if (rawPropType.toLowerCase().includes("commercial") || rawPropType.toLowerCase().includes("office") || rawPropType.toLowerCase().includes("shop")) {
      propertyType = "Commercial Space";
    }

    const title = getVal(row, ["Title", "Property Title", "title", "Name", "Listing Title"]);
    const description = getVal(row, ["Description", "description", "Overview", "Details"]);
    const state = getVal(row, ["State", "state", "Province"], "Tamil Nadu");
    const city = getVal(row, ["City", "city", "Location City"]);
    const locality = getVal(row, ["Locality", "locality", "Area", "Sub-locality"]);
    const society = getVal(row, ["Society", "society", "Building Name", "Apartment Name", "Project Name"]);
    const address = getVal(row, ["Address", "address", "Full Address", "Property Address"]);

    const price = parseFloat(getVal(row, ["Price", "price", "Amount", "Cost"]));
    const area = parseFloat(getVal(row, ["Area (sq.ft)", "Area (sq ft)", "Built-up Area (sq ft)", "area", "builtUpArea", "Carpet Area (sq.ft)", "carpetArea", "Plot Area (sq.ft)", "plotArea"]));
    const carpetArea = parseFloat(getVal(row, ["Carpet Area (sq.ft)", "Carpet Area (sq ft)", "carpetArea"])) || area;
    const plotArea = parseFloat(getVal(row, ["Plot Area (sq.ft)", "Plot Area (sq ft)", "plotArea"])) || (propertyType === "Plot / Land" ? area : 0);

    const bedrooms = parseInt(getVal(row, ["Bedrooms", "bedrooms", "BHK", "No. of Bedrooms"]));
    const bathrooms = parseInt(getVal(row, ["Bathrooms", "bathrooms", "Washrooms", "No. of Bathrooms"]));
    const balconies = parseInt(getVal(row, ["Balconies", "balconies"], "0"));
    const floor = parseInt(getVal(row, ["Floor", "floor", "Floor No"], "0"));
    const totalFloors = parseInt(getVal(row, ["Total Floors", "totalFloors", "Total Floor"], "1"));

    const facing = getVal(row, ["Facing", "facing", "Direction"], "East");
    const furnishing = getVal(row, ["Furnishing", "furnishing", "Furnishing Status"], "Semi-Furnished");
    const parkingVal = getVal(row, ["Parking", "parking", "Parking Spaces", "Covered Parking"]);
    const parking = parkingVal.toLowerCase() === "yes" || parkingVal.toLowerCase() === "true" || parkingVal === "1" || (parseInt(parkingVal) > 0);
    const propertyAge = getVal(row, ["Property Age", "propertyAge", "Age"], "1-3 Years");
    const maintenance = parseFloat(getVal(row, ["Maintenance Charges", "maintenance", "Maintenance"], "0"));

    const agreementType = getVal(row, ["Agreement Type", "agreementType"], purpose === "Lease" ? "Lease Agreement" : "Rental Agreement");
    const securityDeposit = parseFloat(getVal(row, ["Security Deposit", "securityDeposit", "Deposit"], "0"));
    const advanceAmount = parseFloat(getVal(row, ["Advance Amount", "advanceAmount", "Token Amount"], "0"));
    const duration = getVal(row, ["Agreement Duration", "Duration", "duration"]);
    const noticePeriod = getVal(row, ["Notice Period", "noticePeriod"], "2 Months");
    const lockInPeriod = getVal(row, ["Lock-in Period", "lockInPeriod"], "6 Months");
    const rentEscalation = getVal(row, ["Rent Escalation", "rentEscalation"], "5% per annum");

    const photosRaw = getVal(row, ["Photos (URLs comma-separated)", "Photos", "photos", "Images"]);
    const photos = photosRaw
      ? photosRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    // 1. Validate Mandatory Owner Details
    if (!ownerName) missingFields.push("Owner Name");
    if (!ownerPhone || ownerPhone.length !== 10) {
      missingFields.push("Owner Phone");
      errorDetails.push("Owner Phone must be exactly 10 digits.");
    }
    if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
      missingFields.push("Owner Email");
      errorDetails.push("Owner Email must be a valid email address.");
    }
    if (!ownerAddress) missingFields.push("Owner Address");

    // 2. Validate Base Property Fields
    if (!purpose) {
      missingFields.push("Purpose (Rent/Lease/Sale)");
    } else if (!["rent", "lease", "sale"].includes(purpose.toLowerCase())) {
      missingFields.push("Purpose");
      errorDetails.push("Purpose must be Rent, Lease, or Sale.");
    }
    if (!propertyType) missingFields.push("Property Type");
    if (!state) missingFields.push("State");
    if (!city) missingFields.push("City");
    if (!locality) missingFields.push("Locality");
    if (!address) missingFields.push("Full Address");

    if (isNaN(price) || price <= 0) {
      missingFields.push("Price");
      errorDetails.push("Price must be a positive number.");
    }

    // 3. Property Type Specific Validations
    const isResidential = ["Apartment / Flat", "Independent House", "Villa", "Builder Floor"].includes(propertyType);
    const isPlot = ["Plot / Land", "Residential Plot", "Agricultural Land"].includes(propertyType);

    if (isResidential) {
      if (isNaN(bedrooms) || bedrooms < 1) missingFields.push("Bedrooms");
      if (isNaN(bathrooms) || bathrooms < 1) missingFields.push("Bathrooms");
      if (isNaN(carpetArea) || carpetArea <= 0) {
        if (isNaN(area) || area <= 0) {
          missingFields.push("Carpet / Built-up Area");
        }
      }
      if (!facing) missingFields.push("Facing Direction");
      if (!furnishing) missingFields.push("Furnishing Status");
    } else if (isPlot) {
      if (isNaN(plotArea) || plotArea <= 0) {
        if (isNaN(area) || area <= 0) {
          missingFields.push("Plot Area");
        }
      }
    } else {
      // Commercial, Office, Shop, etc.
      if (isNaN(area) || area <= 0) missingFields.push("Built-up / Usable Area");
    }

    // 4. Rent / Lease Agreement Details Validation
    const isRentOrLease = purpose.toLowerCase() === "rent" || purpose.toLowerCase() === "lease";
    if (isRentOrLease) {
      if (!agreementType) missingFields.push("Agreement Type");
      if (isNaN(securityDeposit) || securityDeposit <= 0) missingFields.push("Security Deposit");
      if (!duration) missingFields.push("Agreement Duration");
    }

    // 5. Serviceability Check (if location is provided)
    let serviceableAreaId = null;
    if (city && locality) {
      try {
        const serviceCheck = await checkPropertyServiceability({ city, locality, address, state });
        if (serviceCheck.isServiceable && serviceCheck.matchedLocation) {
          serviceableAreaId = serviceCheck.matchedLocation._id;
        }
      } catch (e) {
        // Location check error ignored for bulk validate
      }
    }

    if (missingFields.length > 0 || errorDetails.length > 0) {
      invalidProperties.push({
        rowNumber,
        propertyType: propertyType || "Unknown",
        title: title || `${bedrooms ? bedrooms + " BHK " : ""}${propertyType || "Property"} at ${locality || city || "N/A"}`,
        missingFields,
        errorDetails: errorDetails.length > 0 ? errorDetails : missingFields.map((f) => `Missing required field: ${f}`),
        rawRow: row,
      });
    } else {
      const normalizedData = {
        rowNumber,
        ownerName,
        ownerPhone,
        ownerEmail,
        ownerAddress,
        purpose,
        propertyType,
        listingType,
        title: title || `${bedrooms ? bedrooms + " BHK " : ""}${propertyType} in ${locality}, ${city}`,
        description: description || `Splendid ${propertyType} available for ${purpose} located in ${locality}, ${city}.`,
        state,
        city,
        locality,
        society,
        address,
        price,
        area: area || carpetArea || plotArea || 0,
        carpetArea: carpetArea || area || 0,
        plotArea: plotArea || 0,
        bedrooms: bedrooms || 0,
        bathrooms: bathrooms || 0,
        balconies,
        floor,
        totalFloors,
        facing,
        furnishing,
        parking,
        propertyAge,
        maintenance,
        photos,
        serviceableAreaId,
        ...(isRentOrLease
          ? {
              agreementDetails: {
                agreementType,
                amount: price,
                advanceAmount: advanceAmount || price,
                securityDeposit,
                duration,
                noticePeriod,
                lockInPeriod,
                rentEscalation,
              },
            }
          : {}),
      };

      eligibleProperties.push(normalizedData);
    }
  }

  return {
    success: true,
    totalProperties: rawRows.length,
    eligibleCount: eligibleProperties.length,
    invalidCount: invalidProperties.length,
    eligibleProperties,
    invalidProperties,
  };
};

/**
 * Generates an Excel Error Report buffer for invalid properties.
 */
const generateErrorReportBuffer = (invalidProperties) => {
  const reportRows = invalidProperties.map((inv) => ({
    "Excel Row #": inv.rowNumber,
    "Property Type": inv.propertyType,
    "Title / Reference": inv.title,
    "Status": "Needs Attention",
    "Missing Required Fields": inv.missingFields.join(", "),
    "Error Details": inv.errorDetails.join(" | "),
  }));

  const worksheet = xlsx.utils.json_to_sheet(reportRows);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Error_Report");
  return xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
};

/**
 * Saves eligible pre-validated bulk properties into MongoDB.
 */
const publishBulkProperties = async (eligibleProperties, agentUser, publisherDetails = {}) => {
  if (!Array.isArray(eligibleProperties) || eligibleProperties.length === 0) {
    return {
      success: false,
      message: "No eligible properties provided for publishing.",
      publishedCount: 0,
      failedCount: 0,
      publishedProperties: [],
    };
  }

  const agentId = agentUser._id || agentUser.id;

  let settings = await SystemSettings.findOne();
  const approvalRequired = settings ? (settings.propertyApprovalRequired ?? true) : true;
  const initialStatus = approvalRequired ? "pending" : "approved";
  const approvalStatus = initialStatus === "approved" ? "approved" : "pending";
  const verificationStatus = initialStatus === "approved" ? "verified" : "unverified";

  const createdProps = [];
  let failedCount = 0;

  for (const item of eligibleProperties) {
    try {
      const { rowNumber, ...propertyData } = item;

      if (!propertyData.serviceableAreaId) {
        delete propertyData.serviceableAreaId;
      }

      const propDoc = new Property({
        ...propertyData,
        ownerName: item.ownerName,
        ownerPhone: item.ownerPhone,
        ownerEmail: item.ownerEmail,
        ownerAddress: item.ownerAddress,
        createdBy: agentId,
        ownerId: agentId,
        role: "agent",
        ownerRole: "agent",
        // Status requires admin approval before appearing in public listings
        status: initialStatus,
        approvalStatus: approvalStatus,
        verificationStatus: verificationStatus,
        availabilityStatus: "on_sale",
      });
      await propDoc.save();
      createdProps.push(propDoc);
    } catch (err) {
      console.error("Failed to publish bulk property row:", err);
      failedCount++;
    }
  }

  return {
    success: true,
    publishedCount: createdProps.length,
    failedCount,
    publishedProperties: createdProps,
  };
};

module.exports = {
  parseUploadedFile,
  generateBulkTemplate,
  validateBulkProperties,
  generateErrorReportBuffer,
  publishBulkProperties,
};
