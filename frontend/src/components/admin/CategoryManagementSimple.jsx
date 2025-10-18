import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit, Trash2, Save, X, Smile, GripVertical } from 'lucide-react';
import LoadingSpinner from '../common/LoadingSpinner';
import categoryAPI from '../../services/categoryAPI';
import EmojiPicker from 'emoji-picker-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable category item component
const SortableCategoryItem = ({
  category,
  editingId,
  setEditingId,
  updateCategory,
  handleUpdate,
  handleDelete,
  showEditEmojiPicker,
  setShowEditEmojiPicker,
  editEmojiButtonRef,
  handleEditEmojiClick
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: category._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="group px-6 py-4 transition-all relative">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-blue-500 transition-colors"></div>
      {editingId === category._id ? (
        // Edit Mode
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <input
            type="text"
            placeholder="Category Name"
            value={category.name}
            onChange={(e) => updateCategory(category._id, 'name', e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-400"
          />

          {/* Emoji Picker for Edit */}
          <div className="relative">
            <button
              ref={editEmojiButtonRef}
              type="button"
              onClick={() => setShowEditEmojiPicker(category._id)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-2xl">{category.icon}</span>
              <Smile className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <input
            type="color"
            value={category.color}
            onChange={(e) => updateCategory(category._id, 'color', e.target.value)}
            className="px-2 py-2 border border-gray-200 rounded-lg h-10 w-full cursor-pointer"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleUpdate(category._id)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 flex-1"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        // View Mode
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
            >
              <GripVertical className="w-5 h-5" />
            </div>
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
              style={{ backgroundColor: `${category.color}20`, color: category.color }}
            >
              {category.icon}
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">{category.name}</h4>
              <p className="text-sm text-gray-600">Order: {category.displayOrder}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditingId(category._id)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(category._id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const CategoryManagementSimple = ({ onUpdate }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(null);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ top: 0, left: 0 });
  const emojiButtonRef = useRef(null);
  const editEmojiButtonRef = useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    icon: '📊',
    color: '#6366f1',
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await categoryAPI.getCategories();
      const fetchedCategories = response.data || [];
      // Sort by displayOrder
      fetchedCategories.sort((a, b) => a.displayOrder - b.displayOrder);
      setCategories(fetchedCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      alert('Category name is required!');
      return;
    }

    try {
      // Set displayOrder to be last
      const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.displayOrder)) : -1;
      await categoryAPI.createCategory({
        ...formData,
        displayOrder: maxOrder + 1
      });
      setFormData({ name: '', icon: '📊', color: '#6366f1' });
      fetchCategories();
      if (onUpdate) onUpdate();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create category');
    }
  };

  const handleUpdate = async (id) => {
    const category = categories.find(c => c._id === id);
    if (!category) return;

    try {
      await categoryAPI.updateCategory(id, category);
      setEditingId(null);
      fetchCategories();
      if (onUpdate) onUpdate();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update category');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      await categoryAPI.deleteCategory(id);
      fetchCategories();
      if (onUpdate) onUpdate();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete category');
    }
  };

  const updateCategory = (id, field, value) => {
    setCategories(categories.map(cat =>
      cat._id === id ? { ...cat, [field]: value } : cat
    ));
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = categories.findIndex(c => c._id === active.id);
      const newIndex = categories.findIndex(c => c._id === over.id);

      const reordered = arrayMove(categories, oldIndex, newIndex);

      // Update displayOrder for all categories
      const updatedCategories = reordered.map((cat, index) => ({
        ...cat,
        displayOrder: index
      }));

      setCategories(updatedCategories);

      // Update all categories in DB
      try {
        await Promise.all(
          updatedCategories.map(cat =>
            categoryAPI.updateCategory(cat._id, { ...cat, displayOrder: cat.displayOrder })
          )
        );
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Failed to update category order:', error);
        // Revert on error
        fetchCategories();
      }
    }
  };

  const handleEmojiClick = (emojiObject) => {
    setFormData({ ...formData, icon: emojiObject.emoji });
    setShowEmojiPicker(false);
  };

  const handleEditEmojiClick = (emojiObject) => {
    if (showEditEmojiPicker) {
      updateCategory(showEditEmojiPicker, 'icon', emojiObject.emoji);
      setShowEditEmojiPicker(null);
    }
  };

  const toggleEmojiPicker = () => {
    if (!showEmojiPicker && emojiButtonRef.current) {
      const rect = emojiButtonRef.current.getBoundingClientRect();
      setEmojiPickerPosition({
        top: rect.bottom + 8,
        left: rect.left
      });
    }
    setShowEmojiPicker(!showEmojiPicker);
  };

  const toggleEditEmojiPicker = (categoryId) => {
    if (!showEditEmojiPicker && editEmojiButtonRef.current) {
      const rect = editEmojiButtonRef.current.getBoundingClientRect();
      setEmojiPickerPosition({
        top: rect.bottom + 8,
        left: rect.left
      });
    }
    setShowEditEmojiPicker(showEditEmojiPicker === categoryId ? null : categoryId);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <>
      {/* Create Emoji Picker Portal */}
      {showEmojiPicker && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setShowEmojiPicker(false)}
          />
          {/* Emoji Picker */}
          <div
            className="fixed z-[9999]"
            style={{
              top: `${emojiPickerPosition.top}px`,
              left: `${emojiPickerPosition.left}px`,
            }}
          >
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              autoFocusSearch={false}
              theme="light"
              height={400}
              width={350}
            />
          </div>
        </>,
        document.body
      )}

      {/* Edit Emoji Picker Portal */}
      {showEditEmojiPicker && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setShowEditEmojiPicker(null)}
          />
          {/* Emoji Picker */}
          <div
            className="fixed z-[9999]"
            style={{
              top: `${emojiPickerPosition.top}px`,
              left: `${emojiPickerPosition.left}px`,
            }}
          >
            <EmojiPicker
              onEmojiClick={handleEditEmojiClick}
              autoFocusSearch={false}
              theme="light"
              height={400}
              width={350}
            />
          </div>
        </>,
        document.body
      )}

      <div className="space-y-6">
        {/* Create Category Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Category</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Category Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-400"
          />

          {/* Emoji Picker Button */}
          <div className="relative">
            <button
              ref={emojiButtonRef}
              type="button"
              onClick={toggleEmojiPicker}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-2xl">{formData.icon}</span>
              <Smile className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <input
            type="color"
            value={formData.color}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            className="px-2 py-2 border border-gray-200 rounded-lg h-10 w-full cursor-pointer"
          />

          <button
            onClick={handleCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create
          </button>
        </div>
      </div>

      {/* Categories List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Categories ({categories.length})</h3>
          <p className="text-xs text-gray-600 mt-0.5">Drag to reorder categories</p>
        </div>

        {categories.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            No categories yet. Create one above!
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={categories.map(c => c._id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y divide-gray-300">
                {categories.map((category) => (
                  <SortableCategoryItem
                    key={category._id}
                    category={category}
                    editingId={editingId}
                    setEditingId={setEditingId}
                    updateCategory={updateCategory}
                    handleUpdate={handleUpdate}
                    handleDelete={handleDelete}
                    showEditEmojiPicker={showEditEmojiPicker}
                    setShowEditEmojiPicker={toggleEditEmojiPicker}
                    editEmojiButtonRef={editEmojiButtonRef}
                    handleEditEmojiClick={handleEditEmojiClick}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
      </div>
    </>
  );
};

export default CategoryManagementSimple;
