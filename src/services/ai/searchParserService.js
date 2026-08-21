const Property = require("../../models/Property");
const Location = require("../../models/Location");

// Centralized keyword mappings and normalization rules
const KEYWORD_MAPPINGS = {
  cities: {
    "cbe": "Coimbatore",
    "coimbatore": "Coimbatore",
    "chennai": "Chennai",
    "bangalore": "Bengaluru",
    "bengaluru": "Bengaluru",
    "kollengode": "Kollengode",
    "perur": "Perur",
    "sulur": "Sulur",
    "tiruporur": "Tiruporur",
    "tiruppur": "Tiruppur",
    "coimbatore south": "Coimbatore South"
  },
  propertyTypes: {
    "flat": "Apartment / Flat",
    "apartment": "Apartment / Flat",
    "house": "Independent House",
    "home": "Independent House",
    "villa": "Villa",
    "plot": "Plot / Land",
    "land": "Plot / Land",
    "office": "Office Space",
    "shop": "Shop / Retail",
    "commercial": "Commercial Space",
    "builder floor": "Builder Floor",
    "warehouse": "Warehouse",
    "industrial": "Industrial Property",
    "hotel": "Hotel / Resort",
    "resort": "Hotel / Resort",
    "pg": "PG / Hostel",
    "hostel": "PG / Hostel",
    "project": "Builder / New Project"
  }
};

/**
 * Parse natural language search queries to filter criteria using pure JavaScript.
 * @param {string} query 
 * @returns {Promise<Object>} structured search filters
 */
