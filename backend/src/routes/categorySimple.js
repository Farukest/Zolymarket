const express = require('express');
const router = express.Router();
const categorySimpleController = require('../controllers/categorySimpleController');

// Get all categories
router.get('/', categorySimpleController.getCategories);

// Create category
router.post('/', categorySimpleController.createCategory);

// Update category
router.put('/:id', categorySimpleController.updateCategory);

// Delete category
router.delete('/:id', categorySimpleController.deleteCategory);

// Assign category to bet
router.post('/assign', categorySimpleController.assignBetCategory);

// Get bet category
router.get('/bet/:contractId', categorySimpleController.getBetCategory);

// Get bets by category
router.get('/:categoryId/bets', categorySimpleController.getBetsByCategory);

module.exports = router;
