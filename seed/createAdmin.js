const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("../src/models/User");

async function createAdmin() {
  try {
    const existingAdmin = await User.findOne({
      email: "admin@estategold.com",
    });

    if (existingAdmin) {
      console.log("👑 Super Admin already exists.");
    } else {
      const hashedPassword = await bcrypt.hash("Admin@123", 10);

      await User.create({
        fullName: "Super Admin",
        email: "admin@estategold.com",
        phone: "9999999999",
        password: hashedPassword,
        role: "admin",
        ownerName: "",
        agencyName: "",
        reraNumber: "",
        profileImage: "",
        isVerified: true,
        isActive: true,
      });

      console.log("👑 Super Admin created successfully.");
    }
  } catch (error) {
    console.error("Failed to seed admin:", error);
  }
}

module.exports = createAdmin;

if (require.main === module) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(async () => {
      await createAdmin();
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}