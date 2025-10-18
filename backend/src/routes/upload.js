const express = require('express');
const multer = require('multer');
const { uploadImage } = require('../services/uploadService');
const { protect, requireAdmin } = require('../middleware/auth');
const { validateImageUpload } = require('../middleware/validation');
const { logger } = require('../utils/logger');

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'), false);
    }
  },
});

// Apply authentication to all upload routes
router.use(protect);

// Upload image endpoint
router.post(
  '/image',
  requireAdmin, // Only admins can upload images
  upload.single('image'),
  validateImageUpload,
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No image file provided',
        });
      }

      const result = await uploadImage(req.file.buffer, {
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        userId: req.user.id,
      });

      logger.info(`Image uploaded successfully by user ${req.user.id}`, {
        imageUrl: result.secure_url,
        publicId: result.public_id,
      });

      res.status(200).json({
        success: true,
        message: 'Image uploaded successfully',
        data: {
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        },
      });
    } catch (error) {
      logger.error('Image upload error:', error);
      next(error);
    }
  },
);

// Upload multiple images
router.post(
  '/images',
  requireAdmin,
  upload.array('images', 5), // Max 5 images
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No image files provided',
        });
      }

      const uploadPromises = req.files.map((file) => uploadImage(file.buffer, {
        originalName: file.originalname,
        mimetype: file.mimetype,
        userId: req.user.id,
      }));

      const results = await Promise.all(uploadPromises);

      const uploadedImages = results.map((result) => ({
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
      }));

      logger.info(`${results.length} images uploaded successfully by user ${req.user.id}`);

      res.status(200).json({
        success: true,
        message: `${results.length} images uploaded successfully`,
        data: {
          images: uploadedImages,
          count: uploadedImages.length,
        },
      });
    } catch (error) {
      logger.error('Multiple image upload error:', error);
      next(error);
    }
  },
);

// Get upload history (for admins)
router.get(
  '/history',
  requireAdmin,
  async (req, res, next) => {
    try {
      const { page = 1, limit = 20 } = req.query;

      // This would require storing upload history in database
      // For now, return empty array
      res.status(200).json({
        success: true,
        message: 'Upload history retrieved',
        data: {
          uploads: [],
          currentPage: parseInt(page),
          totalPages: 0,
          count: 0,
        },
      });
    } catch (error) {
      logger.error('Upload history error:', error);
      next(error);
    }
  },
);

// Error handling for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum 5MB allowed.',
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 5 files allowed.',
      });
    }
  }

  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  next(error);
});

module.exports = router;
