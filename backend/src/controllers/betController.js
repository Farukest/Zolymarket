const Bet = require('../models/Bet');
const BetHybrid = require('../models/BetHybrid');
const Category = require('../models/Category');
const { contractService } = require('../services/contractService');
const { logger } = require('../utils/logger');
const { ethers } = require('ethers');
const BettingPoolService = require('../services/bettingPoolService');
const { AppError } = require('../middleware/errorHandler');
const { findOrCreateUserByWallet, updateUserStats } = require('../services/userService');
const BetEvent = require('../models/BetEvent');
const UserPosition = require('../models/UserPosition');

// Get all bets with filtering and pagination
exports.getBets = async (req, res, next) => {
  try {
    console.log('🔥 getBets function called!');

    const {
      page = 1,
      limit = 20,
      filter = 'all',
      categoryId,
      status = 'active',
      search,
    } = req.query;

    console.log('🔍 getBets called with params:', { page, limit, filter, categoryId, status, search });

    // First, let's check the database connection and see raw data
    const totalDocsInCollection = await Bet.countDocuments({});
    console.log('📊 Total documents in bets collection:', totalDocsInCollection);

    // Try to find any bet without conditions
    const anyBet = await Bet.findOne({});
    console.log('📄 Sample bet document:', anyBet ? anyBet.title : 'No bets found');

    // Build query
    const query = {};
    console.log('📋 Initial query:', query);

    // Filter by status - simplified for testing
    if (status === 'active') {
      query.isActive = true;
      query.isResolved = false;
    } else if (status === 'resolved') {
      query.isResolved = true;
    } else if (status === 'ended') {
      query.endTime = { $lte: new Date() };
    }

    // For debugging: return all bets without any filters
    // Try hybrid bets first
    const hybridBets = await BetHybrid.findActive(parseInt(limit));
    console.log('📋 Found hybrid bets:', hybridBets.length);

    const allBets = hybridBets.length > 0 ? hybridBets : await Bet.find({}).limit(parseInt(limit));
    console.log('📋 Using bets:', allBets.length, hybridBets.length > 0 ? '(hybrid)' : '(legacy)');
    console.log('📄 First bet title:', allBets[0]?.title || 'No bets');

    // Transform bets for frontend
    const transformedBets = allBets.map(bet => {
      const betObj = bet.toObject();

      // Calculate dynamic prices using market maker algorithm
      const currentPrices = BettingPoolService.calculateOptionPrices(betObj);

      // Fix broken options format and add pricing
      if (betObj.options && Array.isArray(betObj.options)) {
        betObj.options = betObj.options.map((option, index) => {
          let optionText;
          let optionData = {};

          if (typeof option === 'string') {
            optionText = option;
          } else if (option && typeof option === 'object') {
            // Preserve existing option data
            optionData = { ...option };

            // Reconstruct string from character array format
            if (option['0'] && option['1']) {
              // It's in broken format like {0: 'Y', 1: 'e', 2: 's'}
              let reconstructed = '';
              let i = 0;
              while (option[i] !== undefined) {
                reconstructed += option[i];
                i++;
              }
              optionText = reconstructed;
            } else {
              optionText = option.title || option.name || 'Option';
            }
          } else {
            optionText = 'Option';
          }

          // Return option with proper structure and dynamic pricing
          return {
            ...optionData,
            title: optionText,
            currentOdds: currentPrices[index] / 100,
            price: currentPrices[index],
            totalAmount: optionData.totalAmount || 0,
            totalShares: optionData.totalShares || 0,
            publicTotalShares: optionData.publicTotalShares || 0,
            encryptedTotalShares: optionData.encryptedTotalShares || null
          };
        });
      }

      return betObj;
    });

    console.log('🔥 Sample transformed bet options:', transformedBets[0]?.options);

    return res.status(200).json({
      success: true,
      count: transformedBets.length,
      total: transformedBets.length,
      currentPage: parseInt(page),
      totalPages: Math.ceil(transformedBets.length / parseInt(limit)),
      data: {
        bets: transformedBets
      },
    });

    // Filter by category
    if (categoryId) {
      query.categoryId = categoryId; // FHEVM categories use string IDs
    }

    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Build sort criteria
    let sort = {};
    switch (filter) {
      case 'trending':
        sort = { volume: -1, createdAt: -1 };
        break;
      case 'new':
        sort = { createdAt: -1 };
        break;
      case 'ending-soon':
        query.endTime = { $gt: new Date(), $lt: new Date(Date.now() + 24 * 60 * 60 * 1000) };
        sort = { endTime: 1 };
        break;
      case 'volume':
        sort = { volume: -1 };
        break;
      default:
        sort = { createdAt: -1 };
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log('🔍 Final query:', JSON.stringify(query, null, 2));
    console.log('📄 Sort:', JSON.stringify(sort, null, 2));

    const bets = await Bet.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Bet.countDocuments(query);

    console.log('📊 Query results:', { betsFound: bets.length, total });

    res.status(200).json({
      success: true,
      count: bets.length,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: { bets },
    });
  } catch (error) {
    next(error);
  }
};

// Get single bet
exports.getBet = async (req, res, next) => {
  try {
    console.log('🔍 getBet called for ID:', req.params.id);

    let bet;

    // Check if ID is numeric (contract ID) or MongoDB ObjectId
    if (/^\d+$/.test(req.params.id)) {
      // Numeric ID - search by contractId
      bet = await Bet.findOne({ contractId: parseInt(req.params.id) });
    } else {
      // MongoDB ObjectId - search by _id
      bet = await Bet.findById(req.params.id);
    }

    if (!bet) {
      console.log('❌ Bet not found for ID:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'Bet not found',
      });
    }

    console.log('✅ Bet found:', bet.title, 'CategoryId:', bet.categoryId);

    // Get category separately to avoid populate issues
    let category = null;
    if (bet.categoryId) {
      try {
        const Category = require('../models/Category');
        category = await Category.findById(bet.categoryId).select('name imageUrl level parentId');
        console.log('📁 Category found:', category?.name || 'No category found');
      } catch (categoryError) {
        console.log('⚠️ Category lookup failed:', categoryError.message);
      }
    }

    // Get related bets from same category
    const relatedBets = await Bet.find({
      categoryId: bet.categoryId,
      _id: { $ne: bet._id },
      isActive: true,
      isResolved: false,
    }).limit(3);

    console.log('🔗 Related bets found:', relatedBets.length);

    // Transform bet data (same as getBets)
    const betObj = bet.toObject();

    // Calculate dynamic prices using market maker algorithm
    const currentPrices = BettingPoolService.calculateOptionPrices(betObj);

    // Fix broken options format and add pricing
    if (betObj.options && Array.isArray(betObj.options)) {
      betObj.options = betObj.options.map((option, index) => {
        let optionText;
        let optionData = {};

        if (typeof option === 'string') {
          optionText = option;
        } else if (option && typeof option === 'object') {
          // Preserve existing option data
          optionData = { ...option };

          // Reconstruct string from character array format
          if (option['0'] && option['1']) {
            // It's in broken format like {0: 'Y', 1: 'e', 2: 's'}
            let reconstructed = '';
            let i = 0;
            while (option[i] !== undefined) {
              reconstructed += option[i];
              i++;
            }
            optionText = reconstructed;
          } else {
            optionText = option.title || option.name || 'Option';
          }
        } else {
          optionText = 'Option';
        }

        // Return option with proper structure and dynamic pricing
        return {
          ...optionData,
          title: optionText,
          currentOdds: currentPrices[index] / 100,
          price: currentPrices[index],
          totalAmount: optionData.totalAmount || 0,
          totalShares: optionData.totalShares || 0,
          publicTotalShares: optionData.publicTotalShares || 0,
          encryptedTotalShares: optionData.encryptedTotalShares || null
        };
      });
    }

    // Add category to bet response
    const betWithCategory = betObj;
    if (category) {
      betWithCategory.category = category;
    }

    res.status(200).json({
      success: true,
      data: {
        bet: betWithCategory,
        relatedBets,
      },
    });
  } catch (error) {
    console.error('❌ Error in getBet:', error);
    next(error);
  }
};

