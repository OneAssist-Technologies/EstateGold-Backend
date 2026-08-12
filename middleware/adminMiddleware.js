const User = require("../src/models/User");

module.exports = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access. User context missing.",
      });
    }

    const userRole = (req.user.role || "").toLowerCase();
    const userRoles = Array.isArray(req.user.roles)
      ? req.user.roles.map((r) => r.toLowerCase())
      : [];

    if (userRole === "admin" || userRoles.includes("admin")) {
      return next();
    }

    // Fallback: check Database in case JWT token was issued before role was updated to admin
    const userId = req.user._id || req.user.id;
    if (userId) {
      const dbUser = await User.findById(userId).select("role roles");
      if (dbUser) {
        const dbRole = (dbUser.role || "").toLowerCase();
        const dbRoles = Array.isArray(dbUser.roles)
          ? dbUser.roles.map((r) => r.toLowerCase())
          : [];

        if (dbRole === "admin" || dbRoles.includes("admin")) {
          req.user.role = dbUser.role; // Update request user role
          return next();
        }
      }
    }

    return res.status(403).json({
      success: false,
      message: "Unauthorized access: Admin privilege required.",
    });
  } catch (error) {
    console.error("Admin Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during authorization check.",
    });
  }
};