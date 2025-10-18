const mongoose = require('mongoose');

// Professional UserPosition model - separated from Bet for better performance
const userPositionSchema = new mongoose.Schema({
  // References
  betId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bet',
    required: true,
    index: true
  },
  contractBetId: {
    type: Number,
    required: true,
    index: true,
    description: 'Contract bet ID for validation'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Optional - we use userAddress for wallet-based authentication
    index: true
  },
  userAddress: {
    type: String,
    required: true,
    lowercase: true,
    match: [/^0x[a-f0-9]{40}$/i, 'Invalid Ethereum address'],
    index: true
  },

  // Position details
  optionIndex: {
    type: Number,
    required: true,
    min: 0,
    description: 'Index of the option user bet on'
  },
  outcome: {
    type: Number,
    default: null,
    enum: [0, 1, null],
    description: 'For nested bets: 0=Yes, 1=No. For binary/multiple: null'
  },

  // ===== FHEVM ENCRYPTED FINANCIAL DATA =====
  // Public metadata (always visible)
  entryPrice: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    description: 'Price when position was opened'
  },

  // FHEVM encrypted private data
  isEncrypted: {
    type: Boolean,
    default: true,
    description: 'Whether this position uses FHEVM encryption'
  },
  encryptedAmount: {
    type: String,
    required: true,
    description: 'FHEVM encrypted bet amount (euint64)'
  },
  encryptedShares: {
    type: String,
    default: null,
    description: 'FHEVM encrypted shares purchased'
  },

  // Public data (only visible after resolution or to position owner)
  amount: {
    type: Number,
    default: null,
    min: 0,
    description: 'Decrypted amount (visible only after resolution or to owner)'
  },
  shares: {
    type: Number,
    default: null,
    min: 0,
    description: 'Decrypted shares (visible only after resolution or to owner)'
  },

  // Transaction tracking
  placeBetTxHash: {
    type: String,
    required: true,
    match: [/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'],
    unique: true,
    description: 'Transaction hash where position was opened'
  },
  blockNumber: {
    type: Number,
    required: false,
    default: 0,
    min: 0,
    description: 'Block number where bet was placed'
  },

  // ===== RESOLUTION & PAYOUT (FHEVM AWARE) =====
  isResolved: {
    type: Boolean,
    default: false,
    index: true
  },
  isWinner: {
    type: Boolean,
    default: false,
    description: 'Whether this position won'
  },

  // Encrypted payout (FHEVM)
  encryptedPayout: {
    type: String,
    default: null,
    description: 'FHEVM encrypted payout amount'
  },

  // Public payout (only after claim)
  payout: {
    type: Number,
    default: null,
    min: 0,
    description: 'Decrypted payout amount (visible only after claim)'
  },

  claimed: {
    type: Boolean,
    default: false,
    index: true
  },
  claimTxHash: {
    type: String,
    match: [/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'],
    description: 'Transaction hash where payout was claimed'
  },

  // Status tracking
  status: {
    type: String,
    enum: ['active', 'resolved', 'claimed', 'expired'],
    default: 'active',
    index: true
  },

  // Sync tracking
  lastSyncBlock: {
    type: Number,
    default: 0
  },
  syncStatus: {
    type: String,
    enum: ['synced', 'pending', 'failed'],
    default: 'pending'
  }
}, {
  timestamps: true,
  collection: 'userpositions'
});

// Compound indexes for performance
userPositionSchema.index({ betId: 1, userAddress: 1 });
userPositionSchema.index({ userAddress: 1, status: 1 });
userPositionSchema.index({ contractBetId: 1, optionIndex: 1 });
userPositionSchema.index({ isResolved: 1, claimed: 1 });

// Virtual for profit/loss calculation
userPositionSchema.virtual('profitLoss').get(function() {
  if (!this.isResolved) return 0;
  return this.isWinner ? (this.payout - this.amount) : -this.amount;
});

// Static methods
userPositionSchema.statics.getUserPositions = function(userAddress, status = null, includeEncrypted = false) {
  const query = { userAddress: userAddress.toLowerCase() };
  if (status) query.status = status;

  let queryBuilder = this.find(query)
    .populate('betId', 'title endTime isResolved useFHEVM')
    .sort({ createdAt: -1 });

  // If not including encrypted data, exclude encrypted fields
  if (!includeEncrypted) {
    queryBuilder = queryBuilder.select('-encryptedAmount -encryptedShares -encryptedPayout');
  }

  return queryBuilder;
};

// Get positions for FHEVM sync
userPositionSchema.statics.getPositionsForSync = function(betId) {
  return this.find({
    contractBetId: betId,
    syncStatus: { $in: ['pending', 'failed'] }
  });
};

userPositionSchema.statics.getBetPositions = function(betId, requestingUserAddress = null) {
  const query = this.find({ betId })
    .populate('userId', 'username')
    .sort({ createdAt: -1 });

  // For privacy, only show encrypted data to position owners
  if (!requestingUserAddress) {
    return query.select('-encryptedAmount -encryptedShares -encryptedPayout');
  }

  return query;
};

// FHEVM-aware instance methods
userPositionSchema.methods.calculatePayout = function(totalPool, winningPool) {
  if (!this.isWinner || winningPool === 0) return 0;

  // For encrypted positions, calculation happens on-chain
  if (this.isEncrypted && !this.shares) {
    throw new Error('Cannot calculate payout for encrypted position without decrypted shares');
  }

  return (this.shares / winningPool) * totalPool;
};

// Check if user can view encrypted data
userPositionSchema.methods.canUserViewEncrypted = function(requestingUserAddress) {
  return this.userAddress.toLowerCase() === requestingUserAddress.toLowerCase();
};

// Get display-safe version for API responses
userPositionSchema.methods.toPublicJSON = function(requestingUserAddress = null) {
  const position = this.toObject();

  // If not the position owner and position is encrypted, hide sensitive data
  if (this.isEncrypted && !this.canUserViewEncrypted(requestingUserAddress)) {
    delete position.encryptedAmount;
    delete position.encryptedShares;
    delete position.encryptedPayout;
    delete position.amount;
    delete position.shares;
    delete position.payout;

    // Mark as private
    position._isPrivate = true;
  }

  return position;
};

module.exports = mongoose.model('UserPosition', userPositionSchema);