// FHE Encryption Library - Updated to use Official Documentation Pattern
// Official FHEVM integration with Sepolia testnet

// FHE instance management - Global singleton
let fhevmInstance = null;
let isInitializing = false;

/**
 * Initialize FHEVM instance - Using Official Documentation Pattern with Dynamic Network Detection
 * From: https://docs.zama.ai/fhevm/getting_started
 */
export async function initializeFHE() {
    try {
        // Return existing instance if available (silent)
        if (fhevmInstance) {
            return fhevmInstance;
        }

        // Prevent multiple simultaneous initializations
        if (isInitializing) {
            console.log('🔄 FHEVM: Already initializing, waiting...');
            while (isInitializing) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return fhevmInstance;
        }

        isInitializing = true;
        console.log('🚀 FHEVM: Starting initialization with Official Documentation pattern...');

        if (!fhevmInstance) {
            // Use bundle approach exactly as Official Documentation shows
            console.log('🔧 Importing FHEVM SDK bundle (Official Documentation)...');
            const { initSDK, createInstance, SepoliaConfig } = await import('@zama-fhe/relayer-sdk/bundle');
            console.log('✅ FHEVM SDK bundle imported successfully');

            // Load WASM first (Official Documentation step)
            console.log('🔧 Loading WASM with initSDK...');
            await initSDK();
            console.log('✅ WASM loaded successfully');

            // Get current network chainId from wallet
            let currentChainId = null;
            if (window.ethereum) {
                try {
                    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
                    currentChainId = parseInt(chainId, 16);
                    console.log('🔍 Detected wallet chainId:', currentChainId);
                } catch (error) {
                    console.warn('⚠️ Could not detect chainId, defaulting to Sepolia');
                }
            }

            // Create FHEVM instance using correct config for network
            console.log('🔧 Creating FHEVM instance with network-specific config...');

            // Always use SepoliaConfig for now (as per documentation)
            const config = { ...SepoliaConfig, network: window.ethereum };

            if (currentChainId === 31337) {
                console.log('⚠️ Localhost detected but using SepoliaConfig (no localhost FHEVM support)');
            } else if (currentChainId === 11155111) {
                console.log('✅ Sepolia detected, using SepoliaConfig');
            } else {
                console.log(`⚠️ Unknown network ${currentChainId}, using SepoliaConfig as fallback`);
            }

            fhevmInstance = await createInstance(config);

            console.log('✅ FHEVM instance initialized successfully (Official Documentation pattern)');
        }
        return fhevmInstance;
    } catch (error) {
        console.error('❌ Failed to initialize FHEVM SDK (Official pattern):', error);
        console.error('Error details:', error);
        throw new Error('Failed to initialize FHE encryption');
    } finally {
        isInitializing = false;
    }
}

/**
 * Get initialized FHEVM instance
 */
export async function getFhevmInstance() {
    if (!fhevmInstance) {
        await initializeFHE();
    }
    return fhevmInstance;
}

/**
 * Client-side FHEVM encryption using Official Documentation pattern
 * @param {number} amount - Bet amount in USDC (6 decimals)
 * @param {string} contractAddress - BetMarket contract address
 * @param {string} userAddress - User wallet address
 * @returns {Promise<{encryptedData: string, inputProof: string}>} Encrypted data for contract
 */
async function encryptClientSide(amount, contractAddress, userAddress) {
    try {
        console.log('🔧 Attempting client-side encryption (Official Documentation pattern)...');

        const { initSDK, createInstance, SepoliaConfig } = await import('@zama-fhe/relayer-sdk/bundle');
        console.log('✅ FHEVM SDK bundle imported successfully');

        console.log('🔧 Loading WASM with initSDK...');
        await initSDK();
        console.log('✅ WASM loaded successfully');

        const instance = await createInstance(SepoliaConfig);
        console.log('✅ Client-side FHEVM instance created (bundle compatibility)');

        const buffer = instance.createEncryptedInput(contractAddress, userAddress);
        buffer.add64(BigInt(amount));

        console.log('🔐 Encrypting client-side (Official pattern)...');
        const encryptedInputs = await buffer.encrypt();

        console.log('✅ Client-side encryption completed (Official):', {
            handlesCount: encryptedInputs.handles?.length,
            proofLength: encryptedInputs.inputProof?.length
        });

        const toHex = (uint8Array) => {
            return '0x' + Array.from(uint8Array)
                .map(byte => byte.toString(16).padStart(2, '0'))
                .join('');
        };

        const result = {
            encryptedData: encryptedInputs.handles[0],
            inputProof: encryptedInputs.inputProof instanceof Uint8Array ?
                toHex(encryptedInputs.inputProof) : encryptedInputs.inputProof,
        };

        console.log('✅ Client-side encryption result (Official)');
        return result;
    } catch (error) {
        console.error('❌ Client-side encryption failed (Official pattern):', error);
        throw error;
    }
}

/**
 * Encrypt bet amount for private betting - Relayer first, then client-side fallback
 */
export async function encryptBetAmount(amount, contractAddress, userAddress) {
    try {
        const instance = await getFhevmInstance();

        if (instance && instance.createEncryptedInput) {
            console.log('🌐 Attempting relayer encryption...');
            const buffer = instance.createEncryptedInput(contractAddress, userAddress);
            buffer.add64(BigInt(amount));

            console.log('Encrypting value with relayer...');
            const ciphertexts = await buffer.encrypt();

            console.log('✅ Relayer encryption successful');

            const toHex = (uint8Array) => {
                return '0x' + Array.from(uint8Array)
                    .map(byte => byte.toString(16).padStart(2, '0'))
                    .join('');
            };

            const result = {
                encryptedData: ciphertexts.handles[0],
                inputProof: ciphertexts.inputProof instanceof Uint8Array ? toHex(ciphertexts.inputProof) : ciphertexts.inputProof,
            };

            return result;
        }
    } catch (relayerError) {
        console.warn('⚠️ Relayer encryption failed:', relayerError.message);
    }

    try {
        console.log('🔄 Falling back to client-side encryption...');
        return await encryptClientSide(amount, contractAddress, userAddress);
    } catch (clientError) {
        console.warn('⚠️ Client-side encryption failed:', clientError.message);
    }

    throw new Error('❌ FHEVM encryption completely failed. Both relayer and client-side encryption unavailable.');
}

/**
 * Client-side FHEVM encryption for bet data using Official Documentation pattern
 */
async function encryptBetDataClientSide(optionIndex, amount, contractAddress, userAddress) {
    try {
        console.log('🔧 Attempting client-side bet data encryption (Official Documentation pattern)...');

        const { initSDK, createInstance, SepoliaConfig } = await import('@zama-fhe/relayer-sdk/bundle');
        console.log('✅ FHEVM SDK bundle imported successfully');

        console.log('🔧 Loading WASM with initSDK...');
        await initSDK();
        console.log('✅ WASM loaded successfully');

        const instance = await createInstance(SepoliaConfig);
        console.log('✅ Client-side FHEVM instance created (bundle compatibility)');

        console.log('🔐 Client-side encrypting option index (Official)...');
        const optionBuffer = instance.createEncryptedInput(contractAddress, userAddress);
        optionBuffer.add8(BigInt(optionIndex));
        const optionCiphertexts = await optionBuffer.encrypt();

        console.log('🔐 Client-side encrypting amount (Official)...');
        const amountBuffer = instance.createEncryptedInput(contractAddress, userAddress);
        amountBuffer.add64(BigInt(amount));
        const amountCiphertexts = await amountBuffer.encrypt();

        const toHex = (uint8Array) => {
            return '0x' + Array.from(uint8Array)
                .map(byte => byte.toString(16).padStart(2, '0'))
                .join('');
        };

        const result = {
            encryptedOptionIndex: optionCiphertexts.handles[0],
            optionProof: toHex(optionCiphertexts.inputProof),
            encryptedAmount: amountCiphertexts.handles[0],
            amountProof: toHex(amountCiphertexts.inputProof),
        };

        console.log('✅ Client-side bet data encryption completed (Official pattern)');
        return result;
    } catch (error) {
        console.error('❌ Client-side bet data encryption failed (Official pattern):', error);
        throw error;
    }
}

/**
 * Encrypt option index and amount with SEPARATE proofs
 */
export async function encryptBetData(optionIndex, amount, contractAddress, userAddress) {
    if (typeof optionIndex !== 'number' || optionIndex < 0 || optionIndex > 255) {
        throw new Error(`Invalid option index: ${optionIndex}. Must be 0-255`);
    }

    if (typeof amount !== 'number' || amount <= 0) {
        throw new Error(`Invalid amount: ${amount}. Must be positive`);
    }

    console.log('🔐 encryptBetData called with:', { optionIndex, amount, contractAddress, userAddress });

    try {
        const instance = await getFhevmInstance();

        if (instance && instance.createEncryptedInput) {
            console.log('🌐 Attempting relayer bet data encryption...');

            console.log('🔐 Encrypting option index separately...');
            const optionBuffer = instance.createEncryptedInput(contractAddress, userAddress);
            optionBuffer.add8(BigInt(optionIndex));
            const optionCiphertexts = await optionBuffer.encrypt();

            console.log('🔐 Encrypting amount separately...');
            const amountBuffer = instance.createEncryptedInput(contractAddress, userAddress);
            amountBuffer.add64(BigInt(amount));
            const amountCiphertexts = await amountBuffer.encrypt();

            console.log('✅ Relayer bet data encryption successful');

            const toHex = (uint8Array) => {
                return '0x' + Array.from(uint8Array)
                    .map(byte => byte.toString(16).padStart(2, '0'))
                    .join('');
            };

            let optionData = optionCiphertexts.handles?.[0] || optionCiphertexts.data || optionCiphertexts.encrypted;
            let amountData = amountCiphertexts.handles?.[0] || amountCiphertexts.data || amountCiphertexts.encrypted;

            const result = {
                encryptedOptionIndex: optionData,
                optionProof: optionCiphertexts.inputProof instanceof Uint8Array ?
                    toHex(optionCiphertexts.inputProof) : optionCiphertexts.inputProof,
                encryptedAmount: amountData,
                amountProof: amountCiphertexts.inputProof instanceof Uint8Array ?
                    toHex(amountCiphertexts.inputProof) : amountCiphertexts.inputProof,
            };

            return result;
        }
    } catch (relayerError) {
        console.warn('⚠️ Relayer bet data encryption failed:', relayerError.message);
    }

    try {
        console.log('🔄 Falling back to client-side bet data encryption...');
        return await encryptBetDataClientSide(optionIndex, amount, contractAddress, userAddress);
    } catch (clientError) {
        console.warn('⚠️ Client-side bet data encryption failed:', clientError.message);
    }

    throw new Error('❌ FHEVM encryption completely failed.');
}

/**
 * Encrypt nested bet data (option + outcome + amount) with SEPARATE proofs
 * For NESTED_CHOICE bet type
 */
