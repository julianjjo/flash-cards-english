import express from 'express';
import FlashcardService from '../services/FlashcardService.js';
import UserService from '../services/UserService.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin, requireSuperAdmin, logAdminAction } from '../middleware/admin.js';
import { validateBulkOwnership, validateResourceCreation } from '../middleware/ownership.js';

const router = express.Router();

/**
 * POST /api/bulk/flashcards/import
 * Bulk import flashcards for current user
 */
router.post('/flashcards/import',
  requireAuth,
  validateResourceCreation,
  async (req, res) => {
    try {
      const { flashcards } = req.body;

      // Validate bulk import data
      const validation = FlashcardService.validateBulkImport(flashcards);
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Bulk import data is invalid',
          errors: validation.errors,
          code: 'VALIDATION_FAILED'
        });
      }

      const importResult = await FlashcardService.bulkImportFlashcards(flashcards, req.user.id);
      
      res.status(201).json({
        message: 'Bulk import completed',
        result: {
          totalProcessed: importResult.totalProcessed,
          successful: importResult.successful.length,
          failed: importResult.failed.length,
          successfulFlashcards: importResult.successful.map(item => item.flashcard),
          errors: importResult.failed.map(item => ({
            index: item.index,
            errors: item.errors,
            data: item.data
          }))
        }
      });

    } catch (error) {
      console.error('Bulk import flashcards error:', error);
      
      if (error.message.includes('Cannot import more than')) {
        return res.status(400).json({
          error: 'Import limit exceeded',
          message: error.message,
          code: 'IMPORT_LIMIT_EXCEEDED'
        });
      }

      if (error.message === 'Flashcards data must be an array') {
        return res.status(400).json({
          error: 'Invalid data format',
          message: 'Flashcards data must be an array',
          code: 'INVALID_DATA_FORMAT'
        });
      }

      res.status(500).json({
        error: 'Bulk import failed',
        message: 'An error occurred during bulk import',
        code: 'BULK_IMPORT_ERROR'
      });
    }
  }
);

/**
 * PUT /api/bulk/flashcards/update
 * Bulk update flashcards
 */
router.put('/flashcards/update',
  requireAuth,
  validateBulkOwnership('flashcard'),
  async (req, res) => {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates)) {
        return res.status(400).json({
          error: 'Invalid request format',
          message: 'Updates must be provided as an array',
          code: 'INVALID_REQUEST_FORMAT'
        });
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error: 'Empty update request',
          message: 'At least one update is required',
          code: 'EMPTY_UPDATE_REQUEST'
        });
      }

      if (updates.length > 50) {
        return res.status(400).json({
          error: 'Update limit exceeded',
          message: 'Cannot update more than 50 flashcards at once',
          code: 'UPDATE_LIMIT_EXCEEDED'
        });
      }

      const updateResults = {
        successful: [],
        failed: [],
        totalProcessed: updates.length
      };

      // Process each update
      for (const [index, update] of updates.entries()) {
        try {
          const { id, ...updateData } = update;

          if (!id) {
            updateResults.failed.push({
              index,
              error: 'Flashcard ID is required',
              data: update
            });
            continue;
          }

          // Validate update data
          const validation = FlashcardService.validate ? FlashcardService.validate(updateData) : { isValid: true };
          if (!validation.isValid) {
            updateResults.failed.push({
              index,
              error: `Validation failed: ${validation.errors.join(', ')}`,
              data: update
            });
            continue;
          }

          const updatedFlashcard = await FlashcardService.updateFlashcard(id, updateData, req.user.id, req.user.role);
          
          if (updatedFlashcard) {
            updateResults.successful.push({
              index,
              flashcard: updatedFlashcard
            });
          } else {
            updateResults.failed.push({
              index,
              error: 'Flashcard not found or access denied',
              data: update
            });
          }

        } catch (error) {
          updateResults.failed.push({
            index,
            error: error.message,
            data: update
          });
        }
      }

      res.json({
        message: 'Bulk update completed',
        result: updateResults
      });

    } catch (error) {
      console.error('Bulk update flashcards error:', error);
      
      res.status(500).json({
        error: 'Bulk update failed',
        message: 'An error occurred during bulk update',
        code: 'BULK_UPDATE_ERROR'
      });
    }
  }
);

/**
 * DELETE /api/bulk/flashcards/delete
 * Bulk delete flashcards
 */
