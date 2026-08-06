const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      default: "India",
      trim: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    radiusKm: {
      type: Number,
      required: true,
      default: 25,
    },
    pincodes: [
      {
        type: String,
        trim: true,
      },
    ],
    propertyTypes: [
      {
        type: String,
      },
    ],
    allowedServices: [
      {
        type: String,
      },
    ],
    maxListings: {
      type: Number,
      default: 1000,
    },
    displayPriority: {
      type: Number,
      default: 1,
    },
    isFeatured: {
      type: Boolean,
      default: true,
    },
    bannerImage: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
    metaTitle: {
      type: String,
      default: "",
    },
    metaDescription: {
      type: String,
      default: "",
    },
    slug: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    activeListings: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Location", locationSchema);
