const mongoose = require('mongoose');

async function checkDatabase() {
  try {
    await mongoose.connect('mongodb://localhost:27017/zolymarket');
    console.log('Connected to MongoDB');

    const Bet = mongoose.model('Bet', new mongoose.Schema({}, { strict: false, collection: 'bets' }));
    const bets = await Bet.find({}).select('contractId title contractAddress');

    console.log('\n📋 Database bet contractAddress field:');
    console.log('================================================');
    bets.forEach(bet => {
      console.log(`ID ${bet.contractId}: ${bet.title}`);
      console.log(`   contractAddress: ${bet.contractAddress || 'undefined'}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

checkDatabase();