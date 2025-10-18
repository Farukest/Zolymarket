const POSITION_CACHE_KEY = 'betPositions';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 saat

export const PositionCache = {
    // Belirli bir bet için tüm pozisyonları kaydet
    save: (account, chainId, betId, positions) => {
        try {
            const key = `${POSITION_CACHE_KEY}_${account}_${chainId}`;
            const existing = localStorage.getItem(key);
            const cache = existing ? JSON.parse(existing) : {};

            cache[betId] = {
                positions,
                timestamp: Date.now()
            };

            localStorage.setItem(key, JSON.stringify(cache));
            console.log(`Position cache saved for bet ${betId}`);
        } catch (error) {
            console.error('Failed to save position cache:', error);
        }
    },

    // Belirli bir bet için pozisyonları getir
    get: (account, chainId, betId) => {
        try {
            const key = `${POSITION_CACHE_KEY}_${account}_${chainId}`;
            const cached = localStorage.getItem(key);

            if (!cached) return null;

            const cache = JSON.parse(cached);
            const betCache = cache[betId];

            if (!betCache) return null;

            // Cache süresi dolmuş mu kontrol et
            if (Date.now() - betCache.timestamp > CACHE_DURATION) {
                delete cache[betId];
                localStorage.setItem(key, JSON.stringify(cache));
                return null;
            }

            return betCache.positions;
        } catch (error) {
            console.error('Failed to get position cache:', error);
            return null;
        }
    },

    // Tek bir pozisyonu güncelle
    updateSingle: (account, chainId, betId, positionKey, updatedPosition) => {
        try {
            const key = `${POSITION_CACHE_KEY}_${account}_${chainId}`;
            const cached = localStorage.getItem(key);

            if (!cached) return;

            const cache = JSON.parse(cached);
            const betCache = cache[betId];

            if (!betCache) return;

            // Pozisyonu bul ve güncelle
            const positions = betCache.positions.map(pos =>
                pos.positionKey === positionKey ? updatedPosition : pos
            );

            cache[betId] = {
                positions,
                timestamp: Date.now()
            };

            localStorage.setItem(key, JSON.stringify(cache));
            console.log(`Position cache updated for ${positionKey}`);
        } catch (error) {
            console.error('Failed to update position cache:', error);
        }
    },

    // Tüm cache'i temizle
    clear: (account, chainId) => {
        try {
            const key = `${POSITION_CACHE_KEY}_${account}_${chainId}`;
            localStorage.removeItem(key);
        } catch (error) {
            console.error('Failed to clear position cache:', error);
        }
    }
};
