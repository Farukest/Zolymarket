import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

// Currency formatter
export const formatUSD = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// Compact currency formatter
export const formatCompactUSD = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(amount);
};

// Volume formatter
export const formatVolume = (volume) => {
  if (volume >= 1000000) {
    return `$${(volume / 1000000).toFixed(1)}M`;
  } else if (volume >= 1000) {
    return `$${(volume / 1000).toFixed(0)}k`;
  }
  return `$${volume}`;
};

// Date formatters
export const formatDate = (date, formatString = 'MMM d, yyyy') => {
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return isValid(parsedDate) ? format(parsedDate, formatString) : 'Invalid date';
};

export const formatDateTime = (date) => {
  return formatDate(date, 'MMM d, yyyy h:mm a');
};

export const formatTimeAgo = (date) => {
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return isValid(parsedDate) ? formatDistanceToNow(parsedDate, { addSuffix: true }) : 'Invalid date';
};

// Percentage formatter
export const formatPercent = (value, decimals = 1) => {
  return `${Number(value || 0).toFixed(decimals)}%`;
};

// Number formatters
export const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

export const formatCompactNumber = (num) => {
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toString();
};

// Bet price formatters
export const formatPrice = (price) => {
  if (!price && price !== 0) return '0¢';

  // Round to 1 decimal place and remove unnecessary .0
  const rounded = Math.round((price * 10)) / 10;
  const formatted = rounded % 1 === 0 ? Math.round(rounded) : rounded.toFixed(1);

  return `${formatted}¢`;
};

export const formatOdds = (price) => {
  if (!price || price === 0) return 'N/A';
  if (price >= 99) return '99+:1';
  
  const decimal = 100 / price;
  const odds = decimal - 1;
  
  if (odds < 1) return `1:${(1/odds).toFixed(1)}`;
  return `${odds.toFixed(1)}:1`;
};

// Address formatter
export const formatAddress = (address, length = 6) => {
  if (!address) return '';
  return `${address.slice(0, length)}...${address.slice(-4)}`;
};

// Transaction hash formatter
export const formatTxHash = (hash) => {
  if (!hash) return '';
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
};

// Time remaining formatter
export const formatTimeRemaining = (endTime) => {
  const now = new Date();
  const end = new Date(endTime);
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) return 'Ended';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

// File size formatter
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Bet status formatter
export const formatBetStatus = (bet) => {
  if (bet.isResolved) return 'Resolved';
  if (new Date() > new Date(bet.endTime)) return 'Ended';
  if (bet.isActive) return 'Active';
  return 'Inactive';
};

// Category level formatter
export const formatCategoryLevel = (level) => {
  const levels = ['Top', 'Sub', 'Sub-sub'];
  return levels[level] || `Level ${level}`;
};

// Error message formatter
export const formatErrorMessage = (error) => {
  if (!error) return 'Unknown error';
  
  if (typeof error === 'string') return error;
  
  if (error.message) {
    // Clean up common error messages
    let message = error.message;
    
    // Remove technical prefixes
    message = message.replace(/^Error:\s*/, '');
    message = message.replace(/^execution reverted:\s*/i, '');
    
    // Handle specific cases
    if (message.includes('user rejected')) {
      return 'Transaction was cancelled';
    }
    if (message.includes('insufficient funds')) {
      return 'Insufficient funds for transaction';
    }
    if (message.includes('network')) {
      return 'Network error. Please try again.';
    }
    
    return message;
  }
  
  return 'An unexpected error occurred';
};