const mongoose = require('mongoose');

/**
 * Hybrid Architecture Bet Model
 * Contract: Immutable core data (ID, endTime, amounts, etc.)
 * Database: Mutable presentation data (title, description, category, etc.)
 */
const betSchema = new mongoose.Schema({
  // ===== CONTRACT REFERENCE (IMMUTABLE) =====
  contractId: {
    type: Number,
    required: true,
    unique: true,
    index: true,
    description: 'Immutable bet ID from blockchain'
  },
  contractAddress: {
    type: String,
    required: true,
    lowercase: true,
    match: [/^0x[a-f0-9]{40}$/i, 'Invalid contract address']
  },

  // ===== PRESENTATION DATA (MUTABLE - ADMIN CAN EDIT) =====
  title: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true,
    index: 'text',
    description: 'Editable bet title'
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000,
    trim: true,
    index: 'text',
    description: 'Editable bet description'
  },
  imageUrl: {
    type: String,
    default: null,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Must be valid HTTP/HTTPS URL'
    },
    description: 'Editable image URL'
  },
  categoryId: {
    type: String,
    required: true,
    index: true,
    description: 'Editable category'
  },
  tags: [String],

  // Options with editable presentation data
  options: [{
    title: {
      type: String,
      required: true,
      maxlength: 100,
      description: 'Editable option title'
    },
    description: {
      type: String,
      default: '',
      maxlength: 500,
      description: 'Editable option description'
    },
    currentPrice: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
      description: 'Calculated market price'
    },
    isWinner: {
      type: Boolean,
      default: false,
      description: 'Synced from contract'
    }
  }],

  // Admin settings (editable)
  featured: {
    type: Boolean,
    default: false,
    index: true
  },
  priority: {
    type: Number,
    default: 0
  },
  visibility: {
    type: String,
    enum: ['public', 'hidden', 'featured'],
    default: 'public',
    index: true
  },

  // ===== CONTRACT STATE MIRROR (SYNCED FROM BLOCKCHAIN) =====
  endTime: {
    type: Date,
    required: true,
    index: true,
    description: 'Synced from contract - immutable'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
    description: 'Synced from contract'
  },
  isResolved: {
    type: Boolean,
    default: false,
    index: true,
    description: 'Synced from contract'
  },
  betType: {
    type: Number,
    required: true,
    enum: [0, 1, 2], // BINARY, MULTIPLE_CHOICE, NUMERIC_RANGE
    description: 'Synced from contract - immutable'
  },
  createdBy: {
    type: String,
    required: true,
    lowercase: true,
    match: [/^0x[a-f0-9]{40}$/i, 'Invalid address'],
    description: 'Synced from contract - immutable'
  },
  totalParticipants: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Synced from contract'
  },
  minBetAmount: {
    type: Number,
    required: true,
    min: 0,
    description: 'Synced from contract - immutable'
  },
  maxBetAmount: {
    type: Number,
    required: true,
    min: 0,
    description: 'Synced from contract - immutable'
  },

  // ===== SYNC TRACKING =====
  lastSyncBlock: {
    type: Number,
    default: 0
  },
  syncStatus: {
    type: String,
    enum: ['synced', 'pending', 'failed'],
    default: 'pending',
    index: true
  },
  lastSyncAt: {
    type: Date,
    default: Date.now
  },
  contractStateHash: String,

  // Legacy fields
  slug: String,
  resolvedAt: Date,
  winningOptionIndex: Number
}, {
  timestamps: true,
  collection: 'bets'
});

// Indexes
betSchema.index({ contractId: 1, contractAddress: 1 });
betSchema.index({ isActive: 1, isResolved: 1, visibility: 1 });
betSchema.index({ categoryId: 1, isActive: 1 });
betSchema.index({ featured: 1, priority: -1 });
betSchema.index({ title: 'text', description: 'text' });

// Virtual fields
betSchema.virtual('status').get(function() {
  if (this.isResolved) return 'resolved';
  if (new Date() > this.endTime) return 'expired';
  if (this.isActive) return 'active';
  return 'inactive';
});

betSchema.virtual('timeRemaining').get(function() {
  if (this.isResolved) return 0;
  return Math.max(0, this.endTime.getTime() - Date.now());
});

// ===== METHODS =====

