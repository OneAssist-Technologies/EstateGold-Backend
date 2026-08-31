const openai = require("./openaiClient");
const { systemPrompt, userPrompt } = require("../../prompts/description.prompt");

const generateFallbackDescription = (p) => {
  const targetLocality = p.locality || p.city || '';
  const locationStr = targetLocality ? `in ${targetLocality}` : '';
  const priceStr = p.price ? `INR ${p.price.toLocaleString('en-IN')}` : 'Contact Owner';
  const typeLabel = p.propertyType || 'Property';
  
  let purposeLabel = 'Sale';
  if (p.purpose) {
    const raw = String(p.purpose).trim().toLowerCase();
    if (raw === 'lease') {
      purposeLabel = 'Lease';
    } else if (raw === 'rent') {
      purposeLabel = 'Rent';
    } else if (raw === 'sale' || raw === 'buy') {
      purposeLabel = 'Sale';
    } else {
      purposeLabel = p.purpose.charAt(0).toUpperCase() + p.purpose.slice(1);
    }
  }

  // Title generation
  const title = `${p.bedrooms ? p.bedrooms + ' BHK ' : ''}${typeLabel} for ${purposeLabel} ${locationStr}`.trim();
  
  // Determine Category
  const isLand = /land|plot/i.test(typeLabel);
  const isCommercial = /commercial|office|shop|retail|warehouse|industrial|hotel|resort/i.test(typeLabel);
  
  // Pick structural variation based on a seed generated from property details
  const seed = (p._id ? String(p._id).charCodeAt(String(p._id).length - 1) : 0) + (p.price || 0);
  let variation = seed % 3; // 0, 1, or 2

  // Cycle variations if a description already exists to guarantee distinct outputs on multiple clicks
  if (p.description && p.description.trim() !== "" && p.description !== "N/A") {
    const prev = p.description;
    if (prev.includes("Offering a prime opportunity") || prev.includes("Designed for comfortable modern living") || prev.includes("A highly accessible commercial")) {
      variation = 1;
    } else if (prev.includes("Positioned in a developing section") || prev.includes("Offering a balanced combination of space") || prev.includes("Positioned in the active commercial")) {
      variation = 2;
    } else if (prev.includes("With a desirable layout") || prev.includes("Set in the quiet residential pockets") || prev.includes("Designed to accommodate modern commercial")) {
      variation = 0;
    } else {
      variation = (variation + 1) % 3;
    }
  }

  let desc = '';
  const highlights = [];

  if (isLand) {
    // Land/Plot flow (Omit bedrooms, bathrooms, furnishing, and building amenities)
    const areaVal = p.plotArea || p.area || '';
    const areaStr = areaVal ? `${areaVal} sq ft` : '';
    const facingStr = p.facing ? `${p.facing}-facing` : '';
    
    if (variation === 0) {
      desc = `Offering a prime opportunity ${locationStr}, this ${facingStr || 'well-aligned'} ${typeLabel} occupies a total area of ${areaStr || 'generous dimensions'}. `;
      desc += `Available for ${purposeLabel.toLowerCase()} at ${priceStr}, it provides a promising layout suitable for custom development. `;
      if (p.description) desc += `Regarding features: ${p.description} `;
    } else if (variation === 1) {
      desc = `Positioned in a developing section of ${targetLocality || 'the area'}, this ${areaStr || 'spacious'} ${typeLabel} is currently listed for ${purposeLabel.toLowerCase()}. `;
      desc += `Priced at ${priceStr}, the ${facingStr || 'strategically located'} plot offers substantial layout potential. `;
      if (p.description) desc += `Notes from owner: ${p.description} `;
    } else {
      desc = `With a desirable layout and clear orientation, this ${facingStr || 'standard'} ${typeLabel} ${locationStr} presents excellent investment prospects. `;
      desc += `The property spans ${areaStr || 'a generous area'} and is offered at ${priceStr} for ${purposeLabel.toLowerCase()}. `;
      if (p.description) desc += `Highlights: ${p.description} `;
    }

    if (areaVal) highlights.push(`Total Area: ${areaStr}`);
    if (p.facing) highlights.push(`${p.facing} Facing Plot`);
    if (p.roadWidth) highlights.push(`${p.roadWidth} Ft Road Access`);
    if (p.gatedLayout) highlights.push(`Gated Community Layout`);
  } else if (isCommercial) {
    // Commercial flow (Keep business-oriented and omit residential jargon)
    const areaStr = p.area ? `${p.area} sq ft` : '';
    const furnishingStr = p.furnishing ? p.furnishing.toLowerCase() : 'unfurnished';
    
    if (variation === 0) {
      desc = `A highly accessible commercial ${typeLabel} ${locationStr} is now available for ${purposeLabel.toLowerCase()}. `;
      desc += `Spanning ${areaStr || 'a flexible area'}, this ${furnishingStr} space is listed at ${priceStr} and is ideal for various business formats. `;
      if (p.description) desc += `Operational notes: ${p.description} `;
    } else if (variation === 1) {
      desc = `Positioned in the active commercial zone of ${targetLocality || 'the region'}, this ${areaStr || 'spacious'} ${furnishingStr} ${typeLabel} provides great business utility. `;
      desc += `Offered at a competitive ${purposeLabel.toLowerCase()} value of ${priceStr}, it ensures premium visibility. `;
      if (p.description) desc += `Property details: ${p.description} `;
    } else {
      desc = `Designed to accommodate modern commercial requirements, this ${typeLabel} features ${areaStr || 'flexible layouts'} ${locationStr}. `;
      desc += `The space is offered at ${priceStr} for ${purposeLabel.toLowerCase()} and is ready for immediate deployment. `;
      if (p.description) desc += `Features: ${p.description} `;
    }

    if (areaStr) highlights.push(`Commercial Space: ${areaStr}`);
    if (p.furnishing) highlights.push(`${p.furnishing} Workspace`);
    if (p.workstations) highlights.push(`${p.workstations} Workstations ready`);
    if (p.amenities && p.amenities.length > 0) highlights.push(`Includes: ${p.amenities.slice(0, 2).join(', ')}`);
  } else {
    // Residential flow
    const bhkPrefix = p.bedrooms ? `${p.bedrooms} BHK ` : '';
    const areaStr = p.area ? `${p.area} sq ft` : '';
    const furnishingStr = p.furnishing ? p.furnishing.toLowerCase() : 'semi-furnished';
    const bathStr = p.bathrooms ? `${p.bathrooms} bathrooms` : '';
    
    if (variation === 0) {
      desc = `Designed for comfortable modern living, this ${bhkPrefix}${typeLabel} ${locationStr} is open for ${purposeLabel.toLowerCase()}. `;
      desc += `Priced at ${priceStr}, it features a spacious ${areaStr || 'layout'} and includes ${bathStr || 'modern fixtures'} with a ${furnishingStr} interior. `;
      if (p.facing) desc += `The property enjoys a pleasant ${p.facing} facing view. `;
      if (p.description) desc += `Owner comments: ${p.description} `;
    } else if (variation === 1) {
      desc = `Offering a balanced combination of space and layout utility, this ${furnishingStr} ${bhkPrefix}${typeLabel} spans ${areaStr || 'a generous area'}. `;
      desc += `Located ${locationStr} and priced at ${priceStr} for ${purposeLabel.toLowerCase()}, it represents a highly functional residential choice. `;
      if (p.facing) desc += `Features include a standard ${p.facing} orientation. `;
      if (p.description) desc += `Note: ${p.description} `;
    } else {
      desc = `Set in the quiet residential pockets of ${targetLocality || 'the city'}, this ${p.facing ? p.facing + '-facing ' : ''}${bhkPrefix}${typeLabel} offers premium local connectivity. `;
      desc += `Available for ${purposeLabel.toLowerCase()} at ${priceStr}, the ${areaStr || 'spacious'} layout comes ${furnishingStr} with ${bathStr || 'essential amenities'}. `;
      if (p.description) desc += `Highlights: ${p.description} `;
    }

    if (p.bedrooms) highlights.push(`${p.bedrooms} Bedrooms`);
    if (p.facing) highlights.push(`${p.facing} Facing Direction`);
    if (p.furnishing) highlights.push(`${p.furnishing} Interior`);
    if (p.amenities && p.amenities.length > 0) highlights.push(`Amenities: ${p.amenities.slice(0, 2).join(', ')}`);
  }

  // Common amenities append if available (only for non-land properties)
  if (p.amenities && p.amenities.length > 0 && !isLand) {
    desc += `Residents/occupants will have access to amenities including ${p.amenities.join(', ')}. `;
  }

  return {
    success: true,
    title,
    description: desc.trim(),
    highlights: highlights.slice(0, 4),
    fallback: true
  };
};

/**
 * Generate a professional property description and title based on details.
 * @param {Object} propertyDetails 
 * @returns {Promise<Object>} Title, description, highlights
 */
const generateDescription = async (propertyDetails) => {
  try {
    const userMsg = userPrompt(propertyDetails);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);
    return {
      success: true,
      title: parsed.title || "",
      description: parsed.description || "",
      highlights: parsed.highlights || [],
      fallback: false
    };
  } catch (err) {
    console.warn("AI Description Generation failed, falling back to rule-based generation:", err.message);
    return generateFallbackDescription(propertyDetails);
  }
};

module.exports = {
  generateDescription,
};
