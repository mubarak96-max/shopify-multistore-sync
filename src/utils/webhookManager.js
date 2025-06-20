// const ShopifyAPI = require('../services/shopifyAPI');
// const logger = require('../utils/logger');

// class WebhookManager {
//   constructor() {
//     this.storeA = new ShopifyAPI(process.env.STORE_A_DOMAIN, process.env.STORE_A_ACCESS_TOKEN);
//     this.storeB = new ShopifyAPI(process.env.STORE_B_DOMAIN, process.env.STORE_B_ACCESS_TOKEN);
//     this.baseUrl = process.env.WEBHOOK_BASE_URL;
//   }

//   /**
//    * Register all required webhooks for both stores
//    */
//   async registerAllWebhooks() {
//     if (!this.baseUrl) {
//       throw new Error('WEBHOOK_BASE_URL environment variable is required');
//     }

//     logger.info('Starting webhook registration for both stores');

//     const results = {
//       storeA: await this.registerStoreWebhooks('storeA'),
//       storeB: await this.registerStoreWebhooks('storeB')
//     };

//     logger.info('Webhook registration completed:', results);
//     return results;
//   }

//   /**
//    * Register webhooks for a specific store
//    */
//   async registerStoreWebhooks(storeId) {
//     const api = storeId === 'storeA' ? this.storeA : this.storeB;
//     const storePrefix = storeId === 'storeA' ? 'store-a' : 'store-b';
    
//     const webhooks = [
//       {
//         topic: 'products/create',
//         address: `${this.baseUrl}/webhooks/${storePrefix}/products/create`,
//         format: 'json'
//       },
//       {
//         topic: 'products/update',
//         address: `${this.baseUrl}/webhooks/${storePrefix}/products/update`,
//         format: 'json'
//       },
//       {
//         topic: 'products/delete',
//         address: `${this.baseUrl}/webhooks/${storePrefix}/products/delete`,
//         format: 'json'
//       },
//       {
//         topic: 'inventory_levels/update',
//         address: `${this.baseUrl}/webhooks/${storePrefix}/inventory_levels/update`,
//         format: 'json'
//       }
//     ];

//     const results = {
//       store: storeId,
//       registered: [],
//       errors: [],
//       existing: []
//     };

//     // Get existing webhooks to avoid duplicates
//     const existingWebhooks = await api.getWebhooks();
    
//     for (const webhookConfig of webhooks) {
//       try {
//         // Check if webhook already exists
//         const existing = existingWebhooks.find(w => 
//           w.topic === webhookConfig.topic && w.address === webhookConfig.address
//         );

//         if (existing) {
//           logger.info(`Webhook already exists: ${webhookConfig.topic} -> ${webhookConfig.address}`);
//           results.existing.push({
//             topic: webhookConfig.topic,
//             address: webhookConfig.address,
//             id: existing.id
//           });
//           continue;
//         }

//         // Register new webhook
//         const webhook = await api.createWebhook(webhookConfig);
        
//         logger.info(`Registered webhook: ${webhook.topic} -> ${webhook.address}`);
//         results.registered.push({
//           topic: webhook.topic,
//           address: webhook.address,
//           id: webhook.id
//         });

//       } catch (error) {
//         logger.error(`Error registering webhook ${webhookConfig.topic}:`, error);
//         results.errors.push({
//           topic: webhookConfig.topic,
//           address: webhookConfig.address,
//           error: error.message
//         });
//       }
//     }

//     return results;
//   }

//   /**
//    * List all webhooks for both stores
//    */
//   async listAllWebhooks() {
//     const results = {
//       storeA: await this.listStoreWebhooks('storeA'),
//       storeB: await this.listStoreWebhooks('storeB')
//     };

//     return results;
//   }

//   /**
//    * List webhooks for a specific store
//    */
//   async listStoreWebhooks(storeId) {
//     try {
//       const api = storeId === 'storeA' ? this.storeA : this.storeB;
//       const webhooks = await api.getWebhooks();
      
