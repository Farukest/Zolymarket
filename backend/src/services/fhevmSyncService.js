const { ethers } = require('ethers');
const mongoose = require('mongoose');
const Bet = require('../models/Bet');
const UserPosition = require('../models/UserPosition');
const BetEvent = require('../models/BetEvent');
const fhevmAggregationService = require('./fhevmAggregationService');

/**
 * FHEVM-aware synchronization service
 * Syncs contract state with database while preserving FHEVM encryption
 */
class FHEVMSyncService {
  constructor() {
    this.provider = null;
    this.betMarketContract = null;
    this.isInitialized = false;
    this.syncingBets = new Set();
  }

  async initialize() {
    try {
      console.log('🔐 Initializing FHEVM Sync Service...');

      // Initialize provider
      this.provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

      // Initialize contract
      const BetMarketArtifact = require('../abi/BetMarket.json');
      this.betMarketContract = new ethers.Contract(
        process.env.BET_MARKET_ADDRESS,
        BetMarketArtifact.abi,
        this.provider
      );

      // Initialize aggregation service
      await fhevmAggregationService.initialize();

      this.isInitialized = true;
      console.log('✅ FHEVM Sync Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize FHEVM Sync Service:', error);
      throw error;
    }
  }

  /**
   * Sync a specific bet from contract to database
   */
  async syncBetFromContract(contractBetId) {
    if (this.syncingBets.has(contractBetId)) {
      console.log(`⏳ Bet ${contractBetId} already syncing, skipping...`);
      return;
    }

    this.syncingBets.add(contractBetId);

    try {
      console.log(`🔄 Syncing bet ${contractBetId} from contract...`);

      // Get bet data from contract
      const contractBet = await this.betMarketContract.getBet(contractBetId);

      // Find or create bet in database
      let dbBet = await Bet.findOne({ contractId: contractBetId });

      if (!dbBet) {
        // Create new bet
        dbBet = await this.createBetFromContract(contractBetId, contractBet);
      } else {
        // Update existing bet
        await this.updateBetFromContract(dbBet, contractBet);
      }

      // Sync user positions for this bet
      await this.syncUserPositionsForBet(contractBetId);

      console.log(`✅ Bet ${contractBetId} synced successfully`);

    } catch (error) {
      console.error(`❌ Error syncing bet ${contractBetId}:`, error);
      throw error;
    } finally {
      this.syncingBets.delete(contractBetId);
    }
  }

  /**
   * Create new bet from contract data
   */
  async createBetFromContract(contractBetId, contractBet) {
    console.log(`🆕 Creating new bet ${contractBetId} from contract...`);

    // Prepare options array
    const options = [];
    for (let i = 0; i < Number(contractBet.optionCount); i++) {
      const optionData = await this.betMarketContract.getBetOption(contractBetId, i);

      options.push({
        title: `Option ${i + 1}`, // Default title - admin can edit
        description: '',
        currentPrice: 50, // Default price
        isWinner: optionData.isWinner,
        encryptedTotalAmount: optionData.totalAmount.toString(),
        publicTotalShares: Number(optionData.totalShares)
      });
    }

    const newBet = new Bet({
      contractId: contractBetId,
      contractAddress: process.env.BET_MARKET_ADDRESS.toLowerCase(),

      // Presentation data (admin can edit these)
      title: `Bet #${contractBetId}`, // Default title
      description: 'No description provided', // Default description
      categoryId: 'general', // Default category
      imageUrl: '',
      featured: false,
      priority: 0,
      visibility: 'public',

      // Contract state (immutable)
      endTime: new Date(Number(contractBet.endTime) * 1000),
      isActive: contractBet.isActive,
      isResolved: contractBet.isResolved,
      betType: Number(contractBet.betType),
      createdBy: contractBet.createdBy.toLowerCase(),
      totalParticipants: Number(contractBet.totalParticipants),
      minBetAmount: Number(contractBet.minBetAmount),
      maxBetAmount: Number(contractBet.maxBetAmount),

      // Options
      options,

      // FHEVM configuration
      useFHEVM: true,
      encryptionMetadata: {
        aclAddress: '0x2Fb4341027eb1d2aD8B5D9708187df8633cAFA92',
        kmsAddress: '0x596E6682c72946AF006B27C131793F2B62527A4B',
        chainId: 8009,
        encryptionVersion: '0.5.0'
      },

      // Sync metadata
      lastSyncBlock: await this.provider.getBlockNumber(),
      syncStatus: 'synced',
      lastSyncAt: new Date()
    });

    await newBet.save();
    console.log(`✅ Created bet ${contractBetId} in database`);

    return newBet;
  }

