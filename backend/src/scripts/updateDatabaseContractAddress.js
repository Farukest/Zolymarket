const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { logger } = require('../utils/logger');

async function updateContractAddress() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    const Bet = mongoose.model('Bet', new mongoose.Schema({}, { strict: false, collection: 'bets' }));

    const oldAddress = "0x6B0Fc68e8e28d4E35bD33E8eAa32b06fC8E1356E";
    const newAddress = process.env.BET_MARKET_ADDRESS; // 0x6B0Fc68e8e28d4E35bD33E8eAa32b06fC8E1356E

    logger.info(`🔄 Updating contractAddress from ${oldAddress} to ${newAddress}`);

    const result = await Bet.updateMany(
      { contractAddress: oldAddress },
      { contractAddress: newAddress }
    );

    logger.info(`✅ Updated ${result.modifiedCount} bet records`);

    // Verify update
    const bets = await Bet.find({}).select('contractId title contractAddress');
    logger.info('\n📋 Updated database records:');
    bets.forEach(bet => {
      logger.info(`ID ${bet.contractId}: ${bet.contractAddress}`);
    });

  } catch (error) {
    logger.error('❌ Update failed:', error);
  } finally {
    await mongoose.disconnect();
    logger.info('Database connection closed');
  }
}

updateContractAddress();