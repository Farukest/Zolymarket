const mongoose = require('mongoose');

// FHEVM Hybrid Bet Option Schema
const betOptionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    description: 'Option title - editable by admin'
  },
  description: {
    type: String,
    default: '',
    maxlength: 500,
    description: 'Option description - editable by admin'
  },
  currentPrice: {
    type: Number,
    default: 50,
    min: 0,
    max: 100,
    description: 'Current market price for display'
  },
  isWinner: {
    type: Boolean,
    default: false,
    description: 'Winner status - synced from contract'
  },
  // FHEVM aggregated data
  encryptedTotalAmount: {
    type: String,
    default: null,
    description: 'FHEVM encrypted total betting amount for this option'
  },
  publicTotalShares: {
    type: Number,
    default: 0,
    description: 'Public total shares for this option'
  }
});

// FHEVM Hybrid Bet Model - Contract state + Presentation data
const betSchema = new mongoose.Schema({
  // ===== CONTRACT REFERENCE (IMMUTABLE) =====
  contractId: {
    type: Number,
    required: true,
    unique: true,
    index: true,
    description: 'Contract bet ID - immutable identifier'
  },
  contractAddress: {
    type: String,
    required: true,
    lowercase: true,
    match: [/^0x[a-f0-9]{40}$/i, 'Invalid contract address']
  },

  // ===== PRESENTATION DATA (MUTABLE - DATABASE ONLY) =====
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    index: 'text',
    description: 'Bet title - editable by admin'
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
    index: 'text',
    description: 'Bet description - editable by admin'
  },
  imageUrl: {
    type: String,
    default: '',
    description: 'Image URL - editable by admin'
  },
  categoryId: {
    type: String,
    ref: 'Category',
    required: true,
    index: true,
    description: 'Category - editable by admin'
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  featured: {
    type: Boolean,
    default: false,
    index: true,
    description: 'Featured flag - editable by admin'
  },
  priority: {
    type: Number,
    default: 0,
    description: 'Display priority - editable by admin'
  },
  visibility: {
    type: String,
    enum: ['public', 'hidden', 'featured'],
    default: 'public',
    index: true,
    description: 'Visibility setting - editable by admin'
  },

  // ===== GROUPING SYSTEM FOR NESTED MARKETS =====
  marketGroup: {
    groupId: {
      type: String,
      default: null,
      index: true,
      description: 'Group ID for related bets (e.g., "fed_oct_2024")'
    },
    groupTitle: {
      type: String,
      default: null,
      description: 'Group display title (e.g., "Fed Decision October")'
    },
    groupType: {
      type: String,
      enum: ['nested', 'series', 'tournament', 'standalone'],
      default: 'standalone',
      description: 'Type of grouping: nested (Fed Decision), series (Weekly matches), tournament, standalone'
    },
    groupOrder: {
      type: Number,
      default: 0,
      description: 'Display order within the group'
    },
    isGroupHeader: {
      type: Boolean,
      default: false,
      description: 'Whether this bet is the main/header bet of the group'
    }
  },

  // ===== CONTRACT STATE MIRROR (SYNCED FROM BLOCKCHAIN) =====
  endTime: {
    type: Date,
    required: true,
    index: true,
    description: 'End time - synced from contract (immutable)'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
    description: 'Active status - synced from contract'
  },
  isResolved: {
    type: Boolean,
    default: false,
    index: true,
    description: 'Resolved status - synced from contract'
  },
  betType: {
    type: Number,
    required: true,
    enum: [0, 1, 2], // BINARY, MULTIPLE_CHOICE, NUMERIC_RANGE
    description: 'Bet type - synced from contract (immutable)'
  },
  createdBy: {
    type: String,
    required: true,
    lowercase: true,
    match: [/^0x[a-f0-9]{40}$/i, 'Invalid address'],
    description: 'Creator address - synced from contract (immutable)'
  },
  totalParticipants: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Total participants - synced from contract'
  },
  minBetAmount: {
    type: Number,
    required: true,
    min: 0,
    description: 'Min bet amount - synced from contract (immutable)'
  },
  maxBetAmount: {
    type: Number,
    required: true,
    min: 0,
    description: 'Max bet amount - synced from contract (immutable)'
  },


  // Bet options
  options: [betOptionSchema],

  // ===== FHEVM HYBRID STATISTICS =====
  // Encrypted aggregated data (FHEVM)
  encryptedTotalVolume: {
    type: String,
    default: null,
    description: 'FHEVM encrypted total betting volume across all options'
  },

  // Public statistics (performance + non-sensitive data)
  totalParticipants: {
    type: Number,
    default: 0,
    description: 'Total number of unique participants'
  },
  totalBets: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Total number of bets placed'
  },
  totalShares: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Total shares issued across all options'
  },

  // Public volume (only after resolution for transparency)
  publicTotalVolume: {
    type: Number,
    default: 0,
    description: 'Public total volume (visible only after resolution)'
  },

  // Resolution data
  winningOptionIndex: {
    type: Number,
    default: null,
    description: 'Index of winning option after resolution'
  },
  winnerIndex: {
    type: Number,
    min: 0,
  },
  resolvedBy: {
    type: String,
    default: null,
    description: 'Wallet address of resolver'
  },
  resolutionSource: {
    type: String,
    default: null,
    description: 'Source used for bet resolution'
  },

  // Live betting features
  mustShowLive: {
    type: Boolean,
    default: false
  },
  liveStartTime: {
    type: Date,
    default: null
  },
  liveEndTime: {
    type: Date,
    default: null
  },

  // ===== FHEVM CONFIGURATION =====
  useFHEVM: {
    type: Boolean,
    default: true,
    index: true,
    description: 'Whether this bet uses FHEVM encryption'
  },
  encryptionMetadata: {
    aclAddress: {
      type: String,
      default: '0x2Fb4341027eb1d2aD8B5D9708187df8633cAFA92',
      description: 'FHEVM ACL contract address'
    },
    kmsAddress: {
      type: String,
      default: '0x596E6682c72946AF006B27C131793F2B62527A4B',
      description: 'FHEVM KMS contract address'
    },
    chainId: {
      type: Number,
      default: 8009,
      description: 'Zama devnet chain ID'
    },
    encryptionVersion: {
      type: String,
      default: '0.5.0',
      description: 'FHEVM encryption version'
    }
  },

  // Contract sync tracking (Professional optimization)
  lastSyncBlock: {
    type: Number,
    default: 0,
    description: 'Last block number where this bet was synced from contract'
  },
  syncStatus: {
    type: String,
    enum: ['synced', 'pending', 'failed', 'stale'],
    default: 'pending',
    description: 'Current sync status with contract'
  },
  contractStateHash: {
    type: String,
    default: null,
    description: 'Hash of contract state for validation'
  },
  lastSyncAt: {
    type: Date,
    default: Date.now,
    description: 'Last time this bet was synced from contract'
  },

  // User bets moved to separate UserPosition collection for better performance

  // Contract interaction
  contractTxHash: {
    type: String,
    match: [/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'],
  },

  resolveTxHash: {
    type: String,
    match: [/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'],
  },

  // Admin info (ObjectId references)
  createdByUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },

  resolvedByUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

  // SEO
  slug: {
    type: String,
    trim: true,
    lowercase: true,
  },

  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],

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
  collection: 'bets'
});

