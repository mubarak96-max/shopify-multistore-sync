// src/index.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const logger = require("./utils/logger");
const webhookRoutes = require("./controllers/webhookController");
const syncRoutes = require("./controllers/syncController");
const healthRoutes = require("./controllers/healthController");
// const syncController = require("./controllers/syncController"); // Remove this redundant import

const app = express();
const PORT = process.env.PORT || 3000;

// --- ADD THESE DEBUGGING LINES AT THE VERY TOP OF YOUR SERVER LOGIC ---
console.log("\n--- APP STARTUP DEBUGGING ---");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);
console.log("WEBHOOK_BASE_URL:", process.env.WEBHOOK_BASE_URL);
console.log("FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID);
console.log("FIREBASE_PRIVATE_KEY (first 50 chars):", process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.substring(0, 50) + "..." : "NOT SET");
console.log("--- END APP STARTUP DEBUGGING ---\n");
// --- END DEBUGGING LINES ---

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration - allow all origins for development
app.use(cors({
  origin: true,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: "Too many requests from this IP, please try again later."
});
app.use(limiter);

// Logging
app.use(morgan("combined", { stream: { write: message => logger.info(message.trim()) } }));

// Raw body parser for webhook verification (must be before express.json())
app.use("/webhooks", express.raw({ type: "application/json" }));

// JSON parser for other routes
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Routes
app.use("/health", healthRoutes);
app.use("/webhooks", webhookRoutes);
app.use("/sync", syncRoutes);
app.use("/api", syncRoutes); // Assuming you want /api/bulk, /api/product etc.

// Error handling middleware (MUST be before 404 handler)
app.use((err, req, res, next) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
  });
});

// 404 handler (MUST be the absolute last middleware/route in the chain)
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  logger.info(`Shopify Sync Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;
