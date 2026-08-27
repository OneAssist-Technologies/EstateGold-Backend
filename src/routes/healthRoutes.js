/**
 * Health & Debug Routes
 * Provides comprehensive server diagnostics for debugging in live environments.
 *
 * Endpoints:
 *   GET /api/health        — Full health check (DB, memory, uptime, env)
 *   GET /api/health/routes  — Lists all registered Express routes
 *   GET /api/health/ping    — Lightweight liveness probe
 */

const mongoose = require("mongoose");
const os = require("os");

/**
 * Recursively extracts all registered routes from the Express app.
 * Supports Express 4 (app._router) and Express 5 (app.router).
 */
function extractRoutes(app) {
  const routes = [];

  function processStack(stack, basePath = "") {
    if (!stack) return;

    stack.forEach((layer) => {
      if (layer.route) {
        // Direct route
        const methods = Object.keys(layer.route.methods)
          .map((m) => m.toUpperCase())
          .join(", ");
        const middlewareNames = (layer.route.stack || [])
          .map((s) => s.name || "anonymous")
          .filter((n) => n !== "<anonymous>" && n !== "handle")
          .join(" → ");
        routes.push({
          method: methods,
          path: basePath + layer.route.path,
          middleware: middlewareNames || "handler",
        });
      } else if (layer.name === "router" && layer.handle && layer.handle.stack) {
        // Mounted router — Express 5 uses layer.path, Express 4 uses layer.regexp
        let mountPath = "";
        if (typeof layer.path === "string" && layer.path !== "/") {
          mountPath = layer.path;
        } else if (layer.regexp) {
          mountPath = extractPathFromRegexp(layer.regexp);
        }
        processStack(layer.handle.stack, basePath + mountPath);
      }
    });
  }

  function extractPathFromRegexp(regexp) {
    if (!regexp) return "";
    const match = regexp
      .toString()
      .replace("\\/?", "")
      .replace("(?=\\/|$)", "$")
      .match(/^\/\^(\\\/[^?]*?)\$\//);
    if (match) {
      return match[1].replace(/\\\//g, "/");
    }
    return "";
  }

  // Express 5 uses app.router, Express 4 uses app._router
  const router = app.router || app._router;
  if (router && router.stack) {
    processStack(router.stack);
  }

  return routes;
}

/**
 * Static route registry — built from known route files.
 * Used as a reliable fallback / supplement when dynamic extraction is incomplete.
 */
function getStaticRouteMap() {
  return [
    // Auth Routes (mounted at /api/auth AND /api)
    { method: "POST",  path: "/api/auth/register",           middleware: "register" },
    { method: "POST",  path: "/api/auth/login",              middleware: "login" },
    { method: "POST",  path: "/api/auth/forgot-password",    middleware: "forgotPassword" },
    { method: "POST",  path: "/api/auth/verify-otp",         middleware: "verifyOtp" },
    { method: "POST",  path: "/api/auth/reset-password",     middleware: "resetPassword" },
    { method: "GET",   path: "/api/auth/profile",            middleware: "auth → getProfile" },
    { method: "GET",   path: "/api/auth/get-profile",        middleware: "auth → getProfile" },
    { method: "PUT",   path: "/api/auth/profile",            middleware: "auth → updateProfile" },
    { method: "PUT",   path: "/api/auth/update-profile",     middleware: "auth → updateProfile" },
    { method: "PUT",   path: "/api/auth/change-password",    middleware: "auth → changePassword" },
    { method: "POST",  path: "/api/auth/upload-profile-image", middleware: "auth → upload → uploadProfileImage" },

    // Property Routes (mounted at /api)
    { method: "GET",   path: "/api/settings",                middleware: "getPublicSettings" },
    { method: "POST",  path: "/api/upload-document",         middleware: "auth → upload → handler" },
    { method: "GET",   path: "/api/view-file/:filename",     middleware: "handler" },
    { method: "POST",  path: "/api/createproperty",          middleware: "auth → upload → createProperty" },
    { method: "GET",   path: "/api/properties",              middleware: "getProperties" },
    { method: "GET",   path: "/api/properties/compare",      middleware: "getPropertiesCompare" },
    { method: "POST",  path: "/api/properties/draft",        middleware: "auth → upload → createPropertyDraft" },
    { method: "PUT",   path: "/api/properties/draft/:id",    middleware: "auth → upload → updatePropertyDraft" },
    { method: "GET",   path: "/api/properties/draft/:id",    middleware: "auth → getPropertyDraft" },
    { method: "DELETE",path: "/api/properties/draft/:id",    middleware: "auth → deletePropertyDraft" },
    { method: "GET",   path: "/api/my-published-count",      middleware: "auth → getMyPublishedCount" },
    { method: "GET",   path: "/api/properties/similar/:id",  middleware: "getSimilarProperties" },
    { method: "GET",   path: "/api/properties/:id",          middleware: "getPropertyById" },
    { method: "GET",   path: "/api/my-properties/:userId",   middleware: "auth → getMyProperties" },
    { method: "GET",   path: "/api/my-properties",           middleware: "auth → getMyProperties" },
    { method: "GET",   path: "/api/search-properties",       middleware: "searchProperties" },
    { method: "GET",   path: "/api/filter-properties",       middleware: "filterProperties" },
    { method: "PATCH", path: "/api/approve-property/:id",    middleware: "approveProperty" },
    { method: "PATCH", path: "/api/reject-property/:id",     middleware: "rejectProperty" },
    { method: "PUT",   path: "/api/properties/:id",          middleware: "auth → upload → updateProperty" },
    { method: "DELETE",path: "/api/properties/:id",          middleware: "deleteProperty" },
    { method: "PATCH", path: "/api/my-properties/:id/request-delete", middleware: "auth → requestDelete" },
    { method: "PATCH", path: "/api/properties/:id/status",   middleware: "updatePropertyStatus" },

    // Enquiry Routes (mounted at /api)
    { method: "POST",  path: "/api/callback-request",        middleware: "auth → createEnquiry" },
    { method: "GET",   path: "/api/properties/:propertyId/enquiries", middleware: "auth → getPropertyEnquiries" },
    { method: "GET",   path: "/api/my-enquiries",            middleware: "auth → getMyAllEnquiries" },
    { method: "PATCH", path: "/api/enquiries/:enquiryId",    middleware: "auth → updateEnquiryStatus" },

    // Admin Routes (mounted at /api/admin)
    { method: "GET",   path: "/api/admin/dashboard",         middleware: "auth → admin → getDashboard" },
    { method: "GET",   path: "/api/admin/analytics",         middleware: "auth → admin → getAnalytics" },
    { method: "GET",   path: "/api/admin/unread-counts",     middleware: "auth → admin → getUnreadCounts" },
    { method: "GET",   path: "/api/admin/properties",        middleware: "auth → admin → getProperties" },
    { method: "GET",   path: "/api/admin/properties/:id",    middleware: "auth → admin → getProperty" },
    { method: "PATCH", path: "/api/admin/properties/:id/approve", middleware: "auth → admin → approveProperty" },
    { method: "PATCH", path: "/api/admin/properties/:id/reject",  middleware: "auth → admin → rejectProperty" },
    { method: "DELETE",path: "/api/admin/properties/:id",    middleware: "auth → admin → deleteProperty" },
    { method: "PATCH", path: "/api/admin/properties/:id/reject-delete-request", middleware: "auth → admin → rejectDeleteRequest" },
    { method: "PATCH", path: "/api/admin/properties/:id/availability-status", middleware: "auth → admin → updatePropertyAvailabilityStatus" },
    { method: "GET",   path: "/api/admin/users",             middleware: "auth → admin → getUsers" },
    { method: "PATCH", path: "/api/admin/users/:id/verify",  middleware: "auth → admin → toggleUserVerify" },
    { method: "PATCH", path: "/api/admin/users/:id/status",  middleware: "auth → admin → toggleUserStatus" },
    { method: "DELETE",path: "/api/admin/users/:id",         middleware: "auth → admin → deleteUser" },
    { method: "GET",   path: "/api/admin/settings",          middleware: "auth → admin → getSystemSettings" },
    { method: "PUT",   path: "/api/admin/settings",          middleware: "auth → admin → updateSystemSettings" },
    { method: "GET",   path: "/api/admin/staff-users",       middleware: "auth → admin → getStaffUsers" },
    { method: "PUT",   path: "/api/admin/users/:id/permissions", middleware: "auth → admin → updateUserPermissions" },

    // Location Routes (mounted at /api/locations AND /api/admin/locations)
    { method: "GET",   path: "/api/locations/",              middleware: "getLocations" },
    { method: "POST",  path: "/api/locations/request-service", middleware: "auth → requestServiceArea" },
    { method: "GET",   path: "/api/locations/:id",           middleware: "getLocationById" },
    { method: "POST",  path: "/api/admin/locations/",        middleware: "auth → admin → createLocation" },
    { method: "PATCH", path: "/api/admin/locations/:id",     middleware: "auth → admin → updateLocation" },
    { method: "DELETE",path: "/api/admin/locations/:id",     middleware: "auth → admin → deleteLocation" },

    // Market Insight Routes (mounted at /api/market-insight)
    { method: "POST",  path: "/api/market-insight/locality-insights", middleware: "getLocalityInsights" },

    // AI Routes (mounted at /api/ai)
    { method: "POST",  path: "/api/ai/generate-description", middleware: "auth → generateDescription" },
    { method: "POST",  path: "/api/ai/compare-properties",   middleware: "compareProperties" },
    { method: "GET",   path: "/api/ai/compare-properties",   middleware: "compareProperties" },
    { method: "GET",   path: "/api/ai/property-health/:id",  middleware: "getPropertyHealth" },
    { method: "GET",   path: "/api/ai/property-highlights/:id", middleware: "getPropertyHighlights" },
    { method: "POST",  path: "/api/ai/parse-search",         middleware: "parseSearch" },
    { method: "POST",  path: "/api/ai/eyva",                 middleware: "eyvaChat" },

    // Health Routes (mounted at /api/health)
    { method: "GET",   path: "/api/health/",                 middleware: "health check" },
    { method: "GET",   path: "/api/health/ping",             middleware: "liveness probe" },
    { method: "GET",   path: "/api/health/routes",           middleware: "route map" },

    // Catch-all
    { method: "GET",   path: "/",                            middleware: "API welcome" },
    { method: "GET",   path: "/api",                         middleware: "API welcome" },
  ];
}

/**
 * Creates the health router. Must be called with the Express `app` instance
 * so it can introspect registered routes.
 */
function createHealthRouter(app) {
  const express = require("express");
  const router = express.Router();
  const serverStartTime = Date.now();

  // ───── GET /ping — Lightweight liveness probe ─────
  router.get("/ping", (req, res) => {
    res.status(200).json({ status: "pong", timestamp: new Date().toISOString() });
  });

  // ───── GET / — Full health check ─────
  router.get("/", (req, res) => {
    const memUsage = process.memoryUsage();
    const uptimeSec = process.uptime();

    // MongoDB connection states: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    const dbStateMap = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
      99: "uninitialized",
    };
    const dbState = mongoose.connection.readyState;

    const health = {
      status: dbState === 1 ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      server: {
        uptime: formatUptime(uptimeSec),
        uptimeSeconds: Math.floor(uptimeSec),
        startedAt: new Date(serverStartTime).toISOString(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || "development",
        pid: process.pid,
        platform: `${os.platform()} ${os.arch()}`,
        hostname: os.hostname(),
      },
      database: {
        status: dbStateMap[dbState] || "unknown",
        name: mongoose.connection.name || "N/A",
        host: mongoose.connection.host || "N/A",
        port: mongoose.connection.port || "N/A",
      },
      memory: {
        rss: formatBytes(memUsage.rss),
        heapUsed: formatBytes(memUsage.heapUsed),
        heapTotal: formatBytes(memUsage.heapTotal),
        external: formatBytes(memUsage.external),
        systemFree: formatBytes(os.freemem()),
        systemTotal: formatBytes(os.totalmem()),
      },
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || "N/A",
        loadAvg: os.loadavg().map((l) => l.toFixed(2)),
      },
    };

    const statusCode = dbState === 1 ? 200 : 503;
    res.status(statusCode).json(health);
  });

  // ───── GET /routes — List all registered routes ─────
  router.get("/routes", (req, res) => {
    // Use the static route map as primary source (authoritative, includes full mount paths).
    // Dynamic extraction is attempted as supplementary info.
    const routes = getStaticRouteMap();
    const dynamicRoutes = extractRoutes(app);

    // Group by base path
    const grouped = {};
    routes.forEach((r) => {
      const segments = r.path.split("/").filter(Boolean);
      const group = segments.length >= 2 ? `/${segments[0]}/${segments[1]}` : r.path;
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(r);
    });

    res.status(200).json({
      totalRoutes: routes.length,
      dynamicRoutesDetected: dynamicRoutes.length,
      routes,
      grouped,
    });
  });

  return router;
}

// ───── Helpers ─────

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

module.exports = createHealthRouter;
