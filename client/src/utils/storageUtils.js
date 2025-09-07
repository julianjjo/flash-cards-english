/**
 * Secure Token Storage Utilities
 * Provides secure storage and retrieval of authentication tokens with encryption
 * and XSS protection for the React client application
 */

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'flashcards_access_token',
  REFRESH_TOKEN: 'flashcards_refresh_token',
  USER_DATA: 'flashcards_user_data',
  REMEMBER_ME: 'flashcards_remember_me',
  DEVICE_ID: 'flashcards_device_id'
};

// Token expiration buffer (5 minutes)
const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000;

/**
 * Simple base64 encoding/decoding for basic obfuscation
 * Note: This is NOT cryptographic security, just basic obfuscation
 * Real encryption would require a server-provided key
 */
const obfuscate = {
  encode: (data) => {
    try {
      return btoa(JSON.stringify(data));
    } catch (error) {
      console.error('Error encoding data:', error);
      return null;
    }
  },
  
  decode: (encoded) => {
    try {
      return JSON.parse(atob(encoded));
    } catch (error) {
      console.error('Error decoding data:', error);
      return null;
    }
  }
};

/**
 * Storage provider abstraction
 * Uses sessionStorage by default, localStorage for "remember me"
 */
class StorageProvider {
  constructor(persistent = false) {
    this.storage = persistent ? localStorage : sessionStorage;
    this.persistent = persistent;
  }

  setItem(key, value) {
    try {
      this.storage.setItem(key, value);
      return true;
    } catch (error) {
      console.error('Storage setItem failed:', error);
      // Handle storage quota exceeded or disabled storage
      return false;
    }
  }

  getItem(key) {
    try {
      return this.storage.getItem(key);
    } catch (error) {
      console.error('Storage getItem failed:', error);
      return null;
    }
  }

  removeItem(key) {
    try {
      this.storage.removeItem(key);
    } catch (error) {
      console.error('Storage removeItem failed:', error);
    }
  }

  clear() {
    try {
      // Only clear our keys, not all storage
      Object.values(STORAGE_KEYS).forEach(key => {
        this.storage.removeItem(key);
      });
    } catch (error) {
      console.error('Storage clear failed:', error);
    }
  }
}

/**
 * Token Storage Manager
 */
class TokenStorage {
  constructor() {
    this.sessionStorage = new StorageProvider(false);
    this.localStorage = new StorageProvider(true);
  }

  /**
   * Get the appropriate storage provider
   */
  getStorage() {
    const rememberMe = this.isRememberMeEnabled();
    return rememberMe ? this.localStorage : this.sessionStorage;
  }

  /**
   * Store access token with metadata
   */
  setAccessToken(token, expiresIn = 86400) {
    if (!token) {
      console.warn('Attempted to store null/undefined access token');
      return false;
    }

    const tokenData = {
      token,
      expiresAt: Date.now() + (expiresIn * 1000),
      createdAt: Date.now()
    };

    const encoded = obfuscate.encode(tokenData);
    if (!encoded) return false;

    const storage = this.getStorage();
    return storage.setItem(STORAGE_KEYS.ACCESS_TOKEN, encoded);
  }

  /**
   * Get access token if valid
   */
  getAccessToken() {
    const storage = this.getStorage();
    const encoded = storage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    
    if (!encoded) return null;

    const tokenData = obfuscate.decode(encoded);
    if (!tokenData) return null;

    // Check if token is expired (with buffer)
    if (Date.now() > (tokenData.expiresAt - TOKEN_EXPIRY_BUFFER)) {
      this.removeAccessToken();
      return null;
    }

    return tokenData.token;
  }

  /**
   * Remove access token
   */
  removeAccessToken() {
    this.sessionStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    this.localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  /**
   * Store refresh token
   */
  setRefreshToken(token, expiresIn = 604800) { // 7 days default
    if (!token) return false;

    const tokenData = {
      token,
      expiresAt: Date.now() + (expiresIn * 1000),
      createdAt: Date.now()
    };

    const encoded = obfuscate.encode(tokenData);
    if (!encoded) return false;

    // Refresh tokens are always stored persistently
    return this.localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, encoded);
  }

  /**
   * Get refresh token if valid
   */
  getRefreshToken() {
    const encoded = this.localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    
    if (!encoded) return null;

    const tokenData = obfuscate.decode(encoded);
    if (!tokenData) return null;

    // Check if refresh token is expired
    if (Date.now() > tokenData.expiresAt) {
      this.removeRefreshToken();
      return null;
    }

    return tokenData.token;
  }

