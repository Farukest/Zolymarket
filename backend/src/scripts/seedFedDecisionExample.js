// Seed Script: Fed Decision Nested Markets Example
// Creates multiple separate binary bets for FHEVM testing

const mongoose = require('mongoose');
const Bet = require('../models/Bet');
const Category = require('../models/Category');
const { generateUniqueId } = require('../utils/helpers');

// Admin address for categories (needs ObjectId)
const SYSTEM_ADMIN_ID = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
// Admin wallet address for bets (needs wallet format)
const ADMIN_WALLET = 'benim_adresim';

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zolymarket', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

// Fed Decision Test Data
const fedDecisionGroupId = `fed_decision_${Date.now()}`;
const endTime = new Date();
endTime.setDate(endTime.getDate() + 30); // 30 days from now

const fedDecisionBets = [
  {
    title: "Fed 50+ bps decrease?",
    description: "Will the Federal Reserve decrease interest rates by 50 basis points or more?",
    betType: 0, // Binary
    options: [
      { title: "Yes", description: "Fed will decrease rates by 50+ bps" },
      { title: "No", description: "Fed will not decrease rates by 50+ bps" }
    ],
    marketGroup: {
      groupId: fedDecisionGroupId,
      groupTitle: "Fed Decision October 2024",
      groupType: "nested",
      groupOrder: 0,
      isGroupHeader: true
    }
  },
  {
    title: "Fed 25 bps decrease?",
    description: "Will the Federal Reserve decrease interest rates by exactly 25 basis points?",
    betType: 0, // Binary
    options: [
      { title: "Yes", description: "Fed will decrease rates by 25 bps" },
      { title: "No", description: "Fed will not decrease rates by 25 bps" }
    ],
    marketGroup: {
      groupId: fedDecisionGroupId,
      groupTitle: "Fed Decision October 2024",
      groupType: "nested",
      groupOrder: 1,
      isGroupHeader: false
    }
  },
  {
    title: "Fed no change?",
    description: "Will the Federal Reserve keep interest rates unchanged?",
    betType: 0, // Binary
    options: [
      { title: "Yes", description: "Fed will keep rates unchanged" },
      { title: "No", description: "Fed will change rates" }
    ],
    marketGroup: {
      groupId: fedDecisionGroupId,
      groupTitle: "Fed Decision October 2024",
      groupType: "nested",
      groupOrder: 2,
      isGroupHeader: false
    }
  },
  {
    title: "Fed 25+ bps increase?",
    description: "Will the Federal Reserve increase interest rates by 25 basis points or more?",
    betType: 0, // Binary
    options: [
      { title: "Yes", description: "Fed will increase rates by 25+ bps" },
      { title: "No", description: "Fed will not increase rates by 25+ bps" }
    ],
    marketGroup: {
      groupId: fedDecisionGroupId,
      groupTitle: "Fed Decision October 2024",
      groupType: "nested",
      groupOrder: 3,
      isGroupHeader: false
    }
  }
];

// Sports Example Data
const sportsGroupId = `laliga_${Date.now()}`;
const sportsBets = [
  {
    title: "Sevilla vs Villareal",
    description: "La Liga match - Week 7",
    betType: 1, // Multiple Choice
    options: [
      { title: "Sevilla", description: "Sevilla wins" },
      { title: "Draw", description: "Match ends in a draw" },
      { title: "Villareal", description: "Villareal wins" }
    ],
    marketGroup: {
      groupId: sportsGroupId,
      groupTitle: "La Liga Week 7",
      groupType: "series",
      groupOrder: 0,
      isGroupHeader: false
    }
  },
  {
    title: "Real Madrid vs Barcelona",
    description: "El Clasico - La Liga match",
    betType: 1, // Multiple Choice
    options: [
      { title: "Real Madrid", description: "Real Madrid wins" },
      { title: "Draw", description: "Match ends in a draw" },
      { title: "Barcelona", description: "Barcelona wins" }
    ],
    marketGroup: {
      groupId: sportsGroupId,
      groupTitle: "La Liga Week 7",
      groupType: "series",
      groupOrder: 1,
      isGroupHeader: false
    }
  }
];

