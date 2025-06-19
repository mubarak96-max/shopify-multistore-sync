# Firebase Setup Guide

This guide provides detailed instructions for setting up Firebase for the Shopify synchronization system.

## Firebase Project Creation

### Step 1: Create Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click **Create a project** or **Add project**
3. Enter a project name (e.g., "shopify-sync-production")
4. Choose whether to enable Google Analytics (optional for this use case)
5. Select or create a Google Analytics account if enabled
6. Click **Create project**

### Step 2: Enable Cloud Firestore

1. In the Firebase Console, select your project
2. Navigate to **Firestore Database** in the left sidebar
3. Click **Create database**
4. Choose **Start in production mode** for security
5. Select a location for your database (choose closest to your users/servers)
6. Click **Done**

## Service Account Setup

### Step 1: Generate Service Account Key

1. In the Firebase Console, click the gear icon and select **Project settings**
2. Navigate to the **Service accounts** tab
3. Click **Generate new private key**
4. Click **Generate key** to download the JSON file
5. Save the file securely (this contains sensitive credentials)

### Step 2: Configure Service Account

1. Rename the downloaded file to `firebase-service-account.json`
2. Place it in the `config/` directory of your project
3. Ensure the file is not committed to version control (add to .gitignore)

## Firestore Security Rules

### Step 1: Configure Security Rules

1. In the Firebase Console, go to **Firestore Database**
2. Click on the **Rules** tab
3. Replace the default rules with the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow service account access
    match /{document=**} {
      allow read, write: if request.auth != null && 
        request.auth.token.firebase.sign_in_provider == 'custom';
    }
  }
}
```

4. Click **Publish** to save the rules

### Step 2: Test Security Rules

Use the Firebase Console's Rules Playground to test your security configuration:

1. Click **Rules Playground** in the Firestore Rules tab
2. Test read/write operations with and without authentication
3. Verify that unauthenticated requests are denied

## Database Structure

The synchronization system creates the following collections:

### Products Collection

```
products/{syncId}
├── title: string
├── description: string
├── vendor: string
├── product_type: string
├── status: string
├── storeA_id: string
├── storeB_id: string
├── variants: array
│   ├── sku: string
│   ├── storeA_id: string
│   ├── storeB_id: string
│   ├── inventory_item_storeA_id: string
│   ├── inventory_item_storeB_id: string
│   └── ...
├── last_updated_by_store: string
├── last_synced_at: timestamp
└── updated_at: timestamp
```

### Sync Logs Collection

```
sync_logs/{logId}
├── sync_id: string
├── operation: string
├── source_store: string
├── target_store: string
├── status: string
├── error: string (optional)
└── timestamp: timestamp
```

### Configuration Collection

```
config/{configKey}
├── value: any
└── updated_at: timestamp
```

## Environment Configuration

Add Firebase configuration to your environment file:

```bash
# Firebase Configuration
FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com/

# Service account key file path (relative to project root)
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json
```

## Performance Optimization

### Indexes

Create composite indexes for frequently queried fields:

1. In the Firebase Console, go to **Firestore Database**
2. Click on the **Indexes** tab
3. Create the following composite indexes:

**Products by Store A ID:**
- Collection: `products`
- Fields: `storeA_id` (Ascending)

**Products by Store B ID:**
- Collection: `products`
- Fields: `storeB_id` (Ascending)

**Sync Logs by Operation:**
- Collection: `sync_logs`
- Fields: `operation` (Ascending), `timestamp` (Descending)

### Query Optimization

- Use specific field queries instead of array-contains when possible
- Limit result sets using `.limit()` for large collections
- Implement pagination for large data sets
- Cache frequently accessed configuration data

## Backup and Recovery

### Automatic Backups

Firebase provides automatic backups, but consider additional backup strategies:

1. Enable Firebase's automatic backup feature in the console
2. Set up regular exports to Google Cloud Storage
3. Implement application-level backup procedures for critical data

### Manual Backup

Export collections manually when needed:

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Export Firestore data
firebase firestore:export gs://your-backup-bucket/backup-$(date +%Y%m%d)
```

## Monitoring and Alerts

### Usage Monitoring

Monitor Firebase usage to optimize costs and performance:

1. In the Firebase Console, go to **Usage and billing**
2. Monitor read/write operations, storage usage, and bandwidth
3. Set up billing alerts for cost management

### Performance Monitoring

1. Enable Firebase Performance Monitoring
2. Monitor query performance and identify slow operations
3. Set up alerts for performance degradation

## Security Best Practices

### Access Control

- Use service accounts for server-side access only
- Implement proper security rules to restrict access
- Regularly audit and rotate service account keys
- Monitor access logs for suspicious activity

### Data Protection

- Enable audit logging for compliance requirements
- Implement data retention policies
- Use field-level security for sensitive data
- Regular security reviews and updates

## Troubleshooting

### Common Issues

**"Permission denied" errors:**
- Check Firestore security rules
- Verify service account authentication
- Ensure proper IAM permissions

**Slow query performance:**
- Create appropriate indexes
- Optimize query structure
- Implement caching strategies

**Connection timeouts:**
- Check network connectivity
- Verify Firebase project configuration
- Monitor Firebase service status

### Testing Connection

Test your Firebase setup:

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./config/firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.firestore();

// Test write operation
db.collection('test').add({
  message: 'Hello Firebase!',
  timestamp: admin.firestore.FieldValue.serverTimestamp()
}).then(() => {
  console.log('Firebase connection successful!');
}).catch(console.error);
```

## Next Steps

After completing Firebase setup:

1. Test the connection using the provided test script
2. Configure your application environment variables
3. Run the synchronization system and verify database operations
4. Set up monitoring and alerting for production use

For integration with the synchronization system, refer to the main README.md file.

