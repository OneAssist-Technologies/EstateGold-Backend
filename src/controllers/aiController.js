const Property = require("../models/Property");
const descriptionService = require("../services/ai/descriptionService");
const comparisonService = require("../services/ai/comparisonService");
const healthScoreService = require("../services/ai/healthScoreService");
const suggestionService = require("../services/ai/suggestionService");
const matchScoreService = require("../services/ai/matchScoreService");

// 1. On-demand AI Description Generation
exports.generateDescription = async (req, res) => {
  try {
    const { propertyType, purpose, locality, city } = req.body;
    if (!propertyType || !purpose || !city) {
      return res.status(400).json({
        success: false,
        message: "Property type, purpose, and city are required.",
      });
    }

    const result = await descriptionService.generateDescription(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to generate property description.",
    });
  }
};

// 2. AI Property Comparison Insights
exports.compareProperties = async (req, res) => {
  try {
    const ids = req.body.ids || req.query.ids;
    if (!ids) {
      return res.status(400).json({
        success: false,
        message: "Property IDs are required for comparison.",
      });
    }

    const idList = String(ids)
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (idList.length < 2) {
      return res.status(400).json({
        success: false,
        message: "At least 2 property IDs are required to compare.",
      });
    }

    const mongoose = require("mongoose");
    const validIds = idList.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid Property IDs provided.",
      });
    }

    const properties = await Property.find({
      _id: { $in: validIds },
      isDeleted: { $ne: true },
    });

    if (properties.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No matching properties found for the provided IDs.",
      });
    }

    const result = await comparisonService.compareProperties(properties);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to generate comparison insights.",
    });
  }
};

// 3. Document-based Property Health Score
exports.getPropertyHealth = async (req, res) => {
  try {
    const { id } = req.params;
    const mongoose = require("mongoose");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Property ID.",
      });
    }

    const property = await Property.findOne({
      _id: id,
      isDeleted: { $ne: true },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    const result = await healthScoreService.calculateHealthScore(property);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to calculate property health score.",
    });
  }
};

// 4. Listing Page Suggestions / Highlights
exports.getPropertyHighlights = async (req, res) => {
  try {
    const { id } = req.params;
    const mongoose = require("mongoose");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Property ID.",
      });
    }

    const property = await Property.findOne({
      _id: id,
      isDeleted: { $ne: true },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    const result = await suggestionService.generateSuggestions(property);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to generate property highlights.",
    });
  }
};

const searchParserService = require("../services/ai/searchParserService");

// 5. Natural Language Search Parser
exports.parseSearch = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required.",
      });
    }

    const result = await searchParserService.parseSearchQuery(query);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to parse search query.",
    });
  }
};

const openai = require("../services/ai/openaiClient");

const extractionSystemPrompt = `
You are the intent and parameter extraction module for the EstateGold real estate assistant.
Analyze the conversation history and the user's latest message to extract the user's active intent and parameters.

You must output a JSON object with:
- "intent": "search_properties" | "list_locations" | "list_property_types" | "get_cheapest_property" | "compare_properties" | "general_inquiry"
- "filters": A structured object containing any filters the user has mentioned or implied so far:
  - "purpose": "Buy" | "Rent" | ""
  - "propertyType": string | ""
  - "city": string | ""
  - "locality": string | ""
  - "bedrooms": number | null
  - "maxPrice": number | null
  - "minPrice": number | null
  - "amenities": array of strings
  - "nearby": array of strings
- "referencedPropertyIds": array of strings (if the user is referring to specific properties they want details on or want to compare)
- "queryText": a short summary of the user's current query for location/property lookup.

Do NOT output any markdown formatting blocks. Return ONLY raw JSON.
`;

