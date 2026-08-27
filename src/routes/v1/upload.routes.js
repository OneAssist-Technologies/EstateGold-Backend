const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();

const auth = require("../../../middleware/authMiddleware");
const upload = require("../../../middleware/upload");

// POST /api/v1/uploads/documents — Upload a document
router.post(
  "/documents",
  auth,
  upload.single("document"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    return res.json({
      success: true,
      fileUrl: `/uploads/properties/${req.file.filename}`,
      fileName: req.file.originalname,
    });
  }
);

// GET /api/v1/uploads/documents/:filename — View/download a document
router.get("/documents/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "../../../uploads/properties", filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  res.setHeader("Content-Disposition", "inline");
  return res.sendFile(filePath);
});

module.exports = router;
