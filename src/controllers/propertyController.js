const Property = require("../models/Property");
const Location = require("../models/Location");
const { checkPropertyServiceability } = require("../utils/geoUtils");

const safeNumber = (
  value,
  defaultValue = 0
) => {
  const num = Number(value);

  return Number.isNaN(num)
    ? defaultValue
    : num;
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

      // If approval is required by admin settings, status is "pending", otherwise "approved"
      const initialStatus = approvalRequired ? "pending" : "approved";

      const property =
        await Property.create({
          ...req.body,
          ownerId: req.body.ownerId || req.user._id || req.user.id,
          createdBy: req.user._id || req.user.id,
          status: initialStatus,
          availabilityStatus: req.body.availabilityStatus || defaultAvailStatus,
          latitude: serviceCheck.latitude,
          longitude: serviceCheck.longitude,
          serviceableAreaId: serviceCheck.matchedLocation._id,
          bedrooms: safeNumber(
            req.body.bedrooms
          ),

          bathrooms: safeNumber(
            req.body.bathrooms
          ),

          balconies: safeNumber(
            req.body.balconies
          ),

          area: safeNumber(
            req.body.area
          ),

          floor: safeNumber(
            req.body.floor
          ),

          price: safeNumber(
            req.body.price
          ),

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

    const baseUrl = `${req.protocol}://${req.get(
      "host"
    )}`;

    const properties =
      docs.map((property) => ({
        ...property.toObject(),

        photos:
          (property.photos || []).map(
            (photo) => {
              if (!photo) return "";
              if (photo.startsWith("http://") || photo.startsWith("https://")) return photo;
              const clean = photo.replace(/^\/+/, "").replace(/^uploads\/properties\//, "").replace(/^uploads\//, "");
              return `${baseUrl}/uploads/properties/${clean}`;
            }
          ),
      }));

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
      .populate("createdBy", "_id fullName role");

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const rawObj = property.toObject();
    const ownerIdVal = property.ownerId
      ? (property.ownerId._id || property.ownerId).toString()
      : property.createdBy
      ? (property.createdBy._id || property.createdBy).toString()
      : "";

    const propertyData = {
      ...rawObj,
      ownerId: ownerIdVal,

      photos: (property.photos || []).map(
        (photo) => {
          if (!photo) return "";
          if (photo.startsWith("http://") || photo.startsWith("https://")) return photo;
          const clean = photo.replace(/^\/+/, "").replace(/^uploads\/properties\//, "").replace(/^uploads\//, "");
          return `${baseUrl}/uploads/properties/${clean}`;
        }
      ),
    };

    return res.status(200).json({
      success: true,
      data: propertyData,
    });

  } catch (error) {
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

    Object.assign(property, req.body);

    await property.save();

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

      const properties =
        await Property.find(
          query
        ).sort({
          createdAt: -1,
        });

      return res.status(200).json({
        success: true,
        data: properties,
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

      const properties =
        await Property.find({
          status: "approved",

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

      return res.status(200).json({
        success: true,
        data: properties,
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