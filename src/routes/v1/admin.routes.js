const express = require("express");
const router = express.Router();

const auth = require("../../../middleware/authMiddleware");
const admin = require("../../../middleware/adminMiddleware");

const controller = require("../../controllers/adminController");
const locationController = require("../../controllers/locationController");

// ─── Dashboard & Analytics ───

// GET /api/v1/admin/dashboard
router.get("/dashboard", auth, admin, controller.getDashboard);

// GET /api/v1/admin/analytics
router.get("/analytics", auth, admin, controller.getAnalytics);

// GET /api/v1/admin/unread-counts
router.get("/unread-counts", auth, admin, controller.getUnreadCounts);

// ─── Property Management ───

// GET /api/v1/admin/properties
router.get("/properties", auth, admin, controller.getProperties);

// GET /api/v1/admin/properties/:id
router.get("/properties/:id", auth, admin, controller.getProperty);

// PATCH /api/v1/admin/properties/:id/approve
router.patch("/properties/:id/approve", auth, admin, controller.approveProperty);

// PATCH /api/v1/admin/properties/:id/reject
router.patch("/properties/:id/reject", auth, admin, controller.rejectProperty);

// DELETE /api/v1/admin/properties/:id
router.delete("/properties/:id", auth, admin, controller.deleteProperty);

// PATCH /api/v1/admin/properties/:id/reject-delete-request
router.patch("/properties/:id/reject-delete-request", auth, admin, controller.rejectDeleteRequest);

// PATCH /api/v1/admin/properties/:id/availability-status
router.patch("/properties/:id/availability-status", auth, admin, controller.updatePropertyAvailabilityStatus);

// ─── User Management ───

// GET /api/v1/admin/users
router.get("/users", auth, admin, controller.getUsers);

// PATCH /api/v1/admin/users/:id/verify
router.patch("/users/:id/verify", auth, admin, controller.toggleUserVerify);

// PATCH /api/v1/admin/users/:id/status
router.patch("/users/:id/status", auth, admin, controller.toggleUserStatus);

// DELETE /api/v1/admin/users/:id
router.delete("/users/:id", auth, admin, controller.deleteUser);

// ─── Settings & Access Control ───

// GET /api/v1/admin/settings
router.get("/settings", auth, admin, controller.getSystemSettings);

// PUT /api/v1/admin/settings
router.put("/settings", auth, admin, controller.updateSystemSettings);

// GET /api/v1/admin/staff-users
router.get("/staff-users", auth, admin, controller.getStaffUsers);

// PUT /api/v1/admin/users/:id/permissions
router.put("/users/:id/permissions", auth, admin, controller.updateUserPermissions);

// ─── Location Management (admin) ───

// POST /api/v1/admin/locations
router.post("/locations", auth, admin, locationController.createLocation);

// PATCH /api/v1/admin/locations/:id
router.patch("/locations/:id", auth, admin, locationController.updateLocation);

// DELETE /api/v1/admin/locations/:id
router.delete("/locations/:id", auth, admin, locationController.deleteLocation);

module.exports = router;
