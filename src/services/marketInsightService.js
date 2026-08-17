const avnesterService = require("./avnesterService");

/**
 * Maps EstateGold property types to AVnester property types.
 */
const mapPropertyType = (estateGoldType) => {
  if (!estateGoldType) return null;
  switch (estateGoldType.trim()) {
    case "Apartment / Flat":
      return "apartment";
    case "Villa":
      return "villa";
    case "Independent House":
      return "independent_house";
    case "Builder Floor":
      return "apartment"; // Mapped as a similar multi-unit residential unit
    case "Plot / Land":
      return "plot";
    case "Commercial Space":
    default:
      return null; // Commercial Space is not supported by AVnester public search
  }
};

/**
 * Calculates the median of an array of numbers.
 */
const getMedian = (values) => {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[half];
  }
  return Math.round((sorted[half - 1] + sorted[half]) / 2);
};

/**
 * Retrieve normalized market insights for a given location, property type, BHK, and area context.
 */
const getNormalizedMarketInsight = async ({
  city,
  locality,
  propertyType,
  bedrooms,
  area,
}) => {
  let cleanCity = (city || "").trim();
  const lowerCity = cleanCity.toLowerCase();
  if (lowerCity === "tirupur" || lowerCity === "tiruppur") {
    cleanCity = "Tiruppur";
  } else if (lowerCity === "trichy" || lowerCity === "tiruchirapalli" || lowerCity === "tiruchirappalli") {
    cleanCity = "Tiruchirappalli";
  } else if (lowerCity === "coimbatore" || lowerCity === "covai" || lowerCity === "kovai") {
    cleanCity = "Coimbatore";
  } else if (lowerCity === "chennai" || lowerCity === "madras") {
    cleanCity = "Chennai";
  } else if (lowerCity === "madurai") {
    cleanCity = "Madurai";
  } else if (lowerCity === "erode") {
    cleanCity = "Erode";
  } else if (lowerCity === "tirunelveli" || lowerCity === "nellai") {
    cleanCity = "Tirunelveli";
  } else if (lowerCity === "vellore") {
    cleanCity = "Vellore";
  }
  const cleanLocality = (locality || "").trim();
  const cleanPropType = (propertyType || "").trim();
  const numBedrooms = bedrooms ? Number(bedrooms) : null;
  const numArea = area ? Number(area) : null;

  // 1. Fetch Locality Insights
  const insightsResult = await avnesterService.getLocalityInsights(cleanLocality, cleanCity);

  if (!insightsResult || insightsResult.supported === false) {
    return {
      success: false,
      source: "AVnester",
      locality: cleanLocality,
      city: cleanCity,
      supported: false,
      message: insightsResult?.message || "Market insight unavailable for this location.",
      averageLocalityPrice: null,
      estimatedPricePerSqft: null,
      comparableCount: 0,
      estimatedPropertyValue: null,
      confidence: null,
      marketData: insightsResult?.marketData || {
        averagePrice: null,
        supply: 0,
        demandPulse: null,
        livabilityGrade: null,
        highlights: [],
        priceTrends: [],
      },
      retrievedAt: new Date().toISOString(),
    };
  }

  const averageLocalityPriceRaw = insightsResult.marketData?.averagePrice || null;
  let averageLocalityPrice = averageLocalityPriceRaw;

  // Fallback: If locality-level averagePrice is null and cleanLocality is not the same as cleanCity,
  // fetch city-level average insights as a backup!
  if (averageLocalityPrice === null && cleanLocality && cleanCity && cleanLocality.toLowerCase() !== cleanCity.toLowerCase()) {
    try {
      console.log(`Locality average price is null for ${cleanLocality}. Fetching city-level average for ${cleanCity} as fallback...`);
      const cityInsights = await avnesterService.getLocalityInsights(cleanCity, cleanCity);
      if (cityInsights && cityInsights.supported && cityInsights.marketData?.averagePrice) {
        averageLocalityPrice = cityInsights.marketData.averagePrice;
        console.log(`Found city-level fallback average price: ${averageLocalityPrice}`);
      }
    } catch (err) {
      console.error(`Failed to fetch fallback city-level average for ${cleanCity}:`, err.message);
    }
  }

  // Robust Fallback: If averageLocalityPrice is still null, compute from cached localities or database properties of this city
  if (averageLocalityPrice === null && cleanCity) {
    try {
      const LocalityInsightCache = require("../models/LocalityInsightCache");
      const cachedLocalities = await LocalityInsightCache.find({
        city: { $regex: new RegExp(`^${cleanCity.trim()}$`, "i") },
        averageLocalityPrice: { $gt: 0 }
      });
      
      if (cachedLocalities.length > 0) {
        const sum = cachedLocalities.reduce((s, c) => s + c.averageLocalityPrice, 0);
        averageLocalityPrice = Math.round(sum / cachedLocalities.length);
        console.log(`Resolved average price from cached localities for ${cleanCity}: ${averageLocalityPrice}`);
      } else {
        const Property = require("../models/Property");
        const avgDoc = await Property.aggregate([
          {
            $match: {
              isDeleted: false,
              city: { $regex: new RegExp(`^${cleanCity.trim()}$`, "i") },
              price: { $gt: 0 }
            }
          },
          {
            $group: {
              _id: null,
              avgPrice: { $avg: "$price" }
            }
          }
        ]);
        if (avgDoc && avgDoc.length > 0 && avgDoc[0].avgPrice) {
          averageLocalityPrice = Math.round(avgDoc[0].avgPrice);
          console.log(`Resolved average price from own database properties for ${cleanCity}: ${averageLocalityPrice}`);
        }
      }
    } catch (err) {
      console.error(`Failed to resolve robust fallback price for ${cleanCity}:`, err.message);
    }
  }

  // 2. Fetch search properties comparables
  let estimatedPricePerSqft = null;
  let comparableCount = 0;
  const avnesterPropType = mapPropertyType(cleanPropType);

  if (avnesterPropType) {
    // Attempt first search with bedroom filter
    let searchResult = await avnesterService.searchProperties(
      cleanCity,
      cleanLocality,
      avnesterPropType,
      numBedrooms,
      20
    );

    let validListings = (searchResult?.listings || []).filter(
      (l) => l.price > 0 && l.carpetAreaSqft > 0
    );

    // Fallback: If no valid listings found and we used BHK filter, query without BHK
    if (validListings.length === 0 && numBedrooms) {
      searchResult = await avnesterService.searchProperties(
        cleanCity,
        cleanLocality,
        avnesterPropType,
        null,
        20
      );
      validListings = (searchResult?.listings || []).filter(
        (l) => l.price > 0 && l.carpetAreaSqft > 0
      );
    }

    if (validListings.length > 0) {
      const pricePerSqftArray = validListings.map((l) => Math.round(l.price / l.carpetAreaSqft));
      estimatedPricePerSqft = getMedian(pricePerSqftArray);
      comparableCount = validListings.length;
    }
  }

  // 3. Compute property value estimate
  let estimatedPropertyValue = null;
  if (estimatedPricePerSqft !== null && numArea > 0) {
    estimatedPropertyValue = Math.round(estimatedPricePerSqft * numArea);
  }

  // 4. Determine confidence score
  let confidence = "low";
  if (comparableCount >= 5 && averageLocalityPrice !== null) {
    confidence = "high";
  } else if (comparableCount >= 1 || averageLocalityPrice !== null) {
    confidence = "medium";
  }

  // 5. Handle supported with null data message
  let message = "";
  if (averageLocalityPrice === null && estimatedPricePerSqft === null) {
    message = "Locality supported, but current price data is unavailable.";
  }

  return {
    success: true,
    source: "AVnester",
    locality: cleanLocality,
    city: cleanCity,
    supported: true,
    message,
    averageLocalityPrice,
    estimatedPricePerSqft,
    comparableCount,
    estimatedPropertyValue,
    confidence,
    marketData: insightsResult.marketData,
    retrievedAt: new Date().toISOString(),
  };
};
module.exports = {
  getNormalizedMarketInsight,
};
