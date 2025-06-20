// const express = require('express');
// const router = express.Router();
// const SyncService = require('../services/syncService');
// const FirebaseService = require('../services/firebaseService');
// const logger = require('../utils/logger');

// const syncService = new SyncService();
// const firebase = new FirebaseService();

// /**
//  * Manual sync trigger for a specific product
//  * POST /sync/product
//  * Body: { sourceStore: 'storeA', productId: '123', operation: 'create' }
//  */
// router.post('/product', async (req, res) => {
//   try {
//     const { sourceStore, productId, operation = 'create' } = req.body;

//     if (!sourceStore || !productId) {
//       return res.status(400).json({
//         error: 'Missing required fields: sourceStore, productId'
//       });
//     }

//     if (!['storeA', 'storeB'].includes(sourceStore)) {
//       return res.status(400).json({
//         error: 'Invalid sourceStore. Must be storeA or storeB'
//       });
//     }

//     if (!['create', 'update', 'delete'].includes(operation)) {
//       return res.status(400).json({
//         error: 'Invalid operation. Must be create, update, or delete'
//       });
//     }

//     // Get product from source store
//     const sourceAPI = syncService.stores[sourceStore].api;
//     let productData;

//     if (operation === 'delete') {
//       productData = { id: productId };
//     } else {
//       productData = await sourceAPI.getProduct(productId);
//     }

//     // Perform sync
//     const result = await syncService.syncProduct(sourceStore, productData, operation);

//     res.json({
//       success: true,
//       result,
//       message: `Product ${operation} sync completed`
//     });

//   } catch (error) {
//     logger.error('Error in manual product sync:', error);
//     res.status(500).json({
//       error: 'Sync failed',
//       message: error.message
//     });
//   }
// });

// /**
//  * Manual inventory sync
//  * POST /sync/inventory
//  * Body: { sourceStore: 'storeA', inventoryItemId: '123', locationId: '456', quantity: 10 }
//  */
// router.post('/inventory', async (req, res) => {
//   try {
//     const { sourceStore, inventoryItemId, locationId, quantity } = req.body;

//     if (!sourceStore || !inventoryItemId || !locationId || quantity === undefined) {
//       return res.status(400).json({
//         error: 'Missing required fields: sourceStore, inventoryItemId, locationId, quantity'
//       });
//     }

//     if (!['storeA', 'storeB'].includes(sourceStore)) {
//       return res.status(400).json({
//         error: 'Invalid sourceStore. Must be storeA or storeB'
//       });
//     }

//     // Perform inventory sync
//     const result = await syncService.syncInventory(sourceStore, inventoryItemId, locationId, quantity);

//     res.json({
//       success: true,
//       result,
//       message: 'Inventory sync completed'
//     });

//   } catch (error) {
//     logger.error('Error in manual inventory sync:', error);
//     res.status(500).json({
//       error: 'Inventory sync failed',
//       message: error.message
//     });
//   }
// });

// /**
//  * Bulk synchronization
//  * POST /sync/bulk
//  * Body: { sourceStore: 'storeA', targetStore: 'storeB', limit: 50, skipExisting: true }
//  */
// router.post('/bulk', async (req, res) => {
//   try {
//     const { sourceStore, targetStore, limit = 50, skipExisting = true } = req.body;

//     if (!sourceStore || !targetStore) {
//       return res.status(400).json({
//         error: 'Missing required fields: sourceStore, targetStore'
//       });
//     }

//     if (!['storeA', 'storeB'].includes(sourceStore) || !['storeA', 'storeB'].includes(targetStore)) {
//       return res.status(400).json({
//         error: 'Invalid store identifiers. Must be storeA or storeB'
//       });
//     }

//     if (sourceStore === targetStore) {
//       return res.status(400).json({
//         error: 'Source and target stores cannot be the same'
//       });
//     }

//     // Start bulk sync (this might take a while)
//     const result = await syncService.performBulkSync(sourceStore, targetStore, {
//       limit: Math.min(limit, 250), // Cap at Shopify's max
//       skipExisting
//     });

//     res.json({
//       success: true,
//       result,
//       message: 'Bulk sync completed'
//     });

//   } catch (error) {
//     logger.error('Error in bulk sync:', error);
//     res.status(500).json({
//       error: 'Bulk sync failed',
//       message: error.message
//     });
//   }
// });

// /**
//  * Get sync status for a product
//  * GET /sync/status/:syncId
//  */
// router.get('/status/:syncId', async (req, res) => {
//   try {
//     const { syncId } = req.params;

//     const product = await firebase.getProductBySyncId(syncId);
    
//     if (!product) {
//       return res.status(404).json({
//         error: 'Product not found',
//         syncId
//       });
//     }

