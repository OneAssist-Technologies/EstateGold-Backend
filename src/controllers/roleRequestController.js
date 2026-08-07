const RoleRequest = require("../models/RoleRequest");
const User = require("../models/User");

// Create or update a role request (e.g., Buyer -> Seller, Buyer -> Agent, Seller -> Agent)
exports.createRoleRequest = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const {
      requestedRole,
      reason,
      experience,
      agencyName,
      reraNumber,
      documents,
    } = req.body;

    if (!requestedRole || !["seller", "agent"].includes(requestedRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid requested role. Allowed: 'seller' or 'agent'.",
      });
    }

    // Role request business logic checks
    const currentRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];

    if (currentRoles.includes(requestedRole)) {
      return res.status(400).json({
        success: false,
        message: `You already have the ${requestedRole} role.`,
      });
    }

    if (user.role === "agent" && requestedRole === "seller") {
      return res.status(400).json({
        success: false,
        message: "Agents already have listing permissions.",
      });
    }

    // Check if there is already a pending request
    let existingRequest = await RoleRequest.findOne({
      user: userId,
      status: "pending",
    });

    if (existingRequest) {
      existingRequest.requestedRole = requestedRole;
      existingRequest.reason = reason || existingRequest.reason;
      existingRequest.experience = experience || existingRequest.experience;
      existingRequest.agencyName = agencyName || existingRequest.agencyName;
      existingRequest.reraNumber = reraNumber || existingRequest.reraNumber;
      if (documents && Array.isArray(documents)) {
        existingRequest.documents = documents;
      }
      await existingRequest.save();

      if (requestedRole === "agent") {
        user.verificationStatus = "pending";
        user.rejectionReason = "";
        await user.save();
      }

      return res.json({
        success: true,
        message: "Existing pending role request updated successfully.",
        roleRequest: existingRequest,
      });
    }

    const roleRequest = await RoleRequest.create({
      user: userId,
      currentRole: user.role,
      requestedRole,
      reason: reason || "",
      experience: experience || "",
      agencyName: agencyName || user.agencyName || "",
      reraNumber: reraNumber || user.reraNumber || "",
      documents: documents || [],
      status: "pending",
    });

    if (requestedRole === "agent") {
      user.verificationStatus = "pending";
      user.rejectionReason = "";
      await user.save();
    }

    res.status(201).json({
      success: true,
      message: "Role request submitted successfully.",
      roleRequest,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to submit role request.",
    });
  }
};

// Admin: Get list of role requests with search & filters
exports.getRoleRequests = async (req, res) => {
  try {
    const { status = "all", search = "", page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status && status !== "all") {
      filter.status = status;
    }
    // Only include role upgrade requests (exclude direct agent registration)
    filter.currentRole = { $ne: "none" };

    const skip = (Number(page) - 1) * Number(limit);

    let query = RoleRequest.find(filter)
      .populate("user", "fullName email phone role roles profileImage createdAt agencyName reraNumber")
      .sort({ createdAt: -1 });

    const allRequests = await query;

    // Apply search filter in memory if searching by user fields
    let filtered = allRequests.filter(
      (r) => r.reason !== "Direct Agent Registration" && r.currentRole !== "none"
    );

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter((reqItem) => {
        const u = reqItem.user;
        const nameMatch = u?.fullName?.toLowerCase().includes(q);
        const emailMatch = u?.email?.toLowerCase().includes(q);
        const phoneMatch = u?.phone?.includes(q);
        const agencyMatch = reqItem.agencyName?.toLowerCase().includes(q);
        return nameMatch || emailMatch || phoneMatch || agencyMatch;
      });
    }

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + Number(limit));

    // Calculate stats for upgrade role requests
    const totalCount = await RoleRequest.countDocuments({ currentRole: { $ne: "none" }, reason: { $ne: "Direct Agent Registration" } });
    const pendingCount = await RoleRequest.countDocuments({ status: "pending", currentRole: { $ne: "none" }, reason: { $ne: "Direct Agent Registration" } });
    const approvedCount = await RoleRequest.countDocuments({ status: "approved", currentRole: { $ne: "none" }, reason: { $ne: "Direct Agent Registration" } });
    const rejectedCount = await RoleRequest.countDocuments({ status: "rejected", currentRole: { $ne: "none" }, reason: { $ne: "Direct Agent Registration" } });

    res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)) || 1,
      stats: {
        all: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
      requests: paginated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch role requests.",
    });
  }
};

// Admin: Approve Role Request
exports.approveRoleRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const roleRequest = await RoleRequest.findById(requestId);

    if (!roleRequest) {
      return res.status(404).json({
        success: false,
        message: "Role request not found.",
      });
    }

    roleRequest.status = "approved";
    roleRequest.rejectionReason = "";
    roleRequest.reviewedBy = req.user._id || req.user.id;
    roleRequest.reviewedAt = new Date();
    await roleRequest.save();

    const user = await User.findById(roleRequest.user);
    if (user) {
      if (!user.roles || user.roles.length === 0) {
        user.roles = [user.role || "buyer"];
      }

      if (!user.roles.includes(roleRequest.requestedRole)) {
        user.roles.push(roleRequest.requestedRole);
      }

      // If primary role was buyer, upgrade role or keep primary role updated
      if (roleRequest.requestedRole === "agent") {
        user.role = "agent";
        user.verificationStatus = "approved";
        user.isActive = true;
        if (roleRequest.agencyName) user.agencyName = roleRequest.agencyName;
        if (roleRequest.reraNumber) user.reraNumber = roleRequest.reraNumber;
        if (roleRequest.experience) user.experience = roleRequest.experience;
      } else if (roleRequest.requestedRole === "seller" && user.role === "buyer") {
        user.role = "seller";
      }

      await user.save();
    }

    res.json({
      success: true,
      message: "Role request approved successfully.",
      roleRequest,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to approve role request.",
    });
  }
};

// Admin: Reject Role Request
exports.rejectRoleRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required.",
      });
    }

    const roleRequest = await RoleRequest.findById(requestId);

    if (!roleRequest) {
      return res.status(404).json({
        success: false,
        message: "Role request not found.",
      });
    }

    roleRequest.status = "rejected";
    roleRequest.rejectionReason = reason.trim();
    roleRequest.reviewedBy = req.user._id || req.user.id;
    roleRequest.reviewedAt = new Date();
    await roleRequest.save();

    const user = await User.findById(roleRequest.user);
    if (user) {
      if (roleRequest.requestedRole === "agent" || user.role === "agent") {
        user.verificationStatus = "rejected";
        user.rejectionReason = reason.trim();
      }
      await user.save();
    }

    res.json({
      success: true,
      message: "Role request rejected successfully.",
      roleRequest,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to reject role request.",
    });
  }
};

// User: Get current status and requests
exports.getMyRoleRequests = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const requests = await RoleRequest.find({ user: userId }).sort({ createdAt: -1 });

    const user = await User.findById(userId).select("-password");

    res.json({
      success: true,
      user,
      requests,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch user role requests.",
    });
  }
};
