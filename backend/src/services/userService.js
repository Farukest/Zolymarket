const User = require('../models/User');
const { ethers } = require('ethers');

/**
 * Find or create a user by wallet address
 * This is the core authentication mechanism for DeFi applications
 * @param {string} walletAddress - The user's wallet address
 * @returns {Promise<Object>} User object with id and walletAddress
 */
const findOrCreateUserByWallet = async (walletAddress) => {
  try {
    // Validate wallet address format
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      throw new Error('Invalid wallet address format');
    }

    const normalizedAddress = walletAddress.toLowerCase();

    // Try to find existing user
    let user = await User.findByWallet(normalizedAddress);

    // If user doesn't exist, create new one
    if (!user) {
      console.log(`🆕 Creating new user for wallet: ${normalizedAddress}`);

      user = new User({
        walletAddress: normalizedAddress,
        displayName: `User ${normalizedAddress.slice(0, 6)}...${normalizedAddress.slice(-4)}`,
        lastLogin: new Date(),
      });

      await user.save();
      console.log(`✅ User created successfully: ${user._id}`);
    } else {
      // Update last login for existing user
      user.lastLogin = new Date();
      await user.save();
      console.log(`👋 Existing user logged in: ${user._id}`);
    }

    return {
      id: user._id,
      walletAddress: user.walletAddress,
      displayName: user.displayName,
      isAdmin: user.isAdmin,
      totalBets: user.totalBets,
      totalVolume: user.totalVolume,
      winRate: user.winRate,
    };
  } catch (error) {
    console.error('❌ Error in findOrCreateUserByWallet:', error);
    throw error;
  }
};

/**
 * Get user statistics by wallet address
 * @param {string} walletAddress - The user's wallet address
 * @returns {Promise<Object>} User statistics
 */
const getUserStats = async (walletAddress) => {
  try {
    if (!ethers.isAddress(walletAddress)) {
      throw new Error('Invalid wallet address format');
    }

    const user = await User.findByWallet(walletAddress.toLowerCase());
    if (!user) {
      return null;
    }

    return {
      totalBets: user.totalBets,
      totalVolume: user.totalVolume,
      winnings: user.winnings,
      winRate: user.winRate,
      memberSince: user.createdAt,
    };
  } catch (error) {
    console.error('❌ Error getting user stats:', error);
    throw error;
  }
};

/**
 * Update user statistics after a bet
 * @param {string} walletAddress - The user's wallet address
 * @param {number} betAmount - The amount bet
 * @param {boolean} won - Whether the user won
 * @returns {Promise<void>}
 */
const updateUserStats = async (walletAddress, betAmount, won = false) => {
  try {
    if (!ethers.isAddress(walletAddress)) {
      throw new Error('Invalid wallet address format');
    }

    const user = await User.findByWallet(walletAddress.toLowerCase());
    if (user) {
      await user.updateStats(betAmount, won);
      console.log(`📊 Updated stats for ${walletAddress}: bets=${user.totalBets}, volume=${user.totalVolume}`);
    }
  } catch (error) {
    console.error('❌ Error updating user stats:', error);
    throw error;
  }
};

/**
 * Validate that a user exists for the given wallet address
 * @param {string} walletAddress - The user's wallet address
 * @returns {Promise<boolean>} Whether user exists
 */
const validateUserExists = async (walletAddress) => {
  try {
    if (!ethers.isAddress(walletAddress)) {
      return false;
    }

    const user = await User.findByWallet(walletAddress.toLowerCase());
    return !!user;
  } catch (error) {
    console.error('❌ Error validating user:', error);
    return false;
  }
};

module.exports = {
  findOrCreateUserByWallet,
  getUserStats,
  updateUserStats,
  validateUserExists,
};