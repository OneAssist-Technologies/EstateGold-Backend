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

exports.register =
  async (req, res) => {
    try {
      const {
        fullName,
        email,
        phone,
        password,
        role,
        ownerName,
        agencyName,
        reraNumber,
      } = req.body;

      const existingUser =
        await User.findOne({
          $or: [
            { email },
            { phone },
          ],
        });

      if (existingUser) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "User already exists",
          });
      }

      const hashedPassword =
        await bcrypt.hash(
          password,
          10
        );

      const user =
        await User.create({
          fullName,
          email,
          phone,
          password:
            hashedPassword,
          role,

          ownerName:
            role === "seller"
              ? ownerName
              : "",

          agencyName:
            role === "agent"
              ? agencyName
              : "",

          reraNumber:
            role === "agent"
              ? reraNumber
              : "",
        });
if (role === "admin") {
  return res.status(403).json({
    success: false,
    message: "Admin registration is not allowed.",
  });
}
      const token =
        generateToken(
          user._id,
          user.role
        );

      res.status(201).json({
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