// Optimized indexes for FHEVM hybrid architecture
betSchema.index({ contractId: 1 }, { unique: true });
betSchema.index({ categoryId: 1, isActive: 1 });
betSchema.index({ endTime: 1, isActive: 1 });
betSchema.index({ isResolved: 1, useFHEVM: 1 });
betSchema.index({ useFHEVM: 1, isActive: 1 });
betSchema.index({ createdBy: 1 });
betSchema.index({ syncStatus: 1, lastSyncAt: 1 });
betSchema.index({ totalParticipants: -1 });
betSchema.index({ createdAt: -1 });
betSchema.index({ 'encryptionMetadata.chainId': 1 });

// Grouping indexes for nested markets
betSchema.index({ 'marketGroup.groupId': 1, 'marketGroup.groupOrder': 1 });
betSchema.index({ 'marketGroup.groupType': 1, isActive: 1 });
betSchema.index({ 'marketGroup.isGroupHeader': 1 });

// Virtual for category
betSchema.virtual('category', {
  ref: 'Category',
  localField: 'categoryId',
  foreignField: 'categoryId',
  justOne: true,
});

// Virtual fields
betSchema.virtual('isEnded').get(function() {
  return new Date() > this.endTime;
});

betSchema.virtual('isLive').get(function() {
  if (!this.mustShowLive) return false;
  const now = new Date();
  return now >= this.liveStartTime && now <= this.liveEndTime;
});

