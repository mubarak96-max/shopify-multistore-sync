const express = require('express');
const router = express.Router();
const SyncService = require('../services/syncService');
const logger = require('../utils/logger');
const { 
  verifyWebhookSignature, 
  logWebhookEvent, 
  handleWebhookError,
  preventDuplicateProcessing 
} = require('../middleware/webhookMiddleware');

const syncService = new SyncService();

// Apply middleware to all webhook routes
router.use(logWebhookEvent);
router.use(preventDuplicateProcessing());

/**
 * Store A Product Webhooks
 */

// Product created in Store A
router.post('/store-a/products/create', 
  verifyWebhookSignature('WEBHOOK_SECRET_A'),
  async (req, res) => {
    try {
      const product = req.shopifyData;
      
      logger.info(`Product created in Store A: ${product.id} - ${product.title}`);
      
      const result = await syncService.syncProduct('storeA', product, 'create');
      
      res.status(200).json({ 
        received: true, 
        synced: result.success,
        syncId: result.syncId 
      });
      
    } catch (error) {
      logger.error('Error processing Store A product create webhook:', error);
      res.status(500).json({ received: false, error: error.message });
    }
  }
);

// Product updated in Store A
router.post('/store-a/products/update',
  verifyWebhookSignature('WEBHOOK_SECRET_A'),
  async (req, res) => {
    try {
      const product = req.shopifyData;
      
      logger.info(`Product updated in Store A: ${product.id} - ${product.title}`);
      
      const result = await syncService.syncProduct('storeA', product, 'update');
      
      res.status(200).json({ 
        received: true, 
        synced: result.success,
        syncId: result.syncId,
        skipped: result.skipped 
      });
      
    } catch (error) {
      logger.error('Error processing Store A product update webhook:', error);
      res.status(500).json({ received: false, error: error.message });
    }
  }
);

// Product deleted in Store A
router.post('/store-a/products/delete',
  verifyWebhookSignature('WEBHOOK_SECRET_A'),
  async (req, res) => {
    try {
      const product = req.shopifyData;
      
      logger.info(`Product deleted in Store A: ${product.id}`);
      
      const result = await syncService.syncProduct('storeA', product, 'delete');
      
      res.status(200).json({ 
        received: true, 
        synced: result.success,
        syncId: result.syncId 
      });
      
    } catch (error) {
      logger.error('Error processing Store A product delete webhook:', error);
      res.status(500).json({ received: false, error: error.message });
    }
  }
);

// Inventory updated in Store A
router.post('/store-a/inventory_levels/update',
  verifyWebhookSignature('WEBHOOK_SECRET_A'),
  async (req, res) => {
    try {
      const inventoryLevel = req.shopifyData;
      
      logger.info(`Inventory updated in Store A: ${inventoryLevel.inventory_item_id} - ${inventoryLevel.available}`);
      
      const result = await syncService.syncInventory(
        'storeA',
        inventoryLevel.inventory_item_id,
        inventoryLevel.location_id,
        inventoryLevel.available
      );
      
      res.status(200).json({ 
        received: true, 
        synced: result.success,
        syncId: result.syncId 
      });
      
    } catch (error) {
      logger.error('Error processing Store A inventory update webhook:', error);
      res.status(500).json({ received: false, error: error.message });
    }
  }
);

/**
 * Store B Product Webhooks
 */

// Product created in Store B
router.post('/store-b/products/create',
  verifyWebhookSignature('WEBHOOK_SECRET_B'),
  async (req, res) => {
    try {
      const product = req.shopifyData;
      
      logger.info(`Product created in Store B: ${product.id} - ${product.title}`);
      
      const result = await syncService.syncProduct('storeB', product, 'create');
      
      res.status(200).json({ 
        received: true, 
        synced: result.success,
        syncId: result.syncId 
      });
      
    } catch (error) {
      logger.error('Error processing Store B product create webhook:', error);
      res.status(500).json({ received: false, error: error.message });
    }
  }
);

// Product updated in Store B
router.post('/store-b/products/update',
  verifyWebhookSignature('WEBHOOK_SECRET_B'),
  async (req, res) => {
    try {
      const product = req.shopifyData;
      
      logger.info(`Product updated in Store B: ${product.id} - ${product.title}`);
      
      const result = await syncService.syncProduct('storeB', product, 'update');
      
      res.status(200).json({ 
        received: true, 
        synced: result.success,
        syncId: result.syncId,
        skipped: result.skipped 
      });
      
    } catch (error) {
      logger.error('Error processing Store B product update webhook:', error);
      res.status(500).json({ received: false, error: error.message });
    }
  }
);

// Product deleted in Store B
router.post('/store-b/products/delete',
  verifyWebhookSignature('WEBHOOK_SECRET_B'),
  async (req, res) => {
    try {
      const product = req.shopifyData;
      
      logger.info(`Product deleted in Store B: ${product.id}`);
      
      const result = await syncService.syncProduct('storeB', product, 'delete');
      
      res.status(200).json({ 
        received: true, 
        synced: result.success,
        syncId: result.syncId 
      });
      
    } catch (error) {
      logger.error('Error processing Store B product delete webhook:', error);
      res.status(500).json({ received: false, error: error.message });
    }
  }
);

// Inventory updated in Store B
router.post('/store-b/inventory_levels/update',
  verifyWebhookSignature('WEBHOOK_SECRET_B'),
  async (req, res) => {
    try {
      const inventoryLevel = req.shopifyData;
      
      logger.info(`Inventory updated in Store B: ${inventoryLevel.inventory_item_id} - ${inventoryLevel.available}`);
      
      const result = await syncService.syncInventory(
        'storeB',
        inventoryLevel.inventory_item_id,
        inventoryLevel.location_id,
        inventoryLevel.available
      );
      
      res.status(200).json({ 
        received: true, 
        synced: result.success,
        syncId: result.syncId 
      });
      
    } catch (error) {
      logger.error('Error processing Store B inventory update webhook:', error);
      res.status(500).json({ received: false, error: error.message });
    }
  }
);

/**
 * Webhook testing endpoint
 */
router.post('/test', (req, res) => {
  logger.info('Test webhook received:', {
    headers: req.headers,
    body: req.body.toString()
  });
  
  res.status(200).json({ 
    received: true, 
    timestamp: new Date().toISOString(),
    message: 'Test webhook processed successfully'
  });
});

/**
 * Webhook health check
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    endpoints: {
      'store-a': [
        '/webhooks/store-a/products/create',
        '/webhooks/store-a/products/update',
        '/webhooks/store-a/products/delete',
        '/webhooks/store-a/inventory_levels/update'
      ],
      'store-b': [
        '/webhooks/store-b/products/create',
        '/webhooks/store-b/products/update',
        '/webhooks/store-b/products/delete',
        '/webhooks/store-b/inventory_levels/update'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

// Apply error handling middleware
router.use(handleWebhookError);

module.exports = router;

