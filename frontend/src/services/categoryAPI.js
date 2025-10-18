import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export const categoryAPI = {
  // Get all categories
  getCategories: async () => {
    const response = await axios.get(`${API_URL}/categories-simple`);
    return response.data;
  },

  // Create category
  createCategory: async (categoryData) => {
    const response = await axios.post(`${API_URL}/categories-simple`, categoryData);
    return response.data;
  },

  // Update category
  updateCategory: async (id, categoryData) => {
    const response = await axios.put(`${API_URL}/categories-simple/${id}`, categoryData);
    return response.data;
  },

  // Delete category
  deleteCategory: async (id) => {
    const response = await axios.delete(`${API_URL}/categories-simple/${id}`);
    return response.data;
  },

  // Assign category to bet
  assignBetCategory: async (contractId, categoryId) => {
    const response = await axios.post(`${API_URL}/categories-simple/assign`, {
      contractId,
      categoryId
    });
    return response.data;
  },

  // Get bet category
  getBetCategory: async (contractId) => {
    const response = await axios.get(`${API_URL}/categories-simple/bet/${contractId}`);
    return response.data;
  },

  // Get bets by category
  getBetsByCategory: async (categoryId) => {
    const response = await axios.get(`${API_URL}/categories-simple/${categoryId}/bets`);
    return response.data;
  }
};

export default categoryAPI;
