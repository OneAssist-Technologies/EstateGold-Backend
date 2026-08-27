const express = require("express");
const router = express.Router();
const aiController = require("../../controllers/aiController");
const auth = require("../../../middleware/authMiddleware");

// POST /api/v1/ai/generate-description — AI description for property
router.post("/generate-description", auth, aiController.generateDescription);

// POST /api/v1/ai/compare-properties — AI comparison
router.post("/compare-properties", aiController.compareProperties);

// GET /api/v1/ai/compare-properties — AI comparison (GET)
router.get("/compare-properties", aiController.compareProperties);

// GET /api/v1/ai/property-health/:id — Property health score
router.get("/property-health/:id", aiController.getPropertyHealth);

// GET /api/v1/ai/property-highlights/:id — Property highlights
router.get("/property-highlights/:id", aiController.getPropertyHighlights);

// POST /api/v1/ai/parse-search — Parse natural language search
router.post("/parse-search", aiController.parseSearch);

// POST /api/v1/ai/eyva — Eyva AI chat
router.post("/eyva", aiController.eyvaChat);

module.exports = router;
