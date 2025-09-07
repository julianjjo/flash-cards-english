import bcrypt from 'bcrypt';
import User from '../models/User.js';

/**
 * UserService
 * 
 * Business logic layer for user operations including registration,
 * profile management, admin functions, and user validation.
 * 
 * Handles password hashing, validation, and user data sanitization.
 */

class UserService {
  constructor() {
    this.saltRounds = 12;
  }

  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @param {string} userData.email - User email
   * @param {string} userData.password - Plain text password
   * @param {string} [userData.role='user'] - User role
   * @returns {Object} Created user data (sanitized)
   */
  async register(userData) {
    const { email, password, role = 'user' } = userData;

    // Validate input
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Validate password strength
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Validate role
    if (!User.isValidRole(role)) {
      throw new Error('Invalid user role');
    }

    try {
      // Hash password
      const password_hash = await bcrypt.hash(password, this.saltRounds);

      // Create user
      const newUser = await User.create({
        email: email.toLowerCase().trim(),
        password_hash,
        role
      });

      return User.sanitize(newUser);

    } catch (error) {
      if (error.message.includes('already registered') || error.message.includes('already taken')) {
        throw new Error('Email already registered');
      }
      throw error;
    }
  }

  /**
   * Get user profile by ID
   * @param {number} userId - User ID
   * @param {number} requestingUserId - ID of user making request
   * @param {string} requestingUserRole - Role of user making request
   * @returns {Object|null} User profile data
   */
  async getProfile(userId, requestingUserId, requestingUserRole) {
    if (!User.canAccessResource(requestingUserId, userId, requestingUserRole)) {
      throw new Error('Access denied');
    }

    const user = await User.findById(userId);
    return User.sanitize(user);
  }

