const Bet = require('../models/Bet');
const BetHybrid = require('../models/BetHybrid');
const Category = require('../models/Category');
const User = require('../models/User');
const { contractService } = require('../services/contractService');
const { logger } = require('../utils/logger');

// ================ BET MANAGEMENT ================

// Get all bets for admin
exports.getBets = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const category = req.query.category;
    const search = req.query.search;

    // Build filter object
    const filter = {};

    if (status && status !== 'all') {
      if (status === 'active') filter.isActive = true;
      if (status === 'resolved') filter.isResolved = true;
      if (status === 'ended') filter.endTime = { $lt: new Date() };
    }

    if (category && category !== 'all') {
      filter.categoryId = category;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const bets = await Bet.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('category', 'name imageUrl')
      .lean();

    const total = await Bet.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: bets.length,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      data: { bets }
    });
  } catch (error) {
    logger.error('Get bets error:', error);
    next(error);
  }
};

// Create new bet
exports.createBet = async (req, res, next) => {
  try {
    const {
      title,
      description,
      imageUrl,
      categoryId,
      options,
      endTime,
      mustShowLive,
      liveStartTime,
      liveEndTime,
      betType,
    } = req.body;

    // Validate required fields
    if (!title || !categoryId || !options || !endTime || !betType) {
      return res.status(400).json({
        success: false,
        message: 'Title, category, options, end time, and bet type are required',
      });
    }

    // Validate category exists
    const category = await Category.findOne({ categoryId: parseInt(categoryId) });
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Create bet in database first
    const bet = await Bet.create({
      title,
      description,
      imageUrl,
      categoryId: parseInt(categoryId),
      options: options.map((opt) => ({
        title: opt.title || opt,
        totalAmount: 0,
        totalShares: 0,
        yesPrice: 50,
        noPrice: 50,
      })),
      endTime: new Date(endTime),
      mustShowLive: mustShowLive || false,
      liveStartTime: liveStartTime ? new Date(liveStartTime) : null,
      liveEndTime: liveEndTime ? new Date(liveEndTime) : null,
      betType: parseInt(betType),
      isActive: true,
      createdBy: req.user.id,
    });

    // Create bet on blockchain
    try {
      const txHash = await contractService.createBet({
        title,
        imageUrl: imageUrl || '',
        categoryId: parseInt(categoryId),
        optionTitles: options.map((opt) => opt.title || opt),
        endTime: Math.floor(new Date(endTime).getTime() / 1000),
        mustShowLive: mustShowLive || false,
        liveStartTime: liveStartTime ? Math.floor(new Date(liveStartTime).getTime() / 1000) : 0,
        liveEndTime: liveEndTime ? Math.floor(new Date(liveEndTime).getTime() / 1000) : 0,
        betType: parseInt(betType),
      });

      bet.contractTxHash = txHash;
      await bet.save();
    } catch (contractError) {
      logger.error('Blockchain bet creation failed:', contractError);
      // Delete the database record if blockchain creation fails
      await Bet.findByIdAndDelete(bet._id);
      return res.status(500).json({
        success: false,
        message: 'Failed to create bet on blockchain',
      });
    }

    await bet.populate('category', 'name imageUrl');

    res.status(201).json({
      success: true,
      message: 'Bet created successfully',
      data: { bet },
    });
  } catch (error) {
    logger.error('Create bet error:', error);
    next(error);
  }
};

// Update bet
exports.updateBet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData.contractId;
    delete updateData.createdBy;
    delete updateData.userBets;

    const bet = await Bet.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true },
    ).populate('category', 'name imageUrl');

    if (!bet) {
      return res.status(404).json({
        success: false,
        message: 'Bet not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Bet updated successfully',
      data: { bet },
    });
  } catch (error) {
    next(error);
  }
};

// Resolve bet
exports.resolveBet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { winnerIndex } = req.body;

    if (winnerIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Winner index is required',
      });
    }

    const bet = await Bet.findById(id);
    if (!bet) {
      return res.status(404).json({
        success: false,
        message: 'Bet not found',
      });
    }

    if (bet.isResolved) {
      return res.status(400).json({
        success: false,
        message: 'Bet is already resolved',
      });
    }

    // Validate winner index
    if (winnerIndex < 0 || winnerIndex >= bet.options.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid winner index',
      });
    }

    // Resolve on blockchain first
    try {
      const txHash = await contractService.resolveBet(bet.contractId, winnerIndex);

      // Update database
      bet.isResolved = true;
      bet.winnerIndex = parseInt(winnerIndex);
      bet.resolvedAt = new Date();
      bet.resolveTxHash = txHash;
      bet.resolvedBy = req.user.id;

      // Mark winning option
      bet.options.forEach((option, index) => {
        option.isWinner = index === parseInt(winnerIndex);
      });

      await bet.save();
    } catch (contractError) {
      logger.error('Blockchain bet resolution failed:', contractError);
      return res.status(500).json({
        success: false,
        message: 'Failed to resolve bet on blockchain',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Bet resolved successfully',
      data: { bet },
    });
  } catch (error) {
    next(error);
  }
};

