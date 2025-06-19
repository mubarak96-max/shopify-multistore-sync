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
// const syncController = require('./controllers/syncController'); // This import is redundant if syncRoutes is used for /sync and /api

const app = express();
const PORT = process.env.PORT || 3000;

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
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Logging
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Raw body parser for webhook verification (must be before express.json())
app.use('/webhooks', express.raw({ type: 'application/json' }));

// JSON parser for other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- IMPORTANT: ROUTES MUST COME BEFORE THE 404 HANDLER ---

// Routes
app.use('/health', healthRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/sync', syncRoutes); // Mounts routes from syncController.js under /sync
// app.use('/api', syncController); // This line is redundant if /sync is already handling syncController routes
                                  // If you want /api/sync/bulk, then use app.use('/api', syncRoutes); and ensure syncRoutes has /sync/bulk

// If you want the bulk sync to be at /api/bulk, then you need to change the route in syncController.js to just '/' for bulk
// and then mount it like: app.use('/api', syncRoutes);
// For now, let's assume you want /sync/bulk and /api/bulk (due to double mounting)
// Let's simplify to avoid confusion:

// Corrected Routes (simplified for clarity and to avoid double mounting of the same router)
// If you want /api/sync/bulk, then your syncController.js should define a route like router.post('/sync/bulk', ...)
// and you would mount it as app.use('/api', syncRoutes); (assuming syncRoutes is the router from syncController.js)

// Given your current syncController.js defines routes like router.post('/bulk', ...)
// and you have app.use('/sync', syncRoutes); and app.use('/api', syncController);
// This means your bulk sync will be accessible at: /sync/bulk AND /api/bulk

// Let's assume you want /api/sync/bulk, which means syncController.js should have router.post('/bulk', ...)
// and you should only mount it once, under /api

// Recommended change for src/index.js:
// Remove the redundant import: const syncController = require('./controllers/syncController');
// Keep: const syncRoutes = require('./controllers/syncController');
// Change the mounting to:
app.use('/api', syncRoutes); // This will make /api/product, /api/inventory, /api/bulk etc.

// --- End of specific routes ---

// 404 handler (MUST be the last middleware/route)
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware (MUST be before 404, but after all other routes)
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Shopify Sync Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
