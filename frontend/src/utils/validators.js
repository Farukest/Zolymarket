import { ethers } from 'ethers';

// Wallet address validation
export const validateWalletAddress = (address) => {
  if (!address) return 'Wallet address is required';
  
  try {
    if (!ethers.isAddress(address)) {
      return 'Invalid wallet address format';
    }
  } catch {
    return 'Invalid wallet address';
  }
  
  return null;
};

// Email validation
export const validateEmail = (email) => {
  if (!email) return 'Email is required';
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Invalid email format';
  }
  
  return null;
};

// Bet amount validation
export const validateBetAmount = (amount, balance = Infinity) => {
  if (!amount) return 'Amount is required';
  
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) return 'Amount must be a number';
  if (numAmount <= 0) return 'Amount must be greater than 0';
  if (numAmount < 0.01) return 'Minimum bet amount is $0.01';
  if (numAmount > 10000) return 'Maximum bet amount is $10,000';
  if (numAmount > balance) return 'Insufficient balance';
  
  return null;
};

// URL validation
export const validateURL = (url) => {
  if (!url) return null; // Optional field
  
  try {
    new URL(url);
    return null;
  } catch {
    return 'Invalid URL format';
  }
};

// Category name validation
export const validateCategoryName = (name) => {
  if (!name) return 'Category name is required';
  if (name.length < 2) return 'Category name must be at least 2 characters';
  if (name.length > 100) return 'Category name cannot exceed 100 characters';
  
  return null;
};

// Bet title validation
export const validateBetTitle = (title) => {
  if (!title) return 'Bet title is required';
  if (title.length < 5) return 'Bet title must be at least 5 characters';
  if (title.length > 200) return 'Bet title cannot exceed 200 characters';
  
  return null;
};

// Bet description validation
export const validateBetDescription = (description) => {
  if (!description) return null; // Optional field
  if (description.length > 2000) return 'Description cannot exceed 2000 characters';
  
  return null;
};

// Date validation
export const validateDate = (date, isFuture = false) => {
  if (!date) return 'Date is required';
  
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return 'Invalid date format';
  
  if (isFuture && parsedDate <= new Date()) {
    return 'Date must be in the future';
  }
  
  return null;
};

// Date range validation
export const validateDateRange = (startDate, endDate) => {
  const startError = validateDate(startDate);
  if (startError) return startError;
  
  const endError = validateDate(endDate);
  if (endError) return endError;
  
  if (new Date(startDate) >= new Date(endDate)) {
    return 'End date must be after start date';
  }
  
  return null;
};

// Password validation
export const validatePassword = (password) => {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/(?=.*[a-z])/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/(?=.*[A-Z])/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/(?=.*\d)/.test(password)) return 'Password must contain at least one number';
  
  return null;
};

// Display name validation
export const validateDisplayName = (name) => {
  if (!name) return null; // Optional field
  if (name.length < 2) return 'Display name must be at least 2 characters';
  if (name.length > 50) return 'Display name cannot exceed 50 characters';
  if (!/^[a-zA-Z0-9\s._-]+$/.test(name)) return 'Display name contains invalid characters';
  
  return null;
};

// Bio validation
export const validateBio = (bio) => {
  if (!bio) return null; // Optional field
  if (bio.length > 500) return 'Bio cannot exceed 500 characters';
  
  return null;
};

// Search query validation
export const validateSearchQuery = (query) => {
  if (!query) return 'Search query is required';
  if (query.length < 2) return 'Search query must be at least 2 characters';
  if (query.length > 100) return 'Search query cannot exceed 100 characters';
  
  return null;
};

// Bet options validation
export const validateBetOptions = (options, betType) => {
  if (!options || !Array.isArray(options)) return 'Bet options are required';
  if (options.length < 2) return 'At least 2 options are required';
  
  // Validate based on bet type
  switch (betType) {
    case 2: // Binary
      if (options.length !== 2) return 'Binary bets must have exactly 2 options';
      break;
    case 3: // Sports
      if (options.length !== 3) return 'Sports bets must have exactly 3 options';
      break;
    case 1: // Multiple choice
      if (options.length > 10) return 'Maximum 10 options allowed';
      break;
    default:
      return 'Invalid bet type';
  }
  
  // Validate each option
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    const title = typeof option === 'string' ? option : option.title;
    
    if (!title) return `Option ${i + 1} title is required`;
    if (title.length < 1) return `Option ${i + 1} title cannot be empty`;
    if (title.length > 200) return `Option ${i + 1} title cannot exceed 200 characters`;
  }
  
  // Check for duplicate options
  const titles = options.map(opt => (typeof opt === 'string' ? opt : opt.title).toLowerCase());
  const uniqueTitles = new Set(titles);
  if (uniqueTitles.size !== titles.length) {
    return 'Duplicate options are not allowed';
  }
  
  return null;
};

// File validation
export const validateImageFile = (file) => {
  if (!file) return 'File is required';
  
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.';
  }
  
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return 'File size too large. Maximum 5MB allowed.';
  }
  
  return null;
};

// Form validation helper
export const validateForm = (data, rules) => {
  const errors = {};
  
  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];
    const error = rule(value);
    if (error) {
      errors[field] = error;
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Required field validation
export const required = (fieldName) => (value) => {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return `${fieldName} is required`;
  }
  return null;
};

// Min length validation
export const minLength = (min, fieldName) => (value) => {
  if (value && value.length < min) {
    return `${fieldName} must be at least ${min} characters`;
  }
  return null;
};

// Max length validation
export const maxLength = (max, fieldName) => (value) => {
  if (value && value.length > max) {
    return `${fieldName} cannot exceed ${max} characters`;
  }
  return null;
};

// Combine validators
export const combine = (...validators) => (value) => {
  for (const validator of validators) {
    const error = validator(value);
    if (error) return error;
  }
  return null;
};