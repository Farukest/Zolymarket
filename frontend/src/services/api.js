import axios from 'axios';
import { showError, showNetworkError } from '../utils/toastUtils';
import { directDatabaseService } from './directDatabaseService';

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3002/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add timestamp to prevent caching
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now()
      };
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const { response } = error;

    // Handle different error status codes
    if (response) {
      const { status, data } = response;
      let errorMessage = data?.message || 'An error occurred';

      switch (status) {
        case 400:
          errorMessage = data?.message || 'Bad request';
          break;
        case 401:
          errorMessage = 'Unauthorized - Please connect your wallet';
          // Clear auth token if exists
          localStorage.removeItem('authToken');
          break;
        case 403:
          errorMessage = 'Access forbidden';
          break;
        case 404:
          errorMessage = 'Resource not found';
          break;
        case 429:
          errorMessage = 'Too many requests - Please wait a moment';
          break;
        case 500:
          errorMessage = 'Server error - Please try again later';
          break;
        default:
          errorMessage = `Error ${status}: ${errorMessage}`;
      }

      // Show toast notification for errors (except for optional resources)
      if (!error.config?.optional) {
        showError(errorMessage);
      }

      error.message = errorMessage;
    } else if (error.request) {
      // Network error
      const networkError = 'Network error - Please check your connection';
      if (!error.config?.optional) {
        showNetworkError(networkError);
      }
      error.message = networkError;
    } else {
      // Other error
      showError(error.message || 'An unexpected error occurred');
    }

    return Promise.reject(error);
  }
);

// Helper function to try API first, fallback to direct database
const tryApiWithFallback = async (apiCall, fallbackCall, fallbackName) => {
  try {
    console.log(`🌐 Trying API call...`);
    const response = await apiCall();
    console.log(`✅ API call successful`);
    return response;
  } catch (error) {
    console.log(`❌ API call failed, using ${fallbackName} fallback:`, error.message);
    const fallbackResult = await fallbackCall();
    console.log(`✅ ${fallbackName} fallback successful`);
    // Transform direct service result to match API response format
    return { data: fallbackResult };
  }
};

// API methods
export const apiMethods = {
  // Auth endpoints
  auth: {
    login: (walletAddress, signature) =>
      api.post('/auth/login', { walletAddress, signature }),

    logout: () =>
      api.post('/auth/logout'),

    verify: () =>
      api.get('/auth/verify'),
  },

  // Bet endpoints with FHEVM fallback
  bets: {
    getAll: (params) =>
      tryApiWithFallback(
        () => api.get('/bets', { params }),
        () => directDatabaseService.getBets(params),
        'FHEVM Database'
      ),

    getById: (id) =>
      tryApiWithFallback(
        () => api.get(`/bets/${id}`),
        () => directDatabaseService.getBet(id),
        'FHEVM Database'
      ),

    search: (query) =>
      api.get('/bets/search', { params: { q: query } }),

    place: (betId, data) =>
      api.post(`/bets/${betId}/place`, data),

    claim: (betId, data) =>
      api.post(`/bets/${betId}/claim`, data),

    getUserBets: (address) =>
      api.get(`/bets/user/${address}`),

    getByCategory: (categoryId) =>
      tryApiWithFallback(
        () => api.get(`/bets/category/${categoryId}`),
        () => directDatabaseService.getBets({ categoryId }),
        'FHEVM Database'
      ),
  },

  // Category endpoints with FHEVM fallback
  categories: {
    getAll: () =>
      tryApiWithFallback(
        () => api.get('/categories'),
        () => directDatabaseService.getCategories(),
        'FHEVM Database'
      ),

    getById: (id) =>
      api.get(`/categories/${id}`),

    getTopLevel: () =>
      tryApiWithFallback(
        () => api.get('/categories/top-level'),
        () => directDatabaseService.getCategories(),
        'FHEVM Database'
      ),

    getSubCategories: (parentId) =>
      api.get(`/categories/${parentId}/children`),
  },

  // Admin endpoints with FHEVM fallback
  admin: {
    // Bet management
    getBets: (params) =>
      tryApiWithFallback(
        () => api.get('/admin/bets', { params }),
        () => directDatabaseService.getBets(params),
        'FHEVM Database'
      ),

    createBet: (data) =>
      api.post('/admin/bets', data),

    updateBet: (id, data) =>
      api.put(`/admin/bets/${id}`, data),

    resolveBet: (id, data) =>
      api.post(`/admin/bets/${id}/resolve`, data),

    // Category management
    createCategory: (data) =>
      api.post('/admin/categories', data),

    updateCategory: (id, data) =>
      api.put(`/admin/categories/${id}`, data),

    deleteCategory: (id) =>
      api.delete(`/admin/categories/${id}`),

    // User management
    getUsers: () =>
      tryApiWithFallback(
        () => api.get('/admin/users'),
        () => directDatabaseService.getUsers(),
        'FHEVM Database'
      ),

    updateUser: (id, data) =>
      api.put(`/admin/users/${id}`, data),

    // Analytics
    getAnalytics: (params) =>
      tryApiWithFallback(
        () => api.get('/admin/analytics', { params }),
        () => directDatabaseService.getAnalytics(params?.timeRange),
        'FHEVM Database'
      ),

    getStats: () =>
      tryApiWithFallback(
        () => api.get('/admin/stats'),
        () => directDatabaseService.getAnalytics(),
        'FHEVM Database'
      ),
  },

  // Upload endpoints
  upload: {
    image: (file) => {
      const formData = new FormData();
      formData.append('image', file);
      return api.post('/upload/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    },
  },
};

// Helper functions
export const handleApiError = (error, fallbackMessage = 'An error occurred') => {
  console.error('API Error:', error);
  const message = error.response?.data?.message || error.message || fallbackMessage;
  return message;
};

export const isNetworkError = (error) => {
  return !error.response && error.request;
};

export const isServerError = (error) => {
  return error.response && error.response.status >= 500;
};

export const isClientError = (error) => {
  return error.response && error.response.status >= 400 && error.response.status < 500;
};

// Export API methods for backward compatibility
export const betAPI = apiMethods.bets;
export const categoryAPI = apiMethods.categories;
export const authAPI = apiMethods.auth;
export const adminAPI = apiMethods.admin;
export const userAPI = apiMethods.bets; // User bets are part of bets API
export const uploadAPI = apiMethods.upload;

// Export default api instance
export default api;