import React, { useState, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useFHEVM } from '../hooks/useFHEVM';
import BetCard from '../components/home/BetCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { userAPI, betAPI } from '../services/api';
import { formatDistanceToNow } from 'date-fns';

const Profile = () => {
  const { isConnected, address, disconnect } = useWallet();
  const { getUserBets, getBet, claimWinnings } = useFHEVM();
  
  const [profile, setProfile] = useState(null);
  const [userBets, setUserBets] = useState([]);
  const [stats, setStats] = useState({
    totalBets: 0,
    activeBets: 0,
    wonBets: 0,
    totalVolume: '0',
    totalWinnings: '0',
    winRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [filter, setFilter] = useState('all'); // all, active, won, lost
  const [claimableWinnings, setClaimableWinnings] = useState([]);

  useEffect(() => {
    if (!isConnected || !address) {
      setLoading(false);
      return;
    }
    loadUserData();
  }, [isConnected, address]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadProfile(),
        loadUserBets(),
        loadUserStats(),
        loadClaimableWinnings()
      ]);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async () => {
    try {
      const profileData = await userAPI.getProfile(address);
      setProfile(profileData);
    } catch (error) {
      console.error('Error loading profile:', error);
      // Create default profile if doesn't exist
      setProfile({
        address,
        joinedAt: new Date().toISOString(),
        username: null,
        avatar: null
      });
    }
  };

  const loadUserBets = async () => {
    try {
      const betsData = await getUserBets();
      console.log('📊 User bets loaded:', betsData);

      // Convert the basic user bet data to full bet information
      const enrichedBets = await Promise.all(
        betsData.map(async (userBet) => {
          try {
            const betDetails = await getBet(userBet.betId);
            return {
              ...betDetails,
              userBetInfo: userBet,
              isWon: betDetails.isResolved ?
                (betDetails.options && betDetails.options[userBet.optionIndex]?.isWinner) :
                null,
              selectedOption: userBet.optionIndex,
              userShares: userBet.shares,
              timestamp: userBet.timestamp
            };
          } catch (error) {
            console.error(`Error loading bet ${userBet.betId}:`, error);
            return null;
          }
        })
      );

      // Filter out failed loads
      const validBets = enrichedBets.filter(bet => bet !== null);
      setUserBets(validBets);
    } catch (error) {
      console.error('Error loading user bets:', error);
    }
  };

  const loadUserStats = async () => {
    try {
      // Calculate stats from actual user bets data
      const userBetsData = await getUserBets();

      const totalBets = userBetsData.length;
      let activeBets = 0;
      let wonBets = 0;

      for (const userBet of userBetsData) {
        try {
          const betDetails = await getBet(userBet.betId);

          if (betDetails.isActive && !betDetails.isResolved) {
            activeBets++;
          }

          if (betDetails.isResolved && betDetails.options?.[userBet.optionIndex]?.isWinner) {
            wonBets++;
          }
        } catch (error) {
          console.error(`Error checking bet ${userBet.betId} for stats:`, error);
        }
      }

      const winRate = totalBets > 0 ? Math.round((wonBets / totalBets) * 100) : 0;

      setStats({
        totalBets,
        activeBets,
        wonBets,
        totalVolume: '0', // Would need decryption for actual volume
        totalWinnings: '0', // Would need decryption for actual winnings
        winRate
      });
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const loadClaimableWinnings = async () => {
    try {
      // For now, check which bets the user won but hasn't claimed
      const userBetsData = await getUserBets();
      const claimable = [];

      for (const userBet of userBetsData) {
        try {
          const betDetails = await getBet(userBet.betId);
          if (betDetails.isResolved &&
              betDetails.options?.[userBet.optionIndex]?.isWinner &&
              !userBet.claimed) {
            claimable.push({
              betId: userBet.betId,
              amount: '0.0', // Would need decryption to show actual amount
              title: betDetails.title
            });
          }
        } catch (error) {
          console.error(`Error checking bet ${userBet.betId} for winnings:`, error);
        }
      }

      setClaimableWinnings(claimable);
    } catch (error) {
      console.error('Error loading claimable winnings:', error);
    }
  };

  const handleClaimWinnings = async (betId) => {
    try {
      const result = await claimWinnings(betId);

      if (result.success) {
        // Refresh data
        await loadClaimableWinnings();
        await loadUserStats();
        await loadUserBets();

        alert('Winnings claimed successfully!');
      }
    } catch (error) {
      console.error('Error claiming winnings:', error);
      alert('Failed to claim winnings: ' + error.message);
    }
  };

  const getFilteredBets = () => {
    let filtered = [...userBets];
    
    switch (filter) {
      case 'active':
        filtered = filtered.filter(bet => 
          bet.isActive && new Date() < new Date(bet.endTime)
        );
        break;
      case 'won':
        filtered = filtered.filter(bet => bet.isWon === true);
        break;
      case 'lost':
        filtered = filtered.filter(bet => bet.isWon === false);
        break;
      default:
        // all - no additional filtering
        break;
    }
    
    return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Connect Your Wallet</h2>
          <p className="text-gray-600 mb-6">Please connect your wallet to view your profile</p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const filteredBets = getFilteredBets();

  return (
    <div className="min-h-screen site-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {profile?.username ? profile.username[0].toUpperCase() : '👤'}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {profile?.username || formatAddress(address)}
                </h1>
                <p className="text-gray-600">{formatAddress(address)}</p>
                <p className="text-sm text-gray-500">
                  Member since {formatDistanceToNow(new Date(profile?.joinedAt || Date.now()))} ago
                </p>
              </div>
            </div>
            
            <button
              onClick={disconnect}
              className="text-red-600 hover:text-red-700 font-medium"
            >
              Disconnect Wallet
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="text-2xl mr-3">🎯</div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Bets</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalBets}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="text-2xl mr-3">🔥</div>
              <div>
                <p className="text-sm font-medium text-gray-600">Active Bets</p>
                <p className="text-2xl font-bold text-blue-600">{stats.activeBets}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="text-2xl mr-3">🏆</div>
              <div>
                <p className="text-sm font-medium text-gray-600">Win Rate</p>
                <p className="text-2xl font-bold text-green-600">{stats.winRate}%</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="text-2xl mr-3">💰</div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Winnings</p>
                <p className="text-2xl font-bold text-purple-600">{stats.totalWinnings} USDC</p>
              </div>
            </div>
          </div>
        </div>

        {/* Claimable Winnings */}
        {claimableWinnings.length > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-green-800 mb-2">
                  🎉 Congratulations! You have winnings to claim
                </h3>
                <p className="text-green-700">
                  {claimableWinnings.length} bet{claimableWinnings.length > 1 ? 's' : ''} with claimable winnings
                </p>
              </div>
              <div className="space-y-2">
                {claimableWinnings.map((winning, index) => (
                  <button
                    key={index}
                    onClick={() => handleClaimWinnings(winning.betId)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors block"
                  >
                    Claim {winning.amount} USDC
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'bets', label: 'My Bets' },
                { id: 'settings', label: 'Settings' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm">
          {activeTab === 'overview' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Account Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Recent Activity</h4>
                  <div className="space-y-3">
                    {userBets.slice(0, 5).map((bet, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100">
                        <div>
                          <p className="font-medium text-sm">{bet.title}</p>
                          <p className="text-xs text-gray-600">
                            {formatDistanceToNow(new Date(bet.timestamp))} ago
                          </p>
                        </div>
                        <span className={`text-sm font-medium ${
                          bet.isWon === true ? 'text-green-600' : 
                          bet.isWon === false ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {bet.isWon === true ? 'Won' : bet.isWon === false ? 'Lost' : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Performance</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Volume</span>
                      <span className="font-medium">{stats.totalVolume} USDC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bets Won</span>
                      <span className="font-medium text-green-600">{stats.wonBets}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bets Lost</span>
                      <span className="font-medium text-red-600">
                        {stats.totalBets - stats.wonBets - stats.activeBets}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bets' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">My Bets</h3>
                
                {/* Filter */}
                <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'active', label: 'Active' },
                    { id: 'won', label: 'Won' },
                    { id: 'lost', label: 'Lost' }
                  ].map((filterOption) => (
                    <button
                      key={filterOption.id}
                      onClick={() => setFilter(filterOption.id)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        filter === filterOption.id
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {filterOption.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {filteredBets.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">🎯</div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">No bets found</h4>
                  <p className="text-gray-600">
                    {filter === 'all' 
                      ? "You haven't placed any bets yet." 
                      : `No ${filter} bets found.`
                    }
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredBets.map((bet, index) => (
                    <BetCard
                      key={index}
                      bet={bet}
                      showUserBet={true}
                      onClick={() => window.location.href = `/bet/${bet.id}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Account Settings</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username (optional)
                  </label>
                  <input
                    type="text"
                    value={profile?.username || ''}
                    onChange={(e) => setProfile(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Enter a username"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Wallet Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>
                
                <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;