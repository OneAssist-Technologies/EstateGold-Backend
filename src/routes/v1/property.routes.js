const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();

const {
  createProperty,
  getProperties,
  getNewProjects,
  getPropertiesCompare,
  getPropertyById,
  getSimilarProperties,
  getMyProperties,
  filterProperties,
  searchProperties,
  approveProperty,
  rejectProperty,
  updateProperty,
  deleteProperty,
  updatePropertyStatus,
  requestDelete,
  createPropertyDraft,
  updatePropertyDraft,
  getPropertyDraft,
  deletePropertyDraft,
  getPublicSettings,
} = require("../../controllers/propertyController");

const {
  downloadTemplate,
  validateBulkUpload,
  publishBulkProperties,
  downloadErrorReport,
} = require("../../controllers/bulkPropertyController");

const auth = require("../../../middleware/authMiddleware");
const upload = require("../../../middleware/upload");

// ─── Bulk Upload Routes ───
const bulkUploadMiddleware = upload.fields([
  { name: "excelFile", maxCount: 1 },
  { name: "zipFile", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

router.get("/bulk-upload/template", downloadTemplate);
router.post("/bulk-upload/validate", auth, bulkUploadMiddleware, validateBulkUpload);
router.post("/bulk-upload/publish", auth, bulkUploadMiddleware, publishBulkProperties);
router.post("/bulk-upload/error-report", auth, downloadErrorReport);

// ─── Public property routes ───

// GET /api/v1/properties — List properties (with query filters)
router.get("/", getProperties);

// GET /api/v1/properties/new-projects — List new projects
router.get("/new-projects", getNewProjects);

// GET /api/v1/properties/compare — Compare properties
router.get("/compare", getPropertiesCompare);

// GET /api/v1/properties/search — Search properties
router.get("/search", searchProperties);

// GET /api/v1/properties/filter — Filter properties
router.get("/filter", filterProperties);

// ─── Authenticated property routes ───

// GET /api/v1/properties/mine — Get my properties
router.get("/mine", auth, getMyProperties);

// POST /api/v1/properties — Create property
router.post("/", auth, upload.array("photos", 20), createProperty);

// ─── Drafts ───

// POST /api/v1/properties/drafts — Create draft
router.post("/drafts", auth, upload.array("photos", 20), createPropertyDraft);

// GET /api/v1/properties/drafts/:id — Get draft
router.get("/drafts/:id", auth, getPropertyDraft);

// PUT /api/v1/properties/drafts/:id — Update draft
router.put("/drafts/:id", auth, upload.array("photos", 20), updatePropertyDraft);

// DELETE /api/v1/properties/drafts/:id — Delete draft
router.delete("/drafts/:id", auth, deletePropertyDraft);

// ─── Property actions (by ID) ───

// GET /api/v1/properties/:id/similar — Get similar properties
router.get("/:id/similar", getSimilarProperties);

// PATCH /api/v1/properties/:id/approve — Approve property
router.patch("/:id/approve", approveProperty);

// PATCH /api/v1/properties/:id/reject — Reject property
router.patch("/:id/reject", rejectProperty);

// PATCH /api/v1/properties/:id/status — Update status
router.patch("/:id/status", auth, updatePropertyStatus);

// PATCH /api/v1/properties/:id/request-delete — Request deletion
router.patch("/:id/request-delete", auth, requestDelete);

// ─── Single property CRUD (must come after specific :id/* routes) ───

// GET /api/v1/properties/:id — Get property by ID
router.get("/:id", getPropertyById);

// PUT /api/v1/properties/:id — Update property
router.put("/:id", auth, upload.array("photos", 20), updateProperty);

// DELETE /api/v1/properties/:id — Delete property
router.delete("/:id", deleteProperty);

module.exports = router;
