const express = require("express");
const router = express.Router();
const controller = require("../../controllers/marketInsightController");

// POST /api/v1/market-insights/locality — Get locality insights
router.post("/locality", controller.getLocalityInsights);

module.exports = router;
