const Bet = require('../models/Bet');
const { ethers } = require('ethers');

// Sync bets from contract to database
exports.syncBetsFromContract = async (req, res) => {
  try {
    const { contractAddress, rpcUrl, contractABI, chainId } = req.body;

    if (!contractAddress || !rpcUrl || !contractABI) {
      return res.status(400).json({
        success: false,
        message: 'Contract address, RPC URL, and ABI are required'
      });
    }

    // Connect to contract
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, contractABI, provider);

    // Get total bets count
    const totalBets = Number(await contract.getTotalBets());

    if (totalBets === 0) {
      return res.status(200).json({
        success: true,
        message: 'No bets found in contract',
        synced: 0,
        updated: 0,
        failed: 0
      });
    }

    let synced = 0;
    let updated = 0;
    let failed = 0;
    const errors = [];

    // Sync each bet
    for (let i = 1; i <= totalBets; i++) {
      try {
        // Get bet from contract
        const contractBet = await contract.getBet(i);

        // Get options separately (they're stored in a different mapping)
        const optionCount = Number(contractBet.optionCount);
        const options = [];
        for (let j = 0; j < optionCount; j++) {
          try {
            const option = await contract.getBetOption(i, j);
            options.push({
              title: option.title || `Option ${j + 1}`,
              isWinner: option.isWinner || false,
              publicTotalShares: Number(option.publicTotalShares || 0),
              currentPrice: 50, // Default price
              description: ''
            });
          } catch (optErr) {
            console.warn(`Could not get option ${j} for bet ${i}:`, optErr.message);
          }
        }

        // Get bet statistics
        // Note: totalParticipants is encrypted (euint32), needs decryption
        // For now, we'll use getTotalBetCount which is public
        let totalBets = 0;
        try {
          totalBets = Number(await contract.getTotalBetCount(i));
        } catch (e) {
          console.warn(`Could not get bet count for bet ${i}`);
          totalBets = 0;
        }

        // Calculate unique participants from hasPlacedBet events or leave as 0
        // This would require event parsing which is complex
        // For now, set to 0 and let frontend handle it if needed
        const totalParticipants = 0; // TODO: Decrypt encrypted value or count from events

        // Parse bet data
        const betData = {
          contractId: i,
          contractAddress: contractAddress.toLowerCase(),
          title: contractBet.title || `Bet #${i}`,
          description: contractBet.description || '',
          betType: Number(contractBet.betType),
          options: options,
          endTime: new Date(Number(contractBet.endTime) * 1000),
          isActive: contractBet.isActive,
          isResolved: contractBet.isResolved || false,
          createdBy: contractBet.createdBy ? contractBet.createdBy.toLowerCase() : '0x0000000000000000000000000000000000000000',
          minBetAmount: Number(contractBet.minBetAmount || 0),
          maxBetAmount: Number(contractBet.maxBetAmount || 0),
          totalParticipants: totalParticipants,
          totalBets: totalBets,
          totalShares: 0, // This might need separate calculation
          winningOptionIndex: null, // Will be set on resolution
          lastSyncAt: new Date(),
          syncStatus: 'synced',
          useFHEVM: true,
          encryptionMetadata: {
            chainId: chainId || 11155111
          }
        };

        // Check if bet exists
        const existingBet = await Bet.findOne({ contractId: i });

        if (existingBet) {
          // Update existing bet (preserve category and other admin data)
          await Bet.findOneAndUpdate(
            { contractId: i },
            {
              $set: {
                ...betData,
                categoryId: existingBet.categoryId, // Preserve category
                imageUrl: existingBet.imageUrl, // Preserve image
                tags: existingBet.tags, // Preserve tags
                featured: existingBet.featured, // Preserve featured status
                priority: existingBet.priority, // Preserve priority
                visibility: existingBet.visibility, // Preserve visibility
                marketGroup: existingBet.marketGroup // Preserve grouping
              }
            },
            { upsert: false, new: true }
          );
          updated++;
        } else {
          // Create new bet with default categoryId
          const newBet = new Bet({
            ...betData,
            categoryId: 'uncategorized' // Default category
          });
          await newBet.save();
          synced++;
        }

      } catch (error) {
        console.error(`Error syncing bet ${i}:`, error);
        failed++;
        errors.push({ betId: i, error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Synced ${synced} new bets, updated ${updated} existing bets${failed > 0 ? `, ${failed} failed` : ''}`,
      synced,
      updated,
      failed,
      total: totalBets,
      errors: errors.length > 0 ? errors.slice(0, 10) : []
    });

  } catch (error) {
    console.error('Bet sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync bets from contract',
      error: error.message
    });
  }
};

// Get all bets from database
exports.getAllBets = async (req, res) => {
  try {
    const { category, isActive, isResolved, limit = 100, page = 1 } = req.query;

    const filter = {};
    if (category) filter.categoryId = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (isResolved !== undefined) filter.isResolved = isResolved === 'true';

    const bets = await Bet.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Bet.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: bets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get bets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get bets',
      error: error.message
    });
  }
};

// Get bet by contractId
exports.getBetByContractId = async (req, res) => {
  try {
    const { contractId } = req.params;

    const bet = await Bet.findOne({ contractId: parseInt(contractId) });

    if (!bet) {
      return res.status(404).json({
        success: false,
        message: 'Bet not found'
      });
    }

    res.status(200).json({
      success: true,
      data: bet
    });

  } catch (error) {
    console.error('Get bet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get bet',
      error: error.message
    });
  }
};

// Update bet category
exports.updateBetCategory = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { categoryId } = req.body;

    const bet = await Bet.findOneAndUpdate(
      { contractId: parseInt(contractId) },
      { $set: { categoryId, updatedAt: new Date() } },
      { new: true }
    );

    if (!bet) {
      return res.status(404).json({
        success: false,
        message: 'Bet not found'
      });
    }

    res.status(200).json({
      success: true,
      data: bet,
      message: 'Bet category updated successfully'
    });

  } catch (error) {
    console.error('Update bet category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update bet category',
      error: error.message
    });
  }
};

// Get bets by category
exports.getBetsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const bets = await Bet.find({
      categoryId,
      isActive: true
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: bets
    });

  } catch (error) {
    console.error('Get bets by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get bets by category',
      error: error.message
    });
  }
};

// Update bet image (URL)
exports.updateBetImage = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { imageUrl } = req.body;

    const bet = await Bet.findOneAndUpdate(
      { contractId: parseInt(contractId) },
      { $set: { imageUrl, updatedAt: new Date() } },
      { new: true }
    );

    if (!bet) {
      return res.status(404).json({
        success: false,
        message: 'Bet not found'
      });
    }

    res.status(200).json({
      success: true,
      data: bet,
      message: 'Bet image updated successfully'
    });

  } catch (error) {
    console.error('Update bet image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update bet image',
      error: error.message
    });
  }
};

// Upload bet image (File Upload)
exports.uploadBetImage = async (req, res) => {
  try {
    const { contractId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Generate relative path only
    const imageUrl = `/uploads/bet-images/${req.file.filename}`;

    // Update bet with new image URL
    const bet = await Bet.findOneAndUpdate(
      { contractId: parseInt(contractId) },
      { $set: { imageUrl, updatedAt: new Date() } },
      { new: true }
    );

    if (!bet) {
      return res.status(404).json({
        success: false,
        message: 'Bet not found'
      });
    }

    res.status(200).json({
      success: true,
      data: bet,
      imageUrl: imageUrl,
      message: 'Bet image uploaded successfully'
    });

  } catch (error) {
    console.error('Upload bet image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload bet image',
      error: error.message
    });
  }
};

// Resolve bet (admin only)
exports.resolveBet = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { winnerIndex, contractAddress, rpcUrl, contractABI } = req.body;

    // Get admin private key from backend env (SECURE)
    const adminPrivateKey = process.env.PRIVATE_KEY;

    // Get bet from database
    const bet = await Bet.findOne({ contractId: parseInt(contractId) });
    if (!bet) {
      return res.status(404).json({
        success: false,
        message: 'Bet not found'
      });
    }

    // Check if already resolved
    if (bet.isResolved) {
      return res.status(400).json({
        success: false,
        message: 'Bet is already resolved'
      });
    }

    // Note: Removed endTime check for testing purposes
    // Admin can manually resolve bets even if they're still active
    // const now = Date.now();
    // if (bet.endTime > now) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Bet has not ended yet'
    //   });
    // }

    // Call contract to resolve
    const ethers = require('ethers');
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(adminPrivateKey, provider);
    const contract = new ethers.Contract(contractAddress, contractABI, wallet);

    const tx = await contract.resolveBet(contractId, winnerIndex);
    await tx.wait();

    // Update database
    const updatedOptions = bet.options.map((opt, idx) => ({
      ...opt,
      isWinner: idx === winnerIndex
    }));

    bet.isResolved = true;
    bet.options = updatedOptions;
    bet.updatedAt = new Date();
    await bet.save();

    res.status(200).json({
      success: true,
      data: bet,
      message: 'Bet resolved successfully',
      txHash: tx.hash
    });

  } catch (error) {
    console.error('Resolve bet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve bet',
      error: error.message
    });
  }
};

// Resolve nested bet (admin only)
exports.resolveNestedBet = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { optionIndex, outcome, contractAddress, rpcUrl, contractABI } = req.body;

    // Get admin private key from backend env (SECURE)
    const adminPrivateKey = process.env.PRIVATE_KEY;

    // Validate private key exists
    if (!adminPrivateKey) {
      return res.status(500).json({
        success: false,
        message: 'Admin private key not configured in backend'
      });
    }

    console.log('🔑 Private key loaded:', adminPrivateKey ? 'YES (length: ' + adminPrivateKey.length + ')' : 'NO');

    // Get bet from database
    const bet = await Bet.findOne({ contractId: parseInt(contractId) });
    if (!bet) {
      return res.status(404).json({
        success: false,
        message: 'Bet not found'
      });
    }

    // Check if already resolved
    if (bet.isResolved) {
      return res.status(400).json({
        success: false,
        message: 'Bet is already resolved'
      });
    }

    // Call contract to resolve
    const ethers = require('ethers');
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(adminPrivateKey, provider);
    const contract = new ethers.Contract(contractAddress, contractABI, wallet);

    const tx = await contract.resolveNestedBet(contractId, optionIndex, outcome);
    await tx.wait();

    // Update database
    const updatedOptions = bet.options.map((opt, idx) => {
      if (idx === optionIndex) {
        return { ...opt, isWinner: true };
      }
      return opt;
    });

    bet.isResolved = true;
    bet.options = updatedOptions;
    bet.updatedAt = new Date();
    await bet.save();

    res.status(200).json({
      success: true,
      data: bet,
      message: 'Nested bet resolved successfully',
      txHash: tx.hash
    });

  } catch (error) {
    console.error('Resolve nested bet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve nested bet',
      error: error.message
    });
  }
};
