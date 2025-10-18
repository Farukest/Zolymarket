const express = require('express');
const {
  getCategories,
  getCategory,
  getTopLevelCategories,
  getSubCategories,
  getCategoryTree,
  getCategoryPath,
  searchCategories,
} = require('../controllers/categoryController');
const { optionalAuth } = require('../middleware/auth');
const {
  validateMongoId,
  validateSearch,
  validatePagination,
  sanitizeInput,
} = require('../middleware/validation');

const router = express.Router();

// Apply optional auth to all routes
router.use(optionalAuth);
router.use(sanitizeInput);

// Public category routes
router.get('/', validatePagination, getCategories);
router.get('/top-level', getTopLevelCategories);
router.get('/tree', getCategoryTree);
router.get('/search', validateSearch, searchCategories);

// Category by ID routes
router.get('/:id', validateMongoId, getCategory);
router.get('/:id/path', validateMongoId, getCategoryPath);

// Parent-child relationship routes
router.get('/:parentId/children', validateMongoId, getSubCategories);

module.exports = router;