const getEyvaResponsePrompt = (dbContext) => `
You are Eyva, an experienced real estate consultant for EstateGold. 
Your tone must be warm, professional, human-like, and highly consultative.

You have access to the actual EstateGold live database context for this query:
=== DATABASE CONTEXT ===
${JSON.stringify(dbContext, null, 2)}
========================

CONVERSATION RULES:
1. STRICT TRUTH: 
- Base your answers ONLY on the provided DATABASE CONTEXT. Never make up or assume properties, cities, or listing details that are not in the context.
- If the target location is NOT serviceable (indicated by "isServiceable: false" in context), explain politely: "We are currently not servicing in this area. Please send the request to admin."

2. NATURAL DIALOGUE:
- Avoid repetitive introductory prefixes like "Got it", "Perfect", "Understood", "Let me search". Vary your openings naturally.
- Do NOT repeat questions that the user has already answered.
- If you have enough details to search, summarize them naturally and present the matches from the context.
- Whenever you display properties or find matching results, always follow up by asking the user if they have any additional preferences, such as specific amenities (e.g. power backup, parking, security) or nearby facilities (e.g. schools, colleges, metro stations) to further refine the search.
- Do not follow a rigid question order. Act like a helpful human agent.

3. SMART ALTERNATIVES:
- If "exactMatchFound" is false, check the alternatives in the context (like cityWideAlternatives or otherLocalAlternatives) and recommend them:
  Example: "I couldn't find an exact 4BHK apartment in Kollengode under ₹50L. I did find 3BHK options within your budget, and there are also 4BHK properties slightly above your budget. Would you like me to show those?"
- Use the actual prices, sizes, and configurations present in the database context alternatives.

OUTPUT FORMAT:
You must output a raw JSON object containing:
- "reply": Your conversational response to the user.
- "filters": The updated search filters schema (keys: purpose, propertyType, city, locality, bedrooms, maxPrice, minPrice, amenities, nearby).
- "shouldSearch": Boolean (set to true if you are showing/displaying properties now).
- "explanation": Bulleted explanation of why the properties match (or if you relaxed criteria, why you did so).
- "suggestions": 3-4 dynamic, highly contextual follow-up query suggestions based on this turn (e.g. "Show cheaper options", "Show similar properties", "Compare properties"). Suggested options must adapt to the properties shown.

Strictly output raw JSON only, no markdown formatting blocks.
`;

const retrieveDatabaseContext = async (intent, filters) => {
  const context = {
    serviceableLocations: [],
    matchingPropertiesSummary: [],
    fullProperties: [],
    exactMatchFound: true,
    isServiceable: true,
    activeDatabaseLocations: [],
    activeDatabaseLocalities: [],
    totalDatabaseListings: 0
  };

  try {
    const Location = require("../models/Location");
    const activeLocs = await Location.find({ status: "active" }).select("city state allowedServices").lean();
    context.serviceableLocations = activeLocs.map(l => `${l.city}, ${l.state}`);

    let targetLocation = (filters.city || filters.locality || "").trim().toLowerCase();
    const serviceableCities = activeLocs.map(l => l.city.toLowerCase().trim());
    
    if (targetLocation) {
      const Property = require("../models/Property");
      const matchingListingsCount = await Property.countDocuments({
        status: "approved",
        isDeleted: { $ne: true },
        $or: [
          { city: new RegExp(targetLocation, "i") },
          { locality: new RegExp(targetLocation, "i") }
        ]
      });

      const isLocSupported = (matchingListingsCount > 0) || serviceableCities.some(sc => sc.includes(targetLocation) || targetLocation.includes(sc));
      if (!isLocSupported) {
        context.isServiceable = false;
        return context;
      }
    }

    const query = { status: "approved", isDeleted: { $ne: true } };

    if (filters.purpose) {
      const p = filters.purpose.toLowerCase();
      if (p === "buy" || p === "sale" || p === "purchase") {
        query.purpose = { $in: ["Buy", "Sale", "buy", "sale"] };
      } else if (p === "rent" || p === "lease") {
        query.purpose = { $in: ["Rent", "rent"] };
      }
    }

    if (filters.propertyType) {
      query.propertyType = new RegExp(filters.propertyType, "i");
    }

    if (filters.city) {
      query.city = new RegExp(filters.city, "i");
    }

    if (filters.locality) {
      query.locality = new RegExp(filters.locality, "i");
    }

    if (filters.bedrooms) {
      query.bedrooms = Number(filters.bedrooms);
    }

    if (filters.maxPrice || filters.minPrice) {
      query.price = {};
      if (filters.minPrice) query.price.$gte = Number(filters.minPrice);
      if (filters.maxPrice) query.price.$lte = Number(filters.maxPrice);
    }

    if (filters.amenities && filters.amenities.length > 0) {
      const amArray = Array.isArray(filters.amenities) ? filters.amenities : [filters.amenities];
      query.amenities = { $all: amArray.map(a => new RegExp(a, "i")) };
    }

    let sortOption = { createdAt: -1 };
    if (intent === "get_cheapest_property") {
      sortOption = { price: 1 };
    }

    const Property = require("../models/Property");
    const properties = await Property.find(query).sort(sortOption).limit(6).lean();
    context.fullProperties = properties;
    context.matchingPropertiesSummary = properties.map(p => ({
      id: p._id,
      title: `${p.bedrooms ? p.bedrooms + ' BHK ' : ''}${p.propertyType} in ${p.locality || p.city}`,
      purpose: p.purpose,
      propertyType: p.propertyType,
      city: p.city,
      locality: p.locality,
      price: p.price,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      area: p.area || p.plotArea,
      facing: p.facing || p.plotFacing,
      amenities: p.amenities || []
    }));

    if (properties.length === 0) {
      context.exactMatchFound = false;

      if (filters.city) {
        const cityQuery = { 
          status: "approved", 
          isDeleted: { $ne: true },
          city: new RegExp(filters.city, "i")
        };
        if (query.purpose) cityQuery.purpose = query.purpose;
        if (query.propertyType) cityQuery.propertyType = query.propertyType;

        const cityProps = await Property.find(cityQuery).limit(4).lean();
        context.cityWideAlternatives = cityProps.map(p => ({
          id: p._id,
          title: `${p.bedrooms ? p.bedrooms + ' BHK ' : ''}${p.propertyType} in ${p.locality || p.city}`,
          price: p.price,
          city: p.city,
          locality: p.locality
        }));
      }

      if (filters.city || filters.locality) {
        const localQuery = { status: "approved", isDeleted: { $ne: true } };
        if (filters.city) localQuery.city = new RegExp(filters.city, "i");
        if (filters.locality) localQuery.locality = new RegExp(filters.locality, "i");
        if (query.propertyType) localQuery.propertyType = query.propertyType;

        const localProps = await Property.find(localQuery).limit(4).lean();
        context.otherLocalAlternatives = localProps.map(p => ({
          id: p._id,
          title: `${p.bedrooms ? p.bedrooms + ' BHK ' : ''}${p.propertyType} in ${p.locality || p.city}`,
          price: p.price,
          city: p.city,
          locality: p.locality
        }));
      }
    }

    const activeLocationsNames = await Property.distinct("city", { status: "approved", isDeleted: { $ne: true } });
    const activeLocalities = await Property.distinct("locality", { status: "approved", isDeleted: { $ne: true } });
    const totalListings = await Property.countDocuments({ status: "approved", isDeleted: { $ne: true } });
    
    context.activeDatabaseLocations = activeLocationsNames;
    context.activeDatabaseLocalities = activeLocalities.slice(0, 15);
    context.totalDatabaseListings = totalListings;

  } catch (dbErr) {
    console.error("Database context query failed:", dbErr.message);
    throw dbErr;
  }

  return context;
};

const calculateMatchScore = (property, filters) => {
  const result = matchScoreService.calculatePropertyMatchScore(property, filters);
  if (!result) {
    return { score: 100, matched: [], mismatched: [] };
  }
  return {
    score: result.score,
    matched: result.matchedReasons,
    mismatched: result.mismatchedReasons
  };
};

const dynamicFallbackParser = async (messages, currentFilters = {}) => {
  const filters = {
    purpose: currentFilters.purpose || "",
    propertyType: currentFilters.propertyType || "",
    city: currentFilters.city || "",
    locality: currentFilters.locality || "",
    bedrooms: currentFilters.bedrooms || null,
    minPrice: currentFilters.minPrice || null,
    maxPrice: currentFilters.maxPrice || null,
    amenities: currentFilters.amenities || [],
    nearby: currentFilters.nearby || []
  };

  const lastUserMsg = messages[messages.length - 1]?.content || "";
  const cleanMsg = lastUserMsg.toLowerCase().replace(/\s+/g, " ").trim();

  // 1. Extract Purpose
  if (cleanMsg.includes("rent") || cleanMsg.includes("lease")) {
    filters.purpose = "Rent";
  } else if (cleanMsg.includes("buy") || cleanMsg.includes("purchase") || cleanMsg.includes("sale") || cleanMsg.includes("sell")) {
    filters.purpose = "Buy";
  }

  // 2. Extract BHK
  const bhkMatch = cleanMsg.match(/(\d)\s*bhk/);
  const bedMatch = cleanMsg.match(/(\d)\s*bedroom/);
  if (bhkMatch) {
    filters.bedrooms = Number(bhkMatch[1]);
  } else if (bedMatch) {
    filters.bedrooms = Number(bedMatch[1]);
  }

  // 3. Extract Budget
  const lakhMatch = cleanMsg.match(/(\d+(?:\.\d+)?)\s*(?:lakh|l|lakhs)/);
  const croreMatch = cleanMsg.match(/(\d+(?:\.\d+)?)\s*(?:crore|cr|crores)/);
  if (lakhMatch) {
    filters.maxPrice = parseFloat(lakhMatch[1]) * 100000;
  } else if (croreMatch) {
    filters.maxPrice = parseFloat(croreMatch[1]) * 10000000;
  }

  // 4. Extract Property Type
  const typeKeywords = {
    "Apartment / Flat": ["apartment", "flat", "flats", "apartments"],
    "Independent House": ["independent house", "house", "villa", "home", "independent home"],
    "Plot / Land": ["plot", "land", "lands", "plots", "residential plot", "agricultural land"],
    "Builder Floor": ["builder floor", "floor"],
    "Commercial Space": ["commercial", "office", "shop", "retail", "warehouse"]
  };
  for (const [type, kws] of Object.entries(typeKeywords)) {
    if (kws.some(kw => cleanMsg.includes(kw))) {
      filters.propertyType = type;
      break;
    }
  }

  // 5. Extract City & Locality dynamically from database records
  try {
    const Property = require("../models/Property");
    const uniqueCities = await Property.distinct("city", { status: "approved", isDeleted: { $ne: true } });
    const uniqueLocalities = await Property.distinct("locality", { status: "approved", isDeleted: { $ne: true } });

    for (const city of uniqueCities) {
      if (city && cleanMsg.includes(city.toLowerCase().trim())) {
        filters.city = city;
      }
    }

    for (const loc of uniqueLocalities) {
      if (loc && cleanMsg.includes(loc.toLowerCase().trim())) {
        filters.locality = loc;
        const parentProperty = await Property.findOne({ locality: loc, status: "approved", isDeleted: { $ne: true } }).lean();
        if (parentProperty && parentProperty.city) {
          filters.city = parentProperty.city;
        }
      }
    }
  } catch (err) {
    console.error("Dynamic location extraction failed:", err.message);
  }

  // 6. Extract Amenities dynamically from user input
  const amenityKeywords = {
    "Power Backup": ["power backup", "generator", "backup power", "powerback"],
    "Security / CCTV": ["security", "cctv", "guard", "surveillance", "watchman"],
    "Parking": ["parking", "garage", "car park", "bike park"],
    "Lift": ["lift", "elevator"],
    "Garden": ["garden", "park", "lawn", "play area"]
  };
  for (const [amenity, kws] of Object.entries(amenityKeywords)) {
    if (kws.some(kw => cleanMsg.includes(kw))) {
      if (!filters.amenities.includes(amenity)) {
        filters.amenities.push(amenity);
      }
    }
  }

  // 7. Extract Nearby places dynamically from user input
  const nearbyKeywords = {
    "school": ["school", "schools", "education"],
    "college": ["college", "colleges", "university"],
    "hospital": ["hospital", "hospitals", "medical", "clinic"],
    "metro": ["metro", "metro station", "subway", "train"]
  };
  for (const [facility, kws] of Object.entries(nearbyKeywords)) {
    if (kws.some(kw => cleanMsg.includes(kw))) {
      if (!filters.nearby.includes(facility)) {
        filters.nearby.push(facility);
      }
    }
  }

  // Determine conversation flow response
  let reply = "";
  let shouldSearch = false;
  let suggestions = [];

  if (filters.locality || filters.city) {
    shouldSearch = true;
    const locName = filters.locality || filters.city;
    const pTypeStr = filters.propertyType ? ` ${filters.propertyType.toLowerCase()}` : " properties";
    const purpStr = filters.purpose ? ` for ${filters.purpose.toLowerCase()}` : "";
    
    let extraCriteria = "";
    if (filters.bedrooms) extraCriteria += ` (${filters.bedrooms} BHK)`;
    if (filters.maxPrice) {
      const priceLakhs = filters.maxPrice / 100000;
      extraCriteria += ` under ₹${priceLakhs >= 100 ? (priceLakhs / 100).toFixed(1) + ' Cr' : priceLakhs.toFixed(0) + ' Lakhs'}`;
    }
    
    reply = `I have found matching${pTypeStr}${purpStr} in ${locName}${extraCriteria}! To narrow this down, what else would you like? For example, are you looking for specific amenities (like parking or power backup) or nearby facilities (such as schools, colleges, or metro stations)?`;
    suggestions = ["Close to school 🏫", "With power backup ⚡", "With parking 🚗", "Show cheaper options 💰"];
  } else {
    reply = "Hello! I am Eyva, your real estate assistant. I'm connected to the EstateGold properties database. Could you please specify the city or locality you are looking for?";
    suggestions = ["Show Coimbatore properties 🏠", "Show Chennai properties 🏠", "Show Bengaluru properties 🏠"];
  }

  return {
    reply,
    filters,
    shouldSearch,
    explanation: shouldSearch ? `Searching properties matching your location and type requirements.` : "",
    suggestions
  };
};

