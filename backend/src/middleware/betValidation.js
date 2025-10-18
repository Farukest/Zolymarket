const { body, param, query, validationResult } = require('express-validator');
const Bet = require('../models/Bet');
const Category = require('../models/Category');
const { ethers } = require('ethers');

// Helper function to check validation results
const checkValidationResult = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ Validation failed:', errors.array());
    console.log('📝 Request body:', req.body);
    console.log('📝 Request params:', req.params);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Validation for placing a bet
const validatePlaceBet = [
  param('id')
    .isMongoId()
    .withMessage('Invalid bet ID format'),

  body('optionIndex')
    .isInt({ min: 0 })
    .withMessage('Option index must be a non-negative integer'),

  body('amount')
    .isFloat({ min: 0.01, max: 100000 })
    .withMessage('Amount must be between 0.01 and 100,000'),

  body('txHash')
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('Invalid transaction hash format'),

  body('userAddress')
    .custom(value => {
      if (!value || !ethers.isAddress(value)) {
        throw new Error('Valid user wallet address is required');
      }
      return true;
    }),

  // FHEVM encrypted data validation (optional)
  body('isFHEVMEncrypted')
    .optional()
    .isBoolean()
    .withMessage('isFHEVMEncrypted must be a boolean'),

  body('encryptedAmount')
    .optional()
    .matches(/^0x[a-fA-F0-9]+$/)
    .withMessage('Invalid encrypted amount format'),

  body('encryptedProof')
    .optional()
    .matches(/^0x[a-fA-F0-9]+$/)
    .withMessage('Invalid encrypted proof format'),

  body('fhevmHandles')
    .optional()
    .isArray()
    .withMessage('FHEVM handles must be an array'),

  body('fhevmInputProof')
    .optional()
    .matches(/^0x[a-fA-F0-9]+$/)
    .withMessage('Invalid FHEVM input proof format'),

  body('contractAddress')
    .optional()
    .custom(value => {
      if (value && !ethers.isAddress(value)) {
        throw new Error('Invalid contract address format');
      }
      return true;
    }),

  // Custom validation for bet constraints
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { optionIndex, amount, userAddress } = req.body;

      // Check if bet exists and is valid
      const bet = await Bet.findById(id);
      if (!bet) {
        return res.status(404).json({
          success: false,
          message: 'Bet not found'
        });
      }

      // Check if bet is active
      if (!bet.isActive) {
        return res.status(400).json({
          success: false,
          message: 'This bet is no longer active'
        });
      }

      // Check if bet is resolved
      if (bet.isResolved) {
        return res.status(400).json({
          success: false,
          message: 'This bet has already been resolved'
        });
      }

      // Check if bet has ended
      if (new Date() > bet.endTime) {
        return res.status(400).json({
          success: false,
          message: 'Betting period has ended'
        });
      }

      // Validate option index
      if (optionIndex >= bet.options.length) {
        return res.status(400).json({
          success: false,
          message: 'Invalid option selected'
        });
      }

      // Check betting limits
      if (amount < bet.minBetAmount) {
        return res.status(400).json({
          success: false,
          message: `Minimum bet amount is ${bet.minBetAmount / 1000000} USDC`
        });
      }

      if (amount > bet.maxBetAmount) {
        return res.status(400).json({
          success: false,
          message: `Maximum bet amount is ${bet.maxBetAmount / 1000000} USDC`
        });
      }

      // Check for duplicate transaction hash
      const existingBet = await Bet.findOne({
        'userBets.txHash': req.body.txHash
      });

      if (existingBet) {
        return res.status(400).json({
          success: false,
          message: 'Transaction hash already used'
        });
      }

      // Check user's total bets on this bet (prevent excessive betting)
      // TODO: Implement UserPosition-based user total betting check
      // const userTotalBets = bet.userBets
      //   .filter(ub => ub.userAddress?.toLowerCase() === userAddress.toLowerCase())
      //   .reduce((sum, ub) => sum + ub.amount, 0);

      // const maxUserTotal = bet.maxBetAmount * 10; // User can bet up to 10x max single bet
      // if (userTotalBets + amount > maxUserTotal) {
      //   return res.status(400).json({
      //     success: false,
      //     message: `Total betting limit exceeded. Maximum total: ${maxUserTotal} ETH`
      //   });
      // }

      next();
    } catch (error) {
      next(error);
    }
  },

  checkValidationResult
];