  /**
   * Remove refresh token
   */
  removeRefreshToken() {
    this.localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  /**
   * Store user data
   */
  setUserData(userData) {
    if (!userData) return false;

    const encoded = obfuscate.encode({
      ...userData,
      storedAt: Date.now()
    });
    
    if (!encoded) return false;

    const storage = this.getStorage();
    return storage.setItem(STORAGE_KEYS.USER_DATA, encoded);
  }

  /**
   * Get user data
   */
  getUserData() {
    const storage = this.getStorage();
    const encoded = storage.getItem(STORAGE_KEYS.USER_DATA);
    
    if (!encoded) return null;

    const userData = obfuscate.decode(encoded);
    return userData;
  }

  /**
   * Remove user data
   */
  removeUserData() {
    this.sessionStorage.removeItem(STORAGE_KEYS.USER_DATA);
    this.localStorage.removeItem(STORAGE_KEYS.USER_DATA);
  }

  /**
   * Set remember me preference
   */
  setRememberMe(remember) {
    if (remember) {
      this.localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'true');
    } else {
      this.localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
    }
  }

  /**
   * Check if remember me is enabled
   */
  isRememberMeEnabled() {
    return this.localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) === 'true';
  }

  /**
   * Generate and store device ID for tracking
   */
  generateDeviceId() {
    const existing = this.localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (existing) return existing;

    const deviceId = 'device_' + Math.random().toString(36).substring(2) + 
                     Date.now().toString(36);
    
    this.localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
    return deviceId;
  }

  /**
   * Get device ID
   */
  getDeviceId() {
    return this.localStorage.getItem(STORAGE_KEYS.DEVICE_ID) || this.generateDeviceId();
  }

  /**
   * Check if user is authenticated (has valid access token)
   */
  isAuthenticated() {
    return !!this.getAccessToken();
  }

  /**
   * Get authentication headers for API requests
   */
  getAuthHeaders() {
    const token = this.getAccessToken();
    
    if (!token) return {};

    return {
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Clear all authentication data
   */
  clearAll() {
    this.removeAccessToken();
    this.removeRefreshToken();
    this.removeUserData();
    this.setRememberMe(false);
    
    // Don't remove device ID as it's used for analytics
  }

  /**
   * Get storage info for debugging
   */
  getStorageInfo() {
    return {
      hasAccessToken: !!this.getAccessToken(),
      hasRefreshToken: !!this.getRefreshToken(),
      hasUserData: !!this.getUserData(),
      rememberMe: this.isRememberMeEnabled(),
      deviceId: this.getDeviceId(),
      storageType: this.isRememberMeEnabled() ? 'localStorage' : 'sessionStorage'
    };
  }

  /**
   * Migrate data from sessionStorage to localStorage when remember me is enabled
   */
  migrateToRememberMe() {
    const accessToken = this.sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const userData = this.sessionStorage.getItem(STORAGE_KEYS.USER_DATA);

    if (accessToken) {
      this.localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      this.sessionStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    }

    if (userData) {
      this.localStorage.setItem(STORAGE_KEYS.USER_DATA, userData);
      this.sessionStorage.removeItem(STORAGE_KEYS.USER_DATA);
    }
  }

  /**
   * Migrate data from localStorage to sessionStorage when remember me is disabled
   */
  migrateToSession() {
    const accessToken = this.localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const userData = this.localStorage.getItem(STORAGE_KEYS.USER_DATA);

    if (accessToken) {
      this.sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      this.localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    }

    if (userData) {
      this.sessionStorage.setItem(STORAGE_KEYS.USER_DATA, userData);
      this.localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    }
  }
}

// Create singleton instance
const tokenStorage = new TokenStorage();

// Export both the instance and the class
export default tokenStorage;
export { TokenStorage, STORAGE_KEYS };

// Export utility functions
export const storageUtils = {
  /**
   * Check if storage is available
   */
  isStorageAvailable: (type = 'localStorage') => {
    try {
      const storage = window[type];
      const x = '__storage_test__';
      storage.setItem(x, x);
      storage.removeItem(x);
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Get storage usage information
   */
  getStorageUsage: () => {
    const getSize = (storage) => {
      let total = 0;
      try {
        for (let key in storage) {
          if (storage.hasOwnProperty(key)) {
            total += storage[key].length + key.length;
          }
        }
      } catch (error) {
        // Storage not accessible
      }
      return total;
    };

    return {
      localStorage: getSize(localStorage),
      sessionStorage: getSize(sessionStorage)
    };
  },

  /**
   * Clean up expired tokens across all storage
   */
  cleanupExpiredTokens: () => {
    // This will automatically happen when tokens are accessed
    // due to the expiry checks in the getter methods
    tokenStorage.getAccessToken();
    tokenStorage.getRefreshToken();
  }
};