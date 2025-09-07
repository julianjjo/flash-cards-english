import express from 'express';
import FlashcardService from '../services/FlashcardService.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdminOrSelf } from '../middleware/admin.js';

const router = express.Router();

/**
 * GET /api/study/session/:userId
 * Get study session for a specific user
 */
router.get('/session/:userId',
  requireAuth,
  requireAdminOrSelf,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { limit = 10 } = req.query;

      const studyLimit = Math.min(parseInt(limit), 50); // Cap at 50 cards

      const studySession = await FlashcardService.getStudySession(userId, studyLimit);
      
      res.json({
        session: studySession,
        userId
      });

    } catch (error) {
      console.error('Get study session error:', error);
      
      if (error.message.includes('Study session limit cannot exceed')) {
        return res.status(400).json({
          error: 'Invalid limit',
          message: error.message,
          code: 'INVALID_STUDY_LIMIT'
        });
      }

      res.status(500).json({
        error: 'Failed to get study session',
        message: 'An error occurred while preparing the study session',
        code: 'STUDY_SESSION_ERROR'
      });
    }
  }
);

/**
 * GET /api/study/my-session
 * Get study session for current user
 */
router.get('/my-session',
  requireAuth,
  async (req, res) => {
    try {
      const { limit = 10 } = req.query;

      const studyLimit = Math.min(parseInt(limit), 50); // Cap at 50 cards

      const studySession = await FlashcardService.getStudySession(req.user.id, studyLimit);
      
      res.json({
        session: studySession
      });

    } catch (error) {
      console.error('Get current user study session error:', error);
      
      if (error.message.includes('Study session limit cannot exceed')) {
        return res.status(400).json({
          error: 'Invalid limit',
          message: error.message,
          code: 'INVALID_STUDY_LIMIT'
        });
      }

      res.status(500).json({
        error: 'Failed to get study session',
        message: 'An error occurred while preparing your study session',
        code: 'STUDY_SESSION_ERROR'
      });
    }
  }
);

/**
 * POST /api/study/review/:flashcardId
 * Review a flashcard during study session
 */
router.post('/review/:flashcardId',
  requireAuth,
  async (req, res) => {
    try {
      const flashcardId = parseInt(req.params.flashcardId);
      const { performanceRating, timeSpent } = req.body;

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

      // Validate time spent (optional)
      if (timeSpent !== undefined && (!Number.isInteger(timeSpent) || timeSpent < 0)) {
        return res.status(400).json({
          error: 'Invalid time spent',
          message: 'Time spent must be a non-negative integer (seconds)',
          code: 'INVALID_TIME_SPENT'
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
          message: 'The requested flashcard does not exist or you do not have access to it',
          code: 'FLASHCARD_NOT_FOUND'
        });
      }

      res.json({
        message: 'Flashcard reviewed successfully',
        flashcard: reviewedFlashcard,
        studyMetadata: {
          timeSpent,
          performanceRating,
          nextReviewDate: reviewedFlashcard.nextReviewDate
        }
      });

    } catch (error) {
      console.error('Review flashcard in study session error:', error);
      
      if (error.message.includes('Performance rating must be')) {
        return res.status(400).json({
          error: 'Invalid performance rating',
          message: error.message,
          code: 'INVALID_PERFORMANCE_RATING'
        });
      }

      if (error.message === 'Flashcard not found') {
        return res.status(404).json({
          error: 'Flashcard not found',
          message: 'The requested flashcard does not exist or you do not have access to it',
          code: 'FLASHCARD_NOT_FOUND'
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
 * POST /api/study/session/complete
 * Complete a study session and get results
 */
router.post('/session/complete',
  requireAuth,
  async (req, res) => {
    try {
      const { 
        reviewedCards = [], 
        sessionDuration,
        sessionStartTime,
        sessionEndTime
      } = req.body;

      // Validate session data
      if (!Array.isArray(reviewedCards)) {
        return res.status(400).json({
          error: 'Invalid session data',
          message: 'Reviewed cards must be an array',
          code: 'INVALID_SESSION_DATA'
        });
      }

      if (sessionDuration !== undefined && (!Number.isInteger(sessionDuration) || sessionDuration < 0)) {
        return res.status(400).json({
          error: 'Invalid session duration',
          message: 'Session duration must be a non-negative integer (seconds)',
          code: 'INVALID_SESSION_DURATION'
        });
      }

      // Calculate session statistics
      const sessionStats = {
        totalReviewed: reviewedCards.length,
        sessionDuration,
        sessionStartTime,
        sessionEndTime,
        performanceBreakdown: {}
      };

      // Count performance ratings
      reviewedCards.forEach(card => {
        const rating = card.performanceRating;
        if (rating !== undefined) {
          sessionStats.performanceBreakdown[rating] = (sessionStats.performanceBreakdown[rating] || 0) + 1;
        }
      });

      // Calculate performance metrics
      if (reviewedCards.length > 0) {
        const totalRating = reviewedCards.reduce((sum, card) => sum + (card.performanceRating || 0), 0);
        sessionStats.averagePerformance = totalRating / reviewedCards.length;
        
        const correctAnswers = reviewedCards.filter(card => (card.performanceRating || 0) >= 2).length;
        sessionStats.accuracyRate = correctAnswers / reviewedCards.length;
      }

      // Get updated user statistics
      const userStats = await FlashcardService.getUserStats(req.user.id);

      res.json({
        message: 'Study session completed successfully',
        sessionSummary: sessionStats,
        updatedUserStats: userStats
      });

    } catch (error) {
      console.error('Complete study session error:', error);
      
      res.status(500).json({
        error: 'Failed to complete study session',
        message: 'An error occurred while completing the study session',
        code: 'SESSION_COMPLETE_ERROR'
      });
    }
  }
);

/**
 * GET /api/study/due/:userId
 * Get cards due for review for a specific user
 */
router.get('/due/:userId',
  requireAuth,
  requireAdminOrSelf,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { limit = 20 } = req.query;

      const studyLimit = Math.min(parseInt(limit), 100); // Cap at 100 cards

      // Get user's flashcards ordered by spaced repetition priority
      const flashcards = await FlashcardService.getUserFlashcards(userId, {
        orderBy: 'last_reviewed',
        order: 'ASC',
        limit: studyLimit
      });

      // Filter and prioritize cards that are due for review
      const now = new Date();
      const dueCards = [];
      const overdueCards = [];
      const newCards = [];

      flashcards.forEach(card => {
        if (!card.lastReviewed) {
          newCards.push(card);
        } else {
          // Simple logic: cards are due based on their difficulty level
          const daysSinceReview = Math.floor((now - new Date(card.lastReviewed)) / (1000 * 60 * 60 * 24));
          const intervalDays = Math.pow(2, card.difficulty); // 2^difficulty days
          
          if (daysSinceReview >= intervalDays) {
            if (daysSinceReview > intervalDays * 1.5) {
              overdueCards.push(card);
            } else {
              dueCards.push(card);
            }
          }
        }
      });

      res.json({
        dueForReview: {
          dueCards,
          overdueCards,
          newCards,
          totalDue: dueCards.length + overdueCards.length + newCards.length
        },
        userId
      });

    } catch (error) {
      console.error('Get due cards error:', error);
      
      res.status(500).json({
        error: 'Failed to get due cards',
        message: 'An error occurred while fetching cards due for review',
        code: 'DUE_CARDS_ERROR'
      });
    }
  }
);

/**
 * GET /api/study/my-due
 * Get cards due for review for current user
 */
router.get('/my-due',
  requireAuth,
  async (req, res) => {
    try {
      const { limit = 20 } = req.query;

      const studyLimit = Math.min(parseInt(limit), 100); // Cap at 100 cards

      // Get user's flashcards ordered by spaced repetition priority
      const flashcards = await FlashcardService.getUserFlashcards(req.user.id, {
        orderBy: 'last_reviewed',
        order: 'ASC',
        limit: studyLimit
      });

      // Filter and prioritize cards that are due for review
      const now = new Date();
      const dueCards = [];
      const overdueCards = [];
      const newCards = [];

      flashcards.forEach(card => {
        if (!card.lastReviewed) {
          newCards.push(card);
        } else {
          // Simple logic: cards are due based on their difficulty level
          const daysSinceReview = Math.floor((now - new Date(card.lastReviewed)) / (1000 * 60 * 60 * 24));
          const intervalDays = Math.pow(2, card.difficulty); // 2^difficulty days
          
          if (daysSinceReview >= intervalDays) {
            if (daysSinceReview > intervalDays * 1.5) {
              overdueCards.push(card);
            } else {
              dueCards.push(card);
            }
          }
        }
      });

      res.json({
        dueForReview: {
          dueCards,
          overdueCards,
          newCards,
          totalDue: dueCards.length + overdueCards.length + newCards.length
        }
      });

    } catch (error) {
      console.error('Get current user due cards error:', error);
      
      res.status(500).json({
        error: 'Failed to get due cards',
        message: 'An error occurred while fetching your cards due for review',
        code: 'DUE_CARDS_ERROR'
      });
    }
  }
);

/**
 * GET /api/study/recommendations/:userId
 * Get study recommendations for a specific user
 */
router.get('/recommendations/:userId',
  requireAuth,
  requireAdminOrSelf,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

      const userStats = await FlashcardService.getUserStats(userId);
      
      res.json({
        recommendations: userStats.studyRecommendations || [],
        basedOnStats: {
          totalFlashcards: userStats.totalFlashcards,
          averageDifficulty: userStats.averageDifficulty,
          spacedRepetition: userStats.spacedRepetition
        },
        userId
      });

    } catch (error) {
      console.error('Get study recommendations error:', error);
      
      res.status(500).json({
        error: 'Failed to get study recommendations',
        message: 'An error occurred while generating study recommendations',
        code: 'RECOMMENDATIONS_ERROR'
      });
    }
  }
);

/**
 * GET /api/study/my-recommendations
 * Get study recommendations for current user
 */
router.get('/my-recommendations',
  requireAuth,
  async (req, res) => {
    try {
      const userStats = await FlashcardService.getUserStats(req.user.id);
      
      res.json({
        recommendations: userStats.studyRecommendations || [],
        basedOnStats: {
          totalFlashcards: userStats.totalFlashcards,
          averageDifficulty: userStats.averageDifficulty,
          spacedRepetition: userStats.spacedRepetition
        }
      });

    } catch (error) {
      console.error('Get current user study recommendations error:', error);
      
      res.status(500).json({
        error: 'Failed to get study recommendations',
        message: 'An error occurred while generating your study recommendations',
        code: 'RECOMMENDATIONS_ERROR'
      });
    }
  }
);

export default router;