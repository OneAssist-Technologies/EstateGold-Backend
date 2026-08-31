const openai = require("./openaiClient");

/**
 * Deterministic rule-based evaluation of property listing data for Eyva's Tips.
 */
const generateRuleBasedTips = (p) => {
  const recommendations = [];

  const isResidential = ["Apartment / Flat", "Independent House", "Villa", "Builder Floor"].includes(p.propertyType);
  const isPlot = ["Plot / Land", "Residential Plot", "Agricultural Land"].includes(p.propertyType);

  // 1. Documents Evaluation (Essential & Optional Documents)
  const uploadedDocs = p.documents || [];
  const uploadedDocTypes = (Array.isArray(uploadedDocs) ? uploadedDocs : [])
    .map((d) => (typeof d === "string" ? d : d?.documentType))
    .filter(Boolean);

  const missingReqDocs = [];
  const missingOptDocs = [];

  if (!uploadedDocTypes.includes("sale_deed") && !uploadedDocTypes.includes("parent_deeds")) {
    missingReqDocs.push("Sale / Title Deed");
  }
  if (!uploadedDocTypes.includes("encumbrance_certificate")) {
    missingReqDocs.push("Encumbrance Certificate (EC)");
  }
  if (!uploadedDocTypes.includes("owner_kyc")) {
    missingReqDocs.push("Owner KYC Proof");
  }
  if (isPlot && !uploadedDocTypes.includes("patta_records")) {
    missingReqDocs.push("Patta / Revenue Records");
  }

  if (!uploadedDocTypes.includes("tax_receipt")) {
    missingOptDocs.push("Property Tax Receipt");
  }
  if (isResidential && !uploadedDocTypes.includes("building_plan") && !uploadedDocTypes.includes("approved_layout")) {
    missingOptDocs.push("Approved Building Plan");
  }
  if (isResidential && !uploadedDocTypes.includes("completion_occupancy")) {
    missingOptDocs.push("Completion / Occupancy Certificate");
  }
  if (isPlot && !uploadedDocTypes.includes("zoning_documents") && !uploadedDocTypes.includes("layout_approval")) {
    missingOptDocs.push("Land-use / Zoning Approval");
  }

  if (missingReqDocs.length > 0) {
    recommendations.push({
      id: "documents_required",
      category: "documents",
      icon: "documents",
      title: "Upload Verification Documents",
      description: `Essential ownership documents (${missingReqDocs.join(", ")}) are missing. Uploading these accelerates listing verification and buyer confidence.`,
      priority: "high",
      actionLabel: "Upload Documents",
      stepId: "documents",
    });
  } else if (missingOptDocs.length > 0) {
    recommendations.push({
      id: "documents_optional",
      category: "documents",
      icon: "documents",
      title: "Add Optional Property Documents",
      description: `Adding optional documents like ${missingOptDocs.slice(0, 2).join(" or ")} enhances listing transparency and search authority.`,
      priority: "medium",
      actionLabel: "Add Documents",
      stepId: "documents",
    });
  }

  // 2. Missing Property Details Evaluation (Standard & Optional Specs)
  const missingDetails = [];
  if (isResidential) {
    if (!p.facing) missingDetails.push("Facing Direction");
    if (!p.furnishing) missingDetails.push("Furnishing Status");
    if (!p.propertyAge) missingDetails.push("Property Age");
    if (!p.carpetArea) missingDetails.push("Carpet Area");
    if (!p.totalFloors) missingDetails.push("Total Floors");
  } else if (isPlot) {
    if (!p.facing && !p.plotFacing) missingDetails.push("Plot Facing");
    if (!p.roadWidth) missingDetails.push("Road Width");
    if (p.cornerPlot === undefined || p.cornerPlot === null) missingDetails.push("Corner Plot info");
    if (p.boundaryWall === undefined || p.boundaryWall === null) missingDetails.push("Boundary Wall info");
  } else {
    if (!p.carpetArea) missingDetails.push("Carpet Area");
    if (!p.furnishing) missingDetails.push("Furnishing Status");
    if (!p.facing) missingDetails.push("Facing Direction");
  }

  if (missingDetails.length > 0) {
    recommendations.push({
      id: "details",
      category: "details",
      icon: "details",
      title: "Complete Property Details",
      description: `Your listing is missing details like ${missingDetails.slice(0, 3).join(", ")}. Filling these in gives buyers full clarity and improves search filters.`,
      priority: missingDetails.length >= 3 ? "high" : "medium",
      actionLabel: "Add Details",
      stepId: "details",
    });
  }

  // 3. Property Photos (stepId: "price")
  const photoCount = (p.photos || []).length;
  if (photoCount < 4) {
    recommendations.push({
      id: "photos",
      category: "photos",
      icon: "photos",
      title: photoCount === 0 ? "Upload Property Photos" : "Add More Property Photos",
      description:
        photoCount === 0
          ? "Listings with clear photos receive 5x more inquiries. Consider uploading photos of key living areas, kitchen, and exterior."
          : `You've uploaded ${photoCount} ${photoCount === 1 ? "photo" : "photos"}. Adding photos of bedrooms, kitchen, and exterior helps buyers visualize the space.`,
      priority: photoCount === 0 ? "high" : "medium",
      actionLabel: photoCount === 0 ? "Upload Photos" : "Add Photos",
      stepId: "price",
    });
  }

  // 4. Property Description (stepId: "price")
  const desc = (p.description || "").trim();
  if (!desc || desc.length < 80) {
    recommendations.push({
      id: "description",
      category: "description",
      icon: "description",
      title: "Enhance Property Description",
      description:
        desc.length === 0
          ? "Adding a short description highlighting lighting, ventilation, and unique features helps your listing stand out."
          : "Your description is brief. Elaborating on key highlights and neighborhood appeal makes your property more engaging.",
      priority: desc.length === 0 ? "high" : "medium",
      actionLabel: "Edit Description",
      stepId: "price",
    });
  }

  // 5. Location / Nearby Places (stepId: "neighbourhood")
  const nearbyPlaces = p.neighbourhood?.nearbyPlaces || {};
  const enabledNearbyCount = Object.values(nearbyPlaces).filter((place) => place?.enabled).length;
  if (enabledNearbyCount < 2) {
    recommendations.push({
      id: "neighbourhood",
      category: "location",
      icon: "location",
      title: "Highlight Nearby Places",
      description:
        "Adding nearby schools, hospitals, metro stations, or malls makes the location much easier for buyers to evaluate.",
      priority: "medium",
      actionLabel: "Add Landmarks",
      stepId: "neighbourhood",
    });
  }

  // 6. Amenities / Facilities (stepId: "amenities")
  const amenityCount = (p.amenities || []).length;
  if (amenityCount < 3) {
    recommendations.push({
      id: "amenities",
      category: "amenities",
      icon: "amenities",
      title: "Highlight Key Amenities",
      description:
        "Selecting facilities like Security, Power Backup, Lift, or Parking helps buyers searching with specific filters find your property.",
      priority: amenityCount === 0 ? "high" : "low",
      actionLabel: "Add Amenities",
      stepId: "amenities",
    });
  }

  // 7. Pricing Information (stepId: "price")
  if (!p.ownerNegotiable && (!p.maintenance || p.maintenance === 0)) {
    recommendations.push({
      id: "pricing",
      category: "pricing",
      icon: "pricing",
      title: "Specify Pricing Terms",
      description: "Indicating whether the price is negotiable or specifying maintenance details helps set clear buyer expectations.",
      priority: "low",
      actionLabel: "Edit Pricing",
      stepId: "price",
    });
  }

  // Sort recommendations by priority weight (high > medium > low)
  const priorityWeight = { high: 3, medium: 2, low: 1 };
  recommendations.sort((a, b) => (priorityWeight[b.priority] || 1) - (priorityWeight[a.priority] || 1));

  // Limit recommendations to top 6 most relevant suggestions
  const topRecommendations = recommendations.slice(0, 6);

  // Generate concise final Eyva recommendation summary based on findings
  let finalRecommendation = "";
  if (topRecommendations.length === 0) {
    finalRecommendation =
      "Excellent job! Your property listing is rich with details, photos, documents, and location highlights. It is well-optimized to attract potential buyers.";
  } else {
    const categories = topRecommendations.map((r) => r.category);
    if (categories.includes("documents") && categories.includes("details")) {
      finalRecommendation =
        "Uploading essential ownership documents and filling in missing property details like facing and carpet area will maximize buyer trust and listing engagement.";
    } else if (categories.includes("documents")) {
      finalRecommendation =
        "Uploading verification documents like Sale Deed or EC is the best way to get your listing verified fast and build buyer confidence.";
    } else if (categories.includes("photos") && categories.includes("location")) {
      finalRecommendation =
        "Your property has essential details covered. Adding more photos and nearby landmark information could make your listing more informative and attractive to potential buyers.";
    } else if (categories.includes("photos")) {
      finalRecommendation =
        "Adding clear photos of key areas is the single best way to make your property listing stand out and attract serious inquiries.";
    } else if (categories.includes("details")) {
      finalRecommendation =
        "Completing optional property specifications like facing direction, property age, and carpet area helps serious buyers evaluate your listing.";
    } else {
      finalRecommendation =
        "Providing a few more optional details like nearby landmarks, documents, and amenities will help potential buyers feel confident contacting you.";
    }
  }

  return {
    success: true,
    summary: "Your listing is almost ready. Eyva found a few key areas to make it more complete and trustworthy.",
    recommendations: topRecommendations,
    finalRecommendation,
    fallback: true,
  };
};

