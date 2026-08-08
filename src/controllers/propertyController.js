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


exports.createProperty =
  async (req, res) => {
    try {
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

      const property =
        await Property.create({
          ...req.body,
          createdBy: req.user._id || req.user.id,
          status: "approved",
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
    } = req.query;

    const query = {
      status: "approved",
    };

    // Search

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
          society: {
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

    // Purpose

    if (purpose && purpose !== "") {
      query.purpose = purpose;
    }

    // City

    if (city && city !== "") {
      query.city = city;
    }

    // Property Type

    if (
      propertyType &&
      propertyType !== ""
    ) {
      query.propertyType =
        propertyType;
    }

    // Bedrooms

    if (
      bedrooms &&
      bedrooms !== ""
    ) {
      query.bedrooms =
        Number(bedrooms);
    }

    // Furnishing

    if (
      furnishing &&
      furnishing !== ""
    ) {
      query.furnishing =
        furnishing;
    }

    // Price Filter

    if (
      minPrice ||
      maxPrice
    ) {
      query.price = {};

      if (minPrice) {
        query.price.$gte =
          Number(minPrice);
      }

      if (maxPrice) {
        query.price.$lte =
          Number(maxPrice);
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
          property.photos.map(
            (photo) =>
              `${baseUrl}/uploads/properties/${photo}`
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

    const propertyData = {
      ...property.toObject(),

      photos: property.photos.map(
        (photo) =>
          `${baseUrl}/uploads/properties/${photo}`
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

    const { search } = req.query;
    const userId = req.user._id || req.user.id;

    // Filter properties created by currently authenticated user
    const query = {
      createdBy: { $in: [userId, String(userId)] },
      status: { $in: ["approved", "active", "published", "pending"] },
      isDeleted: { $ne: true },
    };

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
      photos: property.photos.map((photo) =>
        photo.startsWith("http")
          ? photo
          : `${baseUrl}/uploads/properties/${photo}`
      ),
    }));

    const publishedCount = await Property.countDocuments({
      createdBy: { $in: [userId, String(userId)] },
      status: { $in: ["approved", "active", "published", "pending"] },
      isDeleted: { $ne: true },
    });

    const counts = {
      all: publishedCount,
      active: publishedCount,
      pending: 0,
      inactive: 0,
      rejected: 0,
    };

    return res.status(200).json({
      success: true,
      data: formattedProperties,
      counts,
      hasPublishedProperties: publishedCount > 0,
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