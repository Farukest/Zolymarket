import React, { useState, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { hasAnyAdminPrivileges, getUserRole, getUserDisplayInfo } from '../utils/adminUtils';
import Analytics from '../components/admin/Analytics';
import BetManagement from '../components/admin/BetManagement';
import BetCategoryAssignment from '../components/admin/BetCategoryAssignment';
import CategoryManagementSimple from '../components/admin/CategoryManagementSimple';
import UserManagement from '../components/admin/UserManagement';
import SystemSettings from '../components/admin/SystemSettings';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { adminAPI, categoryAPI } from '../services/api';
import { ethers } from 'ethers';
import { getNetworkConfig } from '../config/contracts';
import BetMarketCoreABI from '@artifacts/BetMarketCore.sol/BetMarketCore.json';
import { Toaster } from 'react-hot-toast';
import { getFhevmInstance } from '../lib/fhe.js';
import { Target, Flame, Users, DollarSign, FolderOpen, TrendingUp, Settings, BarChart3 } from 'lucide-react';

const Admin = () => {
  const { account, chainId } = useWallet();
  const currentAddress = account;
  const isAdmin = hasAnyAdminPrivileges(currentAddress);
  const userRole = getUserRole(currentAddress);
  const displayInfo = getUserDisplayInfo(currentAddress);
  const [activeTab, setActiveTab] = useState('bets');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBets: 0,
    activeBets: 0,
    totalUsers: 0,
    totalVolume: '0',
    categoryCount: 0
  });

  useEffect(() => {
    // Temporary bypass for development - allow admin access
    // if (!isAdmin) {
    //   window.location.href = '/';
    //   return;
    // }
    loadAdminData();
  }, [isAdmin, chainId]); // No contractBets dependency - prevents continuous refetch

  const loadAdminData = async () => {
    try {
      setLoading(true);

      // Get stats from contract
      const networkConfig = getNetworkConfig(chainId);
      const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      const contract = new ethers.Contract(
        networkConfig.contracts.BET_MARKET_CORE,
        BetMarketCoreABI.abi,
        provider
      );

      // 1. Total Bets from contract
      const totalBetsCount = Number(await contract.getTotalBets());

      // 2. Active Bets - count from contract without decrypt
      let activeBetsCount = 0;
      for (let i = 1; i <= totalBetsCount; i++) {
        try {
          const bet = await contract.getBet(i);
          if (bet.isActive && !bet.isResolved) {
            activeBetsCount++;
          }
        } catch (err) {
          console.warn(`Could not get bet ${i}:`, err);
        }
      }

      // 3. Total Volume - decrypt global total volume (single decrypt!)
      let totalVolume = 0;
      try {
        const instance = await getFhevmInstance();
        const globalVolumeHandle = await contract.globalTotalVolume();

        if (globalVolumeHandle && globalVolumeHandle !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
          const decryptedResult = await instance.publicDecrypt([globalVolumeHandle]);
          totalVolume = Number(decryptedResult[globalVolumeHandle] || 0) / 1000000; // Convert from 6 decimals
        }
      } catch (decryptError) {
        console.warn('Could not decrypt total volume:', decryptError);
        totalVolume = 0;
      }

      // 4. Unique Traders - get from contract directly
      const uniqueTraders = Number(await contract.getUniqueTradersCount());

      // 5. Categories from database
      let categoryCount = 0;
      try {
        const categoriesResponse = await categoryAPI.getAll();
        categoryCount = categoriesResponse.data?.categories?.length || 0;
      } catch (err) {
        console.warn('Could not fetch categories from DB:', err);
        categoryCount = 0; // Default to 0 if database not available
      }

      setStats({
        totalBets: totalBetsCount,
        activeBets: activeBetsCount,
        totalUsers: uniqueTraders,
        totalVolume: totalVolume.toFixed(2),
        categoryCount: categoryCount
      });
    } catch (error) {
      console.error('Admin data loading error:', error);
      // Fallback to defaults
      setStats({
        totalBets: 0,
        activeBets: 0,
        totalUsers: 0,
        totalVolume: '0.00',
        categoryCount: 0
      });
    } finally {
      setLoading(false);
    }
  };


  const formatAddress = (address) => {
    if (!address) return 'No address';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const tabs = [
    { id: 'bets', label: 'Bet Management', icon: Target },
    { id: 'categories', label: 'Categories', icon: FolderOpen },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'System Settings', icon: Settings }
  ];

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center site-background">
        <div className="text-center bg-white dark:bg-gray-900 p-8 rounded-xl border border-gray-200 dark:border-gray-700 max-w-md shadow-lg">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-500 mb-4">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don't have admin privileges to access this page.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
            Connected Address: {formatAddress(currentAddress)}
          </p>
          <button
            onClick={() => window.history.back()}
            className="bg-primary-8 hover:bg-primary-9 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <>
        <Toaster position="top-right" />
        <div className="min-h-screen site-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Skeleton Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-1"></div>
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                    </div>
                    <div className="ml-2">
                      <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Skeleton Tabs */}
            <div className="bg-white rounded-t-xl shadow mb-6 border border-gray-200">
              <div className="border-b border-gray-200">
                <nav className="flex gap-8 px-6">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="py-4 animate-pulse">
                      <div className="h-5 bg-gray-200 rounded w-32"></div>
                    </div>
                  ))}
                </nav>
              </div>
            </div>

            {/* Skeleton Content */}
            <div className="bg-white rounded-b-xl shadow p-6 border border-gray-200">
              <div className="space-y-4">
                <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-24 bg-gray-100 rounded animate-pulse"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <div className="min-h-screen site-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <div className="bg-white dark:bg-gray-900 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">Total Bets</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{stats.totalBets}</p>
              </div>
              <div className="ml-2">
                <Target className="w-4 h-4 text-gray-400 dark:text-gray-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">Active Bets</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{stats.activeBets}</p>
              </div>
              <div className="ml-2">
                <Flame className="w-4 h-4 text-gray-400 dark:text-gray-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">Total Users</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{stats.totalUsers}</p>
              </div>
              <div className="ml-2">
                <Users className="w-4 h-4 text-gray-400 dark:text-gray-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">Total Volume</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  ${stats.totalVolume}
                </p>
              </div>
              <div className="ml-2">
                <DollarSign className="w-4 h-4 text-gray-400 dark:text-gray-600" />
              </div>
            </div>
            {stats.totalVolume === '0.00' && (
              <p className="text-[9px] text-gray-400 dark:text-gray-600 text-center mt-1.5">Awaiting decrypt</p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">Categories</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{stats.categoryCount}</p>
              </div>
              <div className="ml-2">
                <FolderOpen className="w-4 h-4 text-gray-400 dark:text-gray-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white dark:bg-gray-900 rounded-t-xl border border-gray-200 dark:border-gray-700 border-b-0">
          <nav className="flex gap-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-8 text-primary-8'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-b-xl border border-gray-200 dark:border-gray-700 p-6">
          {activeTab === 'bets' && <BetCategoryAssignment onUpdate={loadAdminData} />}
          {activeTab === 'categories' && <CategoryManagementSimple onUpdate={loadAdminData} />}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'analytics' && <Analytics />}
          {activeTab === 'settings' && <SystemSettings />}
        </div>
        </div>
      </div>
    </>
  );
};

export default Admin;