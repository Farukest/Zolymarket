// Local Storage Service for Polymarket FHEVM
// Handles caching and offline data storage

class StorageService {
  constructor() {
    this.prefix = 'polymarket_fhevm_';
    this.version = '1.0.0';
    this.initializeStorage();
  }

  initializeStorage() {
    try {
      // Check if localStorage is available
      if (typeof Storage === 'undefined') {
        console.warn('localStorage not available, using memory storage');
        this.storage = new Map();
        this.useMemoryStorage = true;
      } else {
        this.storage = localStorage;
        this.useMemoryStorage = false;
      }

      // Initialize version check
      const storedVersion = this.get('version');
      if (storedVersion !== this.version) {
        this.clearAll();
        this.set('version', this.version);
      }

      console.log('Storage service initialized');
    } catch (error) {
      console.error('Storage initialization error:', error);
      this.storage = new Map();
      this.useMemoryStorage = true;
    }
  }

  // Basic storage operations
  set(key, value) {
    try {
      const fullKey = this.prefix + key;
      const serializedValue = JSON.stringify({
        data: value,
        timestamp: Date.now(),
        expires: null
      });

      if (this.useMemoryStorage) {
        this.storage.set(fullKey, serializedValue);
      } else {
        this.storage.setItem(fullKey, serializedValue);
      }

      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  }

  get(key, defaultValue = null) {
    try {
      const fullKey = this.prefix + key;
      let serializedValue;

      if (this.useMemoryStorage) {
        serializedValue = this.storage.get(fullKey);
      } else {
        serializedValue = this.storage.getItem(fullKey);
      }

      if (!serializedValue) {
        return defaultValue;
      }

      const parsed = JSON.parse(serializedValue);
      
      // Check expiration
      if (parsed.expires && Date.now() > parsed.expires) {
        this.remove(key);
        return defaultValue;
      }

      return parsed.data;
    } catch (error) {
      console.error('Storage get error:', error);
      return defaultValue;
    }
  }

  remove(key) {
    try {
      const fullKey = this.prefix + key;

      if (this.useMemoryStorage) {
        this.storage.delete(fullKey);
      } else {
        this.storage.removeItem(fullKey);
      }

      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  }

  // Expiring storage
  setWithExpiry(key, value, expiryMinutes) {
    try {
      const fullKey = this.prefix + key;
      const expiryTime = Date.now() + (expiryMinutes * 60 * 1000);
      const serializedValue = JSON.stringify({
        data: value,
        timestamp: Date.now(),
        expires: expiryTime
      });

      if (this.useMemoryStorage) {
        this.storage.set(fullKey, serializedValue);
      } else {
        this.storage.setItem(fullKey, serializedValue);
      }

      return true;
    } catch (error) {
      console.error('Storage setWithExpiry error:', error);
      return false;
    }
  }

  // User-specific storage
  setUserData(userAddress, key, value) {
    const userKey = `user_${userAddress.toLowerCase()}_${key}`;
    return this.set(userKey, value);
  }

  getUserData(userAddress, key, defaultValue = null) {
    const userKey = `user_${userAddress.toLowerCase()}_${key}`;
    return this.get(userKey, defaultValue);
  }

  removeUserData(userAddress, key) {
    const userKey = `user_${userAddress.toLowerCase()}_${key}`;
    return this.remove(userKey);
  }

  // Bet-specific storage
  cacheBet(betId, betData, expiryMinutes = 10) {
    const key = `bet_${betId}`;
    return this.setWithExpiry(key, betData, expiryMinutes);
  }

  getCachedBet(betId) {
    const key = `bet_${betId}`;
    return this.get(key);
  }

  removeCachedBet(betId) {
    const key = `bet_${betId}`;
    return this.remove(key);
  }

  // Category-specific storage
  cacheCategories(categories, expiryMinutes = 30) {
    return this.setWithExpiry('categories', categories, expiryMinutes);
  }

  getCachedCategories() {
    return this.get('categories', []);
  }

  // User preferences
  setUserPreferences(userAddress, preferences) {
    return this.setUserData(userAddress, 'preferences', preferences);
  }

  getUserPreferences(userAddress) {
    return this.getUserData(userAddress, 'preferences', {
      theme: 'light',
      currency: 'ETH',
      notifications: true,
      language: 'en',
      defaultBetAmount: '0.01'
    });
  }

  // Wallet connection info
  setWalletConnection(connectionData) {
    return this.set('wallet_connection', connectionData);
  }

  getWalletConnection() {
    return this.get('wallet_connection');
  }

  removeWalletConnection() {
    return this.remove('wallet_connection');
  }

  // Transaction history
  addTransaction(userAddress, transactionData) {
    const transactions = this.getUserData(userAddress, 'transactions', []);
    transactions.unshift({
      ...transactionData,
      timestamp: Date.now(),
      id: Date.now().toString()
    });

    // Keep only last 100 transactions
    if (transactions.length > 100) {
      transactions.splice(100);
    }

    return this.setUserData(userAddress, 'transactions', transactions);
  }

  getUserTransactions(userAddress) {
    return this.getUserData(userAddress, 'transactions', []);
  }

  // Notification storage
  addNotification(userAddress, notification) {
    const notifications = this.getUserData(userAddress, 'notifications', []);
    notifications.unshift({
      ...notification,
      id: Date.now().toString(),
      timestamp: Date.now(),
      read: false
    });

    // Keep only last 50 notifications
    if (notifications.length > 50) {
      notifications.splice(50);
    }

    return this.setUserData(userAddress, 'notifications', notifications);
  }

  getUserNotifications(userAddress) {
    return this.getUserData(userAddress, 'notifications', []);
  }

  markNotificationAsRead(userAddress, notificationId) {
    const notifications = this.getUserNotifications(userAddress);
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.setUserData(userAddress, 'notifications', notifications);
    }
    return notification;
  }

  markAllNotificationsAsRead(userAddress) {
    const notifications = this.getUserNotifications(userAddress);
    notifications.forEach(n => n.read = true);
    return this.setUserData(userAddress, 'notifications', notifications);
  }

  // Search history
  addSearchTerm(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') return;

    const searchHistory = this.get('search_history', []);
    const trimmedTerm = searchTerm.trim().toLowerCase();
    
    // Remove if already exists
    const filtered = searchHistory.filter(term => term !== trimmedTerm);
    
    // Add to beginning
    filtered.unshift(trimmedTerm);
    
    // Keep only last 10 searches
    if (filtered.length > 10) {
      filtered.splice(10);
    }

    return this.set('search_history', filtered);
  }

  getSearchHistory() {
    return this.get('search_history', []);
  }

  clearSearchHistory() {
    return this.remove('search_history');
  }

  // Performance monitoring
  logPerformanceMetric(metric, value) {
    const metrics = this.get('performance_metrics', {});
    const now = Date.now();
    
    if (!metrics[metric]) {
      metrics[metric] = [];
    }

    metrics[metric].push({
      value,
      timestamp: now
    });

    // Keep only last 100 entries per metric
    if (metrics[metric].length > 100) {
      metrics[metric].splice(0, metrics[metric].length - 100);
    }

    return this.set('performance_metrics', metrics);
  }

  getPerformanceMetrics(metric = null) {
    const metrics = this.get('performance_metrics', {});
    return metric ? metrics[metric] || [] : metrics;
  }

  // Error logging
  logError(error, context = '') {
    const errors = this.get('error_log', []);
    
    errors.unshift({
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent
    });

    // Keep only last 50 errors
    if (errors.length > 50) {
      errors.splice(50);
    }

    return this.set('error_log', errors);
  }

  getErrorLog() {
    return this.get('error_log', []);
  }

  clearErrorLog() {
    return this.remove('error_log');
  }

  // Bulk operations
  getAll() {
    const allData = {};
    
    try {
      if (this.useMemoryStorage) {
        for (const [key, value] of this.storage) {
          if (key.startsWith(this.prefix)) {
            const cleanKey = key.substring(this.prefix.length);
            allData[cleanKey] = JSON.parse(value).data;
          }
        }
      } else {
        for (let i = 0; i < this.storage.length; i++) {
          const key = this.storage.key(i);
          if (key && key.startsWith(this.prefix)) {
            const cleanKey = key.substring(this.prefix.length);
            const value = this.storage.getItem(key);
            if (value) {
              allData[cleanKey] = JSON.parse(value).data;
            }
          }
        }
      }
    } catch (error) {
      console.error('Storage getAll error:', error);
    }

    return allData;
  }

  clearAll() {
    try {
      if (this.useMemoryStorage) {
        const keysToDelete = [];
        for (const key of this.storage.keys()) {
          if (key.startsWith(this.prefix)) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach(key => this.storage.delete(key));
      } else {
        const keysToDelete = [];
        for (let i = 0; i < this.storage.length; i++) {
          const key = this.storage.key(i);
          if (key && key.startsWith(this.prefix)) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach(key => this.storage.removeItem(key));
      }

      console.log('Storage cleared');
      return true;
    } catch (error) {
      console.error('Storage clearAll error:', error);
      return false;
    }
  }

  clearUserData(userAddress) {
    try {
      const userPrefix = this.prefix + `user_${userAddress.toLowerCase()}_`;
      
      if (this.useMemoryStorage) {
        const keysToDelete = [];
        for (const key of this.storage.keys()) {
          if (key.startsWith(userPrefix)) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach(key => this.storage.delete(key));
      } else {
        const keysToDelete = [];
        for (let i = 0; i < this.storage.length; i++) {
          const key = this.storage.key(i);
          if (key && key.startsWith(userPrefix)) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach(key => this.storage.removeItem(key));
      }

      console.log('User data cleared for:', userAddress);
      return true;
    } catch (error) {
      console.error('Storage clearUserData error:', error);
      return false;
    }
  }

  // Storage info
  getStorageInfo() {
    try {
      const allData = this.getAll();
      const itemCount = Object.keys(allData).length;
      
      let sizeEstimate = 0;
      if (!this.useMemoryStorage && this.storage.length > 0) {
        // Estimate storage size in bytes
        for (let i = 0; i < this.storage.length; i++) {
          const key = this.storage.key(i);
          if (key && key.startsWith(this.prefix)) {
            const value = this.storage.getItem(key);
            if (value) {
              sizeEstimate += key.length + value.length;
            }
          }
        }
      }

      return {
        version: this.version,
        itemCount,
        sizeEstimate: `${(sizeEstimate / 1024).toFixed(2)} KB`,
        usingMemoryStorage: this.useMemoryStorage,
        storageAvailable: !this.useMemoryStorage
      };
    } catch (error) {
      console.error('Storage info error:', error);
      return {
        version: this.version,
        itemCount: 0,
        sizeEstimate: '0 KB',
        usingMemoryStorage: true,
        storageAvailable: false
      };
    }
  }
}

// Export singleton instance
const storageService = new StorageService();
export default storageService;