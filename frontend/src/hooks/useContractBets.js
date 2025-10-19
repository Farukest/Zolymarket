import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getNetworkConfig } from '../config/contracts';
import BetMarketCoreABI from '@artifacts/BetMarketCore.sol/BetMarketCore.json';
import BetMarketStatsABI from '@artifacts/BetMarketStats.sol/BetMarketStats.json';
import { getFhevmInstance } from '../lib/fhe.js';

/**
 * Hook to fetch bet data directly from blockchain
 * NO DATABASE - Pure contract data
 */
export const useContractBets = (chainId) => {
    const [bets, setBets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let mounted = true;

        const fetchBetsFromContract = async () => {
            try {
                setLoading(true);
                setError(null);

                // Get contract configuration
                const networkConfig = getNetworkConfig(chainId);
                const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);

                // Initialize Core and Stats contracts
                const coreContract = new ethers.Contract(
                    networkConfig.contracts.BET_MARKET_CORE,
                    BetMarketCoreABI.abi,
                    provider
                );

                const statsContract = networkConfig.contracts.BET_MARKET_STATS ? new ethers.Contract(
                    networkConfig.contracts.BET_MARKET_STATS,
                    BetMarketStatsABI.abi,
                    provider
                ) : null;

                // Get total number of bets
                const totalBets = Number(await coreContract.getTotalBets());
                console.log(`📊 Total bets in contract: ${totalBets}`);

                if (!mounted) return;

                if (totalBets === 0) {
                    setBets([]);
                    setLoading(false);
                    return;
                }

                // Fetch all bets
                const betPromises = [];
                for (let betId = 1; betId <= totalBets; betId++) {
                    betPromises.push(fetchSingleBet(coreContract, statsContract, betId));
                }

                const fetchedBets = await Promise.all(betPromises);

                if (!mounted) return;

                // Filter out null values (failed fetches) and only active bets
                const validBets = fetchedBets.filter(bet => bet !== null && bet.isActive);

                console.log(`✅ Loaded ${validBets.length} active bets from contract`);
                setBets(validBets);
                setLoading(false);

            } catch (err) {
                console.error('Error fetching bets from contract:', err);
                if (mounted) {
                    setError(err);
                    setBets([]);
                    setLoading(false);
                }
            }
        };

        const fetchSingleBet = async (coreContract, statsContract, betId) => {
            try {
                // Get bet basic info
                const betData = await coreContract.getBet(betId);

                const betType = Number(betData.betType);
                const optionCount = Number(betData.optionCount);
                const liquidityParam = Number(betData.liquidityParam);

                // Get options with decrypted statistics
                const options = [];

                if (betType === 2) {
                    // NESTED: Get Yes/No shares for each option
                    let yesSharesArray, noSharesArray, isDecrypted;

                    try {
                        if (statsContract) {
                            [yesSharesArray, noSharesArray, isDecrypted] = await statsContract.getNestedBetStatistics(betId);
                        } else {
                            throw new Error('Stats contract not available');
                        }
                    } catch (err) {
                        console.warn(`getNestedBetStatistics failed for bet ${betId}, using defaults:`, err);
                        isDecrypted = false;
                        yesSharesArray = Array(optionCount).fill(0);
                        noSharesArray = Array(optionCount).fill(0);
                    }

                    // If oracle hasn't decrypted yet, use HTTP Relayer
                    if (!isDecrypted) {
                        try {
                            const instance = await getFhevmInstance();
                            const handles = [];

                            // Get encrypted handles for each option's Yes/No
                            for (let i = 0; i < optionCount; i++) {
                                const yesHandle = await coreContract.getNestedOptionEncryptedTotal(betId, i, 0);
                                const noHandle = await coreContract.getNestedOptionEncryptedTotal(betId, i, 1);
                                handles.push(yesHandle, noHandle);
                            }

                            const validHandles = handles.filter(h => h && h !== '0x0000000000000000000000000000000000000000000000000000000000000000');

                            if (validHandles.length > 0) {
                                const decryptedResult = await instance.publicDecrypt(validHandles);

                                const decryptedValues = handles.map(handle => {
                                    if (handle && handle !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                                        return Number(decryptedResult[handle] || 0);
                                    }
                                    return 0;
                                });

                                // Extract Yes/No values
                                yesSharesArray = [];
                                noSharesArray = [];
                                for (let i = 0; i < optionCount; i++) {
                                    yesSharesArray.push(decryptedValues[i * 2]);
                                    noSharesArray.push(decryptedValues[i * 2 + 1]);
                                }
                            }
                        } catch (httpError) {
                            console.warn(`HTTP Relayer decryption failed for bet ${betId}:`, httpError);
                        }
                    }

                    // Build options with prices
                    for (let i = 0; i < optionCount; i++) {
                        const optionInfo = await coreContract.getBetOption(betId, i);

                        const yesShares = Number(yesSharesArray[i]) / 1000000;
                        const noShares = Number(noSharesArray[i]) / 1000000;

                        // Calculate Yes price for this option
                        const yesWithLiquidity = yesShares + liquidityParam;
                        const noWithLiquidity = noShares + liquidityParam;
                        const totalWithLiquidity = yesWithLiquidity + noWithLiquidity;
                        const currentPrice = Number(((yesWithLiquidity / totalWithLiquidity) * 100).toFixed(1));

                        options.push({
                            title: optionInfo.title,
                            totalShares: yesShares + noShares,
                            yesShares: yesShares,
                            noShares: noShares,
                            currentPrice: currentPrice,
                            isWinner: optionInfo.isWinner
                        });
                    }
                } else {
                    // BINARY or MULTIPLE: Get total shares for each option
                    let optionTotals, isDecrypted;

                    try {
                        if (statsContract) {
                            [optionTotals, isDecrypted] = await statsContract.getBetStatistics(betId);
                        } else {
                            throw new Error('Stats contract not available');
                        }
                    } catch (err) {
                        console.warn(`getBetStatistics failed for bet ${betId}, using defaults:`, err);
                        isDecrypted = false;
                        optionTotals = Array(optionCount).fill(0);
                    }

                    // If oracle hasn't decrypted yet, use HTTP Relayer
                    if (!isDecrypted) {
                        try {
                            const instance = await getFhevmInstance();
                            const handles = [];

                            // Get encrypted handles for each option
                            for (let i = 0; i < optionCount; i++) {
                                const handle = await coreContract.getOptionEncryptedTotal(betId, i);
                                handles.push(handle);
                            }

                            const validHandles = handles.filter(h => h && h !== '0x0000000000000000000000000000000000000000000000000000000000000000');

                            if (validHandles.length > 0) {
                                const decryptedResult = await instance.publicDecrypt(validHandles);

                                optionTotals = handles.map(handle => {
                                    if (handle && handle !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                                        return decryptedResult[handle] || 0;
                                    }
                                    return 0;
                                });
                            }
                        } catch (httpError) {
                            console.warn(`HTTP Relayer decryption failed for bet ${betId}:`, httpError);
                        }
                    }

                    let totalSharesSum = 0;
                    const optionData = [];

                    for (let i = 0; i < optionCount; i++) {
                        const optionInfo = await coreContract.getBetOption(betId, i);
                        const totalShares = Number(optionTotals[i]) / 1000000;

                        optionData.push({
                            title: optionInfo.title,
                            totalShares: totalShares,
                            isWinner: optionInfo.isWinner
                        });

                        totalSharesSum += totalShares + liquidityParam;
                    }

                    // Calculate prices
                    optionData.forEach(option => {
                        const optionWithLiquidity = option.totalShares + liquidityParam;
                        option.currentPrice = Number(((optionWithLiquidity / totalSharesSum) * 100).toFixed(1));
                        options.push(option);
                    });
                }

                // Calculate total volume (sum of all shares)
                const volume = options.reduce((sum, opt) => sum + opt.totalShares, 0);

                return {
                    id: betId.toString(),
                    contractId: betId,
                    title: betData.title,
                    description: betData.description,
                    betType: betType,
                    optionCount: optionCount,
                    options: options,
                    endTime: Number(betData.endTime) * 1000, // Convert to milliseconds
                    isActive: betData.isActive,
                    isResolved: betData.isResolved,
                    minBetAmount: Number(betData.minBetAmount) / 1000000,
                    maxBetAmount: Number(betData.maxBetAmount) / 1000000,
                    liquidityParam: liquidityParam,
                    volume: volume,
                    imageUrl: null, // No image URL in contract, can add default or generate
                    category: null, // No category in contract
                    createdAt: Date.now() // Approximation
                };

            } catch (err) {
                console.error(`Failed to fetch bet ${betId}:`, err);
                return null;
            }
        };

        fetchBetsFromContract();

        return () => {
            mounted = false;
        };
    }, [chainId]);

    return { bets, loading, error };
};