exports.eyvaChat = async (req, res) => {
  try {
    const { messages, filters: currentFilters } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        message: "Conversation messages array is required.",
      });
    }

    let extractionResult = {
      intent: "general_inquiry",
      filters: currentFilters || {},
      referencedPropertyIds: [],
      queryText: ""
    };

    try {
      const extractionMessages = [
        { role: "system", content: extractionSystemPrompt },
        ...messages
      ];
      if (currentFilters) {
        extractionMessages.push({
          role: "system",
          content: `Current active filters helper: ${JSON.stringify(currentFilters)}`
        });
      }

      const extractResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: extractionMessages,
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const extractedData = JSON.parse(extractResponse.choices[0].message.content);
      if (extractedData) {
        extractionResult = {
          intent: extractedData.intent || "general_inquiry",
          filters: { ...currentFilters, ...(extractedData.filters || {}) },
          referencedPropertyIds: extractedData.referencedPropertyIds || [],
          queryText: extractedData.queryText || ""
        };
      }
    } catch (err) {
      console.warn("AI Intent extraction failed, using fallback/default:", err.message);
      const fallbackData = await dynamicFallbackParser(messages, currentFilters);
      extractionResult = {
        intent: fallbackData.shouldSearch ? "search_properties" : "general_inquiry",
        filters: fallbackData.filters,
        referencedPropertyIds: [],
        queryText: ""
      };
    }

    let dbContext;
    try {
      dbContext = await retrieveDatabaseContext(extractionResult.intent, extractionResult.filters);
    } catch (dbError) {
      console.error("Critical database error in eyvaChat retrieval:", dbError);
      return res.status(500).json({
        success: false,
        error: "Database Failure",
        message: dbError.message || "Failed to query properties database."
      });
    }

    let parsed = null;
    try {
      const responseMessages = [
        { role: "system", content: getEyvaResponsePrompt(dbContext) },
        ...messages
      ];

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: responseMessages,
        response_format: { type: "json_object" },
        temperature: 0.6,
      });

      parsed = JSON.parse(response.choices[0].message.content);
    } catch (apiError) {
      console.warn("AI Eyva Chat generation failed. Falling back to default error response:", apiError.message);
      const fallbackData = await dynamicFallbackParser(messages, currentFilters);
      parsed = {
        reply: fallbackData.reply,
        filters: fallbackData.filters,
        shouldSearch: fallbackData.shouldSearch,
        explanation: fallbackData.explanation,
        suggestions: fallbackData.suggestions
      };
    }

    let finalProperties = [];
    const Property = require("../models/Property");
    try {
      if (parsed.shouldSearch && dbContext.isServiceable) {
        if (dbContext.exactMatchFound) {
          finalProperties = dbContext.fullProperties || [];
        } else {
          const altIds = [
            ...(dbContext.cityWideAlternatives || []).map(p => p.id),
            ...(dbContext.otherLocalAlternatives || []).map(p => p.id)
          ];
          if (altIds.length > 0) {
            finalProperties = await Property.find({ _id: { $in: altIds } }).limit(4).lean();
          }
        }
      }
    } catch (dbError) {
      console.error("Critical database error resolving properties:", dbError);
      return res.status(500).json({
        success: false,
        error: "Database Failure",
        message: dbError.message || "Failed to fetch alternative properties."
      });
    }

    finalProperties = finalProperties.map(property => {
      const matchInfo = calculateMatchScore(property, parsed.filters);
      return {
        ...property,
        matchScore: matchInfo.score,
        matchedDetails: matchInfo.matched,
        mismatchedDetails: matchInfo.mismatched
      };
    });

    res.json({
      success: true,
      reply: parsed.reply,
      filters: parsed.filters,
      shouldSearch: parsed.shouldSearch,
      explanation: parsed.explanation || "",
      properties: finalProperties,
      suggestions: parsed.suggestions || []
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to process chat query.",
    });
  }
};

exports.calculateMatchScore = calculateMatchScore;
