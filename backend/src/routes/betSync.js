const express = require('express');
const router = express.Router();
const betSyncController = require('../controllers/betSyncController');
const upload = require('../middleware/upload');

// Sync bets from contract
router.post('/sync', betSyncController.syncBetsFromContract);

// Get all bets
router.get('/', betSyncController.getAllBets);

// Get bet by contractId
router.get('/:contractId', betSyncController.getBetByContractId);

// Update bet category
router.put('/:contractId/category', betSyncController.updateBetCategory);

// Update bet image (URL)
router.put('/:contractId/image', betSyncController.updateBetImage);

// Upload bet image (File Upload)
router.post('/:contractId/upload-image', upload.single('image'), betSyncController.uploadBetImage);

// Resolve bet (admin only)
router.post('/:contractId/resolve', betSyncController.resolveBet);

// Resolve nested bet (admin only)
router.post('/:contractId/resolve-nested', betSyncController.resolveNestedBet);

// Get bets by category
router.get('/category/:categoryId', betSyncController.getBetsByCategory);

module.exports = router;
