import jwt from 'jsonwebtoken';
import UserService from './UserService.js';

/**
 * AuthService
 * 
 * Handles JWT authentication, token generation/validation,
 * session management, and auth-related business logic.
 * 
 * Uses access tokens (15min) and refresh tokens (7 days).
 * Access tokens stored in localStorage, refresh tokens in httpOnly cookies.
 */

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    
    if (!this.jwtSecret || !this.jwtRefreshSecret) {
      throw new Error('JWT secrets must be configured in environment variables');
    }

    // Token expiry times
    this.accessTokenExpiry = '15m';
    this.refreshTokenExpiry = '7d';

    // Cookie settings for refresh tokens
    this.refreshTokenCookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
    };
  }

  /**
   * Login user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Object} Auth response with tokens and user data
   */
  async login(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Get user with password hash
    const user = await UserService.getUserByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await UserService.verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const tokens = this.generateTokens(user);

    // Return sanitized user data with tokens
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }

  /**
   * Register new user and login
   * @param {Object} userData - Registration data
   * @returns {Object} Auth response with tokens and user data
   */
  async register(userData) {
    // Register user through UserService
    const newUser = await UserService.register(userData);

    // Generate tokens for the new user
    const tokens = this.generateTokens(newUser);

    return {
      user: newUser,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Object} New access token
   */
  async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret);
      
      // Get current user data
      const user = await UserService.getUserByEmail(decoded.email);
      if (!user) {
        throw new Error('Invalid refresh token');
      }

      // Generate new access token
      const accessToken = this.generateAccessToken(user);

      return {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        }
      };

    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        throw new Error('Invalid or expired refresh token');
      }
      throw error;
    }
  }

  /**
   * Logout user (invalidate tokens on client side)
   * @returns {Object} Success message
   */
  async logout() {
    // Note: With JWT, we rely on client-side token removal
    // In a more secure implementation, we might maintain a token blacklist
    return {
      message: 'Logged out successfully'
    };
  }

  /**
   * Verify access token and return user data
   * @param {string} accessToken - JWT access token
   * @returns {Object} Decoded user data
   */
  async verifyAccessToken(accessToken) {
    if (!accessToken) {
      throw new Error('Access token is required');
    }

    try {
      const decoded = jwt.verify(accessToken, this.jwtSecret);
      
      // Verify user still exists and get current data
      const user = await UserService.getUserByEmail(decoded.email);
      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        iat: decoded.iat,
        exp: decoded.exp
      };

    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid access token');
      }
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token expired');
      }
      throw error;
    }
  }

  /**
   * Verify refresh token
   * @param {string} refreshToken - JWT refresh token
   * @returns {Object} Decoded token data
   */
  async verifyRefreshToken(refreshToken) {
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    try {
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret);
      
      // Verify user still exists
      const user = await UserService.getUserByEmail(decoded.email);
      if (!user) {
        throw new Error('User not found');
      }

      return {
        userId: user.id,
        email: user.email,
        role: user.role,
        iat: decoded.iat,
        exp: decoded.exp
      };

    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      }
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired');
      }
      throw error;
    }
  }

  /**
   * Generate both access and refresh tokens
   * @param {Object} user - User data
   * @returns {Object} Token pair
   */
  generateTokens(user) {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      accessToken,
      refreshToken
    };
  }

  /**
   * Generate access token (short-lived)
   * @param {Object} user - User data
   * @returns {string} JWT access token
   */
  generateAccessToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      type: 'access'
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'flashcards-app',
      audience: 'flashcards-users'
    });
  }

  /**
   * Generate refresh token (long-lived)
   * @param {Object} user - User data
   * @returns {string} JWT refresh token
   */
  generateRefreshToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      type: 'refresh'
    };

    return jwt.sign(payload, this.jwtRefreshSecret, {
      expiresIn: this.refreshTokenExpiry,
      issuer: 'flashcards-app',
      audience: 'flashcards-users'
    });
  }

  /**
   * Get refresh token cookie options
   * @returns {Object} Cookie options
   */
  getRefreshTokenCookieOptions() {
    return { ...this.refreshTokenCookieOptions };
  }

  /**
   * Get cookie options for clearing refresh token
   * @returns {Object} Cookie clear options
   */
  getClearRefreshTokenCookieOptions() {
    return {
      ...this.refreshTokenCookieOptions,
      expires: new Date(0),
      maxAge: 0
    };
  }

  /**
   * Change user password with authentication
   * @param {string} email - User email
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Object} Success message
   */
  async changePassword(email, currentPassword, newPassword) {
    // Get user
    const user = await UserService.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    // Use UserService to change password
    await UserService.changePassword(user.id, currentPassword, newPassword, user.id, user.role);

    return {
      message: 'Password changed successfully'
    };
  }

  /**
   * Check if user has required role
   * @param {Object} user - User data
   * @param {string} requiredRole - Required role
   * @returns {boolean} Whether user has required role
   */
  hasRole(user, requiredRole) {
    if (!user || !user.role) {
      return false;
    }

    // Admin has all permissions
    if (user.role === 'admin') {
      return true;
    }

    return user.role === requiredRole;
  }

  /**
   * Check if user is admin
   * @param {Object} user - User data
   * @returns {boolean} Whether user is admin
   */
  isAdmin(user) {
    return user && user.role === 'admin';
  }

  /**
   * Check if user can access resource
   * @param {Object} user - User data
   * @param {number} resourceUserId - Resource owner ID
   * @returns {boolean} Whether user can access resource
   */
  canAccessUserResource(user, resourceUserId) {
    if (!user) {
      return false;
    }

    // Admin can access all resources
    if (user.role === 'admin') {
      return true;
    }

    // Users can only access their own resources
    return Number(user.id) === Number(resourceUserId);
  }

  /**
   * Extract token from Authorization header
   * @param {string} authHeader - Authorization header value
   * @returns {string|null} Token or null if not found
   */
  extractTokenFromHeader(authHeader) {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Validate login credentials format
   * @param {Object} credentials - Login credentials
   * @returns {Object} Validation result
   */
  static validateLoginCredentials(credentials) {
    const errors = [];
    const { email, password } = credentials;

    if (!email) {
      errors.push('Email is required');
    } else if (typeof email !== 'string' || email.trim().length === 0) {
      errors.push('Valid email is required');
    }

    if (!password) {
      errors.push('Password is required');
    } else if (typeof password !== 'string' || password.length === 0) {
      errors.push('Valid password is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate password change request
   * @param {Object} passwordData - Password change data
   * @returns {Object} Validation result
   */
  static validatePasswordChangeRequest(passwordData) {
    const errors = [];
    const { currentPassword, newPassword } = passwordData;

    if (!currentPassword) {
      errors.push('Current password is required');
    }

    if (!newPassword) {
      errors.push('New password is required');
    } else if (newPassword.length < 6) {
      errors.push('New password must be at least 6 characters long');
    }

    if (currentPassword === newPassword) {
      errors.push('New password must be different from current password');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get token expiry information
   * @param {string} token - JWT token
   * @returns {Object} Token expiry info
   */
  getTokenExpiry(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) {
        return null;
      }

      const now = Math.floor(Date.now() / 1000);
      const expiresAt = decoded.exp;
      const expiresIn = expiresAt - now;

      return {
        expiresAt: new Date(expiresAt * 1000),
        expiresIn,
        isExpired: expiresIn <= 0
      };

    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService;