const SystemSettings = require('../models/SystemSettings');

// Get system settings
exports.getSettings = async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error getting system settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system settings',
      error: error.message
    });
  }
};

// Update system settings
exports.updateSettings = async (req, res) => {
  try {
    const settings = await SystemSettings.updateSettings(req.body);
    res.status(200).json({
      success: true,
      message: 'System settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error updating system settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update system settings',
      error: error.message
    });
  }
};

// Add footer item
exports.addFooterItem = async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    const newItem = req.body;

    // Auto-increment order if not provided
    if (!newItem.order) {
      const itemsInPosition = settings.footerItems.filter(
        item => item.position === newItem.position
      );
      newItem.order = itemsInPosition.length;
    }

    settings.footerItems.push(newItem);
    await settings.save();

    res.status(201).json({
      success: true,
      message: 'Footer item added successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error adding footer item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add footer item',
      error: error.message
    });
  }
};

// Update footer item
exports.updateFooterItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const updates = req.body;

    const settings = await SystemSettings.getSettings();
    const itemIndex = settings.footerItems.findIndex(
      item => item._id.toString() === itemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Footer item not found'
      });
    }

    // Update the item
    Object.assign(settings.footerItems[itemIndex], updates);
    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Footer item updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error updating footer item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update footer item',
      error: error.message
    });
  }
};

// Delete footer item
exports.deleteFooterItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    const settings = await SystemSettings.getSettings();
    settings.footerItems = settings.footerItems.filter(
      item => item._id.toString() !== itemId
    );
    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Footer item deleted successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error deleting footer item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete footer item',
      error: error.message
    });
  }
};

// Reorder footer items
exports.reorderFooterItems = async (req, res) => {
  try {
    const { items } = req.body; // Array of { id, order }

    const settings = await SystemSettings.getSettings();

    items.forEach(({ id, order }) => {
      const item = settings.footerItems.find(
        item => item._id.toString() === id
      );
      if (item) {
        item.order = order;
      }
    });

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Footer items reordered successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error reordering footer items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reorder footer items',
      error: error.message
    });
  }
};
