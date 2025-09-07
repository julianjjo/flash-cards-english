import express from 'express';
import UserService from '../services/UserService.js';
import FlashcardService from '../services/FlashcardService.js';
import { requireAuth, extractUserIdFromToken } from '../middleware/auth.js';
import { requireAdminOrSelf } from '../middleware/admin.js';
import { validateUserResourceOwnership } from '../middleware/ownership.js';

const router = express.Router();

/**
 * GET /api/users/profile/:userId
 * Get user profile by ID
 */
router.get('/profile/:userId',
  requireAuth,
  requireAdminOrSelf,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      const userProfile = await UserService.getProfile(userId, req.user.id, req.user.role);
      
      if (!userProfile) {
        return res.status(404).json({
          error: 'User not found',
          message: 'The requested user does not exist',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        user: userProfile
      });

    } catch (error) {
      console.error('Get user profile error:', error);
      
      if (error.message === 'Access denied') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to access this user profile',
          code: 'PROFILE_ACCESS_DENIED'
        });
      }

      res.status(500).json({
        error: 'Failed to get user profile',
        message: 'An error occurred while fetching user profile',
        code: 'PROFILE_FETCH_ERROR'
      });
    }
  }
);

/**
 * GET /api/users/me
 * Get current user's own profile
 */
router.get('/me',
  requireAuth,
  async (req, res) => {
    try {
      const userProfile = await UserService.getProfile(req.user.id, req.user.id, req.user.role);
      
      res.json({
        user: userProfile
      });

    } catch (error) {
      console.error('Get current user profile error:', error);
      
      res.status(500).json({
        error: 'Failed to get user profile',
        message: 'An error occurred while fetching your profile',
        code: 'PROFILE_FETCH_ERROR'
      });
    }
  }
);

/**
 * PUT /api/users/profile/:userId
 * Update user profile
 */
router.put('/profile/:userId',
  requireAuth,
  requireAdminOrSelf,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const updateData = req.body;

      // Validate update data
      const validation = UserService.validateProfileUpdate(updateData);
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Profile update data is invalid',
          errors: validation.errors,
          code: 'VALIDATION_FAILED'
        });
      }

      const updatedUser = await UserService.updateProfile(userId, updateData, req.user.id, req.user.role);
      
      if (!updatedUser) {
        return res.status(404).json({
          error: 'User not found',
          message: 'The requested user does not exist',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        message: 'Profile updated successfully',
        user: updatedUser
      });

    } catch (error) {
      console.error('Update user profile error:', error);
      
      if (error.message === 'Access denied') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to update this user profile',
          code: 'PROFILE_UPDATE_DENIED'
        });
      }

      if (error.message === 'Email already taken') {
        return res.status(409).json({
          error: 'Email already taken',
          message: 'Another user is already using this email address',
          code: 'EMAIL_TAKEN'
        });
      }

      if (error.message === 'Only admins can update user roles') {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'Only administrators can change user roles',
          code: 'ROLE_UPDATE_DENIED'
        });
      }

      res.status(500).json({
        error: 'Failed to update profile',
        message: 'An error occurred while updating the profile',
        code: 'PROFILE_UPDATE_ERROR'
      });
    }
  }
);

/**
 * PUT /api/users/me
 * Update current user's own profile
 */
router.put('/me',
  requireAuth,
  extractUserIdFromToken,
  async (req, res) => {
    try {
      const updateData = req.body;

      // Remove role from update data for non-admin users
      if (req.user.role !== 'admin' && updateData.role) {
        delete updateData.role;
      }

      // Validate update data
      const validation = UserService.validateProfileUpdate(updateData);
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Profile update data is invalid',
          errors: validation.errors,
          code: 'VALIDATION_FAILED'
        });
      }

      const updatedUser = await UserService.updateProfile(req.user.id, updateData, req.user.id, req.user.role);
      
      res.json({
        message: 'Profile updated successfully',
        user: updatedUser
      });

    } catch (error) {
      console.error('Update current user profile error:', error);
      
      if (error.message === 'Email already taken') {
        return res.status(409).json({
          error: 'Email already taken',
          message: 'Another user is already using this email address',
          code: 'EMAIL_TAKEN'
        });
      }

      res.status(500).json({
        error: 'Failed to update profile',
        message: 'An error occurred while updating your profile',
        code: 'PROFILE_UPDATE_ERROR'
      });
    }
  }
);

/**
 * POST /api/users/change-password/:userId
 * Change user password
 */
router.post('/change-password/:userId',
  requireAuth,
  requireAdminOrSelf,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { currentPassword, newPassword } = req.body;

      // Validate password change data
      const validation = UserService.validatePasswordChange({ currentPassword, newPassword });
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Password change data is invalid',
          errors: validation.errors,
          code: 'VALIDATION_FAILED'
        });
      }

      const success = await UserService.changePassword(userId, currentPassword, newPassword, req.user.id, req.user.role);
      
      if (!success) {
        return res.status(404).json({
          error: 'User not found',
          message: 'The requested user does not exist',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        message: 'Password changed successfully'
      });

    } catch (error) {
      console.error('Change password error:', error);
      
      if (error.message === 'Access denied') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to change this user\'s password',
          code: 'PASSWORD_CHANGE_DENIED'
        });
      }

      if (error.message === 'Current password is incorrect') {
        return res.status(400).json({
          error: 'Incorrect password',
          message: 'Current password is incorrect',
          code: 'CURRENT_PASSWORD_INCORRECT'
        });
      }

      if (error.message.includes('Password must be at least')) {
        return res.status(400).json({
          error: 'Invalid password',
          message: error.message,
          code: 'INVALID_NEW_PASSWORD'
        });
      }

      res.status(500).json({
        error: 'Password change failed',
        message: 'An error occurred while changing password',
        code: 'PASSWORD_CHANGE_ERROR'
      });
    }
  }
);

