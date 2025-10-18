const Bet = require('../models/Bet');
const { logger } = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

/**
 * Betting Pool Service
 * Handles betting pool mechanics, reward distribution, and market dynamics
 */
class BettingPoolService {

  /**
   * Calculate current prices for all options in a bet
   * Uses Automated Market Maker (AMM) formula for dynamic pricing
   */
  static calculateOptionPrices(bet) {
    const totalVolume = bet.totalVolume || 0;
    console.log(`📊 calculateOptionPrices - totalVolume: ${totalVolume}, bet: ${bet.title}`);

    if (totalVolume === 0) {
      // Use stored currentPrice from database (from seed data or admin panel)
      const prices = bet.options.map(option => {
        const price = Math.round(option.currentPrice || 50);
        console.log(`💰 Using stored currentPrice: ${option.currentPrice} → ${price}`);
        return price;
      });
      console.log(`✅ Returning stored prices: ${prices.join(', ')}`);
      return prices;
    }

    // Calculate shares for each option
    const optionVolumes = bet.options.map(option => option.totalAmount || 0);

    // Use constant product formula for price calculation
    const prices = optionVolumes.map(volume => {
      if (totalVolume === 0) return 50; // Default price

      // Price = (volume / total) * 100 with some smoothing
      let price = (volume / totalVolume) * 100;

      // Add liquidity adjustment to prevent extreme prices
      const liquidityAdjustment = Math.min(5, totalVolume * 0.01);
      price = Math.max(5 + liquidityAdjustment, Math.min(95 - liquidityAdjustment, price));

      return Math.round(price);
    });

    return prices;
  }

  /**
   * Calculate shares a user will receive for a given bet amount
   */
  static calculateShares(betAmount, optionPrice, totalPool = 0) {
    // Base shares calculation
    let shares = betAmount / (optionPrice / 100);

    // Apply bonuses for early betting or large pools
    if (totalPool > 0) {
      // Early bird bonus (decreases as pool grows)
      const earlyBirdMultiplier = Math.max(1, 1.1 - (totalPool / 10000));
      shares *= earlyBirdMultiplier;
    }

    return parseFloat(shares.toFixed(8));
  }

  /**
   * Calculate potential winnings for a bet
   */
  static calculatePotentialWinnings(shares, optionTotalShares, totalPoolValue) {
    if (!shares || !totalPoolValue || optionTotalShares === 0) return 0;

    // Winner takes all model with platform fee
    const platformFeeRate = 0.02; // 2% platform fee
    const netPoolValue = totalPoolValue * (1 - platformFeeRate);

    // Proportional share of the winning pool
    const shareRatio = shares / optionTotalShares;
    const potentialWinnings = shareRatio * netPoolValue;

    return parseFloat(potentialWinnings.toFixed(8));
  }

  /**
   * Update bet prices after a new bet is placed
   */
  static async updateBetPrices(betId, placedOptionIndex, amount) {
    try {
      const bet = await Bet.findById(betId);
      if (!bet) throw new AppError('Bet not found', 404);

      // Recalculate all option prices
      const newPrices = this.calculateOptionPrices(bet);

      // Update the bet options with new prices
      bet.options.forEach((option, index) => {
        option.yesPrice = newPrices[index];
        option.noPrice = 100 - newPrices[index];
      });

      await bet.save();

      logger.info(`Prices updated for bet ${betId} after ${amount} bet on option ${placedOptionIndex}`);

      return newPrices;
    } catch (error) {
      logger.error('Error updating bet prices:', error);
      throw error;
    }
  }

  /**
   * Calculate and distribute winnings when a bet is resolved
   */
  static async distributeWinnings(betId, winningOptionIndex) {
    try {
      const bet = await Bet.findById(betId);
      if (!bet) throw new AppError('Bet not found', 404);

      if (!bet.isResolved) throw new AppError('Bet is not resolved', 400);

      const winningOption = bet.options[winningOptionIndex];
      const totalPool = bet.totalVolume;
      const platformFeeRate = 0.02; // 2% platform fee
      const netPool = totalPool * (1 - platformFeeRate);

      // Calculate winnings for each winning bet
      const winningBets = bet.userBets.filter(userBet =>
        userBet.optionIndex === winningOptionIndex && !userBet.claimed
      );

      const totalWinningShares = winningBets.reduce((sum, userBet) => sum + userBet.shares, 0);

      const distributionResults = [];

      for (const userBet of winningBets) {
        if (totalWinningShares > 0) {
          const shareRatio = userBet.shares / totalWinningShares;
          const winnings = shareRatio * netPool;

          userBet.winnings = parseFloat(winnings.toFixed(8));

          distributionResults.push({
            userId: userBet.userId,
            userAddress: userBet.userAddress,
            originalBet: userBet.amount,
            shares: userBet.shares,
            winnings: userBet.winnings,
            profit: userBet.winnings - userBet.amount
          });
        }
      }

      await bet.save();

      logger.info(`Winnings distributed for bet ${betId}:`, {
        totalPool,
        netPool,
        winningBets: winningBets.length,
        totalWinningShares,
        distributionResults
      });

      return {
        totalPool,
        netPool,
        platformFee: totalPool * platformFeeRate,
        winningBets: winningBets.length,
        totalWinningShares,
        distributions: distributionResults
      };

    } catch (error) {
      logger.error('Error distributing winnings:', error);
      throw error;
    }
  }

