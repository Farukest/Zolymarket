const {
  validationResult, body, param, query,
} = require('express-validator');
const { ethers } = require('ethers');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  next();
};

// Custom validators
const isValidWalletAddress = (value) => {
  try {
    return ethers.isAddress(value);
  } catch {
    return false;
  }
};

const isValidTxHash = (value) => /^0x[a-fA-F0-9]{64}$/.test(value);

const isValidURL = (value) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const isFutureDate = (value) => new Date(value) > new Date();

const isValidBetType = (value) => [1, 2, 3].includes(parseInt(value));

// Validation rules for different endpoints

// Auth validation
const validateLogin = [
  body('walletAddress')
    .notEmpty()
    .withMessage('Wallet address is required')
    .custom(isValidWalletAddress)
    .withMessage('Invalid wallet address format'),

  body('signature')
    .notEmpty()
    .withMessage('Signature is required')
    .isLength({ min: 130, max: 132 })
    .withMessage('Invalid signature format'),

  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ max: 1000 })
    .withMessage('Message too long'),

  handleValidationErrors,
];

const validateProfile = [
  body('displayName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Display name cannot exceed 50 characters'),

  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),

  body('avatar')
    .optional()
    .custom(isValidURL)
    .withMessage('Invalid avatar URL'),

  handleValidationErrors,
];

// Bet validation
const validateCreateBet = [
  body('title')
    .notEmpty()
    .withMessage('Bet title is required')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),

  body('imageUrl')
    .optional()
    .custom((value) => !value || isValidURL(value))
    .withMessage('Invalid image URL'),

  body('categoryId')
    .isInt({ min: 1 })
    .withMessage('Valid category ID is required'),

  body('options')
    .isArray({ min: 2 })
    .withMessage('At least 2 options are required')
    .custom((options) => options.every((option) => typeof option === 'string'
        || (typeof option === 'object' && option.title)))
    .withMessage('All options must have titles'),

  body('endTime')
    .isISO8601()
    .withMessage('Valid end time is required')
    .custom(isFutureDate)
    .withMessage('End time must be in the future'),

  body('betType')
    .isInt()
    .custom(isValidBetType)
    .withMessage('Valid bet type is required (1, 2, or 3)'),

  body('mustShowLive')
    .optional()
    .isBoolean()
    .withMessage('Must show live must be boolean'),

  body('liveStartTime')
    .optional()
    .isISO8601()
    .withMessage('Valid live start time required'),

  body('liveEndTime')
    .optional()
    .isISO8601()
    .withMessage('Valid live end time required'),

  handleValidationErrors,
];

const validatePlaceBet = [
  param('id')
    .isMongoId()
    .withMessage('Valid bet ID is required'),

  body('optionIndex')
    .isInt({ min: 0 })
    .withMessage('Valid option index is required'),

  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),

  body('txHash')
    .notEmpty()
    .withMessage('Transaction hash is required')
    .custom(isValidTxHash)
    .withMessage('Invalid transaction hash format'),

  handleValidationErrors,
];

const validateResolveBet = [
  param('id')
    .isMongoId()
    .withMessage('Valid bet ID is required'),

  body('winnerIndex')
    .isInt({ min: 0 })
    .withMessage('Valid winner index is required'),

  handleValidationErrors,
];

// Category validation
const validateCreateCategory = [
  body('name')
    .notEmpty()
    .withMessage('Category name is required')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),

  body('imageUrl')
    .optional()
    .custom((value) => !value || isValidURL(value))
    .withMessage('Invalid image URL'),

  body('parentId')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Parent ID must be a positive integer'),

  body('startTime')
    .optional()
    .isISO8601()
    .withMessage('Valid start time required'),

  body('endTime')
    .optional()
    .isISO8601()
    .withMessage('Valid end time required'),

  handleValidationErrors,
];

// Search validation
const validateSearch = [
  query('q')
    .notEmpty()
    .withMessage('Search query is required')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  handleValidationErrors,
];

// Pagination validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  handleValidationErrors,
];

// ID parameter validation
const validateMongoId = [
  param('id')
    .isMongoId()
    .withMessage('Valid ID is required'),

  handleValidationErrors,
];

const validateCategoryId = [
  param('id')
    .notEmpty()
    .withMessage('Category ID is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Category ID must be between 1 and 50 characters'),

  handleValidationErrors,
];

const validateWalletAddress = [
  param('address')
    .custom(isValidWalletAddress)
    .withMessage('Valid wallet address is required'),

  handleValidationErrors,
];

// Admin validation
const validateAdminAction = [
  body('confirmation')
    .optional()
    .equals('CONFIRM')
    .withMessage('Action confirmation required'),

  handleValidationErrors,
];

// File upload validation
const validateImageUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Image file is required',
    });
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.',
    });
  }

  // Check file size (5MB max)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (req.file.size > maxSize) {
    return res.status(400).json({
      success: false,
      message: 'File size too large. Maximum 5MB allowed.',
    });
  }

  next();
};

// Sanitize input
const sanitizeInput = (req, res, next) => {
  // Remove any HTML tags from string inputs
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/<[^>]*>/g, '').trim();
  };

  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;

    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = sanitizeString(obj[key]);
      } else if (typeof obj[key] === 'object') {
        obj[key] = sanitizeObject(obj[key]);
      }
    }

    return obj;
  };

  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);
  req.params = sanitizeObject(req.params);

  next();
};

module.exports = {
  handleValidationErrors,
  validateLogin,
  validateProfile,
  validateCreateBet,
  validatePlaceBet,
  validateResolveBet,
  validateCreateCategory,
  validateSearch,
  validatePagination,
  validateMongoId,
  validateCategoryId,
  validateWalletAddress,
  validateAdminAction,
  validateImageUpload,
  sanitizeInput,
  // Custom validators
  isValidWalletAddress,
  isValidTxHash,
  isValidURL,
  isFutureDate,
  isValidBetType,
};
