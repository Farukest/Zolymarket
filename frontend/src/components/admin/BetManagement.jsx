import React, { useState, useEffect } from 'react';
import {
  Plus,
  Filter,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  DollarSign,
  Target,
  Calendar,
  Image as ImageIcon,
  AlertTriangle
} from 'lucide-react';
import LoadingSpinner from '../common/LoadingSpinner';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';

const BetManagement = () => {
  const [bets, setBets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedBet, setSelectedBet] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    search: ''
  });

  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    imageUrl: '',
    categoryId: '',
    options: ['', ''],
    endTime: '',
    betType: 0, // Binary by default (BINARY=0, MULTIPLE_CHOICE=1, SPORTS=2)
    mustShowLive: false,
    liveStartTime: '',
    liveEndTime: '',

    // ===== GROUPING FIELDS FOR NESTED MARKETS =====
    marketGroup: {
      groupId: '',
      groupTitle: '',
      groupType: 'standalone', // nested, series, tournament, standalone
      groupOrder: 0,
      isGroupHeader: false
    }
  });

  // State for bulk creation (Fed Decision example)
  const [bulkCreateMode, setBulkCreateMode] = useState(false);
  const [bulkCreateForm, setBulkCreateForm] = useState({
    groupTitle: '',
    groupType: 'nested',
    bets: [
      { title: '', description: '', options: ['Yes', 'No'] },
      { title: '', description: '', options: ['Yes', 'No'] },
      { title: '', description: '', options: ['Yes', 'No'] }
    ]
  });

  useEffect(() => {
    fetchBets();
    fetchCategories();
  }, [filters]);

  const fetchBets = async () => {
    try {
      setLoading(true);

      // Try to fetch real data first
      try {
        const queryParams = new URLSearchParams();
        if (filters.status !== 'all') queryParams.append('status', filters.status);
        if (filters.category !== 'all') queryParams.append('category', filters.category);
        if (filters.search) queryParams.append('search', filters.search);

        const response = await fetch(`/api/bets?${queryParams}`);

        if (response.ok) {
          const data = await response.json();
          setBets(data.data.bets);
          console.log('✅ Using real bet data from API');
          return;
        }
      } catch (apiError) {
        console.log('⚠️ API not available, using mock data:', apiError.message);
      }

      // Fallback to mock data if API fails
      const mockBets = [
        {
          id: 1,
          title: "Will Bitcoin reach $100,000 by end of 2024?",
          description: "Prediction market for Bitcoin reaching the $100k milestone by December 31, 2024",
          imageUrl: "",
          categoryId: "crypto",
          isActive: true,
          isResolved: false,
          endTime: "2024-12-31T23:59:59.000Z",
          betType: 2,
          totalParticipants: 156,
          totalVolume: 45678,
          options: [
            { title: "Yes", totalShares: 1234 },
            { title: "No", totalShares: 987 }
          ]
        },
        {
          id: 2,
          title: "2024 US Presidential Election Winner",
          description: "Who will win the 2024 US Presidential Election?",
          imageUrl: "",
          categoryId: "politics",
          isActive: true,
          isResolved: false,
          endTime: "2024-11-05T23:59:59.000Z",
          betType: 1,
          totalParticipants: 892,
          totalVolume: 123456,
          options: [
            { title: "Donald Trump", totalShares: 2345 },
            { title: "Joe Biden", totalShares: 1876 },
            { title: "Other", totalShares: 234 }
          ]
        },
        {
          id: 3,
          title: "Will Tesla stock exceed $300?",
          description: "Tesla stock price prediction for Q4 2024",
          imageUrl: "",
          categoryId: "stocks",
          isActive: false,
          isResolved: true,
          endTime: "2024-10-31T23:59:59.000Z",
          betType: 2,
          totalParticipants: 67,
          totalVolume: 8900,
          options: [
            { title: "Yes", totalShares: 456 },
            { title: "No", totalShares: 789 }
          ]
        }
      ];

      // Apply filters to mock data
      let filteredBets = mockBets;

      if (filters.search) {
        filteredBets = filteredBets.filter(bet =>
          bet.title.toLowerCase().includes(filters.search.toLowerCase()) ||
          bet.description.toLowerCase().includes(filters.search.toLowerCase())
        );
      }

      if (filters.status !== 'all') {
        filteredBets = filteredBets.filter(bet => {
          if (filters.status === 'active') return bet.isActive && !bet.isResolved;
          if (filters.status === 'ended') return new Date(bet.endTime) < new Date() && !bet.isResolved;
          if (filters.status === 'resolved') return bet.isResolved;
          if (filters.status === 'inactive') return !bet.isActive;
          return true;
        });
      }

      if (filters.category !== 'all') {
        filteredBets = filteredBets.filter(bet => bet.categoryId === filters.category);
      }

      setBets(filteredBets);
    } catch (error) {
      console.error('Failed to fetch bets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      // Try to fetch real categories first
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data.data.categories);
          console.log('✅ Using real category data from API');
          return;
        }
      } catch (apiError) {
        console.log('⚠️ Categories API not available, using mock data:', apiError.message);
      }

      // Fallback to mock categories
      const mockCategories = [
        { _id: 'crypto', name: 'Cryptocurrency' },
        { _id: 'politics', name: 'Politics' },
        { _id: 'sports', name: 'Sports' },
        { _id: 'stocks', name: 'Stock Market' },
        { _id: 'entertainment', name: 'Entertainment' },
        { _id: 'technology', name: 'Technology' },
        { _id: 'weather', name: 'Weather' },
        { _id: 'economics', name: 'Economics' }
      ];
      setCategories(mockCategories);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleCreateBet = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/bets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(createForm)
      });

      if (response.ok) {
        console.log('✅ Bet created successfully via API');
        setShowCreateModal(false);
        setCreateForm({
          title: '',
          description: '',
          imageUrl: '',
          categoryId: '',
          options: ['', ''],
          endTime: '',
          betType: 2,
          mustShowLive: false,
          liveStartTime: '',
          liveEndTime: ''
        });
        fetchBets(); // Refresh list to show new bet
      } else {
        throw new Error(`API Error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to create bet:', error);
      alert('Failed to create bet. This feature requires a backend API to be running.');
    }
  };

  const handleResolveBet = async (betId, winnerIndex) => {
    try {
      const response = await fetch(`/api/admin/bets/${betId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ winnerIndex })
      });

      if (response.ok) {
        console.log('✅ Bet resolved successfully via API');
        setShowResolveModal(false);
        setSelectedBet(null);
        fetchBets(); // Refresh list to show updated bet status
      } else {
        throw new Error(`API Error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to resolve bet:', error);
      alert('Failed to resolve bet. This feature requires a backend API to be running.');
    }
  };

  const handleDeleteBet = async (betId) => {
    if (!window.confirm('Are you sure you want to delete this bet?')) return;

    try {
      const response = await fetch(`/api/admin/bets/${betId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        console.log('✅ Bet deleted successfully via API');
        fetchBets(); // Refresh list to remove deleted bet
      } else {
        throw new Error(`API Error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to delete bet:', error);
      alert('Failed to delete bet. This feature requires a backend API to be running.');
    }
  };

  const addOption = () => {
    setCreateForm(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  };

  const removeOption = (index) => {
    if (createForm.options.length > 2) {
      setCreateForm(prev => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index)
      }));
    }
  };

  const updateOption = (index, value) => {
    setCreateForm(prev => ({
      ...prev,
      options: prev.options.map((option, i) => i === index ? value : option)
    }));
  };

  // ===== BULK CREATION HANDLERS =====
  const handleBulkCreateSubmit = async () => {
    try {
      console.log('🚀 Creating bulk nested markets...');

      // Generate unique group ID
      const groupId = `${bulkCreateForm.groupType}_${Date.now()}`;

      // Create multiple separate binary bets
      const createdBets = [];

      for (let i = 0; i < bulkCreateForm.bets.length; i++) {
        const bet = bulkCreateForm.bets[i];

        const betData = {
          title: bet.title,
          description: bet.description,
          imageUrl: '',
          categoryId: createForm.categoryId,
          options: bet.options,
          endTime: createForm.endTime,
          betType: 0, // Binary for nested markets
          marketGroup: {
            groupId: groupId,
            groupTitle: bulkCreateForm.groupTitle,
            groupType: bulkCreateForm.groupType,
            groupOrder: i,
            isGroupHeader: i === 0
          }
        };

        // Create bet via API
        const response = await fetch('/api/admin/bets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(betData)
        });

        if (response.ok) {
          const result = await response.json();
          createdBets.push(result.data);
          console.log(`✅ Created bet ${i + 1}/${bulkCreateForm.bets.length}: ${bet.title}`);
        }
      }

      console.log('🎉 Bulk creation completed!', createdBets);
      setShowCreateModal(false);
      setBulkCreateMode(false);
      fetchBets(); // Refresh list

    } catch (error) {
      console.error('❌ Bulk creation failed:', error);
      alert('Failed to create bulk bets. Please try again.');
    }
  };

  const addBulkBet = () => {
    setBulkCreateForm(prev => ({
      ...prev,
      bets: [...prev.bets, { title: '', description: '', options: ['Yes', 'No'] }]
    }));
  };

  const removeBulkBet = (index) => {
    if (bulkCreateForm.bets.length > 1) {
      setBulkCreateForm(prev => ({
        ...prev,
        bets: prev.bets.filter((_, i) => i !== index)
      }));
    }
  };

  const updateBulkBet = (index, field, value) => {
    setBulkCreateForm(prev => ({
      ...prev,
      bets: prev.bets.map((bet, i) =>
        i === index ? { ...bet, [field]: value } : bet
      )
    }));
  };

  const getBetStatusColor = (bet) => {
    if (bet.isResolved) return 'bg-blue-100 text-blue-800';
    if (!bet.isActive) return 'bg-gray-100 text-gray-800';
    if (new Date(bet.endTime) < new Date()) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getBetStatusText = (bet) => {
    if (bet.isResolved) return 'Resolved';
    if (!bet.isActive) return 'Inactive';
    if (new Date(bet.endTime) < new Date()) return 'Ended';
    return 'Active';
  };

  const BetCard = ({ bet }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{bet.title}</h3>
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{bet.description}</p>
          
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Target className="w-4 h-4" />
              {bet.betType === 0 ? 'Binary' : bet.betType === 1 ? 'Multiple Choice' : 'Sports'}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {bet.totalParticipants || 0} participants
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              ${bet.totalVolume?.toLocaleString() || '0'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBetStatusColor(bet)}`}>
            {getBetStatusText(bet)}
          </span>
          <div className="relative">
            <button className="p-1 text-gray-400 hover:text-gray-600">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {bet.options?.slice(0, 2).map((option, index) => (
          <div key={index} className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900">{option.title}</p>
            <p className="text-xs text-gray-500 mt-1">
              {option.totalShares?.toLocaleString() || 0} shares
            </p>
          </div>
        ))}
        {bet.options?.length > 2 && (
          <div className="col-span-2 text-center text-sm text-gray-500">
            +{bet.options.length - 2} more options
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
        <span className="flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          Ends: {new Date(bet.endTime).toLocaleDateString()}
        </span>
        <span>ID: #{bet.id}</span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setSelectedBet(bet);
            // Show edit modal
          }}
        >
          <Edit className="w-4 h-4 mr-1" />
          Edit
        </Button>
        
        {!bet.isResolved && new Date(bet.endTime) < new Date() && (
          <Button
            size="sm"
            onClick={() => {
              setSelectedBet(bet);
              setShowResolveModal(true);
            }}
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Resolve
          </Button>
        )}
        
        <Button
          size="sm"
          variant="danger"
          onClick={() => handleDeleteBet(bet.id)}
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Delete
        </Button>
      </div>
    </div>
  );

  // ===== BULK CREATE FORM COMPONENT =====
  const BulkCreateForm = () => (
    <form onSubmit={(e) => { e.preventDefault(); handleBulkCreateSubmit(); }} className="space-y-6">
      {/* Group Settings */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Group Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Group Title"
            value={bulkCreateForm.groupTitle}
            onChange={(e) => setBulkCreateForm(prev => ({ ...prev, groupTitle: e.target.value }))}
            placeholder="e.g., Fed Decision October"
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Group Type</label>
            <select
              value={bulkCreateForm.groupType}
              onChange={(e) => setBulkCreateForm(prev => ({ ...prev, groupType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="nested">Nested (Fed Decision)</option>
              <option value="series">Series (Weekly Matches)</option>
              <option value="tournament">Tournament</option>
            </select>
          </div>
        </div>
      </div>

      {/* Common Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select
            value={createForm.categoryId}
            onChange={(e) => setCreateForm(prev => ({ ...prev, categoryId: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="">Select Category</option>
            {categories.map(category => (
              <option key={category._id} value={category._id}>{category.name}</option>
            ))}
          </select>
        </div>
        <Input
          label="End Time"
          type="datetime-local"
          value={createForm.endTime}
          onChange={(e) => setCreateForm(prev => ({ ...prev, endTime: e.target.value }))}
          required
        />
      </div>

      {/* Individual Bets */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Individual Markets</h3>
          <Button type="button" onClick={addBulkBet} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Add Market
          </Button>
        </div>

        {bulkCreateForm.bets.map((bet, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium text-gray-900">Market {index + 1}</h4>
              {bulkCreateForm.bets.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeBulkBet(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="space-y-3">
              <Input
                label="Market Title"
                value={bet.title}
                onChange={(e) => updateBulkBet(index, 'title', e.target.value)}
                placeholder="e.g., Fed 50+ bps decrease?"
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={bet.description}
                  onChange={(e) => updateBulkBet(index, 'description', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Market description..."
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Submit */}
      <div className="flex justify-end space-x-3 pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowCreateModal(false)}
        >
          Cancel
        </Button>
        <Button type="submit">
          Create {bulkCreateForm.bets.length} Markets
        </Button>
      </div>
    </form>
  );

  const CreateBetModal = () => (
    <Modal
      isOpen={showCreateModal}
      onClose={() => setShowCreateModal(false)}
      title={bulkCreateMode ? "Create Nested Markets" : "Create New Bet"}
      size={bulkCreateMode ? "xl" : "lg"}
    >
      {bulkCreateMode ? (
        <BulkCreateForm />
      ) : (
        <form onSubmit={handleCreateBet} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input
              label="Bet Title"
              value={createForm.title}
              onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Will Bitcoin reach $100k by 2024?"
              required
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Detailed description of the bet..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={createForm.categoryId}
              onChange={(e) => setCreateForm(prev => ({ ...prev, categoryId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select Category</option>
              {categories.map(category => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bet Type
            </label>
            <select
              value={createForm.betType}
              onChange={(e) => setCreateForm(prev => ({ ...prev, betType: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={1}>Multiple Choice</option>
              <option value={2}>Binary (Yes/No)</option>
              <option value={3}>Sports (3-way)</option>
            </select>
          </div>

          <div>
            <Input
              label="End Date & Time"
              type="datetime-local"
              value={createForm.endTime}
              onChange={(e) => setCreateForm(prev => ({ ...prev, endTime: e.target.value }))}
              min={new Date().toISOString().slice(0, 16)}
              required
            />
          </div>

          <div>
            <Input
              label="Image URL"
              value={createForm.imageUrl}
              onChange={(e) => setCreateForm(prev => ({ ...prev, imageUrl: e.target.value }))}
              placeholder="https://example.com/image.jpg"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Betting Options
          </label>
          <div className="space-y-2">
            {createForm.options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  required
                />
                {createForm.options.length > 2 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeOption(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            {createForm.options.length < 10 && (
              <Button
                type="button"
                variant="outline"
                onClick={addOption}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Option
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={createForm.mustShowLive}
              onChange={(e) => setCreateForm(prev => ({ ...prev, mustShowLive: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Show live indicator</span>
          </label>
        </div>

        {createForm.mustShowLive && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <Input
              label="Live Start Time"
              type="datetime-local"
              value={createForm.liveStartTime}
              onChange={(e) => setCreateForm(prev => ({ ...prev, liveStartTime: e.target.value }))}
            />
            <Input
              label="Live End Time"
              type="datetime-local"
              value={createForm.liveEndTime}
              onChange={(e) => setCreateForm(prev => ({ ...prev, liveEndTime: e.target.value }))}
            />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowCreateModal(false)}
          >
            Cancel
          </Button>
          <Button type="submit">
            Create Bet
          </Button>
        </div>
      </form>
      )}
    </Modal>
  );

  const ResolveBetModal = () => (
    <Modal
      isOpen={showResolveModal}
      onClose={() => setShowResolveModal(false)}
      title="Resolve Bet"
    >
      {selectedBet && (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900">{selectedBet.title}</h3>
            <p className="text-sm text-gray-600 mt-1">
              Select the winning option to resolve this bet.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Winning Option
            </label>
            {selectedBet.options?.map((option, index) => (
              <button
                key={index}
                onClick={() => handleResolveBet(selectedBet.id, index)}
                className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-gray-900">{option.title}</div>
                <div className="text-sm text-gray-500">
                  {option.totalShares?.toLocaleString() || 0} shares
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowResolveModal(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bet Management</h2>
          <p className="text-gray-600 mt-1">Create, manage, and resolve betting markets</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setBulkCreateMode(!bulkCreateMode)}
            variant={bulkCreateMode ? "secondary" : "outline"}
          >
            <Target className="w-4 h-4 mr-2" />
            {bulkCreateMode ? 'Single Mode' : 'Bulk Create'}
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {bulkCreateMode ? 'Create Group' : 'Create New Bet'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search bets..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="ended">Ended</option>
            <option value="resolved">Resolved</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={filters.category}
            onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>

          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            More Filters
          </Button>
        </div>
      </div>

      {/* Bets Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" text="Loading bets..." />
        </div>
      ) : bets.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {bets.map(bet => (
            <BetCard key={bet.id} bet={bet} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No bets found</h3>
          <p className="text-gray-600 mb-4">
            {filters.search || filters.status !== 'all' || filters.category !== 'all'
              ? 'Try adjusting your filters to see more results.'
              : 'Get started by creating your first betting market.'
            }
          </p>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create First Bet
          </Button>
        </div>
      )}

      {/* Modals */}
      <CreateBetModal />
      <ResolveBetModal />
    </div>
  );
};

export default BetManagement;