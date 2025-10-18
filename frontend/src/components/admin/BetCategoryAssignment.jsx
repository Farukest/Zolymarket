import React, { useState, useEffect } from 'react';
import { RefreshCw, Image as ImageIcon, CheckCircle, Upload, Save, X, ArrowUpDown, ArrowUp, ArrowDown, Filter, Plus, Calendar, DollarSign, Hash } from 'lucide-react';
import { useWallet } from '../../hooks/useWallet';
import categoryAPI from '../../services/categoryAPI';
import betSyncAPI, { BASE_URL } from '../../services/betSyncAPI';
import { getNetworkConfig } from '../../config/contracts';
import BetMarketCoreABI from '../../../../hardhat/artifacts/contracts/BetMarketCore.sol/BetMarketCore.json';
import toast from 'react-hot-toast';
import { ethers } from 'ethers';

const BetCategoryAssignment = ({ onUpdate }) => {
  const { chainId, account } = useWallet();
  const [categories, setCategories] = useState([]);
  const [dbBets, setDbBets] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [editingImage, setEditingImage] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [loadingDbBets, setLoadingDbBets] = useState(true);
  const [resolvingBet, setResolvingBet] = useState(null);
  const [selectedWinner, setSelectedWinner] = useState('');
  const [resolving, setResolving] = useState(false);
  // For nested bets
  const [nestedOptionIndex, setNestedOptionIndex] = useState('');
  const [nestedOutcome, setNestedOutcome] = useState(''); // 0 = Yes, 1 = No

  // New states for file upload
  const [selectedFiles, setSelectedFiles] = useState({}); // {contractId: File}
  const [previewUrls, setPreviewUrls] = useState({}); // {contractId: preview URL}
  const [uploadingImages, setUploadingImages] = useState({}); // {contractId: boolean}

  // Filtering and sorting states
  const [sortBy, setSortBy] = useState('contractId'); // contractId, title, endTime, betType, category
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc
  const [filterCategory, setFilterCategory] = useState(''); // empty = all
  const [filterStatus, setFilterStatus] = useState(''); // '', 'active', 'ended', 'resolved'

  // Create Bet Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [checkingAllowance, setCheckingAllowance] = useState(false);
  const [newBet, setNewBet] = useState({
    betType: '0', // '0'=Binary, '1'=Multiple, '2'=Nested
    title: '',
    description: '',
    options: ['Yes', 'No'], // Start with Yes/No for Binary
    endTime: '',
    minBet: '1',
    maxBet: '1000',
    liquidity: '500',
    categoryId: ''
  });

  useEffect(() => {
    fetchCategories();
    fetchDbBets();
  }, []);

  // Check allowance when modal opens
  useEffect(() => {
    if (showCreateModal && account) {
      checkAllowance();
    }
  }, [showCreateModal, account, newBet.liquidity]);

  const fetchCategories = async () => {
    try {
      const response = await categoryAPI.getCategories();
      setCategories(response.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchDbBets = async () => {
    try {
      setLoadingDbBets(true);
      const response = await betSyncAPI.getAllBets();
      setDbBets(response.data || []);
    } catch (error) {
      console.error('Error fetching DB bets:', error);
      setDbBets([]);
    } finally {
      setLoadingDbBets(false);
    }
  };

  const handleSyncBets = async () => {
    try {
      setSyncing(true);
      setSyncStatus(null);

      const networkConfig = getNetworkConfig(chainId);

      const syncData = {
        contractAddress: networkConfig.contracts.BET_MARKET_CORE,
        rpcUrl: networkConfig.rpcUrl,
        contractABI: BetMarketCoreABI.abi,
        chainId
      };

      const result = await betSyncAPI.syncBets(syncData);

      setSyncStatus({
        success: true,
        message: result.message,
        synced: result.synced,
        updated: result.updated,
        failed: result.failed
      });

      // Refresh DB bets (local state only, no page reload)
      await fetchDbBets();

      // DON'T call onUpdate() - it reloads the entire admin page!
      // onUpdate is only needed when categories change, not bet sync

    } catch (error) {
      setSyncStatus({
        success: false,
        message: error.response?.data?.message || 'Sync failed'
      });
    } finally {
      setSyncing(false);

      // Clear status after 5 seconds
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const handleAssignCategory = async (contractId, categoryId) => {
    // Update local state immediately (optimistic update)
    setDbBets(dbBets.map(bet =>
      bet.contractId === contractId
        ? { ...bet, categoryId }
        : bet
    ));

    // Show success toast immediately
    const categoryName = categories.find(c => c._id === categoryId)?.name || 'None';
    toast.success(`Category updated to "${categoryName}"`, {
      duration: 3000,
      position: 'top-right',
      style: {
        background: '#10b981',
        color: '#fff',
        fontWeight: '500',
      },
    });

    // Save to DB in background (silent)
    try {
      await betSyncAPI.updateBetCategory(contractId, categoryId);
      // Don't call onUpdate - it reloads the entire admin page
    } catch (error) {
      // Revert on error
      setDbBets(dbBets.map(bet =>
        bet.contractId === contractId
          ? { ...bet, categoryId: bet.categoryId }
          : bet
      ));

      toast.error(error.response?.data?.message || 'Failed to update category', {
        duration: 4000,
        position: 'top-right',
      });
    }
  };

  const handleUpdateImage = async () => {
    if (!editingImage) return;

    try {
      await betSyncAPI.updateBetImage(editingImage.contractId, imageUrl);

      // Update local state
      setDbBets(dbBets.map(bet =>
        bet.contractId === editingImage.contractId
          ? { ...bet, imageUrl }
          : bet
      ));

      toast.success('Image updated successfully');
      setEditingImage(null);
      setImageUrl('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update image');
    }
  };

  const handleResolveBet = async () => {
    if (!resolvingBet) return;

    // Check if it's a nested bet
    const isNestedBet = resolvingBet.betType === 2;

    if (isNestedBet) {
      // Nested bet needs option index and outcome
      if (nestedOptionIndex === '' || nestedOutcome === '') return;
    } else {
      // Regular bet needs winner index
      if (selectedWinner === '') return;
    }

    try {
      setResolving(true);

      // Check if wallet is connected
      if (!account) {
        toast.error('Please connect your wallet first');
        return;
      }

      const networkConfig = getNetworkConfig(chainId);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        networkConfig.contracts.BET_MARKET_CORE,
        BetMarketCoreABI.abi,
        signer
      );

      let tx;

      if (isNestedBet) {
        // Resolve nested bet via MetaMask
        const loadingToast = toast.loading('Please confirm the transaction in MetaMask...');

        tx = await contract.resolveNestedBet(
          resolvingBet.contractId,
          parseInt(nestedOptionIndex),
          parseInt(nestedOutcome)
        );

        toast.loading('Transaction submitted! Waiting for confirmation...', { id: loadingToast });
        await tx.wait();

        toast.success(`Nested bet resolved! Option ${parseInt(nestedOptionIndex) + 1}: ${parseInt(nestedOutcome) === 0 ? 'YES' : 'NO'} wins. TX: ${tx.hash.substring(0, 10)}...`, {
          id: loadingToast,
          duration: 5000,
        });
      } else {
        // Resolve regular bet via MetaMask
        const loadingToast = toast.loading('Please confirm the transaction in MetaMask...');

        tx = await contract.resolveBet(
          resolvingBet.contractId,
          parseInt(selectedWinner)
        );

        toast.loading('Transaction submitted! Waiting for confirmation...', { id: loadingToast });
        await tx.wait();

        toast.success(`Bet resolved successfully! Winner: Option ${parseInt(selectedWinner) + 1}. TX: ${tx.hash.substring(0, 10)}...`, {
          id: loadingToast,
          duration: 5000,
        });
      }

      // Update MongoDB with winners (NON-CRITICAL - runs in background)
      try {
        const winningOptionIndex = isNestedBet ? parseInt(nestedOptionIndex) : parseInt(selectedWinner);
        const winningOutcome = isNestedBet ? parseInt(nestedOutcome) : null; // For nested: 0=Yes, 1=No
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

        const updateResponse = await fetch(`${backendUrl}/api/user-positions/update-winners`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contractBetId: resolvingBet.contractId,
            winningOptionIndex: winningOptionIndex,
            winningOutcome: winningOutcome // For nested bets: 0=Yes, 1=No. For binary/multiple: null
          })
        });

        if (updateResponse.ok) {
          const updateData = await updateResponse.json();
          console.log(`✅ MongoDB winners updated: ${updateData.winnersCount} winners, ${updateData.losersCount} losers`);
          toast.success(`Winners updated in DB: ${updateData.winnersCount} won, ${updateData.losersCount} lost`, { duration: 4000 });
        } else {
          console.warn('MongoDB update failed (non-critical) - continuing anyway');
        }
      } catch (mongoErr) {
        console.warn('MongoDB update error (non-critical):', mongoErr);
        // Don't block the UI - MongoDB is optional
      }

      // Update local state
      setDbBets(dbBets.map(bet =>
        bet.contractId === resolvingBet.contractId
          ? { ...bet, isResolved: true, winningOptionIndex: isNestedBet ? parseInt(nestedOptionIndex) : parseInt(selectedWinner) }
          : bet
      ));

      setResolvingBet(null);
      setSelectedWinner('');
      setNestedOptionIndex('');
      setNestedOutcome('');

      // Refresh bets from DB
      await fetchDbBets();
    } catch (error) {
      console.error('Resolve error:', error);

      if (error.code === 'ACTION_REJECTED') {
        toast.error('Transaction rejected by user');
      } else if (error.message?.includes('Bet not ended')) {
        toast.error('Cannot resolve: Bet has not ended yet');
      } else {
        toast.error(error.reason || error.message || 'Failed to resolve bet');
      }
    } finally {
      setResolving(false);
    }
  };

  // Handle file selection - Auto upload
  const handleFileSelect = async (contractId, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please select a valid image file (JPEG, PNG, GIF, WEBP, SVG)');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setPreviewUrls(prev => ({ ...prev, [contractId]: previewUrl }));

    // Upload immediately
    try {
      setUploadingImages(prev => ({ ...prev, [contractId]: true }));

      const result = await betSyncAPI.uploadBetImage(contractId, file);

      // Update local state with new image URL
      setDbBets(dbBets.map(bet =>
        bet.contractId === contractId
          ? { ...bet, imageUrl: result.imageUrl }
          : bet
      ));

      // Clear preview after successful upload
      setTimeout(() => {
        if (previewUrls[contractId]) {
          URL.revokeObjectURL(previewUrls[contractId]);
        }
        setPreviewUrls(prev => {
          const newUrls = { ...prev };
          delete newUrls[contractId];
          return newUrls;
        });
      }, 1000);

      toast.success('Image uploaded successfully!', {
        icon: '🎉',
        duration: 3000,
        style: {
          background: '#10b981',
          color: '#fff',
          fontWeight: '500',
        },
      });
    } catch (error) {
      // Revert preview on error
      if (previewUrls[contractId]) {
        URL.revokeObjectURL(previewUrls[contractId]);
      }
      setPreviewUrls(prev => {
        const newUrls = { ...prev };
        delete newUrls[contractId];
        return newUrls;
      });

      toast.error(error.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploadingImages(prev => ({ ...prev, [contractId]: false }));
    }
  };

  // Handle image upload
  const handleUploadImage = async (contractId) => {
    const file = selectedFiles[contractId];
    if (!file) {
      toast.error('Please select an image first');
      return;
    }

    try {
      setUploadingImages(prev => ({ ...prev, [contractId]: true }));

      const result = await betSyncAPI.uploadBetImage(contractId, file);

      console.log('Upload result:', result);
      console.log('Image URL from backend:', result.imageUrl);

      // Backend returns relative path: /uploads/bet-images/filename.webp
      // Update local state with new image URL
      setDbBets(dbBets.map(bet =>
        bet.contractId === contractId
          ? { ...bet, imageUrl: result.imageUrl }
          : bet
      ));

      // Clear selection and preview
      setSelectedFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[contractId];
        return newFiles;
      });

      if (previewUrls[contractId]) {
        URL.revokeObjectURL(previewUrls[contractId]);
      }

      setPreviewUrls(prev => {
        const newUrls = { ...prev };
        delete newUrls[contractId];
        return newUrls;
      });

      toast.success('Image uploaded successfully!', {
        icon: '🎉',
        duration: 3000,
        style: {
          background: '#10b981',
          color: '#fff',
          fontWeight: '500',
        },
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploadingImages(prev => ({ ...prev, [contractId]: false }));
    }
  };

  // Cancel file selection
  const handleCancelFileSelection = (contractId) => {
    if (previewUrls[contractId]) {
      URL.revokeObjectURL(previewUrls[contractId]);
    }

    setSelectedFiles(prev => {
      const newFiles = { ...prev };
      delete newFiles[contractId];
      return newFiles;
    });

    setPreviewUrls(prev => {
      const newUrls = { ...prev };
      delete newUrls[contractId];
      return newUrls;
    });
  };

  // Get filtered and sorted bets
  const getFilteredAndSortedBets = () => {
    let filtered = [...dbBets];

    // Filter by category
    if (filterCategory) {
      filtered = filtered.filter(bet => bet.categoryId === filterCategory);
    }

    // Filter by status
    if (filterStatus === 'resolved') {
      filtered = filtered.filter(bet => bet.isResolved === true);
    } else if (filterStatus === 'active') {
      filtered = filtered.filter(bet => bet.isActive === true && bet.isResolved === false);
    } else if (filterStatus === 'ended') {
      filtered = filtered.filter(bet => bet.isActive === false && bet.isResolved === false);
    }

    // Sort
    filtered.sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'contractId':
          compareValue = a.contractId - b.contractId;
          break;
        case 'title':
          compareValue = (a.title || '').localeCompare(b.title || '');
          break;
        case 'endTime':
          compareValue = new Date(a.endTime) - new Date(b.endTime);
          break;
        case 'betType':
          compareValue = a.betType - b.betType;
          break;
        case 'category':
          const catA = categories.find(c => c._id === a.categoryId)?.name || '';
          const catB = categories.find(c => c._id === b.categoryId)?.name || '';
          compareValue = catA.localeCompare(catB);
          break;
        default:
          compareValue = 0;
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return filtered;
  };

  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  // Check USDC allowance
  const checkAllowance = async () => {
    if (!account) return;

    try {
      setCheckingAllowance(true);
      const networkConfig = getNetworkConfig(chainId);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const usdcAddress = networkConfig.contracts.USDC_TOKEN;
      const usdc = new ethers.Contract(
        usdcAddress,
        ['function allowance(address owner, address spender) view returns (uint256)'],
        signer
      );

      const currentAllowance = await usdc.allowance(account, networkConfig.contracts.BET_MARKET_CORE);
      const requiredAmount = ethers.parseUnits(newBet.liquidity, 6);

      setNeedsApproval(currentAllowance < requiredAmount);
    } catch (error) {
      console.error('Allowance check error:', error);
      setNeedsApproval(true); // Default to needing approval on error
    } finally {
      setCheckingAllowance(false);
    }
  };

  // Handle USDC Approval
  const handleApproveUSDC = async () => {
    if (!account) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      setApproving(true);
      const loadingToast = toast.loading('Approving USDC...');

      const networkConfig = getNetworkConfig(chainId);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const usdcAddress = networkConfig.contracts.USDC_TOKEN;
      const usdc = new ethers.Contract(
        usdcAddress,
        ['function approve(address spender, uint256 amount) returns (bool)'],
        signer
      );

      const approvalAmount = ethers.parseUnits(newBet.liquidity, 6);

      toast.loading('Please approve USDC in MetaMask...', { id: loadingToast });
      const approveTx = await usdc.approve(networkConfig.contracts.BET_MARKET_CORE, approvalAmount);

      toast.loading('Waiting for USDC approval...', { id: loadingToast });
      await approveTx.wait();

      toast.success('USDC approved successfully!', { id: loadingToast, duration: 3000 });

      // Recheck allowance
      await checkAllowance();
    } catch (error) {
      console.error('Approval error:', error);

      if (error.code === 'ACTION_REJECTED') {
        toast.error('Transaction rejected by user');
      } else {
        toast.error(error.reason || error.message || 'Failed to approve USDC');
      }
    } finally {
      setApproving(false);
    }
  };

  // Handle Create Bet (after approval)
  const handleCreateBet = async () => {
    // Validation
    if (!newBet.title.trim()) {
      toast.error('Please enter a bet title');
      return;
    }
    if (!newBet.description.trim()) {
      toast.error('Please enter a bet description');
      return;
    }
    if (!newBet.endTime) {
      toast.error('Please select an end time');
      return;
    }

    // Validate options
    const validOptions = newBet.options.filter(opt => opt.trim());
    if (validOptions.length < 2) {
      toast.error('Please provide at least 2 valid options');
      return;
    }

    if (!account) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      setCreating(true);
      const loadingToast = toast.loading('Creating bet on blockchain...');

      const networkConfig = getNetworkConfig(chainId);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Create bet
      const contract = new ethers.Contract(
        networkConfig.contracts.BET_MARKET_CORE,
        BetMarketCoreABI.abi,
        signer
      );

      const endTimeUnix = Math.floor(new Date(newBet.endTime).getTime() / 1000);

      toast.loading('Please confirm bet creation in MetaMask...', { id: loadingToast });
      const createTx = await contract.createBet(
        validOptions.length, // optionCount
        endTimeUnix, // endTime
        parseInt(newBet.betType), // betType
        ethers.parseUnits(newBet.minBet, 6), // minBet
        ethers.parseUnits(newBet.maxBet, 6), // maxBet
        parseInt(newBet.liquidity), // liquidity
        newBet.title, // title
        newBet.description, // description
        validOptions // options
      );

      toast.loading('Transaction submitted! Waiting for confirmation...', { id: loadingToast });
      const receipt = await createTx.wait();

      toast.success(`Bet created successfully! Gas used: ${receipt.gasUsed}`, {
        id: loadingToast,
        duration: 5000,
      });

      // Reset form and close modal
      setNewBet({
        betType: '0',
        title: '',
        description: '',
        options: ['Yes', 'No'],
        endTime: '',
        minBet: '1',
        maxBet: '1000',
        liquidity: '500',
        categoryId: ''
      });
      setShowCreateModal(false);

      // Auto-sync with retry mechanism
      const currentBetCount = dbBets.length;
      const targetCategoryId = newBet.categoryId;

      // Try to sync up to 3 times with increasing delays
      const trySyncWithRetry = async (attempt = 1, delay = 2000) => {
        await new Promise(resolve => setTimeout(resolve, delay));

        await handleSyncBets();

        // Check if new bet was added
        const updatedBets = await betSyncAPI.getAllBets();
        const newBetCount = updatedBets.data?.length || 0;

        if (newBetCount > currentBetCount) {
          // Success! New bet found
          if (targetCategoryId) {
            const latestBet = updatedBets.data[updatedBets.data.length - 1];
            if (latestBet) {
              await handleAssignCategory(latestBet.contractId, targetCategoryId);
            }
          }
          toast.success('Bet synced successfully!', { duration: 3000 });
        } else if (attempt < 3) {
          // Retry with longer delay
          toast.loading(`Waiting for blockchain sync... (attempt ${attempt + 1}/3)`, { duration: 2000 });
          await trySyncWithRetry(attempt + 1, delay + 1000);
        } else {
          // Give up after 3 attempts
          toast.error('Bet created but sync failed. Please click "Sync Bets" manually.', { duration: 5000 });
        }
      };

      trySyncWithRetry();

    } catch (error) {
      console.error('Create bet error:', error);

      if (error.code === 'ACTION_REJECTED') {
        toast.error('Transaction rejected by user');
      } else {
        toast.error(error.reason || error.message || 'Failed to create bet');
      }
    } finally {
      setCreating(false);
    }
  };

  // Add/Remove options
  const addOption = () => {
    setNewBet({ ...newBet, options: [...newBet.options, ''] });
  };

  const removeOption = (index) => {
    if (newBet.options.length <= 2) {
      toast.error('Minimum 2 options required');
      return;
    }
    const newOptions = newBet.options.filter((_, i) => i !== index);
    setNewBet({ ...newBet, options: newOptions });
  };

  const updateOption = (index, value) => {
    const newOptions = [...newBet.options];
    newOptions[index] = value;
    setNewBet({ ...newBet, options: newOptions });
  };

  const LoadingSkeleton = () => (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="h-5 bg-gray-200 rounded w-2/3 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-full mb-3"></div>
              <div className="flex items-center gap-4">
                <div className="h-3 bg-gray-200 rounded w-20"></div>
                <div className="h-3 bg-gray-200 rounded w-24"></div>
                <div className="h-3 bg-gray-200 rounded w-16"></div>
              </div>
            </div>
            <div className="h-10 bg-gray-200 rounded w-[180px] flex-shrink-0"></div>
          </div>
        </div>
      ))}
    </div>
  );

  const filteredBets = getFilteredAndSortedBets();

  return (
    <div className="space-y-4">
      {/* Compact Filter & Sync Bar */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          {/* Left: Filters */}
          <div className="flex items-center gap-4 flex-1">
            {/* Filter Label & Category Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Filter:</span>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 font-medium cursor-pointer hover:border-gray-400 transition-colors min-w-[140px]"
              >
                <option value="" className="text-gray-900">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id} className="text-gray-900">
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 font-medium cursor-pointer hover:border-gray-400 transition-colors min-w-[120px]"
              >
                <option value="" className="text-gray-900">All Status</option>
                <option value="active" className="text-gray-900">● Active</option>
                <option value="ended" className="text-gray-900">○ Ended</option>
                <option value="resolved" className="text-gray-900">✓ Resolved</option>
              </select>
            </div>

            {/* Inset Divider */}
            <div className="relative h-8 w-px">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-300 to-transparent"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-gray-200/50 via-transparent to-gray-200/50"></div>
            </div>

            {/* Sort Label & Sort By */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 font-medium cursor-pointer hover:border-gray-400 transition-colors"
              >
                <option value="contractId" className="text-gray-900">ID</option>
                <option value="title" className="text-gray-900">Name</option>
                <option value="endTime" className="text-gray-900">End Time</option>
                <option value="betType" className="text-gray-900">Type</option>
                <option value="category" className="text-gray-900">Category</option>
              </select>
            </div>

            {/* Sort Order Toggle */}
            <button
              onClick={toggleSortOrder}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-500 hover:text-gray-700"
              title={sortOrder === 'asc' ? 'Ascending (click to sort descending)' : 'Descending (click to sort ascending)'}
            >
              {sortOrder === 'asc' ? (
                <ArrowUp className="w-4 h-4" />
              ) : (
                <ArrowDown className="w-4 h-4" />
              )}
            </button>

            {/* Results Count */}
            <div className="flex items-center gap-3 ml-1">
              {/* Inset Divider */}
              <div className="relative h-8 w-px">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-300 to-transparent"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-gray-200/50 via-transparent to-gray-200/50"></div>
              </div>
              <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
                {filteredBets.length} bet{filteredBets.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Right: Create & Sync Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Bet
            </button>
            <button
              onClick={handleSyncBets}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Bets'}
            </button>
          </div>
        </div>

        {/* Sync Status (Compact) */}
        {syncStatus && (
          <div className={`${syncStatus.success ? 'bg-green-50 border-t border-green-200' : 'bg-red-50 border-t border-red-200'} px-4 py-2`}>
            <p className={`text-xs ${syncStatus.success ? 'text-green-800' : 'text-red-800'}`}>
              {syncStatus.message}
              {syncStatus.success && (
                <span className="ml-2 text-gray-600">
                  (✓ {syncStatus.synced} new, ↻ {syncStatus.updated} updated{syncStatus.failed > 0 && `, ✗ ${syncStatus.failed} failed`})
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {loadingDbBets ? (
        <LoadingSkeleton />
      ) : dbBets.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          No bets in database. Click "Sync Bets" to import from contract.
        </div>
      ) : filteredBets.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          No bets match your filters. Try adjusting the category filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBets.map((bet) => (
            <div
              key={bet.contractId}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                {/* Image Preview - Clickable */}
                <div className="flex-shrink-0">
                  <input
                    type="file"
                    id={`file-input-${bet.contractId}`}
                    accept="image/*"
                    onChange={(e) => handleFileSelect(bet.contractId, e)}
                    className="hidden"
                  />
                  {previewUrls[bet.contractId] || bet.imageUrl ? (
                    <label
                      htmlFor={`file-input-${bet.contractId}`}
                      className="relative group block cursor-pointer"
                      title="Click to change image"
                    >
                      <img
                        src={previewUrls[bet.contractId] || (bet.imageUrl?.startsWith('http') ? bet.imageUrl : `${BASE_URL}${bet.imageUrl}`)}
                        alt={bet.title}
                        className="w-24 h-24 object-cover rounded-lg shadow-sm group-hover:opacity-75 transition-opacity"
                        onError={(e) => {
                          console.error('Image load error for:', e.target.src);
                          e.target.onerror = null;
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = `<div class="w-24 h-24 bg-gradient-to-br from-red-100 to-red-200 rounded-lg flex items-center justify-center border-2 border-dashed border-red-300"><svg class="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`;
                        }}
                      />
                      {previewUrls[bet.contractId] && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                          <span className="text-white text-xs font-medium">Preview</span>
                        </div>
                      )}
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 rounded-lg flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100">
                        <div className="text-center">
                          <Upload className="w-6 h-6 text-white mx-auto mb-1" />
                          <span className="text-white text-xs font-medium">Change</span>
                        </div>
                      </div>
                    </label>
                  ) : (
                    <label
                      htmlFor={`file-input-${bet.contractId}`}
                      className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-200 cursor-pointer hover:border-blue-400 hover:from-blue-50 hover:to-blue-100 transition-all group"
                      title="Click to upload image"
                    >
                      <div className="text-center">
                        <Upload className="w-8 h-8 text-gray-400 group-hover:text-blue-500 mx-auto mb-1 transition-colors" />
                        <span className="text-xs text-gray-600 group-hover:text-blue-600 font-medium">Upload</span>
                      </div>
                    </label>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 mb-1 truncate">
                    #{bet.contractId} - {bet.title}
                  </h4>
                  <p className="text-sm text-gray-600 line-clamp-1 mb-2">{bet.description}</p>
                  <div className="flex items-center gap-4 mb-3 text-xs text-gray-600">
                    <span>Type: {['Binary', 'Multiple', 'Nested'][bet.betType]}</span>
                    {bet.options?.length > 0 && <span>Options: {bet.options.length}</span>}
                    <span className={bet.isActive ? 'text-green-600 font-medium' : 'text-gray-400'}>
                      {bet.isActive ? '● Active' : '○ Ended'}
                    </span>
                    {bet.isResolved && (
                      <span className="text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Resolved
                      </span>
                    )}
                  </div>

                  {/* Upload status indicator */}
                  {uploadingImages[bet.contractId] && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span className="text-sm text-blue-700 font-medium">Uploading image...</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {!bet.isResolved && (
                    <button
                      onClick={() => {
                        console.log('🔍 Bet data for resolve:', bet);
                        console.log('📊 Options:', bet.options);
                        console.log('👥 Total Participants:', bet.totalParticipants);
                        console.log('🎲 Total Bets:', bet.totalBets);
                        setResolvingBet(bet);
                        setSelectedWinner('');
                        setNestedOptionIndex('');
                        setNestedOutcome('');
                      }}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors border ${
                        bet.isActive
                          ? 'text-orange-600 hover:bg-orange-50 border-orange-300'
                          : 'text-green-600 hover:bg-green-50 border-green-300'
                      }`}
                      title={bet.isActive ? "Resolve Bet (Still Active)" : "Resolve Bet"}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  <select
                    value={bet.categoryId || ''}
                    onChange={(e) => handleAssignCategory(bet.contractId, e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[180px] bg-white text-gray-900"
                  >
                    <option value="">No Category</option>
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Edit Modal */}
      {editingImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative">
            {/* Close Button */}
            <button
              onClick={() => {
                setEditingImage(null);
                setImageUrl('');
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Edit Bet Image
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              #{editingImage.contractId} - {editingImage.title}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image URL
                </label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                />
              </div>

              {imageUrl && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preview
                  </label>
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-lg"
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/400x200?text=Invalid+URL'; }}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setEditingImage(null);
                  setImageUrl('');
                }}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateImage}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Bet Modal */}
      {resolvingBet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative">
            {/* Close Button */}
            <button
              onClick={() => {
                setResolvingBet(null);
                setSelectedWinner('');
                setNestedOptionIndex('');
                setNestedOutcome('');
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Resolve Bet
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              #{resolvingBet.contractId} - {resolvingBet.title}
            </p>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-yellow-800">
                <strong>Warning:</strong> This action is permanent and will trigger payouts to winners.
              </p>
            </div>

            <div className="space-y-4">
              {(!resolvingBet.options || resolvingBet.options.length === 0) && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-3 mb-4">
                  <p className="text-xs text-red-900 font-semibold mb-1">
                    ⚠️ No Options Found
                  </p>
                  <p className="text-xs text-red-800">
                    This bet has no options. Please sync the bet from the contract first or check the contract data.
                  </p>
                </div>
              )}

              {resolvingBet.betType === 2 ? (
                // Nested Bet UI
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Option
                    </label>
                    <select
                      value={nestedOptionIndex}
                      onChange={(e) => setNestedOptionIndex(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-gray-900"
                      disabled={!resolvingBet.options || resolvingBet.options.length === 0}
                    >
                      <option value="">-- Select Option --</option>
                      {resolvingBet.options?.map((option, idx) => (
                        <option key={idx} value={idx}>
                          Option {idx + 1}: {option.title || option.groupTitle || option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Outcome
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setNestedOutcome('0')}
                        className={`px-4 py-3 rounded-lg border-2 transition-all font-semibold ${
                          nestedOutcome === '0'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-green-400'
                        }`}
                      >
                        ✓ YES Wins
                      </button>
                      <button
                        onClick={() => setNestedOutcome('1')}
                        className={`px-4 py-3 rounded-lg border-2 transition-all font-semibold ${
                          nestedOutcome === '1'
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-red-400'
                        }`}
                      >
                        ✗ NO Wins
                      </button>
                    </div>
                  </div>

                  {nestedOptionIndex !== '' && nestedOutcome !== '' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-800">
                        <strong>You are resolving:</strong> Option {parseInt(nestedOptionIndex) + 1} - {nestedOutcome === '0' ? 'YES' : 'NO'} wins
                      </p>
                    </div>
                  )}
                </>
              ) : (
                // Regular Bet UI (Binary / Multiple Choice)
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Winning Option
                  </label>
                  <select
                    value={selectedWinner}
                    onChange={(e) => setSelectedWinner(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-gray-900"
                    disabled={!resolvingBet.options || resolvingBet.options.length === 0}
                  >
                    <option value="">-- Select Winner --</option>
                    {resolvingBet.options?.map((option, idx) => (
                      <option key={idx} value={idx}>
                        Option {idx + 1}: {option.title || option}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-2"><strong>Bet Details:</strong></p>
                <div className="space-y-1 text-xs text-gray-700">
                  <p>Type: {['Binary', 'Multiple Choice', 'Nested (Multi-Market)'][resolvingBet.betType]}</p>
                  <p>Total Bets Placed: {resolvingBet.totalBets || 0}</p>
                  <p>Options: {resolvingBet.options?.length || 0}</p>
                  <p>End Time: {new Date(resolvingBet.endTime).toLocaleString()}</p>
                  <p className="text-sm text-gray-600 mt-2">
                    {resolvingBet.isActive
                      ? '⚠️ Bet still active - resolving early'
                      : '✓ Bet ended - ready to resolve'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setResolvingBet(null);
                  setSelectedWinner('');
                  setNestedOptionIndex('');
                  setNestedOutcome('');
                }}
                disabled={resolving}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveBet}
                disabled={
                  resolving ||
                  !resolvingBet.options ||
                  resolvingBet.options.length === 0 ||
                  (resolvingBet.betType === 2 ? (nestedOptionIndex === '' || nestedOutcome === '') : selectedWinner === '')
                }
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resolving ? 'Resolving...' : 'Resolve Bet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Bet Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8 relative max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => {
                if (!creating) {
                  setShowCreateModal(false);
                  setNewBet({
                    betType: '0',
                    title: '',
                    description: '',
                    options: ['', ''],
                    endTime: '',
                    minBet: '1',
                    maxBet: '1000',
                    liquidity: '500',
                    categoryId: ''
                  });
                }
              }}
              disabled={creating}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Plus className="w-6 h-6 text-blue-600" />
              Create New Bet
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Create a new prediction market on the blockchain
            </p>

            <div className="space-y-5">
              {/* Bet Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Bet Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={newBet.betType}
                  onChange={(e) => setNewBet({ ...newBet, betType: e.target.value, options: e.target.value === '0' ? ['Yes', 'No'] : ['', ''] })}
                  disabled={creating}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                >
                  <option value="0">Binary (Yes/No)</option>
                  <option value="1">Multiple Choice</option>
                  <option value="2">Nested (Multi-Market)</option>
                </select>
                <p className="text-xs text-gray-600 mt-1">
                  {newBet.betType === '0' && 'Simple yes/no question with 2 outcomes'}
                  {newBet.betType === '1' && 'Multiple choice with one winning option'}
                  {newBet.betType === '2' && 'Each option has Yes/No sub-markets'}
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newBet.title}
                  onChange={(e) => setNewBet({ ...newBet, title: e.target.value })}
                  placeholder="e.g., Will Bitcoin reach $100k by end of 2025?"
                  disabled={creating}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newBet.description}
                  onChange={(e) => setNewBet({ ...newBet, description: e.target.value })}
                  placeholder="Provide details about the bet criteria and resolution conditions..."
                  disabled={creating}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                />
              </div>

              {/* Options */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Options <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {newBet.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Enter option ${index + 1}`}
                        disabled={creating || approving}
                        className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                      />
                      {newBet.betType !== '0' && newBet.options.length > 2 && (
                        <button
                          onClick={() => removeOption(index)}
                          disabled={creating || approving}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Remove option"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {newBet.betType !== '0' && (
                  <button
                    onClick={addOption}
                    disabled={creating || approving}
                    className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    Add Option
                  </button>
                )}
              </div>

              {/* Grid: End Time, Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={newBet.endTime}
                    onChange={(e) => setNewBet({ ...newBet, endTime: e.target.value })}
                    disabled={creating}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Category (Optional)
                  </label>
                  <select
                    value={newBet.categoryId}
                    onChange={(e) => setNewBet({ ...newBet, categoryId: e.target.value })}
                    disabled={creating}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  >
                    <option value="">No Category</option>
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grid: Min/Max Bet, Liquidity */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    Min Bet (USDC)
                  </label>
                  <input
                    type="number"
                    value={newBet.minBet}
                    onChange={(e) => setNewBet({ ...newBet, minBet: e.target.value })}
                    disabled={creating}
                    min="0.01"
                    step="0.01"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    Max Bet (USDC)
                  </label>
                  <input
                    type="number"
                    value={newBet.maxBet}
                    onChange={(e) => setNewBet({ ...newBet, maxBet: e.target.value })}
                    disabled={creating}
                    min="1"
                    step="1"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Hash className="w-4 h-4 inline mr-1" />
                    Liquidity
                  </label>
                  <input
                    type="number"
                    value={newBet.liquidity}
                    onChange={(e) => setNewBet({ ...newBet, liquidity: e.target.value })}
                    disabled={creating}
                    min="1"
                    step="1"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Initial pool size
                  </p>
                </div>
              </div>

              {/* Info Box */}
              {checkingAllowance ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-3">
                  <RefreshCw className="w-4 h-4 animate-spin text-gray-600" />
                  <p className="text-sm text-gray-700">
                    Checking USDC allowance...
                  </p>
                </div>
              ) : needsApproval ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-900">
                    <strong>⚠️ Approval Required:</strong> You need to approve {newBet.liquidity} USDC for the contract to spend before creating the bet.
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-900">
                    <strong>✓ Ready:</strong> USDC allowance approved. You can now create the bet.
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewBet({
                    betType: '0',
                    title: '',
                    description: '',
                    options: ['Yes', 'No'],
                    endTime: '',
                    minBet: '1',
                    maxBet: '1000',
                    liquidity: '500',
                    categoryId: ''
                  });
                  setNeedsApproval(false);
                }}
                disabled={creating || approving}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>

              {needsApproval ? (
                <button
                  onClick={handleApproveUSDC}
                  disabled={approving || checkingAllowance}
                  className="flex-1 px-4 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {approving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-4 h-4" />
                      Approve USDC
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleCreateBet}
                  disabled={creating || checkingAllowance || !newBet.title || !newBet.description || !newBet.endTime}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Bet
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BetCategoryAssignment;
