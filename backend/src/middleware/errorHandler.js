const { logger } = require('../utils/logger');

// Custom error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Handle different types of errors
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((val) => val.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () => new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = () => new AppError('Your token has expired! Please log in again.', 401);

const handleContractError = (err) => {
  let message = 'Smart contract transaction failed';

  if (err.message.includes('insufficient funds')) {
    message = 'Insufficient funds for transaction';
  } else if (err.message.includes('user rejected')) {
    message = 'Transaction was rejected by user';
  } else if (err.message.includes('execution reverted')) {
    message = 'Smart contract execution failed';
  } else if (err.message.includes('nonce')) {
    message = 'Transaction nonce error. Please try again';
  } else if (err.message.includes('bet is not active')) {
    message = 'This bet is no longer accepting bets';
  } else if (err.message.includes('betting period has ended')) {
    message = 'Betting period for this market has ended';
  } else if (err.message.includes('invalid option')) {
    message = 'Invalid betting option selected';
  } else if (err.message.includes('minimum bet amount')) {
    message = 'Bet amount is below the minimum required';
  } else if (err.message.includes('maximum bet amount')) {
    message = 'Bet amount exceeds the maximum allowed';
  }

  return new AppError(message, 400);
};

const handleFHEVMError = (err) => {
  let message = 'FHEVM encryption operation failed';

  if (err.message.includes('invalid proof')) {
    message = 'Invalid FHEVM proof provided';
  } else if (err.message.includes('encryption failed')) {
    message = 'Failed to encrypt data with FHEVM';
  } else if (err.message.includes('decryption failed')) {
    message = 'Failed to decrypt FHEVM data';
  } else if (err.message.includes('invalid public key')) {
    message = 'Invalid FHEVM public key';
  } else if (err.message.includes('invalid encrypted amount')) {
    message = 'Invalid encrypted amount format';
  }

  return new AppError(message, 400);
};

const handleValidationError = (err) => {
  const errors = [];

  if (err.errors) {
    // Express-validator errors
    if (Array.isArray(err.errors)) {
      err.errors.forEach(error => {
        errors.push(`${error.param}: ${error.msg}`);
      });
    } else {
      // Mongoose validation errors
      Object.values(err.errors).forEach(error => {
        errors.push(`${error.path}: ${error.message}`);
      });
    }
  }

  const message = errors.length > 0
    ? `Validation failed: ${errors.join(', ')}`
    : 'Invalid input data provided';

  return new AppError(message, 400);
};

const handleBettingError = (err) => {
  let message = 'Betting operation failed';

  if (err.message.includes('duplicate transaction')) {
    message = 'This transaction has already been processed';
  } else if (err.message.includes('betting limit exceeded')) {
    message = 'Your total betting limit has been exceeded';
  } else if (err.message.includes('already claimed')) {
    message = 'Winnings have already been claimed';
  } else if (err.message.includes('no winnings')) {
    message = 'No winnings available to claim';
  } else if (err.message.includes('bet not resolved')) {
    message = 'Cannot claim winnings - bet is not yet resolved';
  }

  return new AppError(message, 400);
};

// Send error in development
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

// Send error in production
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });

  // Programming or other unknown error: don't leak error details
  } else {
    // Log error
    logger.error('ERROR:', err);

    // Send generic message
    res.status(500).json({
      success: false,
      message: 'Something went wrong!',
    });
  }
};

// Async error wrapper
const catchAsync = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};

// Global error handling middleware
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log error details
  logger.error({
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    // Handle blockchain/contract errors
    if (error.message && (
      error.message.includes('transaction')
      || error.message.includes('contract')
      || error.message.includes('revert')
      || error.message.includes('gas')
    )) {
      error = handleContractError(error);
    }

    // Handle FHEVM-specific errors
    if (error.message && (
      error.message.includes('FHEVM')
      || error.message.includes('encryption')
      || error.message.includes('proof')
      || error.message.includes('decrypt')
    )) {
      error = handleFHEVMError(error);
    }

    // Handle betting-specific errors
    if (error.message && (
      error.message.includes('bet')
      || error.message.includes('claim')
      || error.message.includes('winn')
      || error.message.includes('duplicate transaction')
    )) {
      error = handleBettingError(error);
    }

    // Handle express-validator errors
    if (error.name === 'ValidationError' || (error.errors && Array.isArray(error.errors))) {
      error = handleValidationError(error);
    }

    sendErrorProd(error, res);
  }
};

// Validation error helper
const validationError = (message, field = null) => {
  const fullMessage = field ? `${field}: ${message}` : message;
  return new AppError(fullMessage, 400);
};

// Authorization error helper
const authError = (message = 'Not authorized') => new AppError(message, 401);

// Forbidden error helper
const forbiddenError = (message = 'Access forbidden') => new AppError(message, 403);

// Not found error helper
const notFoundError = (resource = 'Resource') => new AppError(`${resource} not found`, 404);

module.exports = {
  AppError,
  errorHandler,
  catchAsync,
  validationError,
  authError,
  forbiddenError,
  notFoundError,
};
