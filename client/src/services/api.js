/**
 * API Service Layer
 * 
 * Centralized HTTP client for all backend API requests.
 * Features:
 * - Automatic authentication token handling
 * - Request/response interceptors
 * - Error handling and retry logic
 * - API endpoint organization
 * - TypeScript-like JSDoc annotations
 */

// API configuration
const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:4000',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000 // 1 second
};

/**
 * Base API client class
 */
class ApiClient {
  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.timeout = API_CONFIG.TIMEOUT;
  }

  /**
   * Make HTTP request with automatic token handling
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise<Response>} - Fetch response
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    // Default request configuration
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include', // Include cookies for refresh tokens
      ...options
    };

    // Add authorization header if token exists
    const token = localStorage.getItem('accessToken');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    config.signal = controller.signal;

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);
      
      // Handle common HTTP errors
      if (!response.ok) {
        await this.handleHttpError(response);
      }

      return response;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      throw error;
    }
  }

  /**
   * Handle HTTP errors
   * @param {Response} response - HTTP response
   */
  async handleHttpError(response) {
    let errorData;
    
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
    }

    const error = new Error(errorData.message || `HTTP ${response.status}`);
    error.status = response.status;
    error.code = errorData.code;
    error.errors = errorData.errors;

    throw error;
  }

  /**
   * GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise<any>} - Response data
   */
  async get(endpoint, options = {}) {
    const response = await this.request(endpoint, {
      method: 'GET',
      ...options
    });
    
    return response.json();
  }

  /**
   * POST request
   * @param {string} endpoint - API endpoint
   * @param {any} data - Request body data
   * @param {Object} options - Request options
   * @returns {Promise<any>} - Response data
   */
  async post(endpoint, data = null, options = {}) {
    const response = await this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options
    });
    
    return response.json();
  }

  /**
   * PUT request
   * @param {string} endpoint - API endpoint
   * @param {any} data - Request body data
   * @param {Object} options - Request options
   * @returns {Promise<any>} - Response data
   */
  async put(endpoint, data = null, options = {}) {
    const response = await this.request(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...options
    });
    
    return response.json();
  }

  /**
   * PATCH request
   * @param {string} endpoint - API endpoint
   * @param {any} data - Request body data
   * @param {Object} options - Request options
   * @returns {Promise<any>} - Response data
   */
  async patch(endpoint, data = null, options = {}) {
    const response = await this.request(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
      ...options
    });
    
    return response.json();
  }

  /**
   * DELETE request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise<any>} - Response data
   */
  async delete(endpoint, options = {}) {
    const response = await this.request(endpoint, {
      method: 'DELETE',
      ...options
    });
    
    return response.json();
  }
}

// Create API client instance
const apiClient = new ApiClient();

/**
 * Authentication API endpoints
 */
export const authApi = {
  /**
   * User login
   * @param {Object} credentials - Login credentials
   * @param {string} credentials.email - User email
   * @param {string} credentials.password - User password
   * @param {boolean} credentials.rememberMe - Remember me option
   * @returns {Promise<Object>} - Auth response with user and tokens
   */
  login: (credentials) => apiClient.post('/api/auth/login', credentials),

  /**
   * User registration
   * @param {Object} userData - Registration data
   * @param {string} userData.email - User email
   * @param {string} userData.password - User password
   * @returns {Promise<Object>} - Auth response with user and tokens
   */
  register: (userData) => apiClient.post('/api/auth/register', userData),

  /**
   * Refresh access token
   * @returns {Promise<Object>} - New access token and user data
   */
  refreshToken: () => apiClient.post('/api/auth/refresh'),

  /**
   * User logout
   * @returns {Promise<Object>} - Logout confirmation
   */
  logout: () => apiClient.post('/api/auth/logout'),

  /**
   * Get current user profile
   * @returns {Promise<Object>} - Current user data
   */
  getCurrentUser: () => apiClient.get('/api/auth/me'),

  /**
   * Change user password
   * @param {Object} passwordData - Password change data
   * @param {string} passwordData.currentPassword - Current password
   * @param {string} passwordData.newPassword - New password
   * @returns {Promise<Object>} - Success response
   */
  changePassword: (passwordData) => apiClient.post('/api/auth/change-password', passwordData),

  /**
   * Verify access token
   * @returns {Promise<Object>} - Token validity and user data
   */
  verifyToken: () => apiClient.post('/api/auth/verify-token'),

  /**
   * Get session information
   * @returns {Promise<Object>} - Current session info
   */
  getSessionInfo: () => apiClient.get('/api/auth/session-info')
};