// Search bets
exports.searchBets = async (req, res, next) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters',
      });
    }

    const bets = await Bet.find({
      $and: [
        { isActive: true },
        {
          $or: [
            { title: { $regex: q, $options: 'i' } },
            { description: { $regex: q, $options: 'i' } },
          ],
        },
      ],
    })
      .populate('category', 'name')
      .sort({ volume: -1, createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: bets.length,
      data: { bets },
    });
  } catch (error) {
    next(error);
  }
};

// Get bets by category
exports.getBetsByCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Check if category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bets = await Bet.find({
      categoryId: categoryId, // FHEVM categories use string IDs
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Bet.countDocuments({
      categoryId: categoryId, // FHEVM categories use string IDs
      isActive: true,
    });

    res.status(200).json({
      success: true,
      count: bets.length,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: {
        bets,
        category,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Place a bet
exports.placeBet = async (req, res, next) => {
  try {
    console.log('🎯 PlaceBet called with:');
    console.log('   Bet ID:', req.params.id);
    console.log('   Request Body:', JSON.stringify(req.body, null, 2));
    console.log('   Headers:', req.headers);

    const { id } = req.params;
    const {
      optionIndex,
      amount,
      txHash,
      userAddress,
      // FHEVM encrypted data
      encryptedAmount,
      encryptedProof,
      fhevmHandles,
      fhevmInputProof,
      isFHEVMEncrypted,
      contractAddress
    } = req.body;

    // Get the bet with proper validation (same logic as getBet)
    let bet;

    // Check if ID is numeric (contract ID) or MongoDB ObjectId
    if (/^\d+$/.test(id)) {
      // Numeric ID - search by contractId
      bet = await Bet.findOne({ contractId: parseInt(id) });
    } else {
      // MongoDB ObjectId - search by _id
      bet = await Bet.findById(id);
    }

    if (!bet) {
      throw new AppError('Bet not found', 404);
    }

    // Get wallet address from request body (frontend sends this)
    const resolvedUserAddress = userAddress ? userAddress.toLowerCase() : req.user?.address?.toLowerCase();

    // Validate Ethereum address is provided
    if (!resolvedUserAddress) {
      throw new AppError('Wallet address is required for betting', 400);
    }

    // Validate Ethereum address format
    if (!ethers.isAddress(resolvedUserAddress)) {
      throw new AppError('Invalid Ethereum address format', 400);
    }

    // Find or create user by wallet address (production-ready authentication)
    console.log(`🔐 Authenticating user with wallet: ${resolvedUserAddress}`);
    console.log(`   UserAddress type: ${typeof resolvedUserAddress}`);
    console.log(`   UserAddress value: "${resolvedUserAddress}"`);

    const user = await findOrCreateUserByWallet(resolvedUserAddress);
    console.log(`✅ User found/created:`, {
      id: user.id,
      walletAddress: user.walletAddress,
      displayName: user.displayName
    });
    const userId = user.id;

    // Validate betting constraints using the service
    const validationErrors = BettingPoolService.validateBettingConstraints(bet, amount, resolvedUserAddress);
    if (validationErrors.length > 0) {
      throw new AppError(validationErrors.join(', '), 400);
    }

    // Calculate current price and shares using the service
    const currentPrices = BettingPoolService.calculateOptionPrices(bet);
    const currentPrice = currentPrices[optionIndex];
    const shares = BettingPoolService.calculateShares(amount, currentPrice, bet.totalVolume);

    // Simulate the betting outcome
    const simulation = BettingPoolService.simulateBetting(bet, optionIndex, amount);

    // Log FHEVM encryption details
    if (isFHEVMEncrypted) {
      logger.info(`FHEVM encrypted bet received:`, {
        encryptedAmount: encryptedAmount ? 'present' : 'missing',
        fhevmHandles: fhevmHandles ? fhevmHandles.length : 0,
        contractAddress
      });
    }

    // Create user bet with all required fields including FHEVM data
    const userBet = {
      userId,
      userAddress: resolvedUserAddress,
      optionIndex: parseInt(optionIndex),
      amount: parseFloat(amount),
      shares: parseFloat(shares),
      price: currentPrice,
      txHash,
      timestamp: new Date(),
      claimed: false,
      winnings: 0,
      // FHEVM encrypted data
      isFHEVMEncrypted: !!isFHEVMEncrypted,
      encryptedAmount: encryptedAmount || null,
      encryptedProof: encryptedProof || null,
      fhevmHandles: fhevmHandles || null,
      fhevmInputProof: fhevmInputProof || null,
      contractAddress: contractAddress || null
    };

    // Use the bet model's placeBet method for consistency
    await bet.placeBet(
      userBet.userAddress,
      userBet.optionIndex,
      userBet.amount,
      userBet.shares,
      userBet.txHash,
      userId
    );

    // Update market prices after the bet
    const newPrices = await BettingPoolService.updateBetPrices(id, optionIndex, amount);

    // Get updated market depth
    const marketDepth = BettingPoolService.getMarketDepth(bet);

    // Update user statistics for this bet
    try {
      await updateUserStats(resolvedUserAddress, amount, false); // false = not won yet
      console.log(`📊 Updated user stats for ${resolvedUserAddress}: +${amount} volume`);
    } catch (statsError) {
      console.error('❌ Error updating user stats:', statsError);
      // Don't fail the bet placement if stats update fails
    }

    const logMessage = isFHEVMEncrypted
      ? `FHEVM encrypted bet placed: User ${userId}, Address ${resolvedUserAddress}, Bet ${id}, Option ${optionIndex}, Amount ${amount}, Shares ${shares}`
      : `Bet placed: User ${userId}, Address ${resolvedUserAddress}, Bet ${id}, Option ${optionIndex}, Amount ${amount}, Shares ${shares}`;

    logger.info(logMessage);

    const responseMessage = isFHEVMEncrypted
      ? 'FHEVM encrypted bet placed successfully'
      : 'Bet placed successfully';

    res.status(200).json({
      success: true,
      message: responseMessage,
      data: {
        userBet,
        simulation,
        marketUpdate: {
          newPrices,
          marketDepth
        },
        transaction: {
          shares,
          priceAtPurchase: currentPrice,
          expectedValue: simulation.expectedValue
        },
        fhevm: {
          isEncrypted: !!isFHEVMEncrypted,
          contractAddress: contractAddress || null
        }
      },
    });
  } catch (error) {
    logger.error('Error placing bet:', error);
    next(error);
  }
};

// Claim winnings
exports.claimWinnings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { txHash, userAddress } = req.body;

    // Get wallet address
    const resolvedUserAddress = userAddress ? userAddress.toLowerCase() : req.user?.address?.toLowerCase();

    // Validate wallet address
    if (!resolvedUserAddress || !ethers.isAddress(resolvedUserAddress)) {
      throw new AppError('Valid wallet address is required for claiming winnings', 400);
    }

    // Find or create user by wallet address
    console.log(`🔐 Authenticating user for claim: ${resolvedUserAddress}`);
    const user = await findOrCreateUserByWallet(resolvedUserAddress);
    const userId = user.id;

    let bet;

    // Check if ID is numeric (contract ID) or MongoDB ObjectId
    if (/^\d+$/.test(id)) {
      // Numeric ID - search by contractId
      bet = await Bet.findOne({ contractId: parseInt(id) });
    } else {
      // MongoDB ObjectId - search by _id
      bet = await Bet.findById(id);
    }

    if (!bet) {
      throw new AppError('Bet not found', 404);
    }

    if (!bet.isResolved) {
      throw new AppError('Bet is not resolved yet', 400);
    }

    // Calculate winnings using the betting pool service
    const totalWinnings = bet.calculateWinnings(resolvedUserAddress);

    if (totalWinnings <= 0) {
      throw new AppError('No winnings available to claim', 400);
    }

    // Check if already claimed
    const userWinningBets = bet.userBets.filter(ub =>
      (ub.userId?.toString() === userId || ub.userAddress === resolvedUserAddress) &&
      ub.optionIndex === bet.winningOptionIndex
    );

    const alreadyClaimed = userWinningBets.some(ub => ub.claimed);
    if (alreadyClaimed) {
      throw new AppError('Winnings already claimed', 400);
    }

    // Find and update user's winning bets
    let claimedAmount = 0;
    bet.userBets.forEach((ub) => {
      if ((ub.userId?.toString() === userId || ub.userAddress === resolvedUserAddress) &&
          ub.optionIndex === bet.winningOptionIndex &&
          !ub.claimed) {
        ub.claimed = true;
        ub.claimTxHash = txHash;
        ub.winnings = totalWinnings;
        claimedAmount += ub.winnings;
      }
    });

    await bet.save();

    // Update user statistics with winnings
    try {
      await updateUserStats(resolvedUserAddress, claimedAmount, true); // true = won
      console.log(`🎉 Updated winning stats for ${resolvedUserAddress}: +${claimedAmount} winnings`);
    } catch (statsError) {
      console.error('❌ Error updating winning stats:', statsError);
      // Don't fail the claim if stats update fails
    }

    // Get user's betting statistics
    const userStats = await BettingPoolService.getUserBettingStats(resolvedUserAddress);

    logger.info(`Winnings claimed: User ${userId}, Address ${resolvedUserAddress}, Bet ${id}, Amount ${claimedAmount}`);

    res.status(200).json({
      success: true,
      message: 'Winnings claimed successfully',
      data: {
        claimedAmount: totalWinnings,
        txHash,
        userStats,
        betDetails: {
          betTitle: bet.title,
          winningOption: bet.options[bet.winningOptionIndex].title,
          totalPool: bet.totalVolume,
          platformFee: bet.totalVolume * 0.02
        }
      }
    });
  } catch (error) {
    logger.error('Error claiming winnings:', error);
    next(error);
  }
};

// Get user's bets
exports.getUserBets = async (req, res, next) => {
  try {
    const { address } = req.params;
    const { page = 1, limit = 20, status = 'all' } = req.query;

    const matchStage = {
      'userBets.userAddress': address.toLowerCase(),
    };

    if (status === 'active') {
      matchStage.isResolved = false;
      matchStage.endTime = { $gt: new Date() };
    } else if (status === 'resolved') {
      matchStage.isResolved = true;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const userBets = await Bet.aggregate([
      { $match: matchStage },
      { $unwind: '$userBets' },
      { $match: { 'userBets.userAddress': address.toLowerCase() } },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: 'categoryId',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      { $sort: { 'userBets.timestamp': -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },
    ]);

    // Get user betting statistics
    const userStats = await BettingPoolService.getUserBettingStats(address);

    res.status(200).json({
      success: true,
      count: userBets.length,
      data: {
        bets: userBets,
        statistics: userStats
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get market depth and betting statistics for a bet
exports.getBetMarketData = async (req, res, next) => {
  try {
    const { id } = req.params;

    let bet;

    // Check if ID is numeric (contract ID) or MongoDB ObjectId
    if (/^\d+$/.test(id)) {
      // Numeric ID - search by contractId
      bet = await Bet.findOne({ contractId: parseInt(id) });
    } else {
      // MongoDB ObjectId - search by _id
      bet = await Bet.findById(id);
    }

    if (!bet) {
      throw new AppError('Bet not found', 404);
    }

    // Get market depth information
    const marketDepth = BettingPoolService.getMarketDepth(bet);

    // Calculate current prices
    const currentPrices = BettingPoolService.calculateOptionPrices(bet);

    // Get betting history summary
    const recentBets = bet.userBets
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10)
      .map(bet => ({
        amount: bet.amount,
        optionIndex: bet.optionIndex,
        timestamp: bet.timestamp,
        price: bet.price
      }));

    res.status(200).json({
      success: true,
      data: {
        marketDepth,
        currentPrices,
        recentActivity: recentBets,
        summary: {
          totalVolume: bet.totalVolume,
          totalBets: bet.totalBets,
          uniqueBettors: bet.uniqueBettors,
          timeRemaining: bet.endTime.getTime() - Date.now(),
          isActive: bet.isActive && !bet.isResolved && new Date() < bet.endTime
        }
      }
    });
  } catch (error) {
    logger.error('Error getting bet market data:', error);
    next(error);
  }
};

// Simulate betting outcome
exports.simulateBet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { optionIndex, amount } = req.body;

    if (optionIndex === undefined || !amount) {
      throw new AppError('Option index and amount are required', 400);
    }

    let bet;

    // Check if ID is numeric (contract ID) or MongoDB ObjectId
    if (/^\d+$/.test(id)) {
      // Numeric ID - search by contractId
      bet = await Bet.findOne({ contractId: parseInt(id) });
    } else {
      // MongoDB ObjectId - search by _id
      bet = await Bet.findById(id);
    }

    if (!bet) {
      throw new AppError('Bet not found', 404);
    }

    if (optionIndex < 0 || optionIndex >= bet.options.length) {
      throw new AppError('Invalid option index', 400);
    }

    // Simulate the betting outcome
    const simulation = BettingPoolService.simulateBetting(bet, optionIndex, amount);

    res.status(200).json({
      success: true,
      data: simulation
    });
  } catch (error) {
    logger.error('Error simulating bet:', error);
    next(error);
  }
};

// Get user betting statistics
exports.getUserBettingStats = async (req, res, next) => {
  try {
    const { address } = req.params;

    // Get all user bets for statistics
    const userBets = await Bet.aggregate([
      { $match: { 'userBets.userAddress': address.toLowerCase() } },
      { $unwind: '$userBets' },
      { $match: { 'userBets.userAddress': address.toLowerCase() } },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: 'categoryId',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } }
    ]);

    // Calculate statistics
    let totalBets = userBets.length;
    let totalInvested = 0;
    let totalWinnings = 0;
    let wonBets = 0;

    userBets.forEach(bet => {
      const userBet = bet.userBets;
      totalInvested += userBet.amount;

      if (bet.isResolved && bet.winningOptionIndex === userBet.optionIndex) {
        wonBets++;
        totalWinnings += userBet.winnings || 0;
      }
    });

    const winRate = totalBets > 0 ? (wonBets / totalBets) * 100 : 0;
    const profitLoss = totalWinnings - totalInvested;

    const stats = {
      totalBets,
      totalInvested,
      totalWinnings,
      winRate,
      profitLoss,
      wonBets,
      lostBets: totalBets - wonBets
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting user betting stats:', error);
    next(error);
  }
};

// Get bet statistics using BetEvent model (FHEVM-aware)
exports.getBetStatistics = async (req, res, next) => {
  try {
    const { betId } = req.params;

    if (!betId) {
      return res.status(400).json({
        success: false,
        message: 'Bet ID is required'
      });
    }

    // Get statistics from BetEvent model (includes decrypted amounts)
    const stats = await BetEvent.getBetStatistics(betId);

    // Also get option-wise statistics from UserPosition
    const optionStats = await UserPosition.aggregate([
      {
        $match: {
          betId: require('mongoose').Types.ObjectId(betId),
          amount: { $ne: null } // Only include decrypted positions
        }
      },
      {
        $group: {
          _id: '$optionIndex',
          totalAmount: { $sum: '$amount' },
          totalPositions: { $sum: 1 },
          uniqueTraders: { $addToSet: '$userAddress' }
        }
      },
      {
        $project: {
          optionIndex: '$_id',
          totalAmount: 1,
          totalPositions: 1,
          uniqueTraders: { $size: '$uniqueTraders' }
        }
      },
      {
        $sort: { optionIndex: 1 }
      }
    ]);

    // Get recent activity (last 10 positions)
    const recentActivity = await UserPosition.find({
      betId: require('mongoose').Types.ObjectId(betId)
    })
    .populate('userId', 'username')
    .select('optionIndex amount entryPrice createdAt userAddress')
    .sort({ createdAt: -1 })
    .limit(10);

    // Calculate time remaining
    const bet = await Bet.findById(betId).select('endTime');
    const now = new Date();
    const timeRemaining = bet?.endTime ? Math.max(0, bet.endTime.getTime() - now.getTime()) : 0;
    const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));

    logger.info(`📊 Bet statistics retrieved for bet ${betId}:`, {
      totalVolume: stats.totalVolume,
      totalBets: stats.totalBets,
      uniqueTraders: stats.uniqueTraders,
      optionCount: optionStats.length,
      hoursRemaining
    });

    res.status(200).json({
      success: true,
      data: {
        // Overall stats
        totalVolume: stats.totalVolume || 0,
        totalBets: stats.totalBets || 0,
        uniqueTraders: stats.uniqueTraders || 0,
        hoursRemaining,

        // Option-wise breakdown
        optionStats: optionStats.map(opt => ({
          optionIndex: opt.optionIndex,
          totalAmount: opt.totalAmount,
          totalPositions: opt.totalPositions,
          uniqueTraders: opt.uniqueTraders,
          percentage: stats.totalVolume > 0 ? (opt.totalAmount / stats.totalVolume * 100).toFixed(1) : 0
        })),

        // Recent activity (privacy-aware)
        recentActivity: recentActivity.map(position => ({
          userAddress: position.userAddress.substring(0, 6) + '...' + position.userAddress.substring(38), // Anonymize
          optionIndex: position.optionIndex,
          amount: position.amount, // Only visible if decrypted
          entryPrice: position.entryPrice,
          timestamp: position.createdAt
        }))
      }
    });

  } catch (error) {
    logger.error('Error getting bet statistics:', error);
    next(error);
  }
};
