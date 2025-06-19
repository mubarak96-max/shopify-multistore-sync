const { verifyShopifyWebhook } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Middleware to verify Shopify webhook signatures
 */
function verifyWebhookSignature(secretEnvVar) {
  return (req, res, next) => {
    try {
      const signature = req.get('X-Shopify-Hmac-Sha256');
      const secret = process.env[secretEnvVar];
      
      if (!signature) {
        logger.warn('Missing webhook signature');
        return res.status(401).json({ error: 'Missing signature' });
      }

      if (!secret) {
        logger.error(`Missing webhook secret: ${secretEnvVar}`);
        return res.status(500).json({ error: 'Server configuration error' });
      }

      const isValid = verifyShopifyWebhook(req.body, signature, secret);
      
      if (!isValid) {
        logger.warn('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // Parse JSON body for further processing
      try {
        req.shopifyData = JSON.parse(req.body.toString());
      } catch (parseError) {
        logger.error('Error parsing webhook JSON:', parseError);
        return res.status(400).json({ error: 'Invalid JSON' });
      }

      next();
    } catch (error) {
      logger.error('Error in webhook verification:', error);
      res.status(500).json({ error: 'Verification failed' });
    }
  };
}

/**
 * Middleware to log webhook events
 */
function logWebhookEvent(req, res, next) {
  const topic = req.get('X-Shopify-Topic');
  const shop = req.get('X-Shopify-Shop-Domain');
  const hookId = req.get('X-Shopify-Webhook-Id');
  
  logger.info('Webhook received:', {
    topic,
    shop,
    hookId,
    timestamp: new Date().toISOString()
  });

  req.webhookMeta = { topic, shop, hookId };
  next();
}

/**
 * Middleware to handle webhook errors
 */
function handleWebhookError(err, req, res, next) {
  logger.error('Webhook processing error:', {
    error: err.message,
    stack: err.stack,
    topic: req.webhookMeta?.topic,
    shop: req.webhookMeta?.shop
  });

  // Return success to Shopify to prevent retries for non-recoverable errors
  if (err.name === 'ValidationError' || err.status === 400) {
    return res.status(200).json({ 
      received: true, 
      error: 'Invalid data',
      message: err.message 
    });
  }

  // Return error for recoverable issues (Shopify will retry)
  res.status(500).json({ 
    received: false, 
    error: 'Processing failed',
    message: err.message 
  });
}

/**
 * Middleware to prevent duplicate webhook processing
 */
function preventDuplicateProcessing() {
  const processedWebhooks = new Map();
  const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  const MAX_AGE = 60 * 60 * 1000; // 1 hour

  // Cleanup old entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of processedWebhooks.entries()) {
      if (now - timestamp > MAX_AGE) {
        processedWebhooks.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);

  return (req, res, next) => {
    const hookId = req.get('X-Shopify-Webhook-Id');
    
    if (!hookId) {
      return next();
    }

    const now = Date.now();
    
    if (processedWebhooks.has(hookId)) {
      logger.info(`Duplicate webhook detected: ${hookId}`);
      return res.status(200).json({ 
        received: true, 
        duplicate: true 
      });
    }

    processedWebhooks.set(hookId, now);
    next();
  };
}

module.exports = {
  verifyWebhookSignature,
  logWebhookEvent,
  handleWebhookError,
  preventDuplicateProcessing
};

