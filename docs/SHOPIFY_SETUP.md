# Shopify Private App Setup Guide

This guide walks you through creating private apps in your Shopify stores to enable API access for the synchronization system.

## Why Private Apps?

Private apps provide the simplest way to access Shopify's Admin API for server-to-server communication. They offer:
- Direct API access without OAuth complexity
- Fine-grained permission control
- Stable, long-term credentials
- No user interaction required

## Creating Private Apps

### Step 1: Access Private Apps Section

1. Log into your Shopify admin panel
2. Navigate to **Apps** in the left sidebar
3. Click **Manage private apps** at the bottom of the page
4. If private apps are disabled, click **Enable private app development**

### Step 2: Create New Private App

1. Click **Create new private app**
2. Fill in the app details:
   - **Private app name**: "Store Synchronization" (or similar)
   - **Emergency developer email**: Your email address

### Step 3: Configure API Permissions

Configure the following permissions for the synchronization system:

#### Admin API Permissions

**Products:**
- Read and write access to products
- Read and write access to product listings

**Inventory:**
- Read and write access to inventory
- Read access to locations

**Orders (Optional):**
- Read access to orders (for inventory tracking)

#### Webhook Permissions

Enable webhook access to allow the app to receive real-time notifications:
- Check **Allow this app to access your storefront data using the Storefront API**

### Step 4: Save and Get Credentials

1. Click **Save** to create the private app
2. Note down the following credentials:
   - **API key**: Used for authentication
   - **Password**: Used as the access token
   - **Shared secret**: Used for webhook verification

## Security Best Practices

### Credential Management

- Store credentials securely in environment variables
- Never commit credentials to version control
- Use different credentials for development and production
- Rotate credentials regularly

### Permission Minimization

- Only enable permissions required for synchronization
- Regularly review and audit permissions
- Disable unused private apps

### Webhook Security

- Use unique webhook secrets for each store
- Implement proper signature verification
- Monitor webhook delivery logs

## Environment Configuration

Add the private app credentials to your environment configuration:

```bash
# Store A Configuration
STORE_A_DOMAIN=your-store-a-name
STORE_A_ACCESS_TOKEN=your_store_a_password_here
WEBHOOK_SECRET_A=your_unique_webhook_secret_a

# Store B Configuration
STORE_B_DOMAIN=your-store-b-name
STORE_B_ACCESS_TOKEN=your_store_b_password_here
WEBHOOK_SECRET_B=your_unique_webhook_secret_b
```

## Testing API Access

Test your private app credentials using the provided validation tools:

```bash
# Validate configuration
node scripts/webhook-cli.js validate

# Test API connectivity
curl -H "X-Shopify-Access-Token: YOUR_ACCESS_TOKEN" \
     https://YOUR_STORE.myshopify.com/admin/api/2023-10/products.json
```

## Troubleshooting

### Common Issues

**"Private app development is disabled"**
- Enable private app development in your store settings
- Contact Shopify support if the option is not available

**"Insufficient permissions"**
- Review and update API permissions in the private app settings
- Ensure all required permissions are enabled

**"Invalid credentials"**
- Verify the API key and password are correct
- Check that the store domain is correct (without .myshopify.com)

### Permission Requirements

The synchronization system requires these minimum permissions:

| Resource | Permission | Reason |
|----------|------------|---------|
| Products | Read/Write | Create, update, delete products |
| Inventory | Read/Write | Sync inventory levels |
| Locations | Read | Map inventory locations |
| Webhooks | Access | Receive real-time notifications |

## Next Steps

After creating private apps in both stores:

1. Update your environment configuration with the credentials
2. Test API connectivity using the validation tools
3. Register webhooks using the webhook management CLI
4. Perform initial synchronization testing

For detailed setup instructions, refer to the main README.md file.

