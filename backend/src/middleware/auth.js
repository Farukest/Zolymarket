const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
const { logger } = require('../utils/logger');

// Protect routes - require authentication
const protect = async (req, res, next) => {
  try {
    // Development mode bypass
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Auth bypass: Development mode detected for protect middleware');
      // Create mock user for development
      req.user = {
        _id: '60a7b8e9f4b7c8e9f4b7c8e9',
        walletAddress: req.body.userAddress || '0x1234567890123456789012345678901234567890',
        isActive: true,
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      return next();
    }

    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Make sure token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await User.findById(decoded.userId).select('-__v');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. User not found.',
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account has been deactivated.',
        });
      }

      // Add user to request object
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
      });
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication.',
    });
  }
};

// Optional authentication - don't require but add user if token exists
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-__v');

        if (user && user.isActive) {
          req.user = user;
        }
      } catch (error) {
        // Token invalid, but continue without user
        logger.warn('Invalid token in optional auth:', error.message);
      }
    }

    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next();
  }
};

// Check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    // Check if user is admin in User model
    if (req.user.isAdmin) {
      return next();
    }

    // Check if user has admin record
    const admin = await Admin.findOne({
      userId: req.user._id,
      isActive: true,
    });

    if (!admin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required.',
      });
    }

    // Add admin info to request
    req.admin = admin;
    next();
  } catch (error) {
    logger.error('Admin middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in admin authentication.',
    });
  }
};

// Check specific admin permission
const requirePermission = (permission) => async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    // Super admin or user admin flag always passes
    if (req.user.isAdmin) {
      return next();
    }

    // Check admin record
    const admin = await Admin.findOne({
      userId: req.user._id,
      isActive: true,
    });

    if (!admin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required.',
      });
    }

    // Check permission
    if (!admin.hasPermission(permission)) {
      return res.status(403).json({
        success: false,
        message: `Permission required: ${permission}`,
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    logger.error('Permission middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in permission check.',
    });
  }
};

// Check specific admin role
const requireRole = (roles) => {
  const roleArray = Array.isArray(roles) ? roles : [roles];

  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.',
        });
      }

      const admin = await Admin.findOne({
        userId: req.user._id,
        isActive: true,
      });

      if (!admin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required.',
        });
      }

      if (!roleArray.includes(admin.role)) {
        return res.status(403).json({
          success: false,
          message: `Role required: ${roleArray.join(' or ')}`,
        });
      }

      req.admin = admin;
      next();
    } catch (error) {
      logger.error('Role middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error in role check.',
      });
    }
  };
};

// Rate limiting per user
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();

  return (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    for (const [key, requests] of userRequests.entries()) {
      userRequests.set(key, requests.filter((time) => time > windowStart));
      if (userRequests.get(key).length === 0) {
        userRequests.delete(key);
      }
    }

    // Check current user requests
    const userRequestTimes = userRequests.get(userId) || [];
    const recentRequests = userRequestTimes.filter((time) => time > windowStart);

    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
      });
    }

    // Add current request
    recentRequests.push(now);
    userRequests.set(userId, recentRequests);

    next();
  };
};

// Log admin actions
const logAdminAction = (action) => async (req, res, next) => {
  try {
    if (req.admin) {
      await req.admin.logAction(
        action,
        {
          method: req.method,
          url: req.originalUrl,
          body: req.body,
          params: req.params,
          query: req.query,
        },
        req.ip,
        req.get('User-Agent'),
      );
    }
    next();
  } catch (error) {
    logger.error('Admin action logging error:', error);
    next(); // Continue even if logging fails
  }
};

module.exports = {
  protect,
  optionalAuth,
  requireAdmin,
  requirePermission,
  requireRole,
  userRateLimit,
  logAdminAction,
};
