// src/utils/balanceCache.js

/**
 * LocalStorage-based cache for encrypted balance decryption
 * Stores decrypted balance with expiration to avoid frequent decryption
 */
export class BalanceCache {
    static KEY_PREFIX = 'encrypted_balance_';
    static DEFAULT_EXPIRY_DAYS = 30;

    /**
     * Save decrypted balance to localStorage
     * @param {string} account - User wallet address
     * @param {string} chainId - Network chain ID (hex string)
     * @param {string} balance - Decrypted balance value
     */
    static save(account, chainId, balance) {
        if (!account || !chainId || balance === null || balance === undefined) {
            console.warn('BalanceCache.save: Invalid parameters');
            return;
        }

        const key = `${this.KEY_PREFIX}${account.toLowerCase()}_${chainId}`;
        const expiryMs = this.DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

        const cacheData = {
            balance,
            timestamp: Date.now(),
            expiresAt: Date.now() + expiryMs,
            account: account.toLowerCase(),
            chainId
        };

        try {
            localStorage.setItem(key, JSON.stringify(cacheData));
            console.log(`✅ Balance cached for ${account} on chain ${chainId}`);
        } catch (error) {
            console.error('Failed to save balance to cache:', error);
        }
    }

    /**
     * Get cached decrypted balance from localStorage
     * @param {string} account - User wallet address
     * @param {string} chainId - Network chain ID (hex string)
     * @returns {string|null} - Cached balance or null if not found/expired
     */
    static get(account, chainId) {
        if (!account || !chainId) {
            return null;
        }

        const key = `${this.KEY_PREFIX}${account.toLowerCase()}_${chainId}`;

        try {
            const cached = localStorage.getItem(key);

            if (!cached) {
                return null;
            }

            const cacheData = JSON.parse(cached);

            // Check if expired
            if (Date.now() > cacheData.expiresAt) {
                console.log(`⏰ Cache expired for ${account}`);
                this.clear(account, chainId);
                return null;
            }

            // Validate cache data
            if (cacheData.account.toLowerCase() !== account.toLowerCase() ||
                cacheData.chainId !== chainId) {
                console.warn('Cache data mismatch, clearing...');
                this.clear(account, chainId);
                return null;
            }

            console.log(`✅ Using cached balance for ${account}`);
            return cacheData.balance;

        } catch (error) {
            console.error('Failed to read balance from cache:', error);
            this.clear(account, chainId);
            return null;
        }
    }

    /**
     * Clear cached balance for specific account and chain
     * @param {string} account - User wallet address
     * @param {string} chainId - Network chain ID
     */
    static clear(account, chainId) {
        if (!account || !chainId) {
            return;
        }

        const key = `${this.KEY_PREFIX}${account.toLowerCase()}_${chainId}`;

        try {
            localStorage.removeItem(key);
            console.log(`🗑️ Cache cleared for ${account} on chain ${chainId}`);
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
    }

    /**
     * Invalidate cache when balance changes (deposit/withdraw/bet)
     * This forces user to decrypt balance again
     * @param {string} account - User wallet address
     * @param {string} chainId - Network chain ID
     */
    static invalidate(account, chainId) {
        console.log(`🔄 Invalidating cache for ${account} on chain ${chainId}`);
        this.clear(account, chainId);
    }

    /**
     * Optimistic update - update cached balance without decryption
     * Use after deposit/withdraw/bet when you know the change amount
     * @param {string} account - User wallet address
     * @param {string} chainId - Network chain ID
     * @param {number} delta - Amount to add (positive) or subtract (negative)
     * @returns {string|null} - New balance or null if no cache
     */
    static optimisticUpdate(account, chainId, delta) {
        const cached = this.get(account, chainId);

        if (!cached) {
            console.warn('Cannot optimistic update: no cached balance');
            return null;
        }

        const newBalance = (parseFloat(cached) + delta).toFixed(2);

        // Don't allow negative balance
        if (parseFloat(newBalance) < 0) {
            console.warn('Optimistic update would result in negative balance, invalidating cache');
            this.invalidate(account, chainId);
            return null;
        }

        this.save(account, chainId, newBalance);
        console.log(`🔄 Optimistic update: ${cached} → ${newBalance} (delta: ${delta})`);

        return newBalance;
    }

    /**
     * Clear all cached balances (useful for logout or network change)
     */
    static clearAll() {
        try {
            const keys = Object.keys(localStorage);
            const balanceKeys = keys.filter(key => key.startsWith(this.KEY_PREFIX));

            balanceKeys.forEach(key => {
                localStorage.removeItem(key);
            });

            console.log(`🗑️ Cleared ${balanceKeys.length} cached balances`);
        } catch (error) {
            console.error('Failed to clear all caches:', error);
        }
    }

    /**
     * Get cache info (for debugging)
     * @param {string} account - User wallet address
     * @param {string} chainId - Network chain ID
     * @returns {object|null} - Cache metadata or null
     */
    static getInfo(account, chainId) {
        if (!account || !chainId) {
            return null;
        }

        const key = `${this.KEY_PREFIX}${account.toLowerCase()}_${chainId}`;

        try {
            const cached = localStorage.getItem(key);
            if (!cached) return null;

            const cacheData = JSON.parse(cached);
            const now = Date.now();
            const age = now - cacheData.timestamp;
            const remaining = cacheData.expiresAt - now;

            return {
                balance: cacheData.balance,
                ageMinutes: Math.floor(age / 1000 / 60),
                remainingDays: Math.floor(remaining / 1000 / 60 / 60 / 24),
                isExpired: remaining < 0,
                lastUpdated: new Date(cacheData.timestamp).toLocaleString()
            };
        } catch (error) {
            return null;
        }
    }
}