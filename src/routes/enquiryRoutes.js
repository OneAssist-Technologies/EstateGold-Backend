const express = require("express");
const router = express.Router();
const auth = require("../../middleware/authMiddleware");
const {
  createEnquiry,
  getPropertyEnquiries,
  updateEnquiryStatus,
  getMyAllEnquiries,
} = require("../controllers/enquiryController");

// Submit a callback request (authenticated)
router.post("/callback-request", auth, createEnquiry);

// Retrieve all enquiries/callback requests for a property listing (authenticated, listing owner only)
router.get("/properties/:propertyId/enquiries", auth, getPropertyEnquiries);

// Retrieve all enquiries for all properties of the logged-in owner
router.get("/my-enquiries", auth, getMyAllEnquiries);

// Update an enquiry status (authenticated, listing owner only)
router.patch("/enquiries/:enquiryId", auth, updateEnquiryStatus);

module.exports = router;
