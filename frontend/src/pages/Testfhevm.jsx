import React, { useState, useEffect } from 'react';

const Testfhevm = () => {
    const [testResults, setTestResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [fhevmInstance, setFhevmInstance] = useState(null);

    const addTestResult = (testName, status, message, details = null) => {
        // Handle BigInt serialization in details
        const safeDetails = details ? JSON.parse(JSON.stringify(details, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        )) : null;

        setTestResults(prev => [...prev, {
            id: Date.now() + Math.random(),
            testName,
            status, // 'success', 'error', 'warning'
            message,
            details: safeDetails,
            timestamp: new Date().toLocaleTimeString()
        }]);
    };

    const clearResults = () => {
        setTestResults([]);
    };

    // Test 1: Initialize FHEVM SDK
    const testFHEVMInitialization = async () => {
        addTestResult("FHEVM SDK Initialization", "info", "Starting FHEVM SDK initialization...");

        try {
            // Dynamic import based on ZAMA documentation - using bundle version
            const { initSDK, createInstance, SepoliaConfig } = await import('@zama-fhe/relayer-sdk/bundle');
            addTestResult("SDK Import", "success", "FHEVM SDK imported successfully");

            // Initialize WASM
            await initSDK();
            addTestResult("SDK Init", "success", "WASM initialized successfully");

            // Create FHEVM instance with Sepolia config
            const config = {
                ...SepoliaConfig,
                network: 'https://eth-sepolia.public.blastapi.io' // Use public RPC
            };

            const instance = await createInstance(config);
            setFhevmInstance(instance);
            addTestResult("Instance Creation", "success", "FHEVM instance created successfully", {
                config: Object.keys(config)
            });

            return instance;
        } catch (error) {
            addTestResult("FHEVM Initialization", "error", `Initialization failed: ${error.message}`);
            return null;
        }
    };

    // Test 2: Create Encrypted Input
    const testEncryptedInput = async (instance) => {
        if (!instance) {
            addTestResult("Encrypted Input", "error", "No FHEVM instance available");
            return;
        }

        try {
            // Contract and user addresses (example addresses)
            const contractAddress = '0x687820221192C5B662b25367F70076A37bc79b6c'; // ACL contract from ZAMA docs
            const userAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // First Hardhat account

            // Create encrypted input buffer
            const buffer = instance.createEncryptedInput(contractAddress, userAddress);
            addTestResult("Input Buffer", "success", "Encrypted input buffer created");

            // Add encrypted values
            buffer.add64(BigInt(12345));
            buffer.add32(BigInt(678));
            buffer.addBool(true);
            addTestResult("Add Values", "success", "Added encrypted values: uint64(12345), uint32(678), bool(true)");

            // Encrypt (this will make network call to relayer)
            const encryptedInputs = await buffer.encrypt();
            addTestResult("Encryption", "success", "Values encrypted successfully", {
                handlesCount: encryptedInputs.handles?.length,
                proofLength: encryptedInputs.inputProof?.length
            });

            return encryptedInputs;
        } catch (error) {
            addTestResult("Encrypted Input", "error", `Failed to create encrypted input: ${error.message}`);
            return null;
        }
    };

    // Test 3: User Decryption Test
    const testUserDecryption = async (instance) => {
        if (!instance) {
            addTestResult("User Decryption", "error", "No FHEVM instance available");
            return;
        }

        try {
            // Generate keypair for user decryption
            const keypair = instance.generateKeypair();
            addTestResult("Keypair Generation", "success", "User keypair generated successfully");

            // Test public decryption (if available)
            const testHandles = ['0x830a61b343d2f3de67ec59cb18961fd086085c1c73ff0000000000aa36a70000'];

            try {
                const values = await instance.publicDecrypt(testHandles);
                addTestResult("Public Decryption", "success", "Public decryption test successful", {
                    values: Object.keys(values)
                });
            } catch (decryptError) {
                addTestResult("Public Decryption", "warning", `Public decryption test failed: ${decryptError.message}`);
            }

        } catch (error) {
            addTestResult("User Decryption", "error", `User decryption test failed: ${error.message}`);
        }
    };

    // Run all tests
    const runAllTests = async () => {
        setIsLoading(true);
        clearResults();

        addTestResult("Test Suite", "info", "🧪 Starting FHEVM Test Suite...");

        // Test 1: Initialize FHEVM
        const instance = await testFHEVMInitialization();

        if (instance) {
            // Test 2: Create Encrypted Input
            await testEncryptedInput(instance);

            // Test 3: User Decryption
            await testUserDecryption(instance);
        }

        addTestResult("Test Suite", "info", "✅ All FHEVM tests completed!");
        setIsLoading(false);
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            case 'info': return '📋';
            default: return '🔵';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'success': return 'text-green-600 dark:text-green-400';
            case 'error': return 'text-red-600 dark:text-red-400';
            case 'warning': return 'text-yellow-600 dark:text-yellow-400';
            case 'info': return 'text-blue-600 dark:text-blue-400';
            default: return 'text-gray-600 dark:text-gray-400';
        }
    };

    // Test Bet 2 Decryption - Clean version from documentation
    const testBet2Decrypt = async (instance) => {
        if (!instance) {
            addTestResult("Decrypt Test", "error", "No FHEVM instance available");
            return;
        }

        try {
            addTestResult("Decrypt Test", "info", "Testing decrypt from documentation format...");

            // Real bet 2 encrypted handles
            const contractAddress = '0xD3EaD6e752FC45A3FC796781C3BFb57342387D1C';
            const bet2EncryptedAmount = '0xe2ffd516de1f0d9bf059928311b1085515936cc794000000000000aa36a70500';
            const bet2EncryptedChoice = '0xd7dca9a6a5f1935f1f1aa0d8657585e60c461611d2000000000000aa36a70200';

            // Admin credentials - REPLACE WITH YOUR OWN PRIVATE KEY FOR TESTING
            const privateKeyWith0x = "0xYOUR_PRIVATE_KEY_HERE";
            const privateKeyWithout0x = "YOUR_PRIVATE_KEY_HERE";
            const userAddress = "YOUR_WALLET_ADDRESS_HERE";

            addTestResult("Config", "info", `Contract: ${contractAddress}, User: ${userAddress}`);

            // Test 1: Try with 0x prefix
            try {
                addTestResult("Decrypt with 0x", "info", "Trying userDecrypt with 0x private key...");

                // Generate keypair and signature according to docs
                const keypair = instance.generateKeypair();
                const handleContractPairs = [
                    { handle: bet2EncryptedAmount, contractAddress: contractAddress },
                    { handle: bet2EncryptedChoice, contractAddress: contractAddress }
                ];
                const startTimeStamp = Math.floor(Date.now() / 1000); // Number!
                const durationDays = 10; // Number!
                const contractAddresses = [contractAddress];

                // Create EIP712 with correct 4 parameters from docs
                const eip712 = instance.createEIP712(
                    keypair.publicKey,
                    contractAddresses,
                    startTimeStamp,
                    durationDays,
                );

                // Handle BigInt serialization issue
                const eip712Serializable = JSON.parse(JSON.stringify(eip712, (key, value) =>
                    typeof value === 'bigint' ? value.toString() : value
                ));
                console.log("EIP712 object:", eip712Serializable);

                // Create real ethers signer with admin private key
                console.log("Window ethers check:", window.ethers);
                console.log("Available window keys:", Object.keys(window).filter(k => k.toLowerCase().includes('ethers')));

                let ethers = window.ethers;
                if (!ethers) {
                    // Try alternative global names
                    const altEthers = window.Ethers || window.ETHERS || globalThis.ethers;
                    if (!altEthers) throw new Error("Ethers not loaded from CDN");
                    ethers = altEthers;
                }

                const realSigner = new ethers.Wallet(privateKeyWith0x);
                console.log("Real signer created:", realSigner.address);

                const signature = await realSigner._signTypedData(
                    eip712.domain,
                    {
                        UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
                    },
                    eip712.message,
                );

                console.log("Real signature created:", signature);

                console.log("=== DECRYPT PARAMETERS (with 0x) - CORRECT FORMAT ===");
                console.log("handleContractPairs:", handleContractPairs);
                console.log("keypair.privateKey:", keypair.privateKey);
                console.log("keypair.publicKey:", keypair.publicKey);
                console.log("signature:", signature.replace('0x', ''));
                console.log("contractAddresses:", contractAddresses);
                console.log("signer.address:", realSigner.address);
                console.log("startTimeStamp:", startTimeStamp);
                console.log("durationDays:", durationDays);
                console.log("=======================================================");

                const result = await instance.userDecrypt(
                    handleContractPairs,
                    keypair.privateKey, // Use keypair.privateKey from docs!
                    keypair.publicKey,
                    signature.replace('0x', ''),
                    contractAddresses,
                    realSigner.address, // Use signer.address as per docs!
                    startTimeStamp,
                    durationDays,
                );

                // Handle BigInt in result
                const safeResult = JSON.parse(JSON.stringify(result, (key, value) =>
                    typeof value === 'bigint' ? value.toString() : value
                ));

                // Parse results for better display
                const amountValue = safeResult[bet2EncryptedAmount];
                const choiceValue = safeResult[bet2EncryptedChoice];
                const amountUSDC = amountValue ? (parseInt(amountValue) / 1000000).toFixed(2) : 'N/A';

                addTestResult("Decrypt with 0x", "success",
                    `✅ Amount: ${amountUSDC} USDC | Choice: ${choiceValue} | Full result: ${JSON.stringify(safeResult)}`
                );
                return;
            } catch (error) {
                console.error("Decrypt with 0x error:", error);
                addTestResult("Decrypt with 0x", "warning", `Failed: ${error.message}`);
            }

            // Test 2: Try without 0x prefix
            try {
                addTestResult("Decrypt without 0x", "info", "Trying userDecrypt without 0x private key...");

                const keypair = instance.generateKeypair();
                const signature = await instance.createEIP712(keypair.publicKey, contractAddress);

                // Console log all parameters
                const handleContractPairs = [
                    { handle: bet2EncryptedAmount, contractAddress: contractAddress },
                    { handle: bet2EncryptedChoice, contractAddress: contractAddress }
                ];
                const signatureWithout0x = signature.replace('0x', '');
                const timestamp = Math.floor(Date.now() / 1000);

                console.log("=== DECRYPT PARAMETERS (without 0x) ===");
                console.log("handleContractPairs:", handleContractPairs);
                console.log("privateKey:", privateKeyWithout0x);
                console.log("publicKey:", keypair.publicKey);
                console.log("signature:", signatureWithout0x);
                console.log("contractAddresses:", [contractAddress]);
                console.log("userAddress:", userAddress);
                console.log("timestamp:", timestamp);
                console.log("durationDays:", 1);
                console.log("========================================");

                const result = await instance.userDecrypt(
                    handleContractPairs,
                    privateKeyWithout0x,
                    keypair.publicKey,
                    signatureWithout0x,
                    [contractAddress],
                    userAddress,
                    timestamp,
                    1
                );

                // Handle BigInt in result
                const safeResult = JSON.parse(JSON.stringify(result, (key, value) =>
                    typeof value === 'bigint' ? value.toString() : value
                ));

                // Parse results for better display
                const amountValue = safeResult[bet2EncryptedAmount];
                const choiceValue = safeResult[bet2EncryptedChoice];
                const amountUSDC = amountValue ? (parseInt(amountValue) / 1000000).toFixed(2) : 'N/A';

                addTestResult("Decrypt without 0x", "success",
                    `✅ Amount: ${amountUSDC} USDC | Choice: ${choiceValue} | Full result: ${JSON.stringify(safeResult)}`
                );
            } catch (error) {
                console.error("Decrypt without 0x error:", error);
                addTestResult("Decrypt without 0x", "error", `Failed: ${error.message}`);
            }

        } catch (error) {
            addTestResult("Decrypt Test", "error", `Test failed: ${error.message}`);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                        🔐 FHEVM Test Page
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                        Testing FHEVM initialization and functionality based on ZAMA documentation
                    </p>

                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={runAllTests}
                            disabled={isLoading}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                        >
                            {isLoading ? '🔄 Running Tests...' : '🧪 Run FHEVM Tests'}
                        </button>

                        <button
                            onClick={async () => {
                                let instance = fhevmInstance;
                                if (!instance) {
                                    instance = await testFHEVMInitialization();
                                }
                                if (instance) {
                                    await testBet2Decrypt(instance);
                                }
                            }}
                            disabled={isLoading}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                        >
                            🔓 Decrypt Bet 2
                        </button>

                        <button
                            onClick={clearResults}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                        >
                            🗑️ Clear Results
                        </button>
                    </div>
                </div>

                {/* Test Results */}
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                        📊 Test Results
                    </h2>

                    {testResults.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                            No tests run yet. Click "Run FHEVM Tests" to start testing.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {testResults.map((result) => (
                                <div key={result.id} className="border-l-4 border-gray-200 dark:border-gray-700 pl-4 py-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-lg">{getStatusIcon(result.status)}</span>
                                        <span className="font-semibold text-gray-900 dark:text-white">
                      {result.testName}
                    </span>
                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                      {result.timestamp}
                    </span>
                                    </div>
                                    <p className={`text-sm ${getStatusColor(result.status)} ml-6`}>
                                        {result.message}
                                    </p>
                                    {result.details && (
                                        <div className="ml-6 mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                                            <pre>{JSON.stringify(result.details, null, 2)}</pre>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* FHEVM Status */}
                {fhevmInstance && (
                    <div className="mt-8 bg-green-50 dark:bg-green-900/20 rounded-lg p-6">
                        <h3 className="text-lg font-bold text-green-800 dark:text-green-200 mb-2">
                            ✅ FHEVM Instance Active
                        </h3>
                        <p className="text-green-700 dark:text-green-300">
                            FHEVM instance is initialized and ready for encrypted operations.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Testfhevm;