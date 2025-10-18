import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Shield,
  Lock,
  Users,
  DollarSign,
  Target,
  ChevronRight,
  Play,
  Star,
  Zap
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../ui/Button';

const HeroSection = () => {
  // Try to use auth context, but fall back to wallet if not available
  let user = null;
  try {
    const authContext = useAuth();
    user = authContext.user;
  } catch (error) {
    // Auth context not available, will use wallet context instead
    console.log('Auth context not available in HeroSection, using wallet context');
  }
  const [stats, setStats] = useState({
    totalVolume: 0,
    totalUsers: 0,
    activeBets: 0,
    averageReturn: 0
  });
  const [currentFeature, setCurrentFeature] = useState(0);

  const features = [
    {
      icon: Lock,
      title: 'Private Betting',
      description: 'Your bet amounts are encrypted and private until resolution'
    },
    {
      icon: Shield,
      title: 'Secure & Audited',
      description: 'Smart contracts audited by leading security firms'
    },
    {
      icon: Zap,
      title: 'Instant Settlement',
      description: 'Automatic payouts when markets resolve'
    }
  ];

  useEffect(() => {
    fetchPlatformStats();
    
    // Rotate features every 3 seconds
    const interval = setInterval(() => {
      setCurrentFeature(prev => (prev + 1) % features.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const fetchPlatformStats = async () => {
    try {
      const response = await fetch('/api/stats/platform');
      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch platform stats:', error);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(amount);
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.1%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20" />
      
      {/* Floating Elements */}
      <div className="absolute top-20 left-10 w-20 h-20 bg-blue-500 rounded-full opacity-10 animate-pulse" />
      <div className="absolute top-40 right-20 w-32 h-32 bg-purple-500 rounded-full opacity-10 animate-pulse delay-1000" />
      <div className="absolute bottom-20 left-20 w-16 h-16 bg-indigo-500 rounded-full opacity-10 animate-pulse delay-2000" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Main Content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white text-sm font-medium mb-6">
              <Star className="w-4 h-4 text-yellow-400" />
              <span>Powered by FHEVM Technology</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Private Prediction
              <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Markets
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl text-blue-100 mb-8 leading-relaxed max-w-2xl">
              Trade on the world's first private prediction markets. 
              Your bet amounts stay encrypted while outcomes remain transparent.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              {user ? (
                <Button size="lg" className="bg-white text-blue-900 hover:bg-blue-50">
                  <Target className="w-5 h-5 mr-2" />
                  Start Betting
                </Button>
              ) : (
                <Button size="lg" className="bg-white text-blue-900 hover:bg-blue-50">
                  <Users className="w-5 h-5 mr-2" />
                  Connect Wallet
                </Button>
              )}
              
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white text-white hover:bg-white hover:text-blue-900"
              >
                <Play className="w-5 h-5 mr-2" />
                Watch Demo
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">
                  {formatCurrency(stats.totalVolume)}
                </div>
                <div className="text-blue-200 text-sm">Total Volume</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">
                  {formatNumber(stats.totalUsers)}
                </div>
                <div className="text-blue-200 text-sm">Users</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">
                  {formatNumber(stats.activeBets)}
                </div>
                <div className="text-blue-200 text-sm">Active Bets</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">
                  {stats.averageReturn}%
                </div>
                <div className="text-blue-200 text-sm">Avg Return</div>
              </div>
            </div>
          </div>

          {/* Right Column - Features & Visual */}
          <div className="relative">
            {/* Rotating Feature Cards */}
            <div className="relative h-80 lg:h-96">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className={`
                    absolute inset-0 transition-all duration-500 transform
                    ${index === currentFeature 
                      ? 'opacity-100 translate-y-0 scale-100' 
                      : 'opacity-0 translate-y-4 scale-95'
                    }
                  `}
                >
                  <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 h-full flex flex-col justify-center">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-6">
                        <feature.icon className="w-8 h-8 text-white" />
                      </div>
                      
                      <h3 className="text-2xl font-bold text-white mb-4">
                        {feature.title}
                      </h3>
                      
                      <p className="text-blue-100 text-lg leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Feature Indicators */}
            <div className="flex justify-center gap-2 mt-6">
              {features.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentFeature(index)}
                  className={`
                    w-3 h-3 rounded-full transition-all duration-300
                    ${index === currentFeature 
                      ? 'bg-white scale-125' 
                      : 'bg-white/50 hover:bg-white/75'
                    }
                  `}
                />
              ))}
            </div>

            {/* Technology Badge */}
            <div className="absolute -bottom-6 -right-6 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-4 shadow-2xl">
              <div className="text-center">
                <Lock className="w-8 h-8 text-white mx-auto mb-2" />
                <div className="text-white font-bold text-sm">FHEVM</div>
                <div className="text-blue-100 text-xs">Encrypted</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section - Key Benefits */}
        <div className="mt-20 pt-12 border-t border-white/20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Why Choose Private Betting?
            </h2>
            <p className="text-blue-100 text-lg max-w-3xl mx-auto">
              Traditional prediction markets expose your trading positions. 
              With FHEVM encryption, only you know your bet amounts until resolution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Front-Running Protection
              </h3>
              <p className="text-blue-100">
                Your bets can't be front-run because bet amounts are encrypted
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Privacy First
              </h3>
              <p className="text-blue-100">
                Keep your trading strategy private while maintaining market transparency
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Fair Markets
              </h3>
              <p className="text-blue-100">
                No information asymmetry - everyone trades on equal footing
              </p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full text-white font-medium hover:from-blue-700 hover:to-purple-700 transition-all cursor-pointer group">
            <span>Get Started Today</span>
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;