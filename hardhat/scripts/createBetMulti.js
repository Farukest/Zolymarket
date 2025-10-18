const { ethers } = require("hardhat");

async function main() {
    console.log("📊 Creating multiple bets in contract...");

    const contractAddress = "0x9EE86aB426fD483F77741D4dbB63d81DCd259F27"; // BetMarketCore (Fixed requestId=0 bug in claimPayout)
    const usdcAddress = "0x18C97d762dF7Ee8Efa413B99bf2D14943E420Fc2";
    const [signer] = await ethers.getSigners();

    console.log(`👤 User: ${signer.address}`);
    console.log(`🎯 Contract: ${contractAddress}`);

    // First approve USDC for all bets (9 bets × 500 USDC = 4500 USDC)
    const usdc = await ethers.getContractAt("IERC20", usdcAddress);
    const totalApproval = ethers.parseUnits("4500", 6);

    console.log("\n💰 Approving USDC...");
    const approveTx = await usdc.approve(contractAddress, totalApproval);
    await approveTx.wait();
    console.log("✅ USDC approved");

    const betMarket = await ethers.getContractAt("BetMarketCore", contractAddress);

    const fiveDays = Math.floor(Date.now() / 1000) + 86400 * 5; // 5 days from now

    const bets = [
        {
            type: "NESTED",
            betType: 2,
            optionCount: 3,
            endTime: fiveDays,
            title: "When will the Government shutdown end?",
            description: "Prediction market on when the government shutdown will end",
            options: ["October 6-9", "October 10-14", "October 15 or later"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        },
        {
            type: "NESTED",
            betType: 2,
            optionCount: 5,
            endTime: fiveDays,
            title: "New York City Mayoral Election",
            description: "Who will win the NYC Mayoral Election?",
            options: ["Zohran Mamdani", "Andrew Cuomo", "Eric Adams", "Curtis Sliwa", "Jim Walden"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        },
        {
            type: "NESTED",
            betType: 2,
            optionCount: 4,
            endTime: fiveDays,
            title: "Fed decision in October?",
            description: "What will be the Federal Reserve's rate decision in October?",
            options: ["50+ bps decrease", "25 bps decrease", "No change", "25+ bps increase"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        },
        {
            type: "NESTED",
            betType: 2,
            optionCount: 5,
            endTime: fiveDays,
            title: "World Series Champion 2025",
            description: "Which team will win the 2025 World Series?",
            options: ["Los Angeles Dodgers", "Toronto Blue Jays", "Milwaukee Brewers", "Seattle Mariners", "Detroit Tigers"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        },
        {
            type: "BINARY",
            betType: 0,
            optionCount: 2,
            endTime: fiveDays,
            title: "Blue Jays vs Yankees",
            description: "MLB Game: Blue Jays vs Yankees - Who will win?",
            options: ["Blue Jays", "Yankees"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500,
            isLive: true
        },
        {
            type: "BINARY",
            betType: 0,
            optionCount: 2,
            endTime: fiveDays,
            title: "Mariners vs Tigers",
            description: "MLB Game: Mariners vs Tigers - Who will win?",
            options: ["Mariners", "Tigers"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500,
            isLive: true
        },
        {
            type: "NESTED",
            betType: 2,
            optionCount: 3,
            endTime: fiveDays,
            title: "Will Congress pass a funding bill by...?",
            description: "When will Congress pass the funding bill?",
            options: ["October 15", "October 31", "November 30"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        },
        {
            type: "BINARY",
            betType: 0,
            optionCount: 2,
            endTime: fiveDays,
            title: "Will Hamas release all Israeli hostages by October 31?",
            description: "Will all Israeli hostages be released by the deadline?",
            options: ["Yes", "No"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        },
        {
            type: "NESTED",
            betType: 2,
            optionCount: 5,
            endTime: fiveDays,
            title: "What will Trump say during President of Finland events on October 9?",
            description: "Predictions on Trump's talking points during the Finland event",
            options: ["Ukraine / Russia 7+ times", "Tariff 3+ times", "Hamas", "Border", "NATO"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        }
    ];

    let createdCount = 0;
    let failedCount = 0;

    for (let i = 0; i < bets.length; i++) {
        const bet = bets[i];

        console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📊 Creating Bet ${i + 1}/${bets.length}: ${bet.title}`);
        console.log(`   Type: ${bet.type}`);
        console.log(`   Options: ${bet.options.join(', ')}`);

        try {
            const createBetTx = await betMarket.createBet(
                bet.optionCount,
                bet.endTime,
                bet.betType,
                ethers.parseUnits(bet.minBet, 6),
                ethers.parseUnits(bet.maxBet, 6),
                bet.liquidity,
                bet.title,
                bet.description,
                bet.options
            );

            console.log(`📤 Transaction sent: ${createBetTx.hash}`);
            console.log("⏳ Waiting for confirmation...");

            const receipt = await createBetTx.wait();
            console.log(`✅ Bet created! Gas used: ${receipt.gasUsed}`);

            createdCount++;

            // Small delay between transactions
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.log(`❌ Error creating bet: ${error.reason || error.message}`);
            failedCount++;
        }
    }

    console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📈 Summary:`);
    console.log(`   ✅ Successfully created: ${createdCount} bets`);
    console.log(`   ❌ Failed: ${failedCount} bets`);
    console.log(`   📊 Total: ${bets.length} bets`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main().catch(console.error);