/**
 * User management API endpoints
 */
export const userApi = {
  /**
   * Get user profile by ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - User profile data
   */
  getProfile: (userId) => apiClient.get(`/api/users/profile/${userId}`),

  /**
   * Get current user's profile
   * @returns {Promise<Object>} - Current user profile
   */
  getMyProfile: () => apiClient.get('/api/users/me'),

  /**
   * Update user profile
   * @param {number} userId - User ID
   * @param {Object} updateData - Profile update data
   * @returns {Promise<Object>} - Updated user data
   */
  updateProfile: (userId, updateData) => apiClient.put(`/api/users/profile/${userId}`, updateData),

  /**
   * Update current user's profile
   * @param {Object} updateData - Profile update data
   * @returns {Promise<Object>} - Updated user data
   */
  updateMyProfile: (updateData) => apiClient.put('/api/users/me', updateData),

  /**
   * Change user password
   * @param {number} userId - User ID
   * @param {Object} passwordData - Password change data
   * @returns {Promise<Object>} - Success response
   */
  changeUserPassword: (userId, passwordData) => apiClient.post(`/api/users/change-password/${userId}`, passwordData),

  /**
   * Change current user's password
   * @param {Object} passwordData - Password change data
   * @returns {Promise<Object>} - Success response
   */
  changeMyPassword: (passwordData) => apiClient.post('/api/users/me/change-password', passwordData),

  /**
   * Delete user account
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Success response
   */
  deleteAccount: (userId) => apiClient.delete(`/api/users/profile/${userId}`),

  /**
   * Delete current user's account
   * @returns {Promise<Object>} - Success response
   */
  deleteMyAccount: () => apiClient.delete('/api/users/me'),

  /**
   * Get user statistics
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - User statistics
   */
  getUserStats: (userId) => apiClient.get(`/api/users/stats/${userId}`),

  /**
   * Get current user's statistics
   * @returns {Promise<Object>} - Current user statistics
   */
  getMyStats: () => apiClient.get('/api/users/me/stats'),

  /**
   * Check if user exists
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - User existence status
   */
  checkUserExists: (userId) => apiClient.get(`/api/users/exists/${userId}`)
};

/**
 * Flashcard API endpoints
 */
export const flashcardApi = {
  /**
   * Create new flashcard
   * @param {Object} flashcardData - Flashcard data
   * @param {string} flashcardData.english - English text
   * @param {string} flashcardData.spanish - Spanish text
   * @param {number} flashcardData.difficulty - Initial difficulty
   * @returns {Promise<Object>} - Created flashcard
   */
  create: (flashcardData) => apiClient.post('/api/flashcards', flashcardData),

  /**
   * Get flashcard by ID
   * @param {number} flashcardId - Flashcard ID
   * @returns {Promise<Object>} - Flashcard data
   */
  getById: (flashcardId) => apiClient.get(`/api/flashcards/${flashcardId}`),

  /**
   * Update flashcard
   * @param {number} flashcardId - Flashcard ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} - Updated flashcard
   */
  update: (flashcardId, updateData) => apiClient.put(`/api/flashcards/${flashcardId}`, updateData),

  /**
   * Delete flashcard
   * @param {number} flashcardId - Flashcard ID
   * @returns {Promise<Object>} - Success response
   */
  delete: (flashcardId) => apiClient.delete(`/api/flashcards/${flashcardId}`),

  /**
   * Get user's flashcards
   * @param {number} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - User's flashcards
   */
  getUserFlashcards: (userId, options = {}) => {
    const params = new URLSearchParams(options);
    return apiClient.get(`/api/flashcards/user/${userId}?${params}`);
  },

  /**
   * Get current user's flashcards
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Current user's flashcards
   */
  getMyFlashcards: (options = {}) => {
    const params = new URLSearchParams(options);
    return apiClient.get(`/api/flashcards/my/cards?${params}`);
  },

  /**
   * Review a flashcard
   * @param {number} flashcardId - Flashcard ID
   * @param {Object} reviewData - Review data
   * @param {number} reviewData.performanceRating - Performance rating (0-5)
   * @returns {Promise<Object>} - Updated flashcard
   */
  review: (flashcardId, reviewData) => apiClient.post(`/api/flashcards/${flashcardId}/review`, reviewData),

  /**
   * Get flashcard count for user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Flashcard count
   */
  getCount: (userId) => apiClient.get(`/api/flashcards/count/${userId}`),

  /**
   * Get current user's flashcard count
   * @returns {Promise<Object>} - Current user's flashcard count
   */
  getMyCount: () => apiClient.get('/api/flashcards/my/count'),

  /**
   * Bulk import flashcards
   * @param {Object} importData - Import data
   * @param {Array} importData.flashcards - Array of flashcard data
   * @returns {Promise<Object>} - Import results
   */
  bulkImport: (importData) => apiClient.post('/api/flashcards/import', importData)
};

