import React, { useState, useRef, useEffect } from 'react';
import { Search, Menu, X } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import WalletConnect from './WalletConnect';
import NetworkSelector from './NetworkSelector';
import FaucetButton from './FaucetButton';
import FaucetBanner from './FaucetBanner';

const Header = () => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const searchInputRef = useRef(null);
  const navigate = useNavigate();

  // Update local search when URL changes
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    setSearchQuery(urlSearch);
  }, [searchParams]);

  // Navigation items
  const navItems = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Trending', path: '/?filter=trending' },
    { name: 'Breaking', path: '/?filter=breaking' },
    { name: 'New', path: '/?filter=new' },
    { name: 'Politics', path: '/category/politics' },
    { name: 'Sports', path: '/category/sports' },
    { name: 'Crypto', path: '/category/crypto' },
    { name: 'Tech', path: '/category/tech' },
    { name: 'Culture', path: '/category/culture' },
  ];

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    // Update URL with search query
    if (query.trim()) {
      setSearchParams({ ...Object.fromEntries(searchParams), search: query });
    } else {
      const params = new URLSearchParams(searchParams);
      params.delete('search');
      setSearchParams(params);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    const params = new URLSearchParams(searchParams);
    params.delete('search');
    setSearchParams(params);
  };

  const handleLogoClick = () => {
    setSearchQuery('');
    navigate('/');
    setShowMobileMenu(false);
  };

  return (
    <>
      <header className="bg-white/80 backdrop-blur-md border-b border-primary-subtle/20 sticky top-0 z-40" style={{backgroundColor: 'rgba(var(--tint-2), 0.8)'}}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <button
                onClick={handleLogoClick}
                className="flex items-center gap-4 text-xl font-semibold text-primary-subtle hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 relative">
                  <div className="dice-mini">
                    <div className="dice-face-mini dice-face-front">
                      <div className="dot-mini"></div>
                    </div>
                    <div className="dice-face-mini dice-face-top">
                      <div className="dot-mini"></div>
                      <div className="dot-mini"></div>
                    </div>
                  </div>
                </div>
                Zolymarket
              </button>
            </div>

            {/* Search Bar - Desktop */}
            <div className="hidden md:flex flex-1 max-w-2xl mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search all markets..."
                  className="w-full pl-10 pr-10 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Desktop Navigation & Wallet */}
            <div className="hidden md:flex items-center gap-4">
              <Link
                to="/wallet"
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg font-medium transition-colors"
              >
                Wallet
              </Link>
              <NetworkSelector />
              <FaucetButton />
              <WalletConnect />
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center gap-2">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {showMobileMenu ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>

          {/* Navigation Bar - Desktop */}
          {/*<div className="hidden md:block border-t border-gray-200 dark:border-gray-800">*/}
          {/*  <nav className="flex items-center space-x-8 py-3">*/}
          {/*    {navItems.map((item) => (*/}
          {/*      <Link*/}
          {/*        key={item.name}*/}
          {/*        to={item.path}*/}
          {/*        className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"*/}
          {/*      >*/}
          {/*        {item.name}*/}
          {/*      </Link>*/}
          {/*    ))}*/}
          {/*  </nav>*/}
          {/*</div>*/}
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="px-4 py-3 space-y-3">
              {/* Search Bar - Mobile */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search all markets..."
                  className="w-full pl-10 pr-10 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Wallet Connect - Mobile */}
              <div className="pb-3 border-b border-gray-200 dark:border-gray-800 space-y-3">
                <Link
                  to="/wallet"
                  onClick={() => setShowMobileMenu(false)}
                  className="block px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg font-medium transition-colors w-full text-center"
                >
                  Wallet
                </Link>
                <NetworkSelector />
                <FaucetButton />
                <WalletConnect />
              </div>

              {/* Navigation - Mobile */}
              <nav className="space-y-2">
                {navItems.map((item) => (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setShowMobileMenu(false)}
                    className="block px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        )}
      </header>

      {/* Faucet Info Banner */}
      <FaucetBanner />
    </>
  );
};

export default Header;