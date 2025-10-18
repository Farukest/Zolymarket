// Contract addresses
export const CONTRACTS = {
  BET_MARKET: import.meta.env.VITE_BET_MARKET_ADDRESS,
  CATEGORY_MANAGER: import.meta.env.VITE_CATEGORY_MANAGER_ADDRESS,
  ADMIN_MANAGER: import.meta.env.VITE_ADMIN_MANAGER_ADDRESS,
  USDC_TOKEN: import.meta.env.VITE_USDC_TOKEN_ADDRESS
};

// Network configuration
export const NETWORKS = {
  SEPOLIA: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    rpcUrl: import.meta.env.VITE_FHEVM_NETWORK_URL,
    explorerUrl: 'https://sepolia.etherscan.io'
  }
};

// FHEVM configuration
export const FHEVM_CONFIG = {
  GATEWAY_URL: import.meta.env.VITE_GATEWAY_URL || 'https://gateway.sepolia.zama.ai/',
  ACL_ADDRESS: import.meta.env.VITE_ACL_ADDRESS,
  ACO_ADDRESS: import.meta.env.VITE_ACO_ADDRESS
};

// Bet types (matching Solidity enum: BINARY=0, MULTIPLE_CHOICE=1, SPORTS=2)
export const BET_TYPES = {
  BINARY: 0,
  MULTIPLE_CHOICE: 1,
  SPORTS: 2
};

// API endpoints
export const API_ENDPOINTS = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  AUTH: '/auth',
  BETS: '/bets',
  CATEGORIES: '/categories',
  ADMIN: '/admin',
  UPLOAD: '/upload'
};

// Local storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'polymarket_auth_token',
  BOOKMARKED_BETS: 'bookmarked_bets',
  USER_PREFERENCES: 'user_preferences',
  WALLET_ADDRESS: 'wallet_address'
};

// UI constants
export const UI_CONSTANTS = {
  ITEMS_PER_PAGE: 20,
  MAX_SEARCH_RESULTS: 50,
  DEBOUNCE_DELAY: 300,
  TOAST_DURATION: 4000
};

// Filter options
export const FILTERS = {
  BET_STATUS: {
    ALL: 'all',
    ACTIVE: 'active',
    RESOLVED: 'resolved',
    ENDING_SOON: 'ending-soon'
  },
  BET_SORT: {
    TRENDING: 'trending',
    NEW: 'new',
    VOLUME: 'volume',
    ENDING_SOON: 'ending-soon'
  }
};

// Error messages
export const ERROR_MESSAGES = {
  WALLET_NOT_CONNECTED: 'Please connect your wallet',
  NETWORK_ERROR: 'Network error. Please try again.',
  INSUFFICIENT_FUNDS: 'Insufficient funds for this transaction',
  TRANSACTION_FAILED: 'Transaction failed. Please try again.',
  INVALID_INPUT: 'Invalid input. Please check your data.',
  UNAUTHORIZED: 'You are not authorized to perform this action'
};