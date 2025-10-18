const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },

  walletAddress: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: {
      validator: function (v) {
        return /^0x[a-fA-F0-9]{40}$/.test(v);
      },
      message: 'Invalid wallet address format',
    },
  },

  role: {
    type: String,
    required: true,
    enum: ['SUPER_ADMIN', 'ADMIN', 'CATEGORY_MANAGER', 'BET_MANAGER', 'MODERATOR'],
    default: 'ADMIN',
  },

  permissions: [{
    type: String,
    enum: [
      'CREATE_BETS',
      'UPDATE_BETS',
      'RESOLVE_BETS',
      'DELETE_BETS',
      'CREATE_CATEGORIES',
      'UPDATE_CATEGORIES',
      'DELETE_CATEGORIES',
      'MANAGE_USERS',
      'VIEW_ANALYTICS',
      'MANAGE_ADMINS',
      'SYSTEM_SETTINGS',
    ],
  }],

  isActive: {
    type: Boolean,
    default: true,
  },

  // Access restrictions
  ipWhitelist: [{
    type: String,
    validate: {
      validator: function (v) {
        return /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(v);
      },
      message: 'Invalid IP address format',
    },
  }],

  maxSessions: {
    type: Number,
    default: 3,
    min: 1,
    max: 10,
  },

  // Activity tracking
  lastLogin: {
    type: Date,
  },

  lastActivity: {
    type: Date,
  },

  loginCount: {
    type: Number,
    default: 0,
  },

  // Statistics
  betsCreated: {
    type: Number,
    default: 0,
  },

  betsResolved: {
    type: Number,
    default: 0,
  },

  categoriesCreated: {
    type: Number,
    default: 0,
  },

  // Two-factor authentication
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },

  twoFactorSecret: {
    type: String,
    select: false,
  },

  // Session management
  activeSessions: [{
    sessionId: String,
    createdAt: { type: Date, default: Date.now },
    lastAccess: { type: Date, default: Date.now },
    ipAddress: String,
    userAgent: String,
  }],

  // Audit trail
  auditLog: [{
    action: {
      type: String,
      required: true,
    },
    details: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }],

  // Profile information
  displayName: {
    type: String,
    trim: true,
    maxlength: [50, 'Display name cannot exceed 50 characters'],
  },

  email: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function (v) {
        return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Invalid email format',
    },
  },

  avatar: {
    type: String,
    trim: true,
  },

  // Admin notes
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
  },

  // Creation info
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      delete ret.twoFactorSecret;
      delete ret.activeSessions;
      return ret;
    },
  },
  toObject: { virtuals: true },
});

// Indexes
adminSchema.index({ userId: 1 });
adminSchema.index({ walletAddress: 1 });
adminSchema.index({ role: 1 });
adminSchema.index({ isActive: 1 });
adminSchema.index({ lastActivity: -1 });
adminSchema.index({ 'activeSessions.sessionId': 1 });

// Pre-save middleware
adminSchema.pre('save', function (next) {
  this.updatedAt = new Date();

  // Set default permissions based on role
  if (this.isModified('role')) {
    this.permissions = this.getDefaultPermissions(this.role);
  }

  // Clean up old sessions (keep only last 10)
  if (this.activeSessions && this.activeSessions.length > 10) {
    this.activeSessions = this.activeSessions
      .sort((a, b) => b.lastAccess - a.lastAccess)
      .slice(0, 10);
  }

  // Clean up old audit logs (keep only last 1000)
  if (this.auditLog && this.auditLog.length > 1000) {
    this.auditLog = this.auditLog
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 1000);
  }

  next();
});

// Instance methods
adminSchema.methods.getDefaultPermissions = function (role) {
  const permissions = {
    SUPER_ADMIN: [
      'CREATE_BETS', 'UPDATE_BETS', 'RESOLVE_BETS', 'DELETE_BETS',
      'CREATE_CATEGORIES', 'UPDATE_CATEGORIES', 'DELETE_CATEGORIES',
      'MANAGE_USERS', 'VIEW_ANALYTICS', 'MANAGE_ADMINS', 'SYSTEM_SETTINGS',
    ],
    ADMIN: [
      'CREATE_BETS', 'UPDATE_BETS', 'RESOLVE_BETS',
      'CREATE_CATEGORIES', 'UPDATE_CATEGORIES',
      'VIEW_ANALYTICS',
    ],
    CATEGORY_MANAGER: [
      'CREATE_CATEGORIES', 'UPDATE_CATEGORIES', 'VIEW_ANALYTICS',
    ],
    BET_MANAGER: [
      'CREATE_BETS', 'UPDATE_BETS', 'RESOLVE_BETS', 'VIEW_ANALYTICS',
    ],
    MODERATOR: [
      'VIEW_ANALYTICS',
    ],
  };

  return permissions[role] || [];
};

adminSchema.methods.hasPermission = function (permission) {
  if (this.role === 'SUPER_ADMIN') return true;
  return this.permissions.includes(permission);
};

adminSchema.methods.addSession = function (sessionId, ipAddress, userAgent) {
  // Remove existing session if exists
  this.activeSessions = this.activeSessions.filter((s) => s.sessionId !== sessionId);

  // Add new session
  this.activeSessions.push({
    sessionId,
    ipAddress,
    userAgent,
    createdAt: new Date(),
    lastAccess: new Date(),
  });

  // Keep only maxSessions
  if (this.activeSessions.length > this.maxSessions) {
    this.activeSessions = this.activeSessions
      .sort((a, b) => b.lastAccess - a.lastAccess)
      .slice(0, this.maxSessions);
  }

  this.lastLogin = new Date();
  this.loginCount += 1;

  return this.save();
};

adminSchema.methods.updateSession = function (sessionId, ipAddress) {
  const session = this.activeSessions.find((s) => s.sessionId === sessionId);
  if (session) {
    session.lastAccess = new Date();
    session.ipAddress = ipAddress;
    this.lastActivity = new Date();
    return this.save();
  }
  return false;
};

adminSchema.methods.removeSession = function (sessionId) {
  this.activeSessions = this.activeSessions.filter((s) => s.sessionId !== sessionId);
  return this.save();
};

adminSchema.methods.logAction = function (action, details, ipAddress, userAgent) {
  this.auditLog.push({
    action,
    details,
    ipAddress,
    userAgent,
    timestamp: new Date(),
  });

  return this.save();
};

adminSchema.methods.incrementBetsCreated = function () {
  this.betsCreated += 1;
  return this.save();
};

adminSchema.methods.incrementBetsResolved = function () {
  this.betsResolved += 1;
  return this.save();
};

adminSchema.methods.incrementCategoriesCreated = function () {
  this.categoriesCreated += 1;
  return this.save();
};

// Static methods
adminSchema.statics.findByWallet = function (walletAddress) {
  return this.findOne({
    walletAddress: walletAddress.toLowerCase(),
    isActive: true,
  }).populate('userId', 'displayName avatar');
};

adminSchema.statics.getActiveAdmins = function () {
  return this.find({ isActive: true })
    .populate('userId', 'displayName avatar walletAddress')
    .sort({ role: 1, createdAt: 1 });
};

adminSchema.statics.getAdminStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } },
      },
    },
  ]);
};

adminSchema.statics.findBySession = function (sessionId) {
  return this.findOne({
    'activeSessions.sessionId': sessionId,
    isActive: true,
  });
};

module.exports = mongoose.model('Admin', adminSchema);
