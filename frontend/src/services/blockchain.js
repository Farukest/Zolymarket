import { ethers } from 'ethers';
import { initializeFHE, encryptBetAmount } from '../lib/fhe';

// Contract ABIs (simplified for demo - in real app these would be imported)
const BET_MARKET_ABI = [
  'function createBet(string title, string imageUrl, uint256 categoryId, string[] options, uint256 endTime, bool mustShowLive, uint256 liveStartTime, uint256 liveEndTime, uint8 betType) external returns (uint256)',
  'function placeBet(uint256 betId, uint256 optionIndex, bytes encryptedAmount, bytes proof) external',
  'function resolveBet(uint256 betId, uint256 winnerIndex) external',
  'function claimWinnings(uint256 betId) external',
  'function getBet(uint256 betId) external view returns (tuple(uint256 id, string title, string imageUrl, uint256 categoryId, tuple(string title, uint256 totalShares, bool isWinner)[] options, uint256 endTime, bool isActive, bool isResolved, uint256 createdAt, uint256 updatedAt, bool mustShowLive, uint256 liveStartTime, uint256 liveEndTime, uint8 betType))',
  'function getUserBets(address user) external view returns (tuple(uint256 betId, uint256 optionIndex, uint256 shares, uint256 timestamp, bool claimed)[])',
  'function getActiveBets() external view returns (uint256[])',
  'function getBetsByCategory(uint256 categoryId) external view returns (uint256[])',
  'event BetCreated(uint256 indexed betId, string title, uint256 categoryId)',
  'event BetPlaced(uint256 indexed betId, address indexed user, uint256 optionIndex, uint256 shares)',
  'event BetResolved(uint256 indexed betId, uint256 winnerIndex)',
  'event WinningsClaimed(uint256 indexed betId, address indexed user, uint256 amount)'
];

const USDC_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function decimals() external view returns (uint8)'
];