//       return {
//         store: storeId,
//         count: webhooks.length,
//         webhooks: webhooks.map(w => ({
//           id: w.id,
//           topic: w.topic,
//           address: w.address,
//           format: w.format,
//           created_at: w.created_at,
//           updated_at: w.updated_at
//         }))
//       };
//     } catch (error) {
//       logger.error(`Error listing webhooks for ${storeId}:`, error);
//       return {
//         store: storeId,
//         error: error.message
//       };
//     }
//   }

//   /**
//    * Delete all sync-related webhooks
//    */
//   async deleteAllSyncWebhooks() {
//     logger.info('Starting deletion of sync-related webhooks');

//     const results = {
//       storeA: await this.deleteSyncWebhooks('storeA'),
//       storeB: await this.deleteSyncWebhooks('storeB')
//     };

//     logger.info('Webhook deletion completed:', results);
//     return results;
//   }

//   /**
//    * Delete sync webhooks for a specific store
//    */
//   async deleteSyncWebhooks(storeId) {
//     try {
//       const api = storeId === 'storeA' ? this.storeA : this.storeB;
//       const webhooks = await api.getWebhooks();
      
//       const syncTopics = [
//         'products/create',
//         'products/update', 
//         'products/delete',
//         'inventory_levels/update'
//       ];

//       const results = {
//         store: storeId,
//         deleted: [],
//         errors: []
//       };

//       for (const webhook of webhooks) {
//         if (syncTopics.includes(webhook.topic) && 
//             webhook.address.includes(this.baseUrl)) {
          
//           try {
//             await api.deleteWebhook(webhook.id);
//             logger.info(`Deleted webhook: ${webhook.topic} (${webhook.id})`);
//             results.deleted.push({
//               id: webhook.id,
//               topic: webhook.topic,
//               address: webhook.address
//             });
//           } catch (error) {
//             logger.error(`Error deleting webhook ${webhook.id}:`, error);
//             results.errors.push({
//               id: webhook.id,
//               topic: webhook.topic,
//               error: error.message
//             });
//           }
//         }
//       }

//       return results;
//     } catch (error) {
//       logger.error(`Error deleting webhooks for ${storeId}:`, error);
//       return {
//         store: storeId,
//         error: error.message
//       };
//     }
//   }

//   /**
//    * Test webhook connectivity
//    */
//   async testWebhookConnectivity() {
//     const testUrl = `${this.baseUrl}/webhooks/test`;
    
//     const testWebhook = {
//       topic: 'app/uninstalled', // Safe topic for testing
//       address: testUrl,
//       format: 'json'
//     };

//     const results = {
//       storeA: await this.testStoreWebhook('storeA', testWebhook),
//       storeB: await this.testStoreWebhook('storeB', testWebhook)
//     };

//     return results;
//   }

//   /**
//    * Test webhook for a specific store
//    */
//   async testStoreWebhook(storeId, webhookConfig) {
//     try {
//       const api = storeId === 'storeA' ? this.storeA : this.storeB;
      
//       // Create test webhook
//       const webhook = await api.createWebhook(webhookConfig);
      
//       // Immediately delete it
//       await api.deleteWebhook(webhook.id);
      
//       return {
//         store: storeId,
//         success: true,
//         message: 'Webhook connectivity test passed'
//       };
//     } catch (error) {
//       logger.error(`Webhook connectivity test failed for ${storeId}:`, error);
//       return {
//         store: storeId,
//         success: false,
//         error: error.message
//       };
//     }
//   }

//   /**
//    * Validate webhook configuration
//    */
//   validateConfiguration() {
//     const errors = [];
    
//     if (!process.env.WEBHOOK_BASE_URL) {
//       errors.push('WEBHOOK_BASE_URL environment variable is required');
//     }
    
//     if (!process.env.STORE_A_DOMAIN || !process.env.STORE_A_ACCESS_TOKEN) {
//       errors.push('Store A configuration is incomplete');
//     }
    
//     if (!process.env.STORE_B_DOMAIN || !process.env.STORE_B_ACCESS_TOKEN) {
//       errors.push('Store B configuration is incomplete');
//     }
    
//     if (!process.env.WEBHOOK_SECRET_A || !process.env.WEBHOOK_SECRET_B) {
//       errors.push('Webhook secrets are required for both stores');
//     }

//     return {
//       valid: errors.length === 0,
//       errors
//     };
//   }
// }

// module.exports = WebhookManager;

