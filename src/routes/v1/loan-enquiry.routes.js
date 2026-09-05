const express = require("express");
const router = express.Router();
const { createLoanEnquiry } = require("../../controllers/loanEnquiryController");

// POST /api/v1/loan-enquiries — Submit loan enquiry to CRM
router.post("/", createLoanEnquiry);

module.exports = router;