export async function encryptNestedBetData(optionIndex, outcome, amount, contractAddress, userAddress) {
    if (typeof optionIndex !== 'number' || optionIndex < 0 || optionIndex > 255) {
        throw new Error(`Invalid option index: ${optionIndex}. Must be 0-255`);
    }

    if (typeof outcome !== 'number' || (outcome !== 0 && outcome !== 1)) {
        throw new Error(`Invalid outcome: ${outcome}. Must be 0 (YES) or 1 (NO)`);
    }

    if (typeof amount !== 'number' || amount <= 0) {
        throw new Error(`Invalid amount: ${amount}. Must be positive`);
    }

    console.log('🔐 encryptNestedBetData called with:', { optionIndex, outcome, amount, contractAddress, userAddress });

    try {
        const instance = await getFhevmInstance();

        if (instance && instance.createEncryptedInput) {
            console.log('🌐 Attempting relayer nested bet data encryption...');

            console.log('🔐 Encrypting option index...');
            const optionBuffer = instance.createEncryptedInput(contractAddress, userAddress);
            optionBuffer.add8(BigInt(optionIndex));
            const optionCiphertexts = await optionBuffer.encrypt();

            console.log('🔐 Encrypting outcome (YES/NO)...');
            const outcomeBuffer = instance.createEncryptedInput(contractAddress, userAddress);
            outcomeBuffer.add8(BigInt(outcome));
            const outcomeCiphertexts = await outcomeBuffer.encrypt();

            console.log('🔐 Encrypting amount...');
            const amountBuffer = instance.createEncryptedInput(contractAddress, userAddress);
            amountBuffer.add64(BigInt(amount));
            const amountCiphertexts = await amountBuffer.encrypt();

            console.log('✅ Relayer nested bet data encryption successful');

            const toHex = (uint8Array) => {
                return '0x' + Array.from(uint8Array)
                    .map(byte => byte.toString(16).padStart(2, '0'))
                    .join('');
            };

            const result = {
                encryptedOptionIndex: optionCiphertexts.handles?.[0] || optionCiphertexts.data,
                optionProof: outcomeCiphertexts.inputProof instanceof Uint8Array ?
                    toHex(optionCiphertexts.inputProof) : optionCiphertexts.inputProof,
                encryptedOutcome: outcomeCiphertexts.handles?.[0] || outcomeCiphertexts.data,
                outcomeProof: outcomeCiphertexts.inputProof instanceof Uint8Array ?
                    toHex(outcomeCiphertexts.inputProof) : outcomeCiphertexts.inputProof,
                encryptedAmount: amountCiphertexts.handles?.[0] || amountCiphertexts.data,
                amountProof: amountCiphertexts.inputProof instanceof Uint8Array ?
                    toHex(amountCiphertexts.inputProof) : amountCiphertexts.inputProof,
            };

            return result;
        }
    } catch (error) {
        console.error('❌ Nested bet data encryption failed:', error);
        throw new Error('FHEVM nested encryption failed.');
    }
}

/**
 * ✅ USER BALANCE DECRYPTION - YENİ EKLENEN FONKSİYON
 * Decrypt user's encrypted balance using user decryption
 * @param {string} contractAddress - Contract address
 * @param {string} userAddress - User address
 * @returns {Promise<string>} Decrypted balance as string
 */
/**
 * ✅ USER BALANCE DECRYPTION - DÜZELTİLMİŞ VERSİYON
 */
