const Location = require("../models/Location");

/**
 * Calculates geographic distance in kilometers between two lat/lon coordinates using the Haversine formula.
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const p1 = Number(lat1);
  const l1 = Number(lon1);
  const p2 = Number(lat2);
  const l2 = Number(lon2);

  if (isNaN(p1) || isNaN(l1) || isNaN(p2) || isNaN(l2)) {
    return Infinity;
  }

  const R = 6371; // Earth's radius in kilometers
  const dLat = (p2 - p1) * (Math.PI / 180);
  const dLon = (l2 - l1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1 * (Math.PI / 180)) *
    Math.cos(p2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Attempts to geocode an address string using OpenStreetMap Nominatim API.
 */
async function geocodeAddress(addressStr) {
  if (!addressStr || !addressStr.trim()) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      addressStr.trim()
    )}&limit=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "PropertyListingApp/1.0",
        "Accept-Language": "en",
      },
    });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      if (!isNaN(lat) && !isNaN(lon)) {
        return { latitude: lat, longitude: lon };
      }
    }
  } catch (err) {
    console.error("Geocoding failed for address:", addressStr, err.message);
  }
  return null;
}

function isTypeAllowed(allowedTypes, targetType) {
  if (!allowedTypes || allowedTypes.length === 0) return true;
  if (!targetType) return true;

  const target = targetType.trim().toLowerCase();

  return allowedTypes.some((item) => {
    const allowed = item.trim().toLowerCase();
    if (allowed === target) return true;

    if (target.includes("apartment") && allowed.includes("apartment")) return true;
    if (target.includes("villa") && allowed.includes("villa")) return true;
    if (target.includes("plot") && allowed.includes("plot")) return true;
    if (target.includes("house") && allowed.includes("house")) return true;
    if (target.includes("commercial") && allowed.includes("commercial")) return true;
    if (target.includes("office") && allowed.includes("office")) return true;
    if (
      (target.includes("pg") || target.includes("co-living")) &&
      (allowed.includes("pg") || allowed.includes("co-living"))
    )
      return true;

    if (
      (target.includes("builder") || target.includes("project")) &&
      (allowed.includes("apartment") || allowed.includes("villa") || allowed.includes("house") || allowed.includes("project") || allowed.includes("builder"))
    )
      return true;

    return false;
  });
}

function isServiceAllowed(allowedServices, targetPurpose) {
  if (!allowedServices || allowedServices.length === 0) return true;
  if (!targetPurpose) return true;

  const target = targetPurpose.trim().toLowerCase();

  return allowedServices.some((item) => {
    const allowed = item.trim().toLowerCase();
    if (allowed === target) return true;

    if (
      (target === "sell" || target === "sale" || target === "buy") &&
      (allowed === "buy" || allowed === "sell" || allowed === "sale")
    )
      return true;
    if (target === "rent" && allowed === "rent") return true;
    if (target === "lease" && allowed === "lease") return true;
    if (
      (target === "pg_co_living" || target === "pg / co-living" || target === "pg") &&
      (allowed === "pg_co_living" || allowed === "pg / co-living" || allowed === "pg" || allowed === "pg/co-living")
    )
      return true;

    return false;
  });
}

/**
 * Checks whether property coordinates fall inside ANY ACTIVE serviceable location
 * and whether propertyType and purpose are allowed in that area.
 */
/**
 * Checks whether property coordinates or city/locality fall inside ANY ACTIVE serviceable location
 * and whether propertyType and purpose are allowed in that area.
 */
async function checkPropertyServiceability(propertyDataInput, localityInput) {
  let dataObj = {};
  if (typeof propertyDataInput === "string") {
    dataObj = {
      city: propertyDataInput,
      locality: localityInput || "",
    };
  } else if (propertyDataInput && typeof propertyDataInput === "object") {
    dataObj = propertyDataInput;
  }

  const activeLocations = await Location.find({ status: "active" });

  if (!activeLocations || activeLocations.length === 0) {
    return {
      isServiceable: true,
      matchedLocation: null,
      distance: 0,
      message: "All areas are serviceable by default.",
    };
  }

  const targetCity = (dataObj.city || "").trim().toLowerCase();
  const targetLocality = (dataObj.locality || "").trim().toLowerCase();

  // Check if targetCity directly matches an active serviceable city
  const cityMatch = activeLocations.find(
    (loc) => loc.city && loc.city.trim().toLowerCase() === targetCity
  );

  let latitude = Number(dataObj.latitude);
  let longitude = Number(dataObj.longitude);

  // If coordinates missing, attempt geocoding or fallback to matching city's center coordinates
  if (isNaN(latitude) || isNaN(longitude) || (latitude === 0 && longitude === 0)) {
    if (targetLocality && targetCity) {
      const fullSearchQuery = `${dataObj.locality}, ${dataObj.city}, India`;
      const geocoded = await geocodeAddress(fullSearchQuery);
      if (geocoded) {
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
      }
    }

    if ((isNaN(latitude) || isNaN(longitude) || (latitude === 0 && longitude === 0)) && cityMatch) {
      latitude = cityMatch.latitude;
      longitude = cityMatch.longitude;
    }
  }

  // Calculate distance to each active serviceable location
  const matches = [];

  for (const loc of activeLocations) {
    const isSameCity = loc.city && loc.city.trim().toLowerCase() === targetCity;

    let dist = Infinity;
    if (!isNaN(latitude) && !isNaN(longitude) && latitude !== 0 && longitude !== 0) {
      dist = calculateDistanceKm(
        latitude,
        longitude,
        loc.latitude,
        loc.longitude
      );
    }

    // Match if within radius OR if city matches active serviceable city directly
    if (dist <= loc.radiusKm || isSameCity) {
      matches.push({
        location: loc,
        distance: isFinite(dist) ? dist : 0,
      });
    }
  }

  if (matches.length > 0) {
    // Pick nearest matching active serviceable area
    matches.sort((a, b) => a.distance - b.distance);
    const nearest = matches[0];
    const loc = nearest.location;

    // Check Property Type restriction
    if (
      dataObj.propertyType &&
      !isTypeAllowed(loc.propertyTypes, dataObj.propertyType)
    ) {
      return {
        isServiceable: false,
        code: "PROPERTY_TYPE_NOT_ALLOWED",
        message: `${dataObj.propertyType} listings are currently not allowed in ${loc.city}.`,
      };
    }

    // Check Purpose (Allowed Services) restriction
    if (
      dataObj.purpose &&
      !isServiceAllowed(loc.allowedServices, dataObj.purpose)
    ) {
      const formattedPurpose =
        dataObj.purpose.charAt(0).toUpperCase() +
        dataObj.purpose.slice(1);
      return {
        isServiceable: false,
        code: "SERVICE_NOT_ALLOWED",
        message: `${formattedPurpose} listings are currently not allowed in ${loc.city}.`,
      };
    }

    return {
      isServiceable: true,
      matchedLocation: loc,
      distance: nearest.distance,
      latitude: latitude || loc.latitude,
      longitude: longitude || loc.longitude,
    };
  }

  return {
    isServiceable: false,
    code: "AREA_NOT_SERVICEABLE",
    message: `Location ${dataObj.locality ? dataObj.locality + ", " : ""}${dataObj.city || "specified area"} is currently not in a serviceable area.`,
  };
}

module.exports = {
  calculateDistanceKm,
  geocodeAddress,
  checkPropertyServiceability,
};
