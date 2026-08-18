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
  } else if (lowerCity.includes("coimbatore") || lowerCity === "covai" || lowerCity === "kovai" || lowerCity.includes("avinashi")) {
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
      message: "AVnester market data unavailable for this locality.",
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

  const averageLocalityPrice = insightsResult.marketData?.averagePrice || null;


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

    // Fallback 2: If still no valid listings found, query without propertyType
    if (validListings.length === 0) {
      searchResult = await avnesterService.searchProperties(
        cleanCity,
        cleanLocality,
        null,
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

  // Webpage scrape fallback: If estimatedPricePerSqft is still null, fetch from the webpage!
  if (estimatedPricePerSqft === null && insightsResult.handoffUrl) {
    try {
      console.log(`Bypassing search properties to fetch webpage price from: ${insightsResult.handoffUrl}`);
      const response = await fetch(insightsResult.handoffUrl);
      if (response.ok) {
        const html = await response.text();
        const match = html.match(/"Average Price per Sqft\s*\(INR\)","value":\s*(\d+)/i);
        if (match && match[1]) {
          estimatedPricePerSqft = parseInt(match[1], 10);
          console.log(`Scraped price per sqft for ${cleanLocality} from webpage: ${estimatedPricePerSqft}`);
        }
      }
    } catch (err) {
      console.error("Failed to scrape webpage price:", err.message);
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
  let success = true;
  let supported = true;
  if (averageLocalityPrice === null && estimatedPricePerSqft === null) {
    message = "AVnester market data unavailable for this locality.";
    success = false;
    supported = false;
  }

  return {
    success,
    source: "AVnester",
    locality: cleanLocality,
    city: cleanCity,
    supported,
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
