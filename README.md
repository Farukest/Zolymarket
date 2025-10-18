# 🔐 Zolymarket

**Private Prediction Markets on Zama FHEVM**

A fully decentralized prediction market platform that leverages Fully Homomorphic Encryption (FHE) to keep your bet amounts completely private while maintaining transparent market outcomes. Built on Zama's FHEVM technology, Zolymarket enables users to place encrypted bets on real-world events without revealing their positions to other participants.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with FHEVM](https://img.shields.io/badge/Built%20with-Zama%20FHEVM-blue)](https://docs.zama.ai/fhevm)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react)](https://reactjs.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)](https://soliditylang.org/)

---

## 🌟 Key Features

### 🔒 Privacy-First Architecture
- **Encrypted Bet Amounts**: Your bet sizes remain completely private using FHEVM's homomorphic encryption
- **Hidden Positions**: Other users cannot see your market positions or betting patterns
- **Transparent Outcomes**: Market results remain publicly verifiable on-chain

### 🎯 Multiple Market Types
- **Binary Markets**: Simple Yes/No predictions (e.g., "Will Bitcoin reach $100K?")
- **Multiple Choice**: Select from 3+ exclusive outcomes (e.g., "Who will win the championship?")
- **Nested Markets**: Independent propositions with Yes/No outcomes for each

### 📊 Advanced Features
- **Parimutuel Odds System**: Fair, pool-based payout calculation
- **Real-time Statistics**: Live volume tracking with encrypted data aggregation
- **Category Management**: Organized markets with drag-and-drop reordering
- **Admin Dashboard**: Complete market management interface with analytics
- **Two-Step Payout System**: Request payout → Relayer decrypts → Claim winnings
- **Mobile Responsive**: Seamless experience across all devices

### 🛡️ Security & Decentralization
- **Smart Contract Powered**: All logic runs on-chain with zero downtime
- **Role-Based Access**: Granular admin permissions (Super Admin, Bet Manager, Category Manager)
- **Relayer Callback**: Secure off-chain decryption for payout calculations
- **MongoDB Integration**: Efficient winner/loser tracking to prevent unnecessary decryption requests

---

## 📚 Documentation

### 🔍 Deep Dive: FHEVM Integration

For a **comprehensive technical guide** on how Fully Homomorphic Encryption is integrated into this project, including:
- Encryption/decryption workflows
- Smart contract FHEVM patterns
- Frontend FHEVM client integration
- Relayer callback architecture
- Privacy guarantees and trade-offs

