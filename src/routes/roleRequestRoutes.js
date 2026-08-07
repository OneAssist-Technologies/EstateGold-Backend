const express = require("express");
const router = express.Router();

const auth = require("../../middleware/authMiddleware");
const admin = require("../../middleware/adminMiddleware");

const roleRequestController = require("../controllers/roleRequestController");

// User routes
router.post("/request", auth, roleRequestController.createRoleRequest);
router.get("/my-requests", auth, roleRequestController.getMyRoleRequests);

// Admin routes
router.get("/admin/list", auth, admin, roleRequestController.getRoleRequests);
router.get("/list", auth, admin, roleRequestController.getRoleRequests);

router.patch("/admin/:id/approve", auth, admin, roleRequestController.approveRoleRequest);
router.patch("/:id/approve", auth, admin, roleRequestController.approveRoleRequest);

router.patch("/admin/:id/reject", auth, admin, roleRequestController.rejectRoleRequest);
router.patch("/:id/reject", auth, admin, roleRequestController.rejectRoleRequest);

module.exports = router;
