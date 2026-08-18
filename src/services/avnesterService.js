/**
 * Service to communicate with AVnester real estate intelligence API
 */

const normalizeLocalityInsight = (raw, locality, city) => {
  if (!raw || raw.supported === false) {
    return {
      success: false,
      source: "AVNESTER",
      locality,
      city,
      supported: false,
      message: raw?.scopeMessage || raw?.message || "Market insight unavailable for this location.",
      marketData: {
        averagePrice: null,
        supply: null,
        demandPulse: null,
        livabilityGrade: null,
        highlights: [],
        priceTrends: [],
      },
      retrievedAt: new Date().toISOString(),
    };
  }

  const insights = raw.insights || {};
  return {
    success: true,
    source: "AVNESTER",
    locality: raw.locality || locality,
    city: raw.city || city,
    supported: true,
    message: raw.message || "",
    handoffUrl: raw.handoffUrl || "",
    marketData: {
      averagePrice: insights.avgPriceInr || null,
      supply: insights.supplyCount || 0,
      demandPulse: insights.demandPulse || null,
      livabilityGrade: insights.livabilityScore || null,
      highlights: insights.highlights || [],
      priceTrends: (insights.priceTrends || []).map((pt) => ({
        period: pt.period || "",
        value: pt.avgPriceInr || pt.value || 0,
      })),
    },
    retrievedAt: new Date().toISOString(),
  };
};

const getLocalityInsights = async (locality, city) => {
  try {
    const response = await fetch("https://api.avnester.com/public/v1/get_locality_insights", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locality: locality.trim(),
        localityName: locality.trim(),
        city: city.trim(),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AVnester API returned status ${response.status}: ${errText}`);
      return normalizeLocalityInsight(null, locality, city);
    }

    const data = await response.json();
    return normalizeLocalityInsight(data, locality, city);
  } catch (error) {
    console.error("Error in AVnester Service call:", error.message);
    // Return clean fallback empty normalized object instead of throwing, so application remains functional
    return normalizeLocalityInsight(null, locality, city);
  }
};

const searchProperties = async (city, localityName, propertyType, bedrooms, limit = 20) => {
  try {
    const body = {
      city: city.trim(),
      localityName: localityName.trim(),
      limit,
    };
    if (propertyType) {
      body.propertyType = propertyType;
    }
    if (bedrooms) {
      body.bedrooms = Number(bedrooms);
    }

    const response = await fetch("https://api.avnester.com/public/v1/search_properties", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AVnester search_properties API returned status ${response.status}: ${errText}`);
      return { supported: false, listings: [], total: 0 };
    }

    return await response.json();
  } catch (error) {
    console.error("Error in AVnester search_properties call:", error.message);
    return { supported: false, listings: [], total: 0 };
  }
};

module.exports = {
  getLocalityInsights,
  searchProperties,
};
