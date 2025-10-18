import { useState, useEffect } from 'react';
import categoryAPI from '../services/categoryAPI';

export const useCategories = () => {
  const [categories, setCategories] = useState([]);
  const [topLevelCategories, setTopLevelCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch from new categoryAPI
      const response = await categoryAPI.getCategories();
      const fetchedCategories = response.data || [];

      // Transform to match expected format with 'id' field
      const transformed = fetchedCategories.map(cat => ({
        id: cat._id,
        _id: cat._id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        displayOrder: cat.displayOrder,
        isActive: cat.isActive
      }));

      // Sort by displayOrder
      transformed.sort((a, b) => a.displayOrder - b.displayOrder);

      setCategories(transformed);
      setTopLevelCategories(transformed); // All are top-level in simple system

    } catch (err) {
      console.error('Error loading categories:', err);
      setCategories([]);
      setTopLevelCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const getCategory = async (categoryId) => {
    try {
      const response = await api.get(`/categories/${categoryId}`, { optional: true });
      return response.data?.category;
    } catch (err) {
      console.error('Error getting category:', err);
      throw err;
    }
  };

  const getSubCategories = (parentId) => {
    return categories.filter(cat => cat.parentId === parentId);
  };

  const getCategoryPath = (categoryId) => {
    const path = [];
    let currentCategory = categories.find(cat => cat.id === categoryId);
    
    while (currentCategory) {
      path.unshift(currentCategory);
      if (currentCategory.parentId && currentCategory.parentId !== 0) {
        currentCategory = categories.find(cat => cat.id === currentCategory.parentId);
      } else {
        break;
      }
    }
    
    return path;
  };

  const getCategoryWithChildren = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return null;

    const children = getSubCategories(categoryId);
    
    return {
      ...category,
      children: children.map(child => getCategoryWithChildren(child.id))
    };
  };

  // Get all descendant categories (recursive)
  const getAllDescendants = (categoryId) => {
    const descendants = [];
    const directChildren = getSubCategories(categoryId);
    
    for (const child of directChildren) {
      descendants.push(child);
      descendants.push(...getAllDescendants(child.id));
    }
    
    return descendants;
  };

  const searchCategories = (query) => {
    if (!query.trim()) return [];
    
    const lowercaseQuery = query.toLowerCase();
    return categories.filter(category => 
      category.name.toLowerCase().includes(lowercaseQuery) ||
      category.description?.toLowerCase().includes(lowercaseQuery)
    );
  };

  return {
    categories,
    topLevelCategories,
    loading,
    error,
    loadCategories,
    getCategory,
    getSubCategories,
    getCategoryPath,
    getCategoryWithChildren,
    getAllDescendants,
    searchCategories,
    clearError: () => setError(null)
  };
};