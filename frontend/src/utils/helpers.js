import { ethers } from 'ethers';

// Format wallet address for display
export const formatAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Format large numbers
export const formatNumber = (num) => {
  if (!num) return '0';
  
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  
  return num.toLocaleString();
};

// Format currency
export const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// Format percentage
export const formatPercentage = (value, decimals = 1) => {
  return `${Number(value).toFixed(decimals)}%`;
};

// Calculate time remaining
export const getTimeRemaining = (endTime) => {
  const now = new Date().getTime();
  const end = new Date(endTime).getTime();
  const diff = end - now;

  if (diff <= 0) return 'Ended';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

// Validate email
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate wallet address
export const isValidAddress = (address) => {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
};

// Debounce function
export const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

// Copy to clipboard
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  }
};

// Generate random ID
export const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};

// Sleep function
export const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Check if mobile device
export const isMobile = () => {
  return window.innerWidth <= 768;
};

// Format date relative to now
export const formatRelativeTime = (date) => {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now - target;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  
  return target.toLocaleDateString();
};

// Truncate text
export const truncateText = (text, maxLength = 100) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

// Calculate price from percentage
export const calculatePrice = (percentage) => {
  return Math.round(percentage);
};

// Calculate odds from price
export const calculateOdds = (price) => {
  if (price === 0) return 'N/A';
  if (price === 100) return '1:∞';
  
  const decimal = 100 / price;
  return `1:${(decimal - 1).toFixed(2)}`;
};

// Parse error message
export const parseErrorMessage = (error) => {
  if (typeof error === 'string') return error;
  
  if (error?.message) {
    // Handle common error patterns
    if (error.message.includes('user rejected')) {
      return 'Transaction cancelled by user';
    }
    if (error.message.includes('insufficient funds')) {
      return 'Insufficient funds for transaction';
    }
    if (error.message.includes('revert')) {
      return 'Transaction failed. Please check your input.';
    }
    return error.message;
  }
  
  if (error?.reason) return error.reason;
  
  return 'An unexpected error occurred';
};

// Validate bet amount
export const validateBetAmount = (amount, minAmount = 0.01, maxAmount = 10000) => {
  const numAmount = parseFloat(amount);
  
  if (isNaN(numAmount)) return 'Invalid amount';
  if (numAmount < minAmount) return `Minimum bet is $${minAmount}`;
  if (numAmount > maxAmount) return `Maximum bet is $${maxAmount}`;
  
  return null; // Valid
};

// Format bet type
export const formatBetType = (type) => {
  const types = {
    1: 'Multiple Choice',
    2: 'Binary',
    3: 'Sports'
  };
  return types[type] || 'Unknown';
};