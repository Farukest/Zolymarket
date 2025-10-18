const ORDER_HISTORY_CACHE_KEY = 'orderHistory';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const OrderHistoryCache = {
    // Save order history for a specific bet
    save: (account, chainId, betId, orders) => {
        try {
            const key = `${ORDER_HISTORY_CACHE_KEY}_${account}_${chainId}`;
            const existing = localStorage.getItem(key);
            const cache = existing ? JSON.parse(existing) : {};

            cache[betId] = {
                orders,
                timestamp: Date.now()
            };

            localStorage.setItem(key, JSON.stringify(cache));
            console.log(`Order history cache saved for bet ${betId}`);
        } catch (error) {
            console.error('Failed to save order history cache:', error);
        }
    },

    // Get order history for a specific bet
    get: (account, chainId, betId) => {
        try {
            const key = `${ORDER_HISTORY_CACHE_KEY}_${account}_${chainId}`;
            const cached = localStorage.getItem(key);

            if (!cached) return null;

            const cache = JSON.parse(cached);
            const betCache = cache[betId];

            if (!betCache) return null;

            // Check if cache expired
            if (Date.now() - betCache.timestamp > CACHE_DURATION) {
                delete cache[betId];
                localStorage.setItem(key, JSON.stringify(cache));
                return null;
            }

            return betCache.orders;
        } catch (error) {
            console.error('Failed to get order history cache:', error);
            return null;
        }
    },

    // Update single order
    updateSingle: (account, chainId, betId, txHash, updatedOrder) => {
        try {
            const key = `${ORDER_HISTORY_CACHE_KEY}_${account}_${chainId}`;
            const cached = localStorage.getItem(key);

            if (!cached) return;

            const cache = JSON.parse(cached);
            const betCache = cache[betId];

            if (!betCache) return;

            // Find and update order
            const orders = betCache.orders.map(order =>
                order.txHash === txHash ? updatedOrder : order
            );

            cache[betId] = {
                orders,
                timestamp: Date.now()
            };

            localStorage.setItem(key, JSON.stringify(cache));
            console.log(`Order cache updated for ${txHash}`);
        } catch (error) {
            console.error('Failed to update order cache:', error);
        }
    },

    // Clear all cache
    clear: (account, chainId) => {
        try {
            const key = `${ORDER_HISTORY_CACHE_KEY}_${account}_${chainId}`;
            localStorage.removeItem(key);
        } catch (error) {
            console.error('Failed to clear order history cache:', error);
        }
    }
};
