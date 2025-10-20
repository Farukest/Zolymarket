import React, { useState, useEffect } from 'react';
import { Droplet, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { ethers } from 'ethers';
import { useWallet } from '../../hooks/useWallet';
import { getContracts } from '../../config/contracts';
import MockERC20ABI from '@artifacts/MockERC20.sol/MockERC20.json';

const FaucetButton = () => {
  const { account, signer, chainId, isConnected } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [lastClaimTime, setLastClaimTime] = useState(null);
  const [canClaim, setCanClaim] = useState(true);
  const [message, setMessage] = useState(null);

  // 24 hours in milliseconds
  const COOLDOWN_PERIOD = 24 * 60 * 60 * 1000;

  // Load last claim time from localStorage
  useEffect(() => {
    if (!account) return;

    const storageKey = `faucet_${account.toLowerCase()}`;
    const lastClaim = localStorage.getItem(storageKey);

    if (lastClaim) {
      const timestamp = parseInt(lastClaim);
      setLastClaimTime(timestamp);

      const timeSinceClaim = Date.now() - timestamp;
      setCanClaim(timeSinceClaim >= COOLDOWN_PERIOD);
    } else {
      setCanClaim(true);
    }
  }, [account]);

  // Check cooldown every minute
  useEffect(() => {
    if (!lastClaimTime) return;

    const interval = setInterval(() => {
      const timeSinceClaim = Date.now() - lastClaimTime;
      setCanClaim(timeSinceClaim >= COOLDOWN_PERIOD);
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [lastClaimTime]);

  const handleClaim = async () => {
    if (!signer || !account || !canClaim) return;

    try {
      setIsLoading(true);
      setMessage(null);

      const contracts = getContracts(chainId);
      const usdcContract = new ethers.Contract(
        contracts.USDC_TOKEN,
        MockERC20ABI.abi,
        signer
      );

      // Call faucet function
      const tx = await usdcContract.faucet();
      await tx.wait();

      // Update last claim time
      const now = Date.now();
      const storageKey = `faucet_${account.toLowerCase()}`;
      localStorage.setItem(storageKey, now.toString());
      setLastClaimTime(now);
      setCanClaim(false);

      setMessage({ type: 'success', text: '1000 USDC claimed successfully!' });

      // Clear success message after 5 seconds
      setTimeout(() => setMessage(null), 5000);

    } catch (error) {
      console.error('Faucet claim error:', error);

      let errorMessage = 'Failed to claim USDC';
      if (error.message.includes('You already have enough USDC')) {
        errorMessage = 'You already have enough USDC (max 10,000)';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction rejected';
      }

      setMessage({ type: 'error', text: errorMessage });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const getTimeRemaining = () => {
    if (!lastClaimTime || canClaim) return null;

    const timeSinceClaim = Date.now() - lastClaimTime;
    const timeRemaining = COOLDOWN_PERIOD - timeSinceClaim;

    const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
    const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));

    return `${hours}h ${minutes}m`;
  };

  if (!isConnected) {
    return null; // Don't show if wallet not connected
  }

  const timeRemaining = getTimeRemaining();

  return (
    <div className="relative">
      <button
        onClick={handleClaim}
        disabled={!canClaim || isLoading}
        className={`flex items-center justify-center p-2.5 rounded-lg font-medium transition-all ${
          !canClaim || isLoading
            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 faucet-shine'
        }`}
        title={!canClaim && timeRemaining ? `Next claim in ${timeRemaining}` : 'Claim 1000 USDC'}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Droplet className="w-5 h-5" />
        )}
      </button>

      {/* Message tooltip */}
      {message && (
        <div className={`absolute top-full mt-2 right-0 px-3 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap z-50 ${
          message.type === 'success'
            ? 'bg-emerald-500 text-white'
            : 'bg-red-500 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {message.text}
          </div>
        </div>
      )}
    </div>
  );
};

export default FaucetButton;
