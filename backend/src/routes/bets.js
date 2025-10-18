const express = require('express');
const {
  getBets,
  getBet,
  searchBets,
  getBetsByCategory,
  placeBet,
  claimWinnings,
  getUserBets,
  getBetMarketData,
  simulateBet,
  getBetStatistics,
} = require('../controllers/betController');
const { protect, optionalAuth } = require('../middleware/auth');
const {
  validateMongoId,
  validateWalletAddress,
  validateSearch,
  validatePagination,
  sanitizeInput,
} = require('../middleware/validation');
const {
  validatePlaceBet,
  validateClaimWinnings,
  validateGetBets,
  validateFHEVMOperation,
} = require('../middleware/betValidation');

const router = express.Router();

// Apply sanitization to all routes
router.use(sanitizeInput);

// Apply optional auth to read routes that might benefit from user context
const readRoutes = express.Router();
readRoutes.use(optionalAuth);

// Debug route
router.get('/debug', (req, res) => {
  console.log('🐛 DEBUG ROUTE HIT');
  res.json({ message: 'Debug route working' });
});

// Public bet routes
router.get('/', getBets);
router.get('/search', validateSearch, searchBets);

// Category-specific bets
router.get('/category/:categoryId', validatePagination, getBetsByCategory);

// User-specific bets
router.get('/user/:address', validateWalletAddress, validatePagination, getUserBets);
router.get('/user/:address/stats', validateWalletAddress, require('../controllers/betController').getUserBettingStats);

// Create bet ID validator that accepts both numeric IDs and MongoDB ObjectIds
const { param, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const validateBetId = [
  param('id')
    .custom((value) => {
      // Allow numeric IDs (contract IDs like 1, 2, 3)
      if (/^\d+$/.test(value)) {
        return true;
      }
      // Allow MongoDB ObjectIds (24 character hex strings)
      if (mongoose.Types.ObjectId.isValid(value)) {
        return true;
      }
      throw new Error('Valid bet ID is required');
    })
    .withMessage('Valid bet ID is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  }
];

// Debug route must come before /:id route
// Single bet routes
router.get('/:id', validateBetId, getBet);

// Public market data routes (no auth required)
router.get('/:id/market', validateBetId, getBetMarketData);
router.get('/:id/statistics', validateBetId, getBetStatistics);
router.post('/:id/simulate', validateBetId, simulateBet);

// Protected routes (require authentication)
// Development mode: Skip auth for betting actions
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 Development mode: Skipping auth for betting actions');
  // Betting actions without auth in development
  router.post('/:id/place', validatePlaceBet, validateFHEVMOperation, placeBet);
  router.post('/:id/claim', validateClaimWinnings, claimWinnings);
} else {
  router.use(protect); // All routes below require authentication in production
  // Betting actions
  router.post('/:id/place', validatePlaceBet, validateFHEVMOperation, placeBet);
  router.post('/:id/claim', validateClaimWinnings, claimWinnings);
}

module.exports = router;
