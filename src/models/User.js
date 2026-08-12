const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: [
        "buyer",
        "seller",
        "agent",
        "admin",
      ],
      required: true,
    },

    roles: [
      {
        type: String,
        enum: ["buyer", "seller", "agent", "admin"],
      },
    ],

    verificationStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },

    rejectionReason: {
      type: String,
      default: "",
    },

    experience: {
      type: String,
      default: "",
    },

    documents: [
      {
        name: { type: String, default: "" },
        url: { type: String, default: "" },
      },
    ],

    ownerName: {
      type: String,
      default: "",
    },

    agencyName: {
      type: String,
      default: "",
    },

    reraNumber: {
      type: String,
      default: "",
    },

    city: {
      type: String,
      default: "",
    },

    profileImage: {
      type: String,
      default: "",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    suspendReason: {
      type: String,
      default: "",
    },

    dob: {
      type: Date,
      default: "",
    },

    gender: {
      type: String,
      default: "",
    },

    houseNo: {
      type: String,
      default: "",
    },

    street: {
      type: String,
      default: "",
    },

    locality: {
      type: String,
      default: "",
    },

    state: {
      type: String,
      default: "",
    },

    pincode: {
      type: String,
      default: "",
    },

    country: {
      type: String,
      default: "India",
    },

    preferences: {
      emailNotifications: { type: Boolean, default: true },
      propertyAlerts: { type: Boolean, default: true },
      enquiryNotifications: { type: Boolean, default: true },
      savedSearchAlerts: { type: Boolean, default: true },
    },

    permissions: {
      dashboard: {
        view: { type: Boolean, default: true },
        create: { type: Boolean, default: true },
        edit: { type: Boolean, default: true },
        delete: { type: Boolean, default: true },
        approve: { type: Boolean, default: true },
      },
      properties: {
        view: { type: Boolean, default: true },
        create: { type: Boolean, default: true },
        edit: { type: Boolean, default: true },
        delete: { type: Boolean, default: false },
        approve: { type: Boolean, default: true },
      },
      users: {
        view: { type: Boolean, default: true },
        create: { type: Boolean, default: true },
        edit: { type: Boolean, default: true },
        delete: { type: Boolean, default: false },
        approve: { type: Boolean, default: true },
      },
      locations: {
        view: { type: Boolean, default: true },
        create: { type: Boolean, default: true },
        edit: { type: Boolean, default: true },
        delete: { type: Boolean, default: false },
        approve: { type: Boolean, default: true },
      },
      analytics: {
        view: { type: Boolean, default: true },
        create: { type: Boolean, default: false },
        edit: { type: Boolean, default: false },
        delete: { type: Boolean, default: false },
        approve: { type: Boolean, default: false },
      },
      settings: {
        view: { type: Boolean, default: true },
        create: { type: Boolean, default: true },
        edit: { type: Boolean, default: true },
        delete: { type: Boolean, default: false },
        approve: { type: Boolean, default: true },
      },
    },

    resetOtp: {
      type: String,
      default: "",
    },

    resetOtpExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.model(
    "User",
    userSchema
  );