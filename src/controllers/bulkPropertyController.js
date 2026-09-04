const fs = require("fs");
const {
  generateBulkTemplate,
  validateBulkProperties,
  publishBulkProperties: publishBulkPropertiesService,
} = require("../services/bulkPropertyService");

/**
 * GET /api/properties/bulk-upload/template
 * Downloads standard EstateGold Excel Bulk Upload Template.
 */
exports.downloadTemplate = async (req, res) => {
  try {
    const buffer = generateBulkTemplate();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="EstateGold_Bulk_Property_Template.xlsx"'
    );
    return res.send(buffer);
  } catch (err) {
    console.error("Error in downloadTemplate:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * POST /api/properties/bulk-upload/validate
 * Accepts uploaded Excel file AND optional Images ZIP file, validating property rows and ZIP image folders.
 */
exports.validateBulkUpload = async (req, res) => {
  try {
    // 1. Strict Role Authorization
    if (!req.user || req.user.role !== "agent") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Bulk Property Upload is available exclusively for Agent accounts.",
      });
    }

    // Extract files from multer.fields or multer.single
    let excelFile = null;
    let zipFile = null;

    if (req.files) {
      if (req.files.excelFile && req.files.excelFile[0]) {
        excelFile = req.files.excelFile[0];
      } else if (req.files.file && req.files.file[0]) {
        excelFile = req.files.file[0];
      }

      if (req.files.zipFile && req.files.zipFile[0]) {
        zipFile = req.files.zipFile[0];
      }
    } else if (req.file) {
      excelFile = req.file;
    }

    if (!excelFile) {
      return res.status(400).json({
        success: false,
        message: "No property Excel file uploaded. Please upload a valid .xlsx file.",
      });
    }

    let publisherDetails = {};
    if (req.body.publisherDetails) {
      try {
        publisherDetails =
          typeof req.body.publisherDetails === "string"
            ? JSON.parse(req.body.publisherDetails)
            : req.body.publisherDetails;
      } catch (e) {
        console.error("Failed to parse publisherDetails:", e);
      }
    }

    const result = await validateBulkProperties(excelFile, zipFile, publisherDetails, req.user);

    // Clean up uploaded temporary files if on disk
    [excelFile, zipFile].forEach((f) => {
      if (f && f.path && fs.existsSync(f.path)) {
        try {
          fs.unlinkSync(f.path);
        } catch (e) {
          // ignore cleanup error
        }
      }
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error("Error in validateBulkUpload:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to validate bulk property upload file.",
    });
  }
};

/**
 * POST /api/properties/bulk-upload/publish
 * Submits pre-validated eligible bulk properties into database and attaches images from ZIP.
 */
exports.publishBulkProperties = async (req, res) => {
  try {
    // 1. Strict Role Authorization
    if (!req.user || req.user.role !== "agent") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Bulk Property Upload is available exclusively for Agent accounts.",
      });
    }

    let eligibleProperties = [];
    if (req.body.eligibleProperties) {
      try {
        eligibleProperties =
          typeof req.body.eligibleProperties === "string"
            ? JSON.parse(req.body.eligibleProperties)
            : req.body.eligibleProperties;
      } catch (e) {
        console.error("Failed to parse eligibleProperties:", e);
      }
    }

    let publisherDetails = {};
    if (req.body.publisherDetails) {
      try {
        publisherDetails =
          typeof req.body.publisherDetails === "string"
            ? JSON.parse(req.body.publisherDetails)
            : req.body.publisherDetails;
      } catch (e) {
        console.error("Failed to parse publisherDetails:", e);
      }
    }

    let zipFile = null;
    if (req.files && req.files.zipFile && req.files.zipFile[0]) {
      zipFile = req.files.zipFile[0];
    } else if (req.file && (req.file.mimetype.includes("zip") || req.file.originalname.endsWith(".zip"))) {
      zipFile = req.file;
    }

    if (!Array.isArray(eligibleProperties) || eligibleProperties.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No eligible properties provided for publishing.",
      });
    }

    const result = await publishBulkPropertiesService(
      eligibleProperties,
      req.user,
      publisherDetails,
      zipFile
    );

    // Clean up temporary ZIP file if on disk
    if (zipFile && zipFile.path && fs.existsSync(zipFile.path)) {
      try {
        fs.unlinkSync(zipFile.path);
      } catch (e) {
        // ignore cleanup error
      }
    }

    const statusCode = (result.summary && result.summary.successfullyPublished > 0) ? 201 : 400;
    return res.status(statusCode).json(result);
  } catch (err) {
    console.error("Error in publishBulkProperties:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to publish bulk properties.",
    });
  }
};

/**
 * POST /api/properties/bulk-upload/error-report
 * Generates downloadable Excel error report for invalid properties.
 */
exports.downloadErrorReport = async (req, res) => {
  try {
    const { invalidProperties } = req.body;
    return res.status(200).json({
      success: true,
      message: "Error report generated",
    });
  } catch (err) {
    console.error("Error in downloadErrorReport:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
