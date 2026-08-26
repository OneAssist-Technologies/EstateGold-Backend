const Property = require("../models/Property");
const User = require("../models/User");
const Location = require("../models/Location");
const SystemSettings = require("../models/SystemSettings");

exports.getDashboard = async (req, res) => {
  try {
    const totalProperties = await Property.countDocuments({ isDeleted: false });
    const pending = await Property.countDocuments({ isDeleted: false, status: "pending" });
    const approved = await Property.countDocuments({ isDeleted: false, status: "approved" });
    const rejected = await Property.countDocuments({ isDeleted: false, status: "rejected" });
    const users = await User.countDocuments();
    const verifiedAgents = await User.countDocuments({ role: "agent", isVerified: true });
    const pendingRoleRequests = 0;

    // Property breakdown by type
    const propertyTypeCounts = await Property.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$propertyType", count: { $sum: 1 } } }
    ]);

    // Monthly property additions for the trailing 12 months
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const rawMonthlyStats = await Property.aggregate([
      {
        $match: {
          isDeleted: false,
          createdAt: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyMap = new Map();
    rawMonthlyStats.forEach((item) => {
      const key = `${item._id.year}-${item._id.month}`;
      monthlyMap.set(key, item.count);
    });

    const monthlyStats = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthNum = d.getMonth() + 1;
      const key = `${year}-${monthNum}`;
      monthlyStats.push({
        month: monthNames[d.getMonth()],
        properties: monthlyMap.get(key) || 0,
      });
    }

    // Pending properties for quick approval card
    const pendingProperties = await Property.find({ isDeleted: false, status: "pending" })
      .populate("createdBy", "fullName email phone role agencyName")
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        totalProperties,
        pending,
        approved,
        rejected,
        users,
        verifiedAgents,
        pendingRoleRequests,
        propertyTypes: propertyTypeCounts.map((pt) => ({
          type: pt._id || "Other",
          count: pt.count,
        })),
        monthlyStats,
        pendingProperties,
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
      if (req.query.status === "delete_requests") {
        filter.deleteRequested = true;
      } else {
        filter.status = req.query.status;
        filter.deleteRequested = { $ne: true };
      }
    } else {
      filter.deleteRequested = { $ne: true };
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
          "fullName email phone role agencyName"
        )
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit);

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const formattedProperties = properties.map((prop) => {
      const p = prop.toObject();
      p.photos = (p.photos || []).map((photo) => {
        if (!photo) return "";
        if (photo.startsWith("http://") || photo.startsWith("https://")) return photo;
        const clean = photo.replace(/^\/+/, "").replace(/^uploads\/properties\//, "").replace(/^uploads\//, "");
        return `${baseUrl}/uploads/properties/${clean}`;
      });
      return p;
    });

    const totalCount = await Property.countDocuments({ isDeleted: false, deleteRequested: { $ne: true } });
    const pendingCount = await Property.countDocuments({ isDeleted: false, status: "pending", deleteRequested: { $ne: true } });
    const approvedCount = await Property.countDocuments({ isDeleted: false, status: "approved", deleteRequested: { $ne: true } });
    const rejectedCount = await Property.countDocuments({ isDeleted: false, status: "rejected", deleteRequested: { $ne: true } });
    const deleteRequestsCount = await Property.countDocuments({ isDeleted: false, deleteRequested: true });

    res.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      properties: formattedProperties,
      stats: {
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        delete_requests: deleteRequestsCount,
      },
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

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const p = property.toObject();
    p.photos = (p.photos || []).map((photo) => {
      if (!photo) return "";
      if (photo.startsWith("http://") || photo.startsWith("https://")) return photo;
      const clean = photo.replace(/^\/+/, "").replace(/^uploads\/properties\//, "").replace(/^uploads\//, "");
      return `${baseUrl}/uploads/properties/${clean}`;
    });

    p.documents = (p.documents || []).map((doc) => {
      if (doc.fileUrl) {
        if (doc.fileUrl.startsWith("http://") || doc.fileUrl.startsWith("https://")) {
          if (doc.fileUrl.includes("/uploads/properties/")) {
            doc.fileUrl = doc.fileUrl.replace("/uploads/properties/", "/view-file/");
          }
        } else {
          const clean = doc.fileUrl.replace(/^\/+/, "").replace(/^uploads\/properties\//, "").replace(/^uploads\//, "");
          doc.fileUrl = `${baseUrl}/view-file/${clean}`;
        }
      }
      return doc;
    });

    p.uploadedDocumentTypes = (p.documents || []).map(doc => doc.documentType);

    res.json({
      success: true,
      property: p,
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

exports.updatePropertyAvailabilityStatus = async (req, res) => {
  try {
    const { availabilityStatus } = req.body;
    const allowedStatuses = ["on_sale", "hold", "sold"];

    if (!availabilityStatus || !allowedStatuses.includes(availabilityStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value. Allowed values: on_sale, hold, sold",
      });
    }

    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    property.availabilityStatus = availabilityStatus;
    await property.save();

    res.json({
      success: true,
      message: `Property availability status updated to ${availabilityStatus}`,
      property,
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
    const verifiedBuyers = await User.countDocuments({ role: "buyer", isVerified: true });

    const totalSellers = await User.countDocuments({ role: "seller" });
    const verifiedSellers = await User.countDocuments({ role: "seller", isVerified: true });

    const totalAgents = await User.countDocuments({ role: "agent" });
    const verifiedAgents = await User.countDocuments({ role: "agent", isVerified: true });

    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ isVerified: true });

    res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      users,
      stats: {
        totalBuyers,
        verifiedBuyers,
        totalSellers,
        verifiedSellers,
        totalAgents,
        verifiedAgents,
        totalUsers,
        verifiedUsers,
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
    if (user.isVerified) {
      user.verificationStatus = "approved";
      user.isActive = true;
      user.rejectionReason = "";
    } else {
      user.verificationStatus = "pending";
    }
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
    const { reason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.isActive) {
      if (!reason || !reason.trim()) {
        return res.status(400).json({
          success: false,
          message: "Please provide a reason to suspend this user.",
        });
      }
      user.isActive = false;
      user.suspendReason = reason.trim();
    } else {
      user.isActive = true;
      user.suspendReason = "";
    }

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

exports.deleteUser = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a reason to delete this user.",
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const range = req.query.range || "30days";
    const now = new Date();
    let startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    let endDate = now;

    if (range === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (range === "7days") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === "30days") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (range === "thisMonth") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = now;
    } else if (range === "lastMonth") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (range === "3months") {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (range === "6months") {
      startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    } else if (range === "1year") {
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    } else if (range === "custom" && req.query.startDate && req.query.endDate) {
      startDate = new Date(req.query.startDate);
      endDate = new Date(req.query.endDate);
      if (isNaN(startDate.getTime())) startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (isNaN(endDate.getTime())) endDate = now;
    }

    // 1. Overall Platform Portfolio Counts (Cumulative)
    const totalProperties = await Property.countDocuments({ isDeleted: false });
    const activeListings = await Property.countDocuments({ isDeleted: false, status: "approved" });
    const totalUsers = await User.countDocuments();
    const totalAgents = await User.countDocuments({ role: "agent" });
    const pendingRoleReqs = 0;
    const pendingPropReqs = await Property.countDocuments({ isDeleted: false, status: "pending" });
    const pendingRequests = pendingRoleReqs + pendingPropReqs;

    // Previous comparison period duration (for trend percentages)
    const durationMs = Math.max(endDate.getTime() - startDate.getTime(), 86400000);
    const prevStartDate = new Date(startDate.getTime() - durationMs);
    const prevEndDate = startDate;

    const propsInPeriod = await Property.countDocuments({ isDeleted: false, createdAt: { $gte: startDate, $lte: endDate } });
    const propsInPrev = await Property.countDocuments({ isDeleted: false, createdAt: { $gte: prevStartDate, $lt: prevEndDate } });

    const activeInPeriod = await Property.countDocuments({ isDeleted: false, status: "approved", createdAt: { $gte: startDate, $lte: endDate } });
    const activeInPrev = await Property.countDocuments({ isDeleted: false, status: "approved", createdAt: { $gte: prevStartDate, $lt: prevEndDate } });

    const usersInPeriod = await User.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } });
    const usersInPrev = await User.countDocuments({ createdAt: { $gte: prevStartDate, $lt: prevEndDate } });

    const agentsInPeriod = await User.countDocuments({ role: "agent", createdAt: { $gte: startDate, $lte: endDate } });
    const agentsInPrev = await User.countDocuments({ role: "agent", createdAt: { $gte: prevStartDate, $lt: prevEndDate } });

    const pendingInPeriod = 0;
    const pendingInPrev = 0;

    const calcTrend = (curr, prev) => {
      if (!prev || prev === 0) return { pct: curr > 0 ? "+100.0%" : "0.0%", isUp: true };
      const diff = ((curr - prev) / prev) * 100;
      const isUp = diff >= 0;
      return {
        pct: `${isUp ? "↑ " : "↓ "}${Math.abs(diff).toFixed(1)}%`,
        isUp,
      };
    };

    const kpis = {
      totalProperties: { value: totalProperties, trend: calcTrend(propsInPeriod, propsInPrev).pct, isUp: calcTrend(propsInPeriod, propsInPrev).isUp },
      activeListings: { value: activeListings, trend: calcTrend(activeInPeriod, activeInPrev).pct, isUp: calcTrend(activeInPeriod, activeInPrev).isUp },
      totalUsers: { value: totalUsers, trend: calcTrend(usersInPeriod, usersInPrev).pct, isUp: calcTrend(usersInPeriod, usersInPrev).isUp },
      totalAgents: { value: totalAgents, trend: calcTrend(agentsInPeriod, agentsInPrev).pct, isUp: calcTrend(agentsInPeriod, agentsInPrev).isUp },
      pendingRequests: { value: pendingRequests, trend: calcTrend(pendingInPeriod, pendingInPrev).pct, isUp: calcTrend(pendingInPeriod, pendingInPrev).isUp },
    };

    // 2. Property Listing Trends (Line/Area Chart - timeline generated across entire range)
    const trendProperties = await Property.find({
      createdAt: { $gte: startDate, $lte: endDate },
    }).select("createdAt status purpose isDeleted");

    const daysDiff = Math.ceil(durationMs / (24 * 60 * 60 * 1000));
    const stepDays = daysDiff > 90 ? 30 : daysDiff > 14 ? 5 : 1;
    const trendMap = new Map();

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + stepDays)) {
      const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      trendMap.set(dateLabel, { date: dateLabel, added: 0, sold: 0, rented: 0, removed: 0 });
    }

    trendProperties.forEach((p) => {
      const label = new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      let entry = trendMap.get(label);
      if (!entry) {
        entry = { date: label, added: 0, sold: 0, rented: 0, removed: 0 };
        trendMap.set(label, entry);
      }
      if (p.isDeleted || p.status === "rejected") {
        entry.removed++;
      } else {
        entry.added++;
        const purposeLower = (p.purpose || "").toLowerCase();
        if (purposeLower.includes("rent") || purposeLower.includes("lease")) {
          entry.rented++;
        } else {
          entry.sold++;
        }
      }
    });

    const listingTrends = Array.from(trendMap.values());

    // 3. Properties by Type (Overall Portfolio Breakdown)
    const typeAgg = await Property.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$propertyType", count: { $sum: 1 } } },
    ]);

    const defaultTypesMap = new Map([
      ["Apartment / Flat", 0],
      ["Independent House", 0],
      ["Plot / Land", 0],
      ["Builder Floor", 0],
      ["Commercial Space", 0],
    ]);

    typeAgg.forEach((item) => {
      if (item._id) {
        defaultTypesMap.set(item._id, item.count);
      }
    });

    const propertiesByType = Array.from(defaultTypesMap.entries()).map(([name, count]) => ({
      name,
      value: count,
      percentage: totalProperties > 0 ? Math.round((count / totalProperties) * 100) : 0,
    }));

    // 4. Properties by Service Area (Table)
    const locations = await Location.find();
    const serviceAreaStats = [];

    for (const loc of locations) {
      const totalInCity = await Property.countDocuments({
        isDeleted: false,
        $or: [{ serviceableAreaId: loc._id }, { city: { $regex: new RegExp(`^${loc.city}$`, "i") } }],
      });

      const activeInCity = await Property.countDocuments({
        isDeleted: false,
        status: "approved",
        $or: [{ serviceableAreaId: loc._id }, { city: { $regex: new RegExp(`^${loc.city}$`, "i") } }],
      });

      const soldInCity = await Property.countDocuments({
        isDeleted: false,
        status: "approved",
        availabilityStatus: "sold",
        $or: [{ serviceableAreaId: loc._id }, { city: { $regex: new RegExp(`^${loc.city}$`, "i") } }],
      });

      const availableInCity = Math.max(0, activeInCity - soldInCity);

      serviceAreaStats.push({
        serviceArea: loc.city,
        totalProperties: totalInCity,
        active: activeInCity,
        sold: soldInCity,
        available: availableInCity,
      });
    }

    serviceAreaStats.sort((a, b) => b.totalProperties - a.totalProperties);

    // 5. Users by Role (Overall Breakdown)
    const buyerCount = await User.countDocuments({ role: "buyer" });
    const sellerCount = await User.countDocuments({ role: "seller" });
    const agentCount = await User.countDocuments({ role: "agent" });
    const totalUsersRole = (buyerCount + sellerCount + agentCount) || 1;

    const usersByRole = [
      { role: "Buyer", count: buyerCount, percentage: totalUsers > 0 ? Math.round((buyerCount / totalUsersRole) * 100) : 0, color: "#E5C365" },
      { role: "Owner / Seller", count: sellerCount, percentage: totalUsers > 0 ? Math.round((sellerCount / totalUsersRole) * 100) : 0, color: "#3B82F6" },
      { role: "Agent", count: agentCount, percentage: totalUsers > 0 ? Math.round((agentCount / totalUsersRole) * 100) : 0, color: "#8B5CF6" },
    ];

    // 6. Buy vs Rent (Overall Breakdown)
    const buyCount = await Property.countDocuments({
      isDeleted: false,
      purpose: { $regex: /buy|sale|sell/i },
    });

    const rentCount = await Property.countDocuments({
      isDeleted: false,
      purpose: { $regex: /rent|lease/i },
    });

    const totalBuyRent = (buyCount + rentCount) || 1;
    const buyVsRent = [
      { name: "For Buy", count: buyCount, percentage: totalProperties > 0 ? Math.round((buyCount / totalBuyRent) * 100) : 0, color: "#E5C365" },
      { name: "For Rent", count: rentCount, percentage: totalProperties > 0 ? Math.round((rentCount / totalBuyRent) * 100) : 0, color: "#10B981" },
    ];

    // 7. Recent Activity
    const recentProperties = await Property.find({ isDeleted: false })
      .populate("createdBy", "fullName")
      .sort({ createdAt: -1 })
      .limit(3);

    const recentActivities = [];

    recentProperties.forEach((p) => {
      recentActivities.push({
        id: `prop-${p._id}`,
        type: "property_listed",
        title: "New property listed",
        description: `${p.propertyType || "Property"} in ${p.locality || p.city || "Tamil Nadu"}`,
        timestamp: p.createdAt,
        category: "property",
      });
    });

    recentActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // 8. Monthly Overview (Last 6 Months)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyOverview = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);

      const added = await Property.countDocuments({
        isDeleted: false,
        createdAt: { $gte: d, $lt: nextMonth },
      });

      const sold = await Property.countDocuments({
        isDeleted: false,
        availabilityStatus: "sold",
        purpose: { $regex: /buy|sale|sell/i },
        updatedAt: { $gte: d, $lt: nextMonth },
      });

      const rented = await Property.countDocuments({
        isDeleted: false,
        availabilityStatus: "sold",
        purpose: { $regex: /rent|lease/i },
        updatedAt: { $gte: d, $lt: nextMonth },
      });

      monthlyOverview.push({
        month: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
        added: added,
        sold: sold,
        rented: rented,
      });
    }

    res.json({
      success: true,
      data: {
        startDate,
        endDate,
        kpis,
        listingTrends,
        propertiesByType,
        serviceAreaStats,
        usersByRole,
        buyVsRent,
        recentActivities,
        monthlyOverview,
        totalPropertiesCount: totalProperties,
        totalUsersCount: totalUsers,
      },
    });
  } catch (error) {
    console.error("Get Analytics Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch analytics data",
    });
  }
};

