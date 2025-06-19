const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Verify Shopify webhook signature
 * @param {string} rawBody - Raw request body
 * @param {string} signature - Shopify signature from header
 * @param {string} secret - Webhook secret
 * @returns {boolean} - True if signature is valid
 */
function verifyShopifyWebhook(rawBody, signature, secret) {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody, 'utf8');
    const calculatedSignature = hmac.digest('base64');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(calculatedSignature, 'base64')
    );
  } catch (error) {
    logger.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Generate a unique sync ID for products
 * @param {string} sku - Product SKU
 * @param {string} title - Product title
 * @returns {string} - Unique sync ID
 */
function generateSyncId(sku, title) {
  const input = sku || title || Date.now().toString();
  return crypto.createHash('md5').update(input).digest('hex');
}

/**
 * Sanitize product data for Firebase storage
 * @param {object} product - Shopify product object
 * @returns {object} - Sanitized product data
 */
function sanitizeProductData(product) {
  return {
    id: product.id,
    title: product.title || '',
    description: product.body_html || '',
    vendor: product.vendor || '',
    product_type: product.product_type || '',
    status: product.status || 'draft',
    handle: product.handle || '',
    tags: product.tags || '',
    images: (product.images || []).map(img => ({
      id: img.id,
      src: img.src,
      alt: img.alt || '',
      position: img.position || 0
    })),
    variants: (product.variants || []).map(variant => ({
      id: variant.id,
      sku: variant.sku || '',
      price: variant.price || '0.00',
      compare_at_price: variant.compare_at_price || null,
      inventory_item_id: variant.inventory_item_id,
      inventory_quantity: variant.inventory_quantity || 0,
      inventory_policy: variant.inventory_policy || 'deny',
      fulfillment_service: variant.fulfillment_service || 'manual',
      inventory_management: variant.inventory_management || null,
      option1: variant.option1 || null,
      option2: variant.option2 || null,
      option3: variant.option3 || null,
      position: variant.position || 1,
      weight: variant.weight || 0,
      weight_unit: variant.weight_unit || 'kg',
      requires_shipping: variant.requires_shipping !== false,
      taxable: variant.taxable !== false
    })),
    options: (product.options || []).map(option => ({
      id: option.id,
      name: option.name,
      position: option.position,
      values: option.values || []
    })),
    created_at: product.created_at,
    updated_at: product.updated_at
  };
}

/**
 * Extract variant mapping for inventory sync
 * @param {object} product - Sanitized product data
 * @returns {object} - Variant mapping by SKU
 */
function createVariantMapping(product) {
  const mapping = {};
  product.variants.forEach(variant => {
    if (variant.sku) {
      mapping[variant.sku] = {
        id: variant.id,
        inventory_item_id: variant.inventory_item_id,
        inventory_quantity: variant.inventory_quantity
      };
    }
  });
  return mapping;
}

/**
 * Delay execution for rate limiting
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} - Promise that resolves after delay
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} - Promise that resolves with function result
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff with jitter
      const delayMs = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      logger.warn(`Attempt ${attempt + 1} failed, retrying in ${delayMs}ms:`, error.message);
      await delay(delayMs);
    }
  }
  
  throw lastError;
}

module.exports = {
  verifyShopifyWebhook,
  generateSyncId,
  sanitizeProductData,
  createVariantMapping,
  delay,
  retryWithBackoff
};

