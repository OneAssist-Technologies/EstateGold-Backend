const Enquiry = require("../models/Enquiry");
const Property = require("../models/Property");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

// Create callback request / enquiry
exports.createEnquiry = async (req, res) => {
  try {
    const {
      propertyId,
      ownerId,
      name,
      phone,
      preferredDate,
      preferredTime,
      message,
    } = req.body;

    if (!propertyId || !ownerId || !name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Property ID, Owner ID, client Name, and Phone are required.",
      });
    }

    // Extract raw string ID if ownerId was passed as an object
    const cleanOwnerId = ownerId && typeof ownerId === "object" ? (ownerId._id || ownerId.id) : ownerId;

    // Capture customer ID if user is authenticated
    const customerId = req.user ? (req.user._id || req.user.id) : null;

    // Create database record
    const enquiry = new Enquiry({
      propertyId,
      ownerId: cleanOwnerId,
      customerId,
      name,
      phone,
      preferredDate: preferredDate || "",
      preferredTime: preferredTime || "",
      message: message || "",
      type: "callback",
      status: "pending",
    });

    await enquiry.save();

    // Fetch Property and Owner details to build rich notification email
    const property = await Property.findById(propertyId);
    const owner = await User.findById(cleanOwnerId);

    if (owner && owner.email && owner.preferences?.enquiryNotifications !== false) {
      const propertyTitle = property
        ? `${property.bedrooms ? `${property.bedrooms} BHK ` : ""}${property.propertyType} in ${property.locality || "Local"}`
        : "Listed Property";

      const formattedPrice = property && property.price
        ? property.price >= 10000000
          ? `₹${(property.price / 10000000).toFixed(2)} Cr`
          : property.price >= 100000
            ? `₹${(property.price / 100000).toFixed(1)} Lakh`
            : `₹${property.price.toLocaleString("en-IN")}`
        : "N/A";

      const emailHtml = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #ECE7DB; border-radius: 16px; background-color: #FAF9F6;">
          <div style="text-align: center; margin-bottom: 25px;">
            <h2 style="color: #161616; margin: 0; font-size: 24px;">EstateGold</h2>
            <p style="color: #9A720C; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px;">Luxury Real Estate</p>
          </div>
          <div style="background-color: #ffffff; padding: 25px; border-radius: 12px; border: 1px solid #E5DCC6; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
            <h3 style="color: #161616; font-size: 18px; margin-top: 0; border-bottom: 1px solid #FAF5EA; padding-bottom: 12px;">📞 New Callback Request</h3>
            <p style="color: #555555; font-size: 14px; line-height: 1.5;">Hello <strong>${owner.fullName}</strong>,</p>
            <p style="color: #555555; font-size: 14px; line-height: 1.5;">A buyer is interested in your property listing and has requested a callback.</p>
            
            <div style="margin: 20px 0; background-color: #FAF6ED; border-left: 4px solid #C89B1C; padding: 15px; border-radius: 4px;">
              <h4 style="margin: 0 0 8px 0; color: #9A720C; font-size: 14px; text-transform: uppercase;">Property Details</h4>
              <p style="margin: 0; font-size: 14px; color: #333333; font-weight: bold;">${propertyTitle}</p>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #666666;">Price: ${formattedPrice} | Locality: ${property ? property.locality : "N/A"}, ${property ? property.city : "N/A"}</p>
            </div>

            <div style="margin: 20px 0; background-color: #FAF9F6; border: 1px solid #E8DCC1; padding: 15px; border-radius: 8px;">
              <h4 style="margin: 0 0 12px 0; color: #161616; font-size: 14px; border-bottom: 1px dashed #E8DCC1; padding-bottom: 6px;">Buyer Contact Details</h4>
              <table style="width: 100%; font-size: 13px; color: #555555; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 0; font-weight: bold; width: 120px;">Name:</td>
                  <td style="padding: 4px 0; color: #222222;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-weight: bold;">Phone:</td>
                  <td style="padding: 4px 0; color: #222222;"><a href="tel:${phone}" style="color: #9A720C; text-decoration: none; font-weight: bold;">${phone}</a></td>
                </tr>
                ${preferredDate ? `
                <tr>
                  <td style="padding: 4px 0; font-weight: bold;">Preferred Date:</td>
                  <td style="padding: 4px 0; color: #222222;">${preferredDate}</td>
                </tr>` : ""}
                ${preferredTime ? `
                <tr>
                  <td style="padding: 4px 0; font-weight: bold;">Preferred Time:</td>
                  <td style="padding: 4px 0; color: #222222;">${preferredTime}</td>
                </tr>` : ""}
                ${message ? `
                <tr>
                  <td style="padding: 4px 0; font-weight: bold; vertical-align: top;">Message:</td>
                  <td style="padding: 4px 0; color: #555555; font-style: italic;">"${message}"</td>
                </tr>` : ""}
              </table>
            </div>

            <p style="color: #777777; font-size: 12px; line-height: 1.5; margin-top: 20px;">
              Please contact the client as soon as possible. You can track this and other enquiries from your <strong>My Properties</strong> dashboard.
            </p>
          </div>
          <div style="text-align: center; margin-top: 25px; color: #888888; font-size: 11px;">
            &copy; ${new Date().getFullYear()} EstateGold Real Estate. All rights reserved.
          </div>
        </div>
      `;

      await sendEmail({
        to: owner.email,
        subject: `New Callback Request for: ${propertyTitle}`,
        html: emailHtml,
        text: `Hello ${owner.fullName}, You received a new callback request from ${name} (${phone}) for your property ${propertyTitle}. Message: ${message}`,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Callback request sent successfully.",
      data: enquiry,
    });
  } catch (err) {
    console.error("Error in createEnquiry:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to submit callback request.",
    });
  }
};

// Retrieve enquiries for a property listing
exports.getPropertyEnquiries = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user._id || req.user.id;

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property listing not found.",
      });
    }

    // Ensure requesting user is the listing owner/creator
    const ownerId = property.createdBy || property.ownerId;
    if (String(ownerId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized. You are not the owner of this property.",
      });
    }

    const enquiries = await Enquiry.find({ propertyId })
      .sort({ createdAt: -1 })
      .populate("customerId", "fullName email phone");

    return res.status(200).json({
      success: true,
      data: enquiries,
      property: {
        _id: property._id,
        propertyType: property.propertyType,
        locality: property.locality,
        city: property.city,
        price: property.price,
        photos: property.photos,
        bedrooms: property.bedrooms,
      },
    });
  } catch (err) {
    console.error("Error in getPropertyEnquiries:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch property enquiries.",
    });
  }
};

// Update enquiry status
exports.updateEnquiryStatus = async (req, res) => {
  try {
    const { enquiryId } = req.params;
    const { status } = req.body;
    const userId = req.user._id || req.user.id;

    if (!["pending", "contacted", "resolved"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value.",
      });
    }

    const enquiry = await Enquiry.findById(enquiryId);
    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found.",
      });
    }

    // Ensure requesting user is the listing owner/creator
    if (String(enquiry.ownerId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized. You are not the owner of this listing.",
      });
    }

    enquiry.status = status;
    await enquiry.save();

    return res.status(200).json({
      success: true,
      message: "Enquiry status updated successfully.",
      data: enquiry,
    });
  } catch (err) {
    console.error("Error in updateEnquiryStatus:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to update enquiry status.",
    });
  }
};

// Retrieve all enquiries for all properties owned by the authenticated user
exports.getMyAllEnquiries = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const enquiries = await Enquiry.find({ ownerId: userId })
      .sort({ createdAt: -1 })
      .populate("propertyId", "propertyType bedrooms locality city price photos")
      .populate("customerId", "fullName email phone");

    return res.status(200).json({
      success: true,
      data: enquiries,
    });
  } catch (err) {
    console.error("Error in getMyAllEnquiries:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch enquiries.",
    });
  }
};

