const ShopifyAPI = require('./shopifyAPI');
const FirebaseService = require('./firebaseService');
const logger = require('../utils/logger');
const { sanitizeProductData, createVariantMapping, generateSyncId, retryWithBackoff } = require('../utils/helpers');

class SyncService {
  constructor() {
    this.storeA = new ShopifyAPI(process.env.STORE_A_DOMAIN, process.env.STORE_A_ACCESS_TOKEN);
    this.storeB = new ShopifyAPI(process.env.STORE_B_DOMAIN, process.env.STORE_B_ACCESS_TOKEN);
    this.firebase = new FirebaseService();
    
    // Store identifiers for mapping
    this.stores = {
      storeA: { api: this.storeA, id: 'storeA' },
      storeB: { api: this.storeB, id: 'storeB' }
    };
  }

  /**
   * Sync a product from source store to target store
   * @param {string} sourceStore - Source store identifier (storeA or storeB)
   * @param {object} productData - Shopify product data
   * @param {string} operation - Operation type (create, update, delete)
   * @returns {Promise<object>} - Sync result
   */
  async syncProduct(sourceStore, productData, operation = 'create') {
    const targetStore = sourceStore === 'storeA' ? 'storeB' : 'storeA';
    const sourceAPI = this.stores[sourceStore].api;
    const targetAPI = this.stores[targetStore].api;
    
    logger.info(`Starting ${operation} sync from ${sourceStore} to ${targetStore} for product: ${productData.id}`);
    
    try {
      // Sanitize product data
      const sanitizedProduct = sanitizeProductData(productData);
      
      // Generate or find sync ID
      let syncId;
      let existingProduct = null;
      
      // Try to find existing product by store ID first
      existingProduct = await this.firebase.getProductByStoreId(sourceStore, productData.id.toString());
      
      if (existingProduct) {
        syncId = existingProduct.id;
      } else {
        // Try to find by SKU if available
        const mainSku = sanitizedProduct.variants[0]?.sku;
        if (mainSku) {
          existingProduct = await this.firebase.getProductBySku(mainSku);
          if (existingProduct) {
            syncId = existingProduct.id;
          }
        }
        
        // Generate new sync ID if not found
        if (!syncId) {
          syncId = generateSyncId(mainSku, sanitizedProduct.title);
        }
      }

      let result = {};

      switch (operation) {
        case 'create':
          result = await this.handleProductCreate(syncId, sourceStore, targetStore, sanitizedProduct, targetAPI);
          break;
        case 'update':
          result = await this.handleProductUpdate(syncId, sourceStore, targetStore, sanitizedProduct, targetAPI, existingProduct);
          break;
        case 'delete':
          result = await this.handleProductDelete(syncId, sourceStore, targetStore, productData.id);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      // Log sync operation
      await this.firebase.logSyncOperation({
        sync_id: syncId,
        operation,
        source_store: sourceStore,
        target_store: targetStore,
        source_product_id: productData.id.toString(),
        target_product_id: result.targetProductId || null,
        status: result.success ? 'success' : 'failed',
        error: result.error || null
      });

      return result;

    } catch (error) {
      logger.error(`Error syncing product ${productData.id} from ${sourceStore} to ${targetStore}:`, error);
      
      // Log failed operation
      await this.firebase.logSyncOperation({
        operation,
        source_store: sourceStore,
        target_store: targetStore,
        source_product_id: productData.id.toString(),
        status: 'failed',
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Handle product creation
   */
  async handleProductCreate(syncId, sourceStore, targetStore, productData, targetAPI) {
    try {
      // Prepare product data for target store
      const targetProductData = this.prepareProductForTarget(productData);
      
      // Create product in target store
      const createdProduct = await targetAPI.createProduct(targetProductData);
      
      // Prepare Firebase document
      const firebaseData = {
        title: productData.title,
        description: productData.description,
        vendor: productData.vendor,
        product_type: productData.product_type,
        status: productData.status,
        handle: productData.handle,
        tags: productData.tags,
        images: productData.images,
        variants: this.prepareVariantsForFirebase(productData.variants, sourceStore, createdProduct.variants),
        options: productData.options,
        [`${sourceStore}_id`]: productData.id.toString(),
        [`${targetStore}_id`]: createdProduct.id.toString(),
        last_updated_by_store: sourceStore,
        created_at: productData.created_at,
        updated_at: productData.updated_at
      };

      // Save to Firebase
      await this.firebase.saveProduct(syncId, firebaseData);

      // Sync initial inventory
      await this.syncInitialInventory(syncId, sourceStore, targetStore, productData.variants, createdProduct.variants);

      logger.info(`Successfully created product ${createdProduct.id} in ${targetStore}`);
      
      return {
        success: true,
        syncId,
        targetProductId: createdProduct.id.toString(),
        operation: 'create'
      };

    } catch (error) {
      logger.error('Error in handleProductCreate:', error);
      return {
        success: false,
        error: error.message,
        operation: 'create'
      };
    }
  }

  /**
   * Handle product update
   */
  async handleProductUpdate(syncId, sourceStore, targetStore, productData, targetAPI, existingProduct) {
    try {
      if (!existingProduct) {
        // If product doesn't exist in Firebase, treat as create
        return await this.handleProductCreate(syncId, sourceStore, targetStore, productData, targetAPI);
      }

      // Check if this update should be processed (avoid infinite loops)
      if (existingProduct.last_updated_by_store === sourceStore && 
          new Date(existingProduct.updated_at) >= new Date(productData.updated_at)) {
        logger.info(`Skipping update for product ${productData.id} - already up to date`);
        return { success: true, skipped: true, operation: 'update' };
      }

      const targetProductId = existingProduct[`${targetStore}_id`];
      if (!targetProductId) {
        logger.warn(`No ${targetStore} ID found for product ${productData.id}, treating as create`);
        return await this.handleProductCreate(syncId, sourceStore, targetStore, productData, targetAPI);
      }

      // Prepare update data
      const updateData = this.prepareProductForTarget(productData, true);
      
      // Update product in target store
      const updatedProduct = await targetAPI.updateProduct(targetProductId, updateData);

      // Update Firebase document
      const firebaseData = {
        title: productData.title,
        description: productData.description,
        vendor: productData.vendor,
        product_type: productData.product_type,
        status: productData.status,
        handle: productData.handle,
        tags: productData.tags,
        images: productData.images,
        variants: this.mergeVariantsForFirebase(existingProduct.variants, productData.variants, sourceStore, updatedProduct.variants, targetStore),
        options: productData.options,
        [`${sourceStore}_id`]: productData.id.toString(),
        last_updated_by_store: sourceStore,
        updated_at: productData.updated_at
      };

      await this.firebase.saveProduct(syncId, firebaseData);

      logger.info(`Successfully updated product ${targetProductId} in ${targetStore}`);
      
      return {
        success: true,
        syncId,
        targetProductId: targetProductId,
        operation: 'update'
      };

    } catch (error) {
      logger.error('Error in handleProductUpdate:', error);
      return {
        success: false,
        error: error.message,
        operation: 'update'
      };
    }
  }

  /**
   * Handle product deletion
   */
  async handleProductDelete(syncId, sourceStore, targetStore, sourceProductId) {
    try {
      // Get existing product from Firebase
      const existingProduct = await this.firebase.getProductByStoreId(sourceStore, sourceProductId.toString());
      
      if (!existingProduct) {
        logger.warn(`Product ${sourceProductId} not found in Firebase for deletion`);
        return { success: true, skipped: true, operation: 'delete' };
      }

      const targetProductId = existingProduct[`${targetStore}_id`];
      if (targetProductId) {
        // Delete from target store
        const targetAPI = this.stores[targetStore].api;
        await targetAPI.deleteProduct(targetProductId);
        logger.info(`Successfully deleted product ${targetProductId} from ${targetStore}`);
      }

      // Delete from Firebase
      await this.firebase.deleteProduct(existingProduct.id);

      return {
        success: true,
        syncId: existingProduct.id,
        targetProductId: targetProductId,
        operation: 'delete'
      };

    } catch (error) {
      logger.error('Error in handleProductDelete:', error);
      return {
        success: false,
        error: error.message,
        operation: 'delete'
      };
    }
  }

  /**
   * Sync inventory level between stores
   */
  async syncInventory(sourceStore, inventoryItemId, locationId, newQuantity) {
    const targetStore = sourceStore === 'storeA' ? 'storeB' : 'storeA';
    
    try {
      // Find the product and variant in Firebase
      const products = await this.firebase.getAllProducts();
      let targetProduct = null;
      let targetVariant = null;
      
      for (const product of products) {
        const variant = product.variants?.find(v => 
          v[`inventory_item_${sourceStore}_id`] === inventoryItemId
        );
        if (variant) {
          targetProduct = product;
          targetVariant = variant;
          break;
        }
      }

      if (!targetProduct || !targetVariant) {
        logger.warn(`No matching variant found for inventory item ${inventoryItemId}`);
        return { success: false, error: 'Variant not found' };
      }

      // Get target store's inventory item ID and location
      const targetInventoryItemId = targetVariant[`inventory_item_${targetStore}_id`];
      const targetLocationId = await this.getTargetLocationId(targetStore, locationId);

      if (!targetInventoryItemId || !targetLocationId) {
        logger.warn(`Missing target inventory item or location mapping`);
        return { success: false, error: 'Missing target mapping' };
      }

      // Update inventory in target store
      const targetAPI = this.stores[targetStore].api;
      await targetAPI.updateInventoryLevel(targetInventoryItemId, targetLocationId, newQuantity);

      // Update Firebase
      await this.firebase.updateVariantInventory(targetProduct.id, targetVariant.sku, targetStore, newQuantity);

      logger.info(`Successfully synced inventory: ${newQuantity} units for variant ${targetVariant.sku}`);

      return {
        success: true,
        syncId: targetProduct.id,
        variantSku: targetVariant.sku,
        newQuantity,
        operation: 'inventory_update'
      };

    } catch (error) {
      logger.error(`Error syncing inventory for item ${inventoryItemId}:`, error);
      throw error;
    }
  }

  /**
   * Prepare product data for target store (remove store-specific fields)
   */
  prepareProductForTarget(productData, isUpdate = false) {
    const targetData = {
      title: productData.title,
      body_html: productData.description,
      vendor: productData.vendor,
      product_type: productData.product_type,
      status: productData.status,
      tags: productData.tags,
      images: productData.images?.map(img => ({
        src: img.src,
        alt: img.alt,
        position: img.position
      })),
      variants: productData.variants?.map(variant => ({
        sku: variant.sku,
        price: variant.price,
        compare_at_price: variant.compare_at_price,
        inventory_policy: variant.inventory_policy,
        fulfillment_service: variant.fulfillment_service,
        inventory_management: variant.inventory_management,
        option1: variant.option1,
        option2: variant.option2,
        option3: variant.option3,
        weight: variant.weight,
        weight_unit: variant.weight_unit,
        requires_shipping: variant.requires_shipping,
        taxable: variant.taxable
      })),
      options: productData.options
    };

    // Remove empty/null values
    return this.cleanObjectData(targetData);
  }

  /**
   * Prepare variants for Firebase storage with both store mappings
   */
  prepareVariantsForFirebase(sourceVariants, sourceStore, targetVariants) {
    return sourceVariants.map((sourceVariant, index) => {
      const targetVariant = targetVariants[index];
      return {
        sku: sourceVariant.sku,
        price: sourceVariant.price,
        compare_at_price: sourceVariant.compare_at_price,
        inventory_policy: sourceVariant.inventory_policy,
        fulfillment_service: sourceVariant.fulfillment_service,
        inventory_management: sourceVariant.inventory_management,
        option1: sourceVariant.option1,
        option2: sourceVariant.option2,
        option3: sourceVariant.option3,
        position: sourceVariant.position,
        weight: sourceVariant.weight,
        weight_unit: sourceVariant.weight_unit,
        requires_shipping: sourceVariant.requires_shipping,
        taxable: sourceVariant.taxable,
        [`${sourceStore}_id`]: sourceVariant.id.toString(),
        [`${sourceStore === 'storeA' ? 'storeB' : 'storeA'}_id`]: targetVariant?.id.toString(),
        [`inventory_item_${sourceStore}_id`]: sourceVariant.inventory_item_id,
        [`inventory_item_${sourceStore === 'storeA' ? 'storeB' : 'storeA'}_id`]: targetVariant?.inventory_item_id,
        [`inventory_quantity_${sourceStore}`]: sourceVariant.inventory_quantity,
        [`inventory_quantity_${sourceStore === 'storeA' ? 'storeB' : 'storeA'}`]: targetVariant?.inventory_quantity || 0
      };
    });
  }

  /**
   * Merge variants for Firebase during updates
   */
  mergeVariantsForFirebase(existingVariants, sourceVariants, sourceStore, targetVariants, targetStore) {
    const variantMap = new Map();
    
    // Index existing variants by SKU
    existingVariants?.forEach(variant => {
      if (variant.sku) {
        variantMap.set(variant.sku, variant);
      }
    });

    // Update with source variants
    sourceVariants.forEach((sourceVariant, index) => {
      const targetVariant = targetVariants[index];
      const existing = variantMap.get(sourceVariant.sku) || {};
      
      variantMap.set(sourceVariant.sku, {
        ...existing,
        sku: sourceVariant.sku,
        price: sourceVariant.price,
        compare_at_price: sourceVariant.compare_at_price,
        inventory_policy: sourceVariant.inventory_policy,
        fulfillment_service: sourceVariant.fulfillment_service,
        inventory_management: sourceVariant.inventory_management,
        option1: sourceVariant.option1,
        option2: sourceVariant.option2,
        option3: sourceVariant.option3,
        position: sourceVariant.position,
        weight: sourceVariant.weight,
        weight_unit: sourceVariant.weight_unit,
        requires_shipping: sourceVariant.requires_shipping,
        taxable: sourceVariant.taxable,
        [`${sourceStore}_id`]: sourceVariant.id.toString(),
        [`inventory_item_${sourceStore}_id`]: sourceVariant.inventory_item_id,
        [`inventory_quantity_${sourceStore}`]: sourceVariant.inventory_quantity,
        // Preserve target store data if available
        [`${targetStore}_id`]: targetVariant?.id.toString() || existing[`${targetStore}_id`],
        [`inventory_item_${targetStore}_id`]: targetVariant?.inventory_item_id || existing[`inventory_item_${targetStore}_id`],
        [`inventory_quantity_${targetStore}`]: targetVariant?.inventory_quantity || existing[`inventory_quantity_${targetStore}`] || 0
      });
    });

    return Array.from(variantMap.values());
  }

  /**
   * Sync initial inventory after product creation
   */
  async syncInitialInventory(syncId, sourceStore, targetStore, sourceVariants, targetVariants) {
    try {
      const sourceAPI = this.stores[sourceStore].api;
      const targetAPI = this.stores[targetStore].api;
      
      // Get locations for both stores
      const sourceLocations = await sourceAPI.getLocations();
      const targetLocations = await targetAPI.getLocations();
      
      const primarySourceLocation = sourceLocations.find(loc => loc.primary) || sourceLocations[0];
      const primaryTargetLocation = targetLocations.find(loc => loc.primary) || targetLocations[0];

      if (!primarySourceLocation || !primaryTargetLocation) {
        logger.warn('Could not find primary locations for inventory sync');
        return;
      }

      // Sync inventory for each variant
      for (let i = 0; i < sourceVariants.length && i < targetVariants.length; i++) {
        const sourceVariant = sourceVariants[i];
        const targetVariant = targetVariants[i];

        try {
          // Get current inventory level from source
          const sourceInventory = await sourceAPI.getInventoryLevel(
            sourceVariant.inventory_item_id,
            primarySourceLocation.id
          );

          if (sourceInventory && sourceInventory.available !== undefined) {
            // Set inventory level in target store
            await targetAPI.updateInventoryLevel(
              targetVariant.inventory_item_id,
              primaryTargetLocation.id,
              sourceInventory.available
            );

            logger.info(`Synced initial inventory for variant ${sourceVariant.sku}: ${sourceInventory.available} units`);
          }
        } catch (error) {
          logger.error(`Error syncing initial inventory for variant ${sourceVariant.sku}:`, error);
          // Continue with other variants
        }
      }
    } catch (error) {
      logger.error('Error in syncInitialInventory:', error);
      // Don't throw error as this is not critical for product creation
    }
  }

  /**
   * Get target location ID mapping
   */
  async getTargetLocationId(targetStore, sourceLocationId) {
    try {
      // For simplicity, use primary location
      // In production, you might want to maintain location mappings
      const targetAPI = this.stores[targetStore].api;
      const locations = await targetAPI.getLocations();
      const primaryLocation = locations.find(loc => loc.primary) || locations[0];
      return primaryLocation?.id;
    } catch (error) {
      logger.error('Error getting target location ID:', error);
      return null;
    }
  }

  /**
   * Clean object data by removing null/undefined values
   */
  cleanObjectData(obj) {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          cleaned[key] = value.filter(item => item !== null && item !== undefined);
        } else if (typeof value === 'object') {
          cleaned[key] = this.cleanObjectData(value);
        } else {
          cleaned[key] = value;
        }
      }
    }
    return cleaned;
  }

  /**
   * Perform bulk synchronization (for initial setup)
   */
  async performBulkSync(sourceStore, targetStore, options = {}) {
    const { limit = 50, skipExisting = true } = options;
    
    logger.info(`Starting bulk sync from ${sourceStore} to ${targetStore}`);
    
    try {
      const sourceAPI = this.stores[sourceStore].api;
      const products = await sourceAPI.getAllProducts(limit);
      
      const results = {
        total: products.length,
        success: 0,
        failed: 0,
        skipped: 0,
        errors: []
      };

      for (const product of products) {
        try {
          // Check if product already exists if skipExisting is true
          if (skipExisting) {
            const existing = await this.firebase.getProductByStoreId(sourceStore, product.id.toString());
            if (existing && existing[`${targetStore}_id`]) {
              results.skipped++;
              continue;
            }
          }

          const result = await this.syncProduct(sourceStore, product, 'create');
          if (result.success) {
            results.success++;
          } else {
            results.failed++;
            results.errors.push({
              productId: product.id,
              error: result.error
            });
          }

          // Add delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          results.failed++;
          results.errors.push({
            productId: product.id,
            error: error.message
          });
          logger.error(`Error syncing product ${product.id}:`, error);
        }
      }

      logger.info(`Bulk sync completed: ${results.success} success, ${results.failed} failed, ${results.skipped} skipped`);
      return results;

    } catch (error) {
      logger.error('Error in bulk sync:', error);
      throw error;
    }
  }
}

module.exports = SyncService;

