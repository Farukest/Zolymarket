import React, { useState, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { getNetworkConfig } from '../config/contracts';
import BetMarketCoreABI from '../../../hardhat/artifacts/contracts/BetMarketCore.sol/BetMarketCore.json';
import BetMarketPayoutABI from '../../../hardhat/artifacts/contracts/BetMarketPayout.sol/BetMarketPayout.json';
import {
  TrendingUp,
  Clock,
  DollarSign,
  Award,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  XCircle,
  Trophy
} from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { account, chainId, isConnected, provider } = useWallet();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('active');
  const [loading, setLoading] = useState(true);
  const [activeBets, setActiveBets] = useState([]);
  const [endedBets, setEndedBets] = useState([]);
  const [claimableBets, setClaimableBets] = useState([]);
  const [claiming, setClaiming] = useState({});

  useEffect(() => {
    if (!isConnected || !account) {
      navigate('/');
      return;
    }
    fetchUserBets();
  }, [isConnected, account, chainId]);

  const fetchUserBets = async () => {
    if (!account || !chainId) return;

    try {
      setLoading(true);
      const networkConfig = getNetworkConfig(chainId);
      const rpcProvider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);

      const coreContract = new ethers.Contract(
        networkConfig.contracts.BET_MARKET_CORE,
        BetMarketCoreABI.abi,
        rpcProvider
      );

      const payoutContract = new ethers.Contract(
        networkConfig.contracts.BET_MARKET_PAYOUT,
        BetMarketPayoutABI.abi,
        rpcProvider
      );

      // Get total bets
      const totalBets = Number(await coreContract.getTotalBets());

      const active = [];
      const ended = [];
      const claimable = [];

      // Loop through all bets and find user's bets
      for (let betId = 1; betId <= totalBets; betId++) {
        try {
          // Check if user has placed bet on this
          const hasPlaced = await coreContract.hasPlacedBet(account, betId);

          if (!hasPlaced) continue;

          // Get bet details
          const betData = await coreContract.getBet(betId);
          const endTime = Number(betData.endTime) * 1000;
          const isActive = betData.isActive;
          const isResolved = betData.isResolved;
          const hasClaimed = await coreContract.hasClaimed(account, betId);

          const bet = {
            id: betId,
            title: betData.title,
            description: betData.description,
            endTime: endTime,
            isActive: isActive,
            isResolved: isResolved,
            betType: Number(betData.betType),
            optionCount: Number(betData.optionCount)
          };

          // Categorize bet
          const now = Date.now();
          if (isResolved) {
            // Check MongoDB to see if user won or lost
            let userWon = null;
            try {
              const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
              const positionResponse = await fetch(`${backendUrl}/api/user-positions/${account}/${betId}`);
              if (positionResponse.ok) {
                const positionData = await positionResponse.json();
                if (positionData.success && positionData.hasPosition && positionData.isResolved) {
                  userWon = positionData.isWinner;
                }
              }
            } catch (mongoErr) {
              console.warn(`MongoDB check failed for bet ${betId}:`, mongoErr);
            }

            // If user won, add to claimable
            if (userWon === true) {
              claimable.push({ ...bet, hasClaimed, isWinner: true });
              console.log(`✅ Added bet ${betId} to claimable - user is winner`);
            }
            // If user lost, add to ended with lost status
            else if (userWon === false) {
              ended.push({ ...bet, hasClaimed, isWinner: false, status: 'lost' });
              console.log(`📉 Added bet ${betId} to ended - user lost`);
            }
            // Unknown - check contract payout status as fallback
            else {
              try {
                const payoutStatus = await payoutContract.getPayoutStatus(betId, account);
                const hasRequested = payoutStatus[0];
                const isProcessed = payoutStatus[1];
                const payoutAmount = payoutStatus[2];

                // If payout is processed and amount > 0, user won
                if (isProcessed && Number(payoutAmount) > 0) {
                  claimable.push({ ...bet, hasClaimed, isWinner: true });
                  console.log(`✅ Added bet ${betId} to claimable - payout processed`);
                } else {
                  // Otherwise add to ended (might be lost)
                  ended.push({ ...bet, hasClaimed, isWinner: null, status: 'resolved' });
                }
              } catch (payoutErr) {
                console.warn(`Failed to get payout status for bet ${betId}:`, payoutErr);
                ended.push({ ...bet, hasClaimed, isWinner: null, status: 'resolved' });
              }
            }
          } else if (!isResolved && endTime > now && isActive) {
            active.push(bet);
          } else if (!isResolved && endTime <= now) {
            ended.push(bet);
          }
        } catch (err) {
          console.warn(`Failed to fetch bet ${betId}:`, err);
        }
      }

      setActiveBets(active);
      setEndedBets(ended);
      setClaimableBets(claimable);
    } catch (error) {
      console.error('Error fetching user bets:', error);
      toast.error('Failed to load your bets');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (betId) => {
    if (!account || !chainId) return;

    try {
      setClaiming(prev => ({ ...prev, [betId]: true }));

      const networkConfig = getNetworkConfig(chainId);
      const signer = await provider.getSigner();

      const payoutContract = new ethers.Contract(
        networkConfig.contracts.BET_MARKET_PAYOUT,
        BetMarketPayoutABI.abi,
        signer
      );

      toast.loading('Claiming your winnings...', { id: `claim-${betId}` });

      const tx = await payoutContract.claimPayout(betId);
      await tx.wait();

      toast.success('Successfully claimed winnings!', { id: `claim-${betId}` });

      // Refresh bets
      fetchUserBets();
    } catch (error) {
      console.error('Claim error:', error);
      toast.error(error.reason || 'Failed to claim winnings', { id: `claim-${betId}` });
    } finally {
      setClaiming(prev => ({ ...prev, [betId]: false }));
    }
  };

  const BetCard = ({ bet, showClaimButton = false }) => {
    const timeRemaining = bet.endTime - Date.now();
    const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
    const hoursRemaining = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    const isLost = bet.status === 'lost';
    const isClaimed = bet.hasClaimed === true;

    return (
      <div
        className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => navigate(`/bet/${bet.id}`)}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{bet.title}</h3>
            <p className="text-sm text-gray-600 line-clamp-2">{bet.description}</p>
          </div>
          <div className="ml-4 flex flex-col gap-2">
            {bet.isResolved ? (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                Resolved
              </span>
            ) : bet.endTime < Date.now() ? (
              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                Ended
              </span>
            ) : (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                Active
              </span>
            )}
            {isLost && (
              <span className="px-3 py-1 bg-red-500 text-white-700 rounded-full text-xs font-medium flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                Lost
              </span>
            )}
            {isClaimed && !isLost && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Claimed
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {bet.endTime < Date.now()
              ? 'Ended'
              : `${daysRemaining}d ${hoursRemaining}h left`
            }
          </span>
          <span className="flex items-center gap-1">
            {bet.betType === 0 ? 'Binary' : bet.betType === 1 ? 'Multiple' : 'Nested'}
          </span>
        </div>

        <div className="flex items-center justify-between text-primary-8 font-medium text-sm mt-4">
          <span className={
            isLost ? "text-red-600 flex items-center gap-1" :
            showClaimButton ? "text-green-600 flex items-center gap-1" : ""
          }>
            {isLost ? (
              <>
                <XCircle className="w-4 h-4" />
                You Lost
              </>
            ) : showClaimButton ? (
              <>
                <Trophy className="w-4 h-4" />
                You Won!
              </>
            ) : ""}
          </span>
          <div className="flex items-center">
            View Details
            <ChevronRight className="w-4 h-4 ml-1" />
          </div>
        </div>
      </div>
    );
  };

  const EmptyState = ({ icon: Icon, title, description }) => (
    <div className="text-center py-16">
      <Icon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-6">{description}</p>
      <button
        onClick={() => navigate('/')}
        className="bg-primary-8 hover:bg-primary-9 text-white px-6 py-2 rounded-lg font-medium transition-colors"
      >
        Explore Markets
      </button>
    </div>
  );

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center site-background">
        <div className="text-center bg-white rounded-xl shadow-lg p-8 max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Wallet Not Connected</h2>
          <p className="text-gray-600 mb-6">Please connect your wallet to view your dashboard</p>
          <button
            onClick={() => navigate('/')}
            className="bg-primary-8 hover:bg-primary-9 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen site-background py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Dashboard</h1>
          <p className="text-gray-600">Track and manage your prediction markets</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">Active Bets</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{activeBets.length}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">Ended Bets</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{endedBets.length}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Award className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">Claimable</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{claimableBets.length}</p>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="bg-white rounded-t-xl border border-gray-200 border-b-0">
          <nav className="flex gap-8 px-6">
            <button
              onClick={() => setActiveTab('active')}
              className={`py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'active'
                  ? 'border-primary-8 text-primary-8'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Active Bets ({activeBets.length})
            </button>
            <button
              onClick={() => setActiveTab('ended')}
              className={`py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'ended'
                  ? 'border-primary-8 text-primary-8'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Ended Bets ({endedBets.length})
            </button>
            <button
              onClick={() => setActiveTab('claims')}
              className={`py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'claims'
                  ? 'border-primary-8 text-primary-8'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Claims ({claimableBets.length})
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="bg-white rounded-b-xl border border-gray-200 p-6">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <LoadingSpinner size="lg" text="Loading your bets..." />
            </div>
          ) : (
            <>
              {activeTab === 'active' && (
                <>
                  {activeBets.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {activeBets.map(bet => (
                        <BetCard key={bet.id} bet={bet} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={TrendingUp}
                      title="No Active Bets"
                      description="You don't have any active bets. Start exploring markets to place your predictions!"
                    />
                  )}
                </>
              )}

              {activeTab === 'ended' && (
                <>
                  {endedBets.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {endedBets.map(bet => (
                        <BetCard key={bet.id} bet={bet} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Clock}
                      title="No Ended Bets"
                      description="You don't have any ended bets waiting for resolution."
                    />
                  )}
                </>
              )}

              {activeTab === 'claims' && (
                <>
                  {claimableBets.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {claimableBets.map(bet => (
                        <BetCard key={bet.id} bet={bet} showClaimButton={true} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Award}
                      title="No Claimable Winnings"
                      description="You don't have any winnings to claim at the moment."
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
