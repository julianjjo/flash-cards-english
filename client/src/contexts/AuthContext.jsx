import { createContext, useContext, useReducer, useEffect } from 'react';

/**
 * AuthContext
 * 
 * Provides authentication state and methods throughout the application.
 * Features:
 * - JWT token management with automatic refresh
 * - User state management
 * - Authentication persistence with localStorage
 * - Automatic token refresh handling
 * - Loading states and error handling
 */

const AuthContext = createContext();

// Action types for auth reducer
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  REFRESH_TOKEN: 'REFRESH_TOKEN',
  UPDATE_USER: 'UPDATE_USER',
  SET_LOADING: 'SET_LOADING',
  CLEAR_ERROR: 'CLEAR_ERROR'
};

// Initial auth state
const initialState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  error: null
};

// Auth reducer to manage authentication state
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
      return {
        ...state,
        isLoading: true,
        error: null
      };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        isAuthenticated: true,
        isLoading: false,
        error: null
      };

    case AUTH_ACTIONS.LOGIN_FAILURE:
      return {
        ...state,
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload.error
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      };

    case AUTH_ACTIONS.REFRESH_TOKEN:
      return {
        ...state,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        isAuthenticated: true,
        error: null
      };

    case AUTH_ACTIONS.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload.user }
      };

    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload.isLoading
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    default:
      return state;
  }
};

// AuthProvider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // API base URL - should be configurable via environment variables
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

  // Helper function to make authenticated requests
  const makeAuthenticatedRequest = async (url, options = {}) => {
    const token = state.accessToken || localStorage.getItem('accessToken');
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers
      },
      credentials: 'include' // Include cookies for refresh tokens
    };

    try {
      const response = await fetch(`${API_BASE_URL}${url}`, config);
      
      // Handle token expiration
      if (response.status === 401) {
        const errorData = await response.json();
        
        if (errorData.code === 'TOKEN_EXPIRED') {
          // Try to refresh token
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            // Retry the original request with new token
            config.headers.Authorization = `Bearer ${state.accessToken}`;
            return fetch(`${API_BASE_URL}${url}`, config);
          }
        }
        
        // If refresh failed or other auth error, logout
        logout();
        throw new Error('Authentication failed');
      }

      return response;
    } catch (error) {
      console.error('Request failed:', error);
      throw error;
    }
  };

  // Login function
  const login = async (credentials) => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store access token in localStorage
      localStorage.setItem('accessToken', data.accessToken);

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: {
          user: data.user,
          accessToken: data.accessToken
        }
      });

      return data;

    } catch (error) {
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: { error: error.message }
      });
      throw error;
    }
  };

  // Register function
  const register = async (userData) => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // Store access token in localStorage
      localStorage.setItem('accessToken', data.accessToken);

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: {
          user: data.user,
          accessToken: data.accessToken
        }
      });

      return data;

    } catch (error) {
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: { error: error.message }
      });
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // Call logout endpoint to clear refresh token cookie
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    }

    // Clear local storage and state regardless of API call success
    localStorage.removeItem('accessToken');
    dispatch({ type: AUTH_ACTIONS.LOGOUT });
  };

  // Refresh access token function
  const refreshAccessToken = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Token refresh failed');
      }

      // Update access token in localStorage
      localStorage.setItem('accessToken', data.accessToken);

      dispatch({
        type: AUTH_ACTIONS.REFRESH_TOKEN,
        payload: {
          user: data.user,
          accessToken: data.accessToken
        }
      });

      return true;

    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      return false;
    }
  };

  // Update user profile
  const updateProfile = async (profileData) => {
    try {
      const response = await makeAuthenticatedRequest('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Profile update failed');
      }

      dispatch({
        type: AUTH_ACTIONS.UPDATE_USER,
        payload: { user: data.user }
      });

      return data;

    } catch (error) {
      console.error('Profile update failed:', error);
      throw error;
    }
  };

  // Change password
  const changePassword = async (passwordData) => {
    try {
      const response = await makeAuthenticatedRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(passwordData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Password change failed');
      }

      return data;

    } catch (error) {
      console.error('Password change failed:', error);
      throw error;
    }
  };

  // Delete account
  const deleteAccount = async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/users/me', {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Account deletion failed');
      }

      // Logout after successful account deletion
      logout();

      return data;

    } catch (error) {
      console.error('Account deletion failed:', error);
      throw error;
    }
  };

  // Get current user info
  const getCurrentUser = async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/auth/me');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get user info');
      }

      dispatch({
        type: AUTH_ACTIONS.UPDATE_USER,
        payload: { user: data.user }
      });

      return data.user;

    } catch (error) {
      console.error('Get current user failed:', error);
      throw error;
    }
  };

  // Clear error
  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  // Check if user is admin
  const isAdmin = () => {
    return state.user?.role === 'admin';
  };

  // Check if user is authenticated
  const isAuthenticated = () => {
    return state.isAuthenticated && state.accessToken;
  };

  // Initialize authentication state on app load
  useEffect(() => {
    const initializeAuth = async () => {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: true } });

      const storedToken = localStorage.getItem('accessToken');
      
      if (storedToken) {
        try {
          // Verify token and get current user
          const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${storedToken}`
            },
            credentials: 'include'
          });

          if (response.ok) {
            const data = await response.json();
            
            dispatch({
              type: AUTH_ACTIONS.LOGIN_SUCCESS,
              payload: {
                user: data.user,
                accessToken: storedToken
              }
            });
          } else {
            // Token is invalid, try to refresh
            const refreshed = await refreshAccessToken();
            if (!refreshed) {
              localStorage.removeItem('accessToken');
            }
          }
        } catch (error) {
          console.error('Auth initialization failed:', error);
          localStorage.removeItem('accessToken');
        }
      }

      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: false } });
    };

    initializeAuth();
  }, []);

  // Set up automatic token refresh
  useEffect(() => {
    if (state.accessToken) {
      // Refresh token every 14 minutes (tokens expire in 15 minutes)
      const refreshInterval = setInterval(() => {
        refreshAccessToken();
      }, 14 * 60 * 1000);

      return () => clearInterval(refreshInterval);
    }
  }, [state.accessToken]);

  const value = {
    // State
    user: state.user,
    accessToken: state.accessToken,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,

    // Actions
    login,
    register,
    logout,
    refreshAccessToken,
    updateProfile,
    changePassword,
    deleteAccount,
    getCurrentUser,
    clearError,

    // Utilities
    isAdmin,
    isAuthenticated: isAuthenticated,
    makeAuthenticatedRequest
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

// Higher-order component to protect routes
export const withAuth = (Component) => {
  return function AuthenticatedComponent(props) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
            <p className="text-gray-600">Please log in to access this page.</p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
};

// Higher-order component to protect admin routes
export const withAdminAuth = (Component) => {
  return function AdminAuthenticatedComponent(props) {
    const { isAuthenticated, isAdmin, isLoading } = useAuth();

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
            <p className="text-gray-600">Please log in to access this page.</p>
          </div>
        </div>
      );
    }

    if (!isAdmin()) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Admin Access Required</h2>
            <p className="text-gray-600">You need administrator privileges to access this page.</p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
};

export default AuthContext;