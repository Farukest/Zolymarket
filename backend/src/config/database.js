const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

const connectDB = async () => {
  const maxRetries = 5;
  const retryDelay = 2000; // 2 seconds

  for (let i = 0; i < maxRetries; i++) {
    try {
      logger.info(`Attempting to connect to MongoDB (attempt ${i + 1}/${maxRetries})...`);

      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      logger.info(`MongoDB Connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      logger.error(`Database connection attempt ${i + 1} failed:`, error.message);

      if (i < maxRetries - 1) {
        logger.info(`Retrying in ${retryDelay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        logger.error('All database connection attempts failed');
        process.exit(1);
      }
    }
  }
};

module.exports = connectDB;
