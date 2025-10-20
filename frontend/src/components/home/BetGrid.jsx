import React, { useState, useEffect, useCallback, useMemo } from 'react';
import BetCard from './BetCard';
import { useContractBets } from '../../hooks/useContractBets';
import { useWallet } from '../../hooks/useWallet';
import { Loader2, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import betSyncAPI from '../../services/betSyncAPI';

const ITEMS_PER_PAGE = 16; // Items per page

const BetGrid = ({ filter = 'all', categoryId = null, searchQuery = '' }) => {
  const [bookmarkedBets, setBookmarkedBets] = useState(new Set());
  const [categoryBetIds, setCategoryBetIds] = useState([]);
  const [loadingCategoryBets, setLoadingCategoryBets] = useState(false);
  const [dbBets, setDbBets] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('newest');
  const { chainId } = useWallet();

  // Debug: Log wallet connection
  console.log('🔌 BetGrid - Wallet ChainId:', chainId);

  // Default to Sepolia if wallet not connected (11155111 in decimal)
  const effectiveChainId = chainId || 11155111;

  // Fetch ALL bets directly from contract
  const { bets: contractBets, loading: isLoading, error } = useContractBets(effectiveChainId);

  // Fetch DB bets to get imageUrls and other metadata
  useEffect(() => {
    const fetchDbBets = async () => {
      try {
        const response = await betSyncAPI.getAllBets({ limit: 1000 });
        setDbBets(response.data || []);
      } catch (error) {
        console.error('Error fetching DB bets:', error);
      }
    };
    fetchDbBets();
  }, []);

  // Merge contract bets with DB metadata (imageUrl, category, etc.)
  const mergedBets = useMemo(() => {
    return contractBets.map(contractBet => {
      const dbBet = dbBets.find(db => db.contractId === contractBet.contractId);
      return {
        ...contractBet,
        imageUrl: dbBet?.imageUrl || contractBet.imageUrl,
        categoryId: dbBet?.categoryId || contractBet.categoryId,
        category: dbBet?.category || contractBet.category,
      };
    });
  }, [contractBets, dbBets]);

  // Load bookmarked bets from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('bookmarkedBets');
    if (saved) {
      setBookmarkedBets(new Set(JSON.parse(saved)));
    }
  }, []);

  // Fetch bets for selected category
  useEffect(() => {
    const fetchCategoryBets = async () => {
      if (!categoryId) {
        setCategoryBetIds([]);
        return;
      }

      try {
        setLoadingCategoryBets(true);
        const response = await betSyncAPI.getBetsByCategory(categoryId);
        const bets = response.data || [];
        // Extract contractIds from DB bets
        const betIds = bets.map(bet => bet.contractId);
        setCategoryBetIds(betIds);
      } catch (error) {
        console.error('Error fetching category bets:', error);
        setCategoryBetIds([]);
      } finally {
        setLoadingCategoryBets(false);
      }
    };

    fetchCategoryBets();
  }, [categoryId]);

  // Filter and sort bets client-side
  const filteredBets = useMemo(() => {
    let filtered = [...mergedBets];

    // Apply category filter first
    if (categoryId && categoryBetIds.length > 0) {
      filtered = filtered.filter(bet => categoryBetIds.includes(bet.contractId));
    }

    // Apply search filter
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(bet =>
        bet.title?.toLowerCase().includes(query) ||
        bet.description?.toLowerCase().includes(query)
      );
    }

    // Apply filter type
    if (filter === 'bookmarked') {
      filtered = filtered.filter(bet => bookmarkedBets.has(bet.id));
    } else if (filter === 'ending-soon') {
      const oneDayFromNow = Date.now() + 24 * 60 * 60 * 1000;
      filtered = filtered.filter(bet => bet.endTime && bet.endTime <= oneDayFromNow);
    } else if (filter === 'new') {
      // Sort by creation date (newest first) - approximate by contractId
      filtered.sort((a, b) => b.contractId - a.contractId);
    } else if (filter === 'trending') {
      // Sort by volume (highest first)
      filtered.sort((a, b) => (b.volume || 0) - (a.volume || 0));
    }

    // Apply custom sorting
    if (sortBy === 'newest') {
      filtered.sort((a, b) => b.contractId - a.contractId);
    } else if (sortBy === 'oldest') {
      filtered.sort((a, b) => a.contractId - b.contractId);
    } else if (sortBy === 'volume-high') {
      filtered.sort((a, b) => (b.volume || 0) - (a.volume || 0));
    } else if (sortBy === 'volume-low') {
      filtered.sort((a, b) => (a.volume || 0) - (b.volume || 0));
    } else if (sortBy === 'ending-soon') {
      filtered.sort((a, b) => (a.endTime || Infinity) - (b.endTime || Infinity));
    } else if (sortBy === 'ending-later') {
      filtered.sort((a, b) => (b.endTime || 0) - (a.endTime || 0));
    }

    return filtered;
  }, [mergedBets, filter, searchQuery, bookmarkedBets, categoryId, categoryBetIds, sortBy]);

  // Reset page when filter/search/sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery, categoryId, sortBy]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredBets.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedBets = filteredBets.slice(startIndex, endIndex);

  // Debug pagination
  console.log('📊 BetGrid Pagination Debug:', {
    contractBetsCount: contractBets.length,
    dbBetsCount: dbBets.length,
    mergedBetsCount: mergedBets.length,
    filteredBetsCount: filteredBets.length,
    totalPages,
    currentPage,
    startIndex,
    endIndex,
    paginatedBetsCount: paginatedBets.length,
    itemsPerPage: ITEMS_PER_PAGE
  });

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBookmark = useCallback((betId) => {
    setBookmarkedBets(prev => {
      const newBookmarks = new Set(prev);
      if (newBookmarks.has(betId)) {
        newBookmarks.delete(betId);
      } else {
        newBookmarks.add(betId);
      }

      // Save to localStorage
      localStorage.setItem('bookmarkedBets', JSON.stringify([...newBookmarks]));
      return newBookmarks;
    });
  }, []);

  const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 animate-pulse">
          <div className="aspect-video w-full mb-3 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
            </div>
            <div className="flex justify-between">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  if (isLoading || loadingCategoryBets) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <TrendingUp className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Failed to load markets
        </h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          Could not fetch markets from blockchain. Please try again later.
        </p>
      </div>
    );
  }

  if (filteredBets.length === 0) {
    return (
      <div className="text-center py-12">
        <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No markets found
        </h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          {searchQuery
            ? `No markets match "${searchQuery}". Try different keywords.`
            : filter === 'bookmarked'
            ? "You haven't bookmarked any markets yet. Click the bookmark icon on markets you're interested in."
            : "No markets available at the moment. Check back later for new betting opportunities."
          }
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Results info */}
      {searchQuery && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Found {filteredBets.length} market{filteredBets.length !== 1 ? 's' : ''} for "{searchQuery}"
        </div>
      )}

      {/* Bookmarked section - Disabled for now */}

      {/* All bets grid */}
      <div className="space-y-4">
        {!searchQuery && (
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 m-0">
              {filter === 'trending' ? 'Trending Markets' :
               filter === 'new' ? 'New Markets' :
               filter === 'ending-soon' ? 'Ending Soon' :
               filter === 'bookmarked' ? 'Bookmarked Markets' :
               categoryId ? 'Category Markets' :
               'All Markets'}
            </h2>

            {/* Sort dropdown */}
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="volume-high">Highest Volume</option>
                <option value="volume-low">Lowest Volume</option>
                <option value="ending-soon">Ending Soonest</option>
                <option value="ending-later">Ending Latest</option>
              </select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {paginatedBets.map((bet) => (
            <BetCard
              key={bet.id}
              bet={bet}
              isBookmarked={bookmarkedBets.has(bet.id)}
              onBookmark={handleBookmark}
            />
          ))}
        </div>
      </div>

      {/* Pagination - Always show */}
      <div className="flex items-center justify-center gap-2 mt-6">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1">
          {[...Array(totalPages)].map((_, i) => {
            const page = i + 1;

            // Show first page, last page, current page, and pages around current
            const showPage =
              page === 1 ||
              page === totalPages ||
              (page >= currentPage - 1 && page <= currentPage + 1);

            // Show ellipsis
            const showEllipsis =
              (page === 2 && currentPage > 3) ||
              (page === totalPages - 1 && currentPage < totalPages - 2);

            if (!showPage && !showEllipsis) return null;

            if (showEllipsis) {
              return (
                <span key={page} className="px-2 py-1.5 text-sm text-gray-400 dark:text-gray-500">
                  ...
                </span>
              );
            }

            return (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`min-w-[36px] px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Page info */}
      {filteredBets.length > 0 && (
        <div className="text-center py-4 text-sm text-gray-600 dark:text-gray-400">
          Showing {startIndex + 1}-{Math.min(endIndex, filteredBets.length)} of {filteredBets.length} market{filteredBets.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default BetGrid;