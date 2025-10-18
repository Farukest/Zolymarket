import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, Mail, Twitter, Github, MessageSquare } from 'lucide-react';
import systemSettingsAPI from '../../services/systemSettingsAPI';
import toast from 'react-hot-toast';

const SortableFooterItem = ({ item, onEdit, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3 group hover:shadow-sm transition-shadow relative"
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-blue-500 transition-colors"></div>

      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="w-5 h-5 text-gray-400" />
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 text-xs font-medium rounded ${
            item.type === 'icon' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {item.type === 'icon' ? 'Icon' : 'Text'}
          </span>
          <span className="font-medium text-gray-900">{item.content}</span>
          <span className={`px-2 py-1 text-xs font-medium rounded ${
            item.position === 'left' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
          }`}>
            {item.position === 'left' ? 'Left' : 'Right'}
          </span>
        </div>
        <div className="text-sm text-gray-600 mt-1">
          {item.link}
        </div>
      </div>

      <button
        onClick={() => onEdit(item)}
        className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
      >
        Edit
      </button>
      <button
        onClick={() => onDelete(item._id)}
        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

const SystemSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [companyText, setCompanyText] = useState('');
  const [socialLinks, setSocialLinks] = useState({
    email: '',
    twitter: '',
    github: '',
    discord: ''
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newItem, setNewItem] = useState({
    type: 'text',
    content: '',
    link: '',
    position: 'left'
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await systemSettingsAPI.getSettings();
      const data = response.data;
      setSettings(data);
      setCompanyText(data.companyText || '');
      setSocialLinks(data.socialLinks || { email: '', twitter: '', github: '', discord: '' });
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCompanyText = async () => {
    try {
      await systemSettingsAPI.updateSettings({ companyText });
      toast.success('Company text updated');
      loadSettings();
    } catch (error) {
      console.error('Error saving company text:', error);
      toast.error('Failed to save company text');
    }
  };

  const handleSaveSocialLinks = async () => {
    try {
      await systemSettingsAPI.updateSettings({ socialLinks });
      toast.success('Social links updated');
      loadSettings();
    } catch (error) {
      console.error('Error saving social links:', error);
      toast.error('Failed to save social links');
    }
  };

  const handleAddItem = async () => {
    try {
      if (editingItem) {
        await systemSettingsAPI.updateFooterItem(editingItem._id, newItem);
        toast.success('Footer item updated');
      } else {
        await systemSettingsAPI.addFooterItem(newItem);
        toast.success('Footer item added');
      }
      setShowAddModal(false);
      setEditingItem(null);
      setNewItem({ type: 'text', content: '', link: '', position: 'left' });
      loadSettings();
    } catch (error) {
      console.error('Error saving footer item:', error);
      toast.error('Failed to save footer item');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await systemSettingsAPI.deleteFooterItem(itemId);
      toast.success('Footer item deleted');
      loadSettings();
    } catch (error) {
      console.error('Error deleting footer item:', error);
      toast.error('Failed to delete footer item');
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setNewItem({
      type: item.type,
      content: item.content,
      link: item.link,
      position: item.position
    });
    setShowAddModal(true);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const position = settings.footerItems.find(item => item._id === active.id)?.position;
    const itemsInPosition = settings.footerItems.filter(item => item.position === position);

    const oldIndex = itemsInPosition.findIndex(item => item._id === active.id);
    const newIndex = itemsInPosition.findIndex(item => item._id === over.id);

    const reordered = arrayMove(itemsInPosition, oldIndex, newIndex);
    const updates = reordered.map((item, index) => ({
      id: item._id,
      order: index
    }));

    try {
      await systemSettingsAPI.reorderFooterItems(updates);
      toast.success('Items reordered');
      loadSettings();
    } catch (error) {
      console.error('Error reordering items:', error);
      toast.error('Failed to reorder items');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const leftItems = settings?.footerItems?.filter(item => item.position === 'left').sort((a, b) => a.order - b.order) || [];
  const rightItems = settings?.footerItems?.filter(item => item.position === 'right').sort((a, b) => a.order - b.order) || [];

  return (
    <div className="space-y-8">
      {/* Company Text Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Text (Left Side)</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={companyText}
            onChange={(e) => setCompanyText(e.target.value)}
            placeholder="0xflydev. © 2025"
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
          />
          <button
            onClick={handleSaveCompanyText}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {/* Social Links Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Social Links (Right Side)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4" /> Email Link
            </label>
            <input
              type="text"
              value={socialLinks.email}
              onChange={(e) => setSocialLinks({ ...socialLinks, email: e.target.value })}
              placeholder="mailto:info@example.com"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Twitter className="w-4 h-4" /> Twitter/X Link
            </label>
            <input
              type="text"
              value={socialLinks.twitter}
              onChange={(e) => setSocialLinks({ ...socialLinks, twitter: e.target.value })}
              placeholder="https://twitter.com/username"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Github className="w-4 h-4" /> GitHub Link
            </label>
            <input
              type="text"
              value={socialLinks.github}
              onChange={(e) => setSocialLinks({ ...socialLinks, github: e.target.value })}
              placeholder="https://github.com/username"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <MessageSquare className="w-4 h-4" /> Discord Link
            </label>
            <input
              type="text"
              value={socialLinks.discord}
              onChange={(e) => setSocialLinks({ ...socialLinks, discord: e.target.value })}
              placeholder="https://discord.gg/invite"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
            />
          </div>
        </div>
        <button
          onClick={handleSaveSocialLinks}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Save Social Links
        </button>
      </div>

      {/* Footer Items Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Footer Menu Items</h3>
          <button
            onClick={() => {
              setEditingItem(null);
              setNewItem({ type: 'text', content: '', link: '', position: 'left' });
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Items */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Left Side Items</h4>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={leftItems.map(item => item._id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {leftItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-lg">
                      No left items yet
                    </div>
                  ) : (
                    leftItems.map(item => (
                      <SortableFooterItem
                        key={item._id}
                        item={item}
                        onEdit={handleEditItem}
                        onDelete={handleDeleteItem}
                      />
                    ))
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Right Items */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Right Side Items</h4>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={rightItems.map(item => item._id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {rightItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-lg">
                      No right items yet
                    </div>
                  ) : (
                    rightItems.map(item => (
                      <SortableFooterItem
                        key={item._id}
                        item={item}
                        onEdit={handleEditItem}
                        onDelete={handleDeleteItem}
                      />
                    ))
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingItem ? 'Edit Footer Item' : 'Add Footer Item'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={newItem.type}
                  onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                >
                  <option value="text">Text</option>
                  <option value="icon">Icon</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {newItem.type === 'icon' ? 'Icon Name' : 'Text'}
                </label>
                <input
                  type="text"
                  value={newItem.content}
                  onChange={(e) => setNewItem({ ...newItem, content: e.target.value })}
                  placeholder={newItem.type === 'icon' ? 'Icon name' : 'Privacy Policy'}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Link</label>
                <input
                  type="text"
                  value={newItem.link}
                  onChange={(e) => setNewItem({ ...newItem, link: e.target.value })}
                  placeholder="https://example.com/privacy"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                <select
                  value={newItem.position}
                  onChange={(e) => setNewItem({ ...newItem, position: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingItem(null);
                  setNewItem({ type: 'text', content: '', link: '', position: 'left' });
                }}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                {editingItem ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemSettings;
