const Admin = require('../models/Admin');
const { logger } = require('../utils/logger');

// Admin session management
const adminSessionManager = async (req, res, next) => {
  try {
    if (!req.admin) {
      return next();
    }

    const sessionId = req.headers['x-session-id'];
    const ipAddress = req.ip;

    if (sessionId) {
      // Update existing session
      const updated = await req.admin.updateSession(sessionId, ipAddress);
      if (!updated) {
        return res.status(401).json({
          success: false,
          message: 'Invalid session. Please login again.',
        });
      }
    } else {
      // No session ID provided
      return res.status(401).json({
        success: false,
        message: 'Session ID required for admin actions.',
      });
    }

    next();
  } catch (error) {
    logger.error('Admin session manager error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in session management.',
    });
  }
};

// Check IP whitelist
const checkIPWhitelist = async (req, res, next) => {
  try {
    if (!req.admin) {
      return next();
    }

    const clientIP = req.ip;
    const { admin } = req;

    // Skip if no IP whitelist configured
    if (!admin.ipWhitelist || admin.ipWhitelist.length === 0) {
      return next();
    }

    // Check if client IP is in whitelist
    const isWhitelisted = admin.ipWhitelist.some((whitelistedIP) =>
      // Support CIDR notation in the future
      clientIP === whitelistedIP);

    if (!isWhitelisted) {
      logger.warn(`Blocked admin access from non-whitelisted IP: ${clientIP} for admin: ${admin.walletAddress}`);

      return res.status(403).json({
        success: false,
        message: 'Access denied. Your IP address is not authorized.',
      });
    }

    next();
  } catch (error) {
    logger.error('IP whitelist check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in IP verification.',
    });
  }
};

// Two-factor authentication check
const require2FA = async (req, res, next) => {
  try {
    if (!req.admin) {
      return next();
    }

    const { admin } = req;

    // Skip if 2FA not enabled
    if (!admin.twoFactorEnabled) {
      return next();
    }

    const totpToken = req.headers['x-totp-token'];

    if (!totpToken) {
      return res.status(401).json({
        success: false,
        message: '2FA token required.',
        requiresTwoFactor: true,
      });
    }

    // Verify TOTP token (implement with speakeasy or similar)
    // For now, just check if token exists
    if (!totpToken || totpToken.length !== 6) {
      return res.status(401).json({
        success: false,
        message: 'Invalid 2FA token.',
        requiresTwoFactor: true,
      });
    }

    // TODO: Implement actual TOTP verification
    // const verified = speakeasy.totp.verify({
    //   secret: admin.twoFactorSecret,
    //   encoding: 'base32',
    //   token: totpToken,
    //   window: 1
    // });

    // if (!verified) {
    //   return res.status(401).json({
    //     success: false,
    //     message: 'Invalid 2FA token.'
    //   });
    // }

    next();
  } catch (error) {
    logger.error('2FA check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in 2FA verification.',
    });
  }
};

// Check if admin action is within allowed time window
const checkTimeRestriction = (allowedHours = []) => (req, res, next) => {
  try {
    if (allowedHours.length === 0) {
      return next();
    }

    const currentHour = new Date().getHours();

    if (!allowedHours.includes(currentHour)) {
      return res.status(403).json({
        success: false,
        message: `Admin actions are only allowed during hours: ${allowedHours.join(', ')}`,
      });
    }

    next();
  } catch (error) {
    logger.error('Time restriction check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in time restriction check.',
    });
  }
};

// Require admin confirmation for critical actions
const requireConfirmation = (req, res, next) => {
  try {
    const confirmation = req.headers['x-admin-confirmation'];
    const expectedValue = 'CONFIRM_ADMIN_ACTION';

    if (confirmation !== expectedValue) {
      return res.status(400).json({
        success: false,
        message: 'Admin confirmation required for this action.',
        requiresConfirmation: true,
      });
    }

    next();
  } catch (error) {
    logger.error('Admin confirmation check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in confirmation check.',
    });
  }
};

// Log critical admin actions with enhanced details
const logCriticalAction = (actionType) => async (req, res, next) => {
  try {
    if (req.admin) {
      const actionDetails = {
        type: actionType,
        method: req.method,
        url: req.originalUrl,
        params: req.params,
        query: req.query,
        body: req.body,
        userAgent: req.get('User-Agent'),
        sessionId: req.headers['x-session-id'],
        timestamp: new Date(),
        severity: 'CRITICAL',
      };

      // Log to admin audit trail
      await req.admin.logAction(
        `CRITICAL_${actionType}`,
        actionDetails,
        req.ip,
        req.get('User-Agent'),
      );

      // Also log to system logger
      logger.warn(`Critical admin action: ${actionType}`, {
        adminId: req.admin._id,
        walletAddress: req.admin.walletAddress,
        role: req.admin.role,
        ipAddress: req.ip,
        details: actionDetails,
      });
    }

    next();
  } catch (error) {
    logger.error('Critical action logging error:', error);
    next(); // Continue even if logging fails
  }
};

// Check for suspicious admin activity
const detectSuspiciousActivity = async (req, res, next) => {
  try {
    if (!req.admin) {
      return next();
    }

    const { admin } = req;
    const now = new Date();
    const oneHour = 60 * 60 * 1000;
    const recentActions = admin.auditLog.filter(
      (log) => (now - log.timestamp) < oneHour,
    );

    // Check for too many actions in short time
    if (recentActions.length > 50) {
      logger.warn(`Suspicious admin activity detected: ${admin.walletAddress} - ${recentActions.length} actions in last hour`);

      return res.status(429).json({
        success: false,
        message: 'Suspicious activity detected. Please contact system administrator.',
      });
    }

    // Check for actions from multiple IPs
    const uniqueIPs = new Set(recentActions.map((log) => log.ipAddress));
    if (uniqueIPs.size > 3) {
      logger.warn(`Multiple IP access detected for admin: ${admin.walletAddress} - IPs: ${Array.from(uniqueIPs).join(', ')}`);
    }

    next();
  } catch (error) {
    logger.error('Suspicious activity detection error:', error);
    next(); // Continue on error
  }
};

// Middleware combination for high-security actions
const highSecurity = [
  adminSessionManager,
  checkIPWhitelist,
  require2FA,
  detectSuspiciousActivity,
  requireConfirmation,
];

// Middleware combination for critical actions
const criticalSecurity = [
  adminSessionManager,
  checkIPWhitelist,
  require2FA,
  detectSuspiciousActivity,
  requireConfirmation,
  logCriticalAction('CRITICAL_ACTION'),
];

module.exports = {
  adminSessionManager,
  checkIPWhitelist,
  require2FA,
  checkTimeRestriction,
  requireConfirmation,
  logCriticalAction,
  detectSuspiciousActivity,
  highSecurity,
  criticalSecurity,
};
