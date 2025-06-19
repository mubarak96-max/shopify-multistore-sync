const express = require('express');
const router = express.Router();

// Health check endpoint
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'shopify-express-sync',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Detailed health check
router.get('/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'shopify-express-sync',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {}
  };

  // Check Firebase connection
  try {
    const FirebaseService = require('../services/firebaseService');
    const firebase = new FirebaseService();
    await firebase.getConfig('health_check');
    health.checks.firebase = 'healthy';
  } catch (error) {
    health.checks.firebase = 'unhealthy';
    health.status = 'degraded';
  }

  // Check environment variables
  const requiredEnvVars = [
    'STORE_A_DOMAIN',
    'STORE_A_ACCESS_TOKEN',
    'STORE_B_DOMAIN',
    'STORE_B_ACCESS_TOKEN',
    'WEBHOOK_SECRET_A',
    'WEBHOOK_SECRET_B'
  ];

  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missingEnvVars.length > 0) {
    health.checks.environment = `Missing: ${missingEnvVars.join(', ')}`;
    health.status = 'unhealthy';
  } else {
    health.checks.environment = 'healthy';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;

