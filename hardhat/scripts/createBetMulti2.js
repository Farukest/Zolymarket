const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
    console.log("📊 Creating multiple bets in contract...");

    const contractAddress = "0xBf1071209bBBa6296a7F55Aa6A7eF7711ee23429"; // BetMarketCore (Fixed requestId=0 bug in claimPayout)
    const usdcAddress = "0x18C97d762dF7Ee8Efa413B99bf2D14943E420Fc2";

    // Get signer from PRIVATE_KEY in .env
    const provider = new ethers.JsonRpcProvider(process.env.FHEVM_NETWORK_URL || process.env.SEPOLIA_URL);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log(`👤 User: ${signer.address}`);
    console.log(`🎯 Contract: ${contractAddress}`);

    // First approve USDC for all bets (15 bets × 500 USDC = 7500 USDC)
    const usdc = await ethers.getContractAt("IERC20", usdcAddress);
    const totalApproval = ethers.parseUnits("7500", 6);

    console.log("\n💰 Approving USDC...");
    const approveTx = await usdc.approve(contractAddress, totalApproval);
    await approveTx.wait();
    console.log("✅ USDC approved");

    const betMarket = await ethers.getContractAt("BetMarketCore", contractAddress);

    const fiveDays = Math.floor(Date.now() / 1000) + 86400 * 5; // 5 days from now
    const tenDays = Math.floor(Date.now() / 1000) + 86400 * 10; // 10 days from now
    const thirtyDays = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days from now
    const sixtyDays = Math.floor(Date.now() / 1000) + 86400 * 60; // 60 days from now

    const bets = [
        {
            type: "BINARY",
            betType: 0,
            optionCount: 2,
            endTime: sixtyDays,
            title: "Russia x Ukraine ceasefire in 2025?",
            description: "Will there be a ceasefire agreement between Russia and Ukraine in 2025?",
            options: ["Yes", "No"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        },
        {
            type: "NESTED",
            betType: 2,
            optionCount: 5,
            endTime: tenDays,
            title: "What price will Ethereum hit in October?",
            description: "Highest price Ethereum will reach in October 2025",
            options: ["↑ 8000", "↑ 6000", "↑ 5600", "↑ 5400", "↑ 5200"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        },
        {
            type: "NESTED",
            betType: 2,
            optionCount: 5,
            endTime: sixtyDays,
            title: "What price will Bitcoin hit in 2025?",
            description: "Highest price Bitcoin will reach in 2025",
            options: ["↑ 1,000,000", "↑ 250,000", "↑ 200,000", "↑ 170,000", "↑ 150,000"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        },
        {
            type: "NESTED",
            betType: 2,
            optionCount: 5,
            endTime: tenDays,
            title: "What price will Solana hit in October?",
            description: "Highest price Solana will reach in October 2025",
            options: ["↑ 350", "↑ 300", "↑ 270", "↑ 250", "↑ 240"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        },
        {
            type: "NESTED",
            betType: 2,
            optionCount: 4,
            endTime: fiveDays,
            title: "Elon Musk # tweets October 17-24, 2025?",
            description: "How many tweets will Elon Musk post between October 17-24, 2025?",
            options: ["100-119", "120-139", "140-159", "160+"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        },
        {
            type: "NESTED",
            betType: 2,
            optionCount: 5,
            endTime: sixtyDays,
            title: "Next Japanese Prime Minister",
            description: "Who will be the next Prime Minister of Japan?",
            options: ["Sanae Takaichi", "Yuichiro Tamaki", "Taro Kono", "Yoshihiko Noda", "Shinjirō Koizumi"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        },
        {
            type: "NESTED",
            betType: 2,
            optionCount: 5,
            endTime: sixtyDays,
            title: "Nobel Peace Prize Winner 2026",
            description: "Who will win the 2026 Nobel Peace Prize?",
            options: ["Donald Trump", "UNRWA", "Tamim bin Hamad Al Thani", "Yulia Navalnaya", "Pope Leo XIV"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        },
        {
            type: "NESTED",
            betType: 2,
            optionCount: 5,
            endTime: sixtyDays,
            title: "Top Spotify Artist 2025",
            description: "Who will be the most streamed artist on Spotify in 2025?",
            options: ["Bad Bunny", "Taylor Swift", "Drake", "Bruno Mars", "The Weeknd"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        },
        {
            type: "BINARY",
            betType: 0,
            optionCount: 2,
            endTime: sixtyDays,
            title: "Will Satoshi move any Bitcoin in 2025?",
            description: "Will any Bitcoin be moved from Satoshi Nakamoto's known wallets in 2025?",
            options: ["Yes", "No"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        },
        {
            type: "BINARY",
            betType: 0,
            optionCount: 2,
            endTime: fiveDays,
            title: "Bitcoin Up or Down on October 20?",
            description: "Will Bitcoin price be higher or lower on October 20 compared to October 19?",
            options: ["Up", "Down"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        },
        {
            type: "BINARY",
            betType: 0,
            optionCount: 2,
            endTime: sixtyDays,
            title: "Trump–Putin Meeting in Hungary by Dec 31?",
            description: "Will Trump and Putin meet in Hungary before December 31, 2025?",
            options: ["Yes", "No"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        },
        {
            type: "NESTED",
            betType: 2,
            optionCount: 5,
            endTime: sixtyDays,
            title: "La Liga Winner",
            description: "Which team will win La Liga 2025-2026 season?",
            options: ["Real Madrid", "Barcelona", "Atletico Madrid", "Villarreal", "Celta Vigo"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        },
        {
            type: "NESTED",
            betType: 2,
            optionCount: 4,
            endTime: tenDays,
            title: "Will any Louvre heist robbers be arrested by...?",
            description: "When will the Louvre heist robbers be arrested?",
            options: ["October 20", "October 24", "October 31", "After October 31"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        },
        {
            type: "NESTED",
            betType: 2,
            optionCount: 4,
            endTime: thirtyDays,
            title: "F1 Drivers Champion",
            description: "Who will win the F1 Drivers Championship 2025?",
            options: ["Oscar Piastri", "Lando Norris", "Max Verstappen", "George Russell"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        },
        {
            type: "BINARY",
            betType: 0,
            optionCount: 2,
            endTime: fiveDays,
            title: "Will Israel-Hamas ceasefire hold through October?",
            description: "Will the Israel-Hamas ceasefire agreement remain in effect through October 2025?",
            options: ["Yes", "No"],
            minBet: "1",
            maxBet: "1000",
            liquidity: 500
        }
    ];

    let createdCount = 0;
    let failedCount = 0;

    for (let i = 0; i < bets.length; i++) {
        const bet = bets[i];

        console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📊 Creating Bet ${i + 1}/${bets.length}: ${bet.title}`);
        console.log(`   Type: ${bet.type}`);
        console.log(`   Options: ${bet.options.join(', ')}`);
        console.log(`   End Time: ${new Date(bet.endTime * 1000).toLocaleDateString()}`);

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