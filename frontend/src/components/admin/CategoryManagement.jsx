import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  FolderOpen,
  Folder,
  Image as ImageIcon,
  ChevronDown,
  ChevronRight,
  Search,
  Upload,
  Eye,
  EyeOff,
  Move,
  MoreHorizontal
} from 'lucide-react';
import LoadingSpinner from '../common/LoadingSpinner';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';

const CategoryManagement = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    imageUrl: '',
    parentCategory: '',
    displayOrder: 0,
    isActive: true
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);

      // Try to fetch real categories first
      try {
        const response = await fetch('/api/categories', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setCategories(data.data.categories || []);
          console.log('✅ Using real category data from API');
          return;
        }
      } catch (apiError) {
        console.log('⚠️ Categories API not available, using mock data:', apiError.message);
      }

      // Fallback to mock categories
      const mockCategories = [
        {
          _id: 'crypto',
          name: 'Cryptocurrency',
          description: 'Digital currency and blockchain predictions',
          imageUrl: '🪙',
          parentCategory: null,
          displayOrder: 1,
          isActive: true,
          betCount: 24,
          totalVolume: 456789
        },
        {
          _id: 'politics',
          name: 'Politics',
          description: 'Political events and election predictions',
          imageUrl: '🗳️',
          parentCategory: null,
          displayOrder: 2,
          isActive: true,
          betCount: 18,
          totalVolume: 334567
        },
        {
          _id: 'sports',
          name: 'Sports',
          description: 'Sports events and tournament predictions',
          imageUrl: '⚽',
          parentCategory: null,
          displayOrder: 3,
          isActive: true,
          betCount: 32,
          totalVolume: 223456
        },
        {
          _id: 'stocks',
          name: 'Stock Market',
          description: 'Stock price and market predictions',
          imageUrl: '📈',
          parentCategory: null,
          displayOrder: 4,
          isActive: true,
          betCount: 15,
          totalVolume: 178234
        },
        {
          _id: 'entertainment',
          name: 'Entertainment',
          description: 'Movies, TV shows, and celebrity predictions',
          imageUrl: '🎬',
          parentCategory: null,
          displayOrder: 5,
          isActive: true,
          betCount: 12,
          totalVolume: 98765
        },
        {
          _id: 'technology',
          name: 'Technology',
          description: 'Tech company and innovation predictions',
          imageUrl: '💻',
          parentCategory: null,
          displayOrder: 6,
          isActive: false,
          betCount: 8,
          totalVolume: 56789
        }
      ];

      setCategories(mockCategories);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(categoryForm)
      });

      if (response.ok) {
        console.log('✅ Category created successfully via API');
        setShowCreateModal(false);
        resetForm();
        fetchCategories(); // Refresh list to show new category
      } else {
        throw new Error(`API Error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to create category:', error);
      alert('Failed to create category. This feature requires a backend API to be running.');
    }
  };

  const handleEditCategory = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/admin/categories/${selectedCategory._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(categoryForm)
      });

      if (response.ok) {
        console.log('✅ Category updated successfully via API');
        setShowEditModal(false);
        setSelectedCategory(null);
        resetForm();
        fetchCategories(); // Refresh list to show updated category
      } else {
        throw new Error(`API Error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to update category:', error);
      alert('Failed to update category. This feature requires a backend API to be running.');
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        console.log('✅ Category deleted successfully via API');
        fetchCategories(); // Refresh list to remove deleted category
      } else {
        throw new Error(`API Error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert('Failed to delete category. This feature requires a backend API to be running.');
    }
  };

  const handleToggleActive = async (categoryId, isActive) => {
    try {
      const response = await fetch(`/api/admin/categories/${categoryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ isActive: !isActive })
      });

      if (response.ok) {
        console.log('✅ Category status toggled successfully via API');
        fetchCategories(); // Refresh list to show updated status
      } else {
        throw new Error(`API Error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to toggle category status:', error);
      alert('Failed to toggle category status. This feature requires a backend API to be running.');
    }
  };

  const resetForm = () => {
    setCategoryForm({
      name: '',
      description: '',
      imageUrl: '',
      parentCategory: '',
      displayOrder: 0,
      isActive: true
    });
  };

  const openEditModal = (category) => {
    setSelectedCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      imageUrl: category.imageUrl || '',
      parentCategory: category.parentCategory?._id || '',
      displayOrder: category.displayOrder || 0,
      isActive: category.isActive
    });
    setShowEditModal(true);
  };

  const toggleExpanded = (categoryId) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Build hierarchical category structure
  const buildCategoryTree = (categories) => {
    const categoryMap = new Map();
    const rootCategories = [];

    // Create map of all categories
    categories.forEach(category => {
      categoryMap.set(category._id, { ...category, children: [] });
    });

    // Build tree structure
    categories.forEach(category => {
      if (category.parentCategory) {
        const parent = categoryMap.get(category.parentCategory._id || category.parentCategory);
        if (parent) {
          parent.children.push(categoryMap.get(category._id));
        }
      } else {
        rootCategories.push(categoryMap.get(category._id));
      }
    });

    return rootCategories;
  };

  // Filter categories based on search term
  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categoryTree = buildCategoryTree(searchTerm ? filteredCategories : categories);

  const CategoryItem = ({ category, level = 0 }) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category._id);

    return (
      <div className="border border-gray-200 dark:border-primary-7/50 rounded-lg mb-1">
        <div className="p-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md hover:bg-primary-50/30 dark:hover:bg-primary-900/20 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3" style={{ paddingLeft: `${level * 20}px` }}>
              {hasChildren && (
                <button
                  onClick={() => toggleExpanded(category._id)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              )}
              
              <div className="flex items-center gap-3">
                {category.imageUrl ? (
                  <img
                    src={category.imageUrl}
                    alt={category.name}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                    {hasChildren ? (
                      <FolderOpen className="w-4 h-4 text-primary-7 dark:text-primary-6" />
                    ) : (
                      <Folder className="w-4 h-4 text-tint-8 dark:text-tint-6" />
                    )}
                  </div>
                )}
                
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">{category.name}</h3>
                  {category.description && (
                    <p className="text-xs text-tint-8 dark:text-tint-6 line-clamp-1">{category.description}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-tint-9 dark:text-tint-7">
                {category.betCount || 0} bets
              </span>
              
              <button
                onClick={() => handleToggleActive(category._id, category.isActive)}
                className={`p-1 rounded ${category.isActive ? 'text-green-600' : 'text-gray-400'}`}
                title={category.isActive ? 'Active' : 'Inactive'}
              >
                {category.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>

              <button
                onClick={() => openEditModal(category)}
                className="p-1 text-tint-8 hover:text-primary-8 dark:text-tint-6 dark:hover:text-primary-6 rounded transition-colors"
                title="Edit category"
              >
                <Edit className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleDeleteCategory(category._id)}
                className="p-1 text-tint-8 hover:text-red-600 dark:text-tint-6 dark:hover:text-red-400 rounded transition-colors"
                title="Delete category"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button className="p-1 text-tint-8 hover:text-primary-8 dark:text-tint-6 dark:hover:text-primary-6 rounded transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="border-t border-gray-200 bg-gray-50">
            {category.children.map(child => (
              <CategoryItem
                key={child._id}
                category={child}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const CategoryModal = ({ isEdit = false }) => (
    <Modal
      isOpen={isEdit ? showEditModal : showCreateModal}
      onClose={() => {
        if (isEdit) {
          setShowEditModal(false);
          setSelectedCategory(null);
        } else {
          setShowCreateModal(false);
        }
        resetForm();
      }}
      title={isEdit ? 'Edit Category' : 'Create New Category'}
    >
      <form onSubmit={isEdit ? handleEditCategory : handleCreateCategory} className="space-y-4">
        <Input
          label="Category Name"
          value={categoryForm.name}
          onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Politics, Sports, Crypto"
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={categoryForm.description}
            onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Brief description of this category..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Parent Category
          </label>
          <select
            value={categoryForm.parentCategory}
            onChange={(e) => setCategoryForm(prev => ({ ...prev, parentCategory: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">None (Top Level Category)</option>
            {categories
              .filter(cat => !isEdit || cat._id !== selectedCategory?._id)
              .map(category => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Display Order"
            type="number"
            value={categoryForm.displayOrder}
            onChange={(e) => setCategoryForm(prev => ({ ...prev, displayOrder: parseInt(e.target.value) || 0 }))}
            min="0"
            placeholder="0"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={categoryForm.isActive}
              onChange={(e) => setCategoryForm(prev => ({ ...prev, isActive: e.target.value === 'true' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category Image
          </label>
          <div className="space-y-2">
            <Input
              value={categoryForm.imageUrl}
              onChange={(e) => setCategoryForm(prev => ({ ...prev, imageUrl: e.target.value }))}
              placeholder="https://example.com/image.jpg"
            />
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <ImageIcon className="w-4 h-4" />
              <span>Or</span>
              <button
                type="button"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                <Upload className="w-4 h-4 inline mr-1" />
                Upload Image
              </button>
            </div>
            {categoryForm.imageUrl && (
              <div className="mt-2">
                <img
                  src={categoryForm.imageUrl}
                  alt="Preview"
                  className="w-20 h-20 object-cover rounded-lg border"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (isEdit) {
                setShowEditModal(false);
                setSelectedCategory(null);
              } else {
                setShowCreateModal(false);
              }
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button type="submit">
            {isEdit ? 'Update Category' : 'Create Category'}
          </Button>
        </div>
      </form>
    </Modal>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" text="Loading categories..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Category Management</h2>
          <p className="text-gray-600 mt-1">Organize betting markets with hierarchical categories</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Category
        </Button>
      </div>

      {/* Search and Stats */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-600">
            <span>
              <strong>{categories.length}</strong> total categories
            </span>
            <span>
              <strong>{categories.filter(c => c.isActive).length}</strong> active
            </span>
            <span>
              <strong>{categories.filter(c => !c.parentCategory).length}</strong> top-level
            </span>
          </div>
        </div>
      </div>

      {/* Categories List */}
      {categoryTree.length > 0 ? (
        <div className="space-y-2">
          {categoryTree.map(category => (
            <CategoryItem key={category._id} category={category} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
          <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? 'No categories found' : 'No categories yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm 
              ? 'Try adjusting your search term to find categories.'
              : 'Create your first category to organize betting markets.'
            }
          </p>
          {!searchTerm && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Category
            </Button>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
            <Plus className="w-5 h-5 text-blue-600" />
            <span className="font-medium">Bulk Import</span>
          </button>
          
          <button className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
            <Move className="w-5 h-5 text-green-600" />
            <span className="font-medium">Reorder Categories</span>
          </button>
          
          <button className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
            <Eye className="w-5 h-5 text-purple-600" />
            <span className="font-medium">Toggle All Active</span>
          </button>
          
          <button className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
            <Upload className="w-5 h-5 text-orange-600" />
            <span className="font-medium">Export Data</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <CategoryModal isEdit={false} />
      <CategoryModal isEdit={true} />
    </div>
  );
};

export default CategoryManagement;