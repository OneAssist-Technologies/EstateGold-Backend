const Property = require("../models/Property");

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
      const photos =
        req.files?.map(
          (file) =>
            file.filename
        ) || [];

      const property =
        await Property.create({
          ...req.body,
 createdBy: req.user._id,
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
  exports.getMyProperties = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { search, status } = req.query;

    const query = {};

    // TODO:
    // query.createdBy = req.user._id;
    // or query.createdBy = req.params.userId;

    if (status && status !== "") {
      query.status = status;
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

    const totalProperties =
      await Property.countDocuments(query);

    const properties =
      await Property.find(query)
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit);

    const counts = {
      all: await Property.countDocuments({}),
      active: await Property.countDocuments({
        status: "active",
      }),
      pending: await Property.countDocuments({
        status: "pending",
      }),
      inactive: await Property.countDocuments({
        status: "inactive",
      }),
      rejected: await Property.countDocuments({
        status: "rejected",
      }),
    };

    res.json({
      success: true,
      data: properties,
      counts,
      pagination: {
        page,
        limit,
        totalProperties,
        totalPages: Math.ceil(
          totalProperties / limit
        ),
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.updateProperty = async (req, res) => {
  try {
    const property =
      await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
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
    await Property.findByIdAndDelete(
      req.params.id
    );

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