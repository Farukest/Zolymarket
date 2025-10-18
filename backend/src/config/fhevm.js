require('dotenv').config();

const fhevmConfig = {
  // Network Configuration
  chainId: 2522, // Sepolia FHEVM testnet
  rpcUrl: process.env.SEPOLIA_RPC_URL,

  // Contract Addresses
  contracts: {
    betMarket: process.env.BET_MARKET_ADDRESS,
    categoryManager: process.env.CATEGORY_MANAGER_ADDRESS,
    adminManager: process.env.ADMIN_MANAGER_ADDRESS,
    usdcToken: process.env.USDC_TOKEN_ADDRESS
  },

  // FHEVM Specific Configuration
  fhevm: {
    gatewayUrl: process.env.GATEWAY_URL,
    aclAddress: process.env.ACL_ADDRESS,
    acoAddress: process.env.ACO_ADDRESS
  },

  // Event Listening Configuration
  eventListener: {
    startFromBlock: 0, // Start from genesis or set to specific block
    batchSize: 1000,   // Process events in batches
    pollingInterval: 5000, // 5 seconds
    maxRetries: 3,
    backoffMultiplier: 2
  },

  // Database Configuration
  database: {
    connectionString: process.env.MONGODB_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    }
  },

  // Decryption Configuration
  decryption: {
    enabled: true,
    batchSize: 10,      // Process decryption in batches
    retryDelay: 30000,  // 30 seconds between retry attempts
    maxRetries: 5,
    timeoutMs: 60000    // 1 minute timeout per decryption
  },

  // Security Configuration
  security: {
    privateKey: process.env.PRIVATE_KEY,
    requireSignatures: true,
    allowedOrigins: [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:3000'
    ]
  },

  // Cache Configuration
  cache: {
    enabled: true,
    ttl: 300, // 5 minutes
    maxSize: 1000
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableEventLogs: true,
    enableDecryptionLogs: true,
    enablePerformanceLogs: false
  }
};

// Validation
function validateConfig() {
  const required = [
    'SEPOLIA_RPC_URL',
    'BET_MARKET_ADDRESS',
    'MONGODB_URI',
    'PRIVATE_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate addresses
  const addressPattern = /^0x[a-fA-F0-9]{40}$/;
  const addresses = [
    { name: 'BET_MARKET_ADDRESS', value: process.env.BET_MARKET_ADDRESS },
    { name: 'CATEGORY_MANAGER_ADDRESS', value: process.env.CATEGORY_MANAGER_ADDRESS },
    { name: 'ADMIN_MANAGER_ADDRESS', value: process.env.ADMIN_MANAGER_ADDRESS },
    { name: 'USDC_TOKEN_ADDRESS', value: process.env.USDC_TOKEN_ADDRESS }
  ];

  addresses.forEach(({ name, value }) => {
    if (value && !addressPattern.test(value)) {
      throw new Error(`Invalid address format for ${name}: ${value}`);
    }
  });
}

// Validate configuration on load
try {
  validateConfig();
  console.log('✅ FHEVM Configuration validated successfully');
} catch (error) {
  console.error('❌ FHEVM Configuration validation failed:', error.message);
  process.exit(1);
}

module.exports = fhevmConfig;