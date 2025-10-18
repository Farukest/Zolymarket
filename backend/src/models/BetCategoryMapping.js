const mongoose = require('mongoose');

const betCategoryMappingSchema = new mongoose.Schema({
  contractId: {
    type: Number,
    required: true,
    unique: true,
    description: 'Contract bet ID from BetMarketPro'
  },
  categoryId: {
    type: String,
    required: true,
    ref: 'Category',
    description: 'MongoDB category ID'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'bet_category_mappings'
});

// Indexes
betCategoryMappingSchema.index({ contractId: 1 }, { unique: true });
betCategoryMappingSchema.index({ categoryId: 1 });

// Update timestamp on save
betCategoryMappingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('BetCategoryMapping', betCategoryMappingSchema);
