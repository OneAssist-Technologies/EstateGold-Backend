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

    deletedReason: {
      type: String,
      default: "",
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