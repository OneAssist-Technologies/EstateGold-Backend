const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("../src/models/User");

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const existingAdmin = await User.findOne({
      email: "admin@estategold.com",
    });

    if (existingAdmin) {
      console.log("Admin already exists.");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(
      "Admin@123",
      10
    );

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

    console.log("Admin created successfully.");

    process.exit(0);

  } catch (error) {

    console.error(error);

    process.exit(1);

  }
}

createAdmin();