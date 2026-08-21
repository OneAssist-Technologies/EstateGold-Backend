require("dotenv").config({ override: true });

const express = require("express");
const cors = require("cors");
const path = require("path");

const connectDB = require("./config/db");
const seedAdmin = require("./seed/createAdmin");

const authRoutes = require("./src/routes/authRoutes");
const propertyRoutes = require("./src/routes/propertyRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const locationRoutes = require("./src/routes/locationRoutes");
const marketInsightRoutes = require("./src/routes/marketInsightRoutes");
const aiRoutes = require("./src/routes/aiRoutes");

const app = express();

// Database Connection & Auto Seeding
connectDB().then(() => {
  seedAdmin();
});

// Middleware
app.use(cors());

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads")),
  express.static(path.join(__dirname, "../uploads"))
);

app.use("/admin/locations", locationRoutes);
app.use("/admin", adminRoutes);

// Routes
app.use(authRoutes);
app.use(propertyRoutes);
app.use("/api/locations", locationRoutes);
app.use("/market-insight", marketInsightRoutes);
app.use("/api/ai", aiRoutes);

// Health Check
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message:
      "EstateGold API Running",
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message:
      "Route not found",
  });
});

// Error Handler
app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    console.error(err);

    res.status(500).json({
      success: false,
      message:
        err.message ||
        "Internal Server Error",
    });
  }
);

const PORT =
  process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `🚀 Server running on port ${PORT}`
  );
});