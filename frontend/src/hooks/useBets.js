import { useState, useEffect } from 'react';
import { useWallet } from './useWallet';
import { useFHEVM } from './useFHEVM';
import api from '../services/api';
import { ethers } from 'ethers';

export const useBets = () => {
  const { isConnected, getContract, account } = useWallet();
  const { encryptAmount, decryptAmount, getBets: fhevmGetBets, getBet: fhevmGetBet } = useFHEVM();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Contract addresses (Updated to new deployed contracts)
  const BET_MARKET_ADDRESS = import.meta.env.VITE_BET_MARKET_CONTRACT || "0x6B0Fc68e8e28d4E35bD33E8eAa32b06fC8E1356E";
  const BET_MARKET_ABI = [
    // Add ABI here - simplified for demo
    "function getBet(uint256 _betId) external view returns (tuple(uint256 id, string title, string imageUrl, uint256 categoryId, tuple(string title, uint64 totalAmount, uint256 totalShares, bool isWinner)[] options, uint256 endTime, bool isActive, bool isResolved, uint256 createdAt, uint256 updatedAt, bool mustShowLive, uint256 liveStartTime, uint256 liveEndTime, uint8 betType))",
    "function placeBet(uint256 _betId, uint256 _optionIndex, bytes32 _encryptedAmount, bytes _proof, uint256 _actualAmount) external",
    "function getActiveBets() external view returns (uint256[] memory)",
    "function getBetsByCategory(uint256 _categoryId) external view returns (uint256[] memory)",
    "function getUserBets(address _user) external view returns (tuple(uint256 betId, uint256 optionIndex, uint64 amount, uint256 shares, uint256 timestamp, bool claimed)[] memory)",
    "function claimWinnings(uint256 _betId) external"
  ];

  const getBets = async (params = {}) => {
    try {
      setLoading(true);

      // Use database-first approach (backend API)
      try {

        const response = await api.get('/bets', { params });

        if (response.data.success && response.data.data?.bets) {
          console.log('✅ API Result:', response.data.data.bets.length, 'bets loaded');
          return {
            bets: response.data.data.bets,
            total: response.data.count || response.data.data.bets.length,
            totalPages: response.data.totalPages || 1,
            currentPage: response.data.currentPage || 1
          };
        }

        throw new Error('Invalid API response format');

      } catch (apiError) {
        console.warn('🔄 Backend API failed, falling back to contract data...', apiError.message);

        try {
          // Fallback to contract data using directDatabaseService
          const { directDatabaseService } = await import('../services/directDatabaseService');
          const contractResult = await directDatabaseService.getBets(params);

          if (contractResult.success && contractResult.data.bets) {
            return {
              bets: contractResult.data.bets,
              total: contractResult.count || contractResult.data.bets.length
            };
          }

          throw new Error('Contract data fetch failed');

        } catch (contractError) {
          console.error('Contract data fetch failed:', contractError);
        }
      }

      // Final fallback to empty data
      return { bets: [], total: 0 };

    } catch (err) {
      setError(err.message);
      return { bets: [], total: 0 };
    } finally {
      setLoading(false);
    }
  };

  const getBet = async (betId) => {
    try {
      setLoading(true);

      // Use database-first approach (backend API)
      try {

        const response = await api.get(`/bets/${betId}`);

        if (response.data.success && response.data.data?.bet) {
          return response.data.data.bet;
        }

        throw new Error('Invalid API response format');

      } catch (apiError) {
        console.warn('🔄 Backend API failed, falling back to contract data...', apiError.message);

        try {
          // Fallback to contract data using directDatabaseService
          const { directDatabaseService } = await import('../services/directDatabaseService');
          const contractResult = await directDatabaseService.getBet(betId);

          if (contractResult.success && contractResult.data) {
            return contractResult.data;
          }

          throw new Error('Contract data fetch failed');

        } catch (contractError) {
          console.error('Contract bet fetch failed:', contractError);
        }
      }

      throw new Error('Bet not found');
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const searchBets = async (query) => {
    try {
      setLoading(true);
      const response = await api.get('/bets/search', {
        params: { q: query },
        optional: true
      });
      return response.data.bets || [];
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const placeBet = async (betId, optionIndex, amount) => {
    if (!isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      
      // Get contract instance
      const contract = getContract(BET_MARKET_ADDRESS, BET_MARKET_ABI);
      
      // Encrypt the amount
      const encryptedAmount = await encryptAmount(amount);
      
      // Prepare transaction
      const tx = await contract.placeBet(
        betId,
        optionIndex,
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        amount
      );
      
      await tx.wait();
      
      // Update backend
      await api.post(`/bets/${betId}/place`, {
        optionIndex,
        amount,
        txHash: tx.hash
      }, { optional: true });
      
      return tx;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getUserBets = async () => {
    if (!isConnected || !account) {
      return [];
    }

    try {
      setLoading(true);
      const response = await api.get(`/bets/user/${account}`, { optional: true });
      return response.data.bets || [];
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const claimWinnings = async (betId) => {
    if (!isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      
      const contract = getContract(BET_MARKET_ADDRESS, BET_MARKET_ABI);
      const tx = await contract.claimWinnings(betId);
      await tx.wait();
      
      // Update backend
      await api.post(`/bets/${betId}/claim`, {
        txHash: tx.hash
      }, { optional: true });
      
      return tx;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getBookmarkedBets = () => {
    const saved = localStorage.getItem('bookmarkedBets');
    return saved ? JSON.parse(saved) : [];
  };

  const bookmarkBet = (betId) => {
    const bookmarked = getBookmarkedBets();
    const isBookmarked = bookmarked.includes(betId);
    
    let newBookmarked;
    if (isBookmarked) {
      newBookmarked = bookmarked.filter(id => id !== betId);
    } else {
      newBookmarked = [...bookmarked, betId];
    }
    
    localStorage.setItem('bookmarkedBets', JSON.stringify(newBookmarked));
    return !isBookmarked;
  };

  // Get on-chain bet data
  const getBetFromContract = async (betId) => {
    if (!isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const contract = getContract(BET_MARKET_ADDRESS, BET_MARKET_ABI);
      const betData = await contract.getBet(betId);
      return betData;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Get active bets from contract
  const getActiveBetsFromContract = async () => {
    if (!isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const contract = getContract(BET_MARKET_ADDRESS, BET_MARKET_ABI);
      const betIds = await contract.getActiveBets();
      return betIds.map(id => id.toString());
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Calculate potential winnings
  const calculatePotentialWinnings = (betAmount, optionPrice, totalPool) => {
    if (!betAmount || !optionPrice || !totalPool) return 0;
    
    const shares = betAmount / (optionPrice / 100);
    const potentialReturn = shares * (totalPool / shares);
    return potentialReturn - betAmount; // Profit
  };

  // Format bet data for display
  const formatBetData = (bet) => {
    return {
      ...bet,
      formattedEndTime: new Date(bet.endTime * 1000),
      formattedCreatedAt: new Date(bet.createdAt * 1000),
      isEnded: Date.now() > bet.endTime * 1000,
      timeUntilEnd: bet.endTime * 1000 - Date.now(),
      options: bet.options?.map(option => ({
        ...option,
        percentage: Math.round((option.totalShares / bet.totalShares) * 100) || 0,
        yesPrice: Math.round(option.totalShares > 0 ? (option.totalAmount / option.totalShares) * 100 : 50),
        noPrice: Math.round(option.totalShares > 0 ? 100 - (option.totalAmount / option.totalShares) * 100 : 50)
      }))
    };
  };

  return {
    loading,
    error,
    getBets,
    getBet,
    searchBets,
    placeBet,
    getUserBets,
    claimWinnings,
    getBookmarkedBets,
    bookmarkBet,
    getBetFromContract,
    getActiveBetsFromContract,
    calculatePotentialWinnings,
    formatBetData,
    clearError: () => setError(null)
  };
};