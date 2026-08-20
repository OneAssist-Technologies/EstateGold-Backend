const Property = require("../models/Property");
const Location = require("../models/Location");
const User = require("../models/User");
const { checkPropertyServiceability } = require("../utils/geoUtils");
const jwt = require("jsonwebtoken");

const getOptionalUser = (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded) {
        return {
          _id: decoded._id || decoded.id,
          id: decoded.id || decoded._id,
          role: decoded.role || "buyer"
        };
      }
    }
  } catch (err) {
    // Ignore error
  }
  return null;
};

const formatDocUrl = (url, baseUrl) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    if (url.includes("/uploads/properties/")) {
      return url.replace("/uploads/properties/", "/view-file/");
    }
    return url;
  }
  const clean = url.replace(/^\/+/, "").replace(/^uploads\/properties\//, "").replace(/^uploads\//, "");
  return `${baseUrl}/view-file/${clean}`;
};

const sanitizePropertyData = (propertyObj, req) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const user = getOptionalUser(req);
  
  // Format photos
  const photos = (propertyObj.photos || []).map((photo) => {
    if (!photo) return "";
    if (photo.startsWith("http://") || photo.startsWith("https://")) return photo;
    const clean = photo.replace(/^\/+/, "").replace(/^uploads\/properties\//, "").replace(/^uploads\//, "");
    return `${baseUrl}/uploads/properties/${clean}`;
  });

  const hasDocs = propertyObj.documents && propertyObj.documents.length > 0;
  
  // Check authorization
  let isAuthorized = false;
  if (user) {
    if (user.role === "admin") {
      isAuthorized = true;
    } else {
      const ownerId = propertyObj.ownerId
        ? (propertyObj.ownerId._id || propertyObj.ownerId).toString()
        : propertyObj.createdBy
          ? (propertyObj.createdBy._id || propertyObj.createdBy).toString()
          : "";
      
      const createdBy = propertyObj.createdBy
        ? (propertyObj.createdBy._id || propertyObj.createdBy).toString()
        : "";
        
      const currentUserId = user._id ? user._id.toString() : "";
      
      if (currentUserId && (currentUserId === ownerId || currentUserId === createdBy)) {
        isAuthorized = true;
      }
    }
  }

  const result = {
    ...propertyObj,
    photos,
    documentsAvailable: hasDocs,
    uploadedDocumentTypes: (propertyObj.documents || []).map(doc => doc.documentType)
  };

  if (isAuthorized) {
    result.documents = (propertyObj.documents || []).map((doc) => {
      const docObj = doc.toObject ? doc.toObject() : { ...doc };
      if (docObj.fileUrl) {
        docObj.fileUrl = formatDocUrl(docObj.fileUrl, baseUrl);
      }
      return docObj;
    });
  } else {
    delete result.documents;
  }

  return result;
};

const safeNumber = (
  value,
  defaultValue = 0
) => {
  const num = Number(value);

  return Number.isNaN(num)
    ? defaultValue
    : num;
};

const cleanPropertyDetails = (propertyType, body) => {
  const commonFields = [
    "purpose", "propertyType", "ownerName", "ownerPhone", "ownerEmail", "ownerType",
    "agentRelation", "ownerIdType", "ownerIdNumber", "ownerGovtIdDoc", "ownerAddress",
    "listingType", "city", "state", "locality", "society", "address", "latitude",
    "longitude", "serviceableAreaId", "price", "description", "availableFrom", "photos",
    "neighbourhood", "status", "availabilityStatus", "role", "createdBy", "ownerNegotiable",
    "ownerReadyToMeet", "marketInsight", "amenities", "facing", "pendingIssues", "documents",
    "ownershipType", "numberOfOwners", "pan"
  ];

  let allowedTypeFields = [];
  switch (propertyType) {
    case "Apartment / Flat":
      allowedTypeFields = [
        "bedrooms", "bathrooms", "balconies", "area", "carpetArea", "floor", "totalFloors",
        "furnishing", "parking", "lift", "powerBackup", "security", "society", "maintenance",
        "superArea", "propertyAge", "waterAvailability"
      ];
      break;
    case "Independent House":
      allowedTypeFields = [
        "plotArea", "area", "carpetArea", "bedrooms", "bathrooms", "floor", "totalFloors",
        "propertyAge", "parking", "length", "width", "roadWidth", "frontage", "cornerPlot",
        "boundaryWall", "garden", "terrace", "waterAvailability", "electricityAvailability",
        "solar", "furnishing", "compoundWall", "borewell", "electricity"
      ];
      break;
    case "Villa":
      allowedTypeFields = [
        "community", "plotArea", "area", "carpetArea", "bedrooms", "bathrooms", "floor",
        "totalFloors", "propertyAge", "parking", "garden", "privatePool", "terrace",
        "servantRoom", "furnishing", "maintenance", "solar"
      ];
      break;
    case "Builder Floor":
      allowedTypeFields = [
        "bedrooms", "bathrooms", "balconies", "area", "carpetArea", "floor", "totalFloors",
        "propertyAge", "furnishing", "parking", "lift", "powerBackup", "security", "maintenance",
        "numberOfUnits"
      ];
      break;
    case "Plot / Land":
    case "Residential Plot":
      allowedTypeFields = [
        "plotArea", "plotFacing", "roadWidth", "cornerPlot", "boundaryWall", "plotType",
        "landApproval", "waterAvailability", "electricityAvailability", "length", "width",
        "frontage", "layoutName", "gatedLayout", "drainage", "roadAccess", "gps",
        "surveyNumber", "subdivisionNumber", "landClassification", "zoning"
      ];
      break;
    case "Agricultural Land":
      allowedTypeFields = [
        "plotArea", "surveyNumber", "village", "taluk", "district", "landClassification",
        "length", "width", "roadAccess", "roadWidth", "irrigation", "borewell",
        "waterAvailability", "electricityAvailability", "fencing", "crops", "soilType",
        "farmhouse", "pricePerAcre"
      ];
      break;
    case "Commercial Space":
    case "Office Space":
      allowedTypeFields = [
        "carpetArea", "area", "floor", "totalFloors", "furnishing", "workstations",
        "cabins", "meetingRooms", "reception", "pantry", "serverRoom", "washrooms",
        "lift", "parking", "powerBackup", "ac", "internet", "security", "fireSafety",
        "maintenance", "propertyAge", "powerLoad", "entranceWidth"
      ];
      break;
    case "Shop / Retail":
      allowedTypeFields = [
        "carpetArea", "area", "floor", "frontage", "ceilingHeight", "roadWidth",
        "mainRoadFacing", "cornerShop", "shutters", "parking", "powerLoad",
        "waterAvailability", "washrooms", "signboard", "footfallEstimate",
        "suitableBusiness", "maintenance"
      ];
      break;
    case "Warehouse":
      allowedTypeFields = [
        "area", "carpetArea", "ceilingHeight", "loadingUnloading", "dock", "truckAccess",
        "roadWidth", "storageCapacity", "flooring", "powerLoad", "waterAvailability",
        "officeArea", "security", "fireSafety", "parking"
      ];
      break;
    case "Industrial Property":
      allowedTypeFields = [
        "industrialType", "area", "carpetArea", "powerLoad", "transformer",
        "waterAvailability", "productionArea", "loadingUnloading", "crane",
        "truckAccess", "roadWidth", "parking", "workerFacilities", "fireSafety",
        "pollutionCompliance", "zoning", "machineryIncluded"
      ];
      break;
    case "Hotel / Resort":
      allowedTypeFields = [
        "area", "carpetArea", "numberOfRooms", "roomTypes", "floor", "totalFloors",
        "restaurant", "kitchen", "parking", "privatePool", "banquetHall", "gym",
        "servantRoom", "powerBackup", "waterAvailability", "occupancy", "revenue"
      ];
      break;
    case "PG / Hostel":
      allowedTypeFields = [
        "genderType", "numberOfRooms", "totalBeds", "availableBeds", "roomSharingType",
        "rentPerBed", "deposit", "foodIncluded", "electricityAvailability", "internet",
        "laundry", "housekeeping", "security", "parking", "ac", "rules", "occupancy"
      ];
      break;
    case "Builder / New Project":
      allowedTypeFields = [
        "projectName", "community", "plotArea", "area", "towers", "floor", "totalFloors",
        "totalUnits", "availableUnits", "bhkTypes", "carpetArea", "price", "amenities",
        "constructionStatus", "possessionDate", "maintenance", "parking", "paymentPlan"
      ];
      break;
    default:
      break;
  }

  const allAllowed = [...commonFields, ...allowedTypeFields];
  const cleaned = {};
  for (const field of allAllowed) {
    if (body[field] !== undefined) {
      if (body[field] === "true") {
        cleaned[field] = true;
      } else if (body[field] === "false") {
        cleaned[field] = false;
      } else if (body[field] === "") {
        cleaned[field] = undefined;
      } else {
        cleaned[field] = body[field];
      }
    }
  }

  const numericFields = ["bedrooms", "bathrooms", "balconies", "area", "carpetArea", "floor", "totalFloors", "plotArea", "roadWidth", "washrooms", "entranceWidth", "powerLoad", "price"];
  for (const f of numericFields) {
    if (cleaned[f] !== undefined && cleaned[f] !== null) {
      cleaned[f] = safeNumber(cleaned[f]);
    }
  }

  return cleaned;
};


const SystemSettings = require("../models/SystemSettings");

