const { ethers } = require('ethers');
const { logger } = require('../utils/logger');

class ContractService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contracts = {};
    this.initialized = false;
  }

  // Initialize the service
  async initialize() {
    try {
      // Setup provider
      this.provider = new ethers.JsonRpcProvider(
        process.env.SEPOLIA_RPC_URL,
      );

      // Setup signer
      if (process.env.PRIVATE_KEY) {
        this.signer = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
      } else {
        throw new Error('Private key not configured');
      }

      // Initialize contracts
      await this.initializeContracts();

      this.initialized = true;
      logger.info('Contract service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize contract service:', error);
      throw error;
    }
  }

  // Initialize contract instances
  async initializeContracts() {
    const contracts = {
      BetMarket: {
        address: process.env.BET_MARKET_ADDRESS,
        abi: [
          'function createBet(string memory _title, string memory _imageUrl, uint256 _categoryId, string[] memory _optionTitles, uint256 _endTime, bool _mustShowLive, uint256 _liveStartTime, uint256 _liveEndTime, uint8 _betType) external returns (uint256)',
          'function resolveBet(uint256 _betId, uint256 _winnerIndex) external',
          'function getBet(uint256 _betId) external view returns (tuple(uint256 id, string title, string imageUrl, uint256 categoryId, tuple(string title, uint64 totalAmount, uint256 totalShares, bool isWinner)[] options, uint256 endTime, bool isActive, bool isResolved, uint256 createdAt, uint256 updatedAt, bool mustShowLive, uint256 liveStartTime, uint256 liveEndTime, uint8 betType))',
          'function getActiveBets() external view returns (uint256[] memory)',
          'function getBetsByCategory(uint256 _categoryId) external view returns (uint256[] memory)',
          'event BetCreated(uint256 indexed betId, string title, uint256 categoryId)',
          'event BetResolved(uint256 indexed betId, uint256 winnerIndex)',
        ],
      },
      CategoryManager: {
        address: process.env.CATEGORY_MANAGER_ADDRESS,
        abi: [
          'function createCategory(string memory _name, string memory _imageUrl, uint256 _parentId, uint256 _startTime, uint256 _endTime) external returns (uint256)',
          'function getCategory(uint256 _categoryId) external view returns (tuple(uint256 id, string name, string imageUrl, uint256 parentId, uint256 level, uint256 startTime, uint256 endTime, bool isActive, uint256 createdAt, uint256 updatedAt))',
          'function getActiveCategories() external view returns (uint256[] memory)',
          'function getTopLevelCategories() external view returns (uint256[] memory)',
        ],
      },
      AdminManager: {
        address: process.env.ADMIN_MANAGER_ADDRESS,
        abi: [
          'function hasRole(address _admin, uint8 _role) external view returns (bool)',
          'function isAdmin(address _admin) external view returns (bool)',
        ],
      },
      USDCToken: {
        address: process.env.USDC_TOKEN_ADDRESS,
        abi: [
          'function transfer(address to, uint256 amount) external returns (bool)',
          'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
          'function balanceOf(address account) external view returns (uint256)',
          'function approve(address spender, uint256 amount) external returns (bool)',
        ],
      },
    };

    for (const [name, config] of Object.entries(contracts)) {
      if (config.address) {
        this.contracts[name] = new ethers.Contract(
          config.address,
          config.abi,
          this.signer,
        );
        logger.info(`${name} contract initialized at ${config.address}`);
      } else {
        logger.warn(`${name} contract address not configured`);
      }
    }
  }

  // Ensure service is initialized
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('Contract service not initialized');
    }
  }

  // Create a new bet on the blockchain
  async createBet(betData) {
    this.ensureInitialized();

    try {
      const {
        title,
        imageUrl,
        categoryId,
        optionTitles,
        endTime,
        mustShowLive,
        liveStartTime,
        liveEndTime,
        betType,
      } = betData;

      const contract = this.contracts.BetMarket;
      if (!contract) {
        throw new Error('BetMarket contract not available');
      }

      // Call contract function
      const tx = await contract.createBet(
        title,
        imageUrl,
        categoryId,
        optionTitles,
        endTime,
        mustShowLive,
        liveStartTime,
        liveEndTime,
        betType,
      );

      logger.info(`Bet creation transaction sent: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      logger.info(`Bet creation confirmed in block ${receipt.blockNumber}`);

      return tx.hash;
    } catch (error) {
      logger.error('Contract bet creation failed:', error);
      throw error;
    }
  }

  // Resolve a bet on the blockchain
  async resolveBet(betId, winnerIndex) {
    this.ensureInitialized();

    try {
      const contract = this.contracts.BetMarket;
      if (!contract) {
        throw new Error('BetMarket contract not available');
      }

      const tx = await contract.resolveBet(betId, winnerIndex);
      logger.info(`Bet resolution transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      logger.info(`Bet resolution confirmed in block ${receipt.blockNumber}`);

      return tx.hash;
    } catch (error) {
      logger.error('Contract bet resolution failed:', error);
      throw error;
    }
  }

  // Get bet data from blockchain
  async getBetFromContract(betId) {
    this.ensureInitialized();

    try {
      const contract = this.contracts.BetMarket;
      if (!contract) {
        throw new Error('BetMarket contract not available');
      }

      const betData = await contract.getBet(betId);
      return betData;
    } catch (error) {
      logger.error('Failed to get bet from contract:', error);
      throw error;
    }
  }

  // Get active bets from blockchain
  async getActiveBetsFromContract() {
    this.ensureInitialized();

    try {
      const contract = this.contracts.BetMarket;
      if (!contract) {
        throw new Error('BetMarket contract not available');
      }

      const betIds = await contract.getActiveBets();
      return betIds.map((id) => id.toString());
    } catch (error) {
      logger.error('Failed to get active bets from contract:', error);
      throw error;
    }
  }

  // Create category on blockchain
  async createCategory(categoryData) {
    this.ensureInitialized();

    try {
      const {
        name,
        imageUrl,
        parentId,
        startTime,
        endTime,
      } = categoryData;

      const contract = this.contracts.CategoryManager;
      if (!contract) {
        throw new Error('CategoryManager contract not available');
      }

      const tx = await contract.createCategory(
        name,
        imageUrl,
        parentId,
        startTime,
        endTime,
      );

      logger.info(`Category creation transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      logger.info(`Category creation confirmed in block ${receipt.blockNumber}`);

      return tx.hash;
    } catch (error) {
      logger.error('Contract category creation failed:', error);
      throw error;
    }
  }

  // Check if address has admin role
  async checkAdminRole(address, role) {
    this.ensureInitialized();

    try {
      const contract = this.contracts.AdminManager;
      if (!contract) {
        throw new Error('AdminManager contract not available');
      }

      const hasRole = await contract.hasRole(address, role);
      return hasRole;
    } catch (error) {
      logger.error('Failed to check admin role:', error);
      throw error;
    }
  }

  // Check if address is admin
  async isAdmin(address) {
    this.ensureInitialized();

    try {
      const contract = this.contracts.AdminManager;
      if (!contract) {
        throw new Error('AdminManager contract not available');
      }

      const isAdmin = await contract.isAdmin(address);
      return isAdmin;
    } catch (error) {
      logger.error('Failed to check admin status:', error);
      throw error;
    }
  }

  // Get USDC balance
  async getUSDCBalance(address) {
    this.ensureInitialized();

    try {
      const contract = this.contracts.USDCToken;
      if (!contract) {
        throw new Error('USDC contract not available');
      }

      const balance = await contract.balanceOf(address);
      return balance.toString();
    } catch (error) {
      logger.error('Failed to get USDC balance:', error);
      throw error;
    }
  }

  // Listen to contract events
  startEventListeners() {
    this.ensureInitialized();

    try {
      const betMarket = this.contracts.BetMarket;
      if (betMarket) {
        // Listen for BetCreated events
        betMarket.on('BetCreated', (betId, title, categoryId, event) => {
          logger.info('BetCreated event received:', {
            betId: betId.toString(),
            title,
            categoryId: categoryId.toString(),
            txHash: event.transactionHash,
          });

          // Handle event (e.g., update database)
          this.handleBetCreatedEvent(betId.toString(), title, categoryId.toString(), event);
        });

        // Listen for BetResolved events
        betMarket.on('BetResolved', (betId, winnerIndex, event) => {
          logger.info('BetResolved event received:', {
            betId: betId.toString(),
            winnerIndex: winnerIndex.toString(),
            txHash: event.transactionHash,
          });

          // Handle event
          this.handleBetResolvedEvent(betId.toString(), winnerIndex.toString(), event);
        });

        logger.info('Contract event listeners started');
      }
    } catch (error) {
      logger.error('Failed to start event listeners:', error);
    }
  }

  // Handle BetCreated event
  async handleBetCreatedEvent(betId, title, categoryId, event) {
    try {
      // Update database or perform other actions
      logger.info(`Processing BetCreated event for bet ${betId}`);
    } catch (error) {
      logger.error('Error handling BetCreated event:', error);
    }
  }

  // Handle BetResolved event
  async handleBetResolvedEvent(betId, winnerIndex, event) {
    try {
      // Update database or perform other actions
      logger.info(`Processing BetResolved event for bet ${betId}, winner: ${winnerIndex}`);
    } catch (error) {
      logger.error('Error handling BetResolved event:', error);
    }
  }

  // Get contract addresses
  getContractAddresses() {
    return {
      BetMarket: this.contracts.BetMarket?.target,
      CategoryManager: this.contracts.CategoryManager?.target,
      AdminManager: this.contracts.AdminManager?.target,
      USDCToken: this.contracts.USDCToken?.target,
    };
  }

  // Get network info
  async getNetworkInfo() {
    this.ensureInitialized();

    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();

      return {
        chainId: network.chainId.toString(),
        name: network.name,
        blockNumber,
        contracts: this.getContractAddresses(),
      };
    } catch (error) {
      logger.error('Failed to get network info:', error);
      throw error;
    }
  }
}

// Create singleton instance
const contractService = new ContractService();

module.exports = { contractService };
