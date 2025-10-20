import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Clock, TrendingUp, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { BASE_URL } from '../../services/betSyncAPI';

const BetCard = ({ bet, isBookmarked, onBookmark }) => {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);

  // Debug: Log image info
  if (bet.imageUrl) {
    console.log('BetCard image:', {
      title: bet.title,
      imageUrl: bet.imageUrl,
      finalUrl: bet.imageUrl?.startsWith('http') ? bet.imageUrl : `${BASE_URL}${bet.imageUrl}`
    });
  }

  const handleCardClick = (e) => {
    // Don't navigate if clicking bookmark button or option buttons
    if (e.target.closest('.bookmark-btn') || e.target.closest('.option-btn')) return;

    // Use contractId for blockchain lookups, fallback to _id for MongoDB-only bets
    const betId = bet.contractId || bet.id || bet._id;
    console.log('BetCard click - bet object:', bet);
    console.log('BetCard click - using contractId:', betId);

    if (betId) {
      navigate(`/bet/${betId}`);
    } else {
      console.error('No valid ID found for bet:', bet);
    }
  };

  const handleBookmarkClick = (e) => {
    e.stopPropagation();
    onBookmark(bet._id || bet.id);
  };

  const formatPercentage = (price) => {
    return `${Math.round(price)}%`;
  };

  const formatVolume = (volume) => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(0)}k`;
    }
    return `$${volume}`;
  };

  const isLive = bet.mustShowLive &&
    bet.liveStartTime && bet.liveEndTime &&
    Date.now() >= new Date(bet.liveStartTime).getTime() &&
    Date.now() <= new Date(bet.liveEndTime).getTime();

  const timeToEnd = bet.endTime ? formatDistanceToNow(new Date(bet.endTime), { addSuffix: true }) : 'No end time';

  // Helper function to get option title - handle nested groups
  const getOptionTitle = (option) => {
    if (typeof option === 'string') return option;
    if (!option || typeof option !== 'object') return '';

    // For nested group structure (Real Madrid bet style)
    if (option.groupId && option.groupTitle) {
      // This is a group - return group title
      return option.groupTitle;
    }

    // If it has nested options, get the first option's title as representative
    if (option.options && Array.isArray(option.options) && option.options.length > 0) {
      const firstNestedOption = option.options[0];
      return `${option.groupTitle || 'Group'}: ${firstNestedOption.title || 'Option'}`;
    }

    // Standard option with title
    if (option.title) return option.title;
    if (option.name) return option.name;

    // Fallback: Convert object like {0: 'Y', 1: 'e', 2: 's'} to "Yes"
    const keys = Object.keys(option).filter(key => !isNaN(key)).sort((a, b) => Number(a) - Number(b));
    if (keys.length > 0) {
      return keys.map(key => option[key]).join('');
    }

    return 'Option';
  };

  // Render different bet types - Zolymarket style
  const renderBetContent = () => {
    // If no options, show placeholder
    if (!bet.options || bet.options.length === 0) {
      return (
        <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
          No options available
        </div>
      );
    }

    const betType = Number(bet.betType);

    // NESTED bet type (betType = 2) - Each option has Yes/No
    if (betType === 2) {
      const liquidityParam = bet.liquidityParam || 100;
      const liquidityPerOutcome = liquidityParam / 2;

      return (
        <div className="space-y-2.5">
          {bet.options?.slice(0, 3).map((option, index) => {
            const optionText = getOptionTitle(option);

            // ⭐ PARIMUTUEL CALCULATION for NESTED (with liquidity)
            const yesShares = (option.yesShares || 0) + liquidityPerOutcome;
            const noShares = (option.noShares || 0) + liquidityPerOutcome;
            const totalShares = yesShares + noShares;

            const yesPrice = totalShares > 0 ? Math.max(0.1, Math.min(99.9, (yesShares / totalShares) * 100)) : 50;
            const noPrice = Number((100 - yesPrice).toFixed(1));

            return (
              <div key={index} className="flex items-center justify-between gap-2">
                <span className="text-sm-custom font-medium text-gray-800 dark:text-gray-200 flex-1 truncate">
                  {optionText || `Option ${index + 1}`}
                </span>
                <div className="flex gap-1.5">
                  <button className="option-btn px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded text-emerald-700 dark:text-emerald-400 font-semibold text-xs transition-colors min-w-[60px]">
                    Yes {formatPercentage(yesPrice)}
                  </button>
                  <button className="option-btn px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded text-rose-700 dark:text-rose-400 font-semibold text-xs transition-colors min-w-[60px]">
                    No {formatPercentage(noPrice)}
                  </button>
                </div>
              </div>
            );
          })}
          {bet.options?.length > 3 && (
            <div className="text-center text-xs text-gray-500 dark:text-gray-400 pt-1">
              +{bet.options.length - 3} more
            </div>
          )}
        </div>
      );
    }

    // BINARY (betType = 0) - Simple Yes/No - Zolymarket style large buttons
    if (betType === 0 && bet.options.length === 2) {
      const yesOption = bet.options[0];
      const noOption = bet.options[1];
      const yesText = getOptionTitle(yesOption);
      const noText = getOptionTitle(noOption);

      // ⭐ PARIMUTUEL CALCULATION for BINARY (with liquidity)
      const liquidityParam = bet.liquidityParam || 100;
      const liquidityPerOption = liquidityParam / bet.options.length;

      const yesSharesWithLiquidity = (yesOption.totalShares || 0) + liquidityPerOption;
      const noSharesWithLiquidity = (noOption.totalShares || 0) + liquidityPerOption;
      const totalShares = yesSharesWithLiquidity + noSharesWithLiquidity;

      const yesPrice = totalShares > 0 ? Math.max(0.1, Math.min(99.9, (yesSharesWithLiquidity / totalShares) * 100)) : 50;
      const noPrice = totalShares > 0 ? Math.max(0.1, Math.min(99.9, (noSharesWithLiquidity / totalShares) * 100)) : 50;

      return (
        <div className="flex gap-2">
          <button className="option-btn flex-1 px-6 py-4 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors group">
            <div className="flex flex-col items-center gap-1">
              <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xl">
                {formatPercentage(yesPrice)}
              </span>
              <span className="text-emerald-600 dark:text-emerald-500 text-xs font-medium">
                {yesText || 'Yes'}
              </span>
            </div>
          </button>
          <button className="option-btn flex-1 px-6 py-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-lg transition-colors group">
            <div className="flex flex-col items-center gap-1">
              <span className="text-rose-700 dark:text-rose-400 font-bold text-xl">
                {formatPercentage(noPrice)}
              </span>
              <span className="text-rose-600 dark:text-rose-500 text-xs font-medium">
                {noText || 'No'}
              </span>
            </div>
          </button>
        </div>
      );
    }

    // MULTIPLE CHOICE (betType = 1) - Multiple options
    if (betType === 1) {
      // ⭐ PARIMUTUEL CALCULATION (with liquidity)
      const liquidityParam = bet.liquidityParam || 100;
      const liquidityPerOption = liquidityParam / bet.options.length;

      const totalShares = bet.options.reduce((sum, opt) => {
        return sum + (opt.totalShares || 0) + liquidityPerOption;
      }, 0);

      return (
        <div className="space-y-1.5">
          {bet.options?.slice(0, 3).map((option, index) => {
            const optionText = getOptionTitle(option);

            // ⭐ PARIMUTUEL: Each option's probability with liquidity
            const optionSharesWithLiquidity = (option.totalShares || 0) + liquidityPerOption;
            const price = totalShares > 0
              ? Math.max(0.1, Math.min(99.9, (optionSharesWithLiquidity / totalShares) * 100))
              : 100 / bet.options.length;

            return (
              <button
                key={index}
                className="option-btn w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750 rounded-lg transition-colors group"
              >
                <span className="text-sm-custom font-medium text-gray-800 dark:text-gray-200 truncate flex-1 text-left">
                  {optionText || `Option ${index + 1}`}
                </span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 ml-2">
                  {formatPercentage(price)}
                </span>
              </button>
            );
          })}
          {bet.options?.length > 3 && (
            <div className="text-center text-xs text-gray-500 dark:text-gray-400 pt-1">
              +{bet.options.length - 3} more
            </div>
          )}
        </div>
      );
    }

    // Fallback
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
        Unknown bet type
      </div>
    );
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 cursor-pointer hover:shadow-lg dark:hover:shadow-gray-900/20 transition-all duration-200 relative group flex flex-col h-full"
      onClick={handleCardClick}
    >
      {/* Live indicator */}
      {isLive && (
        <div className="absolute top-3 left-3 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 z-10">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
          LIVE
        </div>
      )}

      {/* Bookmark button */}
      <button
        onClick={handleBookmarkClick}
        className="bookmark-btn absolute top-3 right-3 p-1.5 rounded-full bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 transition-colors opacity-0 group-hover:opacity-100 z-10"
      >
        {isBookmarked ? (
          <BookmarkCheck className="w-4 h-4 text-blue-600" />
        ) : (
          <Bookmark className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        )}
      </button>

      {/* Main content layout - Icon + Title on top, options below */}
      <div className="flex-1 flex flex-col">
        {/* Top: Icon + Title in horizontal row */}
        <div className="flex items-start gap-2.5 mb-3">
          {/* Icon (38x38) */}
          <div className="flex-shrink-0">
            <div className="w-[38px] h-[38px] bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              {!imageError && bet.imageUrl ? (
                <img
                  src={bet.imageUrl?.startsWith('http') ? bet.imageUrl : `${BASE_URL}${bet.imageUrl}`}
                  alt={bet.title}
                  className="w-full h-full object-cover rounded-lg"
                  onError={() => setImageError(true)}
                />
              ) : (
                <TrendingUp className="w-5 h-5 text-white" />
              )}
            </div>
          </div>

          {/* Title */}
          <h3 className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug tracking-wide">
            {bet.title}
          </h3>
        </div>

        {/* Bottom: Bet options */}
        <div className="flex-1">
          {renderBetContent()}
        </div>
      </div>

      {/* Footer - always at bottom */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-3 mt-3 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          {bet.volume > 0 ? (
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>{formatVolume(bet.volume)}</span>
            </div>
          ) : (
            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-medium">
              New
            </span>
          )}
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{timeToEnd}</span>
          </div>
        </div>

        {bet.category && (
          <span className="text-blue-600 dark:text-blue-400 font-medium text-[10px]">
            {bet.category.name}
          </span>
        )}
      </div>
    </motion.div>
  );
};

export default BetCard;