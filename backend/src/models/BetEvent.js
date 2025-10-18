const mongoose = require('mongoose');

const betEventSchema = new mongoose.Schema({
  // Event identification
  eventType: {
    type: String,
    required: true,
    enum: ['BetPlaced', 'BetCreated', 'BetResolved', 'WinningsClaimed']
  },

  // Common fields
  betId: {
    type: String,
    required: true,
    index: true
  },

  txHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  blockNumber: {
    type: Number,
    required: true,
    index: true
  },

  logIndex: {
    type: Number,
    required: true
  },

  timestamp: {
    type: Date,
    required: true,
    index: true
  },

  processed: {
    type: Boolean,
    default: false,
    index: true
  },

  // BetPlaced specific fields
  user: {
    type: String,
    index: true
  },

  optionIndex: {
    type: Number
  },

  shares: {
    type: Number
  },

  encryptedAmount: {
    type: String  // Store encrypted euint64 as string
  },

  actualAmount: {
    type: Number,  // Decrypted amount for statistics
    default: 0
  },

  // BetCreated specific fields
  title: {
    type: String
  },

  categoryId: {
    type: Number
  },

  // BetResolved specific fields
  winnerIndex: {
    type: Number
  },

  // WinningsClaimed specific fields (amount is in common fields)
  amount: {
    type: String  // For claimed winnings
  },

  // Metadata
  decryptionAttempted: {
    type: Boolean,
    default: false
  },

  decryptionSuccess: {
    type: Boolean,
    default: false
  },

  decryptionError: {
    type: String
  },

  // For tracking sync status
  syncAttempts: {
    type: Number,
    default: 0
  },

  lastSyncAttempt: {
    type: Date
  }

}, {
  timestamps: true,  // Adds createdAt and updatedAt automatically
  collection: 'bet_events'
});

// Compound indexes for efficient queries
betEventSchema.index({ eventType: 1, betId: 1 });
betEventSchema.index({ eventType: 1, user: 1 });
betEventSchema.index({ betId: 1, timestamp: -1 });
betEventSchema.index({ user: 1, timestamp: -1 });
betEventSchema.index({ blockNumber: 1, logIndex: 1 }, { unique: true });

// Static methods for aggregations
betEventSchema.statics.getBetStatistics = async function(betId) {
  const stats = await this.aggregate([
    {
      $match: {
        eventType: 'BetPlaced',
        betId: betId.toString()
      }
    },
    {
      $group: {
        _id: '$betId',
        totalVolume: { $sum: '$actualAmount' },
        totalBets: { $sum: 1 },
        uniqueTraders: { $addToSet: '$user' }
      }
    },
    {
      $project: {
        betId: '$_id',
        totalVolume: 1,
        totalBets: 1,
        uniqueTraders: { $size: '$uniqueTraders' }
      }
    }
  ]);

  return stats.length > 0 ? stats[0] : {
    betId,
    totalVolume: 0,
    totalBets: 0,
    uniqueTraders: 0
  };
};

betEventSchema.statics.getUserBetHistory = async function(userAddress) {
  return await this.find({
    eventType: 'BetPlaced',
    user: userAddress.toLowerCase()
  })
  .sort({ timestamp: -1 })
  .select('betId optionIndex shares actualAmount timestamp txHash');
};

betEventSchema.statics.getOverallStatistics = async function() {
  const stats = await this.aggregate([
    {
      $match: {
        eventType: 'BetPlaced'
      }
    },
    {
      $group: {
        _id: null,
        totalVolume: { $sum: '$actualAmount' },
        totalBets: { $sum: 1 },
        uniqueTraders: { $addToSet: '$user' },
        uniqueBets: { $addToSet: '$betId' }
      }
    },
    {
      $project: {
        totalVolume: 1,
        totalBets: 1,
        uniqueTraders: { $size: '$uniqueTraders' },
        uniqueBets: { $size: '$uniqueBets' }
      }
    }
  ]);

  return stats.length > 0 ? stats[0] : {
    totalVolume: 0,
    totalBets: 0,
    uniqueTraders: 0,
    uniqueBets: 0
  };
};

// Get pending events for decryption
betEventSchema.statics.getPendingDecryption = async function() {
  return await this.find({
    eventType: 'BetPlaced',
    decryptionAttempted: false,
    encryptedAmount: { $ne: null }
  })
  .sort({ timestamp: 1 })  // Process oldest first
  .limit(50);  // Process in batches
};

// Instance methods
betEventSchema.methods.markDecryptionAttempted = function(success = false, error = null) {
  this.decryptionAttempted = true;
  this.decryptionSuccess = success;
  this.decryptionError = error;
  this.lastSyncAttempt = new Date();
  this.syncAttempts += 1;
  return this.save();
};

module.exports = mongoose.model('BetEvent', betEventSchema);