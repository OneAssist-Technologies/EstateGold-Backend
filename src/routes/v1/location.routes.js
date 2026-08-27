const express = require("express");
const router = express.Router();
const controller = require("../../controllers/locationController");
const auth = require("../../../middleware/authMiddleware");

// GET /api/v1/locations — List all locations
router.get("/", controller.getLocations);

// POST /api/v1/locations/request-service — Request service for an area
router.post("/request-service", auth, controller.requestServiceArea);

// GET /api/v1/locations/:id — Get location by ID
router.get("/:id", controller.getLocationById);

module.exports = router;
