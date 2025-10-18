import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import BetGrid from '../components/home/BetGrid';
import CategoryTabs from '../components/home/CategoryTabs';
import { TrendingUp, Clock, Zap, Star } from 'lucide-react';

const Home = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeFilter, setActiveFilter] = useState(searchParams.get('filter') || 'trending');
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Read search directly from URL
  const searchQuery = searchParams.get('search') || '';

  // Update URL when filter changes (search is handled by Header)
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (activeFilter !== 'trending') {
      params.set('filter', activeFilter);
    } else {
      params.delete('filter');
    }
    // Preserve search param if it exists
    if (searchQuery) {
      params.set('search', searchQuery);
    }
    setSearchParams(params);
  }, [activeFilter]);

  const filters = [
    {
      id: 'trending',
      label: 'Trending',
      icon: TrendingUp,
      description: 'Most popular markets'
    },
    {
      id: 'new',
      label: 'New',
      icon: Zap,
      description: 'Recently created markets'
    },
    {
      id: 'ending-soon',
      label: 'Ending Soon',
      icon: Clock,
      description: 'Markets closing within 24 hours'
    },
    {
      id: 'bookmarked',
      label: 'Bookmarked',
      icon: Star,
      description: 'Your saved markets'
    }
  ];

  const handleFilterChange = (filterId) => {
    setActiveFilter(filterId);
    setSelectedCategory(null); // Clear category when changing filter
  };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    setActiveFilter('category'); // Set to category mode
  };

  return (
    <div className="min-h-screen site-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        

        {/* Filter Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200 dark:border-gray-800">
            <nav className="flex space-x-8 overflow-x-auto">
              {filters.map((filter) => {
                const Icon = filter.icon;
                const isActive = activeFilter === filter.id;
                
                return (
                  <button
                    key={filter.id}
                    onClick={() => handleFilterChange(filter.id)}
                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                      isActive
                        ? 'border-primary-6 text-primary-8 dark:text-primary-6'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {filter.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Category Tabs */}
        <CategoryTabs 
          onCategorySelect={handleCategorySelect}
          selectedCategory={selectedCategory}
          className="mb-8"
        />


        {/* Search info */}
        {searchQuery && (
          <div className="mb-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md flex items-center justify-between">
            <p className="text-sm text-blue-900 dark:text-blue-200 m-0">
              Searching for: <span className="font-semibold">"{searchQuery}"</span>
            </p>
            <button
              onClick={() => {
                const params = new URLSearchParams(searchParams);
                params.delete('search');
                setSearchParams(params);
              }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Clear
            </button>
          </div>
        )}

        {/* Main Content - Bet Grid */}
        <BetGrid
          filter={activeFilter === 'category' ? 'all' : activeFilter}
          categoryId={selectedCategory}
          searchQuery={searchQuery}
        />

        {/* Decorative Divider */}
        <div className="mt-16 mb-8 flex items-center justify-center">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent"></div>
          <div className="mx-4 flex gap-1">
            {/*<div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-600"></div>*/}
            {/*<div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-500"></div>*/}
            {/*<div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-600"></div>*/}
          </div>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent"></div>
        </div>

        {/* Footer Info */}
        <div className="text-center">
          <div className="bg-gradient-to-r from-primary-2/50 to-tint-3/50 dark:from-primary-9/20 dark:to-tint-9/20 rounded-xl p-8 border border-primary-4/30 dark:border-primary-7/30">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Why Choose Our Platform?
            </h3>
            <div className="grid md:grid-cols-3 gap-6 text-sm text-gray-600 dark:text-gray-400">
              <div className="space-y-2">
                <div className="w-12 h-12 bg-primary-3/50 dark:bg-primary-8/30 rounded-lg flex items-center justify-center mx-auto">
                  <TrendingUp className="w-6 h-6 text-primary-8 dark:text-primary-6" />
                </div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  Private Betting
                </h4>
                <p>
                  Your bet amounts and positions remain completely private using 
                  advanced homomorphic encryption technology.
                </p>
              </div>
              <div className="space-y-2">
                <div className="w-12 h-12 bg-tint-4/50 dark:bg-tint-8/30 rounded-lg flex items-center justify-center mx-auto">
                  <Zap className="w-6 h-6 text-tint-8 dark:text-tint-6" />
                </div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  Instant Settlement
                </h4>
                <p>
                  Smart contracts automatically settle bets when events conclude, 
                  ensuring fast and fair payouts.
                </p>
              </div>
              <div className="space-y-2">
                <div className="w-12 h-12 bg-primary-4/50 dark:bg-primary-9/30 rounded-lg flex items-center justify-center mx-auto">
                  <Star className="w-6 h-6 text-primary-9 dark:text-primary-7" />
                </div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  Transparent Odds
                </h4>
                <p>
                  Real-time odds based on collective market sentiment, 
                  providing accurate probability assessments.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;