// Delete bet
exports.deleteBet = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bet = await Bet.findById(id);
    if (!bet) {
      return res.status(404).json({
        success: false,
        message: 'Bet not found',
      });
    }

    // Only allow deletion if no bets have been placed
    if (bet.userBets && bet.userBets.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete bet with existing user bets',
      });
    }

    await Bet.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Bet deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ================ CATEGORY MANAGEMENT ================

// Create category
exports.createCategory = async (req, res, next) => {
  try {
    const {
      name, description, imageUrl, parentId, startTime, endTime,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
    }

    // Calculate level and next category ID
    let level = 0;
    if (parentId && parentId !== 0) {
      const parent = await Category.findOne({ categoryId: parentId });
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: 'Parent category not found',
        });
      }
      level = parent.level + 1;
    }

    // Get next category ID
    const lastCategory = await Category.findOne().sort({ categoryId: -1 });
    const categoryId = lastCategory ? lastCategory.categoryId + 1 : 1;

    const category = await Category.create({
      categoryId,
      name,
      description,
      imageUrl,
      parentId: parentId || 0,
      level,
      startTime: startTime ? new Date(startTime) : new Date(),
      endTime: endTime ? new Date(endTime) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

// Update category
exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    delete updateData.categoryId;
    delete updateData.createdBy;

    const category = await Category.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true },
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

// Delete category
exports.deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Check if category has bets
    const betsCount = await Bet.countDocuments({ categoryId: category.categoryId });
    if (betsCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with existing bets',
      });
    }

    // Check if category has subcategories
    const subcategoriesCount = await Category.countDocuments({ parentId: category.categoryId });
    if (subcategoriesCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with subcategories',
      });
    }

    await Category.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ================ USER MANAGEMENT ================

// Get all users
exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { walletAddress: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select('-__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: { users },
    });
  } catch (error) {
    next(error);
  }
};

// Update user
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isAdmin, isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { isAdmin, isActive, updatedAt: new Date() },
      { new: true, runValidators: true },
    ).select('-__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// ================ HYBRID BET MANAGEMENT ================

// Edit bet presentation data (title, description, etc.) without blockchain transaction
exports.editBetPresentation = async (req, res, next) => {
  try {
    const { contractId } = req.params;
    const updates = req.body;

    console.log(`📝 Admin editing bet ${contractId}:`, updates);

    const bet = await BetHybrid.findOne({ contractId: Number(contractId) });
    if (!bet) {
      return res.status(404).json({ success: false, message: 'Bet not found' });
    }

    await bet.updatePresentationData(updates);

    res.json({
      success: true,
      message: 'Bet presentation data updated successfully',
      data: {
        contractId: bet.contractId,
        title: bet.title,
        description: bet.description,
        categoryId: bet.categoryId,
        featured: bet.featured,
        visibility: bet.visibility
      }
    });

  } catch (error) {
    console.error('❌ Admin edit error:', error);
    res.status(500).json({ success: false, message: 'Failed to update bet' });
  }
};

// Get editable bet data
exports.getEditableBet = async (req, res, next) => {
  try {
    const { contractId } = req.params;

    const bet = await BetHybrid.findOne({ contractId: Number(contractId) })
      .select('title description imageUrl categoryId tags featured priority visibility options.title options.description contractId');

    if (!bet) {
      return res.status(404).json({ success: false, message: 'Bet not found' });
    }

    res.json({ success: true, data: bet });

  } catch (error) {
    console.error('❌ Get editable bet error:', error);
    res.status(500).json({ success: false, message: 'Failed to get bet' });
  }
};

// ================ ANALYTICS ================

// Get analytics data
exports.getAnalytics = async (req, res, next) => {
  try {
    const { period = '7d' } = req.query;

    // Calculate date range
    let startDate;
    switch (period) {
      case '24h':
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get analytics data
    const [
      totalBets,
      activeBets,
      totalUsers,
      newUsers,
      totalVolume,
      periodVolume,
    ] = await Promise.all([
      Bet.countDocuments(),
      Bet.countDocuments({ isActive: true, isResolved: false }),
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startDate } }),
      Bet.aggregate([{ $group: { _id: null, total: { $sum: '$totalVolume' } } }]),
      Bet.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: null, total: { $sum: '$totalVolume' } } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalBets,
        activeBets,
        totalUsers,
        newUsers,
        totalVolume: totalVolume[0]?.total || 0,
        periodVolume: periodVolume[0]?.total || 0,
        period,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get dashboard stats
exports.getStats = async (req, res, next) => {
  try {
    const stats = await Promise.all([
      Bet.countDocuments({ isActive: true }),
      Bet.countDocuments({ isResolved: true }),
      User.countDocuments(),
      Category.countDocuments({ isActive: true }),
      Bet.aggregate([{ $group: { _id: null, volume: { $sum: '$totalVolume' } } }]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        activeBets: stats[0],
        resolvedBets: stats[1],
        totalUsers: stats[2],
        activeCategories: stats[3],
        totalVolume: stats[4][0]?.volume || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};
