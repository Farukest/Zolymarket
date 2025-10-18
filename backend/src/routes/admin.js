const express = require('express');
const {
  // Bet management
  getBets,
  createBet,
  updateBet,
  resolveBet,
  deleteBet,

  // Hybrid bet management
  editBetPresentation,
  getEditableBet,

  // Category management
  createCategory,
  updateCategory,
  deleteCategory,

  // User management
  getUsers,
  updateUser,

  // Analytics
  getAnalytics,
  getStats,
} = require('../controllers/adminController');

const { protect, requireAdmin, requirePermission } = require('../middleware/auth');
const {
  adminSessionManager,
  logCriticalAction,
  highSecurity,
  criticalSecurity,
} = require('../middleware/adminAuth');

const {
  validateCreateCategory,
  validateMongoId,
  validateCategoryId,
  validatePagination,
  sanitizeInput,
} = require('../middleware/validation');
const {
  validateCreateBet,
  validateResolveBet,
  validateUpdateBet,
  validateGetBets,
} = require('../middleware/betValidation');

const router = express.Router();

// Debug environment
console.log('🔧 Admin routes - NODE_ENV:', process.env.NODE_ENV);
console.log('🔧 Admin routes - Environment check:', process.env.NODE_ENV === 'development');

if (process.env.NODE_ENV === 'development') {
  console.log('🔧 Setting up development mode bypasses for admin routes');

  // Add dev middleware for bypassing auth
  const devMiddleware = (req, res, next) => {
    console.log('🔓 Development mode: Setting mock user for admin routes');

    // Create mock user object
    const mockUser = {
      id: '60a7b8e9f4b7c8e9f4b7c8e9',
      isAdmin: true,
      permissions: ['VIEW_BETS', 'CREATE_BETS', 'UPDATE_BETS', 'RESOLVE_BETS', 'DELETE_BETS', 'CREATE_CATEGORIES', 'UPDATE_CATEGORIES', 'DELETE_CATEGORIES', 'MANAGE_USERS', 'VIEW_ANALYTICS']
    };

    // Safely set user object
    try {
      req.user = mockUser;
    } catch (error) {
      console.log('🔧 Using fallback method for setting user');
      Object.defineProperty(req, 'user', {
        value: mockUser,
        writable: true,
        configurable: true
      });
    }

    console.log('🔓 Mock user set:', req.user);
    next();
  };

  router.use(devMiddleware);
} else {
  console.log('🔒 Production mode: Applying full authentication middleware');
  // Apply authentication and admin checks to all routes in production
  router.use(protect);
  router.use(requireAdmin);
  router.use(adminSessionManager);
}
router.use(sanitizeInput);

// ================ BET MANAGEMENT ================

// Get all bets
router.get(
  '/bets',
  process.env.NODE_ENV === 'development' ? (req, res, next) => next() : requirePermission('VIEW_BETS'),
  validateGetBets,
  getBets,
);

// Create bet - requires BET_MANAGER permission
router.post(
  '/bets',
  process.env.NODE_ENV === 'development' ? (req, res, next) => next() : requirePermission('CREATE_BETS'),
  validateCreateBet,
  process.env.NODE_ENV === 'development' ? (req, res, next) => next() : logCriticalAction('CREATE_BET'),
  createBet,
);

// Update bet - requires BET_MANAGER permission
router.put(
  '/bets/:id',
  process.env.NODE_ENV === 'development' ? (req, res, next) => next() : requirePermission('UPDATE_BETS'),
  validateUpdateBet,
  process.env.NODE_ENV === 'development' ? (req, res, next) => next() : logCriticalAction('UPDATE_BET'),
  updateBet,
);

// Resolve bet - high security action
router.post(
  '/bets/:id/resolve',
  process.env.NODE_ENV === 'development' ? (req, res, next) => next() : requirePermission('RESOLVE_BETS'),
  validateResolveBet,
  ...(process.env.NODE_ENV === 'development' ? [] : criticalSecurity),
  resolveBet,
);

// Delete bet - critical security action
router.delete(
  '/bets/:id',
  process.env.NODE_ENV === 'development' ? (req, res, next) => next() : requirePermission('DELETE_BETS'),
  validateMongoId,
  ...(process.env.NODE_ENV === 'development' ? [] : criticalSecurity),
  deleteBet,
);

// ================ HYBRID BET MANAGEMENT ================

// Edit bet presentation data (no blockchain transaction needed)
router.put(
  '/bets/:contractId/presentation',
  editBetPresentation,
);

// Get editable bet data
router.get(
  '/bets/:contractId/editable',
  getEditableBet,
);

// ================ CATEGORY MANAGEMENT ================

// Create category
router.post(
  '/categories',
  process.env.NODE_ENV === 'development' ? (req, res, next) => next() : requirePermission('CREATE_CATEGORIES'),
  validateCreateCategory,
  process.env.NODE_ENV === 'development' ? (req, res, next) => next() : logCriticalAction('CREATE_CATEGORY'),
  createCategory,
);

// Update category
router.put(
  '/categories/:id',
  process.env.NODE_ENV === 'development' ? (req, res, next) => next() : requirePermission('UPDATE_CATEGORIES'),
  validateCategoryId,
  process.env.NODE_ENV === 'development' ? (req, res, next) => next() : logCriticalAction('UPDATE_CATEGORY'),
  updateCategory,
);

// Delete category - critical action
router.delete(
  '/categories/:id',
  process.env.NODE_ENV === 'development' ? (req, res, next) => next() : requirePermission('DELETE_CATEGORIES'),
  validateCategoryId,
  ...(process.env.NODE_ENV === 'development' ? [] : criticalSecurity),
  deleteCategory,
);

// ================ USER MANAGEMENT ================

// Get all users
router.get(
  '/users',
  process.env.NODE_ENV === 'development' ? (req, res, next) => next() : requirePermission('MANAGE_USERS'),
  validatePagination,
  getUsers,
);

// Update user
router.put(
  '/users/:id',
  process.env.NODE_ENV === 'development' ? (req, res, next) => next() : requirePermission('MANAGE_USERS'),
  validateMongoId,
  process.env.NODE_ENV === 'development' ? (req, res, next) => next() : logCriticalAction('UPDATE_USER'),
  updateUser,
);

// ================ ANALYTICS & STATS ================

// Get analytics data
router.get(
  '/analytics',
  process.env.NODE_ENV === 'development' ? (req, res, next) => next() : requirePermission('VIEW_ANALYTICS'),
  getAnalytics,
);

// Get dashboard stats
router.get(
  '/stats',
  process.env.NODE_ENV === 'development' ? (req, res, next) => next() : requirePermission('VIEW_ANALYTICS'),
  getStats,
);

module.exports = router;
