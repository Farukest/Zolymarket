const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  imageUrl: {
    type: String,
    default: ''
  },
  parentCategory: {
    type: String,
    ref: 'Category',
    default: null
  },
  // Legacy fields for backward compatibility
  categoryId: {
    type: String,
    unique: true,
    sparse: true,
  },
  parentId: {
    type: Number,
    default: 0,
  },

  level: {
    type: Number,
    default: 0,
    min: 0,
    max: 10,
  },

  startTime: {
    type: Date,
    required: true,
    default: Date.now,
  },

  endTime: {
    type: Date,
    required: true,
    validate: {
      validator: function (v) {
        return v > this.startTime;
      },
      message: 'End time must be after start time',
    },
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  // SEO and metadata
  slug: {
    type: String,
    trim: true,
    lowercase: true,
  },

  metaTitle: {
    type: String,
    trim: true,
    maxlength: [60, 'Meta title cannot exceed 60 characters'],
  },

  metaDescription: {
    type: String,
    trim: true,
    maxlength: [160, 'Meta description cannot exceed 160 characters'],
  },

  // Statistics
  betCount: {
    type: Number,
    default: 0,
  },

  totalVolume: {
    type: Number,
    default: 0,
  },

  // FHEVM encrypted volume (only revealed when appropriate)
  encryptedTotalVolume: {
    type: String,
    default: null,
    description: 'FHEVM encrypted total volume for private categories'
  },

  // Display settings
  displayOrder: {
    type: Number,
    default: 0,
  },

  // FHEVM-specific fields
  fhevmEnabled: {
    type: Boolean,
    default: true,
    description: 'Whether this category supports FHEVM encryption for private betting'
  },
  encryptionLevel: {
    type: String,
    enum: ['public', 'private', 'mixed'],
    default: 'private',
    description: 'Level of encryption for bets in this category'
  },

  color: {
    type: String,
    trim: true,
    match: [/^#[0-9A-F]{6}$/i, 'Invalid hex color format'],
  },

  icon: {
    type: String,
    trim: true,
  },

  // Admin info
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
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
  collection: 'categories'
});

// Indexes
categorySchema.index({ name: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ fhevmEnabled: 1 });
categorySchema.index({ parentCategory: 1 });
categorySchema.index({ displayOrder: 1 });
// Legacy indexes for backward compatibility
categorySchema.index({ categoryId: 1 });
categorySchema.index({ parentId: 1 });
categorySchema.index({ level: 1 });
categorySchema.index({ slug: 1 });

// Virtual for checking if category is currently active based on time
categorySchema.virtual('isCurrentlyActive').get(function () {
  const now = new Date();
  return this.isActive
         && now >= this.startTime
         && now <= this.endTime;
});

// Virtual for parent category
categorySchema.virtual('parent', {
  ref: 'Category',
  localField: 'parentId',
  foreignField: 'categoryId',
  justOne: true,
});

// Virtual for child categories
categorySchema.virtual('children', {
  ref: 'Category',
  localField: 'categoryId',
  foreignField: 'parentId',
});

// Pre-save middleware
categorySchema.pre('save', function (next) {
  this.updatedAt = new Date();

  // Generate slug from name if not provided
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Set meta title if not provided
  if (!this.metaTitle && this.name) {
    this.metaTitle = this.name.length > 60
      ? `${this.name.substring(0, 57)}...`
      : this.name;
  }

  next();
});

// Instance methods
categorySchema.methods.getPath = async function () {
  const path = [];
  let current = this;

  while (current) {
    path.unshift(current);
    if (current.parentId && current.parentId !== 0) {
      current = await this.constructor.findOne({ categoryId: current.parentId });
    } else {
      break;
    }
  }

  return path;
};

categorySchema.methods.getChildren = function (activeOnly = true) {
  const query = { parentId: this.categoryId };
  if (activeOnly) {
    query.isActive = true;
  }
  return this.constructor.find(query).sort({ displayOrder: 1, name: 1 });
};

categorySchema.methods.getAllDescendants = async function (activeOnly = true) {
  const descendants = [];
  const children = await this.getChildren(activeOnly);

  for (const child of children) {
    descendants.push(child);
    const grandChildren = await child.getAllDescendants(activeOnly);
    descendants.push(...grandChildren);
  }

  return descendants;
};

categorySchema.methods.updateStats = async function () {
  const Bet = mongoose.model('Bet');

  const stats = await Bet.aggregate([
    { $match: { categoryId: this.categoryId } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        volume: { $sum: '$totalVolume' },
      },
    },
  ]);

  if (stats.length > 0) {
    this.betCount = stats[0].count;
    this.totalVolume = stats[0].volume;
  } else {
    this.betCount = 0;
    this.totalVolume = 0;
  }

  return this.save();
};

// Static methods
categorySchema.statics.getTopLevel = function (activeOnly = true) {
  const query = {
    $or: [{ parentId: 0 }, { parentId: null }],
  };

  if (activeOnly) {
    query.isActive = true;
    query.startTime = { $lte: new Date() };
    query.endTime = { $gte: new Date() };
  }

  return this.find(query).sort({ displayOrder: 1, name: 1 });
};

categorySchema.statics.buildTree = async function (parentId = 0, activeOnly = true) {
  const query = { parentId };
  if (activeOnly) {
    query.isActive = true;
    query.startTime = { $lte: new Date() };
    query.endTime = { $gte: new Date() };
  }

  const categories = await this.find(query).sort({ displayOrder: 1, name: 1 });

  const tree = [];
  for (const category of categories) {
    const children = await this.buildTree(category.categoryId, activeOnly);
    tree.push({
      ...category.toObject(),
      children,
    });
  }

  return tree;
};

categorySchema.statics.findBySlug = function (slug) {
  return this.findOne({ slug, isActive: true });
};

categorySchema.statics.search = function (query, limit = 20) {
  return this.find({
    $and: [
      { isActive: true },
      {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
        ],
      },
    ],
  })
    .limit(limit)
    .sort({ betCount: -1, name: 1 });
};

// FHEVM static methods
categorySchema.statics.getFHEVMEnabledCategories = function() {
  return this.find({ fhevmEnabled: true, isActive: true });
};

categorySchema.statics.getPublicCategories = function() {
  return this.find({
    isActive: true,
    $or: [
      { fhevmEnabled: false },
      { encryptionLevel: 'public' }
    ]
  });
};

module.exports = mongoose.model('Category', categorySchema);
