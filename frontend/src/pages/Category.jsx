import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BetCard from '../components/home/BetCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { betAPI, categoryAPI } from '../services/api';

const Category = () => {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  
  const [category, setCategory] = useState(null);
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, active, ended
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, popular, ending_soon
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!categoryId) {
      navigate('/');
      return;
    }
    loadCategoryData();
  }, [categoryId]);

  useEffect(() => {
    filterAndSortBets();
  }, [filter, sortBy, searchTerm]);

  const loadCategoryData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [categoryData, betsData] = await Promise.all([
        categoryAPI.getCategoryById(categoryId),
        betAPI.getBetsByCategory(categoryId)
      ]);
      
      setCategory(categoryData);
      setBets(betsData);
    } catch (error) {
      console.error('Error loading category data:', error);
      setError('Failed to load category data');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortBets = () => {
    let filteredBets = [...bets];

    // Apply search filter
    if (searchTerm) {
      filteredBets = filteredBets.filter(bet =>
        bet.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bet.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    switch (filter) {
      case 'active':
        filteredBets = filteredBets.filter(bet => 
          bet.isActive && new Date() < new Date(bet.endTime)
        );
        break;
      case 'ended':
        filteredBets = filteredBets.filter(bet => 
          !bet.isActive || new Date() >= new Date(bet.endTime)
        );
        break;
      default:
        // all - no additional filtering
        break;
    }

    // Apply sorting
    switch (sortBy) {
      case 'oldest':
        filteredBets.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'popular':
        filteredBets.sort((a, b) => (b.totalBets || 0) - (a.totalBets || 0));
        break;
      case 'ending_soon':
        filteredBets = filteredBets
          .filter(bet => bet.isActive && new Date() < new Date(bet.endTime))
          .sort((a, b) => new Date(a.endTime) - new Date(b.endTime));
        break;
      case 'newest':
      default:
        filteredBets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
    }

    return filteredBets;
  };

  const filteredBets = filterAndSortBets();

  const getFilterCount = (filterType) => {
    switch (filterType) {
      case 'active':
        return bets.filter(bet => bet.isActive && new Date() < new Date(bet.endTime)).length;
      case 'ended':
        return bets.filter(bet => !bet.isActive || new Date() >= new Date(bet.endTime)).length;
      default:
        return bets.length;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600 mb-4">{error || 'Category not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen site-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back to Markets
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{category.name}</h1>
                {category.description && (
                  <p className="text-gray-600 mt-2">{category.description}</p>
                )}
              </div>
            </div>
            
            {category.icon && (
              <div className="text-4xl">{category.icon}</div>
            )}
          </div>
          
          <div className="mt-4 flex items-center space-x-6 text-sm text-gray-600">
            <span>{bets.length} total markets</span>
            <span>{getFilterCount('active')} active</span>
            <span>{getFilterCount('ended')} ended</span>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            {/* Search */}
            <div className="flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search markets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center space-x-4">
              {/* Filter Tabs */}
              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                {[
                  { id: 'all', label: 'All', count: getFilterCount('all') },
                  { id: 'active', label: 'Active', count: getFilterCount('active') },
                  { id: 'ended', label: 'Ended', count: getFilterCount('ended') }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      filter === tab.id
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="popular">Most Popular</option>
                <option value="ending_soon">Ending Soon</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bets Grid */}
        {filteredBets.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No markets found</h3>
            <p className="text-gray-600">
              {searchTerm 
                ? `No markets match "${searchTerm}" in this category.`
                : `No ${filter === 'all' ? '' : filter + ' '}markets in this category yet.`
              }
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBets.map((bet) => (
              <BetCard
                key={bet.id}
                bet={bet}
                onClick={() => navigate(`/bet/${bet.id}`)}
              />
            ))}
          </div>
        )}

        {/* Load More (if needed) */}
        {filteredBets.length > 0 && filteredBets.length >= 20 && (
          <div className="text-center mt-8">
            <button className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors">
              Load More Markets
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Category;