  /**
   * Update existing bet from contract data
   */
  async updateBetFromContract(dbBet, contractBet) {
    console.log(`🔄 Updating bet ${dbBet.contractId} from contract...`);

    // Update contract state (preserve presentation data)
    dbBet.endTime = new Date(Number(contractBet.endTime) * 1000);
    dbBet.isActive = contractBet.isActive;
    dbBet.isResolved = contractBet.isResolved;
    dbBet.totalParticipants = Number(contractBet.totalParticipants);

    // Update options with contract data
    for (let i = 0; i < Number(contractBet.optionCount); i++) {
      const optionData = await this.betMarketContract.getBetOption(dbBet.contractId, i);

      if (dbBet.options[i]) {
        // Update existing option
        dbBet.options[i].isWinner = optionData.isWinner;
        dbBet.options[i].encryptedTotalAmount = optionData.totalAmount.toString();
        dbBet.options[i].publicTotalShares = Number(optionData.totalShares);
      } else {
        // Add new option
        dbBet.options.push({
          title: `Option ${i + 1}`,
          description: '',
          currentPrice: 50,
          isWinner: optionData.isWinner,
          encryptedTotalAmount: optionData.totalAmount.toString(),
          publicTotalShares: Number(optionData.totalShares)
        });
      }
    }

    // Update sync metadata
    dbBet.lastSyncBlock = await this.provider.getBlockNumber();
    dbBet.syncStatus = 'synced';
    dbBet.lastSyncAt = new Date();

    await dbBet.save();
    console.log(`✅ Updated bet ${dbBet.contractId} in database`);
  }

  /**
   * Sync user positions for a specific bet
   */
  async syncUserPositionsForBet(contractBetId) {
    try {
      console.log(`👥 Syncing user positions for bet ${contractBetId}...`);

      // Get all BetPlaced events for this bet
      const betPlacedEvents = await BetEvent.find({
        eventType: 'BetPlaced',
        betId: contractBetId.toString(),
        processed: true
      }).sort({ blockNumber: 1 });

      console.log(`📊 Found ${betPlacedEvents.length} BetPlaced events for bet ${contractBetId}`);

      for (const event of betPlacedEvents) {
        await this.syncUserPosition(event);
      }

      console.log(`✅ Synced user positions for bet ${contractBetId}`);

    } catch (error) {
      console.error(`❌ Error syncing user positions for bet ${contractBetId}:`, error);
    }
  }

  /**
   * Sync individual user position from event
   */
  async syncUserPosition(betEvent) {
    try {
      // Check if position already exists
      const existingPosition = await UserPosition.findOne({
        contractBetId: Number(betEvent.betId),
        userAddress: betEvent.user.toLowerCase(),
        placeBetTxHash: betEvent.txHash
      });

      if (existingPosition) {
        console.log(`⏭️ Position already exists for user ${betEvent.user} in bet ${betEvent.betId}`);
        return;
      }

      // Find the database bet
      const dbBet = await Bet.findOne({ contractId: Number(betEvent.betId) });
      if (!dbBet) {
        console.error(`❌ Database bet not found for contract bet ${betEvent.betId}`);
        return;
      }

      // Get user bet details from contract
      const userBets = await this.betMarketContract.getUserBets(betEvent.user);
      const relevantBet = userBets.find(bet =>
        bet.betId.toString() === betEvent.betId.toString()
      );

      if (!relevantBet) {
        console.error(`❌ User bet not found in contract for ${betEvent.user} in bet ${betEvent.betId}`);
        return;
      }

      // Create new user position
      const userPosition = new UserPosition({
        betId: dbBet._id,
        contractBetId: Number(betEvent.betId),
        userId: null, // Will be set when user registers
        userAddress: betEvent.user.toLowerCase(),
        optionIndex: Number(betEvent.optionIndex),

        // FHEVM encrypted data
        isEncrypted: true,
        encryptedAmount: relevantBet.amount.toString(),
        encryptedShares: betEvent.shares.toString(),

        // Public metadata
        entryPrice: this.calculateEntryPrice(betEvent.shares, betEvent.actualAmount || 0),

        // Transaction data
        placeBetTxHash: betEvent.txHash,
        blockNumber: betEvent.blockNumber,

        // Status
        status: 'active',
        isResolved: dbBet.isResolved,

        // Sync data
        lastSyncBlock: betEvent.blockNumber,
        syncStatus: 'synced'
      });

      await userPosition.save();
      console.log(`✅ Created user position for ${betEvent.user} in bet ${betEvent.betId}`);

      // Update aggregated data for the bet
      await fhevmAggregationService.updateBetAggregatedData(Number(betEvent.betId));

    } catch (error) {
      console.error(`❌ Error syncing user position:`, error);
    }
  }

