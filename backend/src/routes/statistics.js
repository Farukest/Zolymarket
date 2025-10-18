const express = require('express');
const router = express.Router();
const BetEvent = require('../models/BetEvent');
const eventListener = require('../services/eventListener');
const { body, param, validationResult } = require('express-validator');

// Middleware for validation error handling
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

/**
 * GET /api/statistics/bet/:betId
 * Get detailed statistics for a specific bet
 */
router.get('/bet/:betId', [
  param('betId').isNumeric().withMessage('Bet ID must be a number')
], handleValidationErrors, async (req, res) => {
  try {
    const { betId } = req.params;

    console.log(`📊 Getting statistics for bet ${betId}...`);

    // Get statistics using the model's static method
    const stats = await BetEvent.getBetStatistics(betId);

    // Get additional event details
    const betEvents = await BetEvent.find({
      betId: betId.toString(),
      eventType: 'BetPlaced'
    })
    .sort({ timestamp: -1 })
    .select('user optionIndex actualAmount timestamp txHash')
    .lean();

    // Calculate option-specific statistics
    const optionStats = {};
    betEvents.forEach(event => {
      const optionIndex = event.optionIndex;
      if (!optionStats[optionIndex]) {
        optionStats[optionIndex] = {
          totalVolume: 0,
          totalBets: 0,
          uniqueTraders: new Set()
        };
      }

      optionStats[optionIndex].totalVolume += event.actualAmount || 0;
      optionStats[optionIndex].totalBets += 1;
      optionStats[optionIndex].uniqueTraders.add(event.user);
    });

    // Convert Set to count for JSON serialization
    Object.keys(optionStats).forEach(optionIndex => {
      optionStats[optionIndex].uniqueTraders = optionStats[optionIndex].uniqueTraders.size;
    });

    const response = {
      success: true,
      data: {
        betId: stats.betId || betId,
        totalVolume: stats.totalVolume || 0,
        totalBets: stats.totalBets || 0,
        uniqueTraders: stats.uniqueTraders || 0,
        optionStats,
        recentBets: betEvents.slice(0, 10) // Last 10 bets
      }
    };

    console.log(`✅ Statistics for bet ${betId}:`, response.data);
    res.json(response);

  } catch (error) {
    console.error(`❌ Error getting bet statistics for ${req.params.betId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to get bet statistics',
      error: error.message
    });
  }
});

/**
 * GET /api/statistics/user/:address
 * Get user's betting history and statistics
 */
router.get('/user/:address', [
  param('address').isEthereumAddress().withMessage('Invalid Ethereum address')
], handleValidationErrors, async (req, res) => {
  try {
    const { address } = req.params;
    const userAddress = address.toLowerCase();

    console.log(`👤 Getting user statistics for ${userAddress}...`);

    // Get user's bet history
    const userBets = await BetEvent.getUserBetHistory(userAddress);

    // Calculate user statistics
    const userStats = {
      totalBets: userBets.length,
      totalVolume: userBets.reduce((sum, bet) => sum + (bet.actualAmount || 0), 0),
      uniqueBets: new Set(userBets.map(bet => bet.betId)).size,
      firstBetDate: userBets.length > 0 ? userBets[userBets.length - 1].timestamp : null,
      lastBetDate: userBets.length > 0 ? userBets[0].timestamp : null
    };

    // Get betting pattern by day
    const bettingPattern = {};
    userBets.forEach(bet => {
      const date = bet.timestamp.toISOString().split('T')[0];
      if (!bettingPattern[date]) {
        bettingPattern[date] = { bets: 0, volume: 0 };
      }
      bettingPattern[date].bets += 1;
      bettingPattern[date].volume += bet.actualAmount || 0;
    });

    res.json({
      success: true,
      data: {
        userAddress,
        statistics: userStats,
        bettingHistory: userBets.slice(0, 50), // Last 50 bets
        bettingPattern
      }
    });

  } catch (error) {
    console.error(`❌ Error getting user statistics for ${req.params.address}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user statistics',
      error: error.message
    });
  }
});

/**
 * GET /api/statistics/overall
 * Get overall platform statistics
 */
router.get('/overall', async (req, res) => {
  try {
    console.log('🌍 Getting overall platform statistics...');

    const overallStats = await BetEvent.getOverallStatistics();

    // Get recent activity
    const recentActivity = await BetEvent.find({
      eventType: 'BetPlaced'
    })
    .sort({ timestamp: -1 })
    .limit(20)
    .select('betId user optionIndex actualAmount timestamp txHash')
    .lean();

    // Get statistics by time period
    const now = new Date();
    const timeStats = {
      last24h: await BetEvent.countDocuments({
        eventType: 'BetPlaced',
        timestamp: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
      }),
      last7d: await BetEvent.countDocuments({
        eventType: 'BetPlaced',
        timestamp: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
      }),
      last30d: await BetEvent.countDocuments({
        eventType: 'BetPlaced',
        timestamp: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }
      })
    };

    res.json({
      success: true,
      data: {
        overall: overallStats,
        timeStats,
        recentActivity
      }
    });

  } catch (error) {
    console.error('❌ Error getting overall statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get overall statistics',
      error: error.message
    });
  }
});

/**
 * GET /api/statistics/events/:betId
 * Get all events for a specific bet
 */
router.get('/events/:betId', [
  param('betId').isNumeric().withMessage('Bet ID must be a number')
], handleValidationErrors, async (req, res) => {
  try {
    const { betId } = req.params;
    const { eventType, limit = 100, offset = 0 } = req.query;

    const query = { betId: betId.toString() };
    if (eventType) {
      query.eventType = eventType;
    }

    const events = await BetEvent.find(query)
      .sort({ timestamp: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .lean();

    const totalEvents = await BetEvent.countDocuments(query);

    res.json({
      success: true,
      data: {
        events,
        pagination: {
          total: totalEvents,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: totalEvents > (parseInt(offset) + events.length)
        }
      }
    });

  } catch (error) {
    console.error(`❌ Error getting events for bet ${req.params.betId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to get bet events',
      error: error.message
    });
  }
});

/**
 * POST /api/statistics/sync-historical
 * Manually trigger historical event synchronization
 */
router.post('/sync-historical', [
  body('fromBlock').optional().isNumeric().withMessage('fromBlock must be a number'),
  body('toBlock').optional().isString().withMessage('toBlock must be a number or "latest"')
], handleValidationErrors, async (req, res) => {
  try {
    const { fromBlock = 0, toBlock = 'latest' } = req.body;

    console.log(`🔄 Starting historical sync from block ${fromBlock} to ${toBlock}...`);

    // This is an async operation, so we'll start it and return immediately
    eventListener.processHistoricalEvents(fromBlock, toBlock)
      .then(() => {
        console.log('✅ Historical sync completed successfully');
      })
      .catch(error => {
        console.error('❌ Historical sync failed:', error);
      });

    res.json({
      success: true,
      message: 'Historical sync started',
      data: {
        fromBlock,
        toBlock,
        status: 'in_progress'
      }
    });

  } catch (error) {
    console.error('❌ Error starting historical sync:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start historical sync',
      error: error.message
    });
  }
});

/**
 * GET /api/statistics/bet/:betId/direct
 * Get bet statistics directly from contract (fallback when events aren't synced)
 */
router.get('/bet/:betId/direct', [
  param('betId').isNumeric().withMessage('Bet ID must be a number')
], handleValidationErrors, async (req, res) => {
  try {
    const { betId } = req.params;
    console.log(`📊 Getting DIRECT contract statistics for bet ${betId}...`);

    const { ethers } = require('ethers');

    // Initialize provider and contract
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const BetMarketArtifact = require('../abi/BetMarket.json');
    const contract = new ethers.Contract(
      process.env.BET_MARKET_ADDRESS,
      BetMarketArtifact.abi,
      provider
    );

    // Get bet details first
    const bet = await contract.getBet(betId);

    // For binary bet (Yes/No), we have 2 options: index 0 and 1
    const optionCount = 2; // Binary bets always have 2 options

    let totalVolume = 0;
    let totalShares = 0;
    const optionStats = {};

    for (let i = 0; i < optionCount; i++) {
      try {
        const option = await contract.getBetOption(betId, i);
        const shares = parseInt(option.totalShares.toString());
        // In our corrected contract: 1 share = 1 USDC, so volume = shares
        const volume = shares;

        totalVolume += volume;
        totalShares += shares;

        optionStats[i] = {
          totalVolume: volume,
          totalShares: shares,
          totalBets: Math.max(shares, 1), // Estimate: assume at least 1 bet if there are shares
          uniqueTraders: Math.ceil(shares / 10) // Rough estimate: 1 trader per 10 shares
        };
      } catch (error) {
        console.warn(`Could not get option ${i} for bet ${betId}:`, error.message);
        optionStats[i] = {
          totalVolume: 0,
          totalShares: 0,
          totalBets: 0,
          uniqueTraders: 0
        };
      }
    }

    // Get overall bet stats (mock total bets as we don't track individual transactions)
    const estimatedTotalBets = Math.max(totalShares, 1); // At least 1 if there are shares

    const response = {
      success: true,
      data: {
        betId,
        totalVolume,
        totalBets: estimatedTotalBets,
        totalShares,
        uniqueTraders: Math.ceil(estimatedTotalBets / 2), // Rough estimate
        optionStats,
        dataSource: 'direct_contract',
        recentBets: [] // Not available from direct contract read
      }
    };

    console.log(`✅ DIRECT contract statistics for bet ${betId}:`, response.data);
    res.json(response);

  } catch (error) {
    console.error(`❌ Error getting direct contract statistics for bet ${req.params.betId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to get direct contract statistics',
      error: error.message
    });
  }
});

/**
 * GET /api/statistics/health
 * Health check for the statistics service
 */
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    const recentEventCount = await BetEvent.countDocuments({
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    // Check event listener status
    const isListening = eventListener.isListening;

    res.json({
      success: true,
      data: {
        status: 'healthy',
        eventListener: {
          isListening,
          lastProcessedBlock: eventListener.latestProcessedBlock
        },
        database: {
          connected: true,
          recentEvents24h: recentEventCount
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;