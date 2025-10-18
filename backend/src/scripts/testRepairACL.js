const { ethers } = require('ethers');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { logger } = require('../utils/logger');

async function testRepairACL() {
  try {
    // Setup blockchain connection
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Initialize BetMarket contract
    const betMarketABI = [
      'function repairACL(uint256 _betId) external',
      'function getBet(uint256 _betId) external view returns (tuple(uint256 id, uint256 endTime, bool isActive, bool isResolved, uint8 betType, address createdBy, uint256 minBetAmount, uint256 maxBetAmount, uint256 optionCount))'
    ];

    const contract = new ethers.Contract(
      process.env.BET_MARKET_ADDRESS,
      betMarketABI,
      signer
    );

    logger.info('🔧 Testing repairACL function...');
    logger.info('Contract address:', process.env.BET_MARKET_ADDRESS);
    logger.info('Signer address:', await signer.getAddress());

    // Test repairACL for bet 6 (Real Madrid vs Barcelona)
    const betId = 6;

    try {
      logger.info(`🛠️ Calling repairACL for bet ${betId}...`);

      const tx = await contract.repairACL(betId);
      logger.info(`📤 RepairACL transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      logger.info(`✅ RepairACL completed for bet ${betId} in block ${receipt.blockNumber}`);

      logger.info('🎯 Now try placing a bet - ACL should be repaired!');

    } catch (error) {
      logger.error(`❌ RepairACL failed for bet ${betId}:`, error.message);
    }

  } catch (error) {
    logger.error('❌ Test repairACL failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  testRepairACL().catch(console.error);
}

module.exports = testRepairACL;