// Standalone Example Data
const standaloneBets = [
  {
    title: "Bitcoin above $100k by 2024?",
    description: "Will Bitcoin price reach $100,000 USD by end of 2024?",
    betType: 0, // Binary
    options: [
      { title: "Yes", description: "BTC will reach $100k" },
      { title: "No", description: "BTC will not reach $100k" }
    ],
    marketGroup: {
      groupId: null,
      groupTitle: null,
      groupType: "standalone",
      groupOrder: 0,
      isGroupHeader: false
    }
  },
  {
    title: "2024 US President Election",
    description: "Who will win the 2024 US Presidential Election?",
    betType: 1, // Multiple Choice
    options: [
      { title: "Donald Trump", description: "Trump wins presidency" },
      { title: "Joe Biden", description: "Biden wins presidency" },
      { title: "Other Candidate", description: "Third party or other candidate wins" }
    ],
    marketGroup: {
      groupId: null,
      groupTitle: null,
      groupType: "standalone",
      groupOrder: 0,
      isGroupHeader: false
    }
  }
];

// Create test data
async function seedTestData() {
  try {
    console.log('🌱 Starting Fed Decision seed process...');

    // Clear existing test data
    console.log('🧹 Clearing existing test bets...');
    await Bet.deleteMany({
      $or: [
        { 'marketGroup.groupId': fedDecisionGroupId },
        { 'marketGroup.groupId': sportsGroupId },
        { title: { $in: ['Bitcoin above $100k by 2024?', '2024 US President Election'] } }
      ]
    });

    const currentTime = new Date();
    const categoryEndTime = new Date();
    categoryEndTime.setFullYear(categoryEndTime.getFullYear() + 1); // 1 year from now

    // Get or create Economics category
    let economicsCategory = await Category.findOne({ name: 'Economics' });
    if (!economicsCategory) {
      economicsCategory = await Category.create({
        _id: '4',
        categoryId: '4',
        contractCategoryId: '4',
        name: 'Economics',
        description: 'Economic and financial markets',
        imageUrl: 'economics.jpg',
        level: 1,
        parentId: 0,
        isActive: true,
        startTime: currentTime,
        endTime: categoryEndTime,
        createdBy: SYSTEM_ADMIN_ID
      });
      console.log('✅ Created Economics category');
    }

    // Get or create Sports category
    let sportsCategory = await Category.findOne({ name: 'Sports' });
    if (!sportsCategory) {
      sportsCategory = await Category.create({
        _id: '3',
        categoryId: '3',
        contractCategoryId: '3',
        name: 'Sports',
        description: 'Sports betting and competitions',
        imageUrl: 'sports.jpg',
        level: 1,
        parentId: 0,
        isActive: true,
        startTime: currentTime,
        endTime: categoryEndTime,
        createdBy: SYSTEM_ADMIN_ID
      });
      console.log('✅ Created Sports category');
    }

    // Get or create Politics category
    let politicsCategory = await Category.findOne({ name: 'Politics' });
    if (!politicsCategory) {
      politicsCategory = await Category.create({
        _id: '1',
        categoryId: '1',
        contractCategoryId: '1',
        name: 'Politics',
        description: 'Political events and elections',
        imageUrl: 'politics.jpg',
        level: 1,
        parentId: 0,
        isActive: true,
        startTime: currentTime,
        endTime: categoryEndTime,
        createdBy: SYSTEM_ADMIN_ID
      });
      console.log('✅ Created Politics category');
    }

    // Create Fed Decision bets
    console.log('💰 Creating Fed Decision nested markets...');
    let contractId = 1001; // Starting contract ID

    for (const betData of fedDecisionBets) {
      const bet = await Bet.create({
        contractId: contractId++,
        contractAddress: '0x6B0Fc68e8e28d4E35bD33E8eAa32b06fC8E1356E', // Our updated contract
        title: betData.title,
        description: betData.description,
        imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400',
        categoryId: economicsCategory.categoryId,
        tags: ['fed', 'interest-rates', 'economics', 'monetary-policy'],
        featured: betData.marketGroup.isGroupHeader,
        priority: betData.marketGroup.groupOrder,
        visibility: 'public',
        marketGroup: betData.marketGroup,
        endTime: endTime,
        isActive: true,
        isResolved: false,
        betType: betData.betType,
        createdBy: ADMIN_WALLET,
        totalParticipants: 0,
        minBetAmount: 1000000, // 1 USDC (6 decimals)
        maxBetAmount: 1000000000000, // 1M USDC
        options: betData.options.map(option => ({
          title: option.title,
          description: option.description,
          currentPrice: Math.round(100 / betData.options.length), // Equal distribution
          isWinner: false,
          encryptedTotalAmount: null,
          publicTotalShares: 0
        })),
        useFHEVM: true,
        encryptionMetadata: {
          aclAddress: '0x2Fb4341027eb1d2aD8B5D9708187df8633cAFA92',
          kmsAddress: '0x596E6682c72946AF006B27C131793F2B62527A4B',
          chainId: 11155111, // Sepolia
          encryptionVersion: '0.5.0'
        },
        syncStatus: 'synced',
        lastSyncAt: new Date()
      });

      console.log(`✅ Created: ${bet.title} (ID: ${bet.contractId})`);
    }

    // Create Sports bets
    console.log('⚽ Creating Sports series markets...');

    for (const betData of sportsBets) {
      const bet = await Bet.create({
        contractId: contractId++,
        contractAddress: '0x6B0Fc68e8e28d4E35bD33E8eAa32b06fC8E1356E',
        title: betData.title,
        description: betData.description,
        imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400',
        categoryId: sportsCategory.categoryId,
        tags: ['laliga', 'football', 'sports'],
        featured: false,
        priority: betData.marketGroup.groupOrder,
        visibility: 'public',
        marketGroup: betData.marketGroup,
        endTime: endTime,
        isActive: true,
        isResolved: false,
        betType: betData.betType,
        createdBy: ADMIN_WALLET,
        totalParticipants: 0,
        minBetAmount: 1000000, // 1 USDC
        maxBetAmount: 1000000000000, // 1M USDC
        options: betData.options.map(option => ({
          title: option.title,
          description: option.description,
          currentPrice: Math.round(100 / betData.options.length), // Equal distribution
          isWinner: false,
          encryptedTotalAmount: null,
          publicTotalShares: 0
        })),
        useFHEVM: true,
        encryptionMetadata: {
          aclAddress: '0x2Fb4341027eb1d2aD8B5D9708187df8633cAFA92',
          kmsAddress: '0x596E6682c72946AF006B27C131793F2B62527A4B',
          chainId: 11155111,
          encryptionVersion: '0.5.0'
        },
        syncStatus: 'synced',
        lastSyncAt: new Date()
      });

      console.log(`✅ Created: ${bet.title} (ID: ${bet.contractId})`);
    }

    // Create Standalone bets
    console.log('🚀 Creating Standalone markets...');

    for (const betData of standaloneBets) {
      const categoryToUse = betData.title.includes('Bitcoin') ? economicsCategory : politicsCategory;

      const bet = await Bet.create({
        contractId: contractId++,
        contractAddress: '0x6B0Fc68e8e28d4E35bD33E8eAa32b06fC8E1356E',
        title: betData.title,
        description: betData.description,
        imageUrl: betData.title.includes('Bitcoin')
          ? 'https://images.unsplash.com/photo-1518544866330-4e739eeef2f4?w=400'
          : 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=400',
        categoryId: categoryToUse.categoryId,
        tags: betData.title.includes('Bitcoin') ? ['bitcoin', 'cryptocurrency'] : ['election', 'politics'],
        featured: true,
        priority: 1,
        visibility: 'public',
        marketGroup: betData.marketGroup,
        endTime: endTime,
        isActive: true,
        isResolved: false,
        betType: betData.betType,
        createdBy: ADMIN_WALLET,
        totalParticipants: 0,
        minBetAmount: 1000000, // 1 USDC
        maxBetAmount: 1000000000000, // 1M USDC
        options: betData.options.map(option => ({
          title: option.title,
          description: option.description,
          currentPrice: Math.round(100 / betData.options.length), // Equal distribution
          isWinner: false,
          encryptedTotalAmount: null,
          publicTotalShares: 0
        })),
        useFHEVM: true,
        encryptionMetadata: {
          aclAddress: '0x2Fb4341027eb1d2aD8B5D9708187df8633cAFA92',
          kmsAddress: '0x596E6682c72946AF006B27C131793F2B62527A4B',
          chainId: 11155111,
          encryptionVersion: '0.5.0'
        },
        syncStatus: 'synced',
        lastSyncAt: new Date()
      });

      console.log(`✅ Created: ${bet.title} (ID: ${bet.contractId})`);
    }

    // Summary
    console.log('\n🎉 SEED COMPLETED SUCCESSFULLY!');
    console.log('==========================================');
    console.log(`📊 Fed Decision Group: ${fedDecisionBets.length} binary bets`);
    console.log(`⚽ Sports Series: ${sportsBets.length} multiple choice bets`);
    console.log(`🚀 Standalone: ${standaloneBets.length} mixed bets`);
    console.log(`📝 Total: ${fedDecisionBets.length + sportsBets.length + standaloneBets.length} bets created`);
    console.log(`🔗 Contract: 0x6B0Fc68e8e28d4E35bD33E8eAa32b06fC8E1356E`);
    console.log(`🔐 FHEVM Enabled: All bets use encrypted voting`);
    console.log('\n🧪 Test with Admin Panel:');
    console.log('1. Navigate to /admin');
    console.log('2. Switch to "Bulk Create" mode');
    console.log('3. Create additional nested markets');
    console.log('4. Test encrypted bet placement on frontend');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

// Main execution
async function main() {
  await connectDB();
  await seedTestData();
  await mongoose.connection.close();
  console.log('\n✅ Database connection closed');
  process.exit(0);
}

// Control functions
async function checkCreatedBets() {
  try {
    await connectDB();

    console.log('\n🔍 CHECKING CREATED BETS');
    console.log('==========================================');

    const allBets = await Bet.find({}).sort({ contractId: 1 });
    console.log(`📊 Total bets in database: ${allBets.length}`);

    if (allBets.length > 0) {
      console.log('\n📋 BETS LIST:');
      allBets.forEach(bet => {
        const groupInfo = bet.marketGroup.groupId ?
          ` [${bet.marketGroup.groupType.toUpperCase()}: ${bet.marketGroup.groupTitle}]` :
          ' [STANDALONE]';
        console.log(`  ${bet.contractId}: ${bet.title}${groupInfo}`);
      });

      // Grouped analysis
      const grouped = await Bet.getGroupedMarkets();
      console.log('\n🗂️ GROUPED ANALYSIS:');
      grouped.forEach(group => {
        console.log(`  📁 ${group.groupTitle || 'Standalone'} (${group.groupType}): ${group.bets.length} bets`);
      });
    }

    await mongoose.connection.close();
    console.log('\n✅ Check completed');
  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

async function clearAllBets() {
  try {
    await connectDB();

    console.log('\n🧹 CLEARING ALL BETS & CATEGORIES');
    console.log('==========================================');

    const betDeleteResult = await Bet.deleteMany({});
    console.log(`✅ Deleted ${betDeleteResult.deletedCount} bets from zolymarket database`);

    const categoryDeleteResult = await Category.deleteMany({});
    console.log(`✅ Deleted ${categoryDeleteResult.deletedCount} categories from zolymarket database`);

    await mongoose.connection.close();
    console.log('✅ Clear completed');
  } catch (error) {
    console.error('❌ Clear failed:', error);
  }
}

async function fixDatabaseIndexes() {
  try {
    await connectDB();

    console.log('\n🔧 FIXING DATABASE INDEXES');
    console.log('==========================================');

    try {
      await mongoose.connection.db.collection('categories').dropIndex('contractCategoryId_1');
      console.log('✅ Dropped problematic contractCategoryId_1 index');
    } catch (error) {
      console.log('ℹ️ Index contractCategoryId_1 does not exist or already dropped');
    }

    await mongoose.connection.close();
    console.log('✅ Index fix completed');
  } catch (error) {
    console.error('❌ Index fix failed:', error);
  }
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === 'check') {
    checkCreatedBets().catch(console.error);
  } else if (args[0] === 'clear') {
    clearAllBets().catch(console.error);
  } else if (args[0] === 'fix-indexes') {
    fixDatabaseIndexes().catch(console.error);
  } else {
    main().catch(console.error);
  }
}

module.exports = { seedTestData, checkCreatedBets, clearAllBets };