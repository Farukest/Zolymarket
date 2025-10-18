const { ethers } = require('ethers');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import models
const Bet = require('../models/Bet');
const { logger } = require('../utils/logger');

class BetImporter {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contract = null;
  }

  async initialize() {
    try {
      // Connect to database
      await mongoose.connect(process.env.MONGODB_URI);
      logger.info('Connected to MongoDB');

      // Setup blockchain connection
      this.provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
      this.signer = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);

      // Initialize BetMarket contract
      const betMarketABI = [
        'function createBet(uint256 _optionCount, uint256 _endTime, uint8 _betType, uint256 _minBetAmount, uint256 _maxBetAmount) external returns (uint256)',
        'function getBet(uint256 _betId) external view returns (tuple(uint256 id, uint256 endTime, bool isActive, bool isResolved, uint8 betType, address createdBy, uint256 minBetAmount, uint256 maxBetAmount, uint256 optionCount))',
        'event BetCreated(uint256 indexed betId, uint256 indexed endTime, uint256 optionCount)'
      ];

      this.contract = new ethers.Contract(
        process.env.BET_MARKET_ADDRESS,
        betMarketABI,
        this.signer
      );

      logger.info('Blockchain connection initialized');
      logger.info('Contract address:', process.env.BET_MARKET_ADDRESS);
      logger.info('Signer address:', await this.signer.getAddress());
    } catch (error) {
      logger.error('Initialization failed:', error);
      throw error;
    }
  }

  async importDatabaseBetsToContract() {
    try {
      logger.info('🔄 Starting bet import process...');

      // Get all bets from database
      const databaseBets = await Bet.find({ isActive: true }).sort({ contractId: 1 });
      logger.info(`Found ${databaseBets.length} bets in database`);

      for (const bet of databaseBets) {
        try {
          logger.info(`\n📝 Processing bet ${bet.contractId}: ${bet.title}`);

          // Check if bet already exists on contract
          let existsOnContract = false;
          try {
            const contractBet = await this.contract.getBet(bet.contractId);
            if (contractBet && contractBet.id && Number(contractBet.id) > 0) {
              existsOnContract = true;
              logger.info(`✅ Bet ${bet.contractId} already exists on contract - skipping`);
              continue;
            }
          } catch (contractError) {
            // Bet doesn't exist on contract - this is expected for new imports
            logger.info(`ℹ️  Bet ${bet.contractId} not found on contract - will create`);
          }

          // Prepare bet data for contract
          const endTimeTimestamp = Math.floor(new Date(bet.endTime).getTime() / 1000);
          const optionCount = bet.options?.length || 2;
          const betType = bet.betType || 1;
          const minBetAmount = bet.minBetAmount || 1000000; // 1 USDC in 6 decimals
          const maxBetAmount = bet.maxBetAmount || 1000000000000; // 1M USDC in 6 decimals

          logger.info(`📊 Bet parameters:`, {
            contractId: bet.contractId,
            optionCount,
            endTime: new Date(bet.endTime).toISOString(),
            endTimeTimestamp,
            betType,
            minBetAmount,
            maxBetAmount
          });

          // Create bet on contract
          logger.info(`🚀 Creating bet ${bet.contractId} on contract...`);
          const tx = await this.contract.createBet(
            optionCount,
            endTimeTimestamp,
            betType,
            minBetAmount,
            maxBetAmount
          );

          logger.info(`📤 Transaction sent: ${tx.hash}`);

          // Wait for confirmation
          const receipt = await tx.wait();
          logger.info(`✅ Bet ${bet.contractId} created successfully in block ${receipt.blockNumber}`);

          // Parse events to get the actual bet ID created
          const betCreatedEvent = receipt.logs.find(log => {
            try {
              const parsed = this.contract.interface.parseLog(log);
              return parsed.name === 'BetCreated';
            } catch {
              return false;
            }
          });

          if (betCreatedEvent) {
            const parsed = this.contract.interface.parseLog(betCreatedEvent);
            const createdBetId = Number(parsed.args.betId);
            logger.info(`🎯 Contract assigned bet ID: ${createdBetId}`);

            // Update database if contract ID differs
            if (createdBetId !== bet.contractId) {
              logger.warn(`⚠️  Contract ID mismatch: DB=${bet.contractId}, Contract=${createdBetId}`);
              // You may want to update the database here if needed
            }
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (betError) {
          logger.error(`❌ Failed to import bet ${bet.contractId}:`, betError.message);
          // Continue with next bet instead of stopping
        }
      }

      logger.info('🎉 Bet import process completed!');
      return true;

    } catch (error) {
      logger.error('❌ Import process failed:', error);
      throw error;
    }
  }

  async verifyImports() {
    try {
      logger.info('\n🔍 Verifying imports...');

      const databaseBets = await Bet.find({ isActive: true }).sort({ contractId: 1 });
      let successCount = 0;
      let failCount = 0;

      for (const bet of databaseBets) {
        try {
          const contractBet = await this.contract.getBet(bet.contractId);
          if (contractBet && Number(contractBet.id) > 0) {
            logger.info(`✅ Bet ${bet.contractId} verified on contract`);
            successCount++;
          } else {
            logger.error(`❌ Bet ${bet.contractId} NOT found on contract`);
            failCount++;
          }
        } catch (error) {
          logger.error(`❌ Bet ${bet.contractId} verification failed:`, error.message);
          failCount++;
        }
      }

      logger.info(`\n📊 Verification Summary:`);
      logger.info(`✅ Success: ${successCount}`);
      logger.info(`❌ Failed: ${failCount}`);
      logger.info(`📝 Total: ${databaseBets.length}`);

      return { successCount, failCount, total: databaseBets.length };
    } catch (error) {
      logger.error('❌ Verification failed:', error);
      throw error;
    }
  }

  async cleanup() {
    await mongoose.connection.close();
    logger.info('Database connection closed');
  }
}

// Main execution
async function main() {
  const importer = new BetImporter();

  try {
    await importer.initialize();
    await importer.importDatabaseBetsToContract();
    await importer.verifyImports();
  } catch (error) {
    logger.error('Script failed:', error);
    process.exit(1);
  } finally {
    await importer.cleanup();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = BetImporter;