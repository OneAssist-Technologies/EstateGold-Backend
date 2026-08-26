const mongoose = require("mongoose");

const localityInsightCacheSchema = new mongoose.Schema(
  {
    country: {
      type: String,
      default: "India",
      trim: true,
    },
    state: {
      type: String,
      default: "",
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    locality: {
      type: String,
      required: true,
      trim: true,
    },
    propertyType: {
      type: String,
      required: true,
      trim: true,
    },
    bedrooms: {
      type: Number,
      default: null,
    },
    supported: {
      type: Boolean,
      default: false,
    },
    message: {
      type: String,
      default: "",
    },
    averageLocalityPrice: {
      type: Number,
      default: null,
    },
    estimatedPricePerSqft: {
      type: Number,
      default: null,
    },
    comparableCount: {
      type: Number,
      default: 0,
    },
    estimatedPropertyValue: {
      type: Number,
      default: null,
    },
    confidence: {
      type: String,
      default: null,
    },
    marketData: {
      averagePrice: { type: Number, default: null },
      supply: { type: Number, default: 0 },
      demandPulse: { type: String, default: null },
      livabilityGrade: { type: Number, default: null },
      highlights: [{ type: String }],
      priceTrends: [
        {
          period: String,
          value: Number,
        },
      ],
    },
    retrievedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique index to ensure one cache entry per location, property type and bedrooms context
localityInsightCacheSchema.index(
  { country: 1, state: 1, city: 1, locality: 1, propertyType: 1, bedrooms: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "LocalityInsightCache",
  localityInsightCacheSchema
);
