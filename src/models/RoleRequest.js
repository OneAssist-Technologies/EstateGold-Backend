const mongoose = require("mongoose");

const roleRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    currentRole: {
      type: String,
      enum: ["buyer", "seller", "agent", "none"],
      default: "buyer",
    },
    requestedRole: {
      type: String,
      enum: ["seller", "agent"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reason: {
      type: String,
      default: "",
    },
    experience: {
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
    documents: [
      {
        name: { type: String, default: "" },
        url: { type: String, default: "" },
      },
    ],
    rejectionReason: {
      type: String,
      default: "",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("RoleRequest", roleRequestSchema);
