const CategorySimple = require('../models/CategorySimple');
const BetCategoryMapping = require('../models/BetCategoryMapping');
const { logger } = require('../utils/logger');

// Get all categories
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await CategorySimple.getActive();

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    logger.error('Get categories error:', error);
    next(error);
  }
};

// Create category
exports.createCategory = async (req, res, next) => {
  try {
    const { name, icon, color, displayOrder } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }

    const category = new CategorySimple({
      name,
      icon: icon || '📊',
      color: color || '#6366f1',
      displayOrder: displayOrder || 0
    });

    await category.save();

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }

    logger.error('Create category error:', error);
    next(error);
  }
};

// Update category
exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, icon, color, displayOrder, isActive } = req.body;

    const category = await CategorySimple.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    if (name) category.name = name;
    if (icon) category.icon = icon;
    if (color) category.color = color;
    if (typeof displayOrder !== 'undefined') category.displayOrder = displayOrder;
    if (typeof isActive !== 'undefined') category.isActive = isActive;

    await category.save();

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    logger.error('Update category error:', error);
    next(error);
  }
};

// Delete category
exports.deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await CategorySimple.findByIdAndDelete(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Remove all bet category mappings for this category
    await BetCategoryMapping.deleteMany({ categoryId: id });

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    logger.error('Delete category error:', error);
    next(error);
  }
};

// Assign category to bet
exports.assignBetCategory = async (req, res, next) => {
  try {
    const { contractId, categoryId } = req.body;

    if (!contractId || !categoryId) {
      return res.status(400).json({
        success: false,
        message: 'contractId and categoryId are required'
      });
    }

    // Check if category exists
    const category = await CategorySimple.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Update or create mapping
    const mapping = await BetCategoryMapping.findOneAndUpdate(
      { contractId },
      { contractId, categoryId },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      data: mapping
    });
  } catch (error) {
    logger.error('Assign bet category error:', error);
    next(error);
  }
};

// Get bet category
exports.getBetCategory = async (req, res, next) => {
  try {
    const { contractId } = req.params;

    const mapping = await BetCategoryMapping.findOne({ contractId }).populate('categoryId');

    if (!mapping) {
      return res.status(200).json({
        success: true,
        data: null
      });
    }

    res.status(200).json({
      success: true,
      data: mapping
    });
  } catch (error) {
    logger.error('Get bet category error:', error);
    next(error);
  }
};

// Get bets by category
exports.getBetsByCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;

    const mappings = await BetCategoryMapping.find({ categoryId });
    const contractIds = mappings.map(m => m.contractId);

    res.status(200).json({
      success: true,
      data: contractIds
    });
  } catch (error) {
    logger.error('Get bets by category error:', error);
    next(error);
  }
};

module.exports = exports;
