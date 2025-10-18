const express = require('express');
const router = express.Router();
const systemSettingsController = require('../controllers/systemSettingsController');

// Get system settings (public - for footer display)
router.get('/', systemSettingsController.getSettings);

// Update system settings (admin only in production)
router.put('/', systemSettingsController.updateSettings);

// Footer items management (admin only in production)
router.post('/footer-items', systemSettingsController.addFooterItem);
router.put('/footer-items/:itemId', systemSettingsController.updateFooterItem);
router.delete('/footer-items/:itemId', systemSettingsController.deleteFooterItem);
router.post('/footer-items/reorder', systemSettingsController.reorderFooterItems);

module.exports = router;
