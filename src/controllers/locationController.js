const Location = require("../models/Location");
const Property = require("../models/Property");

// Create Location
exports.createLocation = async (req, res) => {
  try {
    const {
      city,
      state,
      country,
      latitude,
      longitude,
      radiusKm,
      pincodes,
      propertyTypes,
      allowedServices,
      maxListings,
      displayPriority,
      isFeatured,
      bannerImage,
      notes,
      metaTitle,
      metaDescription,
      slug,
      status,
    } = req.body;

    if (!city || !city.trim()) {
      return res.status(400).json({
        success: false,
        message: "City name is required.",
      });
    }

    const stateVal = state && state.trim() ? state.trim() : "Tamil Nadu";

    // Check if city already exists in DB
    const existing = await Location.findOne({
      city: { $regex: new RegExp(`^${city.trim()}$`, "i") },
    });

    if (existing) {
      existing.state = stateVal;
      existing.country = country || existing.country || "India";
      existing.latitude = Number(latitude) || existing.latitude;
      existing.longitude = Number(longitude) || existing.longitude;
      existing.radiusKm = Number(radiusKm) || existing.radiusKm;
      if (pincodes !== undefined) {
        existing.pincodes = Array.isArray(pincodes)
          ? pincodes
          : (pincodes || "")
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean);
      }
      if (propertyTypes !== undefined) existing.propertyTypes = propertyTypes;
      if (allowedServices !== undefined) existing.allowedServices = allowedServices;
      if (displayPriority !== undefined) existing.displayPriority = Number(displayPriority);
      if (isFeatured !== undefined) existing.isFeatured = isFeatured;
      if (notes !== undefined) existing.notes = notes;
      if (status !== undefined) existing.status = status;

      await existing.save();

      return res.status(200).json({
        success: true,
        message: `Service area for ${city} updated successfully`,
        location: existing,
      });
    }

    const location = await Location.create({
      city: city.trim(),
      state: stateVal,
      country: country || "India",
      latitude: Number(latitude) || 13.0827,
      longitude: Number(longitude) || 80.2707,
      radiusKm: Number(radiusKm) || 10,
      pincodes: Array.isArray(pincodes)
        ? pincodes
        : (pincodes || "")
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
      propertyTypes: propertyTypes || [],
      allowedServices: allowedServices || [],
      maxListings: Number(maxListings) || 1000,
      displayPriority: Number(displayPriority) || 1,
      isFeatured: isFeatured !== undefined ? isFeatured : true,
      bannerImage: bannerImage || "",
      notes: notes || "",
      metaTitle: metaTitle || "",
      metaDescription: metaDescription || "",
      slug: slug || `properties-in-${city.toLowerCase().replace(/\s+/g, "-")}`,
      status: status || "active",
    });

    res.status(201).json({
      success: true,
      message: "Service area added successfully",
      location,
    });
  } catch (error) {
    console.error("Create Location Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to add service area",
    });
  }
};

