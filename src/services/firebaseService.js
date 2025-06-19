const admin = require('firebase-admin');
const logger = require('../utils/logger');

class FirebaseService {
  constructor() {
    if (!admin.apps.length) {
      // Initialize Firebase Admin SDK
      const serviceAccount = require('../../config/firebase-service-account.json');
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
      });
    }
    
    this.db = admin.firestore();
    this.collections = {
      products: 'products',
      syncLogs: 'sync_logs',
      config: 'config'
    };
  }

  /**
   * Get a product by sync ID
   * @param {string} syncId - Internal sync ID
   * @returns {Promise<object|null>} - Product document or null
   */
  async getProductBySyncId(syncId) {
    try {
      const doc = await this.db.collection(this.collections.products).doc(syncId).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (error) {
      logger.error('Error getting product by sync ID:', error);
      throw error;
    }
  }

  /**
   * Get a product by store ID
   * @param {string} storeId - Store identifier (storeA or storeB)
   * @param {string} productId - Shopify product ID
   * @returns {Promise<object|null>} - Product document or null
   */
  async getProductByStoreId(storeId, productId) {
    try {
      const query = await this.db.collection(this.collections.products)
        .where(`${storeId}_id`, '==', productId)
        .limit(1)
        .get();
      
      if (query.empty) return null;
      
      const doc = query.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logger.error('Error getting product by store ID:', error);
      throw error;
    }
  }

  /**
   * Get a product by SKU
   * @param {string} sku - Product SKU
   * @returns {Promise<object|null>} - Product document or null
   */
  async getProductBySku(sku) {
    try {
      const query = await this.db.collection(this.collections.products)
        .where('variants', 'array-contains-any', [{ sku }])
        .limit(1)
        .get();
      
      if (query.empty) return null;
      
      const doc = query.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logger.error('Error getting product by SKU:', error);
      throw error;
    }
  }

  /**
   * Create or update a product
   * @param {string} syncId - Internal sync ID
   * @param {object} productData - Product data
   * @returns {Promise<void>}
   */
  async saveProduct(syncId, productData) {
    try {
      const docRef = this.db.collection(this.collections.products).doc(syncId);
      await docRef.set({
        ...productData,
        last_synced_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      logger.info(`Product saved with sync ID: ${syncId}`);
    } catch (error) {
      logger.error('Error saving product:', error);
      throw error;
    }
  }

  /**
   * Delete a product
   * @param {string} syncId - Internal sync ID
   * @returns {Promise<void>}
   */
  async deleteProduct(syncId) {
    try {
      await this.db.collection(this.collections.products).doc(syncId).delete();
      logger.info(`Product deleted with sync ID: ${syncId}`);
    } catch (error) {
      logger.error('Error deleting product:', error);
      throw error;
    }
  }

  /**
   * Update product store mapping
   * @param {string} syncId - Internal sync ID
   * @param {string} storeId - Store identifier (storeA or storeB)
   * @param {string} productId - Shopify product ID
   * @returns {Promise<void>}
   */
  async updateProductStoreMapping(syncId, storeId, productId) {
    try {
      const docRef = this.db.collection(this.collections.products).doc(syncId);
      await docRef.update({
        [`${storeId}_id`]: productId,
        last_synced_at: admin.firestore.FieldValue.serverTimestamp()
      });
      
      logger.info(`Updated ${storeId} mapping for sync ID: ${syncId}`);
    } catch (error) {
      logger.error('Error updating product store mapping:', error);
      throw error;
    }
  }

  /**
   * Update inventory for a variant
   * @param {string} syncId - Internal sync ID
   * @param {string} variantSku - Variant SKU
   * @param {string} storeId - Store identifier
   * @param {number} quantity - New quantity
   * @returns {Promise<void>}
   */
  async updateVariantInventory(syncId, variantSku, storeId, quantity) {
    try {
      const docRef = this.db.collection(this.collections.products).doc(syncId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        throw new Error(`Product not found with sync ID: ${syncId}`);
      }
      
      const productData = doc.data();
      const variants = productData.variants || [];
      
      // Find and update the variant
      const updatedVariants = variants.map(variant => {
        if (variant.sku === variantSku) {
          return {
            ...variant,
            [`inventory_quantity_${storeId}`]: quantity
          };
        }
        return variant;
      });
      
      await docRef.update({
        variants: updatedVariants,
        last_synced_at: admin.firestore.FieldValue.serverTimestamp()
      });
      
      logger.info(`Updated inventory for variant ${variantSku} in ${storeId}`);
    } catch (error) {
      logger.error('Error updating variant inventory:', error);
      throw error;
    }
  }

  /**
   * Log sync operation
   * @param {object} logData - Log data
   * @returns {Promise<void>}
   */
  async logSyncOperation(logData) {
    try {
      await this.db.collection(this.collections.syncLogs).add({
        ...logData,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Error logging sync operation:', error);
      // Don't throw error for logging failures
    }
  }

  /**
   * Get configuration value
   * @param {string} key - Configuration key
   * @returns {Promise<any>} - Configuration value
   */
  async getConfig(key) {
    try {
      const doc = await this.db.collection(this.collections.config).doc(key).get();
      return doc.exists ? doc.data().value : null;
    } catch (error) {
      logger.error('Error getting config:', error);
      throw error;
    }
  }

  /**
   * Set configuration value
   * @param {string} key - Configuration key
   * @param {any} value - Configuration value
   * @returns {Promise<void>}
   */
  async setConfig(key, value) {
    try {
      await this.db.collection(this.collections.config).doc(key).set({
        value,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error('Error setting config:', error);
      throw error;
    }
  }

  /**
   * Get all products (for bulk operations)
   * @param {number} limit - Limit number of results
   * @returns {Promise<Array>} - Array of products
   */
  async getAllProducts(limit = 1000) {
    try {
      const query = await this.db.collection(this.collections.products)
        .limit(limit)
        .get();
      
      return query.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error('Error getting all products:', error);
      throw error;
    }
  }
}

module.exports = FirebaseService;

