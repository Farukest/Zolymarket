const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_URL);

  const callbackTxHash = "0xca785c16d9b755192400605525a363320251d5f19a1728a31221f736c9e2ccf8";
  const payoutAddress = "0xe2245A115F69cFc40f5a505a9d0C288E25AD25D9";

  const payout = await ethers.getContractAt("BetMarketPayout", payoutAddress);

  console.log("📊 Analyzing Callback TX:", callbackTxHash);

  const receipt = await provider.getTransactionReceipt(callbackTxHash);
  if (!receipt) {
    console.log("❌ TX not found");
    return;
  }

  console.log("✅ TX Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");

  // Find PayoutCalculated event
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== payoutAddress.toLowerCase()) continue;

    try {
      const parsed = payout.interface.parseLog({
        topics: log.topics,
        data: log.data
      });

      if (parsed.name === "PayoutCalculated") {
        console.log("\n💰 PayoutCalculated Event:");
        console.log("  requestId:", parsed.args.requestId.toString());
        console.log("  user:", parsed.args.user);
        console.log("  betId:", parsed.args.betId.toString());
        console.log("  payout:", ethers.formatUnits(parsed.args.payout, 6), "USDC");

        if (Number(parsed.args.payout) === 0) {
          console.log("\n❌ PAYOUT = 0");
          console.log("   Bu şu anlama gelir:");
          console.log("   1. Kullanıcı kaybeden option/outcome'a bet yapmış");
          console.log("   2. VEYA kullanıcının bet miktarı 0 olarak decode edilmiş");
        }
      }
    } catch (e) {}
  }

  // Let's check the raw transaction input to see what was actually sent
  const tx = await provider.getTransaction(callbackTxHash);
  console.log("\n📝 TX Info:");
  console.log("  From:", tx.from);
  console.log("  To:", tx.to);
  console.log("  Function called: Callback from Oracle");
}

main().catch(console.error);