// Validation for creating a bet
const validateCreateBet = [
  body('title')
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('Title must be between 10 and 200 characters'),

  body('description')
    .trim()
    .isLength({ min: 20, max: 1000 })
    .withMessage('Description must be between 20 and 1000 characters'),

  body('categoryId')
    .notEmpty()
    .withMessage('Category is required'),

  body('endTime')
    .isISO8601()
    .withMessage('Invalid end time format')
    .custom((value) => {
      const endTime = new Date(value);
      const now = new Date();
      const minFuture = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      const maxFuture = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now

      if (endTime <= minFuture) {
        throw new Error('End time must be at least 1 hour in the future');
      }

      if (endTime > maxFuture) {
        throw new Error('End time cannot be more than 1 year in the future');
      }

      return true;
    }),

  body('betType')
    .isInt({ min: 1, max: 3 })
    .withMessage('Bet type must be 1 (Multiple Choice), 2 (Binary), or 3 (Sports)'),

  body('options')
    .isArray({ min: 2, max: 10 })
    .withMessage('Must have between 2 and 10 options'),

  body('options.*.title')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Option title must be between 2 and 200 characters'),

  body('minBetAmount')
    .optional()
    .isFloat({ min: 0.01, max: 1000 })
    .withMessage('Minimum bet amount must be between 0.01 and 1000'),

  body('maxBetAmount')
    .optional()
    .isFloat({ min: 1, max: 100000 })
    .withMessage('Maximum bet amount must be between 1 and 100,000'),

  body('imageUrl')
    .optional()
    .isURL()
    .withMessage('Invalid image URL'),

  // Custom validation for bet type specific rules
  body().custom((body) => {
    const { betType, options } = body;

    // Binary bets must have exactly 2 options
    if (betType === 2 && options?.length !== 2) {
      throw new Error('Binary bets must have exactly 2 options');
    }

    // Sports bets must have exactly 3 options
    if (betType === 3 && options?.length !== 3) {
      throw new Error('Sports bets must have exactly 3 options (Home/Draw/Away)');
    }

    // Check for duplicate option titles
    if (options) {
      const titles = options.map(opt => opt.title.toLowerCase());
      const uniqueTitles = new Set(titles);
      if (titles.length !== uniqueTitles.size) {
        throw new Error('Option titles must be unique');
      }
    }

    return true;
  }),

  // Validate category exists
  async (req, res, next) => {
    try {
      const { categoryId } = req.body;
      const category = await Category.findById(categoryId);

      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category selected'
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  },

  checkValidationResult
];

// Validation for resolving a bet
const validateResolveBet = [
  param('id')
    .isMongoId()
    .withMessage('Invalid bet ID format'),

  body('winningOptionIndex')
    .isInt({ min: 0 })
    .withMessage('Winning option index must be a non-negative integer'),

  body('resolutionSource')
    .optional()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Resolution source must be between 5 and 500 characters'),

  body('txHash')
    .optional()
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('Invalid transaction hash format'),

  // Custom validation for resolution constraints
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { winningOptionIndex } = req.body;

      const bet = await Bet.findById(id);
      if (!bet) {
        return res.status(404).json({
          success: false,
          message: 'Bet not found'
        });
      }

      if (bet.isResolved) {
        return res.status(400).json({
          success: false,
          message: 'Bet is already resolved'
        });
      }

      if (winningOptionIndex >= bet.options.length) {
        return res.status(400).json({
          success: false,
          message: 'Invalid winning option index'
        });
      }

      // Check if bet has ended (optional, admin can resolve early)
      if (new Date() < bet.endTime) {
        // Allow early resolution but log it
        console.log(`⚠️  Early resolution for bet ${id} by admin`);
      }

      next();
    } catch (error) {
      next(error);
    }
  },

  checkValidationResult
];