/**
 * Study session API endpoints
 */
export const studyApi = {
  /**
   * Get study session for user
   * @param {number} userId - User ID
   * @param {Object} options - Session options
   * @returns {Promise<Object>} - Study session data
   */
  getSession: (userId, options = {}) => {
    const params = new URLSearchParams(options);
    return apiClient.get(`/api/study/session/${userId}?${params}`);
  },

  /**
   * Get study session for current user
   * @param {Object} options - Session options
   * @returns {Promise<Object>} - Study session data
   */
  getMySession: (options = {}) => {
    const params = new URLSearchParams(options);
    return apiClient.get(`/api/study/my-session?${params}`);
  },

  /**
   * Review flashcard in study session
   * @param {number} flashcardId - Flashcard ID
   * @param {Object} reviewData - Review data
   * @returns {Promise<Object>} - Review results
   */
  reviewCard: (flashcardId, reviewData) => apiClient.post(`/api/study/review/${flashcardId}`, reviewData),

  /**
   * Complete study session
   * @param {Object} sessionData - Session completion data
   * @returns {Promise<Object>} - Session results
   */
  completeSession: (sessionData) => apiClient.post('/api/study/session/complete', sessionData),

  /**
   * Get cards due for review
   * @param {number} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Due cards
   */
  getDueCards: (userId, options = {}) => {
    const params = new URLSearchParams(options);
    return apiClient.get(`/api/study/due/${userId}?${params}`);
  },

  /**
   * Get current user's cards due for review
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Due cards
   */
  getMyDueCards: (options = {}) => {
    const params = new URLSearchParams(options);
    return apiClient.get(`/api/study/my-due?${params}`);
  },

  /**
   * Get study recommendations
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Study recommendations
   */
  getRecommendations: (userId) => apiClient.get(`/api/study/recommendations/${userId}`),

  /**
   * Get current user's study recommendations
   * @returns {Promise<Object>} - Study recommendations
   */
  getMyRecommendations: () => apiClient.get('/api/study/my-recommendations')
};

/**
 * Statistics API endpoints
 */
export const statsApi = {
  /**
   * Get user statistics
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - User statistics
   */
  getUserStats: (userId) => apiClient.get(`/api/stats/user/${userId}`),

  /**
   * Get current user statistics
   * @returns {Promise<Object>} - Current user statistics
   */
  getMyStats: () => apiClient.get('/api/stats/my-stats'),

  /**
   * Get system statistics (admin only)
   * @returns {Promise<Object>} - System statistics
   */
  getSystemStats: () => apiClient.get('/api/stats/system'),

  /**
   * Get dashboard statistics
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Dashboard statistics
   */
  getDashboard: (userId) => apiClient.get(`/api/stats/dashboard/${userId}`),

  /**
   * Get current user's dashboard statistics
   * @returns {Promise<Object>} - Dashboard statistics
   */
  getMyDashboard: () => apiClient.get('/api/stats/my-dashboard'),

  /**
   * Get performance analytics
   * @param {number} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Performance analytics
   */
  getPerformance: (userId, options = {}) => {
    const params = new URLSearchParams(options);
    return apiClient.get(`/api/stats/performance/${userId}?${params}`);
  },

  /**
   * Get current user's performance analytics
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Performance analytics
   */
  getMyPerformance: (options = {}) => {
    const params = new URLSearchParams(options);
    return apiClient.get(`/api/stats/my-performance?${params}`);
  },

  /**
   * Export user statistics
   * @param {number} userId - User ID
   * @param {Object} options - Export options
   * @returns {Promise<Object>} - Export data
   */
  exportStats: (userId, options = {}) => {
    const params = new URLSearchParams(options);
    return apiClient.get(`/api/stats/export/${userId}?${params}`);
  }
};

