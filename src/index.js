// src/index.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const webhookRoutes = require('./controllers/webhookController');
const syncRoutes = require('./controllers/syncController');
const healthRoutes = require('./controllers/healthController');
// REMOVE THIS LINE IF IT EXISTS: const syncController = require('./controllers/syncController');

const app = express();
const PORT = process.env.PORT || 3000;

// --- DEBUGGING LINES (KEEP THESE FOR NOW) ---
console.log("\n--- APP STARTUP DEBUGGING ---");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);
console.log("WEBHOOK_BASE_URL:", process.env.WEBHOOK_BASE_URL);
console.log("FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID);
console.log("FIREBASE_PRIVATE_KEY (first 50 chars):", process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.substring(0, 50) + "..." : "NOT SET");
console.log("--- END APP STARTUP DEBUGGING ---\n");
// --- END DEBUGGING LINES ---

// --- GLOBAL MIDDLEWARE (Order matters here) ---
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: true,
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Raw body parser for webhook verification (must be before express.json() for /webhooks)
app.use('/webhooks', express.raw({ type: 'application/json' }));

// JSON parser for other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- DEFINE ALL YOUR SPECIFIC ROUTES HERE (Order matters here too) ---

// Health check route
app.use('/health', healthRoutes);

// Webhook routes
app.use('/webhooks', webhookRoutes);

// Sync routes (from syncController.js) - mounted under /api
// This means routes like router.post('/bulk', ...) in syncController.js will be /api/bulk
app.use('/api', syncRoutes);

// Root route (for a friendly landing page/health check)
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Shopify Sync Service is running',
    version: '1.0.0',
    status: 'healthy',
    endpoints: {
      health: '/health',
      webhooks: '/webhooks',
      api: '/api' // Your main API routes
    }
  });
});

// --- END OF SPECIFIC ROUTES ---

// --- ERROR HANDLING MIDDLEWARE (MUST be after all specific routes) ---
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// --- 404 HANDLER (MUST be the ABSOLUTE LAST middleware/route in the chain) ---
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// --- START SERVER ---
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Shopify Sync Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
