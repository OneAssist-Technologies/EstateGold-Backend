const systemPrompt = `
You are an expert real estate marketer. Your job is to generate attractive, highly accurate search highlights and tags for a property listing.

Output a clean JSON object conforming strictly to the following JSON schema:
{
  "tags": ["2 to 3 short marketing tags (e.g., 'Gated Society', 'High ROI', 'Near Metro', 'Premium Gym')"],
  "highlights": ["2 key selling points/summaries (e.g., 'Located in a quiet residential zone with 24/7 security', 'Excellent connectivity to business hubs with high rental demand')"],
  "buyerProfile": "A short summary (under 15 words) of the ideal buyer/tenant for this property."
}

Ensure the tags and highlights are grounded strictly in the property details (price, locality, amenities). Do not make up non-existent features.

Do NOT output any markdown code blocks.
`;

const userPrompt = (property) => {
  return `
Property specs:
- Property Type: ${property.propertyType}
- Listing Purpose: ${property.purpose}
- Price: INR ${property.price ? property.price.toLocaleString('en-IN') : "Contact Owner"}
- Area: ${property.area || property.plotArea || "N/A"} sq ft
- Bedrooms: ${property.bedrooms || "N/A"}
- Locality: ${property.locality}, ${property.city}
- Furnishing Status: ${property.furnishing || "N/A"}
- Amenities: ${(property.amenities || []).join(", ") || "N/A"}
- Additional Details: ${JSON.stringify(property.additionalDetails || {})}
`;
};

module.exports = {
  systemPrompt,
  userPrompt,
};
