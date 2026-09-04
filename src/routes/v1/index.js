/**
 * API v1 Master Router
 *
 * Mounts all v1 sub-routers under /api/v1:
 *
 *   /api/v1/auth            — Authentication (register, login, password reset)
 *   /api/v1/users           — User profile & settings
 *   /api/v1/properties      — Property CRUD, search, filter, drafts
 *   /api/v1/enquiries       — Enquiry/callback requests
 *   /api/v1/uploads         — Document uploads
 *   /api/v1/locations       — Location data
 *   /api/v1/ai              — AI features (description, compare, search, eyva)
 *   /api/v1/market-insights — Market locality insights
 *   /api/v1/admin           — Admin dashboard, property/user/settings management
 *   /api/v1/health          — Health check, ping, route map
 *   /api/v1/settings        — Public app settings
 */

const express = require("express");
const router = express.Router();

const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const propertyRoutes = require("./property.routes");
const enquiryRoutes = require("./enquiry.routes");
const uploadRoutes = require("./upload.routes");
const locationRoutes = require("./location.routes");
const aiRoutes = require("./ai.routes");
const marketInsightRoutes = require("./market-insight.routes");
const adminRoutes = require("./admin.routes");
const createHealthRouter = require("../healthRoutes");

const { getPublicSettings, getNewProjects } = require("../../controllers/propertyController");

// Mount sub-routers
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/properties", propertyRoutes);
router.use("/enquiries", enquiryRoutes);
router.use("/uploads", uploadRoutes);
router.use("/locations", locationRoutes);
router.use("/ai", aiRoutes);
router.use("/market-insights", marketInsightRoutes);
router.use("/admin", adminRoutes);

// Public settings & new projects
router.get("/settings", getPublicSettings);
router.get("/new-projects", getNewProjects);

module.exports = router;
