// src/services/firebaseService.js

const admin = require("firebase-admin");
const logger = require("../utils/logger");

class FirebaseService {
  constructor() {
    if (!admin.apps.length) {
      // Ensure all required environment variables are set
      const requiredEnvVars = [
        "FIREBASE_PROJECT_ID",
        "FIREBASE_PRIVATE_KEY_ID",
        "FIREBASE_PRIVATE_KEY",
        "FIREBASE_CLIENT_EMAIL",
        "FIREBASE_CLIENT_ID",
        "FIREBASE_AUTH_URI",
        "FIREBASE_TOKEN_URI",
        // Add other fields if you need them, like auth_provider_x509_cert_url, client_x509_cert_url, universe_domain
      ];

      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          throw new Error(`Missing Firebase environment variable: ${envVar}`);
        }
      }

      // Construct the service account object from environment variables
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        // The private_key needs its newlines correctly interpreted
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI,
        token_uri: process.env.FIREBASE_TOKEN_URI,
        // Add these if you include them in your .env / Render envs
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL || `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`,
        universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN || "googleapis.com"
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount ),
        databaseURL: process.env.FIREBASE_DATABASE_URL, // Still use this if you have a Realtime Database URL
      });
    }

    this.db = admin.firestore();
    this.collections = {
      products: "products",
      syncLogs: "sync_logs",
      config: "config",
    };
  }

  // ... rest of your class ...
}

module.exports = FirebaseService;
