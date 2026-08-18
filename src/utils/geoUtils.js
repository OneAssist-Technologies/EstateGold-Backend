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

    return false;
  });
}

/**
 * Checks whether property coordinates fall inside ANY ACTIVE serviceable location
 * and whether propertyType and purpose are allowed in that area.
 */
async function checkPropertyServiceability(propertyData) {
  const activeLocations = await Location.find({ status: "active" });

  if (!activeLocations || activeLocations.length === 0) {
    return {
      isServiceable: false,
      code: "NO_SERVICEABLE_AREAS",
      message: "We currently don't have any serviceable areas available.",
    };
  }

  let latitude = Number(propertyData.latitude);
  let longitude = Number(propertyData.longitude);

  // If coordinates missing, attempt geocoding
  if (isNaN(latitude) || isNaN(longitude) || (latitude === 0 && longitude === 0)) {
    const fullSearchQuery = [
      propertyData.locality,
      propertyData.city,
      "India",
    ]
      .filter(Boolean)
      .join(", ");

    const geocoded = await geocodeAddress(fullSearchQuery);
    if (geocoded) {
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
    } else {
      // Fallback: match by city name against active locations
      const cityMatch = activeLocations.find(
        (loc) => loc.city && loc.city.toLowerCase() === (propertyData.city || "").toLowerCase()
      );
      if (cityMatch) {
        latitude = cityMatch.latitude;
        longitude = cityMatch.longitude;
      }
    }
  }

  if (isNaN(latitude) || isNaN(longitude)) {
    return {
      isServiceable: false,
      code: "AREA_NOT_SERVICEABLE",
      message: "We currently don't provide service in this area.",
    };
  }

  // Calculate distance to each active serviceable location
  const matches = [];

  for (const loc of activeLocations) {
    const dist = calculateDistanceKm(
      latitude,
      longitude,
      loc.latitude,
      loc.longitude
    );

    if (dist <= loc.radiusKm) {
      matches.push({
        location: loc,
        distance: dist,
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
      propertyData.propertyType &&
      !isTypeAllowed(loc.propertyTypes, propertyData.propertyType)
    ) {
      return {
        isServiceable: false,
        code: "PROPERTY_TYPE_NOT_ALLOWED",
        message: `${propertyData.propertyType} listings are currently not allowed in ${loc.city}.`,
      };
    }

    // Check Purpose (Allowed Services) restriction
    if (
      propertyData.purpose &&
      !isServiceAllowed(loc.allowedServices, propertyData.purpose)
    ) {
      const formattedPurpose =
        propertyData.purpose.charAt(0).toUpperCase() +
        propertyData.purpose.slice(1);
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
      latitude,
      longitude,
    };
  }

  return {
    isServiceable: false,
    code: "AREA_NOT_SERVICEABLE",
    message: "We currently don't provide service in this area.",
  };
}

module.exports = {
  calculateDistanceKm,
  geocodeAddress,
  checkPropertyServiceability,
};
