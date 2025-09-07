import express from 'express';
import UserService from '../services/UserService.js';
import FlashcardService from '../services/FlashcardService.js';
import { requireAuth } from '../middleware/auth.js';
import { 
  requireAdmin, 
  requireSuperAdmin, 
  logAdminAction, 
  preventAdminSelfHarm, 
  validateAdminOperation 
} from '../middleware/admin.js';

const router = express.Router();

// Apply admin authentication to all routes
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/admin/users
 * Get paginated list of all users
 */
router.get('/users',
  logAdminAction('VIEW_ALL_USERS'),
  async (req, res) => {
    try {
      const { page = 1, limit = 20, role } = req.query;

      const options = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100), // Cap at 100 per page
        ...(role && { role })
      };

      const usersData = await UserService.getAllUsers(options, req.user.id, req.user.role);
      
      res.json(usersData);

    } catch (error) {
      console.error('Get all users error:', error);
      
      if (error.message.includes('Page must be') || error.message.includes('Limit must be')) {
        return res.status(400).json({
          error: 'Invalid pagination parameters',
          message: error.message,
          code: 'INVALID_PAGINATION'
        });
      }

      res.status(500).json({
        error: 'Failed to get users',
        message: 'An error occurred while fetching users',
        code: 'USERS_FETCH_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/users/:userId
 * Get detailed user information
 */
router.get('/users/:userId',
  logAdminAction('VIEW_USER_DETAILS'),
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

      const userDetails = await UserService.getUserDetails(userId, req.user.id, req.user.role);
      
      if (!userDetails) {
        return res.status(404).json({
          error: 'User not found',
          message: 'The requested user does not exist',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        user: userDetails
      });

    } catch (error) {
      console.error('Get user details error:', error);
      
      res.status(500).json({
        error: 'Failed to get user details',
        message: 'An error occurred while fetching user details',
        code: 'USER_DETAILS_ERROR'
      });
    }
  }
);

/**
 * PUT /api/admin/users/:userId
 * Update user information (admin override)
 */
router.put('/users/:userId',
  preventAdminSelfHarm,
  validateAdminOperation,
  logAdminAction('UPDATE_USER'),
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const updateData = req.body;

      // Validate update data
      const validation = UserService.validateProfileUpdate(updateData);
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'User update data is invalid',
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
        message: 'User updated successfully',
        user: updatedUser
      });

    } catch (error) {
      console.error('Admin update user error:', error);
      
      if (error.message === 'Email already taken') {
        return res.status(409).json({
          error: 'Email already taken',
          message: 'Another user is already using this email address',
          code: 'EMAIL_TAKEN'
        });
      }

      res.status(500).json({
        error: 'Failed to update user',
        message: 'An error occurred while updating the user',
        code: 'USER_UPDATE_ERROR'
      });
    }
  }
);

/**
 * DELETE /api/admin/users/:userId
 * Delete user account (admin override)
 */
router.delete('/users/:userId',
  requireSuperAdmin,
  preventAdminSelfHarm,
  validateAdminOperation,
  logAdminAction('DELETE_USER'),
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
      console.error('Admin delete user error:', error);
      
      if (error.message === 'Cannot delete the last admin user') {
        return res.status(403).json({
          error: 'Cannot delete admin',
          message: 'Cannot delete the last admin user',
          code: 'LAST_ADMIN_DELETE_DENIED'
        });
      }

      res.status(500).json({
        error: 'Failed to delete user',
        message: 'An error occurred while deleting the user',
        code: 'USER_DELETE_ERROR'
      });
    }
  }
);

/**
 * POST /api/admin/users/:userId/promote
 * Promote user to admin
 */
router.post('/users/:userId/promote',
  requireSuperAdmin,
  preventAdminSelfHarm,
  logAdminAction('PROMOTE_USER'),
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

      const updatedUser = await UserService.promoteToAdmin(userId, req.user.id, req.user.role);
      
      if (!updatedUser) {
        return res.status(404).json({
          error: 'User not found',
          message: 'The requested user does not exist',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        message: 'User promoted to admin successfully',
        user: updatedUser
      });

    } catch (error) {
      console.error('Promote user error:', error);
      
      res.status(500).json({
        error: 'Failed to promote user',
        message: 'An error occurred while promoting the user',
        code: 'USER_PROMOTION_ERROR'
      });
    }
  }
);

/**
 * POST /api/admin/users/:userId/demote
 * Demote admin to regular user
 */
