const express = require("express");
const router = express.Router();

const {
  createEnquiry,
  getPropertyEnquiries,
  updateEnquiryStatus,
  getMyAllEnquiries,
} = require("../../controllers/enquiryController");

const auth = require("../../../middleware/authMiddleware");

// POST /api/v1/enquiries — Submit an enquiry/callback request
router.post("/", auth, createEnquiry);

// GET /api/v1/enquiries/mine — Get all enquiries for logged-in owner's properties
router.get("/mine", auth, getMyAllEnquiries);

// GET /api/v1/enquiries?propertyId=:id — Get enquiries for a specific property
router.get("/property/:propertyId", auth, getPropertyEnquiries);

// PATCH /api/v1/enquiries/:id — Update enquiry status
router.patch("/:id", auth, updateEnquiryStatus);

module.exports = router;