👉 **Read the full guide:** [FHEVM_INTEGRATION.md](https://github.com/Farukest/Zolymarket/blob/main/FHEVM_INTEGRATION.md)

### 📖 User Guides

- **[User Guide](USER_GUIDE.md)**: Complete guide for placing bets, claiming winnings, and using the platform
- **[Admin Guide](ADMIN_GUIDE.md)**: Comprehensive guide for administrators managing markets and categories

---

## 🏗️ Architecture

```
zolymarket/
├── hardhat/              # Smart contracts & deployment
│   ├── contracts/        # Solidity contracts with FHEVM
│   │   ├── BetMarketCore.sol       # Core betting logic
│   │   ├── BetMarketPayout.sol     # Payout & claiming
│   │   ├── BetMarketStats.sol      # Statistics aggregation
│   │   └── CategoryManager.sol     # Category management
│   └── scripts/          # Deployment scripts
│
├── frontend/             # React.js application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Page components (Home, Dashboard, Admin)
│   │   ├── hooks/        # Custom hooks (useWallet, useFHEVM)
│   │   ├── lib/          # FHEVM client integration
│   │   └── services/     # API clients & utilities
│   └── vite.config.js    # Build configuration
│
└── backend/              # Node.js + Express API
    ├── routes/           # API endpoints
    ├── models/           # MongoDB schemas
    └── middleware/       # Auth & validation
```

---

## 🚀 Quick Start

### Prerequisites Installation

Before starting, you need to install the following tools:

#### 1. Install Node.js v18+

**Windows:**
1. Download Node.js from [nodejs.org](https://nodejs.org/)
2. Download the **LTS version** (18.x or higher)
3. Run the installer (`.msi` file)
4. Follow the installation wizard (keep default settings)
5. Verify installation:
   ```bash
   node --version
   npm --version
   ```

**Ubuntu/Debian:**
```bash
# Update package list
sudo apt update

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

#### 2. Install Git

**Windows:**
1. Download Git from [git-scm.com](https://git-scm.com/download/win)
2. Run the installer
3. Use default settings during installation
4. Verify installation:
   ```bash
   git --version
   ```

**Ubuntu/Debian:**
```bash
# Install Git
sudo apt update
sudo apt install -y git

# Verify installation
git --version
```

#### 3. Install MetaMask Wallet

1. Open your browser (Chrome, Firefox, or Brave)
2. Go to [metamask.io](https://metamask.io/)
3. Click "Download" and install the browser extension
4. Create a new wallet or import existing one
5. **Save your seed phrase securely!**

---

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/Farukest/Zolymarket.git
cd Zolymarket
```

### 2️⃣ Install Dependencies

```bash
# Install Hardhat dependencies
cd hardhat && npm install && cd ..

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 3️⃣ Environment Configuration

**IMPORTANT:** Copy the `.env.example` files and create your own `.env` files with your API keys.

#### Backend Configuration

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and update:
- `SEPOLIA_RPC_URL` - Add your Alchemy API key
- `MONGODB_URI` - Your MongoDB connection string (if using cloud)
- Contract addresses (after deployment)

#### Frontend Configuration

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env` and update:
- `VITE_FHEVM_NETWORK_URL` - Add your Alchemy API key
- `VITE_ADMIN_ADDRESSES` - Your admin wallet address
- Contract addresses (after deployment)

#### Hardhat Configuration (For Deployment)

```bash
cd hardhat
cp .env.example .env
```

Edit `hardhat/.env` and update:
- `PRIVATE_KEY` - Your wallet private key (for deploying contracts)
- `ALCHEMY_API_KEY` - Your Alchemy API key
- `SEPOLIA_URL` - Add your Alchemy API key

**⚠️ Security Warning:**
- Never commit `.env` files to GitHub
- Keep your private keys and API keys secret
- Use `.env.example` files as templates only

### 4️⃣ Start Backend Server

```bash
cd backend
npm run dev
```

**Note:** Configure database and contract addresses in `backend/.env` before starting.

### 5️⃣ Start Frontend

```bash
cd frontend
npm run dev
```

### 6️⃣ Access the Application

1. Open **http://localhost:5173** in your browser
2. Connect your MetaMask wallet
3. Switch to **Sepolia Testnet** in MetaMask
4. Wait for FHEVM initialization (~2 seconds)
5. Start placing encrypted bets! 🎉

**Requirements:**
- MetaMask connected to Sepolia Testnet
- Sepolia ETH for gas fees
- Test USDC for placing bets

### 7️⃣ Get Test Tokens

You need **Sepolia ETH** and **Test USDC** to use the platform.

**Sepolia ETH:**
- Use public faucets like [sepoliafaucet.com](https://sepoliafaucet.com/)
- Or contact me on Twitter: [@0xflydev](https://twitter.com/0xflydev)

**Test USDC:**
- Contact [@0xflydev](https://twitter.com/0xflydev) with your wallet address
- I'll send you test USDC tokens

**Note:** The platform is currently in beta. For deployment and advanced setup, reach out on Twitter or open an issue on GitHub

---

## 🎮 Usage Examples

### For Users

**1. Browse Markets**
```
Home → Filter by Trending/New/Ending Soon → Select a market
```

**2. Place a Private Bet**
```
Connect Wallet → Select Market → Choose Option → Enter Amount → Place Bet
✅ Your bet amount is encrypted and stored on-chain privately
```

**3. Claim Winnings**
```
Dashboard → Claims Tab → Request Payout → Wait 1-2 minutes → Claim
✅ Relayer decrypts your position and calculates your payout
```

### For Admins

**1. Create a Market**
```
Admin Panel → Bet Management → Create Bet → Fill details → Deploy
```

**2. Resolve a Market**
```
Admin Panel → Bet Management → Select Bet → Resolve → Select Winner
✅ Smart contract marks winning options
```

**3. Manage Categories**
```
Admin Panel → Categories → Create/Edit/Reorder categories
✅ Drag-and-drop reordering supported
```

---

## 🔐 Privacy Technology

### How FHEVM Protects Your Bets

**Traditional Prediction Markets:**
```
❌ Bet amounts visible on-chain
❌ Large bets can manipulate market sentiment
❌ Privacy concerns for high-value traders
```

**Zolymarket with FHEVM:**
```
✅ Bet amounts encrypted before submission
✅ Smart contracts compute on encrypted data
✅ Only you can decrypt your position
✅ Market odds remain accurate without revealing individual positions
```

### Encryption Flow

```
User Places $100 Bet
         ↓
Frontend encrypts: $100 → 0x7f8e9a3b...
         ↓
Smart contract stores encrypted value
         ↓
Other users see: "Position exists" (amount hidden)
         ↓
On resolution: Relayer decrypts for payout calculation
         ↓
Final payout: Publicly visible (needed for claiming)
```

**Learn more:** See [FHEVM_INTEGRATION.md](https://github.com/Farukest/Zolymarket/blob/main/FHEVM_INTEGRATION.md) for technical details

---

## 🧪 Smart Contract Overview

### Core Contracts

| Contract | Purpose | Key Features |
|----------|---------|--------------|
| **BetMarketCore.sol** | Core betting logic | FHEVM-encrypted bets, 3 bet types, position tracking |
| **BetMarketPayout.sol** | Payout management | Relayer callback, payout calculation, claiming |
| **BetMarketStats.sol** | Statistics aggregation | Oracle decryption, volume tracking |
| **CategoryManager.sol** | Category system | Hierarchical categories, display ordering |

### Key Functions

**Place Bet (Encrypted):**
```solidity
function placeBet(
    uint256 betId,
    uint256 optionIndex,
    einput encryptedAmount,
    bytes calldata inputProof
) external {
    // Amount remains encrypted on-chain
    euint64 amount = TFHE.asEuint64(encryptedAmount, inputProof);
    // ... betting logic
}
```

**Request Payout (Triggers Relayer):**
```solidity
function requestPayout(uint256 betId) external {
    // Emit event for relayer to process
    emit PayoutRequested(betId, msg.sender);
}
```

**Claim Payout (After Decryption):**
```solidity
function claimPayout(uint256 betId) external {
    uint256 payout = payouts[betId][msg.sender];
    // Transfer USDC to winner
    usdc.transfer(msg.sender, payout);
}
```

---

## 🛠️ Tech Stack

### Smart Contracts
- **Solidity 0.8.24** - Smart contract language
- **Zama FHEVM** - Fully homomorphic encryption library
- **Hardhat** - Development framework
- **fhEVM.sol** - FHEVM Solidity library

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool & dev server
- **Ethers.js 6** - Web3 library
- **fhevmjs** - FHEVM client library
- **TailwindCSS** - Styling framework
- **React Router** - Navigation
- **Lucide React** - Icon library

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database for metadata
- **Mongoose** - ODM library

---

## 📊 Project Status

### ✅ Completed Features
- [x] FHEVM-encrypted bet placement
- [x] Three bet types (Binary, Multiple, Nested)
- [x] Relayer callback system for payouts
- [x] Admin panel with analytics
- [x] Category management with drag-and-drop
- [x] User dashboard with position tracking
- [x] MongoDB winner/loser tracking
- [x] Mobile-responsive UI
- [x] Dark mode support

### 🚧 Planned Features
- [ ] Social features (comments, user profiles)
- [ ] Advanced analytics charts
- [ ] Multi-language support
- [ ] Mobile app (React Native)
- [ ] On-chain governance
- [ ] Liquidity pools

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines
- Follow existing code style and conventions
- Add comments for complex logic
- Test all changes thoroughly
- Update documentation as needed

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🔗 Links & Resources

- **GitHub Repository**: [github.com/Farukest/Zolymarket](https://github.com/Farukest/Zolymarket)
- **Twitter**: [@0xflydev](https://twitter.com/0xflydev)
- **Zama FHEVM Docs**: [docs.zama.ai/fhevm](https://docs.zama.ai/fhevm)
- **FHEVM Integration Guide**: [FHEVM_INTEGRATION.md](https://github.com/Farukest/Zolymarket/blob/main/FHEVM_INTEGRATION.md)

---

## ⚠️ Disclaimer

- This project is **experimental** and deployed on **testnets only**
- **Not financial advice** - use at your own risk
- Ensure compliance with local regulations before using prediction markets
- Smart contracts are **unaudited** - do not use with real funds on mainnet

---

## 🙏 Acknowledgments

- **Zama** - For pioneering FHEVM technology and making privacy-preserving smart contracts possible
- **React & Vite communities** - For excellent developer tools
- **Open source contributors** - For inspiration and shared knowledge

---

## 📧 Contact & Support

- **Issues**: [GitHub Issues](https://github.com/Farukest/Zolymarket/issues)
- **Twitter**: [@0xflydev](https://twitter.com/0xflydev)
- **GitHub**: [@Farukest](https://github.com/Farukest)

---

<div align="center">

**Built with ❤️ using Zama FHEVM, React, and Solidity**

⭐ Star this repo if you find it useful!

</div>
