import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Wallet, Power, Copy, ExternalLink, Shield, LayoutDashboard } from 'lucide-react';
import { useWallet } from '../../hooks/useWallet';
import { hasAnyAdminPrivileges, getUserDisplayInfo } from '../../utils/adminUtils';
import { useNavigate } from 'react-router-dom';
import { getFhevmInstance } from '../../lib/fhe';
import toast from 'react-hot-toast';

const WalletConnect = () => {
  const {
    account,
    isConnected,
    isConnecting,
    provider,
    signer,
    connect,
    disconnect,
    currentNetwork,
    networkInfo
  } = useWallet();

  const [showDropdown, setShowDropdown] = useState(false);
  const [balance, setBalance] = useState('0');
  const [fheInitialized, setFheInitialized] = useState(false);
  const navigate = useNavigate();

  // Check admin privileges
  const hasAdminAccess = hasAnyAdminPrivileges(account);
  const displayInfo = getUserDisplayInfo(account);

  // Get network color based on current network
  const getNetworkColor = () => {
    switch (currentNetwork) {
      case 'localhost':
        return 'bg-green-400';
      case 'sepolia':
        return 'bg-blue-400';
      default:
        return 'bg-gray-400';
    }
  };

  // Get balance when connected
  useEffect(() => {
    if (isConnected && provider && account) {
      getBalance();
    }
  }, [isConnected, provider, account]);

  // Check FHEVM status periodically (let useFHEVM hook handle initialization)
  useEffect(() => {
    if (isConnected && account) {
      const checkFHEVMStatus = async () => {
        try {
          const instance = await getFhevmInstance();
          setFheInitialized(!!instance);
        } catch {
          setFheInitialized(false);
        }
      };

      checkFHEVMStatus();
      const interval = setInterval(checkFHEVMStatus, 2000);
      return () => clearInterval(interval);
    } else {
      setFheInitialized(false);
    }
  }, [isConnected, account]);

  const getBalance = async () => {
    try {
      const balance = await provider.getBalance(account);
      const formattedBalance = ethers.formatEther(balance);
      setBalance(formattedBalance);
    } catch (error) {
      console.error('Error getting balance:', error);
      setBalance('0');
    }
  };

  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(account);
    toast.success('Address copied to clipboard');
  };

  const openEtherscan = () => {
    window.open(`https://sepolia.etherscan.io/address/${account}`, '_blank');
  };

  const handleConnect = async () => {
    try {
      await connect();
      toast.success('Wallet connected successfully');
    } catch (error) {
      toast.error('Failed to connect wallet');
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setShowDropdown(false);
    toast.success('Wallet disconnected');
  };

  const handleDashboard = () => {
    navigate('/dashboard');
    setShowDropdown(false);
  };

  const handleAdminPanel = () => {
    navigate('/admin');
    setShowDropdown(false);
    toast.success('Redirecting to Admin Panel');
  };

  if (!isConnected) {
    return (
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="flex items-center gap-2 bg-primary-8 hover:bg-primary-9 disabled:bg-primary-6 text-white px-4 py-2 rounded-lg font-medium transition-colors"
      >
        <Wallet className="w-4 h-4" />
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
      >
        <div className={`w-2 h-2 bg-green-400 rounded-full ${fheInitialized ? 'animate-pulse' : ''}`}></div>
        {formatAddress(account)}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200 dark:border-primary-7/50 rounded-lg shadow-xl z-50">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Connected</span>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 ${getNetworkColor()} rounded-full animate-pulse`}></div>
                <span className="text-sm text-primary-8 dark:text-primary-6 capitalize">
                  {networkInfo?.name || currentNetwork}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-sm">{formatAddress(account)}</span>
              {hasAdminAccess && (
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${displayInfo.bgColor} ${displayInfo.color}`}>
                  <span>{displayInfo.badge}</span>
                  {displayInfo.label}
                </span>
              )}
              <button
                onClick={copyAddress}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={openEtherscan}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Balance: {parseFloat(balance).toFixed(7)} ETH
            </div>
          </div>
          
          <div className="p-2 space-y-2">
            {hasAdminAccess && (
              <button
                onClick={handleAdminPanel}
                className="w-full flex items-center gap-2 px-3 py-2 text-primary-8 dark:text-primary-6 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
              >
                <Shield className="w-4 h-4" />
                Admin Panel
              </button>
            )}
            <button
              onClick={handleDashboard}
              className="w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={handleDisconnect}
              className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Power className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;