import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Export base URL for image paths
export const BASE_URL = API_URL.replace('/api', '');

export const betSyncAPI = {
  // Sync bets from contract to database
  syncBets: async (contractData) => {
    const response = await axios.post(`${API_URL}/bet-sync/sync`, contractData);
    return response.data;
  },

  // Get all bets from database
  getAllBets: async (params = {}) => {
    const response = await axios.get(`${API_URL}/bet-sync`, { params });
    return response.data;
  },

  // Get bet by contractId
  getBetByContractId: async (contractId) => {
    const response = await axios.get(`${API_URL}/bet-sync/${contractId}`);
    return response.data;
  },

  // Update bet category
  updateBetCategory: async (contractId, categoryId) => {
    const response = await axios.put(`${API_URL}/bet-sync/${contractId}/category`, { categoryId });
    return response.data;
  },

  // Get bets by category
  getBetsByCategory: async (categoryId) => {
    const response = await axios.get(`${API_URL}/bet-sync/category/${categoryId}`);
    return response.data;
  },

  // Update bet image (URL)
  updateBetImage: async (contractId, imageUrl) => {
    const response = await axios.put(`${API_URL}/bet-sync/${contractId}/image`, { imageUrl });
    return response.data;
  },

  // Upload bet image (File)
  uploadBetImage: async (contractId, file) => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await axios.post(`${API_URL}/bet-sync/${contractId}/upload-image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Resolve bet
  resolveBet: async (contractId, data) => {
    const response = await axios.post(`${API_URL}/bet-sync/${contractId}/resolve`, data);
    return response.data;
  },

  // Resolve nested bet
  resolveNestedBet: async (contractId, data) => {
    const response = await axios.post(`${API_URL}/bet-sync/${contractId}/resolve-nested`, data);
    return response.data;
  }
};

export default betSyncAPI;
