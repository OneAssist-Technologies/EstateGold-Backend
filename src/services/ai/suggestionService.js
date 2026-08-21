const openai = require("./openaiClient");
const { systemPrompt, userPrompt } = require("../../prompts/suggestion.prompt");

const generateFallbackSuggestions = (p) => {
  const tags = [];
  
  // 1. Tags logic
  if (p.facing) {
    tags.push(`${p.facing} Facing`);
  }
  if (p.gatedLayout || p.gatedLayout === true) {
    tags.push("Gated Layout");
  }
  if (p.price && p.price < 10000000) {
    tags.push("Affordable Deal");
  } else if (p.price && p.price > 30000000) {
    tags.push("Premium Luxury");
  }
  if (p.amenities && p.amenities.includes("Power Backup")) {
    tags.push("Power Backup");
  }
  if (p.amenities && (p.amenities.includes("Gym") || p.amenities.includes("Swimming Pool"))) {
    tags.push("Premium Club");
  }
  
  if (tags.length < 2) {
    tags.push("Prime Location", "Well Ventilated");
  }

  // 2. Highlights logic
  const highlights = [
    `Located in ${p.locality || p.city || 'Chennai'} with excellent road connectivity and local amenities.`,
    `Spacious design measuring ${p.area || p.plotArea || 'N/A'} sq ft with clean legal titles.`
  ];

  // 3. Buyer Profile
  const buyerProfile = p.purpose === "Rent" ? "Ideal for working professionals or young families." : "Perfect for long-term investors or self-occupation.";

  return {
    success: true,
    tags: tags.slice(0, 3),
    highlights,
    buyerProfile,
    fallback: true
  };
};

/**
 * Generate smart highlights and tags for a property listing.
 * @param {Object} property 
 * @returns {Promise<Object>} tags, highlights, buyerProfile
 */
const generateSuggestions = async (property) => {
  try {
    const userMsg = userPrompt(property);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg }
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);
    return {
      success: true,
      tags: parsed.tags || [],
      highlights: parsed.highlights || [],
      buyerProfile: parsed.buyerProfile || "",
      fallback: false
    };
  } catch (err) {
    console.warn("AI Suggestions failed, falling back to rule-based suggestions:", err.message);
    return generateFallbackSuggestions(property);
  }
};

module.exports = {
  generateSuggestions,
};
