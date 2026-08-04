const express = require("express");

const {
  createProperty,
  getProperties,
  getPropertyById,
  getMyProperties,
  filterProperties,
  searchProperties,
  approveProperty,
  rejectProperty,
  updateProperty,
  deleteProperty,
  updatePropertyStatus,
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
  "/properties/:id",
  getPropertyById
);

router.get(
  "/my-properties/:userId",
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
router.get("/my-properties", getMyProperties);

router.put("/properties/:id", updateProperty);

router.delete("/properties/:id", deleteProperty);

router.patch(
  "/properties/:id/status",
  updatePropertyStatus
);
module.exports = router;