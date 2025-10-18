// Statistics API Service for production FHEVM backend
const API_BASE_URL = 'http://localhost:3002/api/statistics';

class StatisticsService {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  async makeRequest(endpoint, options = {}) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      console.log(`📊 Statistics API Request: ${url}`);

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'API request failed');
      }

      console.log(`✅ Statistics API Response:`, data.data);
      return data.data;

    } catch (error) {
      console.error(`❌ Statistics API Error for ${endpoint}:`, error);
      throw error;
    }
  }

  // Get statistics for a specific bet
  async getBetStatistics(betId) {
    return await this.makeRequest(`/bet/${betId}`);
  }

  // Get user betting history and statistics
  async getUserStatistics(userAddress) {
    return await this.makeRequest(`/user/${userAddress}`);
  }

  // Get overall platform statistics
  async getOverallStatistics() {
    return await this.makeRequest('/overall');
  }

  // Get all events for a specific bet
  async getBetEvents(betId, eventType = null, limit = 100, offset = 0) {
    const params = new URLSearchParams({ limit, offset });
    if (eventType) params.append('eventType', eventType);

    return await this.makeRequest(`/events/${betId}?${params}`);
  }

  // Trigger historical event synchronization
  async syncHistoricalEvents(fromBlock = 0, toBlock = 'latest') {
    return await this.makeRequest('/sync-historical', {
      method: 'POST',
      body: JSON.stringify({ fromBlock, toBlock })
    });
  }

  // Health check
  async getHealth() {
    return await this.makeRequest('/health');
  }

  // Helper function to format volume for display
  formatVolume(volume) {
    if (volume === 0) return '$0';
    if (volume < 1000) return `$${volume}`;
    if (volume < 1000000) return `$${(volume / 1000).toFixed(1)}K`;
    return `$${(volume / 1000000).toFixed(1)}M`;
  }

  // Helper function to format large numbers
  formatNumber(num) {
    if (num === 0) return '0';
    if (num < 1000) return num.toString();
    if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
    return `${(num / 1000000).toFixed(1)}M`;
  }

  // Get enriched bet statistics with formatted values
  async getEnrichedBetStatistics(betId) {
    try {
      const stats = await this.getBetStatistics(betId);

      return {
        ...stats,
        formattedVolume: this.formatVolume(stats.totalVolume),
        formattedBets: this.formatNumber(stats.totalBets),
        formattedTraders: this.formatNumber(stats.uniqueTraders),
        hasData: stats.totalBets > 0
      };
    } catch (error) {
      console.error(`Failed to get enriched stats for bet ${betId}:`, error);
      return {
        betId,
        totalVolume: 0,
        totalBets: 0,
        uniqueTraders: 0,
        formattedVolume: '$0',
        formattedBets: '0',
        formattedTraders: '0',
        hasData: false,
        error: error.message
      };
    }
  }

  // Get enriched user statistics
  async getEnrichedUserStatistics(userAddress) {
    try {
      const stats = await this.getUserStatistics(userAddress);

      return {
        ...stats,
        formattedVolume: this.formatVolume(stats.statistics.totalVolume),
        formattedBets: this.formatNumber(stats.statistics.totalBets),
        hasData: stats.statistics.totalBets > 0
      };
    } catch (error) {
      console.error(`Failed to get enriched user stats for ${userAddress}:`, error);
      return {
        userAddress,
        statistics: {
          totalBets: 0,
          totalVolume: 0,
          uniqueBets: 0
        },
        bettingHistory: [],
        formattedVolume: '$0',
        formattedBets: '0',
        hasData: false,
        error: error.message
      };
    }
  }

  // Check if backend is available
  async isBackendAvailable() {
    try {
      await this.getHealth();
      return true;
    } catch (error) {
      console.warn('Backend not available:', error.message);
      return false;
    }
  }

  // Fallback methods for when backend is not available
  getFallbackBetStatistics(betId) {
    console.log(`📊 Using fallback statistics for bet ${betId}`);
    return {
      betId,
      totalVolume: 0,
      totalBets: 0,
      uniqueTraders: 0,
      formattedVolume: '$0',
      formattedBets: '0',
      formattedTraders: '0',
      hasData: false,
      isFallback: true
    };
  }

  getFallbackUserStatistics(userAddress) {
    console.log(`📊 Using fallback user statistics for ${userAddress}`);
    return {
      userAddress,
      statistics: {
        totalBets: 0,
        totalVolume: 0,
        uniqueBets: 0
      },
      bettingHistory: [],
      formattedVolume: '$0',
      formattedBets: '0',
      hasData: false,
      isFallback: true
    };
  }

  // Hybrid method: try backend first, fallback if needed
  async getBetStatisticsHybrid(betId) {
    const isAvailable = await this.isBackendAvailable();

    if (isAvailable) {
      return await this.getEnrichedBetStatistics(betId);
    } else {
      return this.getFallbackBetStatistics(betId);
    }
  }

  async getUserStatisticsHybrid(userAddress) {
    const isAvailable = await this.isBackendAvailable();

    if (isAvailable) {
      return await this.getEnrichedUserStatistics(userAddress);
    } else {
      return this.getFallbackUserStatistics(userAddress);
    }
  }
}

// Export singleton instance
export default new StatisticsService();