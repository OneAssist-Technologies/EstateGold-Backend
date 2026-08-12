const express = require("express");

const {
  createProperty,
  getProperties,
  getPropertyById,
  getSimilarProperties,
  getMyProperties,
  getMyPublishedCount,
  filterProperties,
  searchProperties,
  approveProperty,
  rejectProperty,
  updateProperty,
  deleteProperty,
  updatePropertyStatus,
  getPublicSettings,
} = require("../controllers/propertyController");

const upload=
  require(
    "../../middleware/upload"
  );
  const auth =
  require(
    "../../middleware/authMiddleware"
  );

const router =
  express.Router();

router.get("/settings", getPublicSettings);
router.get("/api/settings", getPublicSettings);

router.post(
  "/createproperty",
  auth,
  upload.array(
    "photos",
    20
  ),
  createProperty
);

router.get(
  "/properties",
  getProperties
);

router.get(
  "/my-published-count",
  auth,
  getMyPublishedCount
);

router.get(
  "/properties/similar/:id",
  getSimilarProperties
);

router.get(
  "/properties/:id",
  getPropertyById
);

router.get(
  "/my-properties/:userId",
  auth,
  getMyProperties
);

router.get(
  "/my-properties",
  auth,
  getMyProperties
);

router.get(
  "/search-properties",
  searchProperties
);

router.get(
  "/filter-properties",
  filterProperties
);

router.patch(
  "/approve-property/:id",
  approveProperty
);

router.patch(
  "/reject-property/:id",
  rejectProperty
);

router.put("/properties/:id", updateProperty);

router.delete("/properties/:id", deleteProperty);

router.patch(
  "/properties/:id/status",
  updatePropertyStatus
);
module.exports = router;