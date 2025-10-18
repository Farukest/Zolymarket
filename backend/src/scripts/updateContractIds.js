const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import models
const Bet = require('../models/Bet');
const { logger } = require('../utils/logger');

// ID mapping from import results
const contractIdMapping = {
  1001: 1,  // Fed 50+ bps decrease? -> Contract ID 1
  1002: 2,  // Fed 25 bps decrease? -> Contract ID 2
  1003: 3,  // Fed no change? -> Contract ID 3
  1004: 4,  // Fed 25+ bps increase? -> Contract ID 4
  1005: 5,  // Sevilla vs Villareal -> Contract ID 5
  1006: 6,  // Real Madrid vs Barcelona -> Contract ID 6
  1007: 7,  // Bitcoin above $100k by 2024? -> Contract ID 7
  1008: 8   // 2024 US President Election -> Contract ID 8
};

async function updateContractIds() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    logger.info('🔄 Starting contract ID update process...');

    for (const [oldId, newId] of Object.entries(contractIdMapping)) {
      try {
        const oldIdNum = parseInt(oldId);
        const newIdNum = parseInt(newId);

        logger.info(`📝 Updating bet ${oldIdNum} -> ${newIdNum}`);

        const result = await Bet.findOneAndUpdate(
          { contractId: oldIdNum },
          { contractId: newIdNum },
          { new: true }
        );

        if (result) {
          logger.info(`✅ Updated ${result.title}: ${oldIdNum} -> ${newIdNum}`);
        } else {
          logger.warn(`⚠️  Bet with contractId ${oldIdNum} not found`);
        }

      } catch (betError) {
        logger.error(`❌ Failed to update bet ${oldId}:`, betError.message);
      }
    }

    // Verify updates
    logger.info('\n🔍 Verifying updates...');
    for (const newId of Object.values(contractIdMapping)) {
      const bet = await Bet.findOne({ contractId: newId });
      if (bet) {
        logger.info(`✅ Verified bet ${newId}: ${bet.title}`);
      } else {
        logger.error(`❌ Bet ${newId} not found after update`);
      }
    }

    logger.info('🎉 Contract ID update completed!');

  } catch (error) {
    logger.error('❌ Update failed:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    logger.info('Database connection closed');
  }
}

// Run if called directly
if (require.main === module) {
  updateContractIds().catch(console.error);
}

module.exports = updateContractIds;