router.delete('/flashcards/delete',
  requireAuth,
  validateBulkOwnership('flashcard'),
  async (req, res) => {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids)) {
        return res.status(400).json({
          error: 'Invalid request format',
          message: 'Flashcard IDs must be provided as an array',
          code: 'INVALID_REQUEST_FORMAT'
        });
      }

      if (ids.length === 0) {
        return res.status(400).json({
          error: 'Empty delete request',
          message: 'At least one flashcard ID is required',
          code: 'EMPTY_DELETE_REQUEST'
        });
      }

      if (ids.length > 100) {
        return res.status(400).json({
          error: 'Delete limit exceeded',
          message: 'Cannot delete more than 100 flashcards at once',
          code: 'DELETE_LIMIT_EXCEEDED'
        });
      }

      const deleteResults = {
        successful: [],
        failed: [],
        totalProcessed: ids.length
      };

      // Process each deletion
      for (const [index, id] of ids.entries()) {
        try {
          const success = await FlashcardService.deleteFlashcard(id, req.user.id, req.user.role);
          
          if (success) {
            deleteResults.successful.push({
              index,
              flashcardId: id
            });
          } else {
            deleteResults.failed.push({
              index,
              flashcardId: id,
              error: 'Flashcard not found or access denied'
            });
          }

        } catch (error) {
          deleteResults.failed.push({
            index,
            flashcardId: id,
            error: error.message
          });
        }
      }

      res.json({
        message: 'Bulk delete completed',
        result: deleteResults
      });

    } catch (error) {
      console.error('Bulk delete flashcards error:', error);
      
      res.status(500).json({
        error: 'Bulk delete failed',
        message: 'An error occurred during bulk delete',
        code: 'BULK_DELETE_ERROR'
      });
    }
  }
);

/**
 * POST /api/bulk/flashcards/review
 * Bulk review flashcards
 */
router.post('/flashcards/review',
  requireAuth,
  validateBulkOwnership('flashcard'),
  async (req, res) => {
    try {
      const { reviews } = req.body;

      if (!Array.isArray(reviews)) {
        return res.status(400).json({
          error: 'Invalid request format',
          message: 'Reviews must be provided as an array',
          code: 'INVALID_REQUEST_FORMAT'
        });
      }

      if (reviews.length === 0) {
        return res.status(400).json({
          error: 'Empty review request',
          message: 'At least one review is required',
          code: 'EMPTY_REVIEW_REQUEST'
        });
      }

      if (reviews.length > 50) {
        return res.status(400).json({
          error: 'Review limit exceeded',
          message: 'Cannot review more than 50 flashcards at once',
          code: 'REVIEW_LIMIT_EXCEEDED'
        });
      }

      const reviewResults = {
        successful: [],
        failed: [],
        totalProcessed: reviews.length
      };

      // Process each review
      for (const [index, review] of reviews.entries()) {
        try {
          const { id, performanceRating } = review;

          if (!id) {
            reviewResults.failed.push({
              index,
              error: 'Flashcard ID is required',
              data: review
            });
            continue;
          }

          // Validate performance rating
          const validation = FlashcardService.validatePerformanceRating(performanceRating);
          if (!validation.isValid) {
            reviewResults.failed.push({
              index,
              error: `Performance rating validation failed: ${validation.errors.join(', ')}`,
              data: review
            });
            continue;
          }

          const reviewedFlashcard = await FlashcardService.reviewFlashcard(
            id, 
            performanceRating, 
            req.user.id, 
            req.user.role
          );
          
          if (reviewedFlashcard) {
            reviewResults.successful.push({
              index,
              flashcard: reviewedFlashcard
            });
          } else {
            reviewResults.failed.push({
              index,
              error: 'Flashcard not found or access denied',
              data: review
            });
          }

        } catch (error) {
          reviewResults.failed.push({
            index,
            error: error.message,
            data: review
          });
        }
      }

      res.json({
        message: 'Bulk review completed',
        result: reviewResults
      });

    } catch (error) {
      console.error('Bulk review flashcards error:', error);
      
      res.status(500).json({
        error: 'Bulk review failed',
        message: 'An error occurred during bulk review',
        code: 'BULK_REVIEW_ERROR'
      });
    }
  }
);

/**
 * POST /api/bulk/users/actions (Admin only)
 * Bulk operations on users
 */
