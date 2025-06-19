# Quick Start Guide

This quick start guide helps you get the Shopify synchronization system running quickly for testing and development purposes.

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] Two Shopify stores with admin access
- [ ] Firebase project created
- [ ] Git installed (for cloning the repository)

## 5-Minute Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd shopify-express-sync

# Install dependencies
npm install

# Create logs directory
mkdir logs
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your credentials
nano .env
```

Fill in these required values:
- `STORE_A_DOMAIN`: Your first store's domain (without .myshopify.com)
- `STORE_A_ACCESS_TOKEN`: Private app token from Store A
- `STORE_B_DOMAIN`: Your second store's domain
- `STORE_B_ACCESS_TOKEN`: Private app token from Store B
- `WEBHOOK_SECRET_A`: Random string for Store A webhooks
- `WEBHOOK_SECRET_B`: Random string for Store B webhooks
- `FIREBASE_DATABASE_URL`: Your Firebase project URL

### 3. Setup Firebase

```bash
# Copy your Firebase service account key
cp path/to/your/firebase-key.json config/firebase-service-account.json
```

### 4. Start the Server

```bash
# Start in development mode
npm run dev
```

The server will start on port 3000. You should see:
```
Shopify Sync Server running on port 3000
Environment: development
```

### 5. Test the Setup

```bash
# In another terminal, test the health endpoint
curl http://localhost:3000/health

# Validate configuration
node scripts/webhook-cli.js validate
```

## Next Steps

1. **Expose your local server** using ngrok for webhook testing:
   ```bash
   ngrok http 3000
   ```

2. **Update webhook URL** in your .env file:
   ```bash
   WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io
   ```

3. **Register webhooks**:
   ```bash
   node scripts/webhook-cli.js register
   ```

4. **Test synchronization** by creating a product in one of your Shopify stores.

## Common Issues

- **Port already in use**: Change PORT in .env file
- **Firebase connection failed**: Check service account key path and permissions
- **Webhook registration failed**: Verify store credentials and permissions

For detailed setup and production deployment, see the main README.md file.