class BlockchainService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contracts = {};
    this.isInitialized = false;
    
    // Network configuration
    this.networks = {
      zama: {
        chainId: 8009,
        name: 'Zama Devnet',
        rpcUrl: import.meta.env.VITE_FHEVM_NETWORK_URL,
        currency: {
          name: 'ETH',
          symbol: 'ETH',
          decimals: 18
        },
        blockExplorer: 'https://devnet.zama.ai'
      },
      sepolia: {
        chainId: 11155111,
        name: 'Sepolia Testnet',
        rpcUrl: import.meta.env.VITE_FHEVM_NETWORK_URL,
        currency: {
          name: 'Sepolia ETH',
          symbol: 'ETH',
          decimals: 18
        },
        blockExplorer: 'https://sepolia.etherscan.io'
      }
    };
    
    this.currentNetwork = 'zama';
  }

  // Initialize the blockchain service
  async initialize() {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not detected');
      }

      this.provider = new ethers.providers.Web3Provider(window.ethereum);
      this.signer = this.provider.getSigner();
      
      // Initialize FHEVM service
      await fhevmService.initialize();
      
      // Load contract instances
      await this.loadContracts();
      
      this.isInitialized = true;
      console.log('Blockchain service initialized');
      
      return true;
    } catch (error) {
      console.error('Failed to initialize blockchain service:', error);
      throw error;
    }
  }

  // Load contract instances
  async loadContracts() {
    const contractAddresses = {
      betMarket: import.meta.env.VITE_BET_MARKET_CONTRACT,
      usdc: import.meta.env.VITE_USDC_CONTRACT,
    };

    this.contracts = {
      betMarket: new ethers.Contract(
        contractAddresses.betMarket,
        BET_MARKET_ABI,
        this.signer
      ),
      usdc: new ethers.Contract(
        contractAddresses.usdc,
        USDC_ABI,
        this.signer
      )
    };
  }

  // Get current account
  async getCurrentAccount() {
    if (!this.provider) return null;
    
    const accounts = await this.provider.listAccounts();
    return accounts[0] || null;
  }

  // Connect wallet
  async connectWallet() {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }

      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      if (!this.isInitialized) {
        await this.initialize();
      }

      const account = await this.getCurrentAccount();
      const balance = await this.getBalance(account);
      
      return { account, balance };
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }

  // Get account balance
  async getBalance(account) {
    if (!account || !this.provider) return '0';
    
    try {
      const balance = await this.provider.getBalance(account);
      return ethers.utils.formatEther(balance);
    } catch (error) {
      console.error('Failed to get balance:', error);
      return '0';
    }
  }

  // Get USDC balance
  async getUSDCBalance(account) {
    if (!account || !this.contracts.usdc) return '0';
    
    try {
      const balance = await this.contracts.usdc.balanceOf(account);
      const decimals = await this.contracts.usdc.decimals();
      return ethers.utils.formatUnits(balance, decimals);
    } catch (error) {
      console.error('Failed to get USDC balance:', error);
      return '0';
    }
  }

  // Get USDC allowance
  async getUSDCAllowance(account, spender) {
    if (!account || !spender || !this.contracts.usdc) return '0';
    
    try {
      const allowance = await this.contracts.usdc.allowance(account, spender);
      const decimals = await this.contracts.usdc.decimals();
      return ethers.utils.formatUnits(allowance, decimals);
    } catch (error) {
      console.error('Failed to get USDC allowance:', error);
      return '0';
    }
  }

  // Approve USDC spending
  async approveUSDC(spender, amount) {
    if (!this.contracts.usdc) {
      throw new Error('USDC contract not loaded');
    }

    try {
      const decimals = await this.contracts.usdc.decimals();
      const amountWei = ethers.utils.parseUnits(amount.toString(), decimals);
      
      const tx = await this.contracts.usdc.approve(spender, amountWei);
      await tx.wait();
      
      return tx.hash;
    } catch (error) {
      console.error('Failed to approve USDC:', error);
      throw error;
    }
  }

  // Switch to correct network
  async switchToNetwork(networkName = 'zama') {
    const network = this.networks[networkName];
    if (!network) {
      throw new Error(`Unknown network: ${networkName}`);
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${network.chainId.toString(16)}` }],
      });
      
      this.currentNetwork = networkName;
    } catch (switchError) {
      // Network not added, try to add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${network.chainId.toString(16)}`,
              chainName: network.name,
              rpcUrls: [network.rpcUrl],
              nativeCurrency: network.currency,
              blockExplorerUrls: [network.blockExplorer],
            }],
          });
          
          this.currentNetwork = networkName;
        } catch (addError) {
          console.error('Failed to add network:', addError);
          throw addError;
        }
      } else {
        console.error('Failed to switch network:', switchError);
        throw switchError;
      }
    }
  }

  // Place a bet
  async placeBet(betId, optionIndex, amount) {
    if (!this.contracts.betMarket) {
      throw new Error('BetMarket contract not loaded');
    }

    try {
      // Encrypt the amount using FHEVM
      const encryptedAmount = await fhevmService.encryptAmount(amount);
      
      const tx = await this.contracts.betMarket.placeBet(
        betId,
        optionIndex,
        encryptedAmount.handles[0],
        encryptedAmount.inputProof
      );
      
      const receipt = await tx.wait();
      return {
        hash: tx.hash,
        receipt,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('Failed to place bet:', error);
      throw error;
    }
  }

  // Create a bet (admin only)
  async createBet(betData) {
    if (!this.contracts.betMarket) {
      throw new Error('BetMarket contract not loaded');
    }

    try {
      const tx = await this.contracts.betMarket.createBet(
        betData.title,
        betData.imageUrl,
        betData.categoryId,
        betData.options,
        betData.endTime,
        betData.mustShowLive,
        betData.liveStartTime || 0,
        betData.liveEndTime || 0,
        betData.betType
      );
      
      const receipt = await tx.wait();
      
      // Extract bet ID from events
      const betCreatedEvent = receipt.events?.find(
        event => event.event === 'BetCreated'
      );
      
      return {
        hash: tx.hash,
        receipt,
        betId: betCreatedEvent?.args?.betId?.toString(),
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('Failed to create bet:', error);
      throw error;
    }
  }

  // Resolve a bet (admin only)
  async resolveBet(betId, winnerIndex) {
    if (!this.contracts.betMarket) {
      throw new Error('BetMarket contract not loaded');
    }

    try {
      const tx = await this.contracts.betMarket.resolveBet(betId, winnerIndex);
      const receipt = await tx.wait();
      
      return {
        hash: tx.hash,
        receipt,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('Failed to resolve bet:', error);
      throw error;
    }
  }

  // Claim winnings
  async claimWinnings(betId) {
    if (!this.contracts.betMarket) {
      throw new Error('BetMarket contract not loaded');
    }

    try {
      const tx = await this.contracts.betMarket.claimWinnings(betId);
      const receipt = await tx.wait();
      
      // Extract amount from events
      const claimedEvent = receipt.events?.find(
        event => event.event === 'WinningsClaimed'
      );
      
      return {
        hash: tx.hash,
        receipt,
        amount: claimedEvent?.args?.amount?.toString(),
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('Failed to claim winnings:', error);
      throw error;
    }
  }

  // Get bet details
  async getBet(betId) {
    if (!this.contracts.betMarket) {
      throw new Error('BetMarket contract not loaded');
    }

    try {
      const bet = await this.contracts.betMarket.getBet(betId);
      
      // Convert BigNumber values to strings
      return {
        id: bet.id.toString(),
        title: bet.title,
        imageUrl: bet.imageUrl,
        categoryId: bet.categoryId.toString(),
        options: bet.options.map(option => ({
          title: option.title,
          totalShares: option.totalShares.toString(),
          isWinner: option.isWinner
        })),
        endTime: bet.endTime.toString(),
        isActive: bet.isActive,
        isResolved: bet.isResolved,
        createdAt: bet.createdAt.toString(),
        updatedAt: bet.updatedAt.toString(),
        mustShowLive: bet.mustShowLive,
        liveStartTime: bet.liveStartTime.toString(),
        liveEndTime: bet.liveEndTime.toString(),
        betType: bet.betType
      };
    } catch (error) {
      console.error('Failed to get bet:', error);
      throw error;
    }
  }

  // Get user bets
  async getUserBets(userAddress) {
    if (!this.contracts.betMarket) {
      throw new Error('BetMarket contract not loaded');
    }

    try {
      const bets = await this.contracts.betMarket.getUserBets(userAddress);
      
      return bets.map(bet => ({
        betId: bet.betId.toString(),
        optionIndex: bet.optionIndex.toString(),
        shares: bet.shares.toString(),
        timestamp: bet.timestamp.toString(),
        claimed: bet.claimed
      }));
    } catch (error) {
      console.error('Failed to get user bets:', error);
      throw error;
    }
  }

  // Get active bets
  async getActiveBets() {
    if (!this.contracts.betMarket) {
      throw new Error('BetMarket contract not loaded');
    }

    try {
      const betIds = await this.contracts.betMarket.getActiveBets();
      return betIds.map(id => id.toString());
    } catch (error) {
      console.error('Failed to get active bets:', error);
      throw error;
    }
  }

  // Listen to contract events
  addEventListener(eventName, callback) {
    if (!this.contracts.betMarket) {
      console.error('BetMarket contract not loaded');
      return;
    }

    const contract = this.contracts.betMarket;
    
    contract.on(eventName, (...args) => {
      const event = args[args.length - 1]; // Last argument is the event object
      callback({
        ...event,
        args: args.slice(0, -1)
      });
    });
  }

  // Remove event listener
  removeEventListener(eventName) {
    if (!this.contracts.betMarket) return;
    
    this.contracts.betMarket.removeAllListeners(eventName);
  }

  // Get transaction receipt
  async getTransactionReceipt(hash) {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      return await this.provider.getTransactionReceipt(hash);
    } catch (error) {
      console.error('Failed to get transaction receipt:', error);
      throw error;
    }
  }

  // Wait for transaction confirmation
  async waitForTransaction(hash, confirmations = 1) {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      return await this.provider.waitForTransaction(hash, confirmations);
    } catch (error) {
      console.error('Failed to wait for transaction:', error);
      throw error;
    }
  }

  // Estimate gas for transaction
  async estimateGas(contractMethod, ...args) {
    try {
      return await contractMethod.estimateGas(...args);
    } catch (error) {
      console.error('Failed to estimate gas:', error);
      throw error;
    }
  }

  // Get current gas price
  async getGasPrice() {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      return await this.provider.getGasPrice();
    } catch (error) {
      console.error('Failed to get gas price:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
export const blockchainService = new BlockchainService();
export default blockchainService;