// Get All Locations (with search & filter & stats)
exports.getLocations = async (req, res) => {
  try {
    const { search, status, state, page = 1, limit = 10 } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { city: { $regex: search, $options: "i" } },
        { state: { $regex: search, $options: "i" } },
      ];
    }

    if (status && status !== "all") {
      query.status = status;
    }

    if (state && state !== "all") {
      query.state = state;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // 1. Sync Active Listing Counts & Link serviceableAreaId for all locations first
    const allLocations = await Location.find();
    for (const loc of allLocations) {
      if (loc.city) {
        // Retroactively link any properties matching this city name
        await Property.updateMany(
          {
            isDeleted: false,
            $or: [
              { serviceableAreaId: { $exists: false } },
              { serviceableAreaId: null },
            ],
            city: { $regex: new RegExp(`^${loc.city.trim()}$`, "i") },
          },
          {
            $set: { serviceableAreaId: loc._id },
          }
        );
      }

      const count = await Property.countDocuments({
        isDeleted: false,
        $or: [
          { serviceableAreaId: loc._id },
          ...(loc.city
            ? [{ city: { $regex: new RegExp(`^${loc.city.trim()}$`, "i") } }]
            : []),
        ],
      });

      if (loc.activeListings !== count) {
        loc.activeListings = count;
        await loc.save();
      }
    }

    // 2. Fetch paginated locations with updated activeListings & populated requestedBy user
    const total = await Location.countDocuments(query);
    const locations = await Location.find(query)
      .populate("requestedBy", "fullName email phone role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Resolve average price per sqft for each city from market insight cache (AVnester search_properties data)
    const LocalityInsightCache = require("../models/LocalityInsightCache");
    
    const resolvedLocations = [];
    for (const loc of locations) {
      const locObj = loc.toObject();
      let avgPrice = null;

      if (loc.city) {
        const cleanCity = loc.city.trim();
        let fallbackLocality = cleanCity;
        const lowerCity = cleanCity.toLowerCase();
        if (lowerCity === "chennai") {
          fallbackLocality = "Anna Nagar";
        } else if (lowerCity.includes("coimbatore south")) {
          fallbackLocality = "Peelamedu";
        } else if (lowerCity.includes("coimbatore north")) {
          fallbackLocality = "Gandhipuram";
        } else if (lowerCity.includes("avinashi")) {
          fallbackLocality = "Avinashi";
        }

        // Check if we have any cached records for this city (even unsupported/failed lookups)
        const cachedLocalities = await LocalityInsightCache.find({
          city: { $regex: new RegExp(`^${cleanCity}$`, "i") }
        });

        if (cachedLocalities.length > 0) {
          const pricingLocalities = cachedLocalities.filter(c => c.estimatedPricePerSqft && c.estimatedPricePerSqft > 0);
          if (pricingLocalities.length > 0) {
            const sum = pricingLocalities.reduce((s, c) => s + c.estimatedPricePerSqft, 0);
            avgPrice = Math.round(sum / pricingLocalities.length);
          } else {
            avgPrice = null;
          }
        } else {
          // Dynamic fetch: if no cached locality pricing is found, trigger a fallback fetch for this city name using a primary locality
          try {
            const marketInsightService = require("../services/marketInsightService");

            console.log(`Triggering dynamic fallback fetch for ${cleanCity} using locality ${fallbackLocality}...`);
            const freshInsight = await marketInsightService.getNormalizedMarketInsight({
              city: cleanCity,
              locality: fallbackLocality,
              propertyType: "Apartment / Flat",
            });

            if (freshInsight) {
              avgPrice = freshInsight.estimatedPricePerSqft || null;

              // Cache the result (even if estimatedPricePerSqft is null or unsupported) so we don't query it again
              await LocalityInsightCache.findOneAndUpdate(
                {
                  country: "India",
                  state: loc.state || "",
                  city: cleanCity,
                  locality: fallbackLocality,
                  propertyType: "Apartment / Flat",
                  bedrooms: null,
                },
                {
                  country: "India",
                  state: loc.state || "",
                  city: cleanCity,
                  locality: fallbackLocality,
                  propertyType: "Apartment / Flat",
                  bedrooms: null,
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
            }
          } catch (err) {
            console.error(`Dynamic location price resolution failed for ${cleanCity}:`, err.message);
            // Cache a negative/empty lookup so we don't retry on every single subsequent request
            await LocalityInsightCache.findOneAndUpdate(
              {
                country: "India",
                state: loc.state || "",
                city: cleanCity,
                locality: fallbackLocality,
                propertyType: "Apartment / Flat",
                bedrooms: null,
              },
              {
                country: "India",
                state: loc.state || "",
                city: cleanCity,
                locality: fallbackLocality,
                propertyType: "Apartment / Flat",
                bedrooms: null,
                supported: false,
                message: `Failed fallback fetch: ${err.message}`,
                averageLocalityPrice: null,
                estimatedPricePerSqft: null,
                comparableCount: 0,
                estimatedPropertyValue: null,
                confidence: null,
                marketData: null,
                retrievedAt: new Date().toISOString(),
              },
              { upsert: true, new: true }
            ).catch(cacheErr => console.error("Failed to write error state to cache:", cacheErr));
          }
        }
      }
      locObj.averagePrice = avgPrice;
      resolvedLocations.push(locObj);
    }

    const stats = {
      totalCities: allLocations.length,
      activeCities: allLocations.filter((l) => l.status === "active").length,
      inactiveCities: allLocations.filter((l) => l.status === "inactive").length,
      totalListings: allLocations.reduce(
        (sum, item) => sum + (item.activeListings || 0),
        0
      ),
      averageRadius:
        allLocations.length > 0
          ? Math.round(
            allLocations.reduce((sum, item) => sum + item.radiusKm, 0) /
            allLocations.length
          )
          : 0,
    };

    res.json({
      success: true,
      locations: resolvedLocations,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      stats,
    });
  } catch (error) {
    console.error("Get Locations Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch locations",
    });
  }
};

// Get Location By ID
exports.getLocationById = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id).populate("requestedBy", "fullName email phone role");
    if (!location) {
      return res.status(404).json({ success: false, message: "Location not found" });
    }
    res.json({ success: true, location });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Location
exports.updateLocation = async (req, res) => {
  try {
    const location = await Location.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    ).populate("requestedBy", "fullName email phone role");
    if (!location) {
      return res.status(404).json({ success: false, message: "Location not found" });
    }
    res.json({
      success: true,
      message: "Service area updated successfully",
      location,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Location
exports.deleteLocation = async (req, res) => {
  try {
    const location = await Location.findByIdAndDelete(req.params.id);
    if (!location) {
      return res.status(404).json({ success: false, message: "Location not found" });
    }
    res.json({
      success: true,
      message: "Service area deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Request Service Area from Admin
exports.requestServiceArea = async (req, res) => {
  try {
    const { city, state, locality, address, latitude, longitude, notes } = req.body;
    const requestedCity = (city || locality || "Requested Area").trim();

    const existing = await Location.findOne({
      city: { $regex: new RegExp(`^${requestedCity}$`, "i") },
    });

    if (!existing) {
      await Location.create({
        city: requestedCity,
        state: state || "Tamil Nadu",
        country: "India",
        latitude: Number(latitude) || 13.0827,
        longitude: Number(longitude) || 80.2707,
        radiusKm: 10,
        status: "inactive",
        notes: `User Requested Service Area: ${address || locality || requestedCity}. ${notes || ""}`,
        requestedBy: req.user ? req.user._id : null,
        requestedAddress: address || "",
        requestedLocality: locality || "",
      });
    } else if (existing.status === "inactive") {
      existing.notes = `User Requested Service Area: ${address || locality || requestedCity}. ${notes || ""}`;
      if (req.user) existing.requestedBy = req.user._id;
      if (address) existing.requestedAddress = address;
      if (locality) existing.requestedLocality = locality;
      if (latitude) existing.latitude = Number(latitude);
      if (longitude) existing.longitude = Number(longitude);
      await existing.save();
    }

    res.status(200).json({
      success: true,
      message: "Your location request has been submitted to the admin successfully!",
    });
  } catch (error) {
    console.error("Request Service Area Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to submit location request",
    });
  }
};
