const Location = require("../models/Location");

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

    const total = await Location.countDocuments(query);
    const locations = await Location.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Compute Stats
    const allLocations = await Location.find();
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
      locations,
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
    const location = await Location.findById(req.params.id);
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
    );
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
