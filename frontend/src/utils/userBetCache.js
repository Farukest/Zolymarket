const CACHE_DURATION = 5 * 60 * 1000; // 5 dakika

class UserBetCache {
    constructor() {
        this.storageKey = 'userBetData';
    }

    _getCacheKey(account, chainId, betId) {
        return `${account.toLowerCase()}_${chainId}_${betId}`;
    }

    get(account, chainId, betId) {
        if (!account || !chainId || !betId) return null;

        try {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored) return null;

            const allCache = JSON.parse(stored);
            const key = this._getCacheKey(account, chainId, betId);
            const cached = allCache[key];

            if (!cached) return null;

            // Expire check
            if (Date.now() - cached.timestamp > CACHE_DURATION) {
                this.remove(account, chainId, betId);
                return null;
            }

            return cached.data;
        } catch (error) {
            console.error('Cache read error:', error);
            return null;
        }
    }

    save(account, chainId, betId, data) {
        if (!account || !chainId || !betId) return;

        try {
            const stored = localStorage.getItem(this.storageKey) || '{}';
            const allCache = JSON.parse(stored);
            const key = this._getCacheKey(account, chainId, betId);

            allCache[key] = {
                timestamp: Date.now(),
                data: data
            };

            localStorage.setItem(this.storageKey, JSON.stringify(allCache));
            console.log(`✅ Cache saved for ${key}:`, data);
        } catch (error) {
            console.error('Cache save error:', error);
        }
    }

    remove(account, chainId, betId) {
        if (!account || !chainId || !betId) return;

        try {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored) return;

            const allCache = JSON.parse(stored);
            const key = this._getCacheKey(account, chainId, betId);
            delete allCache[key];

            localStorage.setItem(this.storageKey, JSON.stringify(allCache));
            console.log(`🗑️ Cache removed for ${key}`);
        } catch (error) {
            console.error('Cache remove error:', error);
        }
    }

    clear() {
        localStorage.removeItem(this.storageKey);
        console.log('🗑️ All bet cache cleared');
    }
}

export default new UserBetCache();