  /**
   * Update user profile
   * @param {number} userId - User ID to update
   * @param {Object} updateData - Data to update
   * @param {number} requestingUserId - ID of user making request
   * @param {string} requestingUserRole - Role of user making request
   * @returns {Object|null} Updated user data
   */
  async updateProfile(userId, updateData, requestingUserId, requestingUserRole) {
    if (!User.canAccessResource(requestingUserId, userId, requestingUserRole)) {
      throw new Error('Access denied');
    }

    // Validate email if being updated
    if (updateData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateData.email)) {
        throw new Error('Invalid email format');
      }
    }

    // Validate role if being updated (admin only)
    if (updateData.role && requestingUserRole !== 'admin') {
      throw new Error('Only admins can update user roles');
    }

    try {
      const updatedUser = await User.update(userId, updateData);
      return User.sanitize(updatedUser);

    } catch (error) {
      if (error.message.includes('already taken')) {
        throw new Error('Email already taken');
      }
      throw error;
    }
  }

  /**
   * Change user password
   * @param {number} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @param {number} requestingUserId - ID of user making request
   * @param {string} requestingUserRole - Role of user making request
   * @returns {boolean} Success status
   */
  async changePassword(userId, currentPassword, newPassword, requestingUserId, requestingUserRole) {
    if (!User.canAccessResource(requestingUserId, userId, requestingUserRole)) {
      throw new Error('Access denied');
    }

    // Validate new password
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long');
    }

    // Get user with password hash for verification
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const userWithPassword = await User.findByEmail(user.email);
    if (!userWithPassword) {
      throw new Error('User not found');
    }

    // Verify current password (admins can skip this)
    if (requestingUserRole !== 'admin') {
      if (!currentPassword) {
        throw new Error('Current password is required');
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userWithPassword.password_hash);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, this.saltRounds);

    // Update password
    return User.updatePassword(userId, newPasswordHash);
  }

  /**
   * Delete user account
   * @param {number} userId - User ID to delete
   * @param {number} requestingUserId - ID of user making request
   * @param {string} requestingUserRole - Role of user making request
   * @returns {boolean} Success status
   */
  async deleteAccount(userId, requestingUserId, requestingUserRole) {
    if (!User.canAccessResource(requestingUserId, userId, requestingUserRole)) {
      throw new Error('Access denied');
    }

    // Prevent deletion of the last admin user
    if (requestingUserRole === 'admin') {
      const stats = await User.getStats();
      if (stats.adminUsers <= 1) {
        const user = await User.findById(userId);
        if (user && user.role === 'admin') {
          throw new Error('Cannot delete the last admin user');
        }
      }
    }

    return User.delete(userId);
  }

  /**
   * Get paginated user list (admin only)
   * @param {Object} options - Query options
   * @param {number} requestingUserId - ID of user making request
   * @param {string} requestingUserRole - Role of user making request
   * @returns {Object} Paginated user list
   */
  async getAllUsers(options, requestingUserId, requestingUserRole) {
    if (requestingUserRole !== 'admin') {
      throw new Error('Admin access required');
    }

    return User.findAll(options);
  }

  /**
   * Get detailed user information (admin only)
   * @param {number} userId - User ID
   * @param {number} requestingUserId - ID of user making request
   * @param {string} requestingUserRole - Role of user making request
   * @returns {Object|null} Detailed user information
   */
  async getUserDetails(userId, requestingUserId, requestingUserRole) {
    if (requestingUserRole !== 'admin') {
      throw new Error('Admin access required');
    }

    return User.findByIdDetailed(userId);
  }

  /**
   * Get user statistics (admin only)
   * @param {number} requestingUserId - ID of user making request
   * @param {string} requestingUserRole - Role of user making request
   * @returns {Object} User statistics
   */
  async getUserStats(requestingUserId, requestingUserRole) {
    if (requestingUserRole !== 'admin') {
      throw new Error('Admin access required');
    }

    return User.getStats();
  }

  /**
   * Check if user exists
   * @param {number} userId - User ID
   * @returns {boolean} Whether user exists
   */
  async userExists(userId) {
    return User.exists(userId);
  }

  /**
   * Get user by email (for internal use)
   * @param {string} email - User email
   * @returns {Object|null} User data with password_hash
   */
  async getUserByEmail(email) {
    return User.findByEmail(email);
  }

  /**
   * Get public user data by email
   * @param {string} email - User email
   * @returns {Object|null} User data without password_hash
   */
  async getPublicUserByEmail(email) {
    const user = await User.findByEmailPublic(email);
    return User.sanitize(user);
  }

  /**
   * Verify user password
   * @param {string} plainPassword - Plain text password
   * @param {string} hashedPassword - Hashed password from database
   * @returns {boolean} Whether password matches
   */
  async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Promote user to admin (super admin only)
   * @param {number} userId - User ID to promote
   * @param {number} requestingUserId - ID of user making request
   * @param {string} requestingUserRole - Role of user making request
   * @returns {Object|null} Updated user data
   */
  async promoteToAdmin(userId, requestingUserId, requestingUserRole) {
    if (requestingUserRole !== 'admin') {
      throw new Error('Admin access required');
    }

    const updatedUser = await User.update(userId, { role: 'admin' });
    return User.sanitize(updatedUser);
  }

  /**
   * Demote admin to regular user (super admin only)
   * @param {number} userId - User ID to demote
   * @param {number} requestingUserId - ID of user making request
   * @param {string} requestingUserRole - Role of user making request
   * @returns {Object|null} Updated user data
   */
  async demoteToUser(userId, requestingUserId, requestingUserRole) {
    if (requestingUserRole !== 'admin') {
      throw new Error('Admin access required');
    }

    // Prevent demotion of the last admin user
    const stats = await User.getStats();
    if (stats.adminUsers <= 1) {
      const user = await User.findById(userId);
      if (user && user.role === 'admin') {
        throw new Error('Cannot demote the last admin user');
      }
    }

    const updatedUser = await User.update(userId, { role: 'user' });
    return User.sanitize(updatedUser);
  }

  /**
   * Validate user registration data
   * @param {Object} userData - User data to validate
   * @returns {Object} Validation result
   */
  static validateRegistration(userData) {
    const errors = [];
    const { email, password, role } = userData;

    if (!email) {
      errors.push('Email is required');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push('Invalid email format');
      }
    }

    if (!password) {
      errors.push('Password is required');
    } else if (password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }

    if (role && !User.isValidRole(role)) {
      errors.push('Invalid user role');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate user profile update data
   * @param {Object} updateData - Update data to validate
   * @returns {Object} Validation result
   */
  static validateProfileUpdate(updateData) {
    const errors = [];
    const { email, role } = updateData;

    if (email !== undefined) {
      if (!email) {
        errors.push('Email cannot be empty');
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          errors.push('Invalid email format');
        }
      }
    }

    if (role !== undefined && !User.isValidRole(role)) {
      errors.push('Invalid user role');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate password change data
   * @param {Object} passwordData - Password change data
   * @returns {Object} Validation result
   */
  static validatePasswordChange(passwordData) {
    const errors = [];
    const { newPassword, currentPassword } = passwordData;

    if (!newPassword) {
      errors.push('New password is required');
    } else if (newPassword.length < 6) {
      errors.push('New password must be at least 6 characters long');
    }

    if (!currentPassword) {
      errors.push('Current password is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
const userService = new UserService();
export default userService;