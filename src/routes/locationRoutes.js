const express = require("express");
const router = express.Router();
const controller = require("../controllers/locationController");
const auth = require("../../middleware/authMiddleware");
const admin = require("../../middleware/adminMiddleware");

// Public / Admin routes for Locations
router.get("/", controller.getLocations);
router.post("/request-service", auth, controller.requestServiceArea);
router.get("/:id", controller.getLocationById);
router.post("/", auth, admin, controller.createLocation);
router.patch("/:id", auth, admin, controller.updateLocation);
router.delete("/:id", auth, admin, controller.deleteLocation);

module.exports = router;
