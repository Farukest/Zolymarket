# Polymarket FHEVM - User Guide

Complete guide for using the Polymarket FHEVM prediction market platform as an end user.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Home Page Navigation](#home-page-navigation)
3. [Browsing Markets](#browsing-markets)
4. [Understanding Bet Types](#understanding-bet-types)
5. [Placing Bets](#placing-bets)
6. [My Dashboard](#my-dashboard)
7. [Payout System](#payout-system)
8. [User Positions & History](#user-positions--history)
9. [Privacy & FHEVM](#privacy--fhevm)
10. [FAQ & Troubleshooting](#faq--troubleshooting)

---

## 1. Getting Started

### Connecting Your Wallet

**Step 1:** Visit the platform homepage
- The platform requires a Web3 wallet (MetaMask, WalletConnect, etc.)

**Step 2:** Click "Connect Wallet" button
- Located in the top navigation bar
- Select your preferred wallet provider
- Approve the connection request in your wallet

**Step 3:** Wait for FHEVM initialization
- After connecting, the platform initializes FHEVM encryption (~1-2 seconds)
- You'll see a notification: "🔐 Privacy encryption ready"
- This enables private betting with encrypted amounts

**Supported Networks:**
- Zama Devnet
- Local Hardhat network (for testing)

**First-time Setup:**
```
1. Connect wallet → MetaMask popup appears
2. Approve connection → Wallet connected
3. FHEVM initializes → Encryption ready
4. Start browsing markets! → You're ready to bet
```

---

## 2. Home Page Navigation

### Filter Tabs

The home page offers 4 main filters:

| Filter | Icon | Description | Sorting Logic |
|--------|------|-------------|---------------|
| **Trending** | 📈 TrendingUp | Most popular markets | By volume (highest first) |
| **New** | ⚡ Zap | Recently created markets | By creation date (newest first) |
| **Ending Soon** | ⏰ Clock | Markets closing within 24 hours | By end time (soonest first) |
| **Bookmarked** | ⭐ Star | Your saved markets | Your bookmarked bets only |

**Location:** `frontend/src/pages/Home.jsx:30-55`

**How it works:**
```javascript
// Filters are applied client-side after fetching all bets from blockchain
- Trending: sorted by totalVolume (descending)
- New: sorted by contractId (descending - higher ID = newer)
- Ending Soon: filtered where endTime <= (now + 24 hours)
- Bookmarked: filtered using localStorage bookmark IDs
```

### Category Tabs

**Below the filters**, you'll see category tabs (e.g., Sports, Politics, Entertainment).

**How to use:**
1. Click on a category tab
2. The bet grid filters to show only bets in that category
3. The active filter switches to "Category Markets"
4. Click again to deselect and view all markets

**Data Source:** Categories are fetched from the MongoDB backend API (`categoryAPI.getAll()`)

**Location:** `frontend/src/components/home/CategoryTabs.jsx`

### Search Bar

**Located in the header**, the search bar allows you to search markets by:
- Bet title
- Bet description

**How it works:**
1. Type keywords in the search bar
2. Results filter in real-time
3. A blue banner shows: "Searching for: [your query]"
4. Click "Clear" to remove the search filter

**Location:** `frontend/src/components/home/BetGrid.jsx:93-99`

```javascript
// Search logic (case-insensitive)
filtered = filtered.filter(bet =>
  bet.title?.toLowerCase().includes(query) ||
  bet.description?.toLowerCase().includes(query)
);
```

---

## 3. Browsing Markets

### Bet Cards

Each market displays as a card with:
- **Image:** Market thumbnail (if uploaded by admin)
- **Title:** Market question
- **Description:** Brief description (first 2 lines)
- **Category Badge:** Category name with icon
- **End Time:** Time remaining or "Ended"
- **Volume:** Total betting volume (if decrypted)

**Location:** `frontend/src/components/home/BetCard.jsx`

### Sorting Options

**Dropdown menu** allows sorting by:

| Sort Option | Description |
|-------------|-------------|
| **Newest First** | Recently created markets (high contractId → low) |
| **Oldest First** | Oldest markets (low contractId → high) |
| **Highest Volume** | Most popular markets by total bets |
| **Lowest Volume** | Least popular markets |
| **Ending Soonest** | Markets closing first |
| **Ending Latest** | Markets closing last |

**Location:** `frontend/src/components/home/BetGrid.jsx:269-280`

### Pagination

- **30 markets per page**
- Navigation: Previous/Next buttons + page numbers
- Shows: "Showing 1-30 of 150 markets"
- Clicking a page scrolls to top automatically

**Location:** `frontend/src/components/home/BetGrid.jsx:298-356`

### Bookmarking Markets

**How to bookmark:**
1. Click the star icon on any bet card
2. The bet is saved to your bookmarks (stored in browser localStorage)
3. Access all bookmarks via "Bookmarked" filter tab

**Data Storage:** `localStorage.setItem('bookmarkedBets', JSON.stringify([...betIds]))`

**Location:** `frontend/src/components/home/BetGrid.jsx:149-162`

---

## 4. Understanding Bet Types

The platform supports **3 bet types**:

### Binary Bets (Type 0)

**Description:** Two-outcome markets (e.g., Yes/No, Win/Lose)

**Example:**
```
"Will Bitcoin reach $100,000 by end of 2025?"
- Option 1: Yes
- Option 2: No
```

**How it works:**
- Select one option (Yes or No)
- Enter bet amount
- If your option wins, you receive a share of the total pool

### Multiple Choice Bets (Type 1)

**Description:** Markets with 3+ exclusive outcomes

**Example:**
```
"Who will win the 2025 NBA Championship?"
- Option 1: Lakers
- Option 2: Celtics
- Option 3: Warriors
- Option 4: Nuggets
```

**How it works:**
- Select one option from multiple choices
- Only ONE option can win
- Winners share the entire pool

### Nested Bets (Type 2)

**Description:** Multiple propositions, each with Yes/No outcomes. Each proposition is resolved independently.

**Example:**
```
"2025 Tech Predictions"
- Proposition 1: "Apple releases VR headset" → YES or NO
- Proposition 2: "Tesla stock hits $300" → YES or NO
- Proposition 3: "ChatGPT reaches 1B users" → YES or NO
```

**How it works:**
- Each proposition has independent Yes/No outcomes
- You can bet on multiple propositions
- Each proposition is resolved separately
- Winners are determined per proposition

**Location:** `frontend/src/components/bet/BetDetail.jsx:1111`

**Visual Identification:**
```javascript
betType === 0 ? 'Binary'
betType === 1 ? 'Multiple'
betType === 2 ? 'Nested'
```

---

## 5. Placing Bets

### Step-by-Step Betting Process

**1. Navigate to Bet Details**
- Click on any bet card from the home page
- You'll see the full bet details page

**2. Connect Wallet (if not connected)**
- Click "Connect Wallet" button
- Approve wallet connection
- Wait for FHEVM encryption to initialize

**3. Check Your Balance**
- Your USDC balance is displayed at the top
- Click "Decrypt Balance" to reveal your encrypted balance (first time only)
- Balance is cached for future use

**Location:** `frontend/src/components/bet/BetDetail.jsx:688-714`

**4. Select Your Option**

**For Binary/Multiple Bets:**
- Click on the option card you want to bet on
- The card highlights in blue

**For Nested Bets:**
- Click on a proposition card
- Select either "YES" or "NO" button

**5. Enter Bet Amount**
- Type the amount in USDC (e.g., 10, 25, 100)
- Minimum bet: displayed on the page (e.g., $1)
- Maximum bet: displayed on the page (e.g., $10,000)

**6. Review Potential Returns**

The platform calculates your **potential profit** using **Parimutuel odds**:

**Formula:**
```
potentialReturn = (yourAmount / newWinnerPool) × (totalPool - liquidity) - yourAmount
```

**Example Calculation:**
```
Current state:
- Total pool: $1,000
- Winning option pool: $400
- Liquidity: $100

You bet: $50

After your bet:
- New total pool: $1,050
- New winning option pool: $450
- Distributable pool: $1,050 - $100 = $950

Your estimated payout:
= ($50 / $450) × $950
= $105.56

Your potential profit:
= $105.56 - $50 = $55.56
```

**Location:** `frontend/src/components/bet/BetDetail.jsx:116-161`

**Note:** Potential returns are **estimates** and may change based on other bets placed before resolution.

**7. Place Bet**
- Click the green "Place Bet" button
- **FHEVM encrypts your bet amount** (keeps it private on-chain)
- Approve the transaction in your wallet
- Wait for transaction confirmation (~5-15 seconds)

**8. Success Confirmation**
- A success modal appears with transaction details
- Your bet is added to transaction cache
- Balance is optimistically updated (decremented)
- You can view your position in the "My Positions" tab

**Location:** `frontend/src/components/bet/BetDetail.jsx:1149-1243`

### FHEVM Encryption Process

When you place a bet, the following happens behind the scenes:

```javascript
// 1. Encrypt bet amount using FHEVM
const encryptedAmount = await fhevmInstance.encrypt64(amountInMicroUSDC);

// 2. Create encrypted input for smart contract
const encryptedInput = fhevmInstance.createEncryptedInput(contractAddress, account);
encryptedInput.add64(amountInMicroUSDC);
const encryptedData = encryptedInput.encrypt();

// 3. Submit encrypted bet to blockchain
const tx = await contract.placeBet(
  betId,
  optionIndex,
  encryptedData.handles[0],
  encryptedData.inputProof
);

// 4. Your bet amount remains encrypted on-chain ✅
// Only you can decrypt it (or admin via relayer for resolution)
```

**Location:** `frontend/src/lib/fhe.js:81-150`

**Privacy Guarantee:**
- Your bet amount is **never visible** on-chain to other users
- Only you can decrypt your position
- Admins can only decrypt via relayer callback for payout calculation

---

## 6. My Dashboard

Access your dashboard by clicking **"Dashboard"** in the navigation bar.

### Dashboard Sections

The dashboard has **3 tabs**:

#### 1. Active Bets

**Shows:** All bets you've placed that are still ongoing

**Displayed Information:**
- Bet title & description
- Time remaining (e.g., "5d 12h left")
- Bet type (Binary, Multiple, Nested)
- Status badge: "Active" (green)

**Actions:**
- Click on any bet to view details

**Location:** `frontend/src/pages/Dashboard.jsx:400-416`

**Logic:**
```javascript
// A bet is "active" if:
bet.isResolved === false
&& bet.endTime > Date.now()
&& bet.isActive === true
```

#### 2. Ended Bets

**Shows:** Bets that have ended but are not yet resolved, or bets you lost

**Displayed Information:**
- Bet title & description
- Status badge: "Ended" (yellow) or "Resolved" (blue)
- Win/Loss indicator (if resolved)
  - Red "Lost" badge if you lost
  - No badge if awaiting resolution

**Actions:**
- View bet details
- Wait for admin to resolve the bet

**Location:** `frontend/src/pages/Dashboard.jsx:418-434`

**Logic:**
```javascript
// A bet is "ended" if:
(bet.endTime <= Date.now() && !bet.isResolved)
|| (bet.isResolved && userWon === false)
```

#### 3. Claims

**Shows:** Resolved bets where you WON and can claim your winnings

**Displayed Information:**
- Bet title & description
- Status badge: "Resolved" (blue)
- Win indicator: Green "You Won!" with trophy icon
- Claim status: "Claimed" badge (if already claimed)

**Actions:**
- View bet details
- **Claim your winnings** (see Payout System section)

**Location:** `frontend/src/pages/Dashboard.jsx:436-452`

**Logic:**
```javascript
// A bet is "claimable" if:
bet.isResolved === true
&& userWon === true (checked via MongoDB)
&& bet.hasClaimed === false
```

### Dashboard Statistics

**Top of the dashboard** shows 3 stat cards:

| Stat | Description |
|------|-------------|
| **Active Bets** | Number of ongoing bets you've placed |
| **Ended Bets** | Number of bets awaiting resolution or lost |
| **Claimable** | Number of won bets ready to claim |

**Location:** `frontend/src/pages/Dashboard.jsx:324-354`

---

## 7. Payout System

The payout system has **2 steps**: **Request Payout** → **Claim Winnings**

### Step 1: Request Payout

**When:** After a bet is resolved and you won

**What it does:**
- Triggers the **relayer callback** to decrypt your encrypted position
- Relayer calculates your exact payout amount
- Payout amount is stored on-chain (unencrypted)

**How to request:**
1. Go to the bet details page of a resolved bet
2. You'll see a yellow button: **"Request Payout"**
3. Click the button
4. Approve the transaction in your wallet
5. Wait 1-2 minutes for relayer to process

**Location:** `frontend/src/components/bet/BetDetail.jsx:214-247`

**What happens behind the scenes:**
```javascript
// 1. Submit payout request on-chain
await payoutContract.requestPayout(betId);

// 2. Relayer callback endpoint is triggered (off-chain)
POST http://localhost:5001/api/callback/relayer
{
  "betId": 123,
  "user": "0xYourAddress"
}

// 3. Relayer decrypts your encrypted bet amount
const decryptedAmount = await gateway.decrypt(encryptedHandle);

// 4. Relayer calculates your payout using parimutuel formula
const payout = (userAmount / winnerPoolTotal) × (totalPool - liquidity);

// 5. Relayer submits payout amount to contract
await payoutContract.fulfillPayout(betId, user, payoutAmount);

// 6. Your payout is now ready to claim!
```

**Processing Time:** ~1-2 minutes (depends on relayer callback speed)

**Location (Backend):** `backend/routes/callback.js:60-120`

### Step 2: Claim Winnings

**When:** After payout request is processed

**What it does:**
- Withdraws your winnings from the smart contract to your wallet
- Updates your USDC balance

**How to claim:**
1. After requesting payout, refresh the page
2. The button changes to green: **"Claim $XXX.XX"**
3. Click the "Claim" button
4. Approve the transaction in your wallet
5. Your winnings are transferred to your wallet ✅

**Location:** `frontend/src/components/bet/BetDetail.jsx:249-292`

**Transaction Details:**
```javascript
// 1. Submit claim transaction
const tx = await payoutContract.claimPayout(betId);
await tx.wait();

// 2. Smart contract transfers USDC to your address
// 3. Your balance is updated (cached optimistically)
```

### Payout Status States

| Status | Description | Available Actions |
|--------|-------------|-------------------|
| **Not Requested** | You haven't requested payout yet | Click "Request Payout" |
| **Requested** | Payout requested, waiting for relayer | Wait 1-2 minutes, refresh page |
| **Processed** | Payout calculated and ready | Click "Claim $XX.XX" |
| **Claimed** | You already claimed your winnings | None (badge shows "Claimed") |
| **Lost** | You did not win this bet | None (badge shows "Lost") |

**Location:** `frontend/src/components/bet/BetDetail.jsx:164-212`

**MongoDB Check for Losers:**
```javascript
// Backend checks MongoDB to see if user won or lost
GET /api/user-positions/:userAddress/:betId

Response:
{
  "success": true,
  "hasPosition": true,
  "isResolved": true,
  "isWinner": false  // ← User lost, hide payout button
}
```

**Location (Backend):** `backend/routes/userPositions.js`

---

## 8. User Positions & History

Each bet details page has **2 tabs**: **My Positions** and **Order History**

### My Positions Tab

**Shows:** Your current positions aggregated from all bets placed on this market

**Data Source:** Client-side cache (`UserTransactionsCacheInstance`)

**Displayed Information:**

| Column | Description |
|--------|-------------|
| **Option** | The option you bet on (e.g., "Yes", "Option 1") |
| **Total Amount** | Sum of all bets on this option |
| **Shares** | Estimated shares you hold |
| **Current Price** | Current market probability (0-100%) |
| **Unrealized P&L** | Estimated profit/loss (not finalized until resolution) |

**For Nested Bets:**
- Each proposition shows separately
- YES and NO outcomes are listed individually

**Example:**
```
Option: "Will Bitcoin reach $100K?" (YES)
Total Amount: $150.00
Shares: 180
Current Price: 65%
Unrealized P&L: +$25.00 (estimated)
```

**Location:** `frontend/src/components/bet/BetDetail.jsx:337-429`

**Position Aggregation Logic:**
```javascript
// Aggregate all transactions for the same option
cachedTransactions.forEach(tx => {
  const key = `${tx.optionIndex}-${tx.outcome}`;
  positionsMap[key].totalAmount += tx.amount;
  positionsMap[key].totalShares += tx.amount / priceAtBet;
});
```

**Privacy Note:**
- Positions are stored **locally in browser cache**
- NOT fetched from blockchain (preserves privacy)
- Clearing browser data will remove position history

### Order History Tab

**Shows:** Chronological list of all your bets on this market

**Displayed Information:**

| Column | Description |
|--------|-------------|
| **Time** | When you placed the bet (e.g., "2 hours ago") |
| **Option** | The option you bet on |
| **Amount** | Bet amount (revealed or encrypted) |
| **Status** | Revealed or Encrypted |
| **Transaction** | Blockchain transaction hash (click to view on explorer) |

**Example:**
```
Time: 3 hours ago
Option: "Yes" (YES)
Amount: $50.00 (Revealed)
Transaction: 0xabc123...def456 ↗
```

**Location:** `frontend/src/components/bet/BetDetail.jsx:294-335`

**Data Source:**
```javascript
// Fetched from UserTransactionsCache (localStorage)
const cachedTransactions = UserTransactionsCacheInstance.getTransactions(account, betId);
```

**Why "Encrypted" vs "Revealed"?**
- **Encrypted:** Bet just placed, amount is encrypted on-chain
- **Revealed:** After decryption (either by you or relayer), amount is visible

---

## 9. Privacy & FHEVM

### What is FHEVM?

**FHEVM (Fully Homomorphic Encryption Virtual Machine)** enables **private smart contracts** on blockchain.

**Key Benefits:**
- Your bet amounts are **encrypted on-chain**
- Other users **cannot see** how much you bet
- Smart contracts can compute on encrypted data without decrypting it
- Only you (and authorized relayers) can decrypt your data

**Location:** `frontend/src/hooks/useFHEVM.js`

### How Your Data is Protected

#### Bet Placement
1. You enter bet amount (e.g., $50)
2. **FHEVM encrypts the amount** before sending to blockchain
3. Encrypted value is stored on-chain: `0x7f8e9a3b...` (gibberish to others)
4. Only you hold the decryption key

#### Position Viewing
1. You can decrypt your own positions anytime
2. Click "Decrypt" button on My Positions tab
3. FHEVM uses your wallet signature to decrypt
4. Decrypted values are cached locally (browser)

#### Payout Calculation
1. When bet resolves, admin uses **relayer callback**
2. Relayer decrypts ALL user positions (via gateway)
3. Calculates payouts using parimutuel formula
4. Stores final payout amounts on-chain (unencrypted)

**Privacy Trade-off:**
- During betting: **fully private** (encrypted amounts)
- After resolution: **payouts are public** (needed for claiming)

### FHEVM Initialization Process

**When you connect your wallet:**
```javascript
// 1. Initialize FHEVM instance
const instance = await initializeFHE();

// 2. Create FHE client
const { publicKey, privateKey } = instance.generateKeypair();

// 3. Generate EIP-712 signature (proves you own the wallet)
const signature = await provider.send('eth_signTypedData_v4', [account, eip712]);

// 4. Store instance for encryption/decryption
setFhevmInstance(instance);

// 5. Ready to place encrypted bets! ✅
```

**Location:** `frontend/src/lib/fhe.js:23-79`

**Initialization Time:** ~1-2 seconds

**Notification:** "🔐 Privacy encryption ready"

---

## 10. FAQ & Troubleshooting

### General Questions

**Q: Do I need cryptocurrency to use the platform?**
A: Yes, you need USDC (stablecoin) on the supported network. You also need native tokens (e.g., ZAMA) for gas fees.

**Q: Can other users see how much I bet?**
A: No! Your bet amounts are encrypted using FHEVM. Only you can decrypt them. After resolution, your payout amount becomes public.

**Q: How are odds calculated?**
A: The platform uses **Parimutuel odds** (pool-based). Your payout depends on:
- Total pool size
- How much is bet on the winning option
- Your share of the winning pool

**Q: When can I claim my winnings?**
A: After the bet is resolved AND you've requested payout (processed by relayer). The process takes ~1-2 minutes.

**Q: What happens if I lose?**
A: Your bet amount goes into the total pool and is distributed to winners. You cannot claim anything, and the "Request Payout" button will not appear.

**Q: Can I cancel a bet after placing it?**
A: No. All bets are final once the transaction is confirmed on-chain.

### Troubleshooting

#### Issue: "FHEVM not initialized"

**Solution:**
1. Wait 2-3 seconds after connecting wallet
2. Refresh the page
3. Ensure you're on a supported network (Zama Devnet)
4. Check browser console for errors

#### Issue: "Insufficient balance"

**Solution:**
1. Click "Decrypt Balance" to reveal your actual balance
2. Ensure you have enough USDC for the bet
3. Reserve some USDC for gas fees (~$0.50-$1.00)
4. If needed, fund your wallet with USDC

#### Issue: "Request Payout button doesn't appear"

**Possible Reasons:**
1. Bet is not yet resolved → Wait for admin to resolve
2. You lost the bet → MongoDB marked you as loser (no payout)
3. You already requested payout → Refresh the page to see claim button
4. Relayer is processing → Wait 1-2 minutes and refresh

**Solution:**
- Check bet status (should say "Resolved")
- Check your position in "My Positions" tab
- If you lost, you won't see the button (this is expected)

#### Issue: "Payout request stuck in 'Requested' state"

**Solution:**
1. Wait 2-3 minutes (relayer may be slow)
2. Refresh the page
3. Check backend logs: `backend/routes/callback.js`
4. Ensure relayer service is running
5. Contact support if stuck for >5 minutes

#### Issue: "Transaction failed"

**Possible Reasons:**
1. Insufficient gas fees
2. Bet already ended
3. Bet amount below minimum or above maximum
4. Contract paused by admin

**Solution:**
- Check error message in wallet
- Ensure you have native tokens for gas
- Verify bet is still active
- Check min/max bet amounts on bet details page

#### Issue: "Balance not updating after claim"

**Solution:**
1. Wait 10-15 seconds for transaction confirmation
2. Click "Decrypt Balance" button to refresh
3. Check transaction on block explorer
4. Clear browser cache and refresh

#### Issue: "My positions not showing"

**Solution:**
1. Positions are stored in **browser cache** (localStorage)
2. If you cleared browser data, positions are lost (but still on-chain)
3. Check "Order History" tab to see your bets
4. Your actual winnings are safe on-chain (claimable after resolution)

**Note:** Losing local cache only affects viewing, not claiming payouts!

---

## Summary

The Polymarket FHEVM platform provides a **private, decentralized prediction market** using advanced encryption technology.

**Key Features:**
- ✅ **Private Betting:** Bet amounts encrypted with FHEVM
- ✅ **Parimutuel Odds:** Fair, pool-based payout system
- ✅ **Multiple Bet Types:** Binary, Multiple Choice, Nested
- ✅ **Easy Claiming:** Request payout → Claim winnings (2 steps)
- ✅ **Dashboard Tracking:** View active, ended, and claimable bets
- ✅ **Transparent Resolution:** Decentralized, admin-resolved outcomes

**Quick Start Checklist:**
1. ✓ Connect wallet
2. ✓ Wait for FHEVM initialization
3. ✓ Decrypt balance (first time)
4. ✓ Browse markets and select a bet
5. ✓ Place encrypted bet
6. ✓ Track in Dashboard
7. ✓ Claim winnings after resolution

For more technical details, see:
- **Admin Guide:** `ADMIN_GUIDE.md`
- **FHEVM Integration:** `FHEVM_INTEGRATION.md`
- **Smart Contracts:** `hardhat/contracts/`

Happy predicting! 🎯
