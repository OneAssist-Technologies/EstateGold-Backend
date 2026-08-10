const express = require("express");

const router = express.Router();

const auth =
  require("../../middleware/authMiddleware");

const admin =
  require("../../middleware/adminMiddleware");

const controller =
  require("../controllers/adminController");

router.get(
  "/dashboard",
  auth,
  admin,
  controller.getDashboard
);

router.get(
  "/analytics",
  auth,
  admin,
  controller.getAnalytics
);

router.get(
  "/properties",
  auth,
  admin,
  controller.getProperties
);

router.get(
  "/properties/:id",
  auth,
  admin,
  controller.getProperty
);

router.patch(
  "/properties/:id/approve",
  auth,
  admin,
  controller.approveProperty
);

router.patch(
  "/properties/:id/reject",
  auth,
  admin,
  controller.rejectProperty
);

router.delete(
  "/properties/:id",
  auth,
  admin,
  controller.deleteProperty
);

router.patch(
  "/properties/:id/availability-status",
  auth,
  admin,
  controller.updatePropertyAvailabilityStatus
);

// User Management Routes
router.get("/users", auth, admin, controller.getUsers);
router.patch("/users/:id/verify", auth, admin, controller.toggleUserVerify);
router.patch("/users/:id/status", auth, admin, controller.toggleUserStatus);
router.delete("/users/:id", auth, admin, controller.deleteUser);

module.exports = router;