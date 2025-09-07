import React, { createContext, useContext, useReducer, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext();

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_START':
    case 'REGISTER_START':
      return {
        ...state,
        isLoading: true,
        error: null
      };
    
    case 'LOGIN_SUCCESS':
    case 'REGISTER_SUCCESS':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.token,
        error: null
      };
    
    case 'LOGIN_FAILURE':
    case 'REGISTER_FAILURE':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        token: null,
        error: action.payload
      };
    
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null,
        error: null,
        isLoading: false
      };
    
    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload
      };
    
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false
      };
    
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };
    
    case 'INITIALIZE':
      return {
        ...state,
        isAuthenticated: action.payload.isAuthenticated,
        user: action.payload.user,
        token: action.payload.token,
        isLoading: false
      };
    
    default:
      return state;
  }
};

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const isAuthenticated = authService.isAuthenticated();
        
        if (isAuthenticated) {
          const user = authService.getUserFromToken();
          const token = authService.getToken();
          
          // Verify token is still valid by fetching current user
          try {
            const currentUser = await authService.getCurrentUser();
            dispatch({
              type: 'INITIALIZE',
              payload: {
                isAuthenticated: true,
                user: currentUser,
                token
              }
            });
          } catch (error) {
            // Token is invalid, clear auth
            authService.removeToken();
            dispatch({
              type: 'INITIALIZE',
              payload: {
                isAuthenticated: false,
                user: null,
                token: null
              }
            });
          }
        } else {
          dispatch({
            type: 'INITIALIZE',
            payload: {
              isAuthenticated: false,
              user: null,
              token: null
            }
          });
        }
      } catch (error) {
        dispatch({
          type: 'INITIALIZE',
          payload: {
            isAuthenticated: false,
            user: null,
            token: null
          }
        });
      }
    };

    initializeAuth();
  }, []);

  // Listen for auth events from the service
  useEffect(() => {
    const handleLogout = () => {
      dispatch({ type: 'LOGOUT' });
    };

    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  const login = async (credentials) => {
    dispatch({ type: 'LOGIN_START' });
    
    try {
      const result = await authService.login(credentials);
      
      if (result.success) {
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            user: result.user,
            token: result.token
          }
        });
        return { success: true, user: result.user };
      } else {
        dispatch({
          type: 'LOGIN_FAILURE',
          payload: result.message || 'Login failed'
        });
        return result;
      }
    } catch (error) {
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: error.message || 'Login failed'
      });
      return { success: false, message: error.message || 'Login failed' };
    }
  };

  const register = async (userData) => {
    dispatch({ type: 'REGISTER_START' });
    
    try {
      const result = await authService.register(userData);
      
      if (result.success) {
        dispatch({
          type: 'REGISTER_SUCCESS',
          payload: {
            user: result.user,
            token: result.token
          }
        });
        return { success: true, user: result.user };
      } else {
        dispatch({
          type: 'REGISTER_FAILURE',
          payload: result.message || 'Registration failed'
        });
        return result;
      }
    } catch (error) {
      dispatch({
        type: 'REGISTER_FAILURE',
        payload: error.message || 'Registration failed'
      });
      return { success: false, message: error.message || 'Registration failed' };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      dispatch({ type: 'LOGOUT' });
      return { success: true };
    } catch (error) {
      dispatch({ type: 'LOGOUT' });
      return { success: false, message: error.message };
    }
  };

  const updateProfile = async (profileData) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const result = await authService.updateProfile(profileData);
      
      if (result.success) {
        dispatch({ type: 'UPDATE_USER', payload: result.user });
        dispatch({ type: 'SET_LOADING', payload: false });
        return { success: true, user: result.user };
      } else {
        dispatch({ type: 'SET_ERROR', payload: result.message });
        return result;
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Profile update failed' });
      return { success: false, message: error.message || 'Profile update failed' };
    }
  };

  const deleteAccount = async (password) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const result = await authService.deleteAccount(password);
      
      if (result.success) {
        dispatch({ type: 'LOGOUT' });
        return { success: true };
      } else {
        dispatch({ type: 'SET_ERROR', payload: result.message });
        return result;
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Account deletion failed' });
      return { success: false, message: error.message || 'Account deletion failed' };
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const isAdmin = () => {
    return state.user?.role === 'admin';
  };

  const value = {
    // State
    user: state.user,
    token: state.token,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    
    // Actions
    login,
    register,
    logout,
    updateProfile,
    deleteAccount,
    clearError,
    
    // Utilities
    isAdmin
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;