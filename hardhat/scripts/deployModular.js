const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying Modular BetMarket System to Sepolia...");

    const [deployer] = await ethers.getSigners();
    console.log("👤 Deploying with account:", deployer.address);

    const usdcAddress = "0x18C97d762dF7Ee8Efa413B99bf2D14943E420Fc2";
    console.log("💰 USDC Token:", usdcAddress);

    // 1. Deploy BetMarketCore
    console.log("\n📦 [1/3] Deploying BetMarketCore...");
    const BetMarketCore = await ethers.getContractFactory("BetMarketCore");
    const core = await BetMarketCore.deploy(usdcAddress);
    await core.waitForDeployment();
    const coreAddress = await core.getAddress();
    console.log("   ✅ BetMarketCore deployed:", coreAddress);

    // 2. Deploy BetMarketPayout
    console.log("\n📦 [2/3] Deploying BetMarketPayout...");
    const BetMarketPayout = await ethers.getContractFactory("BetMarketPayout");
    const payout = await BetMarketPayout.deploy(coreAddress);
    await payout.waitForDeployment();
    const payoutAddress = await payout.getAddress();
    console.log("   ✅ BetMarketPayout deployed:", payoutAddress);

    // 3. Deploy BetMarketStats
    console.log("\n📦 [3/3] Deploying BetMarketStats...");
    const BetMarketStats = await ethers.getContractFactory("BetMarketStats");
    const stats = await BetMarketStats.deploy(coreAddress);
    await stats.waitForDeployment();
    const statsAddress = await stats.getAddress();
    console.log("   ✅ BetMarketStats deployed:", statsAddress);

    // 4. Set contract addresses in Core
    console.log("\n🔗 Linking contracts...");
    console.log("   Setting PayoutContract in Core...");
    const tx1 = await core.setPayoutContract(payoutAddress);
    await tx1.wait();
    console.log("   ✅ PayoutContract set");

    console.log("   Setting StatsContract in Core...");
    const tx2 = await core.setStatsContract(statsAddress);
    await tx2.wait();
    console.log("   ✅ StatsContract set");

    console.log("\n" + "=".repeat(60));
    console.log("✅ DEPLOYMENT COMPLETE!");
    console.log("=".repeat(60));
    console.log("📝 Contract Addresses:");
    console.log("   Core:   ", coreAddress);
    console.log("   Payout: ", payoutAddress);
    console.log("   Stats:  ", statsAddress);
    console.log("=".repeat(60));

    return {
        core: coreAddress,
        payout: payoutAddress,
        stats: statsAddress
    };
}

main()
    .then((addresses) => {
        console.log("\n💾 Save these addresses:");
        console.log(JSON.stringify(addresses, null, 2));
        process.exitCode = 0;
    })
    .catch((error) => {
        console.error("\n❌ Deployment failed:", error);
        process.exitCode = 1;
    });