exports.getSystemSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({});
    }
    res.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("Get System Settings Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch system settings",
    });
  }
};

exports.updateSystemSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    await settings.save();

    res.json({
      success: true,
      message: "Settings saved successfully",
      settings,
    });
  } catch (error) {
    console.error("Update System Settings Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update system settings",
    });
  }
};

exports.getStaffUsers = async (req, res) => {
  try {
    const staffUsers = await User.find({ role: { $in: ["admin", "agent", "seller"] } })
      .select("-password")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      users: staffUsers,
    });
  } catch (error) {
    console.error("Get Staff Users Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch staff users",
    });
  }
};

exports.updateUserPermissions = async (req, res) => {
  try {
    const { permissions } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.permissions = permissions;
    await user.save();

    const updatedUser = user.toObject();
    delete updatedUser.password;

    res.json({
      success: true,
      message: `Permissions updated for ${user.fullName}`,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update User Permissions Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update user permissions",
    });
  }
};

exports.rejectDeleteRequest = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    property.deleteRequested = false;
    property.deleteRequestedReason = "";
    property.deleteRequestedAt = undefined;

    await property.save();

    res.json({
      success: true,
      message: "Deletion request rejected successfully",
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getUnreadCounts = async (req, res) => {
  try {
    const { lastVisitedProperties, lastVisitedUsers, lastVisitedLocations } = req.query;

    const parseDate = (d) => {
      if (!d) return new Date(0);
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) ? new Date(0) : parsed;
    };

    const propDate = parseDate(lastVisitedProperties);
    const userDate = parseDate(lastVisitedUsers);
    const locDate = parseDate(lastVisitedLocations);

    const unreadProperties = await Property.countDocuments({
      isDeleted: false,
      createdAt: { $gt: propDate }
    });

    const unreadUsers = await User.countDocuments({
      createdAt: { $gt: userDate }
    });

    const unreadLocations = await Location.countDocuments({
      createdAt: { $gt: locDate }
    });

    res.json({
      success: true,
      unreadProperties,
      unreadUsers,
      unreadLocations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};