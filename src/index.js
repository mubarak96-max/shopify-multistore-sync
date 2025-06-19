// src/index.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const logger = require("./utils/logger");

// --- Import Router Instances --- 
// Ensure these files export `module.exports = router;` where `router = express.Router();`
const healthRoutes = require("./controllers/healthController");
const webhookRoutes = require("./controllers/webhookController");
const syncRoutes = require("./controllers/syncController");

const app = express();
const PORT = process.env.PORT || 3000;

// --- APP STARTUP DEBUGGING (Keep these for now) ---
console.log("\n--- APP STARTUP DEBUGGING ---");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);
console.log("WEBHOOK_BASE_URL:", process.env.WEBHOOK_BASE_URL);
console.log("FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID);
console.log("FIREBASE_PRIVATE_KEY (first 50 chars):", process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.substring(0, 50) + "..." : "NOT SET");
console.log("--- END APP STARTUP DEBUGGING ---\n");
// --- END DEBUGGING LINES ---

// --- GLOBAL MIDDLEWARE (Order matters) ---
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: true,
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "Too many requests from this IP, please try again later."
});
app.use(limiter);

app.use(morgan("combined", { stream: { write: message => logger.info(message.trim()) } }));

// --- BODY PARSERS (Order and specificity are CRITICAL) ---

// 1. Raw body parser for /webhooks ONLY (for Shopify signature verification)
// This must come BEFORE any other body parsers for the /webhooks path.
app.use("/webhooks", express.raw({ type: "application/json" }));

// 2. JSON and URL-encoded parsers for ALL OTHER routes
// These will only apply to requests that did NOT match the /webhooks path above,
// or to requests that passed through the /webhooks middleware (e.g., if webhookRoutes calls next()).
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// --- DEFINE ALL YOUR SPECIFIC ROUTES HERE (Order matters) ---

// Health check route
app.use("/health", healthRoutes);

// Webhook routes (will use the raw body parser defined above)
app.use("/webhooks", webhookRoutes);

// Sync routes (mounted under /api) - e.g., /api/bulk, /api/product
app.use("/api", syncRoutes);

// Root route (for a friendly landing page/health check)
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Shopify Sync Service is running",
    version: "1.0.0",
    status: "healthy",
    endpoints: {
      health: "/health",
      webhooks: "/webhooks",
      api: "/api" // Your main API routes
    }
  });
});

// --- END OF SPECIFIC ROUTES ---

// --- ERROR HANDLING MIDDLEWARE (MUST be after all specific routes) ---
// This catches errors thrown by any of the above middleware or routes.
app.use((err, req, res, next) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
  });
});

// --- 404 HANDLER (MUST be the ABSOLUTE LAST middleware/route in the chain) ---
// This catches any request that did not match any of the above specific routes
// and did not result in an error.
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// --- START SERVER ---
app.listen(PORT, "0.0.0.0", () => {
  logger.info(`Shopify Sync Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;
