const openai = require("./openaiClient");

/**
 * Deterministic rule-based evaluation of property listing data for Eyva's Tips.
 */
const generateRuleBasedTips = (p) => {
  const recommendations = [];

  // 1. Property Photos (stepId: "price")
  const photoCount = (p.photos || []).length;
  if (photoCount < 4) {
    recommendations.push({
      id: "photos",
      category: "photos",
      icon: "📸",
      title: photoCount === 0 ? "Upload Property Photos" : "Add More Property Photos",
      description:
        photoCount === 0
          ? "Listings with clear photos receive 5x more inquiries. Consider uploading photos of key living areas."
          : `You've uploaded ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}. Adding a few clear photos of kitchen, bedrooms, and exterior helps buyers visualize the space.`,
      priority: photoCount === 0 ? "high" : "medium",
      actionLabel: photoCount === 0 ? "Upload Photos" : "Add Photos",
      stepId: "price",
    });
  }

  // 2. Property Description (stepId: "price")
  const desc = (p.description || "").trim();
  if (!desc || desc.length < 80) {
    recommendations.push({
      id: "description",
      category: "description",
      icon: "📝",
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

  // 3. Location / Nearby Places (stepId: "neighbourhood")
  const nearbyPlaces = p.neighbourhood?.nearbyPlaces || {};
  const enabledNearbyCount = Object.values(nearbyPlaces).filter((place) => place?.enabled).length;
  if (enabledNearbyCount < 2) {
    recommendations.push({
      id: "neighbourhood",
      category: "location",
      icon: "📍",
      title: "Highlight Nearby Places",
      description:
        "Adding nearby schools, hospitals, metro stations, or malls makes the location much easier for buyers to evaluate.",
      priority: "medium",
      actionLabel: "Add Landmarks",
      stepId: "neighbourhood",
    });
  }

  // 4. Amenities / Facilities (stepId: "amenities")
  const amenityCount = (p.amenities || []).length;
  if (amenityCount < 3) {
    recommendations.push({
      id: "amenities",
      category: "amenities",
      icon: "🏊‍♂️",
      title: "Highlight Key Amenities",
      description:
        "Selecting facilities like Security, Power Backup, Lift, or Parking helps buyers searching with specific filters find your property.",
      priority: amenityCount === 0 ? "high" : "low",
      actionLabel: "Add Amenities",
      stepId: "amenities",
    });
  }

  // 5. Property Details (stepId: "details")
  const isResidential = ["Apartment / Flat", "Independent House", "Villa", "Builder Floor"].includes(p.propertyType);
  const missingDetails = [];
  if (isResidential) {
    if (!p.facing) missingDetails.push("facing direction");
    if (!p.furnishing) missingDetails.push("furnishing status");
    if (!p.propertyAge) missingDetails.push("property age");
    if (!p.carpetArea) missingDetails.push("carpet area");
  } else if (p.propertyType === "Plot / Land" || p.propertyType === "Residential Plot") {
    if (!p.facing && !p.plotFacing) missingDetails.push("plot facing");
    if (!p.roadWidth) missingDetails.push("road width");
  }

  if (missingDetails.length > 0 && recommendations.length < 4) {
    recommendations.push({
      id: "details",
      category: "details",
      icon: "🏢",
      title: "Complete Property Details",
      description: `Providing optional details such as ${missingDetails.slice(0, 2).join(" and ")} builds transparency and trust.`,
      priority: "low",
      actionLabel: "Add Details",
      stepId: "details",
    });
  }

  // 6. Pricing Information (stepId: "price")
  if (!p.ownerNegotiable && (!p.maintenance || p.maintenance === 0) && recommendations.length < 4) {
    recommendations.push({
      id: "pricing",
      category: "pricing",
      icon: "💰",
      title: "Specify Pricing Terms",
      description: "Indicating whether the price is negotiable or specifying maintenance details helps set clear buyer expectations.",
      priority: "low",
      actionLabel: "Edit Pricing",
      stepId: "price",
    });
  }

  // Limit recommendations to top 2–4 most relevant suggestions
  const topRecommendations = recommendations.slice(0, 4);

  // Generate concise final Eyva recommendation summary based on findings
  let finalRecommendation = "";
  if (topRecommendations.length === 0) {
    finalRecommendation =
      "Excellent job! Your property listing is rich with details, photos, and location highlights. It is well-optimized to attract potential buyers.";
  } else {
    const categories = topRecommendations.map((r) => r.category);
    if (categories.includes("photos") && categories.includes("location")) {
      finalRecommendation =
        "Your property has essential details covered. Adding more photos and nearby landmark information could make your listing more informative and attractive to potential buyers.";
    } else if (categories.includes("photos")) {
      finalRecommendation =
        "Adding clear photos of key areas is the single best way to make your property listing stand out and attract serious inquiries.";
    } else if (categories.includes("description")) {
      finalRecommendation =
        "Elaborating on your property description and unique features will help buyers understand the lifestyle your property offers.";
    } else {
      finalRecommendation =
        "Providing a few more optional details like nearby landmarks and amenities will help potential buyers feel confident contacting you.";
    }
  }

  return {
    success: true,
    summary: "Your listing is almost ready. Eyva found a few ways you can make it more informative.",
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
- Description Length: ${(propertyPayload.description || "").length} chars
- Description Text: "${(propertyPayload.description || "").slice(0, 150)}"
- Amenities Count: ${(propertyPayload.amenities || []).length}
- Nearby Places Configured: ${Object.keys(propertyPayload.neighbourhood?.nearbyPlaces || {}).filter(k => propertyPayload.neighbourhood?.nearbyPlaces[k]?.enabled).join(", ") || "None"}
- Price: ${propertyPayload.price || "N/A"}
- Facing: ${propertyPayload.facing || "N/A"}
- Furnishing: ${propertyPayload.furnishing || "N/A"}

Rule Recommendations Identified: ${JSON.stringify(ruleResult.recommendations)}

Generate a JSON object with:
- "summary": A polite warm opening summary sentence (e.g. "Your listing is almost ready. Eyva found a few ways you can make it more informative.")
- "recommendations": Array of 2 to 4 objects (keep the same structure: id, category, icon, title, description, priority, actionLabel, stepId) refined with consultative, encouraging language (never say "Missing", "Incomplete", "Required", "Cannot publish").
- "finalRecommendation": A concise 1-2 sentence concluding summary advice.

Output ONLY valid JSON without markdown tags.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Eyva, EstateGold's real estate AI assistant. You evaluate draft property listings and provide 2-4 optional, encouraging tips to help sellers make their listings attractive.",
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
        recommendations: parsed.recommendations.slice(0, 4),
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
