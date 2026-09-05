/**
 * Formats a Date object or date string into DD-MM-YYYY format required by CRM.
 */
function formatDateToDDMMYYYY(dateInput) {
  if (!dateInput) return "";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      const parts = String(dateInput).split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}-${parts[0]}`;
        }
        return `${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}-${parts[2]}`;
      }
      return String(dateInput);
    }
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (err) {
    return String(dateInput);
  }
}

/**
 * Maps EstateGold Loan Enquiry Form DTO to standard CRM Payload contract.
 */
function mapLoanEnquiryToCrmPayload(data, propertyContext = {}) {
  const isSameAddress =
    data.sameAsPresentAddress === true ||
    data.sameAsPresentAddress === "true" ||
    data.sameAsPresentAddress === "Yes";

  const presentAddressLine1 = (data.presentAddressLine1 || "").trim();
  const presentAddressLine2 = (data.presentAddressLine2 || "").trim();
  const presentCity = (data.presentCity || "").trim();
  const presentState = (data.presentState || "").trim();
  const presentPincode = (data.presentPincode || "").trim();
  const presentCountry = (data.presentCountry || "India").trim();

  const permanentAddressLine1 = isSameAddress
    ? presentAddressLine1
    : (data.permanentAddressLine1 || "").trim();
  const permanentAddressLine2 = isSameAddress
    ? presentAddressLine2
    : (data.permanentAddressLine2 || "").trim();
  const permanentCity = isSameAddress ? presentCity : (data.permanentCity || "").trim();
  const permanentState = isSameAddress ? presentState : (data.permanentState || "").trim();
  const permanentPincode = isSameAddress ? presentPincode : (data.permanentPincode || "").trim();
  const permanentCountry = isSameAddress ? presentCountry : (data.permanentCountry || "India").trim();

  // Combine property and loan context into rich remarks string
  const contextNotes = [];
  contextNotes.push("EstateGold Home Loan Enquiry");
  if (propertyContext.propertyId || data.propertyId) {
    contextNotes.push(`Property ID: ${propertyContext.propertyId || data.propertyId}`);
  }
  if (propertyContext.propertyTitle || data.propertyTitle) {
    contextNotes.push(`Property: ${propertyContext.propertyTitle || data.propertyTitle}`);
  }
  if (propertyContext.propertyPrice || data.propertyPrice) {
    const p = Number(propertyContext.propertyPrice || data.propertyPrice);
    contextNotes.push(`Property Price: ₹${p.toLocaleString("en-IN")}`);
  }
  if (propertyContext.loanAmount || data.loanAmount) {
    const l = Number(propertyContext.loanAmount || data.loanAmount);
    contextNotes.push(`Requested Loan Amount: ₹${l.toLocaleString("en-IN")}`);
  }
  if (propertyContext.interestRate || data.interestRate) {
    contextNotes.push(`Interest Rate: ${propertyContext.interestRate || data.interestRate}% p.a.`);
  }
  if (propertyContext.tenureYears || data.tenureYears) {
    contextNotes.push(`Tenure: ${propertyContext.tenureYears || data.tenureYears} Years`);
  }
  if (propertyContext.emi || data.emi) {
    const e = Number(propertyContext.emi || data.emi);
    contextNotes.push(`Estimated Monthly EMI: ₹${e.toLocaleString("en-IN")}`);
  }
  if (data.remarks && data.remarks.trim()) {
    contextNotes.push(`User Remarks: ${data.remarks.trim()}`);
  }

  return {
    // 1. Personal Details
    firstName: (data.firstName || "").trim(),
    lastName: (data.lastName || "").trim(),
    mobileNumber: (data.mobileNumber || "").replace(/\D/g, "").slice(0, 10),
    email: (data.email || "").trim().toLowerCase(),
    dateOfBirth: formatDateToDDMMYYYY(data.dateOfBirth),
    gender: (data.gender || "Male").trim(),
    dependents: data.dependents !== undefined && data.dependents !== null && data.dependents !== ""
      ? Math.max(0, parseInt(data.dependents, 10) || 0)
      : 0,
    educationalQualification: (data.educationalQualification || "Graduate").trim(),

    // 2. Present Address
    presentAddressLine1,
    presentAddressLine2,
    presentCity,
    presentState,
    presentPincode,
    presentCountry,

    // 3. Permanent Address
    sameAsPresentAddress: isSameAddress,
    permanentAddressLine1,
    permanentAddressLine2,
    permanentCity,
    permanentState,
    permanentPincode,
    permanentCountry,

    // 4. Additional Information & Context
    remarks: contextNotes.join("\n"),

    // MANDATORY CRM Assignment Metadata (Unassigned Contact)
    source: "EstateGold",
    assignmentStatus: "unassigned",
    assignedUserId: null,
    assignedTo: null,
    status: "unassigned",
    createdAt: new Date().toISOString(),
  };
}

/**
 * Sends mapped loan enquiry payload to external CRM Webhook/API using native fetch.
 */
async function sendToCrmWebhook(crmPayload) {
  const crmWebhookUrl = process.env.CRM_WEBHOOK_URL;
  const crmWebhookSecret = process.env.CRM_WEBHOOK_SECRET;

  if (!crmWebhookUrl) {
    console.warn("CRM Warning: CRM_WEBHOOK_URL is not configured in backend environment.");
    return {
      success: true,
      delivered: false,
      message: "Enquiry stored successfully. CRM webhook URL pending configuration.",
    };
  }

  try {
    console.log(`[CRM Integration] Submitting UNASSIGNED loan enquiry lead to CRM webhook: ${crmWebhookUrl}`);

    const headers = {
      "Content-Type": "application/json",
    };

    if (crmWebhookSecret) {
      headers["X-CRM-Secret"] = crmWebhookSecret;
      headers["Authorization"] = `Bearer ${crmWebhookSecret}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(crmWebhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(crmPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log(`[CRM Integration] CRM Webhook responded with status ${response.status}`);

    let responseData = {};
    try {
      responseData = await response.json();
    } catch (e) {
      responseData = {};
    }

    if (response.ok) {
      return {
        success: true,
        delivered: true,
        statusCode: response.status,
        data: responseData,
      };
    } else {
      const isDuplicate =
        response.status === 409 ||
        (responseData && responseData.message && String(responseData.message).toLowerCase().includes("duplicate"));

      return {
        success: false,
        delivered: false,
        isDuplicate,
        statusCode: response.status,
        error: responseData.message || `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    console.error(`[CRM Integration Error] Failed to dispatch payload to CRM:`, error.message);

    return {
      success: false,
      delivered: false,
      isDuplicate: false,
      statusCode: "NETWORK_ERROR",
      error: error.message,
    };
  }
}

module.exports = {
  mapLoanEnquiryToCrmPayload,
  sendToCrmWebhook,
};