// Virtual for time until end
betSchema.virtual('timeUntilEnd').get(function () {
  return this.endTime.getTime() - Date.now();
});

// Virtual for checking if bet has ended
betSchema.virtual('hasEnded').get(function () {
  return new Date() > this.endTime;
});

// Pre-save middleware
betSchema.pre('save', function (next) {
  this.updatedAt = new Date();

  // Generate slug from title if not provided
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Statistics will be updated via contract sync, not pre-save hook
  // This prevents inconsistencies with FHEVM encrypted data

  next();
});

// Methods
betSchema.methods.toJSON = function() {
  const bet = this.toObject();

  // Add virtual fields
  bet.isEnded = this.isEnded;
  bet.isLive = this.isLive;

  // For FHEVM bets, hide encrypted data unless user has permission
  if (this.useFHEVM && !this.isResolved) {
    delete bet.encryptedTotalVolume;
    bet.options.forEach(option => {
      delete option.encryptedTotalAmount;
    });
  }

  return bet;
};

betSchema.methods.canUserViewEncryptedData = function(userAddress) {
  // Define who can view encrypted data:
  // 1. Bet creator
  // 2. Platform admins
  // 3. Users who have placed bets (their own data)
  return this.createdBy === userAddress;
};

// Instance methods
betSchema.methods.validateContractState = function(contractData) {
  // Professional contract state validation
  const validations = {
    title: this.title === contractData.title,
    endTime: Math.abs(this.endTime.getTime() - (contractData.endTime * 1000)) < 1000,
    isActive: this.isActive === contractData.isActive,
    isResolved: this.isResolved === contractData.isResolved,
    optionCount: this.options.length === Number(contractData.optionCount)
  };

  const isValid = Object.values(validations).every(v => v);

  if (!isValid) {
    console.warn('Contract state mismatch:', validations);
    this.syncStatus = 'stale';
  } else {
    this.syncStatus = 'synced';
    this.lastSyncAt = new Date();
  }

  return { isValid, validations };
};

betSchema.methods.generateStateHash = function() {
  // Generate hash for contract state validation
  const crypto = require('crypto');
  const stateString = JSON.stringify({
    title: this.title,
    endTime: this.endTime.getTime(),
    isActive: this.isActive,
    isResolved: this.isResolved,
    options: this.options.map(o => ({ title: o.title, isWinner: o.isWinner }))
  });

  return crypto.createHash('sha256').update(stateString).digest('hex');
};

betSchema.methods.resolveBet = function(winningOptionIndex, resolvedBy) {
  this.isResolved = true;
  this.resolvedAt = new Date();
  this.winningOptionIndex = winningOptionIndex;
  this.resolvedBy = resolvedBy;

  // Mark winning option
  if (this.options[winningOptionIndex]) {
    this.options[winningOptionIndex].isWinner = true;
  }

  return this.save();
};

// Legacy resolve method for backward compatibility
betSchema.methods.resolve = function (winnerIndex, resolvedBy) {
  if (this.isResolved) {
    throw new Error('Bet is already resolved');
  }

  if (winnerIndex < 0 || winnerIndex >= this.options.length) {
    throw new Error('Invalid winner index');
  }

  this.isResolved = true;
  this.winnerIndex = winnerIndex;
  this.winningOptionIndex = winnerIndex; // Keep both for compatibility
  this.resolvedAt = new Date();
  this.resolvedBy = resolvedBy;

  // Mark winning option
  this.options.forEach((option, index) => {
    option.isWinner = index === winnerIndex;
  });

  return this.save();
};

betSchema.methods.getUserBets = function (userAddress) {
  return this.userBets.filter((bet) => bet.userAddress.toLowerCase() === userAddress.toLowerCase());
};

betSchema.methods.calculateWinnings = function (userAddress) {
  if (!this.isResolved) return 0;

  const userBets = this.getUserBets(userAddress);
  const winningBets = userBets.filter((bet) => this.options[bet.optionIndex].isWinner);

  if (winningBets.length === 0) return 0;

  const totalWinningShares = this.options[this.winnerIndex].totalShares;
  let totalWinnings = 0;

  for (const bet of winningBets) {
    if (totalWinningShares > 0) {
      const shareRatio = bet.shares / totalWinningShares;
      const winnings = shareRatio * this.totalVolume;
      totalWinnings += winnings;
    }
  }

  return totalWinnings;
};

