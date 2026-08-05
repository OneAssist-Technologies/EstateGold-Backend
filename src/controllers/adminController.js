const Property = require("../models/Property");
const User = require("../models/User");

exports.getDashboard = async (req, res) => {
  try {

    const totalProperties =
      await Property.countDocuments();

    const pending =
      await Property.countDocuments({
        status: "pending",
      });

    const approved =
      await Property.countDocuments({
        status: "approved",
      });

    const rejected =
      await Property.countDocuments({
        status: "rejected",
      });

    const users =
      await User.countDocuments();

    res.json({
      success: true,

      data: {
        totalProperties,
        pending,
        approved,
        rejected,
        users,
      },
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

exports.getProperties = async (req, res) => {
  try {

    const page =
      Number(req.query.page) || 1;

    const limit =
      Number(req.query.limit) || 10;

    const skip =
      (page - 1) * limit;

    const filter = {
  isDeleted: false,
};

    if (req.query.status) {
      filter.status =
        req.query.status;
    }

    if (req.query.type) {
      filter.propertyType =
        req.query.type;
    }

    if (req.query.city) {
      filter.city =
        req.query.city;
    }

    if (req.query.search) {
      filter.$or = [
        {
          ownerName: {
            $regex:
              req.query.search,
            $options: "i",
          },
        },
        {
          city: {
            $regex:
              req.query.search,
            $options: "i",
          },
        },
        {
          locality: {
            $regex:
              req.query.search,
            $options: "i",
          },
        },
      ];
    }

    const total =
      await Property.countDocuments(
        filter
      );

    const properties =
      await Property.find(filter)
        .populate(
          "createdBy",
          "fullName email"
        )
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit);

    res.json({
      success: true,
      total,
      page,
      pages: Math.ceil(
        total / limit
      ),
      properties,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

exports.getProperty = async (req, res) => {
  try {

  
    const property = await Property.findById(
      req.params.id
    ).populate(
      "createdBy",
      "fullName email phone role agencyName"
    );



    if (!property) {
      return res.status(404).json({
        success: false,
        message:
          "Property not found",
      });
    }

    res.json({
      success: true,
      property,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

exports.approveProperty = async (req, res) => {
  try {

    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    property.status = "approved";
    property.rejectReason = "";
    property.reviewedBy = req.user._id;
    property.reviewedAt = new Date();

    await property.save();

    res.json({
      success: true,
      message: "Property approved successfully",
      property,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

exports.rejectProperty = async (req, res) => {
  try {

    const { reason } = req.body;

    if (!reason?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    property.status = "rejected";
    property.rejectReason = reason;
    property.reviewedBy = req.user._id;
    property.reviewedAt = new Date();

    await property.save();

    res.json({
      success: true,
      message: "Property rejected successfully",
      property,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

exports.deleteProperty = async (req, res) => {
  try {

    const { reason } = req.body;

    if (!reason?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Deletion reason is required",
      });
    }

    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    property.isDeleted = true;
    property.deletedReason = reason;
    property.deletedBy = req.user._id;
    property.deletedAt = new Date();

    await property.save();

    res.json({
      success: true,
      message: "Property deleted successfully",
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

exports.getUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;

    const filter = {};

    if (role && role !== "all") {
      // Normalize 'buyers' -> 'buyer', 'sellers' -> 'seller', 'agents' -> 'agent'
      const normalizedRole = role.toLowerCase().replace(/s$/, "");
      filter.role = normalizedRole;
    }

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await User.countDocuments(filter);

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const totalBuyers = await User.countDocuments({ role: "buyer" });
    const totalSellers = await User.countDocuments({ role: "seller" });
    const verifiedAgents = await User.countDocuments({ role: "agent", isVerified: true });
    const totalUsers = await User.countDocuments();

    res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      users,
      stats: {
        totalBuyers,
        totalSellers,
        verifiedAgents,
        totalUsers,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.toggleUserVerify = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.isVerified = !user.isVerified;
    await user.save();

    res.json({
      success: true,
      message: `User verification updated to ${user.isVerified}`,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      message: `User status updated to ${user.isActive ? "active" : "suspended"}`,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};