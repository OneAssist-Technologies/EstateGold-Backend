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
      state: String,
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

      carpetArea: Number,
      totalFloors: Number,
      plotArea: Number,
      facing: String,
      length: Number,
      width: Number,
      propertyAge: String,
      plotFacing: String,
      roadWidth: Number,
      cornerPlot: Boolean,
      boundaryWall: Boolean,
      plotType: String,
      landApproval: String,
      waterAvailability: String,
      electricityAvailability: String,
      commercialType: String,
      washrooms: Number,
      entranceWidth: Number,
      powerLoad: Number,

      // New dynamic details fields
      superArea: Number,
      lift: Boolean,
      powerBackup: String,
      security: String,
      society: String,
      maintenance: Number,
      frontage: Number,
      compoundWall: Boolean,
      garden: Boolean,
      terrace: Boolean,
      borewell: Boolean,
      electricity: Boolean,
      solar: Boolean,
      community: String,
      privatePool: Boolean,
      servantRoom: Boolean,
      gatedLayout: Boolean,
      drainage: Boolean,
      roadAccess: String,
      gps: String,
      surveyNumber: String,
      subdivisionNumber: String,
      landClassification: String,
      zoning: String,
      taluk: String,
      irrigation: String,
      crops: String,
      soilType: String,
      farmhouse: Boolean,
      pricePerAcre: Number,
      workstations: Number,
      cabins: Number,
      meetingRooms: Number,
      reception: Boolean,
      pantry: Boolean,
      serverRoom: Boolean,
      ac: Boolean,
      internet: Boolean,
      fireSafety: Boolean,
      ceilingHeight: Number,
      mainRoadFacing: Boolean,
      cornerShop: Boolean,
      shutters: Number,
      signboard: Boolean,
      footfallEstimate: String,
      suitableBusiness: String,
      loadingUnloading: Boolean,
      dock: Boolean,
      truckAccess: String,
      storageCapacity: String,
      flooring: String,
      officeArea: Number,
      industrialType: String,
      transformer: Boolean,
      productionArea: Number,
      crane: Boolean,
      workerFacilities: Boolean,
      pollutionCompliance: String,
      machineryIncluded: Boolean,
      numberOfRooms: Number,
      roomTypes: String,
      restaurant: Boolean,
      kitchen: Boolean,
      banquetHall: Boolean,
      gym: Boolean,
      occupancy: String,
      revenue: Number,
      genderType: String,
      totalBeds: Number,
      availableBeds: Number,
      roomSharingType: String,
      rentPerBed: Number,
      deposit: Number,
      foodIncluded: Boolean,
      laundry: Boolean,
      housekeeping: Boolean,
      rules: String,
      projectName: String,
      towers: Number,
      totalUnits: Number,
      availableUnits: Number,
      bhkTypes: String,
      constructionStatus: String,
      possessionDate: Date,
      paymentPlan: String,

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
        enum: ["pending", "approved", "rejected", "draft"],
        default: "pending",
      },
      currentStep: {
        type: Number,
        default: 1,
      },

      availabilityStatus: {
        type: String,
        enum: ["on_sale", "hold", "sold", "rented"],
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

      deleteRequested: {
        type: Boolean,
        default: false,
      },
      deleteRequestedReason: {
        type: String,
        default: "",
      },
      deleteRequestedAt: Date,

      ownerNegotiable: {
        type: Boolean,
        default: false,
      },
      ownerReadyToMeet: {
        type: Boolean,
        default: false,
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
      marketInsight: {
        source: { type: String, default: "AVNESTER" },
        locality: String,
        city: String,
        success: { type: Boolean, default: false },
        supported: { type: Boolean, default: false },
        message: { type: String, default: "" },
        averageLocalityPrice: { type: Number, default: null },
        estimatedPricePerSqft: { type: Number, default: null },
        comparableCount: { type: Number, default: 0 },
        estimatedPropertyValue: { type: Number, default: null },
        confidence: { type: String, default: null },
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
        retrievedAt: Date,
      },
      pendingIssues: {
        hasPendingIssues: { type: String, default: "no" }, // "no", "yes", "not_sure"
        issues: [
          {
            type: { type: String },
            amount: { type: Number, default: 0 },
            description: String,
            expectedResolutionDate: Date,
            supportingDocument: String,
          }
        ]
      },
      documents: [
        {
          documentType: String,
          fileUrl: String,
          fileName: String,
          uploadedAt: { type: Date, default: Date.now },
          verificationStatus: { type: String, default: "Uploaded" }, // "Uploaded", "Verified", "Rejected"
          reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          remarks: String,
          expiryDate: Date,
        }
      ],
      agreementDetails: {
        agreementType: { type: String, default: "" },
        amount: { type: Number, default: 0 },
        advanceAmount: { type: Number, default: 0 },
        securityDeposit: { type: Number, default: 0 },
        duration: { type: String, default: "" },
        startDate: { type: Date, default: null },
        noticePeriod: { type: String, default: "" },
        lockInPeriod: { type: String, default: "" },
        rentEscalation: { type: String, default: "" },
        maintenanceResponsibility: { type: String, default: "" },
        utilitiesResponsibility: { type: String, default: "" },
        parkingDetails: { type: String, default: "" },
        furnishingCondition: { type: String, default: "" },
        additionalTerms: { type: String, default: "" },
      }
    },
    {
      timestamps: true,
    }
  );

module.exports = mongoose.model(
  "Property",
  propertySchema
);