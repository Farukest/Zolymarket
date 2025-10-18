const express = require('express');
const router = express.Router();
const UserPosition = require('../models/UserPosition');
const Bet = require('../models/Bet');

/**
 * @route   POST /api/user-positions/record-bet
 * @desc    Record user bet (called from frontend after PlaceBet tx)
 * @access  Public
 */
router.post('/record-bet', async (req, res) => {
  try {
    const {
      contractBetId,
      userAddress,
      optionIndex,
      outcome, // For nested bets: 0=Yes, 1=No. For binary/multiple: null
      amount, // Cleartext amount from frontend
      entryPrice,
      placeBetTxHash,
      blockNumber
    } = req.body;

    // Validation
    if (!contractBetId || !userAddress || optionIndex === undefined || !amount || !placeBetTxHash) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check if already recorded (prevent duplicates)
    const existing = await UserPosition.findOne({ placeBetTxHash });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Bet already recorded',
        position: existing
      });
    }

    // Find bet in MongoDB (REQUIRED for betId reference)
    const bet = await Bet.findOne({ contractId: contractBetId });

    if (!bet) {
      return res.status(404).json({
        success: false,
        message: `Bet with contractId ${contractBetId} not found in database. Please sync bets first.`
      });
    }

    // Create user position
    const userPosition = new UserPosition({
      betId: bet._id, // Required field
      contractBetId,
      userAddress: userAddress.toLowerCase(),
      optionIndex,
      outcome: outcome !== undefined ? outcome : null, // For nested: 0=Yes, 1=No. For binary/multiple: null
      amount, // Store cleartext amount
      entryPrice: entryPrice || 50, // Default 50 if not provided
      encryptedAmount: 'encrypted', // Placeholder (actual encrypted data on-chain)
      placeBetTxHash,
      blockNumber: blockNumber || 0,
      isEncrypted: true,
      status: 'active'
    });

    await userPosition.save();

    res.status(201).json({
      success: true,
      message: 'User bet recorded successfully',
      position: userPosition
    });
  } catch (error) {
    console.error('Error recording user bet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record user bet',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/user-positions/:address/:contractBetId
 * @desc    Get user position for a specific bet (check if user won)
 * @access  Public
 */
router.get('/:address/:contractBetId', async (req, res) => {
  try {
    const { address, contractBetId } = req.params;

    const position = await UserPosition.findOne({
      userAddress: address.toLowerCase(),
      contractBetId: parseInt(contractBetId)
    });

    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found',
        hasPosition: false
      });
    }

    res.json({
      success: true,
      hasPosition: true,
      isResolved: position.isResolved,
      isWinner: position.isWinner,
      optionIndex: position.optionIndex,
      amount: position.amount,
      claimed: position.claimed
    });
  } catch (error) {
    console.error('Error fetching user position:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user position',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/user-positions/update-winners
 * @desc    Update winners after bet resolution (called by admin/backend)
 * @access  Public (should be protected in production)
 */
router.post('/update-winners', async (req, res) => {
  try {
    const { contractBetId, winningOptionIndex, winningOutcome } = req.body;

    if (!contractBetId || winningOptionIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing contractBetId or winningOptionIndex'
      });
    }

    // Find all positions for this bet
    const positions = await UserPosition.find({ contractBetId });

    if (positions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No positions found for this bet'
      });
    }

    const isNestedBet = winningOutcome !== undefined && winningOutcome !== null;

    // Update each position
    const updates = positions.map(async (position) => {
      position.isResolved = true;

      // For nested bets: check both optionIndex AND outcome
      // For binary/multiple: check only optionIndex
      if (isNestedBet) {
        position.isWinner = (
          position.optionIndex === winningOptionIndex &&
          position.outcome === winningOutcome
        );
      } else {
        position.isWinner = position.optionIndex === winningOptionIndex;
      }

      position.status = 'resolved';
      await position.save();
    });

    await Promise.all(updates);

    const winnersCount = positions.filter(p => {
      if (isNestedBet) {
        return p.optionIndex === winningOptionIndex && p.outcome === winningOutcome;
      }
      return p.optionIndex === winningOptionIndex;
    }).length;

    res.json({
      success: true,
      message: `Updated ${positions.length} positions`,
      winnersCount: winnersCount,
      losersCount: positions.length - winnersCount,
      isNestedBet: isNestedBet
    });
  } catch (error) {
    console.error('Error updating winners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update winners',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/user-positions/user/:address
 * @desc    Get all positions for a user
 * @access  Public
 */
router.get('/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { status } = req.query; // Optional filter

    const query = { userAddress: address.toLowerCase() };
    if (status) query.status = status;

    const positions = await UserPosition.find(query)
      .populate('betId', 'title description endTime isResolved')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: positions.length,
      positions
    });
  } catch (error) {
    console.error('Error fetching user positions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user positions',
      error: error.message
    });
  }
});

module.exports = router;
