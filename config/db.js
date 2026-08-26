const mongoose =
  require("mongoose");

const connectDB =
  async () => {
    try {
      if (!process.env.MONGO_URI) {
        console.error("⚠️ MONGO_URI environment variable is missing!");
        return;
      }
      await mongoose.connect(
        process.env.MONGO_URI
      );

      console.log(
        "MongoDB Connected"
      );
    } catch (error) {
      console.error("❌ MongoDB Connection Error:", error.message || error);
    }
  };

module.exports =
  connectDB;