export async function decryptUserBalance(contractAddress, userAddress) {
    try {
        const instance = await getFhevmInstance();
        if (!instance) {
            throw new Error('FHEVM instance not initialized');
        }

        console.log('🔓 Decrypting user balance...');

        // Get ethers provider and signer
        const { ethers } = await import('ethers');
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        // ✅ ADRESleri CHECKSUM FORMATINA ÇEVİR
        const checksumContractAddress = ethers.getAddress(contractAddress);
        const checksumUserAddress = ethers.getAddress(userAddress);

        console.log('🔍 Using checksum addresses:', {
            contract: checksumContractAddress,
            user: checksumUserAddress
        });

        // Get contract
        const BetMarketABI = (await import('../../../hardhat/artifacts/contracts/BetMarketCore.sol/BetMarketCore.json')).default;
        const contract = new ethers.Contract(checksumContractAddress, BetMarketABI.abi, signer);

        // 1. Get encrypted balance (using getMyEncryptedBalance for proper ACL)
        const encryptedBalance = await contract.getMyEncryptedBalance();

        console.log('🔍 DEBUG - Encrypted balance handle:', encryptedBalance);
        console.log('🔍 DEBUG - Handle type:', typeof encryptedBalance);
        console.log('🔍 DEBUG - Is ZeroHash?', encryptedBalance === ethers.ZeroHash);

        // Check if uninitialized
        if (encryptedBalance === ethers.ZeroHash || encryptedBalance === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            console.log('⚠️ Balance is uninitialized (no deposits yet)');
            return '0';
        }

        console.log('✅ Got encrypted balance handle');

        // 2. Generate keypair
        const keypair = instance.generateKeypair();
        console.log('✅ Generated keypair');

        // 3. Create EIP712 signature data
        const startTimestamp = Math.floor(Date.now() / 1000).toString();
        const durationDays = '30'; // 30 days validity

        const eip712 = instance.createEIP712(
            keypair.publicKey,
            [checksumContractAddress], // ✅ Checksum address kullan
            startTimestamp,
            durationDays
        );

        console.log('✅ Created EIP712 signature data');

        // 4. Request signature from user
        console.log('🔐 Requesting signature from user...');
        const signature = await signer.signTypedData(
            eip712.domain,
            {
                UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification
            },
            eip712.message
        );

        console.log('✅ Signature received');

        // 5. Decrypt
        console.log('🔓 Calling userDecrypt...');
        const result = await instance.userDecrypt(
            [
                {
                    handle: encryptedBalance,
                    contractAddress: checksumContractAddress // ✅ Checksum address kullan
                }
            ],
            keypair.privateKey,
            keypair.publicKey,
            signature.replace('0x', ''),
            [checksumContractAddress], // ✅ Checksum address kullan
            checksumUserAddress, // ✅ Checksum address kullan
            startTimestamp,
            durationDays
        );

        const clearBalance = result[encryptedBalance];
        console.log('✅ Balance decrypted successfully:', clearBalance);

        return clearBalance.toString();

    } catch (error) {
        console.error('❌ Balance decryption failed:', error);

        // Daha detaylı hata mesajı
        if (error.message?.includes('Bad address checksum')) {
            throw new Error('Address checksum error. This is an internal error, please try again.');
        } else if (error.message?.includes('user rejected')) {
            throw new Error('Signature request rejected by user');
        } else if (error.message?.includes('not authorized')) {
            throw new Error('Not authorized to decrypt this balance');
        }

        throw error;
    }
}

/**
 * Check if FHEVM instance is initialized
 */
export function isFhevmInitialized() {
    return fhevmInstance !== null;
}

/**
 * Decrypt encrypted value - Based on zamadocument3.txt
 * @param {string} contractAddress - Contract address
 * @param {string} encryptedValue - Encrypted value (bytes32 handle)
 * @param {string} userAddress - User address (optional, for logging)
 * @returns {Promise<bigint>} Decrypted value
 */
export async function decryptValue(contractAddress, encryptedValue, userAddress = null) {
    try {
        const instance = await getFhevmInstance();

        if (!instance) {
            throw new Error('FHEVM instance not initialized');
        }

        console.log('🔓 Decrypting value:', {
            contractAddress,
            encryptedValue,
            userAddress
        });

        if (!instance.publicDecrypt) {
            console.error('Available instance methods:', Object.keys(instance));
            throw new Error('publicDecrypt method not available on FHEVM instance');
        }

        const decryptedResult = await instance.publicDecrypt([encryptedValue]);
        const decryptedValue = decryptedResult[encryptedValue];

        console.log('✅ Decrypt successful:', decryptedValue);

        return decryptedValue;
    } catch (error) {
        console.error('❌ Decrypt failed:', error);
        throw new Error(`Decrypt failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Reset FHEVM instance (for testing or re-initialization)
 */
export function resetFhevmInstance() {
    fhevmInstance = null;
    isInitializing = false;
}