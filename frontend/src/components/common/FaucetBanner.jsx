import React, { useState, useEffect } from 'react';
import { X, ArrowUp } from 'lucide-react';
import { useWallet } from '../../hooks/useWallet';

const FaucetBanner = () => {
  const { isConnected } = useWallet();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('faucet_banner_dismissed');
    if (!dismissed && isConnected) {
      setIsVisible(true);
    }
  }, [isConnected]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('faucet_banner_dismissed', 'true');
  };

  if (!isVisible || !isConnected) return null;

  return (
    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 border-b border-emerald-200 dark:border-emerald-800/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-end py-1 relative">
          <div className="flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400 mr-3">
            <span>
              Need test USDC? Click the faucet 💧 button above to claim <span className="font-semibold">1000 USDC</span> every 24 hours
            </span>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 text-emerald-600 dark:text-emerald-500 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FaucetBanner;