// FHEVM-specific static methods
betSchema.statics.getFHEVMBets = function() {
  return this.find({ useFHEVM: true, isActive: true });
};

betSchema.statics.getPublicBets = function() {
  return this.find({ useFHEVM: false, isActive: true });
};

betSchema.statics.getBetsRequiringSync = function() {
  return this.find({
    syncStatus: { $in: ['pending', 'failed'] },
    isActive: true
  });
};

betSchema.statics.getActiveBets = function() {
  return this.find({
    isActive: true,
    endTime: { $gt: new Date() }
  });
};

betSchema.statics.getBetsByCategory = function(categoryId) {
  return this.find({ categoryId, isActive: true });
};

// ===== GROUPING STATIC METHODS =====
betSchema.statics.getBetsByGroup = function(groupId) {
  return this.find({
    'marketGroup.groupId': groupId,
    isActive: true
  }).sort({ 'marketGroup.groupOrder': 1, createdAt: 1 });
};

betSchema.statics.getGroupedMarkets = function() {
  return this.aggregate([
    {
      $match: {
        'marketGroup.groupId': { $ne: null },
        isActive: true
      }
    },
    {
      $group: {
        _id: '$marketGroup.groupId',
        groupTitle: { $first: '$marketGroup.groupTitle' },
        groupType: { $first: '$marketGroup.groupType' },
        bets: { $push: '$$ROOT' },
        betCount: { $sum: 1 },
        totalVolume: { $sum: '$publicTotalVolume' }
      }
    },
    {
      $sort: { totalVolume: -1, betCount: -1 }
    }
  ]);
};

betSchema.statics.getNestedMarkets = function() {
  return this.find({
    'marketGroup.groupType': 'nested',
    isActive: true
  }).sort({ 'marketGroup.groupOrder': 1 });
};

betSchema.statics.getStandaloneMarkets = function() {
  return this.find({
    $or: [
      { 'marketGroup.groupType': 'standalone' },
      { 'marketGroup.groupId': null }
    ],
    isActive: true
  }).sort({ createdAt: -1 });
};

// Legacy methods for backward compatibility
betSchema.statics.getActive = function (limit = 20) {
  return this.find({
    isActive: true,
    isResolved: false,
    endTime: { $gt: new Date() },
  })
    .populate('category', 'name imageUrl')
    .sort({ createdAt: -1 })
    .limit(limit);
};

betSchema.statics.getTrending = function (limit = 20) {
  return this.find({
    isActive: true,
    isResolved: false,
    endTime: { $gt: new Date() },
  })
    .populate('category', 'name imageUrl')
    .sort({ totalVolume: -1, totalBets: -1 })
    .limit(limit);
};

betSchema.statics.getEndingSoon = function (hours = 24, limit = 20) {
  const now = new Date();
  const endTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

  return this.find({
    isActive: true,
    isResolved: false,
    endTime: { $gt: now, $lt: endTime },
  })
    .populate('category', 'name imageUrl')
    .sort({ endTime: 1 })
    .limit(limit);
};

betSchema.statics.getByCategory = function (categoryId, limit = 20) {
  return this.find({
    categoryId,
    isActive: true,
  })
    .populate('category', 'name imageUrl')
    .sort({ createdAt: -1 })
    .limit(limit);
};

betSchema.statics.search = function (query, limit = 20) {
  return this.find({
    $and: [
      { isActive: true },
      {
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } },
        ],
      },
    ],
  })
    .populate('category', 'name imageUrl')
    .sort({ totalVolume: -1, createdAt: -1 })
    .limit(limit);
};

betSchema.statics.findBySlug = function (slug) {
  return this.findOne({ slug, isActive: true })
    .populate('category', 'name imageUrl level parentId');
};

betSchema.statics.getUserBetsHistory = function (userAddress, limit = 50) {
  return this.find({
    'userBets.userAddress': userAddress.toLowerCase(),
  })
    .populate('category', 'name imageUrl')
    .sort({ 'userBets.timestamp': -1 })
    .limit(limit);
};

module.exports = mongoose.model('Bet', betSchema);
