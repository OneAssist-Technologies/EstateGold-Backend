const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const RoleRequest = require("../models/RoleRequest");

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

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long.",
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

exports.getProfile =
  async (req, res) => {
    try {
      const user =
        await User.findById(
          req.user.id
        ).select("-password");

      res.json({
        success: true,
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