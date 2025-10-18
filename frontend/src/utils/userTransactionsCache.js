/**
 * UserTransactions Cache - Optimistic updates for bet transactions
 * Stores encrypted transaction data, updates optimistically on bet placement,
 * and syncs with contract on reveal
 */

class UserTransactionsCache {
    constructor() {
        this.STORAGE_KEY = 'userTransactionsCache';
    }

    /**
     * Get cache key for user+bet combination
     */
    getCacheKey(address, betId) {
        return `${address.toLowerCase()}_${betId}`;
    }

    /**
     * Get all transactions for a user on a specific bet
     */
    getTransactions(address, betId) {
        if (!address || !betId) return [];

        const cache = this.getAllCache();
        const key = this.getCacheKey(address, betId);
        return cache[key] || [];
    }

    /**
     * Add a new transaction optimistically (after tx success)
     */
    addTransaction(address, betId, transaction) {
        if (!address || !betId || !transaction) return;

        const cache = this.getAllCache();
        const key = this.getCacheKey(address, betId);

        if (!cache[key]) {
            cache[key] = [];
        }

        // Add new transaction
        cache[key].push({
            timestamp: transaction.timestamp || Math.floor(Date.now() / 1000),
            optionIndex: transaction.optionIndex,
            outcome: transaction.outcome,
            amount: transaction.amount,
            txHash: transaction.txHash,
            priceAtBet: transaction.priceAtBet, // Price when bet was placed
            isRevealed: false // Mark as not revealed yet
        });

        this.saveCache(cache);
    }

    /**
     * Update cache with revealed (decrypted) transactions from contract
     */
    setRevealedTransactions(address, betId, revealedTransactions) {
        if (!address || !betId) return;

        const cache = this.getAllCache();
        const key = this.getCacheKey(address, betId);

        // Get existing cache to preserve txHash
        const existingCache = cache[key] || [];

        // Merge revealed transactions with existing cache (match by timestamp)
        cache[key] = revealedTransactions.map(revealedTx => {
            // Find matching transaction in existing cache by timestamp
            const existingTx = existingCache.find(
                cached => cached.timestamp === revealedTx.timestamp
            );

            return {
                ...revealedTx,
                txHash: existingTx?.txHash || revealedTx.txHash, // Preserve txHash from cache
                priceAtBet: existingTx?.priceAtBet || revealedTx.priceAtBet, // Preserve priceAtBet from cache
                isRevealed: true
            };
        });

        this.saveCache(cache);
    }

    /**
     * Check if transactions are revealed for this bet
     */
    isRevealed(address, betId) {
        const transactions = this.getTransactions(address, betId);
        return transactions.length > 0 && transactions.every(tx => tx.isRevealed);
    }

    /**
     * Clear cache for specific bet
     */
    clear(address, betId) {
        if (!address || !betId) return;

        const cache = this.getAllCache();
        const key = this.getCacheKey(address, betId);
        delete cache[key];
        this.saveCache(cache);
    }

    /**
     * Clear all cache for address
     */
    clearAll(address) {
        if (!address) return;

        const cache = this.getAllCache();
        const lowerAddress = address.toLowerCase();

        Object.keys(cache).forEach(key => {
            if (key.startsWith(lowerAddress)) {
                delete cache[key];
            }
        });

        this.saveCache(cache);
    }

    /**
     * Get all cache from localStorage
     */
    getAllCache() {
        try {
            const cached = localStorage.getItem(this.STORAGE_KEY);
            return cached ? JSON.parse(cached) : {};
        } catch (error) {
            console.error('Error reading transactions cache:', error);
            return {};
        }
    }

    /**
     * Save cache to localStorage
     */
    saveCache(cache) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cache));
        } catch (error) {
            console.error('Error saving transactions cache:', error);
        }
    }
}

export const UserTransactionsCacheInstance = new UserTransactionsCache();
