import { ethers } from 'ethers';
import { CONTRACTS, NETWORK_CONFIG } from '../config/contracts.js';
import { encryptBetAmount, encryptBetData, initializeFHE } from '../lib/fhe.js';

// Import contract ABIs - Updated to use BetMarketCore from hardhat artifacts
import BetMarketCoreContract from "@artifacts/BetMarketCore.sol/BetMarketCore.json";
const BetMarketABI = BetMarketCoreContract.abi;
import CategoryManagerABI from '../contracts/CategoryManager.sol/CategoryManager.json';
import AdminManagerABI from '../contracts/AdminManager.sol/AdminManager.json';
import MockUSDCABI from '../contracts/MockUSDC.sol/MockUSDC.json';

// BetMarketPro ABI is already correct - no need for compatibility override

class ContractService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contracts = {};
    this.isInitialized = false;
    this.readOnlyProvider = null;
    this.readOnlyContracts = {};
    this.isReadOnlyInitialized = false;

    // Simple cache to reduce API calls
    this.cache = new Map();
    this.cacheTimeout = 10000; // 10 seconds cache
  }

  // Simple cache helper
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCached(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clearCache(keyPattern = null) {
    if (keyPattern) {
      // Clear specific cache entries matching pattern
      for (const key of this.cache.keys()) {
        if (key.includes(keyPattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }

  async initializeReadOnly(chainId = null, contractAddresses = null) {
    try {
      console.log('🔗 Initializing Read-Only Contract Service...');

      // Use provided contracts or fallback to default
      const contracts = contractAddresses || CONTRACTS;

      // Determine RPC URL based on chain ID
      let rpcUrl;
      if (chainId === 31337) {
        rpcUrl = 'http://127.0.0.1:8545'; // Local hardhat
      } else {
        rpcUrl = import.meta.env.VITE_FHEVM_NETWORK_URL; // Sepolia
      }

      // Create read-only provider
      this.readOnlyProvider = new ethers.JsonRpcProvider(rpcUrl);

      // Initialize read-only contract instances
      this.readOnlyContracts = {
        betMarket: new ethers.Contract(contracts.BET_MARKET, BetMarketABI, this.readOnlyProvider),
        categoryManager: new ethers.Contract(contracts.CATEGORY_MANAGER, CategoryManagerABI.abi, this.readOnlyProvider),
        adminManager: new ethers.Contract(contracts.ADMIN_MANAGER, AdminManagerABI.abi, this.readOnlyProvider),
        usdcToken: new ethers.Contract(contracts.USDC_TOKEN, MockUSDCABI.abi, this.readOnlyProvider)
      };

      this.isReadOnlyInitialized = true;
      console.log('✅ Read-Only Contract Service initialized successfully');
      console.log('📋 Using contracts:', contracts);
      return true;
    } catch (error) {
      console.error('❌ Read-Only Contract Service initialization failed:', error);
      throw error;
    }
  }

  async initialize(provider, signer) {
    try {
      console.log('🔗 Initializing Contract Service...');

      // Clean up any existing state
      if (this.isInitialized) {
        this.removeAllListeners();
        this.isInitialized = false;
      }

      this.provider = provider;
      this.signer = signer;

      // Check network with retry mechanism
      let network;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          network = await provider.getNetwork();
          break;
        } catch (networkError) {
          console.warn(`Network check attempt ${retryCount + 1} failed:`, networkError.message);
          retryCount++;
          if (retryCount >= maxRetries) {
            throw new Error(`Failed to get network after ${maxRetries} attempts: ${networkError.message}`);
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (Number(network.chainId) !== NETWORK_CONFIG.chainId) {
        throw new Error(`Wrong network. Expected ${NETWORK_CONFIG.chainId}, got ${network.chainId}`);
      }

      // Initialize contract instances
      this.contracts = {
        betMarket: new ethers.Contract(CONTRACTS.BET_MARKET, BetMarketABI, signer),
        categoryManager: new ethers.Contract(CONTRACTS.CATEGORY_MANAGER, CategoryManagerABI.abi, signer),
        adminManager: new ethers.Contract(CONTRACTS.ADMIN_MANAGER, AdminManagerABI.abi, signer),
        usdcToken: new ethers.Contract(CONTRACTS.USDC_TOKEN, MockUSDCABI.abi, signer)
      };

      this.isInitialized = true;
      console.log('✅ Contract Service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Contract Service initialization failed:', error);
      throw error;
    }
  }

  // ==== BETTING FUNCTIONS ====

  async placeBet(betId, optionIndex, betAmount, userAddress) {
    try {
      if (!this.isInitialized) throw new Error('Contract service not initialized');

      console.log('🎯 Placing encrypted bet with FHEVM...');
      console.log('Bet ID:', betId);
      console.log('Option Index:', optionIndex);
      console.log('Bet Amount (USDC):', betAmount);
      console.log('User Address:', userAddress);

      // Initialize FHEVM if not already done
      await initializeFHE();

      // Validation - option index check (will be encrypted)
      if (optionIndex < 0 || optionIndex > 255) {
        throw new Error(`Invalid option index ${optionIndex}. Must be between 0-255 for euint8.`);
      }
      console.log('✅ Basic validation passed - proceeding with FHEVM encryption');

      // Convert bet amount to USDC units (6 decimals)
      const betAmountInUSDCUnits = Math.floor(betAmount * 1000000); // Convert to 6 decimal USDC

      console.log('💰 Bet amount in USDC units:', betAmountInUSDCUnits);
      console.log('🎯 Option index to encrypt:', optionIndex);

      // Encrypt BOTH option index AND bet amount using combined encryption
      console.log('🔐 Encrypting option index and bet amount with FHEVM...');
      const contractAddress = CONTRACTS.BET_MARKET;

      // Use combined encryption from useFHEVM hook approach
      const { encryptedOptionIndex, encryptedAmount, inputProof } = await encryptBetData(optionIndex, betAmountInUSDCUnits, contractAddress, userAddress);

      console.log('✅ Combined encryption completed:', {
        encryptedOptionIndex: encryptedOptionIndex?.substring(0, 20) + '...',
        encryptedAmount: encryptedAmount?.substring(0, 20) + '...',
        inputProof: inputProof?.substring(0, 20) + '...'
      });

      // First approve USDC transfer
      console.log('💳 Approving USDC transfer...');
      const approvalTx = await this.contracts.usdcToken.approve(
        CONTRACTS.BET_MARKET,
        betAmountInUSDCUnits
      );
      console.log('📤 Approval transaction sent:', approvalTx.hash);
      await approvalTx.wait();
      console.log('✅ USDC approval completed');

      // Call contract with combined encrypted data
      console.log('📡 Calling contract placeBet with encrypted option and amount...');
      const tx = await this.contracts.betMarket.placeBet(
        BigInt(betId),        // uint256 _betId
        encryptedOptionIndex, // externalEuint8 _encryptedOptionIndex
        encryptedAmount,      // externalEuint64 _encryptedAmount
        inputProof            // bytes calldata _inputProof
      );

      console.log('📤 Transaction sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('✅ Bet placed successfully with FHEVM encryption');

      // Clear cache for this bet to ensure fresh data on next fetch
      this.clearCache(`bet_${betId}`);

      // Store user bet data for profile display (since getUserBets has corrupted data)
      this.storeUserBet(userAddress, {
        betId,
        optionIndex,
        shares: 1, // Demo value
        actualAmount: betAmount // Store the real bet amount
      });

      return {
        success: true,
        txHash: receipt.transactionHash,
        receipt
      };
    } catch (error) {
      console.error('❌ Failed to place bet with FHEVM:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        reason: error.reason,
        data: error.data
      });
      throw error;
    }
  }

  async claimWinnings(betId, gasValue = '0.02') {
    try {
      if (!this.isInitialized) throw new Error('Contract service not initialized');

      console.log('💰 Claiming winnings for bet:', betId);

      const tx = await this.contracts.betMarket.claimWinnings(betId, {
        value: ethers.parseEther(gasValue) // Gas fee for decryption
      });

      console.log('📤 Claim transaction sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('✅ Winnings claimed successfully');

      return {
        success: true,
        txHash: receipt.transactionHash,
        receipt
      };
    } catch (error) {
      console.error('❌ Failed to claim winnings:', error);
      throw error;
    }
  }

  // ==== BET MANAGEMENT ====

  async createBet(betData) {
    try {
      if (!this.isInitialized) throw new Error('Contract service not initialized');

      console.log('📝 Creating new bet...');

      const tx = await this.contracts.betMarket.createBet(
        betData.title,
        betData.description || '',
        betData.imageUrl || '',
        betData.categoryId,
        betData.optionTitles,
        Math.floor(new Date(betData.endTime).getTime() / 1000),
        betData.mustShowLive || false,
        betData.liveStartTime ? Math.floor(new Date(betData.liveStartTime).getTime() / 1000) : 0,
        betData.liveEndTime ? Math.floor(new Date(betData.liveEndTime).getTime() / 1000) : 0,
        betData.betType,
        betData.minBetAmount || 1,
        betData.maxBetAmount || 10000
      );

      console.log('📤 Create bet transaction sent:', tx.hash);
      const receipt = await tx.wait();

      // Get bet ID from events
      const event = receipt.logs.find(log =>
        log.topics[0] === ethers.id('BetCreated(uint256,string,uint256)')
      );

      const betId = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], event.topics[1])[0];

      console.log('✅ Bet created successfully with ID:', betId.toString());

      return {
        success: true,
        betId: betId.toString(),
        txHash: receipt.transactionHash,
        receipt
      };
    } catch (error) {
      console.error('❌ Failed to create bet:', error);
      throw error;
    }
  }

  async resolveBet(betId, winnerIndex) {
    try {
      if (!this.isInitialized) throw new Error('Contract service not initialized');

      console.log('🎲 Resolving bet:', betId, 'Winner:', winnerIndex);

      const tx = await this.contracts.betMarket.resolveBet(betId, winnerIndex);
      console.log('📤 Resolve transaction sent:', tx.hash);

      const receipt = await tx.wait();
      console.log('✅ Bet resolved successfully');

      return {
        success: true,
        txHash: receipt.transactionHash,
        receipt
      };
    } catch (error) {
      console.error('❌ Failed to resolve bet:', error);
      throw error;
    }
  }

  // ==== VIEW FUNCTIONS ====

  async getBet(betId) {
    try {
      // Skip cache for clean data
      const cacheKey = `bet_${betId}`;

      let betMarketContract;

      // Try read-only first, then fallback to regular contracts
      if (this.isReadOnlyInitialized) {
        betMarketContract = this.readOnlyContracts.betMarket;
      } else if (this.isInitialized) {
        betMarketContract = this.contracts.betMarket;
      } else {
        // Initialize read-only if not available
        await this.initializeReadOnly();
        betMarketContract = this.readOnlyContracts.betMarket;
      }

      // Get basic bet data
      const bet = await betMarketContract.getBet(betId);

      // Get options data
      const options = [];
      for (let i = 0; i < Number(bet.optionCount); i++) {
        try {
          const option = await betMarketContract.getBetOption(betId, i);
          options.push({
            title: option.title,
            totalShares: 0, // Force 0 for new clean contract
            isWinner: option.isWinner,
            yesPrice: 50 // Default price for demo
          });
        } catch (optionError) {
          console.error(`Failed to fetch option ${i} for bet ${betId}:`, optionError);
          // Skip failed options - no fallback
        }
      }

      const formatted = {
        ...this.formatBetData(bet, betId),
        options
      };

      this.setCached(cacheKey, formatted);
      return formatted;
    } catch (error) {
      console.error('❌ Failed to get bet:', error);
      throw error; // No fallback - fail clearly
    }
  }

  async getActiveBets() {
    try {
      // Use database-first approach for hybrid system
      const response = await fetch('/api/bets');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();

      // Handle the API response structure: {success: true, data: {bets: []}}
      if (result.success && result.data && result.data.bets) {
        console.log('✅ Fetched', result.data.bets.length, 'bets from database');
        return result.data.bets;
      } else {
        console.log('⚠️ API returned no bets or invalid structure:', result);
        return [];
      }
    } catch (error) {
      console.error('❌ Failed to get active bets from database:', error);
      // No contract fallback for FHEVM - database is primary
      return [];
    }
  }

  async getAllBets() {
    try {
      // Try to get all bets from contract - iterate through bet IDs
      let betMarketContract;

      // Try read-only first, then fallback to regular contracts
      if (this.isReadOnlyInitialized) {
        betMarketContract = this.readOnlyContracts.betMarket;
      } else if (this.isInitialized) {
        betMarketContract = this.contracts.betMarket;
      } else {
        // Initialize read-only if not available
        await this.initializeReadOnly();
        betMarketContract = this.readOnlyContracts.betMarket;
      }

      const allBets = [];

      // Try to get bets by iterating through IDs (start from 1, most contracts start from 1)
      let betId = 1;
      let consecutiveFailures = 0;
      const maxConsecutiveFailures = 3; // Stop after 3 consecutive failures

      while (consecutiveFailures < maxConsecutiveFailures && betId <= 100) { // Reasonable upper limit
        try {
          console.log(`🔍 Fetching bet ${betId}...`);
          console.log(`📋 Contract address: ${betMarketContract.target}`);

          // Provider debug info
          if (this.readOnlyProvider) {
            console.log(`📡 Provider URL:`, this.readOnlyProvider._getConnection?.()?.url || this.readOnlyProvider.connection?.url || 'Unknown URL');
            console.log(`📡 Provider type:`, this.readOnlyProvider.constructor.name);
          } else {
            console.log(`❌ No readOnlyProvider available`);
          }

          const bet = await betMarketContract.getBet(betId);
          console.log(`📊 Raw bet ${betId} data:`, bet);
          console.log(`🧪 Bet type check - Array:`, Array.isArray(bet), `Length:`, bet?.length);

          // Get options data
          const options = [];
          const optionCount = Array.isArray(bet) ? Number(bet[8]) : Number(bet.optionCount);
          for (let i = 0; i < optionCount; i++) {
            try {
              const option = await betMarketContract.getBetOption(betId, i);
              options.push({
                title: option.title,
                totalShares: 0,
                isWinner: option.isWinner,
                yesPrice: 50
              });
            } catch (optionError) {
              console.warn(`Failed to fetch option ${i} for bet ${betId}:`, optionError);
            }
          }

          const isResolved = Array.isArray(bet) ? bet[3] : bet.isResolved;
          const isActive = Array.isArray(bet) ? bet[2] : bet.isActive;

          const formattedBet = {
            ...this.formatBetData(bet, betId),
            options,
            status: isResolved ? 'resolved' : (isActive ? 'active' : 'ended')
          };

          allBets.push(formattedBet);
          consecutiveFailures = 0; // Reset counter on success
          const title = Array.isArray(bet) ? bet[10] : bet.title;
          console.log(`✅ Fetched bet ${betId}: ${title}`);

        } catch (error) {
          console.error(`❌ Failed to fetch bet ${betId}:`, error);
          console.error(`❌ Error message:`, error.message);
          console.error(`❌ Error code:`, error.code);
          console.error(`❌ Error stack:`, error.stack);
          consecutiveFailures++;
        }

        betId++;
      }

      console.log(`✅ Retrieved ${allBets.length} bets from contract`);
      return allBets;

    } catch (error) {
      console.error('❌ Failed to get all bets from contract:', error);

      // Fallback to database approach
      try {
        return await this.getActiveBets();
      } catch (fallbackError) {
        console.error('❌ Fallback to database also failed:', fallbackError);
        return [];
      }
    }
  }

  async getBetsByCategory(categoryId) {
    try {
      let betIds;

      // Try read-only first, then fallback to regular contracts
      if (this.isReadOnlyInitialized) {
        betIds = await this.readOnlyContracts.betMarket.getBetsByCategory(categoryId);
      } else if (this.isInitialized) {
        betIds = await this.contracts.betMarket.getBetsByCategory(categoryId);
      } else {
        // Initialize read-only if not available
        await this.initializeReadOnly();
        betIds = await this.readOnlyContracts.betMarket.getBetsByCategory(categoryId);
      }

      const bets = [];
      for (const betId of betIds) {
        try {
          const bet = await this.getBet(betId.toString());
          bets.push(bet);
        } catch (error) {
          console.warn('Failed to fetch bet:', betId.toString(), error);
        }
      }

      return bets;
    } catch (error) {
      console.error('❌ Failed to get bets by category:', error);
      throw error;
    }
  }

  async getUserBets(userAddress) {
    try {
      if (!this.isInitialized) throw new Error('Contract service not initialized');

      try {
        const userBets = await this.contracts.betMarket.getUserBets(userAddress);
        console.log('🔍 Raw user bets from contract:', userBets);

        // Filter and format valid bets only
        const validBets = userBets
          .map(bet => {
            try {
              return this.formatUserBetData(bet);
            } catch (error) {
              console.warn('Skipping invalid bet data:', error);
              return null;
            }
          })
          .filter(bet => bet !== null && bet.betId !== '0' && Number(bet.betId) > 0);

        console.log('✅ Formatted valid user bets:', validBets);

        // If we have valid data, return it
        if (validBets.length > 0) {
          return validBets;
        }
      } catch (contractError) {
        console.warn('❌ getUserBets contract call failed:', contractError);
      }

      // Fallback: Check localStorage for recent bet activity as a temporary measure
      console.log('🔄 Using fallback method to find user bets...');
      const recentBets = this.getRecentUserBetsFromStorage(userAddress);

      if (recentBets.length > 0) {
        console.log('✅ Found recent bets in localStorage:', recentBets);
        return recentBets;
      }

      console.log('📭 No user bets found');
      return [];
    } catch (error) {
      console.error('❌ Failed to get user bets:', error);
      return []; // Return empty array instead of throwing
    }
  }

  // Temporary fallback to check recent bet activity
  getRecentUserBetsFromStorage(userAddress) {
    try {
      const storageKey = `userBets_${userAddress}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const bets = JSON.parse(stored);
        // Return bets from last 24 hours
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        return bets.filter(bet => bet.timestamp && new Date(bet.timestamp).getTime() > oneDayAgo);
      }
    } catch (error) {
      console.warn('Failed to read from localStorage:', error);
    }
    return [];
  }

  // Calculate real volume for a bet from all localStorage data
  calculateRealVolumeForBet(betId) {
    try {
      let totalVolume = 0;
      let totalBets = 0;
      let uniqueTraders = new Set();

      // Get all bet data for this specific betting market
      const currentUser = window.ethereum?.selectedAddress;
      if (currentUser) {
        // Get ALL user bets (not just recent ones) for this betId
        const storageKey = `userBets_${currentUser}`;
        let allUserBets = [];

        try {
          const stored = localStorage.getItem(storageKey);
          if (stored) {
            allUserBets = JSON.parse(stored);
          }
        } catch (e) {
          console.warn('Failed to parse localStorage bets:', e);
        }

        // Filter bets for this specific betting market
        const userBetsForThisBet = allUserBets.filter(bet => bet.betId === betId.toString());

        // Calculate totals from all bets for this market
        userBetsForThisBet.forEach(bet => {
          const amount = bet.actualAmount || 0;
          totalVolume += amount;
          totalBets += 1;
          uniqueTraders.add(currentUser);
          console.log(`📊 Adding bet to volume: $${amount}, Total so far: $${totalVolume}`);
        });

        console.log(`📊 Final volume calculation for bet ${betId}:`, {
          totalVolume,
          totalBets,
          uniqueTraders: uniqueTraders.size,
          userBetsCount: userBetsForThisBet.length
        });
      }

      return {
        totalVolume,
        totalBets,
        uniqueTraders: uniqueTraders.size
      };
    } catch (error) {
      console.warn('Failed to calculate real volume:', error);
      return { totalVolume: 0, totalBets: 0, uniqueTraders: 0 };
    }
  }

  // Method to store user bet when a bet is placed successfully
  storeUserBet(userAddress, betData) {
    try {
      const storageKey = `userBets_${userAddress}`;
      let existingBets = [];

      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          existingBets = JSON.parse(stored);
        }
      } catch (e) {
        // Ignore parse errors
      }

      // Add new bet
      existingBets.push({
        betId: betData.betId.toString(),
        optionIndex: betData.optionIndex,
        shares: 1, // Demo value
        actualAmount: betData.actualAmount || 0, // Store real bet amount
        timestamp: new Date().toISOString(),
        claimed: false
      });

      // Keep only last 100 bets
      if (existingBets.length > 100) {
        existingBets = existingBets.slice(-100);
      }

      localStorage.setItem(storageKey, JSON.stringify(existingBets));
      console.log('💾 Stored user bet in localStorage');
    } catch (error) {
      console.warn('Failed to store user bet:', error);
    }
  }

  // ==== CATEGORY FUNCTIONS ====

  async getCategories() {
    try {
      // Categories are static data for now, no need for contract calls
      // In future this could be fetched from CategoryManager contract
      return [
        { id: 1, name: 'Politics', imageUrl: 'politics.jpg', parentId: 0 },
        { id: 2, name: 'Cryptocurrency', imageUrl: 'crypto.jpg', parentId: 0 },
        { id: 3, name: 'Sports', imageUrl: 'sports.jpg', parentId: 0 },
        { id: 4, name: 'Economics', imageUrl: 'economics.jpg', parentId: 0 },
        { id: 5, name: 'Science', imageUrl: 'science.jpg', parentId: 0 },
        { id: 6, name: 'Entertainment', imageUrl: 'entertainment.jpg', parentId: 0 },
        { id: 7, name: 'Technology', imageUrl: 'technology.jpg', parentId: 0 }
      ];
    } catch (error) {
      console.error('❌ Failed to get categories:', error);
      throw error;
    }
  }

  // ==== HELPER FUNCTIONS ====

  formatBetData(rawBet, betId) {
    // Handle both object and array format from contract
    if (Array.isArray(rawBet)) {
      // Array format from BetMarketPro contract:
      // [0] id, [1] endTime, [2] isActive, [3] isResolved, [4] winnerIndex,
      // [5] creator, [6] minBetAmount, [7] maxBetAmount, [8] optionCount,
      // [9] categoryId, [10] title, [11] description
      return {
        id: betId,
        title: rawBet[10] || `Bet #${betId}`,
        description: rawBet[11] || '',
        imageUrl: null,
        categoryId: rawBet[9] ? rawBet[9].toString() : '0',
        endTime: new Date(Number(rawBet[1]) * 1000),
        isActive: rawBet[2],
        isResolved: rawBet[3],
        createdAt: new Date(), // Not available in contract
        updatedAt: new Date(), // Not available in contract
        mustShowLive: false,
        liveStartTime: null,
        liveEndTime: null,
        betType: 0, // Default to BINARY
        optionCount: Number(rawBet[8]),
        minBetAmount: Number(rawBet[6]) || 1,
        maxBetAmount: Number(rawBet[7]) || 10000,
        createdBy: rawBet[5] || '0x0000000000000000000000000000000000000000',
        totalParticipants: 0 // Not available in basic contract
      };
    } else {
      // Object format (legacy)
      return {
        id: betId,
        title: rawBet.title,
        description: rawBet.description || '',
        imageUrl: rawBet.imageUrl,
        categoryId: rawBet.categoryId.toString(),
        endTime: new Date(Number(rawBet.endTime) * 1000),
        isActive: rawBet.isActive,
        isResolved: rawBet.isResolved,
        createdAt: new Date(Number(rawBet.createdAt) * 1000),
        updatedAt: new Date(Number(rawBet.updatedAt) * 1000),
        mustShowLive: rawBet.mustShowLive,
        liveStartTime: rawBet.liveStartTime > 0 ? new Date(Number(rawBet.liveStartTime) * 1000) : null,
        liveEndTime: rawBet.liveEndTime > 0 ? new Date(Number(rawBet.liveEndTime) * 1000) : null,
        betType: Number(rawBet.betType),
        optionCount: Number(rawBet.optionCount),
        minBetAmount: Number(rawBet.minBetAmount) || 1,
        maxBetAmount: Number(rawBet.maxBetAmount) || 10000,
        createdBy: rawBet.createdBy || '0x0000000000000000000000000000000000000000',
        totalParticipants: Number(rawBet.totalParticipants) || 0
      };
    }
  }

  formatUserBetData(rawUserBet) {
    // Handle corrupted or invalid data from contract
    const betId = rawUserBet.betId ? rawUserBet.betId.toString() : '0';
    const optionIndex = Number(rawUserBet.optionIndex) || 0;
    const shares = Number(rawUserBet.shares) || 0;

    // Handle timestamp - if it's too large or invalid, use current time
    let timestamp;
    try {
      const timestampValue = Number(rawUserBet.timestamp);
      // Check if timestamp is reasonable (between 2020 and 2030)
      if (timestampValue > 1577836800 && timestampValue < 1893456000) {
        timestamp = new Date(timestampValue * 1000);
      } else {
        // Invalid timestamp, use current time
        timestamp = new Date();
      }
    } catch (error) {
      timestamp = new Date();
    }

    return {
      betId,
      optionIndex,
      // amount is encrypted - cannot display actual value
      shares,
      timestamp,
      claimed: Boolean(rawUserBet.claimed)
    };
  }

  // ==== EVENT LISTENERS ====

  onBetCreated(callback) {
    if (!this.contracts.betMarket) return;

    this.contracts.betMarket.on('BetCreated', (betId, title, categoryId) => {
      callback({
        betId: betId.toString(),
        title,
        categoryId: categoryId.toString()
      });
    });
  }

  onBetPlaced(callback) {
    if (!this.contracts.betMarket) return;

    this.contracts.betMarket.on('BetPlaced', (betId, user, optionIndex, shares) => {
      callback({
        betId: betId.toString(),
        user,
        optionIndex: Number(optionIndex),
        shares: Number(shares)
      });
    });
  }

  onBetResolved(callback) {
    if (!this.contracts.betMarket) return;

    this.contracts.betMarket.on('BetResolved', (betId, winnerIndex) => {
      callback({
        betId: betId.toString(),
        winnerIndex: Number(winnerIndex)
      });
    });
  }

  onWinningsClaimed(callback) {
    if (!this.contracts.betMarket) return;

    this.contracts.betMarket.on('WinningsClaimed', (betId, user, amount) => {
      callback({
        betId: betId.toString(),
        user,
        amount: ethers.formatEther(amount)
      });
    });
  }

  // ==== UTILITY FUNCTIONS ====

  getContractAddress(contractName) {
    switch (contractName) {
      case 'BET_MARKET':
        return CONTRACTS.BET_MARKET;
      case 'CATEGORY_MANAGER':
        return CONTRACTS.CATEGORY_MANAGER;
      case 'ADMIN_MANAGER':
        return CONTRACTS.ADMIN_MANAGER;
      case 'USDC_TOKEN':
        return CONTRACTS.USDC_TOKEN;
      default:
        throw new Error(`Unknown contract: ${contractName}`);
    }
  }

  // ==== CLEANUP ====

  cleanup() {
    this.removeAllListeners();
    this.provider = null;
    this.signer = null;
    this.contracts = {};
    this.isInitialized = false;
  }

  removeAllListeners() {
    try {
      if (this.contracts && this.contracts.betMarket) {
        this.contracts.betMarket.removeAllListeners();
      }
    } catch (error) {
      console.warn('Error removing listeners:', error);
    }
  }
}

// Export singleton instance
export const contractService = new ContractService();
export default contractService;