  /**
   * Get betting statistics for a user
   */
  static async getUserBettingStats(userAddress) {
    try {
      const bets = await Bet.find({
        'userBets.userAddress': userAddress.toLowerCase()
      });

      let totalBets = 0;
      let totalWagered = 0;
      let totalWinnings = 0;
      let activeBets = 0;
      let wonBets = 0;
      let lostBets = 0;

      for (const bet of bets) {
        const userBets = bet.userBets.filter(ub =>
          ub.userAddress.toLowerCase() === userAddress.toLowerCase()
        );

        for (const userBet of userBets) {
          totalBets++;
          totalWagered += userBet.amount;

          if (bet.isResolved) {
            if (userBet.optionIndex === bet.winningOptionIndex) {
              wonBets++;
              totalWinnings += userBet.winnings || 0;
            } else {
              lostBets++;
            }
          } else {
            activeBets++;
          }
        }
      }

      return {
        totalBets,
        totalWagered: parseFloat(totalWagered.toFixed(8)),
        totalWinnings: parseFloat(totalWinnings.toFixed(8)),
        netProfit: parseFloat((totalWinnings - totalWagered).toFixed(8)),
        activeBets,
        wonBets,
        lostBets,
        winRate: totalBets > 0 ? parseFloat(((wonBets / (wonBets + lostBets)) * 100).toFixed(2)) : 0,
        roi: totalWagered > 0 ? parseFloat((((totalWinnings - totalWagered) / totalWagered) * 100).toFixed(2)) : 0
      };

    } catch (error) {
      logger.error('Error getting user betting stats:', error);
      throw error;
    }
  }

  /**
   * Validate betting constraints before placing a bet
   */
  static validateBettingConstraints(bet, amount, userAddress) {
    const errors = [];

    // Check bet status
    if (!bet.isActive) {
      errors.push('Bet is not active');
    }

    if (bet.isResolved) {
      errors.push('Bet has already been resolved');
    }

    if (new Date() > bet.endTime) {
      errors.push('Betting period has ended');
    }

    // Check amount constraints
    if (amount < bet.minBetAmount) {
      errors.push(`Minimum bet amount is ${bet.minBetAmount / 1000000} USDC`);
    }

    if (amount > bet.maxBetAmount) {
      errors.push(`Maximum bet amount is ${bet.maxBetAmount / 1000000} USDC`);
    }

    // Check user's total betting on this bet
    // TODO: Implement UserPosition-based user total betting check
    // const userTotalBets = bet.userBets
    //   .filter(ub => ub.userAddress.toLowerCase() === userAddress.toLowerCase())
    //   .reduce((sum, ub) => sum + ub.amount, 0);

    // const maxUserTotal = bet.maxBetAmount * 10; // User can bet up to 10x max single bet
    // if (userTotalBets + amount > maxUserTotal) {
    //   errors.push(`Total betting limit exceeded. Maximum total: ${maxUserTotal / 1000000} USDC`);
    // }

    return errors;
  }

  /**
   * Get market depth and liquidity information
   */
  static getMarketDepth(bet) {
    const totalVolume = bet.totalVolume || 0;
    const optionDepths = bet.options.map((option, index) => ({
      optionIndex: index,
      title: option.title,
      volume: option.totalAmount || 0,
      shares: option.totalShares || 0,
      price: option.yesPrice || 50,
      percentage: totalVolume > 0 ? Math.round((option.totalAmount / totalVolume) * 100) : 0,
      liquidity: this.calculateLiquidity(option.totalAmount, totalVolume)
    }));

    return {
      totalVolume,
      totalBets: bet.totalBets || 0,
      uniqueBettors: bet.uniqueBettors || 0,
      options: optionDepths,
      liquidityScore: this.calculateOverallLiquidity(bet)
    };
  }

  /**
   * Calculate liquidity score for an option
   */
  static calculateLiquidity(optionVolume, totalVolume) {
    if (totalVolume === 0) return 0;

    const volumeRatio = optionVolume / totalVolume;
    // Liquidity is highest when volume is evenly distributed
    const liquidityScore = 1 - Math.abs(volumeRatio - 0.5) * 2;

    return Math.round(liquidityScore * 100);
  }

  /**
   * Calculate overall market liquidity
   */
  static calculateOverallLiquidity(bet) {
    if (bet.totalVolume < 10) return 'Low';
    if (bet.totalVolume < 100) return 'Medium';
    if (bet.totalVolume < 1000) return 'High';
    return 'Very High';
  }

  /**
   * Simulate betting outcome and returns
   */
  static simulateBetting(bet, optionIndex, amount) {
    const currentPrice = bet.options[optionIndex].yesPrice || 50;
    const shares = this.calculateShares(amount, currentPrice, bet.totalVolume);

    // Simulate different scenarios
    const scenarios = [];

    // If this option wins
    const currentOptionShares = bet.options[optionIndex].totalShares || 0;
    const totalWinningShares = currentOptionShares + shares;
    const potentialWinnings = this.calculatePotentialWinnings(
      shares,
      totalWinningShares,
      bet.totalVolume + amount
    );

    scenarios.push({
      scenario: 'win',
      probability: currentPrice,
      winnings: potentialWinnings,
      profit: potentialWinnings - amount,
      roi: amount > 0 ? ((potentialWinnings - amount) / amount) * 100 : 0
    });

    // If this option loses
    scenarios.push({
      scenario: 'lose',
      probability: 100 - currentPrice,
      winnings: 0,
      profit: -amount,
      roi: -100
    });

    return {
      betAmount: amount,
      shares,
      currentPrice,
      scenarios,
      expectedValue: scenarios.reduce((sum, s) =>
        sum + (s.winnings * s.probability / 100), 0
      ) - amount
    };
  }
}

module.exports = BettingPoolService;