//     res.json({
//       success: true,
//       product: {
//         syncId: product.id,
//         title: product.title,
//         storeA_id: product.storeA_id,
//         storeB_id: product.storeB_id,
//         last_updated_by_store: product.last_updated_by_store,
//         last_synced_at: product.last_synced_at,
//         updated_at: product.updated_at,
//         variants: product.variants?.map(v => ({
//           sku: v.sku,
//           storeA_id: v.storeA_id,
//           storeB_id: v.storeB_id,
//           inventory_quantity_storeA: v.inventory_quantity_storeA,
//           inventory_quantity_storeB: v.inventory_quantity_storeB
//         }))
//       }
//     });

//   } catch (error) {
//     logger.error('Error getting sync status:', error);
//     res.status(500).json({
//       error: 'Failed to get sync status',
//       message: error.message
//     });
//   }
// });

// /**
//  * Get all synchronized products
//  * GET /sync/products?limit=50&offset=0
//  */
// router.get('/products', async (req, res) => {
//   try {
//     const limit = Math.min(parseInt(req.query.limit) || 50, 250);
    
//     const products = await firebase.getAllProducts(limit);

//     const summary = products.map(product => ({
//       syncId: product.id,
//       title: product.title,
//       storeA_id: product.storeA_id,
//       storeB_id: product.storeB_id,
//       last_updated_by_store: product.last_updated_by_store,
//       last_synced_at: product.last_synced_at,
//       variant_count: product.variants?.length || 0,
//       status: product.status
//     }));

//     res.json({
//       success: true,
//       count: products.length,
//       products: summary
//     });

//   } catch (error) {
//     logger.error('Error getting synchronized products:', error);
//     res.status(500).json({
//       error: 'Failed to get products',
//       message: error.message
//     });
//   }
// });

// /**
//  * Get sync logs
//  * GET /sync/logs?limit=100&operation=create&status=success
//  */
// router.get('/logs', async (req, res) => {
//   try {
//     const limit = Math.min(parseInt(req.query.limit) || 100, 500);
//     const operation = req.query.operation;
//     const status = req.query.status;

//     // Build query
//     let query = firebase.db.collection(firebase.collections.syncLogs)
//       .orderBy('timestamp', 'desc')
//       .limit(limit);

//     if (operation) {
//       query = query.where('operation', '==', operation);
//     }

//     if (status) {
//       query = query.where('status', '==', status);
//     }

//     const snapshot = await query.get();
//     const logs = snapshot.docs.map(doc => ({
//       id: doc.id,
//       ...doc.data(),
//       timestamp: doc.data().timestamp?.toDate()
//     }));

//     res.json({
//       success: true,
//       count: logs.length,
//       logs
//     });

//   } catch (error) {
//     logger.error('Error getting sync logs:', error);
//     res.status(500).json({
//       error: 'Failed to get sync logs',
//       message: error.message
//     });
//   }
// });

// /**
//  * Force resync a product (ignores last update checks)
//  * POST /sync/force-resync
//  * Body: { syncId: 'abc123', direction: 'storeA_to_storeB' }
//  */
// router.post('/force-resync', async (req, res) => {
//   try {
//     const { syncId, direction } = req.body;

//     if (!syncId || !direction) {
//       return res.status(400).json({
//         error: 'Missing required fields: syncId, direction'
//       });
//     }

//     const [sourceStore, , targetStore] = direction.split('_');
    
//     if (!['storeA', 'storeB'].includes(sourceStore) || !['storeA', 'storeB'].includes(targetStore)) {
//       return res.status(400).json({
//         error: 'Invalid direction. Must be storeA_to_storeB or storeB_to_storeA'
//       });
//     }

//     // Get product from Firebase
//     const product = await firebase.getProductBySyncId(syncId);
//     if (!product) {
//       return res.status(404).json({
//         error: 'Product not found',
//         syncId
//       });
//     }

//     const sourceProductId = product[`${sourceStore}_id`];
//     if (!sourceProductId) {
//       return res.status(400).json({
//         error: `No ${sourceStore} ID found for this product`
//       });
//     }

//     // Get fresh product data from source store
//     const sourceAPI = syncService.stores[sourceStore].api;
//     const productData = await sourceAPI.getProduct(sourceProductId);

//     // Force sync by temporarily updating the last_updated_by_store
//     await firebase.saveProduct(syncId, {
//       ...product,
//       last_updated_by_store: targetStore // This will allow the sync to proceed
//     });

//     // Perform sync
//     const result = await syncService.syncProduct(sourceStore, productData, 'update');

//     res.json({
//       success: true,
//       result,
//       message: 'Force resync completed'
//     });

//   } catch (error) {
//     logger.error('Error in force resync:', error);
//     res.status(500).json({
//       error: 'Force resync failed',
//       message: error.message
//     });
//   }
// });

// module.exports = router;

