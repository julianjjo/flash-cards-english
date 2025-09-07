import axios from 'axios';
import tokenStorage from '../utils/storageUtils.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

class AuthService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = tokenStorage.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor to handle auth errors
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          this.removeToken();
          // Redirect to login could be handled by the app
          window.dispatchEvent(new CustomEvent('auth:logout'));
        }
        return Promise.reject(error);
      }
    );
  }

  // Token management
  getToken() {
    return tokenStorage.getAccessToken();
  }

  setToken(token, expiresIn = 86400) {
    if (token) {
      tokenStorage.setAccessToken(token, expiresIn);
      this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }

  removeToken() {
    tokenStorage.removeAccessToken();
    delete this.api.defaults.headers.common['Authorization'];
  }

  // Authentication methods
  async register(userData) {
    try {
      const response = await this.api.post('/auth/register', userData);
      const { token, user } = response.data;
      
      if (token) {
        this.setToken(token);
      }
      
      return { success: true, user, token };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async login(credentials) {
    try {
      const response = await this.api.post('/auth/login', credentials);
      const { token, user } = response.data;
      
      if (token) {
        this.setToken(token);
      }
      
      return { success: true, user, token };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async logout() {
    this.removeToken();
    window.dispatchEvent(new CustomEvent('auth:logout'));
    return { success: true };
  }

  async getCurrentUser() {
    try {
      const response = await this.api.get('/auth/profile');
      return response.data.user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateProfile(profileData) {
    try {
      const response = await this.api.put('/auth/profile', profileData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteAccount(password) {
    try {
      const response = await this.api.delete('/auth/profile', {
        data: { password }
      });
      this.removeToken();
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Admin methods
  async getAllUsers(params = {}) {
    try {
      const response = await this.api.get('/admin/users', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUserById(userId) {
    try {
      const response = await this.api.get(`/admin/users/${userId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateUserRole(userId, role) {
    try {
      const response = await this.api.put(`/admin/users/${userId}`, { role });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteUser(userId) {
    try {
      const response = await this.api.delete(`/admin/users/${userId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Utility methods
  isAuthenticated() {
    const token = this.getToken();
    if (!token) return false;

    try {
      // Simple token expiry check (decode JWT payload)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      
      if (payload.exp < currentTime) {
        this.removeToken();
        return false;
      }
      
      return true;
    } catch (error) {
      this.removeToken();
      return false;
    }
  }

  getUserFromToken() {
    const token = this.getToken();
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        id: payload.id,
        email: payload.email,
        role: payload.role
      };
    } catch (error) {
      return null;
    }
  }

  isAdmin() {
    const user = this.getUserFromToken();
    return user?.role === 'admin';
  }

  // Error handling
  handleError(error) {
    if (error.response?.data) {
      return {
        success: false,
        message: error.response.data.message || 'An error occurred',
        errors: error.response.data.errors || null,
        status: error.response.status
      };
    }
    
    if (error.request) {
      return {
        success: false,
        message: 'Network error - please check your connection',
        status: 0
      };
    }
    
    return {
      success: false,
      message: error.message || 'An unexpected error occurred',
      status: 500
    };
  }
}

// Export singleton instance
export default new AuthService();