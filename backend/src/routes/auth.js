const express = require('express');
const {
  login,
  getMe,
  logout,
  verify,
  getNonce,
  updateProfile,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const {
  validateLogin,
  validateProfile,
  sanitizeInput,
} = require('../middleware/validation');

const router = express.Router();

// Public routes
router.post('/nonce', getNonce);
router.post('/login', sanitizeInput, validateLogin, login);
router.post('/logout', logout);

// Protected routes
router.use(protect); // All routes below require authentication

router.get('/verify', verify);
router.get('/me', getMe);
router.put('/profile', sanitizeInput, validateProfile, updateProfile);

module.exports = router;
