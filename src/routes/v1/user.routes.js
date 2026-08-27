const express = require("express");
const router = express.Router();

const {
  getProfile,
  updateProfile,
  changePassword,
  uploadProfileImage,
} = require("../../controllers/authController");

const { getMyPublishedCount } = require("../../controllers/propertyController");

const auth = require("../../../middleware/authMiddleware");
const upload = require("../../../middleware/upload");

// GET /api/v1/users/me — Get current user's profile
router.get("/me", auth, getProfile);

// PUT /api/v1/users/me — Update current user's profile
router.put("/me", auth, updateProfile);

// PUT /api/v1/users/me/password — Change password
router.put("/me/password", auth, changePassword);

// POST /api/v1/users/me/avatar — Upload profile image
router.post("/me/avatar", auth, upload.single("photo"), uploadProfileImage);

// GET /api/v1/users/me/published-count — Get published property count
router.get("/me/published-count", auth, getMyPublishedCount);

module.exports = router;
