import { ethers } from "hardhat";
import { expect } from "chai";

describe("Real FHEVM Encryption Test", function () {
    it("should test real FHEVM encryption with BetMarketPro", async function () {
        console.log("=== TESTING REAL FHEVM ENCRYPTION ===");

        const contractAddress = "0x70bDA08DBe07363968e9EE53d899dFE48560605B";
        const contract = await ethers.getContractAt("BetMarketPro", contractAddress);

        const [signer] = await ethers.getSigners();
        console.log(`Testing with user: ${signer.address}`);

        // Test values to encrypt
        const betId = 1;
        const optionIndex = 1; // Option 1 (Yes)
        const amount = ethers.parseUnits("100", 6); // 100 USDC

        console.log(`📋 Encrypting values:`);
        console.log(`   betId: ${betId}`);
        console.log(`   optionIndex: ${optionIndex}`);
        console.log(`   amount: ${ethers.formatUnits(amount, 6)} USDC`);

        try {
            // ✅ Test 1: Import FHEVM Plugin
            console.log("🧪 Test 1: Import FHEVM Plugin");
            try {
                const { FhevmEnvironment } = await import("@fhevm/hardhat-plugin");
                console.log("✅ FHEVM Plugin imported successfully");
                console.log("✅ FhevmEnvironment available:", !!FhevmEnvironment);
            } catch (error: any) {
                console.log("❌ FHEVM Plugin import failed:", error.message);
            }

            // ✅ Test 2: Initialize FHEVM Environment
            console.log("🧪 Test 2: Initialize FHEVM Environment");
            const hre = require("hardhat");
            console.log("✅ Hardhat runtime environment available");

            const fhevm = (hre as any).fhevm;
            console.log("✅ FHEVM environment available:", !!fhevm);

            if (fhevm) {
                console.log("✅ FHEVM environment methods:", Object.keys(fhevm));
            }

            if (!fhevm || !fhevm.createEncryptedInput) {
                throw new Error("FHEVM not available in hardhat runtime environment");
            }

            console.log("✅ FHEVM available in hardhat runtime");

            // Use proper FHEVM encryption API
            console.log("🔐 Encrypting option index (euint8)...");
            const optionInput = fhevm.createEncryptedInput(contractAddress, signer.address);
            optionInput.add8(optionIndex);
            const encryptedOptionResult = await optionInput.encrypt();

            console.log(`✅ Encrypted option index handle: ${encryptedOptionResult.handles[0]}`);

            console.log("🔐 Encrypting amount (euint64)...");
            const amountInput = fhevm.createEncryptedInput(contractAddress, signer.address);
            amountInput.add64(BigInt(amount));
            const encryptedAmountResult = await amountInput.encrypt();

            console.log(`✅ Encrypted amount handle: ${encryptedAmountResult.handles[0]}`);

            console.log("✅ All encryption successful!");
            console.log("\\n📊 Results:");
            console.log(`encryptedOptionIndex: ${encryptedOptionResult.handles[0]}`);
            console.log(`encryptedAmount: ${encryptedAmountResult.handles[0]}`);
            console.log(`optionProof: ${encryptedOptionResult.inputProof}`);
            console.log(`amountProof: ${encryptedAmountResult.inputProof}`);

            // Now test the bet placement
            console.log("\\n📞 Testing bet placement with encrypted data...");

            const tx = await contract.placeBet(
                betId,
                encryptedOptionResult.handles[0],
                encryptedOptionResult.inputProof,
                encryptedAmountResult.handles[0],
                encryptedAmountResult.inputProof,
                { gasLimit: 2000000 }
            );

            console.log(`📤 Transaction sent: ${tx.hash}`);
            const receipt = await tx.wait();
            console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
            console.log(`🎉 REAL FHEVM BET PLACEMENT SUCCESSFUL!`);

            // Test passes if we get here
            expect(receipt.status).to.equal(1);

        } catch (error: any) {
            console.log(`❌ Error: ${error.message}`);
            if (error.reason) {
                console.log(`Reason: ${error.reason}`);
            }
            if (error.code) {
                console.log(`Code: ${error.code}`);
            }
            throw error; // Re-throw to fail the test
        }
    });
});