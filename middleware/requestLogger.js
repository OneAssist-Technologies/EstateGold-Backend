/**
 * Request Logger Middleware
 * Logs method, URL, status code, and response time for every request.
 * Useful for debugging route issues and performance bottlenecks.
 */

const requestLogger = (req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  // Capture the original end method
  const originalEnd = res.end;

  res.end = function (...args) {
    const duration = Date.now() - start;
    const status = res.statusCode;

    // Color-code status for terminal readability
    let statusColor;
    if (status >= 500) statusColor = "\x1b[31m"; // Red
    else if (status >= 400) statusColor = "\x1b[33m"; // Yellow
    else if (status >= 300) statusColor = "\x1b[36m"; // Cyan
    else statusColor = "\x1b[32m"; // Green

    const resetColor = "\x1b[0m";

    console.log(
      `${timestamp} | ${req.method.padEnd(7)} ${statusColor}${status}${resetColor} | ${duration}ms | ${req.originalUrl}`
    );

    // Log request body for non-GET requests (hide passwords)
    if (req.method !== "GET" && req.body && Object.keys(req.body).length > 0) {
      const safeBody = { ...req.body };
      if (safeBody.password) safeBody.password = "***";
      if (safeBody.confirmPassword) safeBody.confirmPassword = "***";
      if (safeBody.newPassword) safeBody.newPassword = "***";
      if (safeBody.oldPassword) safeBody.oldPassword = "***";
      console.log(`  └─ Body: ${JSON.stringify(safeBody).substring(0, 500)}`);
    }

    originalEnd.apply(res, args);
  };

  next();
};

module.exports = requestLogger;
