const axios = require('axios');
const logger = require('../utils/logger');
const { retryWithBackoff } = require('../utils/helpers');

class ShopifyAPI {
  constructor(shopDomain, accessToken) {
    this.shopDomain = shopDomain;
    this.accessToken = accessToken;
    this.baseURL = `https://${shopDomain}.myshopify.com/admin/api/2023-10`;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Add response interceptor for rate limiting
    this.client.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 2;
          logger.warn(`Rate limited, waiting ${retryAfter} seconds`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          return this.client.request(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get all products with pagination
   * @param {number} limit - Number of products per page (max 250)
   * @returns {Promise<Array>} - Array of all products
   */
  async getAllProducts(limit = 250) {
    const products = [];
    let pageInfo = null;
    
    do {
      const params = { limit };
      if (pageInfo) {
        params.page_info = pageInfo;
      }
      
      const response = await retryWithBackoff(async () => {
        return await this.client.get('/products.json', { params });
      });
      
      products.push(...response.data.products);
      
      // Check for pagination
      const linkHeader = response.headers.link;
      pageInfo = this.extractPageInfo(linkHeader, 'next');
      
    } while (pageInfo);
    
    return products;
  }

  /**
   * Get a single product by ID
   * @param {string} productId - Shopify product ID
   * @returns {Promise<object>} - Product object
   */
  async getProduct(productId) {
    const response = await retryWithBackoff(async () => {
      return await this.client.get(`/products/${productId}.json`);
    });
    return response.data.product;
  }

  /**
   * Create a new product
   * @param {object} productData - Product data
   * @returns {Promise<object>} - Created product object
   */
  async createProduct(productData) {
    const response = await retryWithBackoff(async () => {
      return await this.client.post('/products.json', { product: productData });
    });
    return response.data.product;
  }

  /**
   * Update an existing product
   * @param {string} productId - Shopify product ID
   * @param {object} productData - Updated product data
   * @returns {Promise<object>} - Updated product object
   */
  async updateProduct(productId, productData) {
    const response = await retryWithBackoff(async () => {
      return await this.client.put(`/products/${productId}.json`, { product: productData });
    });
    return response.data.product;
  }

  /**
   * Delete a product
   * @param {string} productId - Shopify product ID
   * @returns {Promise<void>}
   */
  async deleteProduct(productId) {
    await retryWithBackoff(async () => {
      return await this.client.delete(`/products/${productId}.json`);
    });
  }

  /**
   * Get inventory levels for a location
   * @param {string} inventoryItemId - Inventory item ID
   * @param {string} locationId - Location ID
   * @returns {Promise<object>} - Inventory level object
   */
  async getInventoryLevel(inventoryItemId, locationId) {
    const params = {
      inventory_item_ids: inventoryItemId,
      location_ids: locationId
    };
    
    const response = await retryWithBackoff(async () => {
      return await this.client.get('/inventory_levels.json', { params });
    });
    
    return response.data.inventory_levels[0];
  }

  /**
   * Update inventory level
   * @param {string} inventoryItemId - Inventory item ID
   * @param {string} locationId - Location ID
   * @param {number} quantity - New quantity
   * @returns {Promise<object>} - Updated inventory level
   */
  async updateInventoryLevel(inventoryItemId, locationId, quantity) {
    const data = {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available: quantity
    };
    
    const response = await retryWithBackoff(async () => {
      return await this.client.post('/inventory_levels/set.json', data);
    });
    
    return response.data.inventory_level;
  }

  /**
   * Get all locations
   * @returns {Promise<Array>} - Array of locations
   */
  async getLocations() {
    const response = await retryWithBackoff(async () => {
      return await this.client.get('/locations.json');
    });
    return response.data.locations;
  }

  /**
   * Create a webhook
   * @param {object} webhookData - Webhook configuration
   * @returns {Promise<object>} - Created webhook object
   */
  async createWebhook(webhookData) {
    const response = await retryWithBackoff(async () => {
      return await this.client.post('/webhooks.json', { webhook: webhookData });
    });
    return response.data.webhook;
  }

  /**
   * Get all webhooks
   * @returns {Promise<Array>} - Array of webhooks
   */
  async getWebhooks() {
    const response = await retryWithBackoff(async () => {
      return await this.client.get('/webhooks.json');
    });
    return response.data.webhooks;
  }

  /**
   * Delete a webhook
   * @param {string} webhookId - Webhook ID
   * @returns {Promise<void>}
   */
  async deleteWebhook(webhookId) {
    await retryWithBackoff(async () => {
      return await this.client.delete(`/webhooks/${webhookId}.json`);
    });
  }

  /**
   * Extract page info from Link header
   * @param {string} linkHeader - Link header value
   * @param {string} rel - Relation type (next, previous)
   * @returns {string|null} - Page info or null
   */
  extractPageInfo(linkHeader, rel) {
    if (!linkHeader) return null;
    
    const links = linkHeader.split(',');
    for (const link of links) {
      const [url, relType] = link.split(';');
      if (relType && relType.includes(`rel="${rel}"`)) {
        const match = url.match(/page_info=([^&>]+)/);
        return match ? match[1] : null;
      }
    }
    return null;
  }
}

module.exports = ShopifyAPI;