let isAILimitReached = false;

/**
 * Eyva Property Tips Generator
 * @param {Object} propertyPayload 
 * @returns {Promise<Object>}
 */
const generatePropertyTips = async (propertyPayload) => {
  const ruleResult = generateRuleBasedTips(propertyPayload);

  if (isAILimitReached || !process.env.OPENAI_API_KEY) {
    return ruleResult;
  }

  try {
    const promptMessage = `
Analyze the following property listing data that a user is about to publish:
- Property Type: ${propertyPayload.propertyType || "N/A"}
- Purpose: ${propertyPayload.purpose || "N/A"}
- City: ${propertyPayload.city || "N/A"}, Locality: ${propertyPayload.locality || "N/A"}
- Photos Count: ${(propertyPayload.photos || []).length}
- Documents Uploaded: ${(propertyPayload.documents || []).map(d => typeof d === 'string' ? d : d?.documentType).join(", ") || "None"}
- Description Length: ${(propertyPayload.description || "").length} chars
- Facing: ${propertyPayload.facing || "N/A"}
- Furnishing: ${propertyPayload.furnishing || "N/A"}
- Property Age: ${propertyPayload.propertyAge || "N/A"}
- Carpet Area: ${propertyPayload.carpetArea || "N/A"}
- Amenities Count: ${(propertyPayload.amenities || []).length}
- Nearby Places Configured: ${Object.keys(propertyPayload.neighbourhood?.nearbyPlaces || {}).filter(k => propertyPayload.neighbourhood?.nearbyPlaces[k]?.enabled).join(", ") || "None"}
- Price: ${propertyPayload.price || "N/A"}

Rule Recommendations Identified: ${JSON.stringify(ruleResult.recommendations)}

Generate a JSON object with:
- "summary": A polite warm opening summary sentence (e.g. "Your listing is almost ready. Eyva found a few key ways you can make it more complete.")
- "recommendations": Array of 2 to 6 objects (keep the exact structure: id, category, icon, title, description, priority, actionLabel, stepId). Ensure missing documents and missing property details are included with encouraging consultative language.
- "finalRecommendation": A concise 1-2 sentence concluding summary advice highlighting missing documents and property details if applicable.

Output ONLY valid JSON without markdown tags.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Eyva, EstateGold's real estate AI assistant. You evaluate draft property listings and provide 2-6 encouraging tips focusing on missing documents, missing property details, photos, amenities, and location.",
        },
        { role: "user", content: promptMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    if (parsed && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
      return {
        success: true,
        summary: parsed.summary || ruleResult.summary,
        recommendations: parsed.recommendations.slice(0, 6),
        finalRecommendation: parsed.finalRecommendation || ruleResult.finalRecommendation,
        fallback: false,
      };
    }

    return ruleResult;
  } catch (err) {
    if (err.status === 429 || (err.message && (err.message.includes("quota") || err.message.includes("429")))) {
      isAILimitReached = true;
      console.warn("Eyva Tips OpenAI rate limited/quota exceeded. Falling back to rule-based evaluation silently.");
    } else {
      console.warn("Eyva Tips OpenAI call failed, using rule-based evaluation:", err.message);
    }
    return ruleResult;
  }
};

module.exports = {
  generatePropertyTips,
  generateRuleBasedTips,
};

