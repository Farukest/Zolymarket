const { ethers } = require('ethers');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { logger } = require('../utils/logger');

async function repairACL() {
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

    logger.info('🔧 Starting ACL repair process...');
    logger.info('Contract address:', process.env.BET_MARKET_ADDRESS);
    logger.info('Signer address:', await signer.getAddress());

    // Repair ACL for bets 1-8 (all imported bets)
    for (let betId = 1; betId <= 8; betId++) {
      try {
        logger.info(`\n🛠️  Repairing ACL for bet ${betId}...`);

        // Check if bet exists first
        try {
          const bet = await contract.getBet(betId);
          logger.info(`✅ Bet ${betId} found - proceeding with ACL repair`);
        } catch (getBetError) {
          logger.warn(`⚠️  Bet ${betId} not found - skipping ACL repair`);
          continue;
        }

        // Call repairACL function
        const tx = await contract.repairACL(betId);
        logger.info(`📤 ACL repair transaction sent for bet ${betId}: ${tx.hash}`);

        // Wait for confirmation
        const receipt = await tx.wait();
        logger.info(`✅ ACL repair completed for bet ${betId} in block ${receipt.blockNumber}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (betError) {
        logger.error(`❌ Failed to repair ACL for bet ${betId}:`, betError.message);
        // Continue with next bet instead of stopping
      }
    }

    logger.info('\n🎉 ACL repair process completed!');
    logger.info('✅ All bet ACL permissions should now be properly configured');
    logger.info('🎯 Try placing a bet now - the ACL error should be resolved');

  } catch (error) {
    logger.error('❌ ACL repair failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  repairACL().catch(console.error);
}

module.exports = repairACL;