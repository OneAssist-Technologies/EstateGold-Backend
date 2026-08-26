const DEFAULT_WEIGHTS = {
  purpose: 15,
  propertyType: 15,
  city: 15,
  maxPrice: 15,
  bedrooms: 10,
  bathrooms: 5,
  area: 5,
  locality: 5,
  facing: 5,
  amenities: 10,
  nearby: 5
};

const calculatePropertyMatchScore = (property, preferences = {}, weights = DEFAULT_WEIGHTS) => {
  if (!property) return null;

  let totalMatchedPoints = 0;
  let totalPossiblePoints = 0;

  const matchedReasons = [];
  const mismatchedReasons = [];
  const unverifiedReasons = [];

  const cleanStr = (val) => String(val || "").trim().toLowerCase();

  // 1. Purpose (Buy / Rent)
  if (preferences.purpose && cleanStr(preferences.purpose)) {
    const prefPurpose = cleanStr(preferences.purpose);
    const propPurpose = cleanStr(property.purpose);

    if (!property.purpose) {
      unverifiedReasons.push("Listing purpose");
    } else {
      totalPossiblePoints += weights.purpose;
      const isPurposeMatch = 
        propPurpose === prefPurpose || 
        (prefPurpose === "buy" && propPurpose === "sale") ||
        (prefPurpose === "sale" && propPurpose === "buy");

      if (isPurposeMatch) {
        totalMatchedPoints += weights.purpose;
        matchedReasons.push(`Matches preferred purpose (${preferences.purpose})`);
      } else {
        mismatchedReasons.push(`✕ Purpose mismatch (expected ${preferences.purpose}, got ${property.purpose})`);
      }
    }
  }

  // 2. Property Type
  if (preferences.propertyType && cleanStr(preferences.propertyType)) {
    const prefType = cleanStr(preferences.propertyType);
    const propType = cleanStr(property.propertyType);

    if (!property.propertyType) {
      unverifiedReasons.push("Property type");
    } else {
      totalPossiblePoints += weights.propertyType;
      if (propType === prefType) {
        totalMatchedPoints += weights.propertyType;
        matchedReasons.push(`Matches preferred property type (${property.propertyType})`);
      } else {
        mismatchedReasons.push(`✕ Property type mismatch (expected ${preferences.propertyType}, got ${property.propertyType})`);
      }
    }
  }

  // 3. City
  if (preferences.city && cleanStr(preferences.city)) {
    const prefCity = cleanStr(preferences.city);
    const propCity = cleanStr(property.city);

    if (!property.city) {
      unverifiedReasons.push("City location");
    } else {
      totalPossiblePoints += weights.city;
      const isCityMatch = propCity === prefCity || propCity.includes(prefCity) || prefCity.includes(propCity);
      if (isCityMatch) {
        totalMatchedPoints += weights.city;
        matchedReasons.push(`Located in preferred city (${property.city})`);
      } else {
        mismatchedReasons.push(`✕ City mismatch (expected ${preferences.city}, got ${property.city})`);
      }
    }
  }

  // 4. Locality
  const isLocSameAsCity = preferences.city && preferences.locality && cleanStr(preferences.city) === cleanStr(preferences.locality);
  if (preferences.locality && cleanStr(preferences.locality) && !isLocSameAsCity) {
    const prefLocality = cleanStr(preferences.locality);
    const propLocality = cleanStr(property.locality);

    if (!property.locality) {
      unverifiedReasons.push("Locality location");
    } else {
      totalPossiblePoints += weights.locality;
      if (propLocality === prefLocality) {
        totalMatchedPoints += weights.locality;
        matchedReasons.push(`Located in preferred locality (${property.locality})`);
      } else {
        mismatchedReasons.push(`✕ Locality mismatch (expected ${preferences.locality}, got ${property.locality})`);
      }
    }
  }

  // 5. Budget / Max Price
  const rawMaxPrice = Number(preferences.maxPrice || preferences.budget || 0);
  if (rawMaxPrice > 0) {
    if (!property.price || property.price <= 0) {
      unverifiedReasons.push("Pricing details");
    } else {
      totalPossiblePoints += weights.maxPrice;
      if (property.price <= rawMaxPrice) {
        totalMatchedPoints += weights.maxPrice;
        const formattedPrice = property.price >= 10000000 
          ? `₹${(property.price / 10000000).toFixed(2).replace(/\.00$/, "")} Cr`
          : `₹${(property.price / 100000).toFixed(1).replace(/\.0$/, "")} L`;
        matchedReasons.push(`Price is within budget (${formattedPrice})`);
      } else {
        mismatchedReasons.push(`✕ Price exceeds budget (budget: ₹${(rawMaxPrice / 100000).toFixed(0)}L, price: ₹${(property.price / 100000).toFixed(0)}L)`);
      }
    }
  }

  // 6. BHK / Bedrooms
  const rawBedrooms = Number(preferences.bedrooms || preferences.bhk || 0);
  if (rawBedrooms > 0) {
    if (property.bedrooms === undefined || property.bedrooms === null) {
      unverifiedReasons.push("BHK bedroom count");
    } else {
      totalPossiblePoints += weights.bedrooms;
      if (Number(property.bedrooms) === rawBedrooms) {
        totalMatchedPoints += weights.bedrooms;
        matchedReasons.push(`Matches preferred BHK count (${property.bedrooms} BHK)`);
      } else {
        mismatchedReasons.push(`✕ BHK mismatch (expected ${rawBedrooms} BHK, got ${property.bedrooms} BHK)`);
      }
    }
  }

  // 7. Bathrooms
  const rawBathrooms = Number(preferences.bathrooms || 0);
  if (rawBathrooms > 0) {
    if (property.bathrooms === undefined || property.bathrooms === null) {
      unverifiedReasons.push("Bathroom count");
    } else {
      totalPossiblePoints += weights.bathrooms;
      if (Number(property.bathrooms) === rawBathrooms) {
        totalMatchedPoints += weights.bathrooms;
        matchedReasons.push(`Matches preferred bathroom count (${property.bathrooms} Baths)`);
      } else {
        mismatchedReasons.push(`✕ Bathroom count mismatch (expected ${rawBathrooms} Baths, got ${property.bathrooms} Baths)`);
      }
    }
  }

  // 8. Area
  const rawMinArea = Number(preferences.minArea || 0);
  if (rawMinArea > 0) {
    const propArea = Number(property.area || property.carpetArea || property.plotArea || 0);
    if (propArea <= 0) {
      unverifiedReasons.push("Property area size");
    } else {
      totalPossiblePoints += weights.area;
      if (propArea >= rawMinArea) {
        totalMatchedPoints += weights.area;
        matchedReasons.push(`Matches minimum area requirement (${propArea.toLocaleString()} sq ft)`);
      } else {
        mismatchedReasons.push(`✕ Area is smaller than preferred (preferred: ${rawMinArea.toLocaleString()} sq ft, got ${propArea.toLocaleString()} sq ft)`);
      }
    }
  }

  // 9. Facing
  if (preferences.facing && cleanStr(preferences.facing)) {
    const prefFacing = cleanStr(preferences.facing);
    const propFacing = cleanStr(property.facing || property.plotFacing);

    if (!property.facing && !property.plotFacing) {
      unverifiedReasons.push("Facing direction");
    } else {
      totalPossiblePoints += weights.facing;
      if (propFacing === prefFacing) {
        totalMatchedPoints += weights.facing;
        matchedReasons.push(`Matches preferred facing direction (${property.facing || property.plotFacing})`);
      } else {
        mismatchedReasons.push(`✕ Facing direction mismatch (expected ${preferences.facing}, got ${property.facing || property.plotFacing})`);
      }
    }
  }

  // 10. Amenities
  let prefAmenities = [];
  if (preferences.amenities) {
    if (Array.isArray(preferences.amenities)) {
      prefAmenities = preferences.amenities.map(a => cleanStr(a)).filter(Boolean);
    } else if (typeof preferences.amenities === "string") {
      prefAmenities = preferences.amenities.split(",").map(a => cleanStr(a)).filter(Boolean);
    }
  }

  if (prefAmenities.length > 0) {
    if (!property.amenities || !Array.isArray(property.amenities)) {
      unverifiedReasons.push("Property amenities status");
    } else {
      const propAmenities = property.amenities.map(a => cleanStr(a));
      const weightPerAmenity = weights.amenities / prefAmenities.length;

      prefAmenities.forEach(prefAmenity => {
        totalPossiblePoints += weightPerAmenity;
        const isMatched = propAmenities.some(propA => propA.includes(prefAmenity) || prefAmenity.includes(propA));
        if (isMatched) {
          totalMatchedPoints += weightPerAmenity;
          const label = prefAmenity.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          matchedReasons.push(`${label} available`);
        } else {
          const label = prefAmenity.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          mismatchedReasons.push(`✕ Missing ${label}`);
        }
      });
    }
  }

  // 11. Nearby Facilities (Other preferences)
  let prefNearby = [];
  if (preferences.nearby) {
    if (Array.isArray(preferences.nearby)) {
      prefNearby = preferences.nearby.map(n => cleanStr(n)).filter(Boolean);
    } else if (typeof preferences.nearby === "string") {
      prefNearby = preferences.nearby.split(",").map(n => cleanStr(n)).filter(Boolean);
    }
  }

  if (prefNearby.length > 0) {
    const nearbyPlaces = property.neighbourhood?.nearbyPlaces;
    if (!nearbyPlaces) {
      unverifiedReasons.push("Nearby facilities availability");
    } else {
      const weightPerNearby = weights.nearby / prefNearby.length;

      prefNearby.forEach(prefNb => {
        let key = prefNb;
        if (prefNb.includes("school")) key = "school";
        else if (prefNb.includes("hospital")) key = "hospital";
        else if (prefNb.includes("metro")) key = "metro";
        else if (prefNb.includes("college") || prefNb.includes("university")) key = "college";
        else if (prefNb.includes("shopping") || prefNb.includes("mall")) key = "mall";

        const place = nearbyPlaces[key];
        if (!place) {
          unverifiedReasons.push(`${key} proximity`);
        } else {
          totalPossiblePoints += weightPerNearby;
          if (place.enabled === true || place.enabled === "true" || place.enabled === 1 || place.enabled === "1") {
            totalMatchedPoints += weightPerNearby;
            const placeName = place.name ? ` (${place.name})` : "";
            const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
            matchedReasons.push(`${formattedKey} nearby${placeName}`);
          } else {
            const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
            mismatchedReasons.push(`✕ Missing nearby ${formattedKey}`);
          }
        }
      });
    }
  }

  if (totalPossiblePoints === 0) {
    return null;
  }

  const score = Math.min(100, Math.max(0, Math.round((totalMatchedPoints / totalPossiblePoints) * 100)));

  let label = "Low Match";
  if (score >= 90) label = "Excellent Match";
  else if (score >= 75) label = "Very Good Match";
  else if (score >= 60) label = "Good Match";
  else if (score >= 40) label = "Partial Match";

  return {
    score,
    label,
    matchedReasons,
    mismatchedReasons,
    unverifiedReasons
  };
};

module.exports = {
  calculatePropertyMatchScore,
  DEFAULT_WEIGHTS
};
