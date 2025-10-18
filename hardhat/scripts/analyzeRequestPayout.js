const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_URL);

  const requestTxHash = "0xc5893848d0588a7d1787172e5554a98480d5dc8d1fb520919b48cf5891693b81";
  const payoutAddress = "0xe2245A115F69cFc40f5a505a9d0C288E25AD25D9";

  const payout = await ethers.getContractAt("BetMarketPayout", payoutAddress);

  console.log("📊 Analyzing Request Payout TX:", requestTxHash);

  const receipt = await provider.getTransactionReceipt(requestTxHash);
  if (!receipt) {
    console.log("❌ TX not found");
    return;
  }

  console.log("✅ TX Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
  console.log("📦 Block:", receipt.blockNumber);

  // Find PayoutRequested event
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== payoutAddress.toLowerCase()) continue;

    try {
      const parsed = payout.interface.parseLog({
        topics: log.topics,
        data: log.data
      });

      if (parsed.name === "PayoutRequested") {
        console.log("\n🔔 PayoutRequested Event:");
        console.log("  betId:", parsed.args.betId.toString());
        console.log("  user:", parsed.args.user);
        console.log("  requestId:", parsed.args.requestId.toString());
      }
    } catch (e) {}
  }
}

main().catch(console.error);
