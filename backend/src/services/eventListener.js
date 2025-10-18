const { ethers } = require('ethers');
const mongoose = require('mongoose');
const BetEvent = require('../models/BetEvent');
const fhevmSyncService = require('./fhevmSyncService');
const config = require('../config/fhevm');

class EventListenerService {
  constructor() {
    this.provider = null;
    this.contracts = {};
    this.isListening = false;
    this.latestProcessedBlock = 0;
  }

  async initialize() {
    try {
      console.log('🔗 Initializing FHEVM Event Listener Service...');

      // Initialize provider - Use localhost for development
      this.provider = new ethers.JsonRpcProvider(process.env.LOCALHOST_RPC_URL || 'http://127.0.0.1:8545');

      // Initialize contracts
      await this.initializeContracts();

      // Initialize FHEVM sync service
      await fhevmSyncService.initialize();

      // Get latest processed block from database
      await this.loadLatestProcessedBlock();

      // Start listening to events
      await this.startEventListening();

      // Start periodic sync for missed events
      fhevmSyncService.startPeriodicSync(30000); // Every 30 seconds

      console.log('✅ FHEVM Event Listener Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize FHEVM Event Listener Service:', error);
      throw error;
    }
  }

  async initializeContracts() {
    const BetMarketArtifact = require('../abi/BetMarket.json');
    const BetMarketABI = BetMarketArtifact.abi;

    this.contractAddress = process.env.BET_MARKET_ADDRESS.toLowerCase();
    this.contracts.betMarket = new ethers.Contract(
      this.contractAddress,
      BetMarketABI,
      this.provider
    );

    console.log('📄 Contract initialized:', this.contractAddress);
  }

  async loadLatestProcessedBlock() {
    try {
      const latestEvent = await BetEvent.findOne().sort({ blockNumber: -1 });
      this.latestProcessedBlock = latestEvent ? latestEvent.blockNumber : 0;
      console.log('📊 Latest processed block:', this.latestProcessedBlock);
    } catch (error) {
      console.warn('⚠️ Could not load latest processed block:', error.message);
      this.latestProcessedBlock = 0;
    }
  }

  async startEventListening() {
    if (this.isListening) return;

    console.log('👂 Starting event listening...');
    this.isListening = true;

    // Listen to BetPlaced events
    this.contracts.betMarket.on('BetPlaced', async (betId, user, optionIndex, shares, event) => {
      await this.handleBetPlacedEvent({
        betId: betId.toString(),
        user,
        optionIndex: optionIndex.toString(),
        shares: shares.toString(),
        txHash: event.transactionHash || '0x0000000000000000000000000000000000000000000000000000000000000000',
        blockNumber: event.blockNumber || 0,
        logIndex: event.logIndex || 0,
        timestamp: Date.now()
      });
    });

    // Listen to BetCreated events
    this.contracts.betMarket.on('BetCreated', async (betId, title, categoryId, event) => {
      await this.handleBetCreatedEvent({
        betId: betId.toString(),
        title,
        categoryId: categoryId.toString(),
        txHash: event.transactionHash || '0x0000000000000000000000000000000000000000000000000000000000000000',
        blockNumber: event.blockNumber || 0,
        logIndex: event.logIndex || 0,
        timestamp: Date.now()
      });
    });

    // Listen to BetResolved events
    this.contracts.betMarket.on('BetResolved', async (betId, winnerIndex, event) => {
      await this.handleBetResolvedEvent({
        betId: betId.toString(),
        winnerIndex: winnerIndex.toString(),
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        logIndex: event.logIndex,
        timestamp: Date.now()
      });
    });

    // Listen to WinningsClaimed events
    this.contracts.betMarket.on('WinningsClaimed', async (betId, user, amount, event) => {
      await this.handleWinningsClaimedEvent({
        betId: betId.toString(),
        user,
        amount: amount.toString(),
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        logIndex: event.logIndex,
        timestamp: Date.now()
      });
    });

    console.log('✅ Event listeners registered successfully');
  }

  async handleBetPlacedEvent(eventData) {
    try {
      console.log('🎯 Processing FHEVM BetPlaced event:', eventData);

      // Create bet event record first
      const betEvent = new BetEvent({
        eventType: 'BetPlaced',
        betId: eventData.betId,
        user: eventData.user.toLowerCase(),
        optionIndex: parseInt(eventData.optionIndex),
        shares: parseInt(eventData.shares),
        contractAddress: this.contractAddress,
        txHash: eventData.txHash,
        blockNumber: eventData.blockNumber,
        logIndex: eventData.logIndex,
        timestamp: new Date(eventData.timestamp),
        processed: true
      });

      await betEvent.save();
      console.log('✅ BetPlaced event saved to database');

      // Process through FHEVM sync service
      await fhevmSyncService.processBetPlacedEvent(betEvent);

      // Update latest processed block
      this.latestProcessedBlock = Math.max(this.latestProcessedBlock, eventData.blockNumber);

    } catch (error) {
      console.error('❌ Error processing FHEVM BetPlaced event:', error);
    }
  }

  async handleBetCreatedEvent(eventData) {
    try {
      console.log('🎊 Processing FHEVM BetCreated event:', eventData);

      const betEvent = new BetEvent({
        eventType: 'BetCreated',
        betId: eventData.betId,
        title: eventData.title,
        categoryId: parseInt(eventData.categoryId),
        contractAddress: this.contractAddress,
        txHash: eventData.txHash,
        blockNumber: eventData.blockNumber,
        logIndex: eventData.logIndex,
        timestamp: new Date(eventData.timestamp),
        processed: true
      });

      await betEvent.save();
      console.log('✅ BetCreated event saved to database');

      // Sync bet from contract to database
      await fhevmSyncService.syncBetFromContract(Number(eventData.betId));

      this.latestProcessedBlock = Math.max(this.latestProcessedBlock, eventData.blockNumber);

    } catch (error) {
      console.error('❌ Error processing FHEVM BetCreated event:', error);
    }
  }

