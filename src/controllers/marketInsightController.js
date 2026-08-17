const LocalityInsightCache = require("../models/LocalityInsightCache");
const marketInsightService = require("../services/marketInsightService");

exports.getLocalityInsights = async (req, res) => {
  try {
    const {
      country = "India",
      state = "",
      city = "",
      locality = "",
      propertyType = "",
      bedrooms = null,
      area = null,
    } = req.body;

    if (!city || !locality || !propertyType) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters: city, locality, and propertyType are required.",
      });
    }

    const cleanCountry = typeof country === "string" ? country.trim() : "India";
    const cleanState = typeof state === "string" ? state.trim() : "";
    const cleanCity = typeof city === "string" ? city.trim() : "";
    const cleanLocality = typeof locality === "string" ? locality.trim() : "";
    const cleanPropType = typeof propertyType === "string" ? propertyType.trim() : "";
    const numBedrooms = bedrooms ? Number(bedrooms) : null;
    const numArea = area ? Number(area) : null;

    // Check Cache first
    const cacheKey = {
      country: cleanCountry,
      state: cleanState,
      city: cleanCity,
      locality: cleanLocality,
      propertyType: cleanPropType,
      bedrooms: numBedrooms,
    };

    const cachedInsight = await LocalityInsightCache.findOne(cacheKey);

    const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
    const now = new Date();

    if (cachedInsight && now.getTime() - new Date(cachedInsight.retrievedAt).getTime() < CACHE_TTL_MS) {
      // Return fresh cached insight
      return res.status(200).json(cachedInsight);
    }

    // Cache miss or stale: fetch fresh from unified service
    console.log(`Cache miss/stale for ${cleanLocality}, ${cleanCity}. Fetching fresh insights...`);
    const freshInsight = await marketInsightService.getNormalizedMarketInsight({
      city: cleanCity,
      locality: cleanLocality,
      propertyType: cleanPropType,
      bedrooms: numBedrooms,
      area: numArea,
    });

    if (freshInsight) {
      // Save or update the cache
      const updatedCache = await LocalityInsightCache.findOneAndUpdate(
        cacheKey,
        {
          ...cacheKey,
          supported: freshInsight.supported,
          message: freshInsight.message,
          averageLocalityPrice: freshInsight.averageLocalityPrice,
          estimatedPricePerSqft: freshInsight.estimatedPricePerSqft,
          comparableCount: freshInsight.comparableCount,
          estimatedPropertyValue: freshInsight.estimatedPropertyValue,
          confidence: freshInsight.confidence,
          marketData: freshInsight.marketData,
          retrievedAt: freshInsight.retrievedAt,
        },
        { upsert: true, new: true }
      );
      return res.status(200).json(updatedCache);
    }

    // If AVnester failed or returned empty, check if we have a stale cache entry we can fall back to
    if (cachedInsight) {
      console.warn(`AVnester unavailable. Falling back to stale cache for ${cleanLocality}, ${cleanCity}.`);
      return res.status(200).json(cachedInsight);
    }

    // No cache entry and API call failed: return normalized empty response
    return res.status(200).json({
      success: false,
      source: "AVnester",
      locality: cleanLocality,
      city: cleanCity,
      supported: false,
      message: "Market insight unavailable for this location.",
      averageLocalityPrice: null,
      estimatedPricePerSqft: null,
      comparableCount: 0,
      estimatedPropertyValue: null,
      confidence: null,
      marketData: {
        averagePrice: null,
        supply: 0,
        demandPulse: null,
        livabilityGrade: null,
        highlights: [],
        priceTrends: [],
      },
      retrievedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Error in marketInsightController:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while retrieving market insights.",
      error: error.message,
    });
  }
};