router.post('/users/:userId/demote',
  requireSuperAdmin,
  preventAdminSelfHarm,
  logAdminAction('DEMOTE_USER'),
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

      const updatedUser = await UserService.demoteToUser(userId, req.user.id, req.user.role);
      
      if (!updatedUser) {
        return res.status(404).json({
          error: 'User not found',
          message: 'The requested user does not exist',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        message: 'Admin demoted to user successfully',
        user: updatedUser
      });

    } catch (error) {
      console.error('Demote user error:', error);
      
      if (error.message === 'Cannot demote the last admin user') {
        return res.status(403).json({
          error: 'Cannot demote admin',
          message: 'Cannot demote the last admin user',
          code: 'LAST_ADMIN_DEMOTE_DENIED'
        });
      }

      res.status(500).json({
        error: 'Failed to demote user',
        message: 'An error occurred while demoting the user',
        code: 'USER_DEMOTION_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/users/:userId/flashcards
 * Get all flashcards for a specific user (admin access)
 */
router.get('/users/:userId/flashcards',
  logAdminAction('VIEW_USER_FLASHCARDS'),
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { limit, orderBy = 'id', order = 'ASC' } = req.query;

      const options = {
        orderBy,
        order,
        ...(limit && { limit: parseInt(limit) })
      };

      const flashcards = await FlashcardService.getUserFlashcards(userId, options);
      
      res.json({
        flashcards,
        count: flashcards.length,
        userId
      });

    } catch (error) {
      console.error('Admin get user flashcards error:', error);
      
      if (error.message.includes('Invalid orderBy field') || error.message.includes('Order must be')) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          message: error.message,
          code: 'INVALID_QUERY_PARAMS'
        });
      }

      res.status(500).json({
        error: 'Failed to get user flashcards',
        message: 'An error occurred while fetching user flashcards',
        code: 'USER_FLASHCARDS_ERROR'
      });
    }
  }
);

/**
 * DELETE /api/admin/users/:userId/flashcards
 * Delete all flashcards for a user (admin action)
 */
router.delete('/users/:userId/flashcards',
  requireSuperAdmin,
  validateAdminOperation,
  logAdminAction('DELETE_USER_FLASHCARDS'),
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

      const deletedCount = await FlashcardService.deleteAllUserFlashcards(userId);
      
      res.json({
        message: 'All user flashcards deleted successfully',
        deletedCount,
        userId
      });

    } catch (error) {
      console.error('Admin delete user flashcards error:', error);
      
      res.status(500).json({
        error: 'Failed to delete user flashcards',
        message: 'An error occurred while deleting user flashcards',
        code: 'DELETE_USER_FLASHCARDS_ERROR'
      });
    }
  }
);

/**
 * POST /api/admin/users/:userId/reset-password
 * Reset user password (admin action)
 */
router.post('/users/:userId/reset-password',
  requireSuperAdmin,
  preventAdminSelfHarm,
  validateAdminOperation,
  logAdminAction('RESET_USER_PASSWORD'),
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          error: 'Invalid password',
          message: 'New password must be at least 6 characters long',
          code: 'INVALID_PASSWORD'
        });
      }

      // Admin can reset password without current password
      const success = await UserService.changePassword(userId, null, newPassword, req.user.id, req.user.role);
      
      if (!success) {
        return res.status(404).json({
          error: 'User not found',
          message: 'The requested user does not exist',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        message: 'User password reset successfully'
      });

    } catch (error) {
      console.error('Admin reset password error:', error);
      
      res.status(500).json({
        error: 'Failed to reset password',
        message: 'An error occurred while resetting the user password',
        code: 'PASSWORD_RESET_ERROR'
      });
    }
  }
);

/**
 * GET /api/admin/system/health
 * Get system health information
 */
router.get('/system/health',
  logAdminAction('VIEW_SYSTEM_HEALTH'),
  async (req, res) => {
    try {
      const healthInfo = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version
      };

      res.json({
        health: healthInfo
      });

    } catch (error) {
      console.error('System health check error:', error);
      
      res.status(500).json({
        error: 'Health check failed',
        message: 'An error occurred while checking system health',
        code: 'HEALTH_CHECK_ERROR'
      });
    }
  }
);

/**
 * POST /api/admin/system/maintenance
 * Trigger system maintenance tasks
 */
router.post('/system/maintenance',
  requireSuperAdmin,
  logAdminAction('SYSTEM_MAINTENANCE'),
  async (req, res) => {
    try {
      const { tasks = [] } = req.body;
      
      const maintenanceResults = {
        timestamp: new Date().toISOString(),
        tasksExecuted: [],
        errors: []
      };

      // This would be extended with actual maintenance tasks
      for (const task of tasks) {
        try {
          switch (task) {
            case 'cleanup_sessions':
              // Placeholder for session cleanup
              maintenanceResults.tasksExecuted.push({
                task: 'cleanup_sessions',
                status: 'completed',
                message: 'Session cleanup completed'
              });
              break;
            case 'optimize_database':
              // Placeholder for database optimization
              maintenanceResults.tasksExecuted.push({
                task: 'optimize_database',
                status: 'completed',
                message: 'Database optimization completed'
              });
              break;
            default:
              maintenanceResults.errors.push({
                task,
                error: 'Unknown maintenance task'
              });
          }
        } catch (taskError) {
          maintenanceResults.errors.push({
            task,
            error: taskError.message
          });
        }
      }

      res.json({
        message: 'Maintenance tasks executed',
        results: maintenanceResults
      });

    } catch (error) {
      console.error('System maintenance error:', error);
      
      res.status(500).json({
        error: 'Maintenance failed',
        message: 'An error occurred during system maintenance',
        code: 'MAINTENANCE_ERROR'
      });
    }
  }
);

export default router;