  async handleBetResolvedEvent(eventData) {
    try {
      console.log('🏆 Processing FHEVM BetResolved event:', eventData);

      const betEvent = new BetEvent({
        eventType: 'BetResolved',
        betId: eventData.betId,
        winnerIndex: parseInt(eventData.winnerIndex),
        txHash: eventData.txHash,
        blockNumber: eventData.blockNumber,
        logIndex: eventData.logIndex,
        timestamp: new Date(eventData.timestamp),
        processed: true
      });

      await betEvent.save();
      console.log('✅ BetResolved event saved to database');

      // Process through FHEVM sync service
      await fhevmSyncService.processBetResolvedEvent(betEvent);

      this.latestProcessedBlock = Math.max(this.latestProcessedBlock, eventData.blockNumber);

    } catch (error) {
      console.error('❌ Error processing FHEVM BetResolved event:', error);
    }
  }

  async handleWinningsClaimedEvent(eventData) {
    try {
      console.log('💰 Processing WinningsClaimed event:', eventData);

      const betEvent = new BetEvent({
        eventType: 'WinningsClaimed',
        betId: eventData.betId,
        user: eventData.user,
        amount: eventData.amount,
        txHash: eventData.txHash,
        blockNumber: eventData.blockNumber,
        logIndex: eventData.logIndex,
        timestamp: new Date(eventData.timestamp),
        processed: true
      });

      await betEvent.save();
      console.log('✅ WinningsClaimed event saved to database');

      this.latestProcessedBlock = Math.max(this.latestProcessedBlock, eventData.blockNumber);

    } catch (error) {
      console.error('❌ Error processing WinningsClaimed event:', error);
    }
  }

  // Removed getBetDetailsWithDecryption - now handled by fhevmSyncService

  // Process historical events (for initial sync)
  async processHistoricalEvents(fromBlock = 0, toBlock = 'latest') {
    try {
      console.log(`📜 Processing historical events from block ${fromBlock} to ${toBlock}...`);

      const events = await this.contracts.betMarket.queryFilter('*', fromBlock, toBlock);

      for (const event of events) {
        console.log(`🔍 Found event: ${event.event} at block ${event.blockNumber}`);
        console.log(`🔍 Event fragment:`, event.fragment?.name || 'NO_FRAGMENT');
        console.log(`🔍 Event topics:`, event.topics);

        const eventData = {
          txHash: event.transactionHash || '0x0000000000000000000000000000000000000000000000000000000000000000',
          blockNumber: event.blockNumber || 0,
          logIndex: event.logIndex || 0,
          timestamp: Date.now()
        };

        switch (event.fragment?.name) {
          case 'BetPlaced':
            await this.handleBetPlacedEvent({
              ...eventData,
              betId: event.args[0].toString(),
              user: event.args[1],
              optionIndex: event.args[2].toString(),
              shares: event.args[3].toString()
            });
            break;

          case 'BetCreated':
            await this.handleBetCreatedEvent({
              ...eventData,
              betId: event.args[0].toString(),
              title: event.args[1],
              categoryId: event.args[2].toString()
            });
            break;

          case 'BetResolved':
            await this.handleBetResolvedEvent({
              ...eventData,
              betId: event.args[0].toString(),
              winnerIndex: event.args[1].toString()
            });
            break;

          case 'WinningsClaimed':
            await this.handleWinningsClaimedEvent({
              ...eventData,
              betId: event.args[0].toString(),
              user: event.args[1],
              amount: event.args[2].toString()
            });
            break;
        }

        // Add small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`✅ Processed ${events.length} historical events`);

    } catch (error) {
      console.error('❌ Error processing historical events:', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isListening) return;

    console.log('🛑 Stopping FHEVM event listening...');

    // Stop periodic sync
    fhevmSyncService.stopPeriodicSync();

    // Remove all listeners
    this.contracts.betMarket.removeAllListeners();

    this.isListening = false;
    console.log('✅ FHEVM event listening stopped');
  }

  // Get aggregated statistics
  async getBetStatistics(betId) {
    try {
      const betPlacedEvents = await BetEvent.find({
        eventType: 'BetPlaced',
        betId: betId.toString()
      });

      const totalVolume = betPlacedEvents.reduce((sum, event) => sum + (event.actualAmount || 0), 0);
      const totalBets = betPlacedEvents.length;
      const uniqueTraders = new Set(betPlacedEvents.map(event => event.user)).size;

      return {
        totalVolume,
        totalBets,
        uniqueTraders
      };

    } catch (error) {
      console.error('❌ Error getting bet statistics:', error);
      return { totalVolume: 0, totalBets: 0, uniqueTraders: 0 };
    }
  }

  async getUserBetHistory(userAddress) {
    try {
      const userBetEvents = await BetEvent.find({
        eventType: 'BetPlaced',
        user: userAddress.toLowerCase()
      }).sort({ timestamp: -1 });

      return userBetEvents.map(event => ({
        betId: event.betId,
        optionIndex: event.optionIndex,
        shares: event.shares,
        actualAmount: event.actualAmount || 0,
        timestamp: event.timestamp,
        txHash: event.txHash
      }));

    } catch (error) {
      console.error('❌ Error getting user bet history:', error);
      return [];
    }
  }
}

module.exports = new EventListenerService();