exports.getPublicSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({});
    }
    const publicSettings = {
      platformName: settings.platformName || "EstateGold",
      platformLogo: settings.platformLogo || "",
      supportEmail: settings.supportEmail || "support@estategold.com",
      supportPhone: settings.supportPhone || "+91 1800-123-4567",
      supportAddress: settings.supportAddress || "12th Floor, Trade Centre, Mumbai",
      defaultCountry: settings.defaultCountry || "India",
      defaultCurrency: settings.defaultCurrency || "INR (₹)",
      timeZone: settings.timeZone || "Asia/Kolkata",
      propertyApprovalRequired: settings.propertyApprovalRequired ?? true,
      allowEditingPublished: settings.allowEditingPublished ?? true,
      defaultPropertyStatus: settings.defaultPropertyStatus || "on_sale",
      allowPropertyHold: settings.allowPropertyHold ?? true,
      maxImagesPerProperty: settings.maxImagesPerProperty || 15,
      listingExpiry: settings.listingExpiry || "60",
    };
    res.json({ success: true, settings: publicSettings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createProperty =
  async (req, res) => {
    try {
      // Fetch system settings to enforce admin-configured rules
      let settings = await SystemSettings.findOne();
      const approvalRequired = settings ? (settings.propertyApprovalRequired ?? true) : true;
      const maxImages = settings ? (settings.maxImagesPerProperty || 15) : 15;
      const defaultAvailStatus = settings ? (settings.defaultPropertyStatus || "on_sale") : "on_sale";

      // Perform Serviceability Validation
      const serviceCheck = await checkPropertyServiceability(req.body);

      if (!serviceCheck.isServiceable) {
        return res.status(400).json({
          success: false,
          code: serviceCheck.code || "AREA_NOT_SERVICEABLE",
          message:
            serviceCheck.message ||
            "We currently don't provide service in this area.",
        });
      }

      const photos =
        req.files?.map(
          (file) =>
            file.filename
        ) || [];

      if (photos.length > maxImages) {
        return res.status(400).json({
          success: false,
          message: `Maximum allowed photos per property is ${maxImages}. You uploaded ${photos.length}.`,
        });
      }

      if (req.body.pendingIssues) {
        try {
          if (typeof req.body.pendingIssues === "string") {
            req.body.pendingIssues = JSON.parse(req.body.pendingIssues);
          }
        } catch (err) {
          console.error("Failed to parse pendingIssues:", err);
        }
      }
      if (req.body.documents) {
        try {
          if (typeof req.body.documents === "string") {
            req.body.documents = JSON.parse(req.body.documents);
          }
        } catch (err) {
          console.error("Failed to parse documents:", err);
        }
      }

      // If approval is required by admin settings, status is "pending", otherwise "approved"
      const initialStatus = approvalRequired ? "pending" : "approved";
      const cleanedData = cleanPropertyDetails(req.body.propertyType, req.body);

      const property =
        await Property.create({
          ...cleanedData,
          ownerId: req.body.ownerId || req.user._id || req.user.id,
          createdBy: req.user._id || req.user.id,
          status: initialStatus,
          availabilityStatus: req.body.availabilityStatus || defaultAvailStatus,
          latitude: serviceCheck.latitude,
          longitude: serviceCheck.longitude,
          serviceableAreaId: serviceCheck.matchedLocation._id,
          amenities:
            req.body.amenities
              ? JSON.parse(
                req.body.amenities
              )
              : [],
          photos,
          neighbourhood: req.body.neighbourhood
            ? JSON.parse(req.body.neighbourhood)
            : {
              nearbyPlaces: {},
              landmarks: [],
              ratings: {},
              notes: "",
            },
          marketInsight: req.body.marketInsight
            ? (typeof req.body.marketInsight === "string" ? JSON.parse(req.body.marketInsight) : req.body.marketInsight)
            : undefined,
        });

      // Increment listing count for the matched serviceable location
      await Location.findByIdAndUpdate(serviceCheck.matchedLocation._id, {
        $inc: { activeListings: 1 },
      });

      res.status(201).json({
        success: true,
        data: property,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

exports.getProperties = async (req, res) => {
  try {

    const page = Number(req.query.page) || 1;

    const limit = Number(req.query.limit) || 6;

    const skip = (page - 1) * limit;

    const {
      search,
      purpose,
      city,
      propertyType,
      bedrooms,
      furnishing,
      minPrice,
      maxPrice,
      sort,
      availabilityStatus,
      role,
    } = req.query;

    const query = {
      isDeleted: { $ne: true },
      status: { $in: ["approved", "active", "published"] },
    };

    if (availabilityStatus && availabilityStatus !== "") {
      query.availabilityStatus = availabilityStatus;
    } else {
      // Exclude sold properties from active public property listings
      query.availabilityStatus = { $ne: "sold" };
    }

    // Search
    if (search && search.trim() !== "") {
      const cleanSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { city: { $regex: cleanSearch, $options: "i" } },
        { locality: { $regex: cleanSearch, $options: "i" } },
        { society: { $regex: cleanSearch, $options: "i" } },
        { address: { $regex: cleanSearch, $options: "i" } },
        { propertyType: { $regex: cleanSearch, $options: "i" } },
        { purpose: { $regex: cleanSearch, $options: "i" } },
      ];
    }

    // Purpose
    if (purpose && purpose.trim() !== "") {
      const purpTrim = purpose.trim().toLowerCase();
      if (purpTrim === "rent" || purpTrim === "for rent" || purpTrim === "lease") {
        query.purpose = { $regex: /rent|lease/i };
      } else if (purpTrim === "buy" || purpTrim === "sale" || purpTrim === "sell" || purpTrim === "for sale") {
        query.purpose = { $regex: /buy|sale|sell/i };
      } else {
        query.purpose = { $regex: new RegExp(purpose.trim(), "i") };
      }
    }

    // City
    if (city && city.trim() !== "") {
      query.city = { $regex: new RegExp(city.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") };
    }

    // Property Type
    if (propertyType && propertyType.trim() !== "") {
      const pType = propertyType.trim();
      if (/apartment|flat/i.test(pType)) {
        query.propertyType = { $regex: /apartment|flat/i };
      } else if (/house|independent/i.test(pType)) {
        query.propertyType = { $regex: /house|independent/i };
      } else if (/plot|land/i.test(pType)) {
        query.propertyType = { $regex: /plot|land/i };
      } else if (/commercial/i.test(pType)) {
        query.propertyType = { $regex: /commercial/i };
      } else if (/builder|floor/i.test(pType)) {
        query.propertyType = { $regex: /builder|floor/i };
      } else if (/villa/i.test(pType)) {
        query.propertyType = { $regex: /villa/i };
      } else {
        query.propertyType = { $regex: new RegExp(pType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") };
      }
    }

    // Bedrooms
    if (bedrooms && bedrooms.trim() !== "") {
      const bNum = Number(bedrooms);
      if (bNum >= 5) {
        query.bedrooms = { $gte: 5 };
      } else if (!isNaN(bNum)) {
        query.bedrooms = bNum;
      }
    }

    // Furnishing
    if (furnishing && furnishing.trim() !== "") {
      query.furnishing = { $regex: new RegExp(furnishing.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") };
    }

    // Price Filter
    if ((minPrice && minPrice.trim() !== "") || (maxPrice && maxPrice.trim() !== "")) {
      query.price = {};

      if (minPrice && minPrice.trim() !== "") {
        const minVal = Number(minPrice);
        if (!isNaN(minVal)) {
          query.price.$gte = minVal;
        }
      }

      if (maxPrice && maxPrice.trim() !== "") {
        const maxVal = Number(maxPrice);
        if (!isNaN(maxVal)) {
          query.price.$lte = maxVal;
        }
      }
    }

    // Role filter (seller/owner vs agent based on property tag listingType)
    if (role && role.trim() !== "") {
      const roleStr = role.trim().toLowerCase();
      if (roleStr === "seller" || roleStr === "owner") {
        query.listingType = { $ne: "another_owner" };
      } else if (roleStr === "agent") {
        query.listingType = "another_owner";
      }
    }

    // Sorting

    let sortOption = {
      createdAt: -1,
    };

    if (
      sort ===
      "priceLowToHigh"
    ) {
      sortOption = {
        price: 1,
      };
    }

    if (
      sort ===
      "priceHighToLow"
    ) {
      sortOption = {
        price: -1,
      };
    }

    if (
      sort === "latest"
    ) {
      sortOption = {
        createdAt: -1,
      };
    }

    const totalProperties =
      await Property.countDocuments(
        query
      );

    const docs =
      await Property.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit);

    const properties = docs.map((property) => sanitizePropertyData(property.toObject(), req));

    const baseUrl = `${req.protocol}://${req.get(
      "host"
    )}`;



    res.status(200).json({
      success: true,

      data: properties,

      pagination: {
        page,

        limit,

        totalProperties,

        totalPages:
          Math.ceil(
            totalProperties /
            limit
          ),

        hasNext:
          page <
          Math.ceil(
            totalProperties /
            limit
          ),

        hasPrevious:
          page > 1,
      },
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message:
        error.message,
    });
  }
};

exports.getPropertyById = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate("createdBy", "_id fullName role phone email agencyName");

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    // Fetch market insight on-demand if it doesn't exist
    if (
      (!property.marketInsight || property.marketInsight.success === undefined || property.marketInsight.retrievedAt === undefined) &&
      property.city && property.city.trim() &&
      property.locality && property.locality.trim() &&
      property.propertyType && property.propertyType.trim()
    ) {
      try {
        console.log(`On-demand fetching market insights for property ${property._id}...`);
        const marketInsightService = require("../services/marketInsightService");

        const bedrooms = property.bedrooms || null;
        const area = property.area || property.carpetArea || property.plotArea || null;

        const freshInsight = await marketInsightService.getNormalizedMarketInsight({
          city: property.city,
          locality: property.locality,
          propertyType: property.propertyType,
          bedrooms,
          area,
        });

        if (freshInsight) {
          property.marketInsight = freshInsight;
          await property.save();
          console.log(`Successfully saved marketInsight snapshot on property ${property._id}`);
        }
      } catch (err) {
        console.error(`Failed to fetch on-demand market insights for property ${property._id}:`, err.message);
      }
    }

    const ownerIdVal = property.ownerId
      ? (property.ownerId._id || property.ownerId).toString()
      : property.createdBy
        ? (property.createdBy._id || property.createdBy).toString()
        : "";

    const rawObj = property.toObject();
    const sanitizedData = sanitizePropertyData(rawObj, req);
    sanitizedData.ownerId = ownerIdVal;

    return res.status(200).json({
      success: true,
      data: sanitizedData,
    });

  } catch (error) {
    console.error("Error in getPropertyById:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.getMyPublishedCount = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const count = await Property.countDocuments({
      createdBy: { $in: [userId, String(userId)] },
      status: { $in: ["approved", "active", "published", "pending"] },
      isDeleted: { $ne: true },
    });

    return res.status(200).json({
      success: true,
      publishedCount: count,
      hasPublishedProperties: count > 0,
    });
  } catch (error) {
    console.error("Failed to check published properties count:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getMyProperties = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { search, status } = req.query;
    const userId = req.user._id || req.user.id;

    // Filter properties created by currently authenticated user
    const query = {
      createdBy: { $in: [userId, String(userId)] },
      isDeleted: { $ne: true },
    };

    if (status && status !== "" && status !== "all") {
      const st = status.toLowerCase();
      if (st === "active") {
        query.status = { $in: ["approved", "active", "published"] };
      } else if (st === "inactive") {
        query.status = { $in: ["inactive", "disabled"] };
      } else {
        query.status = st;
      }
    }

    if (search) {
      query.$or = [
        {
          city: {
            $regex: search,
            $options: "i",
          },
        },
        {
          locality: {
            $regex: search,
            $options: "i",
          },
        },
        {
          propertyType: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const totalProperties = await Property.countDocuments(query);

    const properties = await Property.find(query)
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit);

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const formattedProperties = properties.map((property) => ({
      ...property.toObject(),
      photos: (property.photos || []).map((photo) => {
        if (!photo) return "";
        if (photo.startsWith("http://") || photo.startsWith("https://")) return photo;
        const clean = photo.replace(/^\/+/, "").replace(/^uploads\/properties\//, "").replace(/^uploads\//, "");
        return `${baseUrl}/uploads/properties/${clean}`;
      }),
    }));

    const allUserProperties = await Property.find({
      createdBy: { $in: [userId, String(userId)] },
      isDeleted: { $ne: true },
    });

    const activeList = allUserProperties.filter((p) =>
      ["approved", "active", "published"].includes(p.status)
    );
    const inactiveList = allUserProperties.filter((p) =>
      ["inactive", "disabled"].includes(p.status)
    );
    const pendingList = allUserProperties.filter((p) => p.status === "pending");
    const rejectedList = allUserProperties.filter((p) => p.status === "rejected");

    const counts = {
      all: allUserProperties.length,
      active: activeList.length,
      inactive: inactiveList.length,
      pending: pendingList.length,
      rejected: rejectedList.length,
    };

    return res.status(200).json({
      success: true,
      data: formattedProperties,
      counts,
      hasPublishedProperties: allUserProperties.length > 0,
      pagination: {
        page,
        limit,
        totalProperties,
        totalPages: Math.ceil(totalProperties / limit) || 1,
      },
    });
  } catch (err) {
    console.error("Error in getMyProperties:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.updateProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    // Verify ownership: req.user._id or id should match createdBy or ownerId
    const ownerIdStr = property.ownerId ? property.ownerId.toString() : "";
    const createdByStr = property.createdBy ? property.createdBy.toString() : "";
    const userIdStr = req.user._id ? req.user._id.toString() : (req.user.id ? req.user.id.toString() : "");

    if (ownerIdStr !== userIdStr && createdByStr !== userIdStr && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to modify this property",
      });
    }

    let settings = await SystemSettings.findOne();
    const allowEditPublished = settings ? (settings.allowEditingPublished ?? true) : true;
    const allowHold = settings ? (settings.allowPropertyHold ?? true) : true;

    // Check if user is editing a published property when disabled by admin
    const isPublished = ["approved", "active", "published"].includes(property.status);
    const isNonAdmin = !req.user || req.user.role !== "admin";
    if (isPublished && !allowEditPublished && isNonAdmin) {
      return res.status(403).json({
        success: false,
        message: "Editing published properties is currently disabled by administrator.",
      });
    }

    // Check if setting availabilityStatus to hold when disabled
    if (req.body.availabilityStatus === "hold" && !allowHold) {
      return res.status(400).json({
        success: false,
        message: "Holding properties is currently disabled by administrator.",
      });
    }

    if (
      req.body.city ||
      req.body.locality ||
      req.body.latitude ||
      req.body.longitude
    ) {
      const merged = {
        city: req.body.city || property.city,
        locality: req.body.locality || property.locality,
        address: req.body.address || property.address,
        latitude: req.body.latitude ?? property.latitude,
        longitude: req.body.longitude ?? property.longitude,
      };

      const serviceCheck = await checkPropertyServiceability(merged);

      if (!serviceCheck.isServiceable) {
        return res.status(400).json({
          success: false,
          code: serviceCheck.code || "AREA_NOT_SERVICEABLE",
          message:
            serviceCheck.message ||
            "We currently don't provide service in this area.",
        });
      }

      req.body.latitude = serviceCheck.latitude;
      req.body.longitude = serviceCheck.longitude;

      const oldLocationId = property.serviceableAreaId?.toString();
      const newLocationId = serviceCheck.matchedLocation._id.toString();

      if (oldLocationId !== newLocationId) {
        if (oldLocationId) {
          await Location.findByIdAndUpdate(oldLocationId, {
            $inc: { activeListings: -1 },
          });
        }
        await Location.findByIdAndUpdate(newLocationId, {
          $inc: { activeListings: 1 },
        });
        req.body.serviceableAreaId = serviceCheck.matchedLocation._id;
      }
    }

    let photos = property.photos || [];
    if (req.body.existingPhotos) {
      try {
        photos = JSON.parse(req.body.existingPhotos);
      } catch (err) {
        if (typeof req.body.existingPhotos === "string") {
          photos = [req.body.existingPhotos];
        } else if (Array.isArray(req.body.existingPhotos)) {
          photos = req.body.existingPhotos;
        }
      }
    } else if (req.body.existingPhotos === "") {
      photos = [];
    }

    if (req.files && req.files.length > 0) {
      const newPhotos = req.files.map((file) => file.filename);
      photos = [...photos, ...newPhotos];
    }

    req.body.photos = photos;

    if (req.body.amenities && typeof req.body.amenities === "string") {
      try {
        req.body.amenities = JSON.parse(req.body.amenities);
      } catch (err) {
        console.error("Failed to parse amenities:", err);
      }
    }
    if (req.body.neighbourhood && typeof req.body.neighbourhood === "string") {
      try {
        req.body.neighbourhood = JSON.parse(req.body.neighbourhood);
      } catch (err) {
        console.error("Failed to parse neighbourhood:", err);
      }
    }
    if (req.body.marketInsight) {
      try {
        if (typeof req.body.marketInsight === "string") {
          req.body.marketInsight = JSON.parse(req.body.marketInsight);
        }
      } catch (err) {
        console.error("Failed to parse marketInsight:", err);
      }
    }
    if (req.body.pendingIssues) {
      try {
        if (typeof req.body.pendingIssues === "string") {
          req.body.pendingIssues = JSON.parse(req.body.pendingIssues);
        }
      } catch (err) {
        console.error("Failed to parse pendingIssues:", err);
      }
    }
    if (req.body.documents) {
      try {
        if (typeof req.body.documents === "string") {
          req.body.documents = JSON.parse(req.body.documents);
        }
      } catch (err) {
        console.error("Failed to parse documents:", err);
      }
    }

    const cleanedData = cleanPropertyDetails(req.body.propertyType || property.propertyType, req.body);

    const allTypeFields = [
      "bedrooms", "bathrooms", "balconies", "area", "carpetArea", "floor", "totalFloors", "furnishing", "parking",
      "plotArea", "facing", "propertyAge", "plotFacing", "roadWidth", "cornerPlot", "boundaryWall", "plotType",
      "landApproval", "waterAvailability", "electricityAvailability", "commercialType", "washrooms", "entranceWidth", "powerLoad",
      "length", "width", "superArea", "lift", "powerBackup", "security", "society", "maintenance", "frontage", "compoundWall",
      "garden", "terrace", "borewell", "electricity", "solar", "community", "privatePool", "servantRoom", "gatedLayout",
      "drainage", "roadAccess", "gps", "surveyNumber", "subdivisionNumber", "landClassification", "zoning", "taluk",
      "irrigation", "crops", "soilType", "farmhouse", "pricePerAcre", "workstations", "cabins", "meetingRooms", "reception",
      "pantry", "serverRoom", "ac", "internet", "fireSafety", "ceilingHeight", "mainRoadFacing", "cornerShop", "shutters",
      "signboard", "footfallEstimate", "suitableBusiness", "loadingUnloading", "dock", "truckAccess", "storageCapacity",
      "flooring", "officeArea", "industrialType", "transformer", "productionArea", "crane", "workerFacilities",
      "pollutionCompliance", "machineryIncluded", "numberOfRooms", "roomTypes", "restaurant", "kitchen", "banquetHall",
      "gym", "occupancy", "revenue", "genderType", "totalBeds", "availableBeds", "roomSharingType", "rentPerBed", "deposit",
      "foodIncluded", "laundry", "housekeeping", "rules", "projectName", "towers", "totalUnits", "availableUnits", "bhkTypes",
      "constructionStatus", "possessionDate", "paymentPlan"
    ];

    for (const field of allTypeFields) {
      if (cleanedData[field] === undefined) {
        property[field] = undefined;
      }
    }

    Object.assign(property, cleanedData);

    await property.save();

    res.json({
      success: true,
      data: property,
    });
  } catch (err) {
    console.error("Error in updateProperty:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (property && property.serviceableAreaId) {
      await Location.findByIdAndUpdate(property.serviceableAreaId, {
        $inc: { activeListings: -1 },
      });
    }

    await Property.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.requestDelete = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reason is required to submit a deletion request",
      });
    }

    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    // Verify ownership: req.user._id should match createdBy or ownerId
    const ownerIdStr = property.ownerId ? property.ownerId.toString() : "";
    const createdByStr = property.createdBy ? property.createdBy.toString() : "";
    const userIdStr = req.user._id.toString();

    if (ownerIdStr !== userIdStr && createdByStr !== userIdStr && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to request deletion of this property",
      });
    }

    property.deleteRequested = true;
    property.deleteRequestedReason = reason;
    property.deleteRequestedAt = new Date();
    await property.save();

    res.json({
      success: true,
      message: "Deletion request submitted successfully for admin review",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
exports.filterProperties =
  async (req, res) => {
    try {
      const {
        city,
        purpose,
        propertyType,
        bedrooms,
      } = req.query;

      const query = {
        status: "approved",
        isDeleted: { $ne: true },
      };

      if (city)
        query.city = city;

      if (purpose)
        query.purpose =
          purpose;

      if (propertyType)
        query.propertyType =
          propertyType;

      if (bedrooms)
        query.bedrooms =
          Number(
            bedrooms
          );

      const rawProperties =
        await Property.find(
          query
        ).sort({
          createdAt: -1,
        });

      const sanitizedProperties = rawProperties.map((p) => sanitizePropertyData(p.toObject(), req));

      return res.status(200).json({
        success: true,
        data: sanitizedProperties,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };
exports.updatePropertyStatus = async (
  req,
  res
) => {
  try {
    const property =
      await Property.findByIdAndUpdate(
        req.params.id,
        {
          status: req.body.status,
        },
        {
          new: true,
        }
      );

    res.json({
      success: true,
      data: property,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
exports.searchProperties =
  async (req, res) => {
    try {
      const search =
        req.query.search;

      const rawProperties =
        await Property.find({
          status: "approved",
          isDeleted: { $ne: true },

          $or: [
            {
              city: {
                $regex:
                  search,
                $options:
                  "i",
              },
            },
            {
              locality: {
                $regex:
                  search,
                $options:
                  "i",
              },
            },
            {
              propertyType:
              {
                $regex:
                  search,
                $options:
                  "i",
              },
            },
          ],
        });

      const sanitizedProperties = rawProperties.map((p) => sanitizePropertyData(p.toObject(), req));

      return res.status(200).json({
        success: true,
        data: sanitizedProperties,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

exports.approveProperty =
  async (req, res) => {
    try {
      const property =
        await Property.findByIdAndUpdate(
          req.params.id,
          {
            status:
              "approved",
          },
          {
            new: true,
          }
        );

      return res.status(200).json({
        success: true,
        data: property,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

exports.rejectProperty =
  async (req, res) => {
    try {
      const property =
        await Property.findByIdAndUpdate(
          req.params.id,
          {
            status:
              "rejected",
          },
          {
            new: true,
          }
        );

      return res.status(200).json({
        success: true,
        data: property,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

exports.getSimilarProperties = async (req, res) => {
  try {
    const { id } = req.params;
    const currentProperty = await Property.findById(id);

    if (!currentProperty) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const similar = await Property.find({
      _id: { $ne: id },
      $or: [
        { city: currentProperty.city },
        { propertyType: currentProperty.propertyType },
      ],
    })
      .limit(4)
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: similar,
    });
  } catch (error) {
    console.error("Failed to fetch similar properties:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getPropertiesCompare = async (req, res) => {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({
        success: false,
        message: "Property IDs are required",
      });
    }

    const idList = ids.split(",").map(id => id.trim()).filter(Boolean);
    if (idList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid Property IDs",
      });
    }

    const mongoose = require("mongoose");
    const validIds = idList.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid Property IDs provided",
      });
    }

    const properties = await Property.find({
      _id: { $in: validIds },
      isDeleted: { $ne: true },
      status: { $in: ["approved", "active", "published"] }
    }).populate("createdBy", "_id fullName role phone email agencyName");

    const sanitizedProperties = properties.map(p => sanitizePropertyData(p.toObject(), req));

    return res.status(200).json({
      success: true,
      data: sanitizedProperties,
    });
  } catch (err) {
    console.error("Error in getPropertiesCompare:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.createPropertyDraft = async (req, res) => {
  try {
    const { purpose, propertyType, currentStep } = req.body;
    if (!purpose || !propertyType) {
      return res.status(400).json({
        success: false,
        message: "Purpose and Property Type are required to initialize a draft",
      });
    }

    let serviceableAreaId;
    let latitude = req.body.latitude;
    let longitude = req.body.longitude;

    if (req.body.city && req.body.locality) {
      try {
        const serviceCheck = await checkPropertyServiceability(req.body);
        if (serviceCheck.isServiceable) {
          serviceableAreaId = serviceCheck.matchedLocation._id;
          latitude = serviceCheck.latitude;
          longitude = serviceCheck.longitude;
        }
      } catch (err) {
        // Ignore location serviceability failure for drafts
      }
    }

    const cleanedData = cleanPropertyDetails(propertyType, req.body);

    const draft = new Property({
      ...cleanedData,
      createdBy: req.user._id || req.user.id,
      ownerId: req.user._id || req.user.id,
      status: "draft",
      currentStep: currentStep || 1,
      latitude,
      longitude,
      serviceableAreaId
    });

    if (req.body.amenities && typeof req.body.amenities === "string") {
      try { draft.amenities = JSON.parse(req.body.amenities); } catch (e) {}
    }
    if (req.body.neighbourhood && typeof req.body.neighbourhood === "string") {
      try { draft.neighbourhood = JSON.parse(req.body.neighbourhood); } catch (e) {}
    }
    if (req.body.pendingIssues && typeof req.body.pendingIssues === "string") {
      try { draft.pendingIssues = JSON.parse(req.body.pendingIssues); } catch (e) {}
    }
    if (req.body.documents && typeof req.body.documents === "string") {
      try { draft.documents = JSON.parse(req.body.documents); } catch (e) {}
    }
    if (req.body.marketInsight && typeof req.body.marketInsight === "string") {
      try { draft.marketInsight = JSON.parse(req.body.marketInsight); } catch (e) {}
    }

    await draft.save();

    return res.status(201).json({
      success: true,
      data: draft,
    });
  } catch (err) {
    console.error("Error in createPropertyDraft:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.updatePropertyDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const draft = await Property.findOne({ _id: id, createdBy: req.user._id || req.user.id, status: "draft" });
    if (!draft) {
      return res.status(404).json({
        success: false,
        message: "Draft not found or unauthorized",
      });
    }

    let serviceableAreaId = draft.serviceableAreaId;
    let latitude = req.body.latitude !== undefined ? req.body.latitude : draft.latitude;
    let longitude = req.body.longitude !== undefined ? req.body.longitude : draft.longitude;

    if (req.body.city || req.body.locality) {
      const merged = {
        city: req.body.city || draft.city,
        locality: req.body.locality || draft.locality,
        address: req.body.address || draft.address,
        latitude: req.body.latitude ?? draft.latitude,
        longitude: req.body.longitude ?? draft.longitude,
      };
      try {
        const serviceCheck = await checkPropertyServiceability(merged);
        if (serviceCheck.isServiceable) {
          serviceableAreaId = serviceCheck.matchedLocation._id;
          latitude = serviceCheck.latitude;
          longitude = serviceCheck.longitude;
        }
      } catch (err) {
        // Ignore location serviceability failure for drafts
      }
    }

    const cleanedData = cleanPropertyDetails(req.body.propertyType || draft.propertyType, req.body);

    if (req.body.amenities && typeof req.body.amenities === "string") {
      try { req.body.amenities = JSON.parse(req.body.amenities); } catch (e) {}
    }
    if (req.body.neighbourhood && typeof req.body.neighbourhood === "string") {
      try { req.body.neighbourhood = JSON.parse(req.body.neighbourhood); } catch (e) {}
    }
    if (req.body.pendingIssues && typeof req.body.pendingIssues === "string") {
      try { req.body.pendingIssues = JSON.parse(req.body.pendingIssues); } catch (e) {}
    }
    if (req.body.documents && typeof req.body.documents === "string") {
      try { req.body.documents = JSON.parse(req.body.documents); } catch (e) {}
    }
    if (req.body.marketInsight && typeof req.body.marketInsight === "string") {
      try { req.body.marketInsight = JSON.parse(req.body.marketInsight); } catch (e) {}
    }

    Object.assign(draft, cleanedData);
    if (req.body.currentStep) draft.currentStep = req.body.currentStep;
    draft.latitude = latitude;
    draft.longitude = longitude;
    draft.serviceableAreaId = serviceableAreaId;

    if (req.body.amenities) draft.amenities = req.body.amenities;
    if (req.body.neighbourhood) draft.neighbourhood = req.body.neighbourhood;
    if (req.body.pendingIssues) draft.pendingIssues = req.body.pendingIssues;
    if (req.body.documents) draft.documents = req.body.documents;
    if (req.body.marketInsight) draft.marketInsight = req.body.marketInsight;

    await draft.save();

    return res.status(200).json({
      success: true,
      data: draft,
    });
  } catch (err) {
    console.error("Error in updatePropertyDraft:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getPropertyDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const draft = await Property.findOne({ _id: id, createdBy: req.user._id || req.user.id, status: "draft" });
    if (!draft) {
      return res.status(404).json({
        success: false,
        message: "Draft not found or unauthorized",
      });
    }

    return res.status(200).json({
      success: true,
      data: draft,
    });
  } catch (err) {
    console.error("Error in getPropertyDraft:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.deletePropertyDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const draft = await Property.findOneAndDelete({ _id: id, createdBy: req.user._id || req.user.id, status: "draft" });
    if (!draft) {
      return res.status(404).json({
        success: false,
        message: "Draft not found or unauthorized",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Draft discarded successfully",
    });
  } catch (err) {
    console.error("Error in deletePropertyDraft:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};