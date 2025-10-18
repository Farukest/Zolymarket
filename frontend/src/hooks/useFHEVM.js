import { useState, useEffect, useRef } from 'react';
import { useWallet } from './useWallet';
import { initializeFHE, encryptBetData } from '../lib/fhe';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

export const useFHEVM = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fhevmInstance, setFhevmInstance] = useState(null);

  const { account: address, isConnected } = useWallet();
  const hasInitialized = useRef(false);

  useEffect(() => {
    const initFHEVM = async () => {
      // Only initialize once per wallet connection AND only when wallet is ready
      if (!isConnected || !address || isInitialized || isLoading) {
        console.log('🔄 FHEVM: Waiting for wallet connection...', { isConnected, address: !!address, isInitialized, isLoading });
        return;
      }

      // Check if already tried to initialize for this address
      if (hasInitialized.current) {
        console.log('🔄 FHEVM: Already initialized for this session');
        return;
      }

      hasInitialized.current = true;
      setIsLoading(true);
      setError(null);

      console.log('🚀 FHEVM: Initializing for wallet', address);

      try {
        // Wait for wallet to be fully ready
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Check if provider is ready before trying
        if (!window.ethereum || !window.ethereum.request) {
          throw new Error('Wallet provider not ready');
        }

        const instance = await initializeFHE();
        setFhevmInstance(instance);
        setIsInitialized(true);

        // Only log and show toast on VERY first initialization across all components
        if (!window.fhevmFirstInit) {
          console.log('✅ FHEVM: Successfully initialized!');
          toast.success('🔐 Privacy encryption ready', { id: 'fhevm-init' });
          window.fhevmFirstInit = true;
        }

      } catch (err) {
        // Only log error if it's not a provider readiness issue
        if (!err.message.includes('provider') && !err.message.includes('EIP-1193')) {
          console.error('❌ FHEVM: Initialization failed -', err.message);
        }
        setError(err.message);
        hasInitialized.current = false; // Allow retry
      } finally {
        setIsLoading(false);
      }
    };

    initFHEVM();
  }, [isConnected, address]);

  // Reset when wallet disconnects or address changes
  useEffect(() => {
    if (!isConnected || !address) {
      console.log('🔄 FHEVM: Resetting due to wallet disconnect or address change');
      hasInitialized.current = false;
      setIsInitialized(false);
      setFhevmInstance(null);
      setError(null);
      setIsLoading(false);
    }
  }, [isConnected, address]);

  // Calculate isReady before returning - must include fhevmInstance!
  const isReady = isConnected && address && isInitialized && !isLoading && !error && fhevmInstance;

  return {
    isInitialized,
    isLoading,
    error,
    fhevmInstance,
    isReady
  };
};