const parseSearchQuery = async (query) => {
  try {
    const originalQuery = query;
    let q = String(query).toLowerCase().replace(/\s+/g, " ").trim();
    
    const result = {
      purpose: "",
      propertyType: "",
      city: "",
      locality: "",
      bedrooms: "",
      minPrice: "",
      maxPrice: "",
      furnishing: "",
      amenities: [],
      search: originalQuery,
      success: true
    };

    // 1. BHK / Bedrooms parsing
    const bhkMatch = q.match(/(\d)\s*bhk/i);
    const bedMatch = q.match(/(\d)\s*bedroom/i);
    if (bhkMatch) {
      result.bedrooms = bhkMatch[1];
    } else if (bedMatch) {
      result.bedrooms = bedMatch[1];
    }

    // 2. Purpose parsing
    if (q.includes("rent") || q.includes("lease") || q.includes("pg")) {
      result.purpose = "Rent";
    } else if (q.includes("buy") || q.includes("sell") || q.includes("sale") || q.includes("purchase")) {
      result.purpose = "Buy";
    }

    // 3. Property Type parsing (More specific types matched first)
    if (q.includes("agricultural land") || q.includes("agriculture land")) {
      result.propertyType = "Agricultural Land";
    } else if (q.includes("residential land") || q.includes("residential plot")) {
      result.propertyType = "Residential Plot";
    } else if (q.includes("builder floor") || q.includes("builder-floor")) {
      result.propertyType = "Builder Floor";
    } else if (q.includes("new project") || q.includes("builder project") || q.includes("builder / new project")) {
      result.propertyType = "Builder / New Project";
    } else if (q.includes("office space") || q.includes("office")) {
      result.propertyType = "Office Space";
    } else if (q.includes("shop") || q.includes("retail")) {
      result.propertyType = "Shop / Retail";
    } else if (q.includes("warehouse")) {
      result.propertyType = "Warehouse";
    } else if (q.includes("industrial")) {
      result.propertyType = "Industrial Property";
    } else if (q.includes("hotel") || q.includes("resort")) {
      result.propertyType = "Hotel / Resort";
    } else if (q.includes("pg") || q.includes("hostel") || q.includes("co-living") || q.includes("coliving")) {
      result.propertyType = "PG / Hostel";
    } else if (q.includes("villa")) {
      result.propertyType = "Villa";
    } else if (q.includes("plot")) {
      result.propertyType = "Plot / Land";
    } else if (q.includes("land")) {
      result.propertyType = "Plot / Land";
    } else if (q.includes("commercial")) {
      result.propertyType = "Commercial Space";
    } else if (q.includes("apartment") || q.includes("flat")) {
      result.propertyType = "Apartment / Flat";
    } else if (q.includes("house") || q.includes("home") || q.includes("independent")) {
      result.propertyType = "Independent House";
    } else if (q.includes("bhk")) {
      result.propertyType = "Apartment / Flat";
    }

    // 4. Furnishing parsing
    if (q.includes("semi-furnished") || q.includes("semi furnished") || q.includes("semi")) {
      result.furnishing = "Semi Furnished";
    } else if (q.includes("unfurnished") || q.includes("un-furnished")) {
      result.furnishing = "Unfurnished";
    } else if (q.includes("fully-furnished") || q.includes("fully furnished") || q.includes("furnished")) {
      result.furnishing = "Fully Furnished";
    }

    // 5. Amenities parsing
    if (q.includes("parking")) result.amenities.push("parking");
    if (q.includes("lift")) result.amenities.push("lift");
    if (q.includes("pool") || q.includes("swimming")) result.amenities.push("pool");
    if (q.includes("gym") || q.includes("fitness")) result.amenities.push("gym");
    if (q.includes("security") || q.includes("guard")) result.amenities.push("security");

    // 6. Budget/Price Parsing
    const cleanQ = q.replace(/lakhs?/gi, "lakh").replace(/\bl\b/gi, "lakh").replace(/crores?/gi, "crore").replace(/\bcr\b/gi, "crore");
    const maxMatchLakh = cleanQ.match(/(?:under|below|less than|within|max|maximum|upto)\s*(\d+(?:\.\d+)?)\s*lakh/i);
    const maxMatchCrore = cleanQ.match(/(?:under|below|less than|within|max|maximum|upto)\s*(\d+(?:\.\d+)?)\s*crore/i);
    const minMatchLakh = cleanQ.match(/(?:above|greater than|more than|min|minimum|start from|starting from)\s*(\d+(?:\.\d+)?)\s*lakh/i);
    const minMatchCrore = cleanQ.match(/(?:above|greater than|more than|min|minimum|start from|starting from)\s*(\d+(?:\.\d+)?)\s*crore/i);
    
    if (maxMatchLakh) result.maxPrice = String(parseFloat(maxMatchLakh[1]) * 100000);
    else if (maxMatchCrore) result.maxPrice = String(parseFloat(maxMatchCrore[1]) * 10000000);
    if (minMatchLakh) result.minPrice = String(parseFloat(minMatchLakh[1]) * 100000);
    else if (minMatchCrore) result.minPrice = String(parseFloat(minMatchCrore[1]) * 10000000);

    // 7. City & Locality parsing
    let tempQ = q;

    // Get distinct cities from DB dynamically to support dynamic updates
    let dbCities = [];
    try {
      dbCities = await Property.distinct("city", { isDeleted: { $ne: true } });
    } catch (e) {
      console.error("Failed to fetch distinct cities:", e);
    }
    
    // Normalize and build city search list
    const cityList = new Set();
    dbCities.forEach(c => { if (c) cityList.add(c.toLowerCase().trim()); });
    
    // Seed common cities/normalization inputs to the matching candidates
    Object.keys(KEYWORD_MAPPINGS.cities).forEach(key => cityList.add(key));

    // Match City (longest match first to avoid partial conflicts)
    const sortedCities = Array.from(cityList).sort((a, b) => b.length - a.length);
    let matchedCityKey = "";
    for (const cityCandidate of sortedCities) {
      if (tempQ.includes(cityCandidate)) {
        matchedCityKey = cityCandidate;
        break;
      }
    }

    if (matchedCityKey) {
      // Map matched city string using centralized keyword mappings
      if (KEYWORD_MAPPINGS.cities[matchedCityKey]) {
        result.city = KEYWORD_MAPPINGS.cities[matchedCityKey];
      } else {
        // Fallback: look for original capitalization in database
        const original = dbCities.find(c => c && c.toLowerCase().trim() === matchedCityKey);
        result.city = original || (matchedCityKey.charAt(0).toUpperCase() + matchedCityKey.slice(1));
      }
      
      // Clean query string to avoid duplicate city matching or city matching as locality
      tempQ = tempQ.replace(new RegExp(`\\bin\\s+${matchedCityKey}\\b`, "g"), "");
      tempQ = tempQ.replace(new RegExp(`\\b${matchedCityKey}\\b`, "g"), "");
    }

    // Now match Locality from MongoDB dynamically
    let dbLocalities = [];
    try {
      dbLocalities = await Property.distinct("locality", { isDeleted: { $ne: true } });
    } catch (e) {
      console.error("Failed to fetch distinct localities:", e);
    }

    const sortedLocalities = dbLocalities
      .filter(l => l && l.trim())
      .map(l => l.trim())
      .sort((a, b) => b.length - a.length);
      
    let matchedLocality = "";
    for (const locCandidate of sortedLocalities) {
      // Strict Check: Avoid matching locality if it is identical to city
      if (result.city && locCandidate.toLowerCase() === result.city.toLowerCase()) {
        continue;
      }
      if (tempQ.includes(locCandidate.toLowerCase())) {
        matchedLocality = locCandidate;
        break;
      }
    }

    if (matchedLocality) {
      result.locality = matchedLocality;
    } else {
      // Fallback: extract using "in <locality>" regex pattern
      // Clean up common keywords before extraction to avoid false positive matching
      let cleanLocalityQ = tempQ
        .replace(/\b\d+\s*bhk\b/g, "")
        .replace(/\b\d+\s*bedrooms?\b/g, "")
        .replace(/\bapartment\b/g, "")
        .replace(/\bflat\b/g, "")
        .replace(/\bvilla\b/g, "")
        .replace(/\bhouse\b/g, "")
        .replace(/\bhome\b/g, "")
        .replace(/\bplot\b/g, "")
        .replace(/\bland\b/g, "")
        .replace(/\boffice\b/g, "")
        .replace(/\bcommercial\b/g, "")
        .replace(/\brent\b/g, "")
        .replace(/\bbuy\b/g, "")
        .replace(/\bsale\b/g, "")
        .replace(/\bfor\b/g, "");

      const inMatch = cleanLocalityQ.match(/\bin\s+([a-z0-9]+(?:\s+[a-z0-9]+)?)/i);
      if (inMatch) {
        const candidate = inMatch[1].trim();
        // Capitalize words for nice representation
        result.locality = candidate.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }
    }

    return result;
  } catch (err) {
    console.error("parseSearchQuery failed:", err);
    return {
      success: false,
      search: query,
      error: err.message
    };
  }
};

module.exports = {
  parseSearchQuery,
};
