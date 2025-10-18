const cloudinary = require('cloudinary').v2;
const { logger } = require('../utils/logger');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

class UploadService {
  constructor() {
    this.initialized = false;
    this.init();
  }

  init() {
    if (!process.env.CLOUDINARY_CLOUD_NAME
        || !process.env.CLOUDINARY_API_KEY
        || !process.env.CLOUDINARY_API_SECRET) {
      logger.warn('Cloudinary credentials not configured. Image upload will not work.');
      return;
    }

    this.initialized = true;
    logger.info('Upload service initialized with Cloudinary');
  }

  // Upload image to Cloudinary
  async uploadImage(buffer, options = {}) {
    if (!this.initialized) {
      throw new Error('Upload service not properly configured');
    }

    try {
      const {
        originalName = 'image',
        mimetype = 'image/jpeg',
        userId = null,
        folder = 'polymarket-fhevm',
      } = options;

      // Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const publicId = `${folder}/${timestamp}_${randomString}`;

      // Upload options
      const uploadOptions = {
        public_id: publicId,
        folder: folder,
        resource_type: 'image',
        format: 'auto',
        quality: 'auto',
        fetch_format: 'auto',

        // Transformation options
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],

        // Additional metadata
        context: {
          original_name: originalName,
          uploaded_by: userId || 'system',
          upload_timestamp: timestamp,
        },

        // Tags for organization
        tags: ['polymarket', 'user-upload', process.env.NODE_ENV || 'development'],
      };

      // Perform upload
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          },
        ).end(buffer);
      });

      logger.info(`Image uploaded successfully: ${result.public_id}`, {
        publicId: result.public_id,
        url: result.secure_url,
        bytes: result.bytes,
        format: result.format,
      });

      return {
        public_id: result.public_id,
        secure_url: result.secure_url,
        url: result.url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        created_at: result.created_at,
      };
    } catch (error) {
      logger.error('Image upload failed:', error);
      throw new Error(`Image upload failed: ${error.message}`);
    }
  }

  // Delete image from Cloudinary
  async deleteImage(publicId) {
    if (!this.initialized) {
      throw new Error('Upload service not properly configured');
    }

    try {
      const result = await cloudinary.uploader.destroy(publicId);

      logger.info(`Image deleted: ${publicId}`, { result });

      return result;
    } catch (error) {
      logger.error('Image deletion failed:', error);
      throw new Error(`Image deletion failed: ${error.message}`);
    }
  }

  // Generate image variations
  async generateVariations(publicId, variations = []) {
    if (!this.initialized) {
      throw new Error('Upload service not properly configured');
    }

    try {
      const defaultVariations = [
        {
          name: 'thumbnail', width: 150, height: 150, crop: 'thumb',
        },
        {
          name: 'small', width: 300, height: 300, crop: 'limit',
        },
        {
          name: 'medium', width: 600, height: 600, crop: 'limit',
        },
        {
          name: 'large', width: 1200, height: 1200, crop: 'limit',
        },
      ];

      const variationsToGenerate = variations.length > 0 ? variations : defaultVariations;
      const results = {};

      for (const variation of variationsToGenerate) {
        const transformedUrl = cloudinary.url(publicId, {
          width: variation.width,
          height: variation.height,
          crop: variation.crop || 'limit',
          quality: 'auto:good',
          fetch_format: 'auto',
        });

        results[variation.name] = transformedUrl;
      }

      return results;
    } catch (error) {
      logger.error('Image variation generation failed:', error);
      throw new Error(`Image variation generation failed: ${error.message}`);
    }
  }

  // Get image metadata
  async getImageMetadata(publicId) {
    if (!this.initialized) {
      throw new Error('Upload service not properly configured');
    }

    try {
      const result = await cloudinary.api.resource(publicId);

      return {
        public_id: result.public_id,
        version: result.version,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        url: result.secure_url,
        created_at: result.created_at,
        tags: result.tags,
        context: result.context,
      };
    } catch (error) {
      logger.error('Failed to get image metadata:', error);
      throw new Error(`Failed to get image metadata: ${error.message}`);
    }
  }

  // List uploaded images
  async listImages(options = {}) {
    if (!this.initialized) {
      throw new Error('Upload service not properly configured');
    }

    try {
      const {
        folder = 'polymarket-fhevm',
        maxResults = 50,
        nextCursor = null,
      } = options;

      const searchOptions = {
        expression: `folder:${folder}`,
        max_results: maxResults,
        sort_by: [['created_at', 'desc']],
      };

      if (nextCursor) {
        searchOptions.next_cursor = nextCursor;
      }

      const result = await cloudinary.search.execute();

      return {
        resources: result.resources.map((resource) => ({
          public_id: resource.public_id,
          secure_url: resource.secure_url,
          width: resource.width,
          height: resource.height,
          format: resource.format,
          bytes: resource.bytes,
          created_at: resource.created_at,
        })),
        next_cursor: result.next_cursor,
        total_count: result.total_count,
      };
    } catch (error) {
      logger.error('Failed to list images:', error);
      throw new Error(`Failed to list images: ${error.message}`);
    }
  }

  // Validate image before upload
  validateImage(file) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
    }

    if (file.size > maxSize) {
      throw new Error('File size too large. Maximum 10MB allowed.');
    }

    return true;
  }

  // Generate optimized URL
  getOptimizedUrl(publicId, options = {}) {
    const {
      width = 'auto',
      height = 'auto',
      crop = 'limit',
      quality = 'auto:good',
      format = 'auto',
    } = options;

    return cloudinary.url(publicId, {
      width,
      height,
      crop,
      quality,
      fetch_format: format,
    });
  }

  // Cleanup old images
  async cleanupOldImages(daysOld = 30) {
    if (!this.initialized) {
      throw new Error('Upload service not properly configured');
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const timestamp = Math.floor(cutoffDate.getTime() / 1000);

      const result = await cloudinary.api.delete_resources_by_tag(
        'polymarket',
        {
          created_at: { $lt: timestamp },
        },
      );

      logger.info(`Cleaned up ${Object.keys(result.deleted).length} old images`);

      return result;
    } catch (error) {
      logger.error('Cleanup failed:', error);
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }

  // Get service status
  getStatus() {
    return {
      initialized: this.initialized,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'Not configured',
      apiConfigured: !!(process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
    };
  }
}

// Create singleton instance
const uploadService = new UploadService();

// Export the service and individual functions
module.exports = {
  uploadService,
  uploadImage: (buffer, options) => uploadService.uploadImage(buffer, options),
  deleteImage: (publicId) => uploadService.deleteImage(publicId),
  generateVariations: (publicId, variations) => uploadService.generateVariations(publicId, variations),
  getImageMetadata: (publicId) => uploadService.getImageMetadata(publicId),
  listImages: (options) => uploadService.listImages(options),
  validateImage: (file) => uploadService.validateImage(file),
  getOptimizedUrl: (publicId, options) => uploadService.getOptimizedUrl(publicId, options),
};
