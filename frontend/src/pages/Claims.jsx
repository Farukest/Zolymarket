import React, { useState, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { Trophy, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { ethers } from 'ethers';
import { getNetworkConfig } from '../config/contracts';
import BetMarketCoreABI from '@artifacts/BetMarketCore.sol/BetMarketCore.json';
import BetMarketPayoutABI from '@artifacts/BetMarketPayout.sol/BetMarketPayout.json';
import toast from 'react-hot-toast';

const Claims = () => {
  const { address, chainId, isConnected } = useWallet();
  const [claimableBets, setClaimableBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(null);

  useEffect(() => {
    if (isConnected && address && chainId) {
      fetchClaimableBets();
    } else {
      setLoading(false);
    }
  }, [isConnected, address, chainId]);

  const fetchClaimableBets = async () => {
    try {
      setLoading(true);
      const networkConfig = getNetworkConfig(chainId);
      const provider = new ethers.BrowserProvider(window.ethereum);

      const coreContract = new ethers.Contract(
        networkConfig.contracts.BET_MARKET_CORE,
        BetMarketCoreABI.abi,
        provider
      );

      const payoutContract = new ethers.Contract(
        networkConfig.contracts.BET_MARKET_PAYOUT,
        BetMarketPayoutABI.abi,
        provider
      );

      const totalBets = Number(await coreContract.getTotalBets());
      const userBets = [];

      // Fetch all bets and check user participation
      for (let betId = 1; betId <= totalBets; betId++) {
        try {
          const bet = await coreContract.getBet(betId);

          // Check if bet is resolved
          if (!bet.isResolved) continue;

          // Check if user participated
          const hasPlaced = await coreContract.hasPlacedBet(address, betId);
          if (!hasPlaced) continue;

          // Check if user has claimed
          const hasClaimed = await coreContract.hasClaimed(address, betId);

          // Check MongoDB to determine if user won or lost
          let userPositionData = null;
          let isWinner = null;
          try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
            const positionResponse = await fetch(`${backendUrl}/api/user-positions/${address}/${betId}`);
            if (positionResponse.ok) {
              const positionData = await positionResponse.json();
              if (positionData.success && positionData.hasPosition) {
                userPositionData = positionData;
                if (positionData.isResolved) {
                  isWinner = positionData.isWinner;
                }
              }
            }
          } catch (mongoErr) {
            console.warn(`MongoDB check failed for bet ${betId}, falling back to contract:`, mongoErr);
          }

          // Get payout status from Payout contract
          const payoutStatus = await payoutContract.getPayoutStatus(betId, address);
          const [hasRequested, isProcessed, payoutAmount] = payoutStatus;

          // Get bet options
          const optionCount = Number(bet.optionCount);
          const options = [];
          let winningOptionIndex = null;

          for (let i = 0; i < optionCount; i++) {
            const option = await coreContract.getBetOption(betId, i);
            options.push(option.title);
            if (option.isWinner) {
              winningOptionIndex = i;
            }
          }

          // Determine bet state
          const betState = {
            contractId: betId,
            title: bet.title,
            description: bet.description,
            options: options,
            winningOption: winningOptionIndex,
            betType: Number(bet.betType),
            endTime: new Date(Number(bet.endTime) * 1000),
            hasRequested,
            isProcessed,
            hasClaimed,
            isWinner: isWinner,
            winnings: '0.00',
            canClaim: false,
            needsRequest: false,
            processing: false
          };

          // User Lost
          if (isWinner === false) {
            betState.status = 'lost';
            betState.winnings = '0.00';
            userBets.push(betState);
          }
          // User Won & Claimed
          else if (hasClaimed) {
            betState.status = 'claimed';
            betState.winnings = isProcessed && Number(payoutAmount) > 0
              ? ethers.formatUnits(payoutAmount, 6)
              : '0.00';
            userBets.push(betState);
          }
          // User Won & Can Claim (payout processed)
          else if (isProcessed && Number(payoutAmount) > 0) {
            betState.status = 'claimable';
            betState.winnings = ethers.formatUnits(payoutAmount, 6);
            betState.canClaim = true;
            userBets.push(betState);
          }
          // User Won & Needs Request
          else if (!hasRequested && !isProcessed && isWinner === true) {
            betState.status = 'needsRequest';
            betState.needsRequest = true;
            userBets.push(betState);
          }
          // User Won & Processing
          else if (hasRequested && !isProcessed) {
            betState.status = 'processing';
            betState.processing = true;
            betState.winnings = '...';
            userBets.push(betState);
          }
          // Unknown state - show as potential winner
          else if (isWinner === null && !hasClaimed) {
            betState.status = 'needsRequest';
            betState.needsRequest = true;
            userBets.push(betState);
          }
        } catch (error) {
          console.error(`Error fetching bet ${betId}:`, error);
        }
      }

      setClaimableBets(userBets);
    } catch (error) {
      console.error('Error fetching claimable bets:', error);
      toast.error('Failed to fetch claimable bets');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async (betId) => {
    try {
      setClaiming(betId);
      const networkConfig = getNetworkConfig(chainId);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const payoutContract = new ethers.Contract(
        networkConfig.contracts.BET_MARKET_PAYOUT,
        BetMarketPayoutABI.abi,
        signer
      );

      const loadingToast = toast.loading('Requesting payout calculation...');

      const tx = await payoutContract.requestPayout(betId);
      toast.loading(`Transaction submitted! TX: ${tx.hash.substring(0, 10)}...`, { id: loadingToast });

      await tx.wait();

      toast.success('Payout request submitted! Please wait for decryption (~1-2 minutes), then refresh to claim.', {
        id: loadingToast,
        duration: 8000,
      });

      // Refresh after a delay to allow oracle callback
      setTimeout(() => fetchClaimableBets(), 5000);
    } catch (error) {
      console.error('Request payout error:', error);
      toast.error(error.reason || error.message || 'Failed to request payout');
    } finally {
      setClaiming(null);
    }
  };

  const handleClaim = async (betId) => {
    try {
      setClaiming(betId);
      const networkConfig = getNetworkConfig(chainId);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const payoutContract = new ethers.Contract(
        networkConfig.contracts.BET_MARKET_PAYOUT,
        BetMarketPayoutABI.abi,
        signer
      );

      const loadingToast = toast.loading('Claiming your winnings...');

      const tx = await payoutContract.claimPayout(betId);
      toast.loading(`Transaction submitted! TX: ${tx.hash.substring(0, 10)}...`, { id: loadingToast });

      await tx.wait();

      toast.success('Winnings claimed successfully!', {
        id: loadingToast,
        duration: 5000,
      });

      // Refresh claimable bets
      await fetchClaimableBets();
    } catch (error) {
      console.error('Claim error:', error);
      toast.error(error.reason || error.message || 'Failed to claim winnings');
    } finally {
      setClaiming(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Your Wallet</h2>
            <p className="text-gray-600">
              Please connect your wallet to view and claim your winnings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading your winnings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 px-4 pb-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Winnings</h1>
          <p className="text-gray-600">
            Claim your winnings from resolved bets where you predicted correctly.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <Trophy className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Claimable Bets</p>
                <p className="text-2xl font-bold text-gray-900">{claimableBets.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Winnings</p>
                <p className="text-2xl font-bold text-gray-900">
                  {claimableBets.reduce((sum, bet) => sum + parseFloat(bet.winnings), 0).toFixed(2)} USDC
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Bet Amount</p>
                <p className="text-2xl font-bold text-gray-900">
                  {claimableBets.reduce((sum, bet) => sum + parseFloat(bet.userBetAmount), 0).toFixed(2)} USDC
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Claimable Bets List */}
        {claimableBets.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
            <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Winnings to Claim</h3>
            <p className="text-gray-600">
              You don't have any unclaimed winnings at the moment.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {claimableBets.map((bet) => (
              <div
                key={bet.contractId}
                className="bg-white rounded-lg p-6 border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      #{bet.contractId} - {bet.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">{bet.description}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Your Bet</p>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm font-medium">
                            {bet.options[bet.userBetOption]}
                          </span>
                          <span className="text-sm text-gray-600">
                            {bet.userBetAmount} USDC
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-1">Winning Option</p>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-lg text-sm font-medium">
                            {bet.options[bet.winningOption]}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Type: {['Binary', 'Multiple', 'Nested'][bet.betType]}</span>
                      <span>Ended: {bet.endTime.toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-1">
                        {bet.status === 'lost' ? 'Result' : 'Your Winnings'}
                      </p>
                      <p className={`text-2xl font-bold ${
                        bet.status === 'lost' ? 'text-red-600' :
                        bet.status === 'claimed' ? 'text-blue-600' :
                        'text-green-600'
                      }`}>
                        {bet.status === 'lost' ? '---' :
                         bet.winnings === '...' ? '...' :
                         `${parseFloat(bet.winnings).toFixed(2)} USDC`}
                      </p>
                    </div>

                    {/* Status badges and actions */}
                    {bet.status === 'lost' && (
                      <div className="px-6 py-3 bg-red-100 text-red-800 rounded-lg flex items-center gap-2 font-medium">
                        <XCircle className="w-4 h-4" />
                        You Lost
                      </div>
                    )}

                    {bet.status === 'claimed' && (
                      <div className="px-6 py-3 bg-blue-100 text-blue-800 rounded-lg flex items-center gap-2 font-medium">
                        <CheckCircle className="w-4 h-4" />
                        Claimed
                      </div>
                    )}

                    {bet.needsRequest && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRequestPayout(bet.contractId); }}
                        disabled={claiming === bet.contractId}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {claiming === bet.contractId ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Requesting...
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4" />
                            Request Payout
                          </>
                        )}
                      </button>
                    )}

                    {bet.processing && (
                      <div className="px-6 py-3 bg-gray-100 text-gray-600 rounded-lg flex items-center gap-2 font-medium">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing (~1-2 min)
                      </div>
                    )}

                    {bet.canClaim && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleClaim(bet.contractId); }}
                        disabled={claiming === bet.contractId}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {claiming === bet.contractId ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Claiming...
                          </>
                        ) : (
                          <>
                            <Trophy className="w-4 h-4" />
                            Claim Winnings
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Claims;
