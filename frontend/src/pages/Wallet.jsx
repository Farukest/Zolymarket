import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useWallet } from '../hooks/useWallet';
import { getContracts } from '../config/contracts.js';
import { BalanceCache } from '../utils/balanceCache';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/common/LoadingSpinner';

const Wallet = () => {
    const {
        account,
        isConnected,
        connect,
        getBetMarketContract,
        signer,
        chainId,
        currentNetwork,
        networkInfo,
        ethers
    } = useWallet();

    const [balances, setBalances] = useState({
        wallet: '0',
        platform: null,
        platformEncrypted: null
    });

    const [depositAmount, setDepositAmount] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingBalances, setIsLoadingBalances] = useState(false);
    const [isDecrypting, setIsDecrypting] = useState(false);

    // Load cached balance on mount
    useEffect(() => {
        if (account && chainId) {
            const cached = BalanceCache.get(account, chainId);
            if (cached) {
                console.log('Loading cached balance:', cached);
                setBalances(prev => ({ ...prev, platform: cached }));
            }
        }
    }, [account, chainId]);

    useEffect(() => {
        if (isConnected && account && chainId) {
            const timeoutId = setTimeout(() => {
                loadBalances();
            }, 500);
            return () => clearTimeout(timeoutId);
        }
    }, [isConnected, account, chainId]);

    // Background balance refresh disabled - user must manually decrypt
    // useEffect(() => {
    //     if (!isConnected || !account || !chainId) return;

    //     const interval = setInterval(async () => {
    //         try {
    //             const contract = getBetMarketContract();
    //             const contractAddress = await contract.getAddress();

    //             const { decryptUserBalance } = await import('../lib/fhe.js');
    //             const clearBalance = await decryptUserBalance(contractAddress, account);
    //             const formatted = (parseInt(clearBalance) / 1000000).toFixed(2);

    //             BalanceCache.save(account, chainId, formatted);
    //             setBalances(prev => ({ ...prev, platform: formatted }));
    //             console.log('Background balance refresh completed');
    //         } catch (error) {
    //             console.warn('Background balance refresh failed:', error);
    //         }
    //     }, 5 * 60 * 1000); // 5 minutes

    //     return () => clearInterval(interval);
    // }, [isConnected, account, chainId]);

    const loadBalances = async () => {
        if (!isConnected || !account || !chainId) return;

        setIsLoadingBalances(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 300));

            const contract = getBetMarketContract();
            const usdcContract = await getUSDCContract();

            let walletBalance;
            try {
                walletBalance = await usdcContract.balanceOf(account);
            } catch (error) {
                console.warn('Failed to get wallet balance:', error.message);
                walletBalance = 0;
            }

            const walletFormatted = ethers.formatUnits(walletBalance, 6);

            let encryptedBalance;
            try {
                encryptedBalance = await contract.getMyEncryptedBalance();
            } catch (error) {
                console.warn('Failed to get encrypted balance:', error.message);
                encryptedBalance = null;
            }

            // Get cached platform balance
            const cachedPlatform = BalanceCache.get(account, chainId);

            setBalances({
                wallet: walletFormatted,
                platform: cachedPlatform,
                platformEncrypted: encryptedBalance
            });

        } catch (error) {
            console.error('Error loading balances:', error);
            if (!error.message?.includes('network changed') && !error.message?.includes('NETWORK_ERROR')) {
                toast.error('Failed to load balances');
            }
            setBalances({ wallet: '0', platform: null, platformEncrypted: null });
        } finally {
            setIsLoadingBalances(false);
        }
    };

    const handleDecryptBalance = async () => {
        if (!balances.platformEncrypted) {
            toast.error('No encrypted balance to decrypt');
            return;
        }

        if (balances.platform !== null) {
            toast.info('Balance already decrypted');
            return;
        }

        setIsDecrypting(true);
        try {
            const { decryptUserBalance } = await import('../lib/fhe.js');
            const contract = getBetMarketContract();
            const contractAddress = await contract.getAddress();

            const clearBalance = await decryptUserBalance(contractAddress, account);
            const balanceFormatted = (parseInt(clearBalance) / 1000000).toFixed(2);

            setBalances(prev => ({ ...prev, platform: balanceFormatted }));
            BalanceCache.save(account, chainId, balanceFormatted);
            toast.success('Balance decrypted successfully');

        } catch (error) {
            console.error('Failed to decrypt balance:', error);
            let errorMessage = 'Failed to decrypt balance';
            if (error.message?.includes('not authorized')) {
                errorMessage = 'You are not authorized to decrypt this balance';
            } else if (error.message?.includes('user rejected')) {
                errorMessage = 'Signature request rejected';
            }
            toast.error(errorMessage);
        } finally {
            setIsDecrypting(false);
        }
    };

    const getUSDCContract = async () => {
        const contracts = getContracts(chainId);
        const usdcAddress = contracts.USDC_TOKEN;
        const usdcAbi = [
            'function balanceOf(address owner) view returns (uint256)',
            'function transfer(address to, uint256 amount) returns (bool)',
            'function approve(address spender, uint256 amount) returns (bool)',
            'function allowance(address owner, address spender) view returns (uint256)'
        ];
        return new ethers.Contract(usdcAddress, usdcAbi, signer);
    };

    const handleDeposit = async () => {
        if (!isConnected) {
            toast.error('Please connect your wallet');
            return;
        }

        if (!depositAmount || parseFloat(depositAmount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        setIsLoading(true);
        try {
            const contract = getBetMarketContract();
            const usdcContract = await getUSDCContract();
            const contractAddress = await contract.getAddress();
            const amount = ethers.parseUnits(depositAmount, 6);

            const walletBalance = await usdcContract.balanceOf(account);
            if (walletBalance < amount) {
                toast.error('Insufficient USDC balance');
                return;
            }

            const allowance = await usdcContract.allowance(account, contractAddress);
            if (allowance < amount) {
                toast.loading('Approving USDC spending...', { id: 'approve' });
                const approveTx = await usdcContract.approve(contractAddress, amount, {
                    gasLimit: 100000,
                    gasPrice: ethers.parseUnits("20", "gwei")
                });
                await approveTx.wait();
                toast.success('USDC spending approved', { id: 'approve' });
            }

            toast.loading('Processing deposit...', { id: 'deposit' });
            const depositTx = await contract.deposit(amount, { gasLimit: 300000 });
            await depositTx.wait();

            toast.success(`Successfully deposited ${depositAmount} USDC`, { id: 'deposit' });
            setDepositAmount('');

            // Optimistic update
            const newBalance = BalanceCache.optimisticUpdate(
                account,
                chainId,
                parseFloat(depositAmount)
            );

            if (newBalance) {
                setBalances(prev => ({ ...prev, platform: newBalance }));
            } else {
                setBalances(prev => ({ ...prev, platform: null }));
            }

            await loadBalances();

        } catch (error) {
            console.error('Deposit error:', error);
            if (error.code === 4001) {
                toast.error('Transaction cancelled by user');
            } else if (error.message?.includes('insufficient funds')) {
                toast.error('Insufficient funds for transaction');
            } else {
                toast.error(error.message || 'Deposit failed');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleWithdraw = async () => {
        if (!isConnected) {
            toast.error('Please connect your wallet');
            return;
        }

        if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        if (balances.platform === null) {
            toast.error('Please decrypt your balance first to see available amount');
            return;
        }

        const platformBalance = parseFloat(balances.platform);
        const requestedAmount = parseFloat(withdrawAmount);

        if (requestedAmount > platformBalance) {
            toast.error(`Insufficient platform balance. You have ${platformBalance} USDC`);
            return;
        }

        setIsLoading(true);
        try {
            const contract = getBetMarketContract();
            const amount = ethers.parseUnits(withdrawAmount, 6);

            toast.loading('Processing withdrawal...', { id: 'withdraw' });
            const withdrawTx = await contract.withdraw(amount, { gasLimit: 300000 });
            await withdrawTx.wait();

            toast.success(`Successfully withdrew ${withdrawAmount} USDC`, { id: 'withdraw' });
            setWithdrawAmount('');

            // Optimistic update
            const newBalance = BalanceCache.optimisticUpdate(
                account,
                chainId,
                -parseFloat(withdrawAmount)
            );

            if (newBalance) {
                setBalances(prev => ({ ...prev, platform: newBalance }));
            } else {
                setBalances(prev => ({ ...prev, platform: null }));
            }

            await loadBalances();

        } catch (error) {
            console.error('Withdraw error:', error);
            if (error.code === 4001) {
                toast.error('Transaction cancelled by user');
            } else {
                toast.error(error.message || 'Withdrawal failed');
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (!isConnected) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-2xl mx-auto">
                    <Card className="text-center p-8">
                        <div className="text-6xl mb-4">🔗</div>
                        <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Connect your wallet to manage your USDC deposits and withdrawals
                        </p>
                        <Button onClick={connect} className="bg-blue-600 hover:bg-blue-700">
                            Connect Wallet
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold">Account Balance</h1>
                            <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full network-indicator">
                                <div className={`w-2 h-2 rounded-full animate-pulse ${
                                    currentNetwork === 'localhost' ? 'bg-green-400' : currentNetwork === 'sepolia' ? 'bg-blue-400' : 'bg-gray-400'
                                }`}></div>
                                <span className="text-sm font-medium capitalize text-gray-600 dark:text-gray-400">
                                    {networkInfo?.name || currentNetwork}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={loadBalances}
                            disabled={isLoadingBalances}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                        >
                            <svg className={`w-5 h-5 ${isLoadingBalances ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                            </svg>
                        </button>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">
                        Manage your USDC deposits and withdrawals for betting
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <Card className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Wallet Balance</h3>
                                <div className="text-2xl font-bold text-white">
                                    {isLoadingBalances ? <LoadingSpinner size="sm" /> : `${parseFloat(balances.wallet).toFixed(2)} USDC`}
                                </div>
                            </div>
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                                </svg>
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Available in your wallet</p>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Platform Balance</h3>
                                <div className="text-2xl font-bold text-white">
                                    {isLoadingBalances ? (
                                        <LoadingSpinner size="sm" />
                                    ) : balances.platform === null ? (
                                        <span className="flex items-center gap-2 text-lg">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                            </svg>
                                            Encrypted
                                        </span>
                                    ) : (
                                        `${parseFloat(balances.platform).toFixed(2)} USDC`
                                    )}
                                </div>
                            </div>
                            <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                                </svg>
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                            {balances.platform === null ? 'Balance is encrypted for privacy' : 'Available for betting'}
                        </p>

                        {balances.platform === null && balances.platformEncrypted && (
                            <button
                                onClick={handleDecryptBalance}
                                disabled={isDecrypting}
                                className="w-full px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            >
                                {isDecrypting ? (
                                    <>
                                        <LoadingSpinner size="sm" />
                                        Decrypting...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                        </svg>
                                        Decrypt Balance
                                    </>
                                )}
                            </button>
                        )}

                        {balances.platform !== null && (
                            <div className="text-xs text-gray-500 mt-2">
                                Last updated: {BalanceCache.getInfo(account, chainId)?.lastUpdated || 'Just now'}
                            </div>
                        )}
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="p-6">
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-white">Deposit</h3>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Transfer USDC from wallet to platform</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Amount (USDC)</label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={depositAmount}
                                    onChange={(e) => setDepositAmount(e.target.value)}
                                    min="0"
                                    step="0.01"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Available: {parseFloat(balances.wallet).toFixed(2)} USDC
                                </p>
                            </div>

                            <div className="flex gap-2">
                                {['10', '50', '100'].map((amount) => (
                                    <button
                                        key={amount}
                                        onClick={() => setDepositAmount(amount)}
                                        className="px-3 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900 hover:border-blue-300 dark:hover:border-blue-400 text-gray-700 dark:text-gray-200 rounded-lg transition-all duration-200 font-medium shadow-sm hover:shadow"
                                        style={{backgroundColor: 'rgb(31 41 55)', borderColor: 'rgb(75 85 99)'}}
                                    >
                                        ${amount}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setDepositAmount(balances.wallet)}
                                    className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 font-medium shadow-sm hover:shadow"
                                >
                                    Max
                                </button>
                            </div>

                            <Button
                                onClick={handleDeposit}
                                disabled={isLoading || !depositAmount}
                                className="w-full bg-green-600 hover:bg-green-700"
                            >
                                {isLoading ? <LoadingSpinner size="sm" /> : 'Deposit USDC'}
                            </Button>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-white">Withdraw</h3>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Transfer USDC from platform to wallet</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Amount (USDC)</label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    min="0"
                                    step="0.01"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {balances.platform !== null
                                        ? `Available: ${parseFloat(balances.platform).toFixed(2)} USDC`
                                        : 'Decrypt balance to see available amount'
                                    }
                                </p>
                            </div>

                            <div className="flex gap-2">
                                {['10', '50', '100'].map((amount) => (
                                    <button
                                        key={amount}
                                        onClick={() => setWithdrawAmount(amount)}
                                        className="px-3 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-red-50 dark:hover:bg-red-900 hover:border-red-300 dark:hover:border-red-400 text-gray-700 dark:text-gray-200 rounded-lg transition-all duration-200 font-medium shadow-sm hover:shadow"
                                        style={{backgroundColor: 'rgb(31 41 55)', borderColor: 'rgb(75 85 99)'}}
                                    >
                                        ${amount}
                                    </button>
                                ))}
                                <button
                                    onClick={() => balances.platform && setWithdrawAmount(balances.platform)}
                                    disabled={balances.platform === null}
                                    className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 font-medium shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Max
                                </button>
                            </div>

                            <Button
                                onClick={handleWithdraw}
                                disabled={isLoading || !withdrawAmount || balances.platform === null}
                                className="w-full bg-red-600 hover:bg-red-700"
                            >
                                {isLoading ? <LoadingSpinner size="sm" /> : 'Withdraw USDC'}
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Wallet;