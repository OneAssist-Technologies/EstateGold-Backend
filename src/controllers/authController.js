const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const generateToken = (
  userId,
  role
) => {
  return jwt.sign(
    {
      id: userId,
      role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

exports.register = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      password,
      role = "buyer",
      ownerName,
      agencyName,
      reraNumber,
      experience,
      reason,
      documents,
    } = req.body;

    if (role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin registration is not allowed.",
      });
    }

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Full Name, Email, Phone Number, and Password are required.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const cleanPhone = phone.replace(/[\s\-\(\)]/g, "");
    if (!/^\d{10}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be exactly 10 digits.",
      });
    }

    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[@#!%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (!hasMinLength || !hasUppercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters long, contain at least one uppercase letter (A-Z), one number (0-9), and one special character (@#!%^&*).",
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone: cleanPhone }],
    });

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        return res.status(400).json({
          success: false,
          message: "Email is already registered.",
        });
      }
      return res.status(400).json({
        success: false,
        message: "Phone number is already registered.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const isAgent = role === "agent";
    const verificationStatus = isAgent ? "pending" : "none";

    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      phone: cleanPhone,
      password: hashedPassword,
      role,
      roles: [role],
      verificationStatus,
      isVerified: !isAgent, // Agent requires admin verification in User Management
      experience: isAgent ? experience || "" : "",
      documents: isAgent && Array.isArray(documents) ? documents : [],
      ownerName: role === "seller" ? ownerName || "" : "",
      agencyName: isAgent ? agencyName || "" : "",
      reraNumber: isAgent ? reraNumber || "" : "",
    });

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Registration failed",
    });
  }
};

exports.login =
  async (req, res) => {
    try {
      const {
        email,
        password,
      } = req.body;

      const user =
        await User.findOne({
          email,
        });

      if (!user) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Invalid Email",
          });
      }

      const isMatch =
        await bcrypt.compare(
          password,
          user.password
        );

      if (!isMatch) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Invalid Password",
          });
      }

      const token =
        generateToken(
          user._id,
          user.role
        );

      res.json({
        success: true,
        token,
        user,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const {
      fullName,
      phone,
      dob,
      gender,
      profileImage,
      houseNo,
      street,
      locality,
      city,
      state,
      pincode,
      country,
      agencyName,
      reraNumber,
      preferences,
    } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (fullName !== undefined) user.fullName = fullName.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (dob !== undefined) user.dob = dob;
    if (gender !== undefined) user.gender = gender;
    if (profileImage !== undefined) user.profileImage = profileImage;
    if (houseNo !== undefined) user.houseNo = houseNo;
    if (street !== undefined) user.street = street;
    if (locality !== undefined) user.locality = locality;
    if (city !== undefined) user.city = city;
    if (state !== undefined) user.state = state;
    if (pincode !== undefined) user.pincode = pincode;
    if (country !== undefined) user.country = country;
    if (agencyName !== undefined) user.agencyName = agencyName;
    if (reraNumber !== undefined) user.reraNumber = reraNumber;
    if (preferences !== undefined) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    await user.save();
    const updatedUser = user.toObject();
    delete updatedUser.password;

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update profile",
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Incorrect current password.",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change Password Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to change password",
    });
  }
};

exports.uploadProfileImage = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided.",
      });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const imageUrl = `${baseUrl}/uploads/properties/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      userId,
      { profileImage: imageUrl },
      { new: true }
    ).select("-password");

    res.json({
      success: true,
      message: "Profile image uploaded successfully",
      imageUrl,
      user,
    });
  } catch (error) {
    console.error("Upload Profile Image Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to upload image",
    });
  }
};

const sendEmail = require("../utils/sendEmail");

// 1. Send Reset OTP via Email SMTP
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter your registered email address.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account registered with this email address.",
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.resetOtp = otp;
    user.resetOtpExpires = otpExpires;
    await user.save();

    const htmlContent = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 30px; border: 1px solid #ECE7DB; rounded: 16px; background-color: #FAF9F6;">
        <div style="text-align: center; margin-bottom: 25px;">
          <h2 style="color: #161616; margin: 0; font-size: 24px;">EstateGold</h2>
          <p style="color: #9A720C; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px;">Luxury Real Estate</p>
        </div>
        <div style="background-color: #ffffff; padding: 25px; border-radius: 12px; border: 1px solid #E5DCC6;">
          <h3 style="color: #161616; font-size: 18px; margin-top: 0;">Password Reset Verification OTP</h3>
          <p style="color: #555555; font-size: 14px; line-height: 1.5;">Hello <strong>${user.fullName}</strong>,</p>
          <p style="color: #555555; font-size: 14px; line-height: 1.5;">We received a request to reset your EstateGold account password. Use the verification OTP code below to proceed:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #9A720C; background-color: #FAF5EA; padding: 12px 28px; border-radius: 8px; border: 1px border #E5DCC6; display: inline-block;">
              ${otp}
            </span>
          </div>
          <p style="color: #777777; font-size: 12px; line-height: 1.5;">This verification code is valid for <strong>15 minutes</strong>. If you did not request a password reset, please ignore this email.</p>
        </div>
        <div style="text-align: center; margin-top: 25px; color: #888888; font-size: 11px;">
          &copy; ${new Date().getFullYear()} EstateGold Real Estate. All rights reserved.
        </div>
      </div>
    `;

    const mailResult = await sendEmail({
      to: user.email,
      subject: "EstateGold - Password Reset Verification OTP Code",
      html: htmlContent,
      text: `Your EstateGold Password Reset OTP is: ${otp}. Valid for 15 minutes.`,
    });

    if (!mailResult.success) {
      return res.status(500).json({
        success: false,
        message: `Failed to send verification email via SMTP: ${mailResult.error || "SMTP configuration error"}`,
      });
    }

    // Print OTP on server console ONLY if email sending succeeded
    console.log(`🔐 [OTP SENT SUCCESSFULLY VIA SMTP] Email: ${cleanEmail} | OTP: ${otp}`);

    res.json({
      success: true,
      message: `Verification OTP has been sent successfully to ${user.email}`,
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to process forgot password request.",
    });
  }
};

// 2. Verify OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP code are required.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    const user = await User.findOne({
      email: cleanEmail,
      resetOtp: cleanOtp,
      resetOtpExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP code. Please request a new OTP.",
      });
    }

    res.json({
      success: true,
      message: "OTP code verified successfully.",
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to verify OTP.",
    });
  }
};

// 3. Reset Password with OTP
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP code, and new password are required.",
      });
    }

    const hasMinLength = newPassword.length >= 8;
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[@#!%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);

    if (!hasMinLength || !hasUppercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters long, contain at least one uppercase letter (A-Z), one number (0-9), and one special character (@#!%^&*).",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    const user = await User.findOne({
      email: cleanEmail,
      resetOtp: cleanOtp,
      resetOtpExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP verification code.",
      });
    }

    // Hash new password and clear reset OTP fields
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetOtp = "";
    user.resetOtpExpires = null;
    await user.save();

    res.json({
      success: true,
      message: "Password reset successfully! You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to reset password.",
    });
  }
};