router.post('/users/actions',
  requireAuth,
  requireAdmin,
  logAdminAction('BULK_USER_ACTIONS'),
  async (req, res) => {
    try {
      const { action, userIds } = req.body;

      if (!action || !Array.isArray(userIds)) {
        return res.status(400).json({
          error: 'Invalid request format',
          message: 'Action and userIds array are required',
          code: 'INVALID_REQUEST_FORMAT'
        });
      }

      const validActions = ['promote', 'demote', 'delete'];
      if (!validActions.includes(action)) {
        return res.status(400).json({
          error: 'Invalid action',
          message: `Action must be one of: ${validActions.join(', ')}`,
          code: 'INVALID_ACTION'
        });
      }

      if (userIds.length === 0) {
        return res.status(400).json({
          error: 'Empty user list',
          message: 'At least one user ID is required',
          code: 'EMPTY_USER_LIST'
        });
      }

      if (userIds.length > 20) {
        return res.status(400).json({
          error: 'User limit exceeded',
          message: 'Cannot perform bulk actions on more than 20 users at once',
          code: 'USER_LIMIT_EXCEEDED'
        });
      }

      // Prevent admin from performing actions on themselves
      if (userIds.includes(req.user.id)) {
        return res.status(403).json({
          error: 'Self-action prevention',
          message: 'Cannot perform bulk actions on your own account',
          code: 'BULK_SELF_ACTION_DENIED'
        });
      }

      const actionResults = {
        successful: [],
        failed: [],
        totalProcessed: userIds.length
      };

      // Process each user action
      for (const [index, userId] of userIds.entries()) {
        try {
          let result = null;

          switch (action) {
            case 'promote':
              result = await UserService.promoteToAdmin(userId, req.user.id, req.user.role);
              break;
            case 'demote':
              result = await UserService.demoteToUser(userId, req.user.id, req.user.role);
              break;
            case 'delete':
              // Only super admin can bulk delete users
              if (req.user.role !== 'admin') {
                throw new Error('Super admin access required for user deletion');
              }
              result = await UserService.deleteAccount(userId, req.user.id, req.user.role);
              break;
          }

          if (result) {
            actionResults.successful.push({
              index,
              userId,
              result: action === 'delete' ? { deleted: true } : result
            });
          } else {
            actionResults.failed.push({
              index,
              userId,
              error: 'User not found or operation failed'
            });
          }

        } catch (error) {
          actionResults.failed.push({
            index,
            userId,
            error: error.message
          });
        }
      }

      res.json({
        message: `Bulk ${action} completed`,
        action,
        result: actionResults
      });

    } catch (error) {
      console.error('Bulk user actions error:', error);
      
      res.status(500).json({
        error: 'Bulk user actions failed',
        message: 'An error occurred during bulk user actions',
        code: 'BULK_USER_ACTIONS_ERROR'
      });
    }
  }
);

/**
 * POST /api/bulk/export
 * Bulk export data
 */
router.post('/export',
  requireAuth,
  async (req, res) => {
    try {
      const { type, userIds = [], format = 'json' } = req.body;

      const validTypes = ['flashcards', 'stats', 'users'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: 'Invalid export type',
          message: `Export type must be one of: ${validTypes.join(', ')}`,
          code: 'INVALID_EXPORT_TYPE'
        });
      }

      if (format !== 'json') {
        return res.status(400).json({
          error: 'Invalid format',
          message: 'Only JSON format is currently supported',
          code: 'INVALID_FORMAT'
        });
      }

      // For non-admin users, only allow exporting their own data
      const exportUserIds = req.user.role === 'admin' && userIds.length > 0 
        ? userIds 
        : [req.user.id];

      if (exportUserIds.length > 10) {
        return res.status(400).json({
          error: 'Export limit exceeded',
          message: 'Cannot export data for more than 10 users at once',
          code: 'EXPORT_LIMIT_EXCEEDED'
        });
      }

      const exportData = {
        exportInfo: {
          type,
          format,
          exportedAt: new Date().toISOString(),
          requestedBy: req.user.id,
          version: '1.0'
        },
        data: []
      };

      // Process each user's data
      for (const userId of exportUserIds) {
        try {
          // Verify access to user data
          if (req.user.role !== 'admin' && userId !== req.user.id) {
            continue; // Skip users the current user can't access
          }

          const userData = { userId };

          switch (type) {
            case 'flashcards':
              userData.flashcards = await FlashcardService.getUserFlashcards(userId);
              break;
            case 'stats':
              userData.statistics = await FlashcardService.getUserStats(userId);
              break;
            case 'users':
              if (req.user.role === 'admin') {
                userData.profile = await UserService.getProfile(userId, req.user.id, req.user.role);
              }
              break;
          }

          exportData.data.push(userData);

        } catch (error) {
          console.error(`Export error for user ${userId}:`, error);
          // Continue with other users even if one fails
        }
      }

      // Set appropriate headers for download
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Disposition', `attachment; filename="bulk-export-${type}-${timestamp}.json"`);
      res.setHeader('Content-Type', 'application/json');

      res.json(exportData);

    } catch (error) {
      console.error('Bulk export error:', error);
      
      res.status(500).json({
        error: 'Bulk export failed',
        message: 'An error occurred during bulk export',
        code: 'BULK_EXPORT_ERROR'
      });
    }
  }
);

export default router;