/**
 * Admin API endpoints
 */
export const adminApi = {
  /**
   * Get all users (admin only)
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Paginated users list
   */
  getAllUsers: (options = {}) => {
    const params = new URLSearchParams(options);
    return apiClient.get(`/api/admin/users?${params}`);
  },

  /**
   * Get user details (admin only)
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Detailed user information
   */
  getUserDetails: (userId) => apiClient.get(`/api/admin/users/${userId}`),

  /**
   * Update user (admin only)
   * @param {number} userId - User ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} - Updated user
   */
  updateUser: (userId, updateData) => apiClient.put(`/api/admin/users/${userId}`, updateData),

  /**
   * Delete user (admin only)
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Success response
   */
  deleteUser: (userId) => apiClient.delete(`/api/admin/users/${userId}`),

  /**
   * Promote user to admin
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Updated user
   */
  promoteUser: (userId) => apiClient.post(`/api/admin/users/${userId}/promote`),

  /**
   * Demote admin to user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Updated user
   */
  demoteUser: (userId) => apiClient.post(`/api/admin/users/${userId}/demote`),

  /**
   * Get user's flashcards (admin only)
   * @param {number} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - User's flashcards
   */
  getUserFlashcards: (userId, options = {}) => {
    const params = new URLSearchParams(options);
    return apiClient.get(`/api/admin/users/${userId}/flashcards?${params}`);
  },

  /**
   * Delete all user flashcards (admin only)
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Success response
   */
  deleteUserFlashcards: (userId) => apiClient.delete(`/api/admin/users/${userId}/flashcards`),

  /**
   * Reset user password (admin only)
   * @param {number} userId - User ID
   * @param {Object} passwordData - New password data
   * @returns {Promise<Object>} - Success response
   */
  resetUserPassword: (userId, passwordData) => apiClient.post(`/api/admin/users/${userId}/reset-password`, passwordData),

  /**
   * Get system health (admin only)
   * @returns {Promise<Object>} - System health information
   */
  getSystemHealth: () => apiClient.get('/api/admin/system/health'),

  /**
   * Trigger system maintenance (admin only)
   * @param {Object} maintenanceData - Maintenance tasks data
   * @returns {Promise<Object>} - Maintenance results
   */
  performMaintenance: (maintenanceData) => apiClient.post('/api/admin/system/maintenance', maintenanceData)
};

/**
 * Bulk operations API endpoints
 */
export const bulkApi = {
  /**
   * Bulk import flashcards
   * @param {Object} importData - Import data
   * @returns {Promise<Object>} - Import results
   */
  importFlashcards: (importData) => apiClient.post('/api/bulk/flashcards/import', importData),

  /**
   * Bulk update flashcards
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} - Update results
   */
  updateFlashcards: (updateData) => apiClient.put('/api/bulk/flashcards/update', updateData),

  /**
   * Bulk delete flashcards
   * @param {Object} deleteData - Delete data
   * @returns {Promise<Object>} - Delete results
   */
  deleteFlashcards: (deleteData) => apiClient.delete('/api/bulk/flashcards/delete', {
    body: JSON.stringify(deleteData)
  }),

  /**
   * Bulk review flashcards
   * @param {Object} reviewData - Review data
   * @returns {Promise<Object>} - Review results
   */
  reviewFlashcards: (reviewData) => apiClient.post('/api/bulk/flashcards/review', reviewData),

  /**
   * Bulk user actions (admin only)
   * @param {Object} actionData - Action data
   * @returns {Promise<Object>} - Action results
   */
  performUserActions: (actionData) => apiClient.post('/api/bulk/users/actions', actionData),

  /**
   * Bulk export data
   * @param {Object} exportData - Export data
   * @returns {Promise<Object>} - Export results
   */
  exportData: (exportData) => apiClient.post('/api/bulk/export', exportData)
};

// Export default API client
export default apiClient;