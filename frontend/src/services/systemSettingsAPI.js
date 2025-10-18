import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export const systemSettingsAPI = {
  // Get system settings
  getSettings: async () => {
    const response = await axios.get(`${API_URL}/system-settings`);
    return response.data;
  },

  // Update system settings
  updateSettings: async (settings) => {
    const response = await axios.put(`${API_URL}/system-settings`, settings);
    return response.data;
  },

  // Add footer item
  addFooterItem: async (item) => {
    const response = await axios.post(`${API_URL}/system-settings/footer-items`, item);
    return response.data;
  },

  // Update footer item
  updateFooterItem: async (itemId, updates) => {
    const response = await axios.put(`${API_URL}/system-settings/footer-items/${itemId}`, updates);
    return response.data;
  },

  // Delete footer item
  deleteFooterItem: async (itemId) => {
    const response = await axios.delete(`${API_URL}/system-settings/footer-items/${itemId}`);
    return response.data;
  },

  // Reorder footer items
  reorderFooterItems: async (items) => {
    const response = await axios.post(`${API_URL}/system-settings/footer-items/reorder`, { items });
    return response.data;
  }
};

export default systemSettingsAPI;