/**
 * POST /api/users/me/change-password
 * Change current user's password
 */
router.post('/me/change-password',
  requireAuth,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      // Validate password change data
      const validation = UserService.validatePasswordChange({ currentPassword, newPassword });
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Password change data is invalid',
          errors: validation.errors,
          code: 'VALIDATION_FAILED'
        });
      }

      await UserService.changePassword(req.user.id, currentPassword, newPassword, req.user.id, req.user.role);
      
      res.json({
        message: 'Password changed successfully'
      });

    } catch (error) {
      console.error('Change current user password error:', error);
      
      if (error.message === 'Current password is incorrect') {
        return res.status(400).json({
          error: 'Incorrect password',
          message: 'Current password is incorrect',
          code: 'CURRENT_PASSWORD_INCORRECT'
        });
      }

      if (error.message.includes('Password must be at least')) {
        return res.status(400).json({
          error: 'Invalid password',
          message: error.message,
          code: 'INVALID_NEW_PASSWORD'
        });
      }

      res.status(500).json({
        error: 'Password change failed',
        message: 'An error occurred while changing your password',
        code: 'PASSWORD_CHANGE_ERROR'
      });
    }
  }
);

/**
 * DELETE /api/users/profile/:userId
 * Delete user account
 */
router.delete('/profile/:userId',
  requireAuth,
  requireAdminOrSelf,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

      const success = await UserService.deleteAccount(userId, req.user.id, req.user.role);
      
      if (!success) {
        return res.status(404).json({
          error: 'User not found',
          message: 'The requested user does not exist',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        message: 'User account deleted successfully'
      });

    } catch (error) {
      console.error('Delete user account error:', error);
      
      if (error.message === 'Access denied') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to delete this user account',
          code: 'ACCOUNT_DELETE_DENIED'
        });
      }

      if (error.message === 'Cannot delete the last admin user') {
        return res.status(403).json({
          error: 'Cannot delete admin',
          message: 'Cannot delete the last admin user',
          code: 'LAST_ADMIN_DELETE_DENIED'
        });
      }

      res.status(500).json({
        error: 'Failed to delete account',
        message: 'An error occurred while deleting the account',
        code: 'ACCOUNT_DELETE_ERROR'
      });
    }
  }
);

/**
 * DELETE /api/users/me
 * Delete current user's own account
 */
router.delete('/me',
  requireAuth,
  async (req, res) => {
    try {
      const success = await UserService.deleteAccount(req.user.id, req.user.id, req.user.role);
      
      if (!success) {
        return res.status(500).json({
          error: 'Failed to delete account',
          message: 'An error occurred while deleting your account',
          code: 'ACCOUNT_DELETE_ERROR'
        });
      }

      // Clear refresh token cookie since account is deleted
      res.clearCookie('refreshToken');

      res.json({
        message: 'Your account has been deleted successfully'
      });

    } catch (error) {
      console.error('Delete current user account error:', error);
      
      if (error.message === 'Cannot delete the last admin user') {
        return res.status(403).json({
          error: 'Cannot delete admin',
          message: 'Cannot delete the last admin user',
          code: 'LAST_ADMIN_DELETE_DENIED'
        });
      }

      res.status(500).json({
        error: 'Failed to delete account',
        message: 'An error occurred while deleting your account',
        code: 'ACCOUNT_DELETE_ERROR'
      });
    }
  }
);

/**
 * GET /api/users/stats/:userId
 * Get user flashcard statistics
 */
router.get('/stats/:userId',
  requireAuth,
  requireAdminOrSelf,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

      // Verify user exists
      const userExists = await UserService.userExists(userId);
      if (!userExists) {
        return res.status(404).json({
          error: 'User not found',
          message: 'The requested user does not exist',
          code: 'USER_NOT_FOUND'
        });
      }

      const userStats = await FlashcardService.getUserStats(userId);
      
      res.json({
        userId,
        statistics: userStats
      });

    } catch (error) {
      console.error('Get user stats error:', error);
      
      if (error.message === 'Access denied') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to view this user\'s statistics',
          code: 'STATS_ACCESS_DENIED'
        });
      }

      res.status(500).json({
        error: 'Failed to get statistics',
        message: 'An error occurred while fetching user statistics',
        code: 'STATS_FETCH_ERROR'
      });
    }
  }
);

/**
 * GET /api/users/me/stats
 * Get current user's flashcard statistics
 */
router.get('/me/stats',
  requireAuth,
  async (req, res) => {
    try {
      const userStats = await FlashcardService.getUserStats(req.user.id);
      
      res.json({
        userId: req.user.id,
        statistics: userStats
      });

    } catch (error) {
      console.error('Get current user stats error:', error);
      
      res.status(500).json({
        error: 'Failed to get statistics',
        message: 'An error occurred while fetching your statistics',
        code: 'STATS_FETCH_ERROR'
      });
    }
  }
);

/**
 * GET /api/users/exists/:userId
 * Check if user exists
 */
router.get('/exists/:userId',
  requireAuth,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const exists = await UserService.userExists(userId);
      
      res.json({
        userId,
        exists
      });

    } catch (error) {
      console.error('Check user exists error:', error);
      
      res.status(500).json({
        error: 'Failed to check user existence',
        message: 'An error occurred while checking if user exists',
        code: 'USER_EXISTS_CHECK_ERROR'
      });
    }
  }
);

export default router;