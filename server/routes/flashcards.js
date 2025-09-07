import express from 'express';
import FlashcardService from '../services/FlashcardService.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdminOrSelf } from '../middleware/admin.js';
import { validateFlashcardOwnership, validateResourceCreation } from '../middleware/ownership.js';

const router = express.Router();

/**
 * POST /api/flashcards
 * Create a new flashcard
 */
router.post('/',
  requireAuth,
  validateResourceCreation,
  async (req, res) => {
    try {
      const flashcardData = req.body;

      // Validate flashcard data
      const validation = FlashcardService.validate ? FlashcardService.validate(flashcardData) : { isValid: true };
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Flashcard data is invalid',
          errors: validation.errors,
          code: 'VALIDATION_FAILED'
        });
      }

      const newFlashcard = await FlashcardService.createFlashcard(flashcardData, req.user.id);
      
      res.status(201).json({
        message: 'Flashcard created successfully',
        flashcard: newFlashcard
      });

    } catch (error) {
      console.error('Create flashcard error:', error);
      
      if (error.message.includes('Validation failed')) {
        return res.status(400).json({
          error: 'Validation failed',
          message: error.message,
          code: 'VALIDATION_FAILED'
        });
      }

      res.status(500).json({
        error: 'Failed to create flashcard',
        message: 'An error occurred while creating the flashcard',
        code: 'FLASHCARD_CREATE_ERROR'
      });
    }
  }
);

/**
 * GET /api/flashcards/:flashcardId
 * Get flashcard by ID
 */
router.get('/:flashcardId',
  requireAuth,
  validateFlashcardOwnership,
  async (req, res) => {
    try {
      const flashcardId = parseInt(req.params.flashcardId);

      const flashcard = await FlashcardService.getFlashcard(flashcardId, req.user.id, req.user.role);
      
      if (!flashcard) {
        return res.status(404).json({
          error: 'Flashcard not found',
          message: 'The requested flashcard does not exist',
          code: 'FLASHCARD_NOT_FOUND'
        });
      }

      res.json({
        flashcard
      });

    } catch (error) {
      console.error('Get flashcard error:', error);
      
      res.status(500).json({
        error: 'Failed to get flashcard',
        message: 'An error occurred while fetching the flashcard',
        code: 'FLASHCARD_FETCH_ERROR'
      });
    }
  }
);

/**
 * PUT /api/flashcards/:flashcardId
 * Update flashcard
 */
router.put('/:flashcardId',
  requireAuth,
  validateFlashcardOwnership,
  async (req, res) => {
    try {
      const flashcardId = parseInt(req.params.flashcardId);
      const updateData = req.body;

      // Validate update data (reuse creation validation)
      const validation = FlashcardService.validate ? FlashcardService.validate(updateData) : { isValid: true };
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Flashcard update data is invalid',
          errors: validation.errors,
          code: 'VALIDATION_FAILED'
        });
      }

      const updatedFlashcard = await FlashcardService.updateFlashcard(flashcardId, updateData, req.user.id, req.user.role);
      
      if (!updatedFlashcard) {
        return res.status(404).json({
          error: 'Flashcard not found',
          message: 'The requested flashcard does not exist',
          code: 'FLASHCARD_NOT_FOUND'
        });
      }

      res.json({
        message: 'Flashcard updated successfully',
        flashcard: updatedFlashcard
      });

    } catch (error) {
      console.error('Update flashcard error:', error);
      
      if (error.message.includes('Validation failed')) {
        return res.status(400).json({
          error: 'Validation failed',
          message: error.message,
          code: 'VALIDATION_FAILED'
        });
      }

      res.status(500).json({
        error: 'Failed to update flashcard',
        message: 'An error occurred while updating the flashcard',
        code: 'FLASHCARD_UPDATE_ERROR'
      });
    }
  }
);

/**
 * DELETE /api/flashcards/:flashcardId
 * Delete flashcard
 */
router.delete('/:flashcardId',
  requireAuth,
  validateFlashcardOwnership,
  async (req, res) => {
    try {
      const flashcardId = parseInt(req.params.flashcardId);

      const success = await FlashcardService.deleteFlashcard(flashcardId, req.user.id, req.user.role);
      
      if (!success) {
        return res.status(404).json({
          error: 'Flashcard not found',
          message: 'The requested flashcard does not exist',
          code: 'FLASHCARD_NOT_FOUND'
        });
      }

      res.json({
        message: 'Flashcard deleted successfully'
      });

    } catch (error) {
      console.error('Delete flashcard error:', error);
      
      res.status(500).json({
        error: 'Failed to delete flashcard',
        message: 'An error occurred while deleting the flashcard',
        code: 'FLASHCARD_DELETE_ERROR'
      });
    }
  }
);

/**
 * GET /api/flashcards/user/:userId
 * Get all flashcards for a user
 */
router.get('/user/:userId',
  requireAuth,
  requireAdminOrSelf,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { limit, orderBy = 'last_reviewed', order = 'ASC' } = req.query;

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
      console.error('Get user flashcards error:', error);
      
      if (error.message.includes('Invalid orderBy field') || error.message.includes('Order must be')) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          message: error.message,
          code: 'INVALID_QUERY_PARAMS'
        });
      }

      res.status(500).json({
        error: 'Failed to get flashcards',
        message: 'An error occurred while fetching flashcards',
        code: 'FLASHCARDS_FETCH_ERROR'
      });
    }
  }
);

/**
 * GET /api/flashcards/my/cards
 * Get current user's flashcards
 */
router.get('/my/cards',
  requireAuth,
  async (req, res) => {
    try {
      const { limit, orderBy = 'last_reviewed', order = 'ASC' } = req.query;

      const options = {
        orderBy,
        order,
        ...(limit && { limit: parseInt(limit) })
      };

      const flashcards = await FlashcardService.getUserFlashcards(req.user.id, options);
      
      res.json({
        flashcards,
        count: flashcards.length
      });

    } catch (error) {
      console.error('Get current user flashcards error:', error);
      
      if (error.message.includes('Invalid orderBy field') || error.message.includes('Order must be')) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          message: error.message,
          code: 'INVALID_QUERY_PARAMS'
        });
      }

      res.status(500).json({
        error: 'Failed to get flashcards',
        message: 'An error occurred while fetching your flashcards',
        code: 'FLASHCARDS_FETCH_ERROR'
      });
    }
  }
);

/**
 * POST /api/flashcards/:flashcardId/review
 * Review a flashcard and update its difficulty
 */
router.post('/:flashcardId/review',
  requireAuth,
  validateFlashcardOwnership,
  async (req, res) => {
    try {
      const flashcardId = parseInt(req.params.flashcardId);
      const { performanceRating } = req.body;

      // Validate performance rating
      const validation = FlashcardService.validatePerformanceRating(performanceRating);
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Performance rating is invalid',
          errors: validation.errors,
          code: 'VALIDATION_FAILED'
        });
      }

      const reviewedFlashcard = await FlashcardService.reviewFlashcard(
        flashcardId, 
        performanceRating, 
        req.user.id, 
        req.user.role
      );
      
      if (!reviewedFlashcard) {
        return res.status(404).json({
          error: 'Flashcard not found',
          message: 'The requested flashcard does not exist',
          code: 'FLASHCARD_NOT_FOUND'
        });
      }

      res.json({
        message: 'Flashcard reviewed successfully',
        flashcard: reviewedFlashcard
      });

    } catch (error) {
      console.error('Review flashcard error:', error);
      
      if (error.message.includes('Performance rating must be')) {
        return res.status(400).json({
          error: 'Invalid performance rating',
          message: error.message,
          code: 'INVALID_PERFORMANCE_RATING'
        });
      }

      res.status(500).json({
        error: 'Failed to review flashcard',
        message: 'An error occurred while reviewing the flashcard',
        code: 'FLASHCARD_REVIEW_ERROR'
      });
    }
  }
);

/**
 * GET /api/flashcards/count/:userId
 * Get flashcard count for a user
 */
router.get('/count/:userId',
  requireAuth,
  requireAdminOrSelf,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

      const count = await FlashcardService.getFlashcardCount(userId);
      
      res.json({
        userId,
        count
      });

    } catch (error) {
      console.error('Get flashcard count error:', error);
      
      res.status(500).json({
        error: 'Failed to get flashcard count',
        message: 'An error occurred while counting flashcards',
        code: 'FLASHCARD_COUNT_ERROR'
      });
    }
  }
);

/**
 * GET /api/flashcards/my/count
 * Get current user's flashcard count
 */
router.get('/my/count',
  requireAuth,
  async (req, res) => {
    try {
      const count = await FlashcardService.getFlashcardCount(req.user.id);
      
      res.json({
        count
      });

    } catch (error) {
      console.error('Get current user flashcard count error:', error);
      
      res.status(500).json({
        error: 'Failed to get flashcard count',
        message: 'An error occurred while counting your flashcards',
        code: 'FLASHCARD_COUNT_ERROR'
      });
    }
  }
);

/**
 * POST /api/flashcards/import
 * Bulk import flashcards
 */
router.post('/import',
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
          errors: importResult.failed
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

export default router;