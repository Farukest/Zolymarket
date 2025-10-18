const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const User = require('../models/User');
const { logger } = require('../utils/logger');

// Generate JWT token
const generateToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRE || '30d',
});

// Login with wallet signature
exports.login = async (req, res, next) => {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address, signature, and message are required',
      });
    }

    // Verify signature
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({
        success: false,
        message: 'Invalid signature',
      });
    }

    // Find or create user
    let user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });

    if (!user) {
      user = await User.create({
        walletAddress: walletAddress.toLowerCase(),
        lastLogin: new Date(),
      });
      logger.info(`New user created: ${walletAddress}`);
    } else {
      user.lastLogin = new Date();
      await user.save();
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          walletAddress: user.walletAddress,
          isAdmin: user.isAdmin,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    next(error);
  }
};

// Get current user
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-__v');

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// Logout
exports.logout = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

// Verify token
exports.verify = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Token is valid',
    data: {
      user: {
        id: req.user.id,
        walletAddress: req.user.walletAddress,
        isAdmin: req.user.isAdmin,
      },
    },
  });
};

// Generate nonce for wallet signature
exports.getNonce = async (req, res) => {
  const nonce = Math.floor(Math.random() * 1000000);
  const message = `Sign this message to authenticate with Zolymarket FHEVM.\n\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;

  res.status(200).json({
    success: true,
    data: {
      message,
      nonce,
    },
  });
};

// Update user profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { displayName, bio, avatar } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        displayName,
        bio,
        avatar,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true },
    ).select('-__v');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};
