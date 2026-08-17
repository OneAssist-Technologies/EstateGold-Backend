const express = require("express");
const router = express.Router();
const controller = require("../controllers/marketInsightController");

// Retrieve locality insights (cache-managed)
router.post("/locality-insights", controller.getLocalityInsights);

module.exports = router;