// Edit presentation data only (no blockchain transaction needed)
betSchema.methods.updatePresentationData = function(updates) {
  const editableFields = [
    'title', 'description', 'imageUrl', 'categoryId', 'tags',
    'featured', 'priority', 'visibility'
  ];

  editableFields.forEach(field => {
    if (updates[field] !== undefined) {
      this[field] = updates[field];
    }
  });

  // Update option titles/descriptions
  if (updates.options) {
    updates.options.forEach((option, index) => {
      if (this.options[index]) {
        if (option.title) this.options[index].title = option.title;
        if (option.description !== undefined) this.options[index].description = option.description;
      }
    });
  }

  return this.save();
};

// Sync contract state to database
betSchema.methods.syncFromContract = function(contractData) {
  this.endTime = new Date(Number(contractData.endTime) * 1000);
  this.isActive = contractData.isActive;
  this.isResolved = contractData.isResolved;
  this.totalParticipants = Number(contractData.totalParticipants);

  // Update winner status from contract
  if (contractData.options) {
    contractData.options.forEach((contractOption, index) => {
      if (this.options[index]) {
        this.options[index].isWinner = contractOption.isWinner;
      }
    });
  }

  if (contractData.isResolved && !this.resolvedAt) {
    this.resolvedAt = new Date();
    // Find winning option
    contractData.options?.forEach((option, index) => {
      if (option.isWinner) {
        this.winningOptionIndex = index;
      }
    });
  }

  this.syncStatus = 'synced';
  this.lastSyncAt = new Date();
  this.contractStateHash = this.generateStateHash();

  return this.save();
};

betSchema.methods.generateStateHash = function() {
  const state = {
    contractId: this.contractId,
    endTime: this.endTime.getTime(),
    isActive: this.isActive,
    isResolved: this.isResolved,
    totalParticipants: this.totalParticipants
  };

  return require('crypto')
    .createHash('sha256')
    .update(JSON.stringify(state))
    .digest('hex');
};

betSchema.methods.validateContractState = function(contractData) {
  const issues = [];

  if (this.contractId !== Number(contractData.id)) {
    issues.push('Contract ID mismatch');
  }

  const contractEndTime = new Date(Number(contractData.endTime) * 1000);
  if (Math.abs(this.endTime.getTime() - contractEndTime.getTime()) > 1000) {
    issues.push('End time mismatch');
  }

  if (this.isActive !== contractData.isActive) {
    issues.push('Active status mismatch');
  }

  if (this.isResolved !== contractData.isResolved) {
    issues.push('Resolved status mismatch');
  }

  return {
    isValid: issues.length === 0,
    issues
  };
};

// ===== STATIC METHODS =====

// Find bets with editable fields only
betSchema.statics.findEditable = function() {
  return this.find({})
    .select('title description imageUrl categoryId tags featured priority visibility options.title options.description');
};

// Find active bets for display
betSchema.statics.findActive = function(limit = 20) {
  return this.find({
    isActive: true,
    isResolved: false,
    visibility: { $ne: 'hidden' },
    endTime: { $gt: new Date() }
  })
  .sort({ featured: -1, priority: -1, createdAt: -1 })
  .limit(limit);
};

// Find by category
betSchema.statics.findByCategory = function(categoryId, limit = 20) {
  return this.find({
    categoryId,
    isActive: true,
    isResolved: false,
    visibility: { $ne: 'hidden' }
  })
  .sort({ priority: -1, createdAt: -1 })
  .limit(limit);
};

// Find bets needing sync
betSchema.statics.findNeedingSync = function(maxAge = 300000) { // 5 min
  const cutoff = new Date(Date.now() - maxAge);
  return this.find({
    $or: [
      { syncStatus: 'failed' },
      { syncStatus: 'pending' },
      { lastSyncAt: { $lt: cutoff } }
    ],
    isActive: true
  }).limit(10);
};

// Search
betSchema.statics.search = function(query, limit = 20) {
  return this.find({
    $text: { $search: query },
    isActive: true,
    visibility: { $ne: 'hidden' }
  })
  .sort({ score: { $meta: 'textScore' }, priority: -1 })
  .limit(limit);
};

// Legacy compatibility methods
betSchema.statics.getActive = betSchema.statics.findActive;
betSchema.statics.getByCategory = betSchema.statics.findByCategory;

// Pre-save middleware
betSchema.pre('save', function(next) {
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

module.exports = mongoose.model('BetHybrid', betSchema);