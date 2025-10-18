import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import BetSuccessModal from '../BetSuccessModal';
import statisticsService from '../../services/statisticsService';
import {
    Clock,
    Users,
    DollarSign,
    Target,
    AlertCircle,
    CheckCircle,
    TrendingUp,
    BarChart3,
    Activity,
    Shield,
    Zap,
    Info,
    Wallet,
    Plus,
    Minus,
    ArrowRight,
    Eye,
    Lock,
    Network,
    RefreshCw,
    ExternalLink
} from 'lucide-react';
import { useWallet } from '../../hooks/useWallet';
import { useFHEVM } from '../../hooks/useFHEVM';
import { BalanceCache } from '../../utils/balanceCache';
import { UserTransactionsCacheInstance } from '../../utils/userTransactionsCache';
import Button from '../ui/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import { formatDistanceToNow } from 'date-fns';

const BetDetail = ({ betId }) => {
    const { account, isConnected, isConnecting, connect, getBetMarketContract, getBetMarketStatsContract, requestPayout, claimPayout, getPayoutStatus, chainId, currentNetwork } = useWallet();
    const {
        fhevmInstance,
        isInitialized: isFhevmInitialized,
        loading: fhevmLoading,
        error: fhevmError,
        encryptAmount,
        encryptBool,
        formatEncryptedAmount,
        placeBet,
        getBet,
        getBets,
        getRealVolumeForBet,
        isReady
    } = useFHEVM();
    const [bet, setBet] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedOption, setSelectedOption] = useState(null);
    const [selectedOutcome, setSelectedOutcome] = useState(null);
    const [betAmount, setBetAmount] = useState('');
    const [placing, setPlacing] = useState(false);
    const [showOrderBook, setShowOrderBook] = useState(false);
    const [potentialReturn, setPotentialReturn] = useState(0);
    const [connectionError, setConnectionError] = useState(null);
    const [cachedBalance, setCachedBalance] = useState(null);
    const [isDecrypting, setIsDecrypting] = useState(false);
    const [statistics, setStatistics] = useState({
        totalVolume: 0,
        totalBets: 0,
        uniqueTraders: 0,
        hoursRemaining: 0,
        isRealTime: false,
        optionTotals: []
    });
    const [isUpdating, setIsUpdating] = useState(false);

    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successData, setSuccessData] = useState({
        transactionHash: '',
        betAmount: '',
        betOption: ''
    });

    const [activeTab, setActiveTab] = useState('positions');
    const [userPositions, setUserPositions] = useState(null);
    const [loadingPosition, setLoadingPosition] = useState(false);
    const [decryptingPositions, setDecryptingPositions] = useState({});
    const [decryptingAll, setDecryptingAll] = useState(false);
    const [orderHistory, setOrderHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [isPositionUpdating, setIsPositionUpdating] = useState(false);
    const [decryptingBalance, setDecryptingBalance] = useState(false);
    const [payoutStatus, setPayoutStatus] = useState(null);
    const [loadingPayoutStatus, setLoadingPayoutStatus] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [requesting, setRequesting] = useState(false);
    const [userIsLoser, setUserIsLoser] = useState(false); // MongoDB check: true if user lost this bet

    useEffect(() => {
        if (betId) {
            fetchBetDetail();
        }
    }, [betId]);

    useEffect(() => {
        if (isConnected && account && chainId) {
            const cached = BalanceCache.get(account, chainId);
            setCachedBalance(cached);
        }
    }, [isConnected, account, chainId]);

    useEffect(() => {
        if (isConnected && account && bet) {
            loadUserPosition();
            loadOrderHistory();
        }
    }, [isConnected, account, bet]);

    useEffect(() => {
        if (selectedOption !== null && betAmount && bet?.options?.[selectedOption]) {
            const option = bet.options[selectedOption];
            const betAmountFloat = parseFloat(betAmount);

            // PARIMUTUEL CALCULATION: (userAmount / totalWinnerAmount) × (totalPool - liquidity)

            // 1. Current total pool
            const currentPool = statistics.totalVolume || 0;

            // 2. Current winner pool (depends on bet type and outcome)
            let currentWinnerPool = 0;
            if (Number(bet.betType) === 0 || Number(bet.betType) === 1) {
                // BINARY/MULTIPLE: winner pool = option's total shares
                currentWinnerPool = option.totalShares || 0;
            } else {
                // NESTED: winner pool = YES or NO shares
                if (selectedOutcome === 'yes') {
                    currentWinnerPool = option.yesShares || 0;
                } else if (selectedOutcome === 'no') {
                    currentWinnerPool = option.noShares || 0;
                } else {
                    setPotentialReturn(0);
                    return;
                }
            }

            // 3. After bet state
            const newPool = currentPool + betAmountFloat;
            const newWinnerPool = currentWinnerPool + betAmountFloat;

            // 4. Subtract liquidity (returned to creator, not distributed to winners)
            const liquidityParam = bet.liquidityParam || 100;
            const actualPool = newPool - liquidityParam;

            // 5. Estimated payout: your share of the winner pool
            if (newWinnerPool > 0 && actualPool > 0) {
                const estimatedPayout = (betAmountFloat / newWinnerPool) * actualPool;
                const netProfit = estimatedPayout - betAmountFloat;
                setPotentialReturn(Math.max(0, netProfit));
            } else {
                setPotentialReturn(0);
            }
        } else {
            setPotentialReturn(0);
        }
    }, [selectedOption, selectedOutcome, betAmount, bet, statistics.totalVolume]);

    // Check payout status when bet is resolved
    useEffect(() => {
        const checkPayoutStatus = async () => {
            if (!bet || !bet.isResolved || !isConnected || !account) {
                setPayoutStatus(null);
                setUserIsLoser(false);
                return;
            }

            try {
                setLoadingPayoutStatus(true);

                // ✅ STEP 1: Check MongoDB first to see if user lost (avoid showing "Request Payout" to losers)
                try {
                    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
                    const positionResponse = await fetch(`${backendUrl}/api/user-positions/${account}/${bet.contractId}`);
                    if (positionResponse.ok) {
                        const positionData = await positionResponse.json();
                        if (positionData.success && positionData.hasPosition && positionData.isResolved) {
                            // User has a position and bet is resolved - check if they won
                            if (!positionData.isWinner) {
                                console.log(`User lost bet ${bet.contractId} - hiding payout options`);
                                setUserIsLoser(true);
                                setPayoutStatus(null);
                                setLoadingPayoutStatus(false);
                                return; // Don't check payout status - user lost
                            } else {
                                setUserIsLoser(false);
                            }
                        }
                    }
                } catch (mongoErr) {
                    console.warn(`MongoDB check failed for bet ${bet.contractId}, falling back to contract:`, mongoErr);
                    setUserIsLoser(false); // If MongoDB fails, allow user to proceed (fail-open)
                }

                // ✅ STEP 2: Check payout status from contract (only for winners or if MongoDB check failed)
                const status = await getPayoutStatus(bet.contractId, account);
                console.log('📊 Payout Status for bet', bet.contractId, ':', status);
                setPayoutStatus(status);
            } catch (error) {
                console.error('Error checking payout status:', error);
                setPayoutStatus(null);
            } finally {
                setLoadingPayoutStatus(false);
            }
        };

        checkPayoutStatus();
    }, [bet, isConnected, account]);

    const handleRequestPayout = async () => {
        if (!bet || !bet.contractId) {
            alert('Bet information is missing');
            return;
        }

        try {
            setRequesting(true);
            await requestPayout(bet.contractId);

            alert('✅ Payout request submitted! The decryption process will take ~1-2 minutes. Please refresh the page after a moment to claim your winnings.');

            // Refresh payout status after a delay
            setTimeout(async () => {
                const status = await getPayoutStatus(bet.contractId, account);
                setPayoutStatus(status);
            }, 5000);
        } catch (error) {
            console.error('Error requesting payout:', error);
            let errorMessage = 'Failed to request payout. Please try again.';

            if (error.message?.includes('user rejected')) {
                errorMessage = 'Transaction cancelled by user.';
            } else if (error.message?.includes('insufficient funds')) {
                errorMessage = 'Insufficient funds for gas fees.';
            } else if (error.message?.includes('Already requested')) {
                errorMessage = 'Payout already requested. Please wait for processing.';
            }

            alert(`❌ ${errorMessage}`);
        } finally {
            setRequesting(false);
        }
    };

    const handleClaim = async () => {
        if (!bet || !bet.contractId) {
            alert('Bet information is missing');
            return;
        }

        try {
            setClaiming(true);
            await claimPayout(bet.contractId);

            // Refresh payout status after claim
            const status = await getPayoutStatus(bet.contractId, account);
            setPayoutStatus(status);

            // Refresh balance
            if (cachedBalance !== null) {
                // Optimistically update balance
                const claimedAmount = parseFloat(payoutStatus.payoutAmount) / 1000000;
                const newBalance = BalanceCache.optimisticUpdate(account, chainId, claimedAmount);
                if (newBalance) {
                    setCachedBalance(newBalance);
                }
            }

            alert(`✅ Successfully claimed $${(parseFloat(payoutStatus.payoutAmount) / 1000000).toFixed(2)} USDC!`);
        } catch (error) {
            console.error('Error claiming payout:', error);
            let errorMessage = 'Failed to claim payout. Please try again.';

            if (error.message?.includes('user rejected')) {
                errorMessage = 'Transaction cancelled by user.';
            } else if (error.message?.includes('insufficient funds')) {
                errorMessage = 'Insufficient funds for gas fees.';
            } else if (error.message?.includes('No winnings')) {
                errorMessage = 'No winnings to claim.';
            } else if (error.message?.includes('Already claimed')) {
                errorMessage = 'You have already claimed your winnings.';
            }

            alert(errorMessage);
        } finally {
            setClaiming(false);
        }
    };

    const loadOrderHistory = async () => {
        if (!bet || !account) return;

        // Load from cache
        const cachedTransactions = UserTransactionsCacheInstance.getTransactions(account, betId);

        if (cachedTransactions.length === 0) {
            setOrderHistory([]);
            return;
        }

        // Format transactions for display
        const history = cachedTransactions.map(tx => {
            const optionIndex = tx.optionIndex;
            const outcome = tx.outcome;

            let optionTitle = 'Unknown Option';
            let outcomeText = '';

            if (bet && bet.options && bet.options[optionIndex]) {
                optionTitle = bet.options[optionIndex].title;

                if (Number(bet.betType) === 2 && outcome !== null && outcome !== undefined) {
                    outcomeText = outcome === 0 ? ' (YES)' : ' (NO)';
                }
            } else {
                optionTitle = `Option ${optionIndex + 1}`;
            }

            return {
                timestamp: tx.timestamp,
                optionIndex: optionIndex,
                optionTitle: optionTitle + outcomeText,
                amount: tx.amount,
                isRevealed: tx.isRevealed,
                txHash: tx.txHash
            };
        });

        history.sort((a, b) => b.timestamp - a.timestamp);
        setOrderHistory(history);
    };

    const loadUserPosition = async () => {
        if (!bet || !account) return;

        // Load from cache only - no contract calls
        const cachedTransactions = UserTransactionsCacheInstance.getTransactions(account, betId);

        if (cachedTransactions.length === 0) {
            setUserPositions(null);
            return;
        }

        // Aggregate positions from transactions
        const positionsMap = {};

        cachedTransactions.forEach(tx => {
            const optionIndex = tx.optionIndex;
            const outcome = tx.outcome;
            const amount = tx.amount;
            const priceAtBet = tx.priceAtBet;

            let key;
            if (Number(bet.betType) === 2) {
                // NESTED: group by optionIndex + outcome
                key = `nested-${optionIndex}-${outcome}`;
            } else {
                // BINARY/MULTIPLE: group by optionIndex
                key = `normal-${optionIndex}`;
            }

            if (!positionsMap[key]) {
                positionsMap[key] = {
                    optionIndex,
                    optionTitle: bet.options[optionIndex]?.title || `Option ${optionIndex + 1}`,
                    outcome: Number(bet.betType) === 2 ? (outcome === 0 ? 'YES' : 'NO') : null,
                    totalAmount: 0,
                    totalShares: 0,
                    isRevealed: tx.isRevealed,
                    positionKey: key
                };
            }

            // Sum up amounts (her transaction'ı ekle, revealed olup olmadığına bakmaksızın)
            positionsMap[key].totalAmount += amount;

            // Sum up shares - priceAtBet kullan veya fallback
            if (!positionsMap[key].totalShares) {
                positionsMap[key].totalShares = 0;
            }

            if (priceAtBet && priceAtBet > 0) {
                positionsMap[key].totalShares += amount / (priceAtBet / 100);
            }

            // En az bir revealed transaction varsa, position revealed
            if (tx.isRevealed) {
                positionsMap[key].isRevealed = true;
            }
        });

        const positions = Object.values(positionsMap).map(position => {
            // Mevcut market probability/fiyatı
            const option = bet.options[position.optionIndex];
            const currentProbability = calculateProbability(option);

            let currentPrice;
            if (Number(bet.betType) === 2) {
                currentPrice = position.outcome === 'YES' ? currentProbability : (100 - currentProbability);
            } else {
                currentPrice = currentProbability;
            }

            // Shares ve avgPrice hesapla
            let shares = position.totalShares || 0;
            let avgPrice;
            let isPriceDataAvailable = shares > 0; // priceAtBet varsa shares > 0 olur

            if (shares > 0) {
                // priceAtBet varsa, shares var demektir
                avgPrice = (position.totalAmount / shares) * 100;
            } else {
                // priceAtBet yok, henüz reveal edilmemiş (optimistic state)
                avgPrice = null; // Loading göstereceğiz
                shares = 0;
            }

            // Current Value ve P&L: Sadece priceAtBet varsa hesapla
            let currentValue = null;
            let pnl = null;

            if (isPriceDataAvailable) {
                currentValue = shares * (currentPrice / 100);
                pnl = currentValue - position.totalAmount;
            }

            return {
                ...position,
                isEncrypted: false,
                isRevealed: true, // Amount'u göster (optimistic update)
                isPriceDataAvailable, // Yeni flag: Fiyat datası var mı?
                shares,
                avgPrice,
                currentValue,
                pnl
            };
        });

        const finalPositions = {
            type: Number(bet.betType) === 2 ? 'nested' : 'normal',
            positions
        };

        setUserPositions(finalPositions);
    };

    const handleRevealAll = async () => {
        setDecryptingAll(true);

        try {
            const contract = getBetMarketContract();
            const contractAddress = await contract.getAddress();

            // Get all transactions from contract
            const allTransactions = await contract.getUserAllTransactions(account, betId);

            if (allTransactions.length === 0) {
                alert('No transactions found');
                setDecryptingAll(false);
                return;
            }

            // Collect all handles to decrypt
            const handles = [];
            allTransactions.forEach(tx => {
                handles.push(tx.optionIndex, tx.outcome, tx.amount);
            });

            const { getFhevmInstance } = await import('../../lib/fhe.js');
            const instance = await getFhevmInstance();

            const { ethers } = await import('ethers');
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();

            const checksumContractAddress = ethers.getAddress(contractAddress);
            const checksumUserAddress = ethers.getAddress(account);

            const handleObjs = handles.map(h => ({
                handle: h,
                contractAddress: checksumContractAddress
            }));

            const keypair = instance.generateKeypair();
            const startTimestamp = Math.floor(Date.now() / 1000).toString();
            const durationDays = '30';

            const eip712 = instance.createEIP712(
                keypair.publicKey,
                [checksumContractAddress],
                startTimestamp,
                durationDays
            );

            const signature = await signer.signTypedData(
                eip712.domain,
                { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
                eip712.message
            );

            const result = await instance.userDecrypt(
                handleObjs,
                keypair.privateKey,
                keypair.publicKey,
                signature.replace('0x', ''),
                [checksumContractAddress],
                checksumUserAddress,
                startTimestamp,
                durationDays
            );

            // Query BetPlaced events to get transaction hashes
            const filter = contract.filters.BetPlaced(betId, account);
            const events = await contract.queryFilter(filter);

            // Try to get priceAtBet for all transactions (optional, may not exist in contract)
            let pricesAtBet = [];
            try {
                if (contract.getUserTransactionPrices) {
                    pricesAtBet = await contract.getUserTransactionPrices(account, betId);
                }
            } catch (error) {
                console.warn('getUserTransactionPrices not available:', error.message);
            }

            // Decrypt and format transactions
            const revealedTransactions = allTransactions.map((tx, index) => {
                const timestamp = Number(tx.timestamp);

                // Find matching event by timestamp (events are in chronological order)
                const matchingEvent = events.find(event => {
                    const eventTimestamp = Number(event.args.timestamp);
                    return eventTimestamp === timestamp;
                });

                return {
                    timestamp,
                    optionIndex: Number(result[tx.optionIndex] || 0),
                    outcome: Number(result[tx.outcome] || 0),
                    amount: (parseInt(result[tx.amount] || 0) / 1000000),
                    txHash: matchingEvent?.transactionHash || undefined,
                    priceAtBet: pricesAtBet[index] ? Number(pricesAtBet[index]) / 10000 : null // Convert from basis points to cents (optional)
                };
            });

            // Update cache with revealed transactions
            UserTransactionsCacheInstance.setRevealedTransactions(account, betId, revealedTransactions);

            // Reload positions and history from updated cache
            loadUserPosition();
            loadOrderHistory();

        } catch (error) {
            console.error('Failed to reveal transactions:', error);
            alert(error.message?.includes('user rejected') ? 'Signature request rejected' : 'Failed to reveal transactions');
        } finally {
            setDecryptingAll(false);
        }
    };

    const handleDecryptPosition = async (position) => {
        const positionKey = position.positionKey;
        setDecryptingPositions(prev => ({ ...prev, [positionKey]: true }));

        try {
            const contract = getBetMarketContract();
            const contractAddress = await contract.getAddress();

            const { getFhevmInstance } = await import('../../lib/fhe.js');
            const instance = await getFhevmInstance();

            const { ethers } = await import('ethers');
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();

            const checksumContractAddress = ethers.getAddress(contractAddress);
            const checksumUserAddress = ethers.getAddress(account);

            const encryptedHandle = position.encryptedAmount;

            if (encryptedHandle === ethers.ZeroHash) {
                alert('No position to decrypt');
                return;
            }

            const keypair = instance.generateKeypair();
            const startTimestamp = Math.floor(Date.now() / 1000).toString();
            const durationDays = '30';

            const eip712 = instance.createEIP712(
                keypair.publicKey,
                [checksumContractAddress],
                startTimestamp,
                durationDays
            );

            const signature = await signer.signTypedData(
                eip712.domain,
                {
                    UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification
                },
                eip712.message
            );

            const result = await instance.userDecrypt(
                [
                    {
                        handle: encryptedHandle,
                        contractAddress: checksumContractAddress
                    }
                ],
                keypair.privateKey,
                keypair.publicKey,
                signature.replace('0x', ''),
                [checksumContractAddress],
                checksumUserAddress,
                startTimestamp,
                durationDays
            );

            const clearAmount = result[encryptedHandle];
            const amountFormatted = (parseInt(clearAmount.toString()) / 1000000).toFixed(2);

            setUserPositions(prev => {
                if (!prev) return prev;

                const updatedPositions = {
                    ...prev,
                    positions: prev.positions.map(pos => {
                        if (pos.positionKey === positionKey) {
                            const probability = calculateProbability(bet.options[pos.optionIndex]);
                            let avgPrice;

                            if (Number(bet.betType) === 2) {
                                avgPrice = pos.outcome === 'YES' ? probability : (100 - probability);
                            } else {
                                avgPrice = probability;
                            }

                            const shares = parseFloat(amountFormatted) / (avgPrice / 100);
                            const currentValue = shares * (avgPrice / 100);
                            const pnl = currentValue - parseFloat(amountFormatted);

                            const updatedPos = {
                                ...pos,
                                isEncrypted: false,
                                amount: parseFloat(amountFormatted),
                                shares: shares,
                                avgPrice: avgPrice,
                                currentValue: currentValue,
                                pnl: pnl
                            };

                            return updatedPos;
                        }
                        return pos;
                    })
                };

                return updatedPositions;
            });

        } catch (error) {
            console.error('Failed to decrypt position:', error);
            let errorMessage = 'Failed to decrypt position';
            if (error.message?.includes('user rejected')) {
                errorMessage = 'Signature request rejected';
            }
            alert(errorMessage);
        } finally {
            setDecryptingPositions(prev => ({ ...prev, [positionKey]: false }));
        }
    };

    const refreshStatisticsOnly = async () => {
        if (!getBetMarketContract || !bet) return;

        try {
            const contract = getBetMarketContract();
            await loadBetStatistics(contract, betId, Number(bet.optionCount), Number(bet.betType));
        } catch (error) {
            console.error('Failed to refresh statistics:', error);
        }
    };

    const handleDecryptBalance = async () => {
        setDecryptingBalance(true);
        try {
            const { decryptUserBalance } = await import('../../lib/fhe.js');
            const contract = getBetMarketContract();
            const contractAddress = await contract.getAddress();

            const clearBalance = await decryptUserBalance(contractAddress, account);
            const balanceFormatted = (parseInt(clearBalance) / 1000000).toFixed(2);

            setCachedBalance(balanceFormatted);
            BalanceCache.save(account, chainId, balanceFormatted);

        } catch (error) {
            console.error('Failed to decrypt balance:', error);
            let errorMessage = 'Failed to decrypt balance';
            if (error.message?.includes('not authorized')) {
                errorMessage = 'You are not authorized to decrypt this balance';
            } else if (error.message?.includes('user rejected')) {
                errorMessage = 'Signature request rejected';
            }
            alert(errorMessage);
        } finally {
            setDecryptingBalance(false);
        }
    };

    const loadBetStatistics = async (contract, betId, optionCount, betType) => {
        try {
            console.log('Loading bet statistics...');

            if (Number(betType) === 2) {
                await loadNestedBetStatistics(contract, betId, optionCount);
                return;
            }

            try {
                // Use Stats contract for statistics if available
                let statsContract;
                try {
                    statsContract = getBetMarketStatsContract(true);
                } catch (statsError) {
                    console.warn('Stats contract not available:', statsError.message);
                    throw new Error('Stats contract not configured');
                }

                const [optionTotals, isDecrypted] = await statsContract.getBetStatistics(betId);
                console.log('Oracle status:', { optionTotals, isDecrypted });

                if (isDecrypted) {
                    console.log('Using Oracle-decrypted values');
                    const totalVolume = optionTotals.reduce((sum, total) => sum + parseInt(total.toString()), 0) / 1000000;

                    setStatistics({
                        totalVolume,
                        totalBets: 0,
                        uniqueTraders: 0,
                        hoursRemaining: Math.max(0, Math.floor((Number(bet?.endTime || 0) * 1000 - Date.now()) / (1000 * 60 * 60))),
                        isRealTime: false,
                        optionTotals: optionTotals.map(t => parseInt(t.toString()) / 1000000)
                    });

                    setBet(prevBet => ({
                        ...prevBet,
                        options: prevBet.options.map((option, index) => ({
                            ...option,
                            totalShares: parseInt(optionTotals[index]?.toString() || '0') / 1000000,
                            totalAmount: parseInt(optionTotals[index]?.toString() || '0') / 1000000
                        }))
                    }));
                    return;
                } else {
                    console.log('Oracle not decrypted, using HTTP Relayer for real-time data');
                    await loadEncryptedStatistics(contract, betId, optionCount);
                    return;
                }
            } catch (oracleError) {
                console.warn('Oracle method not available (old contract), using HTTP Relayer:', oracleError.message);
            }

            console.log('Using HTTP Relayer for all statistics (fallback)');
            await loadEncryptedStatistics(contract, betId, optionCount);

        } catch (error) {
            console.error('Failed to load statistics:', error);
            setStatistics({
                totalVolume: 0,
                totalBets: 0,
                uniqueTraders: 0,
                hoursRemaining: Math.max(0, Math.floor((Number(bet?.endTime || 0) * 1000 - Date.now()) / (1000 * 60 * 60))),
                isRealTime: true,
                optionTotals: []
            });
        }
    };

    const loadNestedBetStatistics = async (contract, betId, optionCount) => {
        try {
            console.log('Loading NESTED bet statistics...');

            try {
                // Use Stats contract for statistics if available
                let statsContract;
                try {
                    statsContract = getBetMarketStatsContract(true);
                } catch (statsError) {
                    console.warn('Stats contract not available:', statsError.message);
                    throw new Error('Stats contract not configured');
                }

                const [yesShares, noShares, isDecrypted] = await statsContract.getNestedBetStatistics(betId);
                console.log('Nested Oracle status:', { yesShares, noShares, isDecrypted });

                if (isDecrypted) {
                    console.log('Using Oracle-decrypted nested values');

                    const totalVolume = yesShares.reduce((sum, val, idx) =>
                        sum + parseInt(val.toString()) + parseInt(noShares[idx].toString()), 0
                    ) / 1000000;

                    setStatistics({
                        totalVolume,
                        totalBets: 0,
                        uniqueTraders: 0,
                        hoursRemaining: Math.max(0, Math.floor((Number(bet?.endTime || 0) * 1000 - Date.now()) / (1000 * 60 * 60))),
                        isRealTime: false,
                        optionTotals: yesShares.map((yes, idx) =>
                            (parseInt(yes.toString()) + parseInt(noShares[idx].toString())) / 1000000
                        )
                    });

                    setBet(prevBet => ({
                        ...prevBet,
                        options: prevBet.options.map((option, index) => ({
                            ...option,
                            yesShares: parseInt(yesShares[index]?.toString() || '0') / 1000000,
                            noShares: parseInt(noShares[index]?.toString() || '0') / 1000000,
                            totalShares: (parseInt(yesShares[index]?.toString() || '0') + parseInt(noShares[index]?.toString() || '0')) / 1000000,
                            totalAmount: (parseInt(yesShares[index]?.toString() || '0') + parseInt(noShares[index]?.toString() || '0')) / 1000000
                        }))
                    }));
                    return;
                }
            } catch (oracleError) {
                console.warn('Nested Oracle not available:', oracleError.message);
            }

            await loadNestedEncryptedStatistics(contract, betId, optionCount);

        } catch (error) {
            console.error('Failed to load nested statistics:', error);
        }
    };

    const loadNestedEncryptedStatistics = async (contract, betId, optionCount) => {
        try {
            console.log('Fetching encrypted nested handles...');

            const handles = [];

            for (let i = 0; i < optionCount; i++) {
                const yesHandle = await contract.getNestedOptionEncryptedTotal(betId, i, 0);
                const noHandle = await contract.getNestedOptionEncryptedTotal(betId, i, 1);
                handles.push(yesHandle, noHandle);
                console.log(`Handles for option ${i}: YES=${yesHandle}, NO=${noHandle}`);
            }

            const poolHandle = await contract.getTotalPoolEncrypted(betId);
            handles.push(poolHandle);

            const participantsHandle = await contract.getTotalParticipantsEncrypted(betId);
            handles.push(participantsHandle);

            const validHandles = handles.filter(h => h && h !== '0x0000000000000000000000000000000000000000000000000000000000000000');

            if (validHandles.length === 0) {
                console.warn('No valid nested handles');
                return;
            }

            const { getFhevmInstance } = await import('../../lib/fhe.js');
            const instance = await getFhevmInstance();

            setIsUpdating(true);
            console.log('Batch decrypting nested handles:', validHandles);
            const decryptedResult = await instance.publicDecrypt(validHandles);

            const decryptedValues = handles.map(handle => {
                if (handle && handle !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                    return Number(decryptedResult[handle] || 0);
                }
                return 0;
            });

            const optionData = [];
            for (let i = 0; i < optionCount; i++) {
                const yesVal = decryptedValues[i * 2] / 1000000;
                const noVal = decryptedValues[i * 2 + 1] / 1000000;
                optionData.push({
                    yesShares: yesVal,
                    noShares: noVal,
                    totalShares: yesVal + noVal,
                    totalAmount: yesVal + noVal
                });
            }

            const totalVolume = decryptedValues[optionCount * 2] / 1000000;
            const uniqueTraders = decryptedValues[optionCount * 2 + 1];
            const totalBets = await contract.getTotalBetCount(betId);

            await new Promise(resolve => setTimeout(resolve, 150));

            setStatistics({
                totalVolume,
                totalBets: Number(totalBets),
                uniqueTraders,
                hoursRemaining: Math.max(0, Math.floor((Number(bet?.endTime || 0) * 1000 - Date.now()) / (1000 * 60 * 60))),
                isRealTime: true,
                optionTotals: optionData.map(d => d.totalShares)
            });

            setBet(prevBet => ({
                ...prevBet,
                options: prevBet.options.map((option, index) => ({
                    ...option,
                    ...optionData[index]
                }))
            }));

            setTimeout(() => setIsUpdating(false), 50);

            // ❌ KALDIRILDI: handlePlaceBet içinde zaten çağrılıyor, RACE CONDITION yaratıyor!
            // if (isConnected && account) {
            //     await loadUserPosition();
            // }

        } catch (error) {
            console.error('Failed to load nested statistics:', error);
            setIsUpdating(false);
        }
    };

    const loadEncryptedStatistics = async (contract, betId, optionCount) => {
        try {
            console.log('Fetching encrypted handles...');

            const hasEncryptedMethods = typeof contract.getOptionEncryptedTotal === 'function' &&
                typeof contract.getTotalPoolEncrypted === 'function' &&
                typeof contract.getTotalParticipantsEncrypted === 'function' &&
                typeof contract.getTotalBetCount === 'function';

            if (!hasEncryptedMethods) {
                console.warn('Encrypted handle methods not available in deployed contract');
                setStatistics({
                    totalVolume: 0,
                    totalBets: 0,
                    uniqueTraders: 0,
                    hoursRemaining: Math.max(0, Math.floor((Number(bet?.endTime || 0) * 1000 - Date.now()) / (1000 * 60 * 60))),
                    isRealTime: true,
                    optionTotals: Array(optionCount).fill(0)
                });
                return;
            }

            const handles = [];
            for (let i = 0; i < optionCount; i++) {
                const handle = await contract.getOptionEncryptedTotal(betId, i);
                handles.push(handle);
                console.log(`Handle for option ${i}:`, handle);
            }

            const poolHandle = await contract.getTotalPoolEncrypted(betId);
            handles.push(poolHandle);
            console.log('Pool handle:', poolHandle);

            const participantsHandle = await contract.getTotalParticipantsEncrypted(betId);
            handles.push(participantsHandle);
            console.log('Participants handle:', participantsHandle);

            const validHandles = handles.filter(handle => handle && handle !== '0x0000000000000000000000000000000000000000000000000000000000000000');

            if (validHandles.length === 0) {
                console.warn('No valid handles to decrypt');
                setStatistics({
                    totalVolume: 0,
                    totalBets: 0,
                    uniqueTraders: 0,
                    hoursRemaining: Math.max(0, Math.floor((Number(bet?.endTime || 0) * 1000 - Date.now()) / (1000 * 60 * 60))),
                    isRealTime: true,
                    optionTotals: Array(optionCount).fill(0)
                });
                return;
            }

            let decryptedValues;

            try {
                const { getFhevmInstance } = await import('../../lib/fhe.js');
                const instance = await getFhevmInstance();

                if (!instance || !instance.publicDecrypt) {
                    throw new Error('FHEVM instance or publicDecrypt not available');
                }

                setIsUpdating(true);
                console.log('Batch decrypting handles:', validHandles);
                const decryptedResult = await instance.publicDecrypt(validHandles);
                console.log('Batch decrypt successful:', decryptedResult);

                decryptedValues = handles.map(handle => {
                    if (handle && handle !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                        return Number(decryptedResult[handle] || 0);
                    }
                    return 0;
                });

            } catch (decryptError) {
                console.error('Batch decrypt failed:', decryptError);
                setStatistics({
                    totalVolume: 0,
                    totalBets: 0,
                    uniqueTraders: 0,
                    hoursRemaining: Math.max(0, Math.floor((Number(bet?.endTime || 0) * 1000 - Date.now()) / (1000 * 60 * 60))),
                    isRealTime: true,
                    optionTotals: Array(optionCount).fill(0)
                });
                return;
            }

            const optionTotals = decryptedValues.slice(0, optionCount).map(val => val / 1000000);
            const totalVolume = decryptedValues[optionCount] / 1000000;
            const uniqueTraders = decryptedValues[optionCount + 1];

            const totalBets = await contract.getTotalBetCount(betId);

            console.log('HTTP Relayer decryption completed:', {
                optionTotals,
                totalVolume,
                uniqueTraders,
                totalBets: Number(totalBets),
                decryptedValues
            });

            await new Promise(resolve => setTimeout(resolve, 150));

            setStatistics({
                totalVolume,
                totalBets: Number(totalBets),
                uniqueTraders,
                hoursRemaining: Math.max(0, Math.floor((Number(bet?.endTime || 0) * 1000 - Date.now()) / (1000 * 60 * 60))),
                isRealTime: true,
                optionTotals
            });

            setBet(prevBet => ({
                ...prevBet,
                options: prevBet.options.map((option, index) => ({
                    ...option,
                    totalShares: optionTotals[index] || 0,
                    totalAmount: optionTotals[index] || 0
                }))
            }));

            setTimeout(() => setIsUpdating(false), 50);

            // ❌ KALDIRILDI: handlePlaceBet içinde zaten çağrılıyor, RACE CONDITION yaratıyor!
            // if (isConnected && account) {
            //     await loadUserPosition();
            // }

        } catch (error) {
            console.error('HTTP Relayer error:', error);
            setStatistics({
                totalVolume: 0,
                totalBets: 0,
                uniqueTraders: 0,
                hoursRemaining: Math.max(0, Math.floor((Number(bet?.endTime || 0) * 1000 - Date.now()) / (1000 * 60 * 60))),
                isRealTime: true,
                optionTotals: Array(optionCount).fill(0)
            });
        }
    };

    const fetchBetDetail = async () => {
        try {
            setLoading(true);
            console.log('Getting bet details from contract...', betId);

            if (!getBetMarketContract) {
                console.log('Contract not available');
                setBet(null);
                return;
            }

            // Use read-only contract (no signer needed for viewing)
            const contract = getBetMarketContract(true);
            const contractBet = await contract.getBet(betId);
            console.log('Raw contract bet:', contractBet);

            const options = [];
            for (let i = 0; i < Number(contractBet.optionCount); i++) {
                const option = await contract.getBetOption(betId, i);
                console.log(`Option ${i}:`, option);

                options.push({
                    title: option.title || option[0],
                    totalShares: 0,
                    totalAmount: 0,
                    yesShares: 0,
                    noShares: 0,
                    isWinner: option.isWinner || option[1]
                });
            }

            console.log('Fetched options:', options);

            const transformedBet = {
                id: contractBet.id.toString(),
                contractId: contractBet.id.toString(),
                title: contractBet.title,
                description: contractBet.description,
                betType: Number(contractBet.betType),
                endTime: contractBet.endTime.toString(),
                createdAt: contractBet.createdAt.toString(),
                isActive: contractBet.isActive,
                isResolved: contractBet.isResolved,
                minBetAmount: contractBet.minBetAmount.toString(),
                maxBetAmount: contractBet.maxBetAmount.toString(),
                optionCount: contractBet.optionCount.toString(),
                liquidityParam: Number(contractBet.liquidityParam),
                options: options,
                useFHEVM: true
            };

            console.log('Transformed bet:', transformedBet);
            setBet(transformedBet);

            await loadBetStatistics(contract, betId, Number(contractBet.optionCount), Number(contractBet.betType));

        } catch (error) {
            console.error('Contract call failed:', error);
            setBet(null);
        } finally {
            setLoading(false);
        }
    };

    const handleConnectWallet = async () => {
        try {
            setConnectionError(null);
            await connect();
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            setConnectionError(
                error.message || 'Failed to connect wallet. Please try again.'
            );
        }
    };

    const handlePlaceBet = async () => {
        if (!isConnected || !account) {
            await handleConnectWallet();
            return;
        }

        if (selectedOption === null) {
            alert('Please select an option first!');
            return;
        }

        if (Number(bet.betType) !== 0 && Number(bet.betType) !== 1 && selectedOutcome === null) {
            alert('Please select Yes or No for this option!');
            return;
        }

        if (!betAmount || parseFloat(betAmount) <= 0) {
            alert('Please enter a valid bet amount!');
            return;
        }

        // Check balance (should not reach here if UI is hiding bet panel correctly)
        const cachedBalance = BalanceCache.get(account, chainId);
        const betAmountValue = parseFloat(betAmount);
        const availableBalance = parseFloat(cachedBalance || 0);

        if (betAmountValue > availableBalance) {
            alert(`❌ Insufficient balance!\n\nYou are trying to bet $${betAmountValue.toFixed(2)}\nYour available balance: $${availableBalance.toFixed(2)}`);
            return;
        }

        try {
            setPlacing(true);
            console.log('Placing bet using NEW contract system...');

            if (!fhevmInstance) {
                throw new Error('FHEVM not initialized. Please wait for encryption to be ready.');
            }

            if (!bet.contractId) {
                throw new Error('Contract ID missing. This bet is not deployed to blockchain.');
            }

            const contract = getBetMarketContract();
            const contractAddress = await contract.getAddress();

            // ✅ Bet bilgilerini hafızada tut (optimistic update için)
            const betData = {
                optionIndex: selectedOption,
                outcome: selectedOutcome,
                amount: parseFloat(betAmount),
                optionTitle: bet.options[selectedOption]?.title
            };

            console.log('Bet Type:', bet.betType, 'BetType.NESTED_CHOICE should be 2');

            if (Number(bet.betType) === 2) {
                console.log('Processing NESTED_CHOICE bet...');

                if (selectedOutcome === null) {
                    alert('Please select Yes or No!');
                    return;
                }

                const { encryptNestedBetData } = await import('../../lib/fhe.js');

                const outcomeValue = selectedOutcome === 'yes' ? 0 : 1;

                console.log('Encrypting nested bet data:', {
                    optionIndex: selectedOption,
                    outcome: outcomeValue,
                    amount: parseFloat(betAmount) * 1000000
                });

                // ⭐ CONTRACT'TAN CANLI POOL STATE ÇEK (bet.options state kullanma!)
                let yesSharesBeforeBet = 0;
                let noSharesBeforeBet = 0;

                try {
                    // Use Stats contract for statistics
                    let statsContract;
                    try {
                        statsContract = getBetMarketStatsContract(true);
                    } catch (statsError) {
                        console.warn('Stats contract not available:', statsError.message);
                        throw new Error('Stats contract not configured');
                    }

                    // Oracle decrypted mi kontrol et
                    const [yesSharesArray, noSharesArray, isDecrypted] = await statsContract.getNestedBetStatistics(bet.contractId);

                    if (isDecrypted) {
                        // Oracle decrypted ise direkt kullan
                        yesSharesBeforeBet = parseInt(yesSharesArray[selectedOption]?.toString() || '0') / 1000000;
                        noSharesBeforeBet = parseInt(noSharesArray[selectedOption]?.toString() || '0') / 1000000;
                        console.log('✅ Using oracle-decrypted pool state');
                    } else {
                        // HTTP Relayer ile decrypt et
                        const yesHandle = await contract.getNestedOptionEncryptedTotal(bet.contractId, selectedOption, 0);
                        const noHandle = await contract.getNestedOptionEncryptedTotal(bet.contractId, selectedOption, 1);

                        const { getFhevmInstance } = await import('../../lib/fhe.js');
                        const instance = await getFhevmInstance();

                        const decryptedResult = await instance.publicDecrypt([yesHandle, noHandle]);

                        yesSharesBeforeBet = Number(decryptedResult[yesHandle] || 0) / 1000000;
                        noSharesBeforeBet = Number(decryptedResult[noHandle] || 0) / 1000000;
                        console.log('✅ Using HTTP Relayer decrypted pool state');
                    }
                } catch (error) {
                    console.error('Failed to fetch live pool state, using cached:', error);
                    // Fallback: bet.options kullan
                    const option = bet.options[selectedOption];
                    yesSharesBeforeBet = option.yesShares || 0;
                    noSharesBeforeBet = option.noShares || 0;
                }

                console.log('💰 LIVE pool state from contract (selected option):', {
                    optionIndex: selectedOption,
                    yesShares: yesSharesBeforeBet,
                    noShares: noSharesBeforeBet
                });

                // NESTED bet için sadece bu option'ın YES ve NO pool'u önemli
                // Diğer option'lar bu bet'i etkilemiyor
                const liquidityParam = bet.liquidityParam || 100;
                const yesWithLiquidity = yesSharesBeforeBet + liquidityParam;
                const noWithLiquidity = noSharesBeforeBet + liquidityParam;
                const totalWithLiquidity = yesWithLiquidity + noWithLiquidity;

                const yesProbabilityBeforeBet = (yesWithLiquidity / totalWithLiquidity) * 100;
                const priceBeforeBet = selectedOutcome === 'yes'
                    ? yesProbabilityBeforeBet
                    : (100 - yesProbabilityBeforeBet);

                console.log('💰 Price BEFORE bet:', priceBeforeBet, 'for', selectedOutcome);

                const encryptedData = await encryptNestedBetData(
                    selectedOption,
                    outcomeValue,
                    parseFloat(betAmount) * 1000000,
                    contractAddress,
                    account
                );

                console.log('Encrypted nested data created:', {
                    optionHandle: typeof encryptedData.encryptedOptionIndex,
                    outcomeHandle: typeof encryptedData.encryptedOutcome,
                    amountHandle: typeof encryptedData.encryptedAmount
                });

                console.log('Calling contract.placeNestedBet...');

                const tx = await contract.placeNestedBet(
                    bet.contractId,
                    encryptedData.encryptedOptionIndex,
                    encryptedData.optionProof,
                    encryptedData.encryptedOutcome,
                    encryptedData.outcomeProof,
                    encryptedData.encryptedAmount,
                    encryptedData.amountProof,
                    { gasLimit: 10000000 }
                );

                console.log('Transaction sent, waiting for confirmation...', tx.hash);
                const receipt = await tx.wait();
                console.log('Transaction confirmed:', receipt);

                // ✅ Optimistic cache update with PRICE BEFORE BET
                UserTransactionsCacheInstance.addTransaction(account, betId, {
                    timestamp: Math.floor(Date.now() / 1000),
                    optionIndex: selectedOption,
                    outcome: selectedOutcome === 'yes' ? 0 : 1,
                    amount: parseFloat(betAmount),
                    txHash: tx.hash,
                    priceAtBet: priceBeforeBet,  // ✅ BET ÖNCESI FİYAT
                    isRevealed: true
                });

                // ✅ Refresh pool state (güncel pool data çek)
                await refreshStatisticsOnly();

                // ✅ Load updated positions and history (güncel pool ile P&L hesapla)
                await loadUserPosition();
                await loadOrderHistory();

                const newBalance = BalanceCache.optimisticUpdate(account, chainId, -parseFloat(betAmount));
                if (newBalance) {
                    setCachedBalance(newBalance);
                }

                // ✅ HYBRID APPROACH: Frontend MongoDB kayıt (hızlı UX) - NESTED BET
                try {
                    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
                    const outcomeValue = selectedOutcome === 'yes' ? 0 : 1; // 0=Yes, 1=No
                    const recordResponse = await fetch(`${backendUrl}/api/user-positions/record-bet`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            contractBetId: bet.contractId,
                            userAddress: account,
                            optionIndex: selectedOption,
                            outcome: outcomeValue, // For nested bets: 0=Yes, 1=No
                            amount: parseFloat(betAmount),
                            entryPrice: priceBeforeBet || 50,
                            placeBetTxHash: tx.hash,
                            blockNumber: receipt.blockNumber || 0
                        })
                    });

                    if (recordResponse.ok) {
                        const recordData = await recordResponse.json();
                        console.log('✅ Nested bet recorded to MongoDB:', recordData);
                    } else {
                        const errorData = await recordResponse.json();
                        console.warn('⚠️ MongoDB record failed (non-critical):', errorData.message);
                    }
                } catch (mongoErr) {
                    console.warn('⚠️ MongoDB record error (non-critical):', mongoErr);
                    // Don't block user - MongoDB is optional for UX
                }

                setSuccessData({
                    transactionHash: tx.hash,
                    betAmount: betAmount,
                    betOption: `${bet?.options?.[selectedOption]?.title} (${selectedOutcome.toUpperCase()})`
                });
                setShowSuccessModal(true);

            } else {
                console.log('Processing BINARY/MULTIPLE_CHOICE bet...');

                const { encryptBetData } = await import('../../lib/fhe.js');

                console.log('Encrypting bet data:', {
                    optionIndex: selectedOption,
                    amount: parseFloat(betAmount) * 1000000
                });

                // ⭐ CONTRACT'TAN CANLI POOL STATE ÇEK (bet.options state kullanma!)
                let optionSharesBeforeBet = 0;

                try {
                    // Use Stats contract for statistics
                    let statsContract;
                    try {
                        statsContract = getBetMarketStatsContract(true);
                    } catch (statsError) {
                        console.warn('Stats contract not available:', statsError.message);
                        throw new Error('Stats contract not configured');
                    }

                    // Oracle decrypted mi kontrol et
                    const [optionTotals, isDecrypted] = await statsContract.getBetStatistics(bet.contractId);

                    if (isDecrypted) {
                        // Oracle decrypted ise direkt kullan
                        optionSharesBeforeBet = parseInt(optionTotals[selectedOption]?.toString() || '0') / 1000000;
                        console.log('✅ Using oracle-decrypted pool state');
                    } else {
                        // HTTP Relayer ile decrypt et
                        const optionHandle = await contract.getEncryptedOptionTotal(bet.contractId, selectedOption);

                        const { getFhevmInstance } = await import('../../lib/fhe.js');
                        const instance = await getFhevmInstance();

                        const decryptedResult = await instance.publicDecrypt([optionHandle]);

                        optionSharesBeforeBet = Number(decryptedResult[optionHandle] || 0) / 1000000;
                        console.log('✅ Using HTTP Relayer decrypted pool state');
                    }
                } catch (error) {
                    console.error('Failed to fetch live pool state, using cached:', error);
                    // Fallback: bet.options kullan
                    const option = bet.options[selectedOption];
                    optionSharesBeforeBet = option.totalShares || 0;
                }

                console.log('💰 LIVE pool state from contract:', {
                    optionShares: optionSharesBeforeBet
                });

                // Şimdi fiyatı hesapla (liquidity injection)
                const liquidityParam = bet.liquidityParam || 100;

                // Tüm option'ların toplam shares'ini hesapla
                let totalSharesAllOptions = 0;
                for (let i = 0; i < bet.optionCount; i++) {
                    if (i === selectedOption) {
                        totalSharesAllOptions += optionSharesBeforeBet + liquidityParam;
                    } else {
                        // Diğer option'lar için bet.options kullanabiliriz (bunlar değişmedi)
                        const otherOption = bet.options[i];
                        totalSharesAllOptions += (otherOption?.totalShares || 0) + liquidityParam;
                    }
                }

                const optionWithLiquidity = optionSharesBeforeBet + liquidityParam;
                const priceBeforeBet = (optionWithLiquidity / totalSharesAllOptions) * 100;

                console.log('💰 Price BEFORE bet:', priceBeforeBet);

                const encryptedData = await encryptBetData(
                    selectedOption,
                    parseFloat(betAmount) * 1000000,
                    contractAddress,
                    account
                );

                console.log('Encrypted parameters created:', {
                    optionHandle: typeof encryptedData.encryptedOptionIndex,
                    amountHandle: typeof encryptedData.encryptedAmount,
                    optionProof: encryptedData.optionProof.length,
                    amountProof: encryptedData.amountProof.length
                });

                console.log('Calling contract.placeBet...');

                const tx = await contract.placeBet(
                    bet.contractId,
                    encryptedData.encryptedOptionIndex,
                    encryptedData.optionProof,
                    encryptedData.encryptedAmount,
                    encryptedData.amountProof,
                    { gasLimit: 2000000 }
                );

                console.log('Transaction sent, waiting for confirmation...', tx.hash);
                const receipt = await tx.wait();
                console.log('Transaction confirmed:', receipt);

                // ✅ Optimistic cache update with PRICE BEFORE BET
                UserTransactionsCacheInstance.addTransaction(account, betId, {
                    timestamp: Math.floor(Date.now() / 1000),
                    optionIndex: selectedOption,
                    outcome: null, // BINARY/MULTIPLE doesn't have outcome
                    amount: parseFloat(betAmount),
                    txHash: tx.hash,
                    priceAtBet: priceBeforeBet,  // ✅ BET ÖNCESI FİYAT
                    isRevealed: true
                });

                // ✅ Refresh pool state (güncel pool data çek)
                await refreshStatisticsOnly();

                // ✅ Load updated positions and history (güncel pool ile P&L hesapla)
                await loadUserPosition();
                await loadOrderHistory();

                const newBalance = BalanceCache.optimisticUpdate(account, chainId, -parseFloat(betAmount));
                if (newBalance) {
                    setCachedBalance(newBalance);
                }

                // ✅ HYBRID APPROACH: Frontend MongoDB kayıt (hızlı UX) - BINARY/MULTIPLE BET
                try {
                    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
                    const recordResponse = await fetch(`${backendUrl}/api/user-positions/record-bet`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            contractBetId: bet.contractId,
                            userAddress: account,
                            optionIndex: selectedOption,
                            outcome: null, // Binary/Multiple bets don't have outcome
                            amount: parseFloat(betAmount),
                            entryPrice: priceBeforeBet || 50,
                            placeBetTxHash: tx.hash,
                            blockNumber: receipt.blockNumber || 0
                        })
                    });

                    if (recordResponse.ok) {
                        const recordData = await recordResponse.json();
                        console.log('✅ Binary/Multiple bet recorded to MongoDB:', recordData);
                    } else {
                        const errorData = await recordResponse.json();
                        console.warn('⚠️ MongoDB record failed (non-critical):', errorData.message);
                    }
                } catch (mongoErr) {
                    console.warn('⚠️ MongoDB record error (non-critical):', mongoErr);
                    // Don't block user - MongoDB is optional for UX
                }

                setSuccessData({
                    transactionHash: tx.hash,
                    betAmount: betAmount,
                    betOption: bet?.options?.[selectedOption]?.title || `Option ${selectedOption + 1}`
                });
                setShowSuccessModal(true);
            }

            setBetAmount('');
            setSelectedOption(null);
            setSelectedOutcome(null);

        } catch (error) {
            console.error('Error placing bet:', error);
            let errorMessage = 'Error placing bet. Please try again.';

            if (error.message?.includes('user rejected')) {
                errorMessage = 'Transaction cancelled by user.';
            } else if (error.message?.includes('insufficient funds')) {
                errorMessage = 'Insufficient funds for gas fees.';
            } else if (error.message?.includes('FHEVM not initialized')) {
                errorMessage = 'Encryption not ready. Please wait a moment and try again.';
            } else if (error.message?.includes('Bet does not exist')) {
                errorMessage = 'This bet is no longer available.';
            } else if (error.message?.includes('Bet not active')) {
                errorMessage = 'This bet is no longer active.';
            } else if (error.message?.includes('Bet ended')) {
                errorMessage = 'This bet has already ended.';
            } else if (error.message?.includes('Bet resolved')) {
                errorMessage = 'This bet has already been resolved.';
            } else if (error.message?.includes('Amount too low')) {
                errorMessage = `Minimum bet amount is ${bet?.minBetAmount || 1} USDC.`;
            } else if (error.message?.includes('Amount too high')) {
                errorMessage = `Maximum bet amount is ${bet?.maxBetAmount || 1000} USDC.`;
            } else if (error.message?.includes('Invalid option')) {
                errorMessage = 'Invalid betting option selected.';
            } else if (error.message?.includes('Use placeNestedBet')) {
                errorMessage = 'This is a nested bet. Please select Yes or No.';
            }

            alert(errorMessage);
        } finally {
            setPlacing(false);
        }
    };

    const quickAmounts = [10, 25, 50, 100, 250];

    const formatPrice = (price) => `${Math.round(price)}¢`;

    const calculatePrice = (optionShares, totalShares) => {
        if (totalShares === 0) {
            const optionCount = bet?.options?.length || 2;
            return Math.round(100 / optionCount);
        }
        return Math.round((optionShares / totalShares) * 100);
    };

    const formatVolume = (volume) => {
        if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
        if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}k`;
        return `$${volume}`;
    };

    const getTimeRemaining = () => {
        if (!bet?.endTime) return 'No end time';

        const timestamp = typeof bet.endTime === 'string'
            ? parseInt(bet.endTime)
            : Number(bet.endTime);

        const endTime = new Date(timestamp * 1000);

        if (isNaN(endTime.getTime())) {
            return 'Invalid date';
        }

        const now = new Date();
        if (endTime <= now) return 'Ended';

        return formatDistanceToNow(endTime, { addSuffix: true });
    };

    const calculateProbability = (option) => {
        if (!bet?.options) return 0;

        // PARIMUTUEL: Display current pool proportions INCLUDING liquidity
        // Liquidity is in the pool but not in encrypted shares (contract stores it in totalPool only)

        const liquidityParam = bet.liquidityParam || 100;

        if (Number(bet.betType) === 0 || Number(bet.betType) === 1) {
            // BINARY/MULTIPLE: Add liquidity proportionally to each option
            const liquidityPerOption = liquidityParam / bet.options.length;

            const totalShares = bet.options.reduce((sum, opt) => {
                return sum + (opt.totalShares || 0) + liquidityPerOption;
            }, 0);

            if (totalShares === 0) {
                return 100 / bet.options.length;
            }

            const optionSharesWithLiquidity = (option.totalShares || 0) + liquidityPerOption;
            const prob = (optionSharesWithLiquidity / totalShares) * 100;

            return Math.max(0.1, Math.min(99.9, prob));
        } else {
            // NESTED: Add liquidity split 50/50 between YES and NO
            const liquidityPerOutcome = liquidityParam / 2;

            const yesShares = (option.yesShares || 0) + liquidityPerOutcome;
            const noShares = (option.noShares || 0) + liquidityPerOutcome;
            const totalOptionShares = yesShares + noShares;

            if (totalOptionShares === 0) {
                return 50;
            }

            const prob = (yesShares / totalOptionShares) * 100;

            return Math.max(0.1, Math.min(99.9, prob));
        }
    };

    const LoadingSkeleton = () => (
        <div className="max-w-6xl mx-auto p-6 space-y-6 animate-pulse">
            {/* Header Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Gradient Header Skeleton */}
                <div className="bg-gradient-to-r from-gray-300 to-gray-400 px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-6 w-20 bg-gray-200 bg-opacity-30 rounded-full"></div>
                            <div className="h-6 w-16 bg-gray-200 bg-opacity-30 rounded-full"></div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="h-4 w-24 bg-gray-200 bg-opacity-30 rounded"></div>
                            <div className="h-4 w-20 bg-gray-200 bg-opacity-30 rounded"></div>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Left Column */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Title & Description */}
                            <div>
                                <div className="h-8 bg-gray-200 rounded w-3/4 mb-3"></div>
                                <div className="space-y-2">
                                    <div className="h-4 bg-gray-200 rounded"></div>
                                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                                </div>
                            </div>

                            {/* Stats Cards */}
                            <div className="grid grid-cols-3 gap-4">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="bg-gray-50 rounded-lg p-4">
                                        <div className="w-6 h-6 bg-gray-200 rounded mx-auto mb-2"></div>
                                        <div className="h-6 bg-gray-200 rounded w-16 mx-auto mb-2"></div>
                                        <div className="h-3 bg-gray-200 rounded w-20 mx-auto"></div>
                                    </div>
                                ))}
                            </div>

                            {/* Options List Skeleton */}
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="bg-gray-50 rounded-lg p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="h-4 bg-gray-200 rounded w-48"></div>
                                            <div className="h-6 bg-gray-200 rounded w-16"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Column - Betting Panel */}
                        <div className="lg:col-span-1">
                            <div className="bg-gray-50 rounded-xl p-6 space-y-4 sticky top-6">
                                <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
                                <div className="space-y-3">
                                    <div className="h-10 bg-gray-200 rounded"></div>
                                    <div className="h-10 bg-gray-200 rounded"></div>
                                    <div className="h-12 bg-gray-200 rounded"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs Skeleton */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex gap-4 mb-6">
                    <div className="h-10 bg-gray-200 rounded w-32"></div>
                    <div className="h-10 bg-gray-200 rounded w-32"></div>
                </div>
                <div className="space-y-3">
                    {[1, 2].map((i) => (
                        <div key={i} className="bg-gray-50 rounded-lg p-4">
                            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    if (loading) {
        return <LoadingSkeleton />;
    }

    if (!bet) {
        return (
            <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Bet not found</h3>
                <p className="text-gray-600">The bet you're looking for doesn't exist.</p>
            </div>
        );
    }

    const isExpired = bet?.endTime && (() => {
        const timestamp = typeof bet.endTime === 'string'
            ? parseInt(bet.endTime)
            : Number(bet.endTime);
        const endTime = new Date(timestamp * 1000);
        return !isNaN(endTime.getTime()) && endTime <= new Date();
    })();

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3">
                    <div className="flex items-center justify-between text-white">
                        <div className="flex items-center gap-3">
                            {bet.useFHEVM && (
                                <div className="flex items-center gap-1 bg-white bg-opacity-20 px-2 py-1 rounded-full text-xs font-medium">
                                    <Lock className="w-3 h-3" />
                                    Private
                                </div>
                            )}
                            <div className="flex items-center gap-1">
                                {isExpired ? (
                                    <AlertCircle className="w-4 h-4" />
                                ) : (
                                    <CheckCircle className="w-4 h-4" />
                                )}
                                <span className="text-sm font-medium">
                                    {isExpired ? 'Ended' : 'Active'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {getTimeRemaining()}
                            </div>
                            <div className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {statistics.uniqueTraders || 0} traders
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <div className="grid lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-6">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 mb-3">
                                    {bet.title}
                                </h1>
                                <p className="text-gray-600 text-lg leading-relaxed">
                                    {bet.description}
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-gray-50 rounded-lg p-4 text-center transform transition-all duration-300 hover:scale-105 relative overflow-hidden">
                                    {/* Shimmer Effect - Active during update */}
                                    {isUpdating && <div className="shimmer-effect"></div>}

                                    <DollarSign className="w-6 h-6 text-green-600 mx-auto mb-2 relative z-10" />
                                    <div className={`text-xl font-bold text-gray-900 transition-all duration-1000 relative z-10 ${isUpdating ? 'opacity-40 scale-90 animate-pulse' : 'opacity-100 scale-100'}`}>
                                        {formatVolume(statistics.totalVolume || 0)}
                                    </div>
                                    <div className="text-sm text-gray-600 relative z-10">Volume</div>
                                    <div className="flex items-center justify-center gap-1 mt-1 relative z-10">
                                        {statistics.isRealTime ? (
                                            <>
                                                <Activity className="w-3 h-3 text-blue-500 animate-pulse" />
                                                <span className="text-xs text-blue-600">Real-time</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="w-3 h-3 text-green-500" />
                                                <span className="text-xs text-green-600">Oracle</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4 text-center transform transition-all duration-300 hover:scale-105 relative overflow-hidden">
                                    {/* Shimmer Effect - Active during update */}
                                    {isUpdating && <div className="shimmer-effect"></div>}

                                    <BarChart3 className="w-6 h-6 text-blue-600 mx-auto mb-2 relative z-10" />
                                    <div className={`text-xl font-bold text-gray-900 transition-all duration-1000 relative z-10 ${isUpdating ? 'opacity-40 scale-90 animate-pulse' : 'opacity-100 scale-100'}`}>
                                        {statistics.totalBets || 0}
                                    </div>
                                    <div className="text-sm text-gray-600 relative z-10">Total Bets</div>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4 text-center transform transition-all duration-300 hover:scale-105 relative overflow-hidden">
                                    {/* Shimmer Effect - Active during update */}
                                    {isUpdating && <div className="shimmer-effect"></div>}

                                    <Activity className="w-6 h-6 text-purple-600 mx-auto mb-2 relative z-10" />
                                    <div className={`text-xl font-bold text-gray-900 transition-all duration-1000 relative z-10 ${isUpdating ? 'opacity-40 scale-90 animate-pulse' : 'opacity-100 scale-100'}`}>
                                        {statistics.uniqueTraders || 0}
                                    </div>
                                    <div className="text-sm text-gray-600 relative z-10">Unique Traders</div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                                    <Target className="w-5 h-5" />
                                    Market Options
                                </h2>

                                {Number(bet.betType) === 0 ? (
                                    <div className="space-y-4">
                                        {bet.options?.map((option, index) => {
                                            const probability = calculateProbability(option);

                                            return (
                                                <div key={index} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                                    <div className="px-4 py-3 bg-gray-50">
                                                        <div className="flex items-center justify-between">
                                                            <h3 className="font-semibold text-gray-900 text-base">{option.title}</h3>
                                                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                                                <span>{option.totalShares?.toLocaleString() || 0} shares</span>
                                                                <span>{formatVolume(option.totalAmount || 0)} vol</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="p-4">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedOption(index);
                                                                setSelectedOutcome(null);
                                                            }}
                                                            disabled={isExpired}
                                                            className={`w-full relative flex items-center justify-between p-4 rounded-lg border-2 transition-all hover:shadow-sm group ${
                                                                selectedOption === index
                                                                    ? index === 0
                                                                        ? 'border-green-500 bg-green-200'
                                                                        : 'border-red-500 bg-red-200'
                                                                    : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                                                            } ${isExpired ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-4 h-4 rounded-full border-2 ${
                                                                    selectedOption === index
                                                                        ? index === 0
                                                                            ? 'border-green-500 bg-green-500'
                                                                            : 'border-red-500 bg-red-500'
                                                                        : 'border-gray-300'
                                                                }`}>
                                                                    {selectedOption === index && (
                                                                        <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                                                                    )}
                                                                </div>
                                                                <span className={`text-sm font-semibold ${
                                                                    selectedOption === index
                                                                        ? index === 0
                                                                            ? 'text-green-700'
                                                                            : 'text-red-700'
                                                                        : index === 0
                                                                            ? 'text-gray-900 group-hover:text-green-700'
                                                                            : 'text-gray-900 group-hover:text-red-700'
                                                                }`}>{option.title}</span>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className={`text-xl font-bold transition-all duration-500 ${
                                                                    'opacity-100 scale-100'
                                                                } ${
                                                                    selectedOption === index
                                                                        ? index === 0
                                                                            ? 'text-green-700'
                                                                            : 'text-red-700'
                                                                        : index === 0
                                                                            ? 'text-green-600 group-hover:text-green-700'
                                                                            : 'text-red-600 group-hover:text-red-700'
                                                                }`}>
                                                                    {probability.toFixed(1)}¢
                                                                </div>
                                                                <div className={`text-xs text-gray-500 transition-all duration-300 ${'opacity-100 scale-100'}`}>{probability.toFixed(1)}%</div>
                                                            </div>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : Number(bet.betType) === 2 ? (
                                    <div className="space-y-4">
                                        {bet.options?.map((option, index) => {
                                            const probability = calculateProbability(option);

                                            return (
                                                <div key={index} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                                    <div className="px-4 py-3 bg-gray-50">
                                                        <div className="flex items-center justify-between">
                                                            <h3 className="font-semibold text-gray-900 text-base">{option.title}</h3>
                                                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                                                <span>{option.totalShares?.toLocaleString() || 0} shares</span>
                                                                <span>{formatVolume(option.totalAmount || 0)} vol</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="p-4">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedOption(index);
                                                                    setSelectedOutcome('yes');
                                                                }}
                                                                disabled={isExpired}
                                                                className={`relative flex items-center justify-between p-4 rounded-lg border-2 transition-all hover:shadow-sm group ${
                                                                    selectedOption === index && selectedOutcome === 'yes'
                                                                        ? 'border-green-500 bg-green-200'
                                                                        : 'border-gray-200 hover:border-green-400 hover:bg-green-100'
                                                                } ${isExpired ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                            >
                                                                {/* Shimmer Effect - Active during update */}
                                                                {isUpdating && <div className="shimmer-effect"></div>}

                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-4 h-4 rounded-full border-2 ${
                                                                        selectedOption === index && selectedOutcome === 'yes'
                                                                            ? 'border-green-500 bg-green-500'
                                                                            : 'border-gray-300'
                                                                    }`}>
                                                                        {selectedOption === index && selectedOutcome === 'yes' && (
                                                                            <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                                                                        )}
                                                                    </div>
                                                                    <span className={`text-sm font-semibold ${
                                                                        selectedOption === index && selectedOutcome === 'yes'
                                                                            ? 'text-green-700'
                                                                            : 'text-gray-900 group-hover:text-green-700'
                                                                    }`}>Yes</span>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className={`text-xl font-bold transition-all duration-500 ${
                                                                        'opacity-100 scale-100'
                                                                    } ${
                                                                        selectedOption === index && selectedOutcome === 'yes'
                                                                            ? 'text-green-700'
                                                                            : 'text-green-600 group-hover:text-green-700'
                                                                    }`}>
                                                                        {probability.toFixed(1)}¢
                                                                    </div>
                                                                    <div className={`text-xs text-gray-500 transition-all duration-300 ${'opacity-100 scale-100'}`}>{probability.toFixed(1)}%</div>
                                                                </div>
                                                            </button>

                                                            <button
                                                                onClick={() => {
                                                                    setSelectedOption(index);
                                                                    setSelectedOutcome('no');
                                                                }}
                                                                disabled={isExpired}
                                                                className={`relative flex items-center justify-between p-4 rounded-lg border-2 transition-all hover:shadow-sm group ${
                                                                    selectedOption === index && selectedOutcome === 'no'
                                                                        ? 'border-red-500 bg-red-200'
                                                                        : 'border-gray-200 hover:border-red-400 hover:bg-red-100'
                                                                } ${isExpired ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                            >
                                                                {/* Shimmer Effect - Active during update */}
                                                                {isUpdating && <div className="shimmer-effect"></div>}

                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-4 h-4 rounded-full border-2 ${
                                                                        selectedOption === index && selectedOutcome === 'no'
                                                                            ? 'border-red-500 bg-red-500'
                                                                            : 'border-gray-300'
                                                                    }`}>
                                                                        {selectedOption === index && selectedOutcome === 'no' && (
                                                                            <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                                                                        )}
                                                                    </div>
                                                                    <span className={`text-sm font-semibold ${
                                                                        selectedOption === index && selectedOutcome === 'no'
                                                                            ? 'text-red-700'
                                                                            : 'text-gray-900 group-hover:text-red-700'
                                                                    }`}>No</span>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className={`text-xl font-bold transition-all duration-500 ${
                                                                        'opacity-100 scale-100'
                                                                    } ${
                                                                        selectedOption === index && selectedOutcome === 'no'
                                                                            ? 'text-red-700'
                                                                            : 'text-red-600 group-hover:text-red-700'
                                                                    }`}>
                                                                        {(100 - probability).toFixed(1)}¢
                                                                    </div>
                                                                    <div className={`text-xs text-gray-500 transition-all duration-300 ${'opacity-100 scale-100'}`}>{(100 - probability).toFixed(1)}%</div>
                                                                </div>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {bet.options?.map((option, index) => {
                                            const probability = calculateProbability(option);

                                            return (
                                                <button
                                                    key={index}
                                                    onClick={() => {
                                                        setSelectedOption(index);
                                                        setSelectedOutcome(null);
                                                    }}
                                                    disabled={isExpired}
                                                    className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all hover:shadow-sm group ${
                                                        selectedOption === index
                                                            ? 'border-blue-500 bg-blue-50'
                                                            : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                                                    } ${isExpired ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} bg-white`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-5 h-5 rounded-full border-2 ${
                                                            selectedOption === index
                                                                ? 'border-blue-500 bg-blue-500'
                                                                : 'border-gray-300'
                                                        }`}>
                                                            {selectedOption === index && (
                                                                <div className="w-3 h-3 bg-white rounded-full mx-auto mt-0.5"></div>
                                                            )}
                                                        </div>
                                                        <div className="text-left">
                                                            <h3 className={`font-semibold text-base ${
                                                                selectedOption === index ? 'text-blue-700' : 'text-gray-900'
                                                            }`}>
                                                                {option.title}
                                                            </h3>
                                                            <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                                                                <span>{option.totalShares?.toLocaleString() || 0} shares</span>
                                                                <span>{formatVolume(option.totalAmount || 0)} vol</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <div className={`text-2xl font-bold transition-all duration-500 ${
                                                            'opacity-100 scale-100'
                                                        } ${
                                                            selectedOption === index
                                                                ? 'text-blue-700'
                                                                : 'text-blue-600 group-hover:text-blue-700'
                                                        }`}>
                                                            {probability.toFixed(1)}¢
                                                        </div>
                                                        <div className={`text-xs text-gray-500 transition-all duration-300 ${'opacity-100 scale-100'}`}>{probability.toFixed(1)}%</div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-6">
                            {bet.isResolved && isConnected ? (
                                <div className="bg-white border border-gray-200 rounded-xl p-6 sticky top-6">
                                    <div className="space-y-4">
                                        <div className="text-center border-b border-gray-200 pb-4">
                                            <div className="flex items-center justify-center gap-2 mb-2">
                                                <CheckCircle className="w-6 h-6 text-green-600" />
                                                <h3 className="text-xl font-semibold text-gray-900">
                                                    Market Resolved
                                                </h3>
                                            </div>
                                            <p className="text-sm text-gray-600">This market has been settled</p>
                                        </div>

                                        {loadingPayoutStatus ? (
                                            <div className="py-8 text-center">
                                                <LoadingSpinner size="md" />
                                                <p className="text-sm text-gray-600 mt-2">Checking payout status...</p>
                                            </div>
                                        ) : userIsLoser ? (
                                            /* User lost this bet - don't show payout options */
                                            <div className="bg-red-500 border border-red-200 rounded-lg p-6 text-center">
                                                <Target className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                                                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                                                    Better Luck Next Time
                                                </h4>
                                                <p className="text-sm text-white-600">
                                                    Your prediction didn't match the outcome. You don't have any winnings to claim from this market.
                                                </p>
                                            </div>
                                        ) : payoutStatus ? (
                                            /* User participated in this bet - show appropriate state */
                                            !payoutStatus.hasRequested && !payoutStatus.isProcessed ? (
                                                /* Step 1: Need to request payout (trigger decryption) */
                                                <div className="space-y-4">
                                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                                                        <Clock className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                                                        <h4 className="text-lg font-semibold text-gray-900 mb-2">
                                                            Request Payout Calculation
                                                        </h4>
                                                        <p className="text-sm text-gray-600 mb-4">
                                                            Request payout to decrypt your bet amounts and calculate winnings.
                                                            This process takes ~1-2 minutes.
                                                        </p>
                                                    </div>
                                                    <Button
                                                        onClick={handleRequestPayout}
                                                        disabled={requesting}
                                                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {requesting ? (
                                                            <>
                                                                <LoadingSpinner size="sm" />
                                                                <span className="ml-2">Requesting...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Clock className="w-5 h-5 mr-2" />
                                                                Request Payout
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            ) : payoutStatus.hasRequested && !payoutStatus.isProcessed ? (
                                                /* Step 2: Processing (waiting for oracle callback) */
                                                <div className="bg-blue-50 border border-yellow-200 rounded-lg p-6 text-center">
                                                    <LoadingSpinner size="md" />
                                                    <h4 className="text-lg font-semibold text-gray-900 mb-2 mt-3">
                                                        Processing Payout
                                                    </h4>
                                                    <p className="text-sm text-gray-600">
                                                        Decrypting your bet amounts... This takes ~1-2 minutes.
                                                        Please refresh the page in a moment.
                                                    </p>
                                                </div>
                                            ) : payoutStatus.isProcessed && parseFloat(payoutStatus.payoutAmount) > 0 ? (
                                                /* Step 3: Ready to claim */
                                                <div className="space-y-4">
                                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                                        <div className="flex items-center gap-2 text-green-800 mb-3">
                                                            <DollarSign className="w-5 h-5" />
                                                            <span className="text-sm font-semibold">Winnings Available</span>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-3xl font-bold text-green-700 mb-1">
                                                                ${(parseFloat(payoutStatus.payoutAmount) / 1000000).toFixed(2)}
                                                            </div>
                                                            <div className="text-sm text-green-600">USDC</div>
                                                        </div>
                                                    </div>

                                                    <Button
                                                        onClick={handleClaim}
                                                        disabled={claiming}
                                                        className="w-full py-4 bg-green-600 hover:bg-green-700 text-white text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {claiming ? (
                                                            <>
                                                                <LoadingSpinner size="sm" />
                                                                <span className="ml-2">Claiming...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <DollarSign className="w-5 h-5 mr-2" />
                                                                Claim ${(parseFloat(payoutStatus.payoutAmount) / 1000000).toFixed(2)}
                                                            </>
                                                        )}
                                                    </Button>

                                                    <div className="text-xs text-gray-500 text-center">
                                                        <p>Funds will be added to your platform balance</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Processed but no winnings (user lost) */
                                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                                                    <Target className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                                                        No Winnings
                                                    </h4>
                                                    <p className="text-sm text-gray-600">
                                                        You don't have any winnings to claim from this market.
                                                    </p>
                                                </div>
                                            )
                                        ) : (
                                            /* User didn't participate */
                                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                                                <Target className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                                                    No Participation
                                                </h4>
                                                <p className="text-sm text-gray-600">
                                                    You didn't place a bet on this market.
                                                </p>
                                            </div>
                                        )}

                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                            <div className="flex items-start gap-2">
                                                <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                                                <p className="text-xs text-blue-700">
                                                    Winnings are automatically calculated based on your winning positions and the final market settlement.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white border border-gray-200 rounded-xl p-6 sticky top-6">
                                    <div className="space-y-6">
                                        <div className="text-center">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                                Place Your Bet
                                            </h3>

                                        {!isConnected ? (
                                            <p className="text-sm text-gray-600">Connect wallet to start trading</p>
                                        ) : selectedOption === null ? (
                                            <p className="text-sm text-gray-600">Select an option to continue</p>
                                        ) : Number(bet.betType) === 2 && selectedOutcome === null ? (
                                            <p className="text-sm text-gray-600">Select Yes or No to continue</p>
                                        ) : (
                                            <p className="text-sm text-gray-600">
                                                Betting {Number(bet.betType) === 0 || Number(bet.betType) === 1 ? 'on' : selectedOutcome?.toUpperCase()}: <span className={`font-medium ${
                                                Number(bet.betType) === 0 || Number(bet.betType) === 1
                                                    ? 'text-blue-600'
                                                    : selectedOutcome === 'yes' ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                                    {bet.options[selectedOption]?.title}
                                                </span>
                                            </p>
                                        )}
                                    </div>

                                    {!isConnected ? (
                                        <div className="space-y-3">
                                            <Button
                                                onClick={handleConnectWallet}
                                                disabled={isConnecting}
                                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isConnecting ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                                        Connecting...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Wallet className="w-5 h-5 mr-2" />
                                                        Connect Wallet
                                                    </>
                                                )}
                                            </Button>

                                            {connectionError && (
                                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                                    <div className="flex items-center gap-2 text-red-800">
                                                        <AlertCircle className="w-4 h-4" />
                                                        <span className="text-sm font-medium">Connection Failed</span>
                                                    </div>
                                                    <p className="text-red-700 text-sm mt-1">{connectionError}</p>
                                                    <button
                                                        onClick={() => setConnectionError(null)}
                                                        className="text-red-600 hover:text-red-800 text-sm mt-2 underline"
                                                    >
                                                        Dismiss
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : cachedBalance === null ? (
                                        <div className="space-y-4">
                                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                                <div className="flex items-center gap-2 text-green-800">
                                                    <CheckCircle className="w-4 h-4" />
                                                    <span className="text-sm font-medium">
                                                        {account?.slice(0, 6)}...{account?.slice(-4)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="bg-gray-50 border border-yellow-300 rounded-lg p-6 text-center">
                                                <Lock className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                                                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                                                    Reveal Balance to Bet
                                                </h4>
                                                <p className="text-sm text-gray-600 mb-4">
                                                    Decrypt your encrypted balance to start betting
                                                </p>
                                                <Button
                                                    onClick={handleDecryptBalance}
                                                    disabled={decryptingBalance}
                                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {decryptingBalance ? (
                                                        <>
                                                            <LoadingSpinner size="sm" />
                                                            <span className="ml-2">Decrypting Balance...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Eye className="w-5 h-5 mr-2" />
                                                            Reveal Balance
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    ) : parseFloat(cachedBalance || 0) === 0 ? (
                                        <div className="space-y-4">
                                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                                <div className="flex items-center gap-2 text-green-800">
                                                    <CheckCircle className="w-4 h-4" />
                                                    <span className="text-sm font-medium">
                                                        {account?.slice(0, 6)}...{account?.slice(-4)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm text-gray-600">Platform Balance:</span>
                                                    <span className="text-sm font-semibold text-blue-600">
                                                        $0.00 USDC
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="bg-gray-50 border border-red-300 rounded-lg p-6 text-center">
                                                <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                                                    Deposit to Place Bet
                                                </h4>
                                                <p className="text-sm text-gray-600 mb-4">
                                                    Your balance is $0.00. Please deposit USDC to start betting.
                                                </p>
                                                <Link to="/wallet">
                                                    <Button className="w-full py-3 bg-green-600 hover:bg-green-700 text-white">
                                                        <Plus className="w-5 h-5 mr-2" />
                                                        Deposit USDC
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                                <div className="flex items-center gap-2 text-green-800">
                                                    <CheckCircle className="w-4 h-4" />
                                                    <span className="text-sm font-medium">
                                                        {account?.slice(0, 6)}...{account?.slice(-4)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-sm text-gray-600">Platform Balance:</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-semibold text-blue-600">
                                                                ${parseFloat(cachedBalance).toFixed(2)} USDC
                                                            </span>
                                                            <button
                                                                onClick={handleDecryptBalance}
                                                                disabled={decryptingBalance}
                                                                className="p-1 text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                                                                title="Refresh balance"
                                                            >
                                                                <RefreshCw className={`w-3.5 h-3.5 ${decryptingBalance ? 'animate-spin' : ''}`} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <Link
                                                        to="/wallet"
                                                        className="text-xs text-blue-500 hover:text-blue-700 underline inline-block"
                                                    >
                                                        Manage in Wallet →
                                                    </Link>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <label className="block text-sm font-medium text-gray-700">
                                                        Bet Amount (USDC)
                                                    </label>

                                                    {bet?.useFHEVM && (
                                                        <div className="flex items-center space-x-2"                                                        style={{
                                                            marginBottom: "2px",
                                                        }}>
                                                            <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${
                                                                isFhevmInitialized
                                                                    ? 'bg-green-100 text-green-700 border border-green-200'
                                                                    : fhevmLoading
                                                                        ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                                                                        : 'bg-orange-100 text-orange-700 border border-orange-200'
                                                            }`}>
                                                                <Lock className="h-3 w-3" />
                                                                <span>
                                                                    {isFhevmInitialized
                                                                        ? 'FHEVM'
                                                                        : fhevmLoading
                                                                            ? 'Initializing...'
                                                                            : 'Private Betting'
                                                                    }
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-5 gap-1">
                                                    {quickAmounts.map((amount) => (
                                                        <button
                                                            key={amount}
                                                            onClick={() => setBetAmount(amount.toString())}
                                                            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                                                        >
                                                            ${amount}
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        value={betAmount}
                                                        onChange={(e) => setBetAmount(e.target.value)}
                                                        className="w-full px-4 py-3 pr-16 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-medium text-gray-900 dark:text-gray-100 bg-white"
                                                        placeholder="Enter amount"
                                                        min={bet.minBetAmount || 1}
                                                        max={bet.maxBetAmount || 10000}
                                                        disabled={isExpired}
                                                        style={{
                                                            color: '#111827',
                                                            appearance: 'textfield'
                                                        }}
                                                    />
                                                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium pointer-events-none">
                                                        USDC
                                                    </div>
                                                    <style>{`
                                                        input[type="number"]::-webkit-outer-spin-button,
                                                        input[type="number"]::-webkit-inner-spin-button {
                                                            -webkit-appearance: none;
                                                            margin: 0;
                                                        }
                                                        input[type="number"] {
                                                            -moz-appearance: textfield;
                                                        }
                                                    `}</style>
                                                </div>

                                                <div className="text-xs text-gray-500 flex justify-between">
                                                    <span>Min: ${bet.minBetAmount || 1}</span>
                                                    <span>Max: ${bet.maxBetAmount || 10000}</span>
                                                </div>
                                            </div>

                                            {selectedOption !== null && betAmount && (Number(bet.betType) === 0 || Number(bet.betType) === 1 || selectedOutcome) && (
                                                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-600">Cost:</span>
                                                        <span className="font-medium">${betAmount}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-600">Outcome:</span>
                                                        <span className={`font-medium ${
                                                            Number(bet.betType) === 0 || Number(bet.betType) === 1
                                                                ? 'text-blue-600'
                                                                : selectedOutcome === 'yes' ? 'text-green-600' : 'text-red-600'
                                                        }`}>
                                                            {bet?.options?.[selectedOption]?.title}
                                                            {Number(bet.betType) === 2 && selectedOutcome && ` (${selectedOutcome.toUpperCase()})`}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-600">Potential return:</span>
                                                        <span className="font-medium text-green-600">
                                                            ${potentialReturn.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                                                        <span className="text-gray-600 flex items-center gap-1">
                                                            Estimated payout:
                                                            <span className="text-xs text-gray-400 cursor-help" title="Based on current pool state. Final payout depends on total pool at bet close time.">ⓘ</span>
                                                        </span>
                                                        <span className="font-semibold text-green-600">
                                                            ${(parseFloat(betAmount) + potentialReturn).toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-gray-400 pt-1 italic">
                                                        May change as more bets are placed
                                                    </div>
                                                </div>
                                            )}

                                            <Button
                                                onClick={handlePlaceBet}
                                                disabled={placing || selectedOption === null || (Number(bet.betType) === 2 && selectedOutcome === null) || !betAmount || isExpired}
                                                className={`w-full py-4 text-lg font-medium transition-all ${
                                                    selectedOption !== null && (Number(bet.betType) === 0 || Number(bet.betType) === 1 || selectedOutcome !== null) && betAmount && !isExpired
                                                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                }`}
                                            >
                                                {placing ? (
                                                    <>
                                                        <LoadingSpinner size="sm" />
                                                        Placing Bet...
                                                    </>
                                                ) : isExpired ? (
                                                    'Market Closed'
                                                ) : selectedOption === null ? (
                                                    'Select Option'
                                                ) : Number(bet.betType) === 2 && selectedOutcome === null ? (
                                                    'Select Yes or No'
                                                ) : !betAmount ? (
                                                    'Enter Amount'
                                                ) : (
                                                    <>
                                                        <Target className="w-5 h-5 mr-2" />
                                                        Place Bet
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            )}

                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                    <Info className="w-4 h-4" />
                                    Market Info
                                </h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Format:</span>
                                        <span className="font-medium">
                                            {Number(bet.betType) === 0 ? 'Yes/No' :
                                                Number(bet.betType) === 1 ? 'Multiple Choice' :
                                                    Number(bet.betType) === 2 ? 'Multi-Market' : 'Unknown'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Created:</span>
                                        <span className="font-medium">
                                            {(() => {
                                                if (!bet.createdAt) return 'Unknown';
                                                const timestamp = typeof bet.createdAt === 'string'
                                                    ? parseInt(bet.createdAt)
                                                    : Number(bet.createdAt);
                                                const createdTime = new Date(timestamp * 1000);
                                                if (isNaN(createdTime.getTime())) return 'Invalid date';
                                                return formatDistanceToNow(createdTime, { addSuffix: true });
                                            })()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Resolution:</span>
                                        <span className="font-medium">
                                            {bet.resolutionSource || 'Manual'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isConnected && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="border-b border-gray-200">
                        <div className="flex items-center justify-between p-2">
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setActiveTab('positions')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        activeTab === 'positions'
                                            ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                            : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Target className="w-4 h-4" />
                                        My Position
                                    </div>
                                </button>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        activeTab === 'history'
                                            ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                            : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        Order History
                                    </div>
                                </button>
                            </div>

                            {account && (
                                <button
                                    onClick={handleRevealAll}
                                    disabled={decryptingAll}
                                    className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-800 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                                >
                                    {decryptingAll ? (
                                        <>
                                            <LoadingSpinner size="sm" />
                                            Revealing All...
                                        </>
                                    ) : (
                                        <>
                                            <Eye className="w-3 h-3" />
                                            Reveal All
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="p-6">
                        {activeTab === 'positions' && (
                            <div>
                                {/*<h3 className="text-lg font-semibold text-gray-900 mb-4">Your Position in This Market</h3>*/}

                                {loadingPosition ? (
                                    <div className="flex justify-center py-8">
                                        <LoadingSpinner size="md" text="Loading position..." />
                                    </div>
                                ) : !userPositions || userPositions.positions.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500 mb-2">No position in this market</p>
                                        <p className="text-sm text-gray-400">Place a bet to see your position here</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {userPositions.positions.map((position, idx) => (
                                            <div
                                                key={idx}
                                                className={`border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-all duration-300 ${
                                                    isPositionUpdating ? 'opacity-0' : 'opacity-100'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-3">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-gray-900">
                                                                {position.optionTitle}
                                                            </span>
                                                            {position.outcome && (
                                                                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${
                                                                    position.outcome === 'YES'
                                                                        ? 'bg-[rgb(42,36,40)] text-white border-gray-700'
                                                                        : 'bg-[rgb(42,36,40)] text-white border-gray-700'
                                                                }`}>
                                                                    {position.outcome}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-500 mt-1">Option {position.optionIndex + 1}</p>
                                                    </div>

                                                    <div className="text-right">
                                                        {position.isRevealed ? (
                                                            <div>
                                                                <div className="text-lg font-bold text-gray-900">
                                                                    ${position.totalAmount?.toFixed(2) || '0.00'}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <Lock className="w-4 h-4 text-gray-400" />
                                                                <span className="text-sm text-gray-500">Not Revealed</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {!position.isEncrypted && (
                                                    <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-100">
                                                        <div>
                                                            <p className="text-xs text-gray-500">Avg Price</p>
                                                            <p className="text-sm font-medium text-gray-900">
                                                                {position.isPriceDataAvailable ? (
                                                                    <>{position.avgPrice?.toFixed(0) || '0'}¢</>
                                                                ) : (
                                                                    <span className="flex items-center gap-1">
                                                                        <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                        </svg>
                                                                    </span>
                                                                )}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500">Current Value</p>
                                                            <p className="text-sm font-medium text-gray-900">
                                                                {position.isPriceDataAvailable ? (
                                                                    <>${position.currentValue?.toFixed(2) || '0.00'}</>
                                                                ) : (
                                                                    <span className="flex items-center gap-1">
                                                                        <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                        </svg>
                                                                    </span>
                                                                )}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500">P&L</p>
                                                            <p className={`text-sm font-medium ${
                                                                position.isPriceDataAvailable && (position.pnl || 0) >= 0 ? 'text-green-600' : position.isPriceDataAvailable ? 'text-red-600' : 'text-gray-400'
                                                            }`}>
                                                                {position.isPriceDataAvailable ? (
                                                                    <>
                                                                        {(position.pnl || 0) >= 0 ? '+' : ''}
                                                                        ${position.pnl?.toFixed(2) || '0.00'}
                                                                    </>
                                                                ) : (
                                                                    <span className="flex items-center gap-1">
                                                                        <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                        </svg>
                                                                    </span>
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div>
                                {/*<h3 className="text-lg font-semibold text-gray-900 mb-4">Order History</h3>*/}

                                {loadingHistory ? (
                                    <div className="flex justify-center py-8">
                                        <LoadingSpinner size="md" text="Loading history..." />
                                    </div>
                                ) : orderHistory.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500">No order history</p>
                                        <p className="text-sm text-gray-400 mt-1">
                                            Your betting history will appear here
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {orderHistory.map((order, idx) => (
                                            <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                    <span className="font-medium text-gray-900">
                                        {order.optionTitle}
                                    </span>
                                                        </div>
                                                        <p className="text-sm text-gray-500">
                                                            {new Date(order.timestamp * 1000).toLocaleString()}
                                                        </p>
                                                    </div>

                                                    {order.txHash ? (
                                                        <a
                                                            href={`https://sepolia.etherscan.io/tx/${order.txHash}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
                                                        >
                                                            <span>View TX</span>
                                                            <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">No TX hash</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <BetSuccessModal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                transactionHash={successData.transactionHash}
                betAmount={successData.betAmount}
                betOption={successData.betOption}
            />
        </div>
    );
};

export default BetDetail;