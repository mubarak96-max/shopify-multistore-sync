#!/usr/bin/env node

/**
 * CLI tool for managing Shopify webhooks
 * Usage: node scripts/webhook-cli.js <command> [options]
 */

require('dotenv').config();
const WebhookManager = require('../src/utils/webhookManager');
const logger = require('../src/utils/logger');

const webhookManager = new WebhookManager();

async function main() {
  const command = process.argv[2];
  
  if (!command) {
    console.log(`
Shopify Webhook Management CLI

Usage: node scripts/webhook-cli.js <command>

Commands:
  register    - Register all required webhooks for both stores
  list        - List all existing webhooks
  delete      - Delete all sync-related webhooks
  test        - Test webhook connectivity
  validate    - Validate webhook configuration

Examples:
  node scripts/webhook-cli.js register
  node scripts/webhook-cli.js list
  node scripts/webhook-cli.js delete
    `);
    process.exit(1);
  }

  try {
    switch (command) {
      case 'register':
        await registerWebhooks();
        break;
      case 'list':
        await listWebhooks();
        break;
      case 'delete':
        await deleteWebhooks();
        break;
      case 'test':
        await testWebhooks();
        break;
      case 'validate':
        await validateConfiguration();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

async function registerWebhooks() {
  console.log('Registering webhooks...');
  
  const validation = webhookManager.validateConfiguration();
  if (!validation.valid) {
    console.error('Configuration errors:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }

  const results = await webhookManager.registerAllWebhooks();
  
  console.log('\nRegistration Results:');
  console.log('====================');
  
  ['storeA', 'storeB'].forEach(store => {
    const result = results[store];
    console.log(`\n${store.toUpperCase()}:`);
    
    if (result.registered.length > 0) {
      console.log('  Registered:');
      result.registered.forEach(w => {
        console.log(`    ✓ ${w.topic} -> ${w.address}`);
      });
    }
    
    if (result.existing.length > 0) {
      console.log('  Already exists:');
      result.existing.forEach(w => {
        console.log(`    - ${w.topic} -> ${w.address}`);
      });
    }
    
    if (result.errors.length > 0) {
      console.log('  Errors:');
      result.errors.forEach(w => {
        console.log(`    ✗ ${w.topic}: ${w.error}`);
      });
    }
  });
}

async function listWebhooks() {
  console.log('Listing webhooks...');
  
  const results = await webhookManager.listAllWebhooks();
  
  console.log('\nExisting Webhooks:');
  console.log('==================');
  
  ['storeA', 'storeB'].forEach(store => {
    const result = results[store];
    console.log(`\n${store.toUpperCase()} (${result.count || 0} webhooks):`);
    
    if (result.error) {
      console.log(`  Error: ${result.error}`);
      return;
    }
    
    if (result.webhooks && result.webhooks.length > 0) {
      result.webhooks.forEach(w => {
        console.log(`  ${w.topic}`);
        console.log(`    Address: ${w.address}`);
        console.log(`    ID: ${w.id}`);
        console.log(`    Created: ${w.created_at}`);
        console.log('');
      });
    } else {
      console.log('  No webhooks found');
    }
  });
}

async function deleteWebhooks() {
  console.log('Deleting sync-related webhooks...');
  
  const results = await webhookManager.deleteAllSyncWebhooks();
  
  console.log('\nDeletion Results:');
  console.log('=================');
  
  ['storeA', 'storeB'].forEach(store => {
    const result = results[store];
    console.log(`\n${store.toUpperCase()}:`);
    
    if (result.error) {
      console.log(`  Error: ${result.error}`);
      return;
    }
    
    if (result.deleted.length > 0) {
      console.log('  Deleted:');
      result.deleted.forEach(w => {
        console.log(`    ✓ ${w.topic} (${w.id})`);
      });
    } else {
      console.log('  No sync webhooks found to delete');
    }
    
    if (result.errors.length > 0) {
      console.log('  Errors:');
      result.errors.forEach(w => {
        console.log(`    ✗ ${w.topic}: ${w.error}`);
      });
    }
  });
}

async function testWebhooks() {
  console.log('Testing webhook connectivity...');
  
  const results = await webhookManager.testWebhookConnectivity();
  
  console.log('\nConnectivity Test Results:');
  console.log('==========================');
  
  ['storeA', 'storeB'].forEach(store => {
    const result = results[store];
    console.log(`\n${store.toUpperCase()}:`);
    
    if (result.success) {
      console.log(`  ✓ ${result.message}`);
    } else {
      console.log(`  ✗ ${result.error}`);
    }
  });
}

async function validateConfiguration() {
  console.log('Validating webhook configuration...');
  
  const validation = webhookManager.validateConfiguration();
  
  console.log('\nConfiguration Validation:');
  console.log('=========================');
  
  if (validation.valid) {
    console.log('✓ Configuration is valid');
  } else {
    console.log('✗ Configuration has errors:');
    validation.errors.forEach(error => {
      console.log(`  - ${error}`);
    });
  }
  
  // Additional checks
  console.log('\nEnvironment Variables:');
  const envVars = [
    'WEBHOOK_BASE_URL',
    'STORE_A_DOMAIN',
    'STORE_A_ACCESS_TOKEN',
    'STORE_B_DOMAIN', 
    'STORE_B_ACCESS_TOKEN',
    'WEBHOOK_SECRET_A',
    'WEBHOOK_SECRET_B'
  ];
  
  envVars.forEach(envVar => {
    const value = process.env[envVar];
    const status = value ? '✓' : '✗';
    const display = value ? (envVar.includes('TOKEN') || envVar.includes('SECRET') ? '[HIDDEN]' : value) : '[NOT SET]';
    console.log(`  ${status} ${envVar}: ${display}`);
  });
}

if (require.main === module) {
  main();
}

module.exports = { main };

