const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: [true, 'Wallet address is required'],
    unique: true,
    lowercase: true,
    validate: {
      validator: function (v) {
        return /^0x[a-fA-F0-9]{40}$/.test(v);
      },
      message: 'Invalid wallet address format',
    },
  },

  displayName: {
    type: String,
    trim: true,
    maxlength: [50, 'Display name cannot exceed 50 characters'],
  },

  bio: {
    type: String,
    trim: true,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
  },

  avatar: {
    type: String,
    trim: true,
  },

  isAdmin: {
    type: Boolean,
    default: false,
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  // Statistics
  totalBets: {
    type: Number,
    default: 0,
  },

  totalVolume: {
    type: Number,
    default: 0,
  },

  winnings: {
    type: Number,
    default: 0,
  },

  winRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },

  // Social features
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  // Preferences
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      betUpdates: { type: Boolean, default: true },
      winnings: { type: Boolean, default: true },
    },
    privacy: {
      showProfile: { type: Boolean, default: true },
      showStats: { type: Boolean, default: true },
      showActivity: { type: Boolean, default: false },
    },
  },

  // Timestamps
  lastLogin: {
    type: Date,
    default: Date.now,
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes
userSchema.index({ walletAddress: 1 });
userSchema.index({ displayName: 'text' });
userSchema.index({ createdAt: -1 });
userSchema.index({ totalVolume: -1 });
userSchema.index({ winRate: -1 });

// Virtual for follower count
userSchema.virtual('followerCount').get(function () {
  return this.followers ? this.followers.length : 0;
});

// Virtual for following count
userSchema.virtual('followingCount').get(function () {
  return this.following ? this.following.length : 0;
});

// Pre-save middleware
userSchema.pre('save', function (next) {
  this.updatedAt = new Date();

  // Ensure wallet address is lowercase
  if (this.walletAddress) {
    this.walletAddress = this.walletAddress.toLowerCase();
  }

  next();
});

// Instance methods
userSchema.methods.updateStats = function (betAmount, won = false) {
  this.totalBets += 1;
  this.totalVolume += betAmount;

  if (won) {
    this.winnings += betAmount;
  }

  // Calculate win rate
  this.winRate = this.totalBets > 0 ? (this.winnings / this.totalVolume) * 100 : 0;

  return this.save();
};

userSchema.methods.follow = function (userId) {
  if (!this.following.includes(userId)) {
    this.following.push(userId);
  }
  return this.save();
};

userSchema.methods.unfollow = function (userId) {
  this.following = this.following.filter((id) => !id.equals(userId));
  return this.save();
};

// Static methods
userSchema.statics.findByWallet = function (walletAddress) {
  return this.findOne({ walletAddress: walletAddress.toLowerCase() });
};

userSchema.statics.getTopTraders = function (limit = 10) {
  return this.find({ isActive: true })
    .sort({ winRate: -1, totalVolume: -1 })
    .limit(limit)
    .select('walletAddress displayName avatar winRate totalVolume winnings');
};

userSchema.statics.searchUsers = function (query, limit = 20) {
  return this.find({
    $and: [
      { isActive: true },
      {
        $or: [
          { displayName: { $regex: query, $options: 'i' } },
          { walletAddress: { $regex: query, $options: 'i' } },
        ],
      },
    ],
  })
    .limit(limit)
    .select('walletAddress displayName avatar winRate totalVolume');
};

module.exports = mongoose.model('User', userSchema);