  /**
   * Calculate entry price based on shares and amount
   */
  calculateEntryPrice(shares, amount) {
    if (!shares || !amount || amount === 0) return 50; // Default price

    // Simple calculation - in production this would be more sophisticated
    const price = (amount / shares) * 100;
    return Math.max(1, Math.min(99, price)); // Clamp between 1-99
  }

  /**
   * Process BetPlaced event and update database
   */
  async processBetPlacedEvent(eventData) {
    try {
      console.log('🎯 Processing FHEVM BetPlaced event:', eventData);

      // Ensure bet exists in database
      await this.syncBetFromContract(Number(eventData.betId));

      // Create or update user position
      await this.syncUserPosition(eventData);

      console.log('✅ FHEVM BetPlaced event processed successfully');

    } catch (error) {
      console.error('❌ Error processing FHEVM BetPlaced event:', error);
      throw error;
    }
  }

  /**
   * Process BetResolved event and update database
   */
  async processBetResolvedEvent(eventData) {
    try {
      console.log('🏆 Processing FHEVM BetResolved event:', eventData);

      // Sync bet resolution
      await this.syncBetFromContract(Number(eventData.betId));

      // Update all user positions for this bet
      await this.updateUserPositionsOnResolution(Number(eventData.betId), Number(eventData.winnerIndex));

      // Update aggregated data after resolution
      await fhevmAggregationService.updateBetAggregatedData(Number(eventData.betId));

      console.log('✅ FHEVM BetResolved event processed successfully');

    } catch (error) {
      console.error('❌ Error processing FHEVM BetResolved event:', error);
      throw error;
    }
  }

  /**
   * Update user positions when bet is resolved
   */
  async updateUserPositionsOnResolution(contractBetId, winnerIndex) {
    try {
      const positions = await UserPosition.find({ contractBetId });

      for (const position of positions) {
        position.isResolved = true;
        position.isWinner = position.optionIndex === winnerIndex;
        position.status = position.isWinner ? 'resolved' : 'resolved';

        await position.save();
      }

      console.log(`✅ Updated ${positions.length} positions for resolved bet ${contractBetId}`);

    } catch (error) {
      console.error(`❌ Error updating positions for resolved bet ${contractBetId}:`, error);
    }
  }

  // Removed updateBetStatistics - now handled by fhevmAggregationService

  /**
   * Sync all bets that need synchronization
   */
  async syncPendingBets() {
    try {
      const pendingBets = await Bet.getBetsRequiringSync();

      console.log(`🔄 Found ${pendingBets.length} bets requiring sync`);

      for (const bet of pendingBets) {
        await this.syncBetFromContract(bet.contractId);

        // Add delay to prevent overwhelming the RPC
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('✅ Completed syncing pending bets');

    } catch (error) {
      console.error('❌ Error syncing pending bets:', error);
    }
  }

  /**
   * Start periodic sync
   */
  startPeriodicSync(intervalMs = 60000) { // Default: 1 minute
    console.log(`⏰ Starting periodic sync every ${intervalMs}ms`);

    this.syncInterval = setInterval(async () => {
      try {
        await this.syncPendingBets();
      } catch (error) {
        console.error('❌ Error in periodic sync:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️ Stopped periodic sync');
    }
  }
}

module.exports = new FHEVMSyncService();