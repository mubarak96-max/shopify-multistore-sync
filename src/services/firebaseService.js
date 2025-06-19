// src/services/firebaseService.js

const admin = require('firebase-admin');
const logger = require('../utils/logger');

class FirebaseService {
  constructor() {
    if (!admin.apps.length) {
      // --- OLD WAY (comment out or remove) ---
      // const serviceAccount = require('../../config/firebase-service-account.json');
      
      // --- NEW WAY: Load from environment variable ---
      if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
      }
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      // ----------------------------------------------
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL // This can still be used if defined, but often not strictly needed for Firestore
      });
    }
    
    this.db = admin.firestore();
    this.collections = {
      products: 'products',
      syncLogs: 'sync_logs',
      config: 'config'
    };
  }

  // ... rest of your class ...
}

module.exports = FirebaseService;
