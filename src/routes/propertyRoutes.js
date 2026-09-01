const express = require("express");
const path = require("path");
const fs = require("fs");

const {
  createProperty,
  getProperties,
  getNewProjects,
  getPropertiesCompare,
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
  requestDelete,
  createPropertyDraft,
  updatePropertyDraft,
  getPropertyDraft,
  deletePropertyDraft,
} = require("../controllers/propertyController");

const {
  downloadTemplate,
  validateBulkUpload,
  publishBulkProperties,
  downloadErrorReport,
} = require("../controllers/bulkPropertyController");

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

// Bulk Upload Endpoints
router.get("/bulk-upload/template", downloadTemplate);
router.get("/api/properties/bulk-upload/template", downloadTemplate);
router.post("/bulk-upload/validate", auth, upload.single("file"), validateBulkUpload);
router.post("/api/properties/bulk-upload/validate", auth, upload.single("file"), validateBulkUpload);
router.post("/bulk-upload/publish", auth, publishBulkProperties);
router.post("/api/properties/bulk-upload/publish", auth, publishBulkProperties);
router.post("/bulk-upload/error-report", auth, downloadErrorReport);
router.post("/api/properties/bulk-upload/error-report", auth, downloadErrorReport);

router.get("/new-projects", getNewProjects);
router.get("/properties/new-projects", getNewProjects);

router.get("/settings", getPublicSettings);
router.get("/api/settings", getPublicSettings);

router.post(
  "/upload-document",
  auth,
  upload.single("document"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    return res.json({
      success: true,
      fileUrl: `/uploads/properties/${req.file.filename}`,
      fileName: req.file.originalname
    });
  }
);

router.get("/view-file/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "../../uploads/properties", filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  res.setHeader("Content-Disposition", "inline");
  return res.sendFile(filePath);
});

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
  "/properties/compare",
  getPropertiesCompare
);

router.post(
  "/properties/draft",
  auth,
  upload.array("photos", 20),
  createPropertyDraft
);

router.put(
  "/properties/draft/:id",
  auth,
  upload.array("photos", 20),
  updatePropertyDraft
);

router.get(
  "/properties/draft/:id",
  auth,
  getPropertyDraft
);

router.delete(
  "/properties/draft/:id",
  auth,
  deletePropertyDraft
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
router.get("/properties/mine", auth, getMyProperties);
router.get("/properties/mine/:userId", auth, getMyProperties);

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

router.put(
  "/properties/:id",
  auth,
  upload.array("photos", 20),
  updateProperty
);

router.delete("/properties/:id", deleteProperty);

router.patch(
  "/my-properties/:id/request-delete",
  auth,
  requestDelete
);

router.patch(
  "/properties/:id/status",
  updatePropertyStatus
);
module.exports = router;