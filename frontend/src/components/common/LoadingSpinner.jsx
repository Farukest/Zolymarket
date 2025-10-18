import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ 
  size = 'md', 
  color = 'blue', 
  text = null, 
  fullScreen = false,
  className = '',
  ...props 
}) => {
  // Size variants
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
    '2xl': 'w-16 h-16',
  };

  // Color variants
  const colorClasses = {
    blue: 'text-blue-600',
    gray: 'text-gray-600',
    green: 'text-green-600',
    red: 'text-red-600',
    yellow: 'text-yellow-600',
    purple: 'text-purple-600',
    indigo: 'text-indigo-600',
    pink: 'text-pink-600',
    white: 'text-white',
    current: 'text-current',
  };

  // Text size based on spinner size
  const textSizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
  };

  const spinnerClasses = `
    ${sizeClasses[size]} 
    ${colorClasses[color]} 
    animate-spin 
    ${className}
  `.trim();

  const Spinner = () => (
    <Loader2 className={spinnerClasses} {...props} />
  );

  const SpinnerWithText = () => (
    <div className="flex flex-col items-center gap-3">
      <Spinner />
      {text && (
        <p className={`${textSizeClasses[size]} ${colorClasses[color]} font-medium`}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-90 backdrop-blur-sm z-50">
        <div className="text-center">
          <SpinnerWithText />
        </div>
      </div>
    );
  }

  if (text) {
    return <SpinnerWithText />;
  }

  return <Spinner />;
};

// Skeleton loading component
export const SkeletonLoader = ({ 
  lines = 3, 
  className = '',
  lineHeight = 'h-4',
  spacing = 'space-y-3'
}) => (
  <div className={`animate-pulse ${spacing} ${className}`}>
    {Array.from({ length: lines }, (_, index) => (
      <div
        key={index}
        className={`bg-gray-200 rounded ${lineHeight} ${
          index === lines - 1 ? 'w-3/4' : 'w-full'
        }`}
      />
    ))}
  </div>
);

// Card skeleton loader
export const CardSkeleton = ({ className = '' }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`}>
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-4">
        <div className="w-12 h-12 bg-gray-200 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
      
      {/* Content */}
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
        <div className="h-4 bg-gray-200 rounded w-4/6" />
      </div>
      
      {/* Footer */}
      <div className="flex justify-between items-center mt-6">
        <div className="h-8 bg-gray-200 rounded w-20" />
        <div className="h-8 bg-gray-200 rounded w-24" />
      </div>
    </div>
  </div>
);

// Table skeleton loader
export const TableSkeleton = ({ rows = 5, columns = 4, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}>
    <div className="animate-pulse">
      {/* Table Header */}
      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
        <div className="flex space-x-4">
          {Array.from({ length: columns }, (_, index) => (
            <div key={index} className="h-4 bg-gray-200 rounded flex-1" />
          ))}
        </div>
      </div>
      
      {/* Table Rows */}
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="px-6 py-4 border-b border-gray-200 last:border-b-0">
          <div className="flex space-x-4">
            {Array.from({ length: columns }, (_, colIndex) => (
              <div 
                key={colIndex} 
                className={`h-4 bg-gray-200 rounded flex-1 ${
                  colIndex === 0 ? 'w-1/4' : colIndex === columns - 1 ? 'w-1/6' : ''
                }`} 
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Button loading state
export const LoadingButton = ({ 
  loading = false, 
  children, 
  disabled = false,
  className = '',
  size = 'md',
  ...props 
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 font-medium rounded-lg
        border transition-all duration-200 focus:outline-none focus:ring-2 
        focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${loading ? 'cursor-not-allowed' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <LoadingSpinner size={size === 'lg' ? 'md' : 'sm'} color="current" />
      )}
      {children}
    </button>
  );
};

// Page loading component
export const PageLoader = ({ message = 'Loading...' }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <LoadingSpinner size="xl" color="blue" />
      <p className="mt-4 text-lg text-gray-600 font-medium">{message}</p>
    </div>
  </div>
);

// Inline loading state
export const InlineLoader = ({ text = 'Loading...', className = '' }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <LoadingSpinner size="sm" color="current" />
    <span className="text-sm text-gray-600">{text}</span>
  </div>
);

// Overlay loading component
export const OverlayLoader = ({ show = false, message = 'Loading...' }) => {
  if (!show) return null;

  return (
    <div className="absolute inset-0 bg-white bg-opacity-90 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
      <div className="text-center">
        <LoadingSpinner size="lg" color="blue" />
        <p className="mt-3 text-gray-600 font-medium">{message}</p>
      </div>
    </div>
  );
};

// Loading states for different components
export const BetCardSkeleton = () => (
  <CardSkeleton className="hover:shadow-lg transition-shadow duration-200" />
);

export const ProfileSkeleton = () => (
  <div className="space-y-6">
    {/* Header */}
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="animate-pulse flex items-center space-x-4">
        <div className="w-16 h-16 bg-gray-200 rounded-full" />
        <div className="flex-1">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    </div>
    
    {/* Stats */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-8 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
    
    {/* Content */}
    <TableSkeleton rows={8} columns={5} />
  </div>
);

export default LoadingSpinner;