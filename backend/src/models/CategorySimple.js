const mongoose = require('mongoose');

const categorySimpleSchema = new mongoose.Schema({
  _id: {
    type: String,
    description: 'Category ID (auto-generated slug)'
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    unique: true
  },
  icon: {
    type: String,
    default: '📊',
    trim: true
  },
  color: {
    type: String,
    default: '#6366f1',
    trim: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'categories_simple'
});

// Indexes
categorySimpleSchema.index({ name: 1 }, { unique: true });
categorySimpleSchema.index({ isActive: 1 });
categorySimpleSchema.index({ displayOrder: 1 });

// Pre-save: generate ID from name
categorySimpleSchema.pre('save', function(next) {
  this.updatedAt = new Date();

  if (this.isNew && !this._id) {
    this._id = this.name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  next();
});

// Static: Get all active categories
categorySimpleSchema.statics.getActive = function() {
  return this.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });
};

module.exports = mongoose.model('CategorySimple', categorySimpleSchema);
