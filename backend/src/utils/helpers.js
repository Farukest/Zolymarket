const { ethers } = require('ethers');

// Format wallet address for display
const formatAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Validate wallet address
const isValidAddress = (address) => {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
};

// Format large numbers
const formatNumber = (num) => {
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toString();
};

// Calculate percentage
const calculatePercentage = (part, total) => {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
};

// Generate random string
const generateRandomString = (length = 8) => Math.random().toString(36).substring(2, length + 2);

// Delay function
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Check if date is in the future
const isFutureDate = (date) => new Date(date) > new Date();

// Format date for display
const formatDate = (date) => new Date(date).toLocaleDateString();

// Paginate results
const paginateResults = (results, page = 1, limit = 20) => {
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;

  return {
    results: results.slice(startIndex, endIndex),
    currentPage: page,
    totalPages: Math.ceil(results.length / limit),
    total: results.length,
    hasNext: endIndex < results.length,
    hasPrev: page > 1,
  };
};

module.exports = {
  formatAddress,
  isValidAddress,
  formatNumber,
  calculatePercentage,
  generateRandomString,
  delay,
  isFutureDate,
  formatDate,
  paginateResults,
};
