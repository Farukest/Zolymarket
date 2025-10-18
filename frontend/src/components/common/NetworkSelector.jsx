import React, { useState } from 'react';
import { useWallet } from '../../hooks/useWallet';
import { NETWORK_CONFIGS } from '../../config/contracts';

const NetworkSelector = () => {
  const { currentNetwork, switchNetwork, isConnected, networkInfo } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleNetworkSwitch = async (networkName) => {
    if (!isConnected) return;

    setIsLoading(true);
    try {
      await switchNetwork(networkName);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to switch network:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getNetworkIcon = (networkName) => {
    switch (networkName) {
      case 'localhost':
        return '⚪';
      case 'sepolia':
        return '⛓';
      default:
        return '⚪';
    }
  };

  const getNetworkColor = (networkName) => {
    switch (networkName) {
      case 'localhost':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'sepolia':
        return 'bg-blue-100 text-yellow-300 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!isConnected) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200 hover:shadow-sm ${getNetworkColor(currentNetwork)} ${
          isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'
        }`}
      >
        <span className="text-lg">{getNetworkIcon(currentNetwork)}</span>
        <span className="capitalize">{networkInfo?.name || currentNetwork}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-[9999] backdrop-blur-md">
          <div className="py-0">
            {Object.entries(NETWORK_CONFIGS).map(([key, config]) => (
              <button
                key={key}
                onClick={() => handleNetworkSwitch(key)}
                disabled={isLoading || currentNetwork === key}
                className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 flex items-center gap-3 first:rounded-t-xl last:rounded-b-xl ${
                  currentNetwork === key
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-yellow-300'
                    : 'text-gray-700 dark:text-gray-200'
                } ${isLoading ? 'opacity-50' : ''}`}
              >
                <span className="text-sm">{getNetworkIcon(key)}</span>
                <span className="font-medium">{config.name}</span>
                {currentNetwork === key && (
                  <div className="ml-auto">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9998]"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default NetworkSelector;