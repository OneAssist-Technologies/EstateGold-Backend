const openai = require("./openaiClient");
const { systemPrompt, userPrompt } = require("../../prompts/healthScore.prompt");

const getRequiredChecklist = (propertyType) => {
  switch (propertyType) {
    case "Apartment / Flat":
    case "Builder Floor":
      return [
        { type: "sale_deed", label: "Sale Deed" },
        { type: "parent_deeds", label: "Parent / Previous Title Documents" },
        { type: "encumbrance_certificate", label: "Encumbrance Certificate" },
        { type: "tax_receipt", label: "Property Tax Receipt" },
        { type: "building_plan", label: "Approved Building Plan" },
        { type: "completion_occupancy", label: "Completion / Occupancy Certificate" },
        { type: "society_documents", label: "Apartment / Society Documents" },
        { type: "possession_allotment", label: "Possession / Allotment Document" },
        { type: "owner_kyc", label: "Owner KYC / ID" },
      ];
    case "Independent House":
    case "Villa":
      return [
        { type: "sale_deed", label: "Sale Deed" },
        { type: "parent_deeds", label: "Parent / Title Documents" },
        { type: "encumbrance_certificate", label: "Encumbrance Certificate" },
        { type: "tax_receipt", label: "Property Tax Receipt" },
        { type: "building_plan", label: "Approved Building Plan" },
        { type: "building_approval", label: "Building Approval" },
        { type: "completion_occupancy", label: "Completion / Occupancy Documents" },
        { type: "survey_sketch", label: "Survey / Sketch" },
        { type: "owner_kyc", label: "Owner KYC" },
      ];
    default:
      return [
        { type: "sale_deed", label: "Sale Deed / Title Deed" },
        { type: "parent_deeds", label: "Parent Deeds / Title Documents" },
        { type: "encumbrance_certificate", label: "Encumbrance Certificate" },
        { type: "tax_receipt", label: "Property Tax Receipt" },
        { type: "owner_kyc", label: "Owner KYC" },
      ];
  }
};

const generateFallbackHealthScore = (property, checklist) => {
  const docs = property.documents || [];
  let score = 0;
  
  const checklistFeedback = checklist.map((reqDoc) => {
    const uploaded = docs.find((d) => d.documentType === reqDoc.type);
    let status = "Missing";
    let remark = `${reqDoc.label} is currently not uploaded.`;
    
    if (uploaded) {
      if (uploaded.verificationStatus === "Verified") {
        status = "Verified";
        remark = `${reqDoc.label} has been successfully verified.`;
        if (reqDoc.type === "sale_deed") score += 40;
        else if (reqDoc.type === "parent_deeds") score += 25;
        else if (reqDoc.type === "encumbrance_certificate") score += 20;
        else if (reqDoc.type === "tax_receipt") score += 10;
        else score += 5;
      } else if (uploaded.verificationStatus === "Rejected") {
        status = "Rejected";
        remark = `${reqDoc.label} verification failed. Remarks: ${uploaded.remarks || "Please re-upload a clear file."}`;
      } else {
        status = "Uploaded (Pending Review)";
        remark = `${reqDoc.label} is uploaded and awaiting review.`;
        if (reqDoc.type === "sale_deed") score += 20;
        else if (reqDoc.type === "parent_deeds") score += 12;
        else if (reqDoc.type === "encumbrance_certificate") score += 10;
        else if (reqDoc.type === "tax_receipt") score += 5;
        else score += 2;
      }
    }

    return {
      name: reqDoc.label,
      status,
      remark
    };
  });

  let statusText = "Critical";
  if (score >= 90) statusText = "Excellent";
  else if (score >= 75) statusText = "Good";
  else if (score >= 50) statusText = "Fair";

  const saleDeedUploaded = docs.find((d) => d.documentType === "sale_deed");
  const parentDeedUploaded = docs.find((d) => d.documentType === "parent_deeds");
  
  const criticalDocumentsMissing = 
    !saleDeedUploaded || saleDeedUploaded.verificationStatus === "Rejected" ||
    !parentDeedUploaded || parentDeedUploaded.verificationStatus === "Rejected";

  const suggestions = [];
  checklistFeedback.forEach((fb) => {
    if (fb.status === "Missing") {
      suggestions.push(`Please upload the missing ${fb.name} document to improve credibility.`);
    } else if (fb.status === "Rejected") {
      suggestions.push(`Your uploaded ${fb.name} was rejected. Please upload a valid replacement.`);
    }
  });

  if (suggestions.length === 0) {
    suggestions.push("All required documents are uploaded. Your property verification is in excellent state!");
  }

  return {
    success: true,
    healthScore: Math.min(score, 100),
    status: statusText,
    criticalDocumentsMissing,
    checklistFeedback,
    suggestions,
    fallback: true
  };
};

/**
 * Generate AI-based property verification health analysis and score.
 * @param {Object} property 
 * @returns {Promise<Object>} healthScore, status, feedback, suggestions
 */
const calculateHealthScore = async (property) => {
  const checklist = getRequiredChecklist(property.propertyType);
  try {
    const userMsg = userPrompt(property, checklist);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);
    return {
      success: true,
      healthScore: parsed.healthScore || 0,
      status: parsed.status || "Critical",
      criticalDocumentsMissing: parsed.criticalDocumentsMissing ?? true,
      checklistFeedback: parsed.checklistFeedback || [],
      suggestions: parsed.suggestions || [],
      fallback: false
    };
  } catch (err) {
    console.warn("AI Health Score failed, falling back to rule-based evaluation:", err.message);
    return generateFallbackHealthScore(property, checklist);
  }
};

module.exports = {
  calculateHealthScore,
};
