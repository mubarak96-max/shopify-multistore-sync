// src/services/firebaseService.js

const admin = require("firebase-admin");
const logger = require("../utils/logger");

class FirebaseService {
  constructor() {
    if (!admin.apps.length) {
      const requiredEnvVars = [
        "FIREBASE_PROJECT_ID",
        "FIREBASE_PRIVATE_KEY_ID",
        "FIREBASE_PRIVATE_KEY",
        "FIREBASE_CLIENT_EMAIL",
        "FIREBASE_CLIENT_ID",
        "FIREBASE_AUTH_URI",
        "FIREBASE_TOKEN_URI",
      ];

      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          throw new Error(`Missing Firebase environment variable: ${envVar}`);
        }
      }

      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      privateKey = privateKey.replace(/\n/g, "\n");
      privateKey = privateKey.replace(/\\n/g, "\n");

      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: privateKey,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI,
        token_uri: process.env.FIREBASE_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL || `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`,
        universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN || "googleapis.com"
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount ),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      });
    }

    this.db = admin.firestore();
    this.collections = {
      products: "products",
      syncLogs: "sync_logs",
      config: "config"
    };
  }

  // --- ADD THIS NEW METHOD ---
  async logSyncOperation(operation, status, details) {
    try {
      // Default status to 'unknown' if undefined
      const safeStatus = status === undefined ? 'unknown' : status;
      await this.db.collection(this.collections.syncLogs).add({
        operation,
        status: safeStatus,
        details,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      logger.error("Failed to log sync operation to Firebase:", error);
    }
  }

  /**
   * Find a product mapping by store and product ID
   * @param {string} store - 'storeA' or 'storeB'
   * @param {string|number} productId - Shopify product ID
   * @returns {Promise<object|null>} - Product mapping or null if not found
   */
  async getProductByStoreId(store, productId) {
    try {
      const query = await this.db
        .collection(this.collections.products)
        .where(`${store}_id`, "==", productId)
        .limit(1)
        .get();

      if (query.empty) {
        return null;
      }
      const doc = query.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      logger.error(`Failed to get product by store ID from Firebase:`, error);
      return null;
    }
  }

  // ... (rest of your existing methods like getProductBySyncId, getAllProducts, saveProduct, etc.)
}

module.exports = FirebaseService;
