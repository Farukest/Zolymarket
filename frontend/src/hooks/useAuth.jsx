import { createContext, useContext, useReducer, useEffect } from 'react';
import { useWallet } from './useWallet';

// Auth context
const AuthContext = createContext(null);

// Auth action types
const AUTH_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_USER: 'SET_USER',
  SET_TOKEN: 'SET_TOKEN',
  SET_ERROR: 'SET_ERROR',
  LOGOUT: 'LOGOUT',
  SET_PERMISSIONS: 'SET_PERMISSIONS',
};

// Initial state
const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  permissions: [],
};

// Auth reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };

    case AUTH_ACTIONS.SET_USER:
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
        error: null,
      };

    case AUTH_ACTIONS.SET_TOKEN:
      return {
        ...state,
        token: action.payload,
      };

    case AUTH_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...initialState,
        isLoading: false,
      };

    case AUTH_ACTIONS.SET_PERMISSIONS:
      return {
        ...state,
        permissions: action.payload,
      };

    default:
      return state;
  }
};

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const { account, isConnected } = useWallet();

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Handle wallet connection changes
  useEffect(() => {
    if (isConnected && account && !state.isAuthenticated) {
      // Auto-authenticate when wallet connects
      authenticateWithWallet();
    } else if (!isConnected && state.isAuthenticated) {
      // Logout when wallet disconnects
      logout();
    }
  }, [isConnected, account]);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
        return;
      }

      // Validate token with backend - Skip if backend is not available
      const response = await fetch('/api/auth/validate', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).catch(() => null);

      if (response && response.ok) {
        const data = await response.json();
        dispatch({ type: AUTH_ACTIONS.SET_TOKEN, payload: token });
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: data.data.user });
        dispatch({ type: AUTH_ACTIONS.SET_PERMISSIONS, payload: data.data.permissions || [] });
      } else {
        // Token is invalid or backend not available
        if (response && !response.ok) {
          localStorage.removeItem('token');
        }
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
    }
  };

  const authenticateWithWallet = async () => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });

      if (!account) {
        throw new Error('No wallet connected');
      }

      // Request signature for authentication
      const message = `Sign this message to authenticate with Zolymarket FHEVM.\n\nAddress: ${account}\nTimestamp: ${Date.now()}`;
      
      // Sign message with wallet
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, account],
      });

      // Authenticate with backend
      const response = await fetch('/api/auth/wallet-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: account,
          message,
          signature,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Store token
        localStorage.setItem('token', data.data.token);
        
        dispatch({ type: AUTH_ACTIONS.SET_TOKEN, payload: data.data.token });
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: data.data.user });
        dispatch({ type: AUTH_ACTIONS.SET_PERMISSIONS, payload: data.data.permissions || [] });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Authentication failed');
      }
    } catch (error) {
      console.error('Wallet authentication failed:', error);
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: error.message });
    }
  };

  const logout = async () => {
    try {
      // Notify backend about logout
      if (state.token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${state.token}`
          }
        });
      }
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      // Clear local storage and state
      localStorage.removeItem('token');
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    }
  };

  const refreshUser = async () => {
    try {
      if (!state.token) return;

      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${state.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        dispatch({ type: AUTH_ACTIONS.SET_USER, payload: data.data.user });
        dispatch({ type: AUTH_ACTIONS.SET_PERMISSIONS, payload: data.data.permissions || [] });
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const updateUser = (userData) => {
    dispatch({ type: AUTH_ACTIONS.SET_USER, payload: { ...state.user, ...userData } });
  };

  // Permission helpers
  const hasPermission = (permission) => {
    return state.permissions.includes(permission);
  };

  const hasRole = (role) => {
    return state.user?.role === role;
  };

  const isAdmin = hasRole('admin');
  const isModerator = hasRole('moderator') || isAdmin;

  const value = {
    // State
    ...state,
    
    // Computed properties
    isAdmin,
    isModerator,
    
    // Actions
    login: authenticateWithWallet,
    logout,
    refreshUser,
    updateUser,
    hasPermission,
    hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/* Custom hook to use auth context */
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

/* Higher-order component for protected routes */
export const withAuth = (Component, requiredRole = null, requiredPermission = null) => {
  return function AuthenticatedComponent(props) {
    const { isAuthenticated, isLoading, hasRole, hasPermission, user } = useAuth();

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h1>
            <p className="text-gray-600 mb-6">Please connect your wallet to continue.</p>
            <button
              onClick={() => window.location.href = '/'}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Home
            </button>
          </div>
        </div>
      );
    }

    if (requiredRole && !hasRole(requiredRole)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600 mb-6">
              You don't have the required role ({requiredRole}) to access this page.
            </p>
            <button
              onClick={() => window.history.back()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Permission Denied</h1>
            <p className="text-gray-600 mb-6">
              You don't have the required permission ({requiredPermission}) to access this page.
            </p>
            <button
              onClick={() => window.history.back()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
};

// Hook for authentication actions
export const useAuthActions = () => {
  const { login, logout, refreshUser, updateUser } = useAuth();
  
  return {
    login,
    logout,
    refreshUser,
    updateUser,
  };
};

// Hook for permission checking
export const usePermissions = () => {
  const { permissions, hasPermission, hasRole, isAdmin, isModerator } = useAuth();
  
  return {
    permissions,
    hasPermission,
    hasRole,
    isAdmin,
    isModerator,
  };
};

export default useAuth;