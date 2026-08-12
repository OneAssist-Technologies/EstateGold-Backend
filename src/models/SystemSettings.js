const mongoose = require("mongoose");

const systemSettingsSchema = new mongoose.Schema(
  {
    // 1. Platform Settings
    platformName: {
      type: String,
      default: "EstateGold",
      trim: true,
    },
    platformLogo: {
      type: String,
      default: "",
    },
    supportEmail: {
      type: String,
      default: "support@estategold.com",
      lowercase: true,
      trim: true,
    },
    supportPhone: {
      type: String,
      default: "+91 1800-123-4567",
      trim: true,
    },
    defaultCountry: {
      type: String,
      default: "India",
    },
    defaultCurrency: {
      type: String,
      default: "INR (₹)",
    },
    timeZone: {
      type: String,
      default: "Asia/Kolkata",
    },

    // 2. Property Settings
    propertyApprovalRequired: {
      type: Boolean,
      default: true,
    },
    allowEditingPublished: {
      type: Boolean,
      default: true,
    },
    defaultPropertyStatus: {
      type: String,
      enum: ["on_sale", "pending", "approved"],
      default: "on_sale",
    },
    allowPropertyHold: {
      type: Boolean,
      default: true,
    },
    maxImagesPerProperty: {
      type: Number,
      default: 15,
    },
    listingExpiry: {
      type: String,
      enum: ["disabled", "30", "60", "90"],
      default: "60",
    },

    // 3. Notification Settings
    newUserRegistration: {
      type: Boolean,
      default: true,
    },
    newPropertySubmitted: {
      type: Boolean,
      default: true,
    },
    propertyApprovedRejected: {
      type: Boolean,
      default: true,
    },
    newEnquiry: {
      type: Boolean,
      default: true,
    },
    newProjectSubmitted: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SystemSettings", systemSettingsSchema);
