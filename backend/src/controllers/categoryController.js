const Category = require('../models/Category');
const { logger } = require('../utils/logger');

// Get all categories
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ level: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: { categories },
    });
  } catch (error) {
    next(error);
  }
};

// Get single category
exports.getCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    res.status(200).json({
      success: true,
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

// Get top level categories
exports.getTopLevelCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({
      parentId: { $in: [null, 0] },
      isActive: true,
    }).sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: { categories },
    });
  } catch (error) {
    next(error);
  }
};

// Get subcategories
exports.getSubCategories = async (req, res, next) => {
  try {
    const { parentId } = req.params;

    const subcategories = await Category.find({
      parentId: parseInt(parentId),
      isActive: true,
    }).sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      count: subcategories.length,
      data: { categories: subcategories },
    });
  } catch (error) {
    next(error);
  }
};

// Get category tree (with children)
exports.getCategoryTree = async (req, res, next) => {
  try {
    const buildTree = async (parentId = null) => {
      const categories = await Category.find({
        parentId: parentId || { $in: [null, 0] },
        isActive: true,
      }).sort({ createdAt: 1 });

      const tree = [];
      for (const category of categories) {
        const children = await buildTree(category.categoryId);
        tree.push({
          ...category.toObject(),
          children,
        });
      }
      return tree;
    };

    const tree = await buildTree();

    res.status(200).json({
      success: true,
      data: { categories: tree },
    });
  } catch (error) {
    next(error);
  }
};

// Get category path (breadcrumb)
exports.getCategoryPath = async (req, res, next) => {
  try {
    const { id } = req.params;
    const path = [];

    let currentCategory = await Category.findById(id);

    while (currentCategory) {
      path.unshift(currentCategory);

      if (currentCategory.parentId && currentCategory.parentId !== 0) {
        currentCategory = await Category.findOne({
          categoryId: currentCategory.parentId,
        });
      } else {
        break;
      }
    }

    res.status(200).json({
      success: true,
      data: { path },
    });
  } catch (error) {
    next(error);
  }
};

// Search categories
exports.searchCategories = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters',
      });
    }

    const categories = await Category.find({
      $and: [
        { isActive: true },
        {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { description: { $regex: q, $options: 'i' } },
          ],
        },
      ],
    }).limit(20);

    res.status(200).json({
      success: true,
      count: categories.length,
      data: { categories },
    });
  } catch (error) {
    next(error);
  }
};
