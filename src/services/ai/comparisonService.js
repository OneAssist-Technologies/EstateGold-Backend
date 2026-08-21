const openai = require("./openaiClient");
const { systemPrompt, userPrompt } = require("../../prompts/comparison.prompt");

const generateFallbackComparison = (properties) => {
  const prosCons = {};
  
  const prices = properties.map(p => p.price || 0);
  const minPrice = Math.min(...prices);
  
  const areas = properties.map(p => p.area || p.plotArea || 0);
  const maxArea = Math.max(...areas);

  properties.forEach((p) => {
    const id = p._id.toString();
    const pros = [];
    const cons = [];

    if (p.price === minPrice) {
      pros.push("This property has the lowest price among the options compared.");
    }
    if ((p.area || p.plotArea) === maxArea) {
      pros.push("This is the biggest property with the most space.");
    }
    if (p.amenities && p.amenities.length > 4) {
      pros.push("It has a lot of great facilities like a pool, gym, and security.");
    } else if (p.amenities && p.amenities.length < 3) {
      cons.push("It has very few extra features or community facilities.");
    }
    if (p.marketInsight && p.marketInsight.averageLocalityPrice) {
      const pricePerSqft = Math.round(p.price / (p.area || p.plotArea || 1));
      if (pricePerSqft < p.marketInsight.averageLocalityPrice) {
        pros.push("The price is cheaper than the neighborhood average.");
      } else {
        cons.push("The price is higher than the neighborhood average.");
      }
    }

    if (pros.length === 0) pros.push("The price is reasonable for this area.");
    if (cons.length === 0) cons.push("No major issues or problems found.");

    prosCons[id] = { pros, cons };
  });

  const names = properties.map(p => `${p.bedrooms ? p.bedrooms + ' BHK ' : ''}${p.propertyType} in ${p.locality || p.city}`);
  const summary = `We compared ${properties.length} options: ${names.join(' and ')}. Their prices range from ₹${minPrice.toLocaleString('en-IN')} to ₹${Math.max(...prices).toLocaleString('en-IN')}, and their sizes are between ${Math.min(...areas)} and ${maxArea} sq ft.`;

  const valueAnalysis = `Lower-priced properties are great if you want to save money. Higher-priced ones cost more but offer better rooms, more facilities, and nicer community areas.`;

  const recommendation = `If you want the largest house with the most space, choose the option with ${maxArea} sq ft. If you want to spend the least amount of money, choose the cheapest option priced at ₹${minPrice.toLocaleString('en-IN')}.`;

  return {
    success: true,
    summary,
    prosCons,
    valueAnalysis,
    recommendation,
    fallback: true
  };
};

/**
 * Generate smart comparison insights for multiple properties.
 * @param {Array<Object>} properties 
 * @returns {Promise<Object>} Summary, pros/cons mapping, value analysis, recommendation
 */
const compareProperties = async (properties) => {
  try {
    const userMsg = userPrompt(properties);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);
    return {
      success: true,
      summary: parsed.summary || "",
      prosCons: parsed.prosCons || {},
      valueAnalysis: parsed.valueAnalysis || "",
      recommendation: parsed.recommendation || "",
      fallback: false
    };
  } catch (err) {
    console.warn("AI Comparison failed, falling back to rule-based comparative engine:", err.message);
    return generateFallbackComparison(properties);
  }
};

module.exports = {
  compareProperties,
};