// Validation for claiming winnings
const validateClaimWinnings = [
  param('id')
    .isMongoId()
    .withMessage('Invalid bet ID format'),

  body('txHash')
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('Invalid transaction hash format'),

  body('userAddress')
    .custom(value => {
      if (!value || !ethers.isAddress(value)) {
        throw new Error('Valid user wallet address is required');
      }
      return true;
    }),

  // Custom validation for claim constraints
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { txHash, userAddress } = req.body;

      const bet = await Bet.findById(id);
      if (!bet) {
        return res.status(404).json({
          success: false,
          message: 'Bet not found'
        });
      }

      if (!bet.isResolved) {
        return res.status(400).json({
          success: false,
          message: 'Bet is not resolved yet'
        });
      }

      // Check if user has winning bets
      const userBets = bet.userBets.filter(ub =>
        ub.userAddress?.toLowerCase() === userAddress.toLowerCase() &&
        ub.optionIndex === bet.winningOptionIndex
      );

      if (userBets.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No winning bets found for this user'
        });
      }

      // Check if already claimed
      const alreadyClaimed = userBets.some(ub => ub.claimed);
      if (alreadyClaimed) {
        return res.status(400).json({
          success: false,
          message: 'Winnings already claimed'
        });
      }

      // Check for duplicate claim transaction
      const existingClaim = await Bet.findOne({
        'userBets.claimTxHash': txHash
      });

      if (existingClaim) {
        return res.status(400).json({
          success: false,
          message: 'Claim transaction hash already used'
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  },

  checkValidationResult
];

// Validation for updating a bet
const validateUpdateBet = [
  param('id')
    .isMongoId()
    .withMessage('Invalid bet ID format'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('Title must be between 10 and 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ min: 20, max: 1000 })
    .withMessage('Description must be between 20 and 1000 characters'),

  body('imageUrl')
    .optional()
    .isURL()
    .withMessage('Invalid image URL'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),

  // Custom validation to prevent updating resolved bets
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const bet = await Bet.findById(id);
      if (!bet) {
        return res.status(404).json({
          success: false,
          message: 'Bet not found'
        });
      }

      if (bet.isResolved) {
        return res.status(400).json({
          success: false,
          message: 'Cannot update resolved bet'
        });
      }

      // Prevent updating certain fields if bet has active participants
      if (bet.userBets.length > 0) {
        const restrictedFields = ['options', 'betType', 'endTime', 'minBetAmount', 'maxBetAmount'];
        const hasRestrictedUpdates = restrictedFields.some(field => req.body[field] !== undefined);

        if (hasRestrictedUpdates) {
          return res.status(400).json({
            success: false,
            message: 'Cannot update bet structure after participants have placed bets'
          });
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  },

  checkValidationResult
];

// Query validation for getting bets
const validateGetBets = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be between 1 and 1000'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('filter')
    .optional()
    .isIn(['all', 'trending', 'new', 'ending-soon', 'volume'])
    .withMessage('Invalid filter option'),

  query('status')
    .optional()
    .isIn(['active', 'resolved', 'ended', 'all'])
    .withMessage('Invalid status option'),

  query('search')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters'),

  query('categoryId')
    .optional()
    .notEmpty()
    .withMessage('Category ID cannot be empty'),

  checkValidationResult
];

// Validation for FHEVM specific operations
const validateFHEVMOperation = [
  body('encryptedAmount')
    .optional()
    .isString()
    .withMessage('Encrypted amount must be a string'),

  body('proof')
    .optional()
    .isString()
    .withMessage('Proof must be a string'),

  body('publicKey')
    .optional()
    .isString()
    .withMessage('Public key must be a string'),

  // Custom FHEVM validation
  (req, res, next) => {
    const { encryptedAmount, proof, publicKey } = req.body;

    // If FHEVM fields are provided, validate them
    if (encryptedAmount || proof || publicKey) {
      if (!encryptedAmount || !proof) {
        return res.status(400).json({
          success: false,
          message: 'Both encrypted amount and proof are required for FHEVM operations'
        });
      }
    }

    next();
  },

  checkValidationResult
];

// Wallet address validation
const validateWalletAddress = (field) => [
  body(field)
    .custom((value) => {
      if (!ethers.isAddress(value)) {
        throw new Error('Invalid Ethereum address');
      }
      return true;
    }),
];

module.exports = {
  validatePlaceBet,
  validateCreateBet,
  validateResolveBet,
  validateClaimWinnings,
  validateUpdateBet,
  validateGetBets,
  validateFHEVMOperation,
  validateWalletAddress,
  checkValidationResult
};