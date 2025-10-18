const { ethers } = require("hardhat");

async function main() {
    console.log("📊 Creating test bet in new contract...");

    const contractAddress = "0x1Cb316e3E00C6553b053d16C6bD73F7cA641Bf13";
    const [signer] = await ethers.getSigners();

    const betMarket = await ethers.getContractAt("BetMarketPro", contractAddress);

    console.log(`👤 User: ${signer.address}`);
    console.log(`🎯 Contract: ${contractAddress}`);

    // Create bet parameters (same as in BetMarketPro.sol pattern)
    const endTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now

    try {
        console.log("📊 Creating nested option bet (Fed decision style)...");

        const createBetTx = await betMarket.createBet(
            3, // optionCount (3 options)
            endTime, // endTime
            2, // betType (2 = NESTED_CHOICE - each option has Yes/No)
            ethers.parseUnits("1", 6), // minBetAmount (1 USDC)
            ethers.parseUnits("100", 6), // maxBetAmount (100 USDC)
            500, // liquidityParam (higher = less price volatility)
            "Fed decision in October - Rate decrease?", // title
            "Nested betting on Fed rate decrease options - Each option has Yes/No", // description
            ["50+ bps decrease", "25 bps decrease", "No change"] // optionTitles
        );

        console.log(`📤 Transaction sent: ${createBetTx.hash}`);
        console.log("⏳ Waiting for confirmation...");

        const receipt = await createBetTx.wait();
        console.log(`✅ Bet created! Gas used: ${receipt.gasUsed}`);

        // Get the bet details to confirm
        const bet = await betMarket.getBet(1);
        console.log("\n📊 Bet Details:");
        console.log(`   ID: 1`);
        console.log(`   Title: ${bet.title}`);
        console.log(`   Active: ${bet.isActive}`);
        console.log(`   End Time: ${new Date(Number(bet.endTime) * 1000)}`);
        console.log(`   Option Count: ${bet.optionCount}`);
        console.log(`   Min Bet: ${ethers.formatUnits(bet.minBetAmount, 6)} USDC`);
        console.log(`   Max Bet: ${ethers.formatUnits(bet.maxBetAmount, 6)} USDC`);

    } catch (error) {
        console.log(`❌ Error creating bet: ${error.reason || error.message}`);
    }
}

main().catch(console.error);