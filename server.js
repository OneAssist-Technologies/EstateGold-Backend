require("dotenv").config({ override: true });

const express = require("express");
const cors = require("cors");
const path = require("path");

const connectDB = require("./config/db");
const seedAdmin = require("./seed/createAdmin");
const requestLogger = require("./middleware/requestLogger");
const createHealthRouter = require("./src/routes/healthRoutes");
const v1Routes = require("./src/routes/v1");

const authRoutes = require("./src/routes/authRoutes");
const propertyRoutes = require("./src/routes/propertyRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const locationRoutes = require("./src/routes/locationRoutes");
const marketInsightRoutes = require("./src/routes/marketInsightRoutes");
const aiRoutes = require("./src/routes/aiRoutes");
const enquiryRoutes = require("./src/routes/enquiryRoutes");
const loanEnquiryRoutes = require("./src/routes/v1/loan-enquiry.routes");

const app = express();

// Database Connection & Auto Seeding
connectDB().then(() => {
  seedAdmin();
});

// Middleware
app.use(cors());
app.use(requestLogger);

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

// ═══════ API v1 Routes (new versioned API) ═══════
app.use("/api/v1", v1Routes);
app.use("/api/v1/health", createHealthRouter(app));

// ═══════ Legacy Routes (kept for backward compatibility) ═══════
// TODO: Remove these after all frontend calls migrate to /api/v1
app.use("/api/health", createHealthRouter(app));

app.use("/api/admin/locations", locationRoutes);
app.use("/api/admin", adminRoutes);

app.use("/api/auth", authRoutes);
app.use("/api", authRoutes);
app.use("/api", propertyRoutes);
app.use("/api", enquiryRoutes);
app.use("/api/loan-enquiries", loanEnquiryRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/market-insight", marketInsightRoutes);
app.use("/api/ai", aiRoutes);

// Health Check
app.get(["/", "/api"], (req, res) => {
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
    console.error(`\n❌ [ERROR] ${req.method} ${req.originalUrl}`);
    console.error(`   Message: ${err.message}`);
    if (process.env.NODE_ENV !== "production") {
      console.error(`   Stack: ${err.stack}`);
    }

    res.status(err.status || 500).json({
      success: false,
      message:
        err.message ||
        "Internal Server Error",
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    });
  }
);

// ───── Global Crash Handlers (prevent silent deaths) ─────
process.on("uncaughtException", (err) => {
  console.error("\n🔥 UNCAUGHT EXCEPTION:");
  console.error(err);
  // Keep server alive in dev — in production you may want to exit
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("\n⚠️  UNHANDLED PROMISE REJECTION:");
  console.error("   Reason:", reason);
});

const PORT =
  process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `🚀 Server running on port ${PORT}`
  );
  console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🗺️  Route map:    http://localhost:${PORT}/api/health/routes`);
});
// Updated routes for New Projects API