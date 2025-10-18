const winston = require('winston');
const path = require('path');

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({
    level, message, timestamp, stack, ...meta
  }) => {
    let msg = `${timestamp} [${level}]: ${message}`;

    // Add stack trace for errors
    if (stack) {
      msg += `\n${stack}`;
    }

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      msg += `\n${JSON.stringify(meta, null, 2)}`;
    }

    return msg;
  }),
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Create logs directory if it doesn't exist
const fs = require('fs');

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: fileFormat,
  defaultMeta: {
    service: 'polymarket-fhevm-backend',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],

  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
    }),
  ],

  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
    }),
  ],
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - start;

    logger.info('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });

    originalEnd.apply(this, args);
  };

  next();
};

// Database operation logger
const dbLogger = {
  query: (operation, collection, query = {}) => {
    logger.debug('Database query', {
      operation,
      collection,
      query: JSON.stringify(query),
    });
  },

  result: (operation, collection, result) => {
    logger.debug('Database result', {
      operation,
      collection,
      resultCount: Array.isArray(result) ? result.length : result ? 1 : 0,
    });
  },

  error: (operation, collection, error) => {
    logger.error('Database error', {
      operation,
      collection,
      error: error.message,
      stack: error.stack,
    });
  },
};

// Contract interaction logger
const contractLogger = {
  call: (contractName, method, params = {}) => {
    logger.info('Contract call', {
      contract: contractName,
      method,
      params: JSON.stringify(params),
    });
  },

  transaction: (contractName, method, txHash, gasUsed) => {
    logger.info('Contract transaction', {
      contract: contractName,
      method,
      txHash,
      gasUsed,
    });
  },

  error: (contractName, method, error) => {
    logger.error('Contract error', {
      contract: contractName,
      method,
      error: error.message,
      code: error.code,
    });
  },
};

// Performance monitoring
const performanceLogger = {
  start: (operation) => ({
    operation,
    startTime: Date.now(),
  }),

  end: (context, metadata = {}) => {
    const duration = Date.now() - context.startTime;

    logger.info('Performance metric', {
      operation: context.operation,
      duration: `${duration}ms`,
      ...metadata,
    });

    // Warn for slow operations
    if (duration > 1000) {
      logger.warn('Slow operation detected', {
        operation: context.operation,
        duration: `${duration}ms`,
        ...metadata,
      });
    }
  },
};

// Security event logger
const securityLogger = {
  authAttempt: (req, success, userId = null) => {
    logger.info('Authentication attempt', {
      success,
      userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  },

  rateLimitHit: (req) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      path: req.path,
    });
  },

  suspiciousActivity: (req, reason, metadata = {}) => {
    logger.error('Suspicious activity detected', {
      reason,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      path: req.path,
      ...metadata,
    });
  },
};

module.exports = {
  logger,
  requestLogger,
  dbLogger,
  contractLogger,
  performanceLogger,
  securityLogger,
};
