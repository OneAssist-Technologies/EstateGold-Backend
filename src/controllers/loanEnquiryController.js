const { mapLoanEnquiryToCrmPayload, sendToCrmWebhook } = require("../services/crmService");

/**
 * Handles Loan Enquiry submission from EstateGold Frontend
 * Path: POST /api/v1/loan-enquiries
 */
exports.createLoanEnquiry = async (req, res) => {
  try {
    const data = req.body || {};

    // 1. Mandatory Personal Details Validation
    const firstName = (data.firstName || "").trim();
    const lastName = (data.lastName || "").trim();
    const mobileNumber = (data.mobileNumber || "").replace(/\D/g, "");
    const dateOfBirth = (data.dateOfBirth || "").trim();
    const gender = (data.gender || "").trim();
    const educationalQualification = (data.educationalQualification || "").trim();

    if (!firstName) {
      return res.status(400).json({ success: false, message: "First Name is required." });
    }
    if (!lastName) {
      return res.status(400).json({ success: false, message: "Last Name is required." });
    }
    if (!mobileNumber || mobileNumber.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "Mobile Number must be exactly 10 digits.",
      });
    }
    if (data.email && data.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email.trim())) {
        return res.status(400).json({ success: false, message: "Please enter a valid email address." });
      }
    }
    if (!dateOfBirth) {
      return res.status(400).json({ success: false, message: "Date of Birth is required." });
    }
    if (!gender) {
      return res.status(400).json({ success: false, message: "Gender selection is required." });
    }
    if (!educationalQualification) {
      return res.status(400).json({ success: false, message: "Educational Qualification is required." });
    }

    // 2. Mandatory Present Address Validation
    const presentAddressLine1 = (data.presentAddressLine1 || "").trim();
    const presentCity = (data.presentCity || "").trim();
    const presentState = (data.presentState || "").trim();
    const presentPincode = (data.presentPincode || "").replace(/\D/g, "");
    const presentCountry = (data.presentCountry || "India").trim();

    if (!presentAddressLine1) {
      return res.status(400).json({ success: false, message: "Present Address Line 1 is required." });
    }
    if (!presentCity) {
      return res.status(400).json({ success: false, message: "Present City is required." });
    }
    if (!presentState) {
      return res.status(400).json({ success: false, message: "Present State is required." });
    }
    if (!presentPincode || presentPincode.length !== 6) {
      return res.status(400).json({
        success: false,
        message: "Present Pincode must be exactly 6 digits.",
      });
    }
    if (!presentCountry) {
      return res.status(400).json({ success: false, message: "Present Country is required." });
    }

    // 3. Permanent Address Validation (if Same as Present is No)
    const isSameAddress =
      data.sameAsPresentAddress === true ||
      data.sameAsPresentAddress === "true" ||
      data.sameAsPresentAddress === "Yes";

    if (!isSameAddress) {
      const permanentAddressLine1 = (data.permanentAddressLine1 || "").trim();
      const permanentCity = (data.permanentCity || "").trim();
      const permanentState = (data.permanentState || "").trim();
      const permanentPincode = (data.permanentPincode || "").replace(/\D/g, "");
      const permanentCountry = (data.permanentCountry || "India").trim();

      if (!permanentAddressLine1) {
        return res.status(400).json({ success: false, message: "Permanent Address Line 1 is required." });
      }
      if (!permanentCity) {
        return res.status(400).json({ success: false, message: "Permanent City is required." });
      }
      if (!permanentState) {
        return res.status(400).json({ success: false, message: "Permanent State is required." });
      }
      if (!permanentPincode || permanentPincode.length !== 6) {
        return res.status(400).json({
          success: false,
          message: "Permanent Pincode must be exactly 6 digits.",
        });
      }
      if (!permanentCountry) {
        return res.status(400).json({ success: false, message: "Permanent Country is required." });
      }
    }

    // 4. Map DTO to CRM Payload
    const propertyContext = {
      propertyId: data.propertyId || "",
      propertyTitle: data.propertyTitle || "",
      propertyPrice: data.propertyPrice || "",
      loanAmount: data.loanAmount || "",
      interestRate: data.interestRate || "",
      tenureYears: data.tenureYears || "",
      emi: data.emi || "",
    };

    const crmPayload = mapLoanEnquiryToCrmPayload(data, propertyContext);

    // 5. Send to CRM Webhook
    const crmResult = await sendToCrmWebhook(crmPayload);

    if (crmResult.isDuplicate) {
      return res.status(409).json({
        success: false,
        message: "A loan enquiry with this mobile number already exists in our system.",
      });
    }

    if (!crmResult.success && crmResult.error) {
      return res.status(502).json({
        success: false,
        message: "Unable to submit your enquiry right now. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Your loan enquiry has been submitted successfully. Our team will contact you shortly.",
    });
  } catch (error) {
    console.error("[Loan Enquiry Error]", error);
    return res.status(500).json({
      success: false,
      message: "Unable to submit your enquiry right now. Please try again.",
    });
  }
};
