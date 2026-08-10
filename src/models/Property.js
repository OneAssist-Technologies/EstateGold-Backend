const mongoose = require("mongoose");

const propertySchema =
  new mongoose.Schema(
    {
      purpose: {
        type: String,
        required: true,
      },

      propertyType: {
        type: String,
        required: true,
      },

      ownerName: String,
      ownerPhone: String,
      ownerEmail: String,

      ownerType: String,
      agentRelation: String,
      ownerIdType: String,
      ownerIdNumber: String,
      ownerGovtIdDoc: String,
      ownerAddress: String,

      listingType: {
        type: String,
        enum: ["my_own", "another_owner"],
        default: "my_own",
      },

      city: String,
      locality: String,
      society: String,
      address: String,
      latitude: Number,
      longitude: Number,
      serviceableAreaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Location",
      },

      bedrooms: Number,
      bathrooms: Number,


      area: Number,
balconies: {
  type: Number,
  default: 0,
},

floor: {
  type: Number,
  default: 0,
},
      furnishing: String,
      parking: Boolean,

      amenities: [String],

      price: Number,
      description: String,

      availableFrom: Date,

      photos: [String],
      neighbourhood: {
  nearbyPlaces: {
    school: {
      enabled: Boolean,
      name: String,
      distance: String,
    },

    college: {
      enabled: Boolean,
      name: String,
      distance: String,
    },

    hospital: {
      enabled: Boolean,
      name: String,
      distance: String,
    },

    metro: {
      enabled: Boolean,
      name: String,
      distance: String,
    },

    busStand: {
      enabled: Boolean,
      name: String,
      distance: String,
    },

    airport: {
      enabled: Boolean,
      name: String,
      distance: String,
    },

    park: {
      enabled: Boolean,
      name: String,
      distance: String,
    },

    mall: {
      enabled: Boolean,
      name: String,
      distance: String,
    },

    temple: {
      enabled: Boolean,
      name: String,
      distance: String,
    },
  },

  landmarks: [
    {
      name: String,
      distance: String,
    },
  ],

  ratings: {
    connectivity: {
      type: Number,
      default: 0,
    },

    safety: {
      type: Number,
      default: 0,
    },

    powerSupply: {
      type: Number,
      default: 0,
    },

    waterSupply: {
      type: Number,
      default: 0,
    },

    noiseLevel: {
      type: Number,
      default: 0,
    },

    internet: {
      type: Number,
      default: 0,
    },

    greenery: {
      type: Number,
      default: 0,
    },
  },

  notes: String,
},

      role: {
        type: String,
        enum: [
          "seller",
          "agent",
        ],
      },

      ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },

      createdBy: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      status: {
  type: String,
  enum: ["pending", "approved", "rejected"],
  default: "pending",
},

      availabilityStatus: {
        type: String,
        enum: ["on_sale", "hold", "sold"],
        default: "on_sale",
      },

reviewedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
},

reviewedAt: Date,

rejectReason: {
  type: String,
  default: "",
},

isDeleted: {
  type: Boolean,
  default: false,
},

deletedReason: {
  type: String,
  default: "",
},

deletedAt: Date,

deletedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
},
    },
    {
      timestamps: true,
    }
  );

module.exports = mongoose.model(
  "Property",
  propertySchema
);