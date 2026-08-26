const express =
  require("express");

const router =
  express.Router();

const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  uploadProfileImage,
  forgotPassword,
  verifyOtp,
  resetPassword,
} = require("../controllers/authController");

const auth = require("../../middleware/authMiddleware");
const upload = require("../../middleware/upload");

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);
router.get("/profile", auth, getProfile);
router.get("/get-profile", auth, getProfile);
router.put("/profile", auth, updateProfile);
router.put("/update-profile", auth, updateProfile);
router.put("/change-password", auth, changePassword);
router.post("/upload-profile-image", auth, upload.single("photo"), uploadProfileImage);

module.exports = router;