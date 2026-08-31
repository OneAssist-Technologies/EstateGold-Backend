const fs = require("fs");
const {
  parseUploadedFile,
  generateBulkTemplate,
  validateBulkProperties,
  generateErrorReportBuffer,
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
 * Accepts uploaded Excel / CSV file and validates rows independently.
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

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded. Please upload a valid .xlsx or .csv file.",
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

    const rows = parseUploadedFile(req.file);

    // Clean up temporary uploaded file if stored on disk
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        // ignore cleanup error
      }
    }

    const result = await validateBulkProperties(rows, publisherDetails);

    if (!result.success) {
      return res.status(400).json(result);
    }

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
 * Submits pre-validated eligible bulk properties into database.
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

    const { eligibleProperties, publisherDetails } = req.body;

    if (!Array.isArray(eligibleProperties) || eligibleProperties.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No eligible properties provided for publishing.",
      });
    }

    const result = await publishBulkPropertiesService(
      eligibleProperties,
      req.user,
      publisherDetails || {}
    );

    return res.status(201).json(result);
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
    if (!Array.isArray(invalidProperties) || invalidProperties.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No invalid properties provided for error report generation.",
      });
    }

    const buffer = generateErrorReportBuffer(invalidProperties);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="EstateGold_Bulk_Upload_Error_Report.xlsx"'
    );
    return res.send(buffer);
  } catch (err) {
    console.error("Error in downloadErrorReport:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
