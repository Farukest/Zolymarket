import toast from 'react-hot-toast';

// Track recent toasts to prevent duplicates
const recentToasts = new Map();
const DUPLICATE_PREVENTION_TIME = 3000; // 3 seconds

/**
 * Debounced toast to prevent duplicate messages
 * @param {string} message - The message to display
 * @param {string} type - The type of toast (error, success, loading)
 * @param {object} options - Additional toast options
 */
export const debouncedToast = (message, type = 'error', options = {}) => {
  const now = Date.now();
  const key = `${type}:${message}`;

  // Check if same message was shown recently
  if (recentToasts.has(key)) {
    const lastShown = recentToasts.get(key);
    if (now - lastShown < DUPLICATE_PREVENTION_TIME) {
      return; // Skip showing duplicate toast
    }
  }

  // Update the timestamp for this message
  recentToasts.set(key, now);

  // Clean up old entries periodically
  if (recentToasts.size > 50) {
    cleanupOldToasts();
  }

  // Show the toast
  switch (type) {
    case 'success':
      return toast.success(message, options);
    case 'error':
      return toast.error(message, options);
    case 'loading':
      return toast.loading(message, options);
    default:
      return toast(message, options);
  }
};

/**
 * Clean up old toast entries to prevent memory leaks
 */
const cleanupOldToasts = () => {
  const now = Date.now();
  for (const [key, timestamp] of recentToasts.entries()) {
    if (now - timestamp > DUPLICATE_PREVENTION_TIME * 2) {
      recentToasts.delete(key);
    }
  }
};

/**
 * Network error toast with custom handling
 * @param {string} message - Optional custom message
 */
export const showNetworkError = (message = 'Network error - Please check your connection') => {
  debouncedToast(message, 'error', {
    duration: 5000,
    id: 'network-error', // Use fixed ID for network errors
  });
};

/**
 * Success toast
 * @param {string} message - Success message
 * @param {object} options - Additional options
 */
export const showSuccess = (message, options = {}) => {
  debouncedToast(message, 'success', options);
};

/**
 * Error toast
 * @param {string} message - Error message
 * @param {object} options - Additional options
 */
export const showError = (message, options = {}) => {
  debouncedToast(message, 'error', options);
};

/**
 * Loading toast
 * @param {string} message - Loading message
 * @param {object} options - Additional options
 */
export const showLoading = (message, options = {}) => {
  debouncedToast(message, 'loading', options);
};

/**
 * Clear all toasts
 */
export const clearAllToasts = () => {
  toast.dismiss();
  recentToasts.clear();
};