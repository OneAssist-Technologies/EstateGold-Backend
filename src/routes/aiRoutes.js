const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const auth = require("../../middleware/authMiddleware");

// Route mappings
router.post("/generate-description", auth, aiController.generateDescription);
router.post("/compare-properties", aiController.compareProperties);
router.get("/compare-properties", aiController.compareProperties);
router.get("/property-health/:id", aiController.getPropertyHealth);
router.get("/property-highlights/:id", aiController.getPropertyHighlights);
router.post("/parse-search", aiController.parseSearch);
router.post("/eyva", aiController.eyvaChat);

module.exports = router;
