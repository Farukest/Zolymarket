const { ethers } = require('ethers');
const Bet = require('../models/Bet');
const UserPosition = require('../models/UserPosition');

/**
 * FHEVM Aggregation Service
 * Handles encrypted amount aggregation and privacy-preserving analytics
 */
class FHEVMAggregationService {
  constructor() {
    this.provider = null;
    this.betMarketContract = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('🔢 Initializing FHEVM Aggregation Service...');

      // Initialize provider
      this.provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

      // Initialize contract
      const BetMarketArtifact = require('../abi/BetMarket.json');
      this.betMarketContract = new ethers.Contract(
        process.env.BET_MARKET_ADDRESS,
        BetMarketArtifact.abi,
        this.provider
      );

      this.isInitialized = true;
      console.log('✅ FHEVM Aggregation Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize FHEVM Aggregation Service:', error);
      throw error;
    }
  }

  /**
   * Get aggregated bet data with privacy preservation
   */
  async getAggregatedBetData(contractBetId, userAddress = null) {
    try {
      console.log(`📊 Getting aggregated data for bet ${contractBetId}...`);

      const bet = await Bet.findOne({ contractId: contractBetId });
      if (!bet) {
        throw new Error(`Bet ${contractBetId} not found`);
      }

      // Get basic public data
      const aggregatedData = {
        betId: contractBetId,
        title: bet.title,
        description: bet.description,
        endTime: bet.endTime,
        isActive: bet.isActive,
        isResolved: bet.isResolved,

        // Public statistics
        totalParticipants: bet.totalParticipants,
        totalBets: bet.totalBets,
        totalShares: bet.totalShares,

        // Option data
        options: [],

        // Privacy flags
        usesEncryption: bet.useFHEVM
      };

      // Process each option
      for (let i = 0; i < bet.options.length; i++) {
        const option = bet.options[i];

        const optionData = {
          index: i,
          title: option.title,
          description: option.description,
          currentPrice: option.currentPrice,
          isWinner: option.isWinner,
          publicTotalShares: option.publicTotalShares
        };

        // Add encrypted data if bet is resolved or user has access
        if (bet.isResolved || this.canUserViewEncryptedData(userAddress, bet)) {
          // For resolved bets, we can show aggregated totals
          if (bet.isResolved) {
            optionData.totalAmount = await this.getDecryptedOptionTotal(contractBetId, i);
            optionData.showEncryptedData = false;
          } else {
            // User has special access but bet not resolved
            optionData.showEncryptedData = true;
            optionData.encryptedTotalAmount = option.encryptedTotalAmount;
          }
        } else {
          // Hide encrypted data
          optionData.showEncryptedData = false;
          optionData.totalAmount = 'Private';
        }

        aggregatedData.options.push(optionData);
      }

      // Calculate market dynamics for resolved bets
      if (bet.isResolved) {
        aggregatedData.publicTotalVolume = bet.publicTotalVolume;
        aggregatedData.marketDynamics = await this.calculateMarketDynamics(contractBetId);
      } else {
        aggregatedData.publicTotalVolume = 'Private';
        aggregatedData.marketDynamics = null;
      }

      return aggregatedData;

    } catch (error) {
      console.error(`❌ Error getting aggregated bet data for ${contractBetId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate market dynamics (only for resolved bets)
   */
  async calculateMarketDynamics(contractBetId) {
    try {
      const positions = await UserPosition.find({
        contractBetId,
        isResolved: true,
        amount: { $ne: null } // Only positions with decrypted amounts
      });

      if (positions.length === 0) {
        return null;
      }

      // Group by option
      const optionData = {};
      let totalVolume = 0;

      positions.forEach(position => {
        if (!optionData[position.optionIndex]) {
          optionData[position.optionIndex] = {
            totalAmount: 0,
            totalShares: 0,
            participantCount: 0,
            participants: new Set()
          };
        }

        optionData[position.optionIndex].totalAmount += position.amount;
        optionData[position.optionIndex].totalShares += position.shares || 0;
        optionData[position.optionIndex].participants.add(position.userAddress);
        totalVolume += position.amount;
      });

      // Calculate final metrics
      const dynamics = {
        totalVolume,
        optionBreakdown: []
      };

      Object.keys(optionData).forEach(optionIndex => {
        const data = optionData[optionIndex];
        dynamics.optionBreakdown.push({
          optionIndex: Number(optionIndex),
          totalAmount: data.totalAmount,
          totalShares: data.totalShares,
          participantCount: data.participants.size,
          volumePercentage: totalVolume > 0 ? (data.totalAmount / totalVolume) * 100 : 0,
          averageBetSize: data.participants.size > 0 ? data.totalAmount / data.participants.size : 0
        });
      });

      return dynamics;

    } catch (error) {
      console.error(`❌ Error calculating market dynamics:`, error);
      return null;
    }
  }

  /**
   * Get user's portfolio aggregation with privacy
   */
  async getUserPortfolioAggregation(userAddress) {
    try {
      console.log(`👤 Getting portfolio aggregation for ${userAddress}...`);

      const positions = await UserPosition.find({
        userAddress: userAddress.toLowerCase()
      }).populate('betId', 'title endTime isResolved useFHEVM');

      const portfolio = {
        totalPositions: positions.length,
        activePositions: 0,
        resolvedPositions: 0,
        wonPositions: 0,
        totalPotentialPayout: 0,
        totalInvested: 0,
        totalRealized: 0,
        positions: []
      };

      for (const position of positions) {
        const positionData = {
          betId: position.contractBetId,
          betTitle: position.betId?.title || 'Unknown Bet',
          optionIndex: position.optionIndex,
          entryPrice: position.entryPrice,
          status: position.status,
          isResolved: position.isResolved,
          isWinner: position.isWinner,
          claimed: position.claimed,
          placeBetTxHash: position.placeBetTxHash
        };

        // Add financial data based on encryption and resolution status
        if (position.isEncrypted) {
          if (position.isResolved && position.amount !== null) {
            // Bet is resolved, show decrypted amounts
            positionData.amount = position.amount;
            positionData.shares = position.shares;
            positionData.payout = position.payout || 0;
            positionData.profitLoss = position.isWinner ? (position.payout - position.amount) : -position.amount;

            portfolio.totalInvested += position.amount;
            if (position.claimed && position.payout) {
              portfolio.totalRealized += position.payout;
            }
          } else {
            // Bet not resolved or amounts not decrypted
            positionData.amount = 'Private';
            positionData.shares = 'Private';
            positionData.payout = 'Private';
            positionData.profitLoss = 'Private';
          }
        } else {
          // Non-encrypted bet (if any)
          positionData.amount = position.amount;
          positionData.shares = position.shares;
          positionData.payout = position.payout || 0;
          positionData.profitLoss = position.isWinner ? (position.payout - position.amount) : -position.amount;

          portfolio.totalInvested += position.amount || 0;
          if (position.claimed && position.payout) {
            portfolio.totalRealized += position.payout;
          }
        }

        // Update counters
        if (position.isResolved) {
          portfolio.resolvedPositions++;
          if (position.isWinner) {
            portfolio.wonPositions++;
          }
        } else {
          portfolio.activePositions++;
        }

        portfolio.positions.push(positionData);
      }

      // Calculate additional metrics
      portfolio.winRate = portfolio.resolvedPositions > 0 ?
        (portfolio.wonPositions / portfolio.resolvedPositions) * 100 : 0;

      portfolio.roi = portfolio.totalInvested > 0 ?
        ((portfolio.totalRealized - portfolio.totalInvested) / portfolio.totalInvested) * 100 : 0;

      return portfolio;

    } catch (error) {
      console.error(`❌ Error getting user portfolio aggregation:`, error);
      throw error;
    }
  }

  /**
   * Get platform-wide aggregated statistics
   */
  async getPlatformAggregatedStatistics() {
    try {
      console.log('🌐 Getting platform aggregated statistics...');

      const [
        totalBets,
        activeBets,
        resolvedBets,
        totalUsers,
        recentActivity
      ] = await Promise.all([
        Bet.countDocuments(),
        Bet.countDocuments({ isActive: true, isResolved: false }),
        Bet.countDocuments({ isResolved: true }),
        UserPosition.distinct('userAddress').then(addresses => addresses.length),
        this.getRecentActivitySummary()
      ]);

      // For privacy, we don't aggregate total volumes across all bets
      // Only resolved bets can show their volumes
      const resolvedBetsWithVolume = await Bet.find({
        isResolved: true,
        publicTotalVolume: { $gt: 0 }
      }).select('publicTotalVolume');

      const totalResolvedVolume = resolvedBetsWithVolume.reduce(
        (sum, bet) => sum + bet.publicTotalVolume, 0
      );

      return {
        totalBets,
        activeBets,
        resolvedBets,
        totalUsers,
        totalResolvedVolume, // Only from resolved bets
        averageResolvedBetVolume: resolvedBetsWithVolume.length > 0 ?
          totalResolvedVolume / resolvedBetsWithVolume.length : 0,
        recentActivity,
        privacyNote: 'Active bet volumes are encrypted and not included in totals'
      };

    } catch (error) {
      console.error('❌ Error getting platform aggregated statistics:', error);
      throw error;
    }
  }

  /**
   * Get recent activity summary (privacy-preserving)
   */
  async getRecentActivitySummary(hours = 24) {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const [recentPositions, recentBets] = await Promise.all([
        UserPosition.countDocuments({ createdAt: { $gte: since } }),
        Bet.countDocuments({ createdAt: { $gte: since } })
      ]);

      return {
        recentBets,
        recentPositions,
        timeframe: `${hours} hours`
      };

    } catch (error) {
      console.error('❌ Error getting recent activity summary:', error);
      return { recentBets: 0, recentPositions: 0 };
    }
  }

  /**
   * Decrypt option total (only possible for resolved bets)
   */
  async getDecryptedOptionTotal(contractBetId, optionIndex) {
    try {
      // In a real implementation, this would use FHEVM decryption
      // For now, we'll sum up the decrypted amounts from user positions
      const positions = await UserPosition.find({
        contractBetId,
        optionIndex,
        isResolved: true,
        amount: { $ne: null }
      });

      return positions.reduce((sum, position) => sum + (position.amount || 0), 0);

    } catch (error) {
      console.error(`❌ Error getting decrypted option total:`, error);
      return 0;
    }
  }

  /**
   * Check if user can view encrypted data
   */
  canUserViewEncryptedData(userAddress, bet) {
    if (!userAddress) return false;

    // Bet creator can view
    if (bet.createdBy.toLowerCase() === userAddress.toLowerCase()) {
      return true;
    }

    // Add other access control logic here (admin, etc.)
    return false;
  }

  /**
   * Update aggregated data for a bet (called after new positions)
   */
  async updateBetAggregatedData(contractBetId) {
    try {
      console.log(`🔄 Updating aggregated data for bet ${contractBetId}...`);

      const bet = await Bet.findOne({ contractId: contractBetId });
      if (!bet) return;

      const positions = await UserPosition.find({ contractBetId });

      // Update public statistics
      bet.totalBets = positions.length;
      bet.totalParticipants = new Set(positions.map(p => p.userAddress)).size;

      // If bet is resolved, update public volume
      if (bet.isResolved) {
        const totalVolume = positions
          .filter(p => p.amount !== null)
          .reduce((sum, p) => sum + (p.amount || 0), 0);

        bet.publicTotalVolume = totalVolume;
      }

      // Update per-option aggregated data
      for (let i = 0; i < bet.options.length; i++) {
        const optionPositions = positions.filter(p => p.optionIndex === i);

        // Update public shares count
        bet.options[i].publicTotalShares = optionPositions.length;

        // For resolved bets, update total amounts
        if (bet.isResolved) {
          const optionTotal = optionPositions
            .filter(p => p.amount !== null)
            .reduce((sum, p) => sum + (p.amount || 0), 0);

          // Store as string to maintain consistency with encrypted format
          bet.options[i].encryptedTotalAmount = optionTotal.toString();
        }
      }

      await bet.save();
      console.log(`✅ Updated aggregated data for bet ${contractBetId}`);

    } catch (error) {
      console.error(`❌ Error updating aggregated data for bet ${contractBetId}:`, error);
    }
  }

  /**
   * Aggregate encrypted amounts for analytics (privacy-preserving)
   */
  async getPrivacyPreservingAnalytics(contractBetId) {
    try {
      const positions = await UserPosition.find({ contractBetId });

      // We can provide analytics that don't reveal individual amounts
      return {
        participantCount: new Set(positions.map(p => p.userAddress)).size,
        positionCount: positions.length,
        optionDistribution: this.calculateOptionDistribution(positions),
        timeDistribution: this.calculateTimeDistribution(positions),
        // No amount-based analytics for active encrypted bets
        privacyNote: 'Amount-based analytics available only after bet resolution'
      };

    } catch (error) {
      console.error('❌ Error getting privacy-preserving analytics:', error);
      return null;
    }
  }

  /**
   * Calculate option distribution (count-based, not amount-based)
   */
  calculateOptionDistribution(positions) {
    const distribution = {};
    positions.forEach(position => {
      distribution[position.optionIndex] = (distribution[position.optionIndex] || 0) + 1;
    });
    return distribution;
  }

  /**
   * Calculate time distribution of bets
   */
  calculateTimeDistribution(positions) {
    const hourlyDistribution = {};
    positions.forEach(position => {
      const hour = new Date(position.createdAt).getHours();
      hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
    });
    return hourlyDistribution;
  }
}

module.exports = new FHEVMAggregationService();