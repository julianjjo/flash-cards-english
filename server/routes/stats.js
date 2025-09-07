import express from 'express';
import UserService from '../services/UserService.js';
import FlashcardService from '../services/FlashcardService.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin, requireAdminOrSelf } from '../middleware/admin.js';

const router = express.Router();

/**
 * GET /api/stats/user/:userId
 * Get comprehensive user statistics
 */
router.get('/user/:userId',
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

      // Get user flashcard statistics
      const flashcardStats = await FlashcardService.getUserStats(userId);
      
      // Get user profile info
      const userProfile = await UserService.getProfile(userId, req.user.id, req.user.role);

      res.json({
        userId,
        userInfo: {
          email: userProfile.email,
          role: userProfile.role,
          createdAt: userProfile.createdAt,
          updatedAt: userProfile.updatedAt
        },
        statistics: flashcardStats
      });

    } catch (error) {
      console.error('Get user statistics error:', error);
      
      if (error.message === 'Access denied') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to view these statistics',
          code: 'STATS_ACCESS_DENIED'
        });
      }

      res.status(500).json({
        error: 'Failed to get user statistics',
        message: 'An error occurred while fetching user statistics',
        code: 'USER_STATS_ERROR'
      });
    }
  }
);

/**
 * GET /api/stats/my-stats
 * Get current user's statistics
 */
router.get('/my-stats',
  requireAuth,
  async (req, res) => {
    try {
      // Get user flashcard statistics
      const flashcardStats = await FlashcardService.getUserStats(req.user.id);

      res.json({
        statistics: flashcardStats
      });

    } catch (error) {
      console.error('Get current user statistics error:', error);
      
      res.status(500).json({
        error: 'Failed to get statistics',
        message: 'An error occurred while fetching your statistics',
        code: 'USER_STATS_ERROR'
      });
    }
  }
);

/**
 * GET /api/stats/system
 * Get system-wide statistics (admin only)
 */
router.get('/system',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      // Get user statistics
      const userStats = await UserService.getUserStats(req.user.id, req.user.role);
      
      // Get flashcard statistics
      const flashcardStats = await FlashcardService.getSystemStats(req.user.role);

      const systemStats = {
        users: userStats,
        flashcards: flashcardStats,
        generated: new Date().toISOString()
      };

      res.json({
        systemStatistics: systemStats
      });

    } catch (error) {
      console.error('Get system statistics error:', error);
      
      res.status(500).json({
        error: 'Failed to get system statistics',
        message: 'An error occurred while fetching system statistics',
        code: 'SYSTEM_STATS_ERROR'
      });
    }
  }
);

/**
 * GET /api/stats/dashboard/:userId
 * Get dashboard statistics for a specific user
 */
router.get('/dashboard/:userId',
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

      // Get comprehensive stats for dashboard
      const [flashcardStats, flashcardCount] = await Promise.all([
        FlashcardService.getUserStats(userId),
        FlashcardService.getFlashcardCount(userId)
      ]);

      // Calculate dashboard metrics
      const dashboardStats = {
        overview: {
          totalFlashcards: flashcardCount,
          totalReviews: flashcardStats.totalReviews,
          averageDifficulty: flashcardStats.averageDifficulty,
          lastStudySession: flashcardStats.lastStudySession
        },
        progress: {
          reviewedCards: flashcardStats.reviewedCards,
          unreviewedCards: flashcardStats.unreviewedCards,
          completionRate: flashcardCount > 0 ? (flashcardStats.reviewedCards / flashcardCount) * 100 : 0
        },
        spacedRepetition: flashcardStats.spacedRepetition || {
          dueCards: 0,
          overdueCards: 0,
          newCards: flashcardStats.unreviewedCards,
          studyLoad: flashcardStats.unreviewedCards
        },
        difficultyDistribution: flashcardStats.difficultyDistribution || {},
        studyRecommendations: flashcardStats.studyRecommendations || []
      };

      res.json({
        userId,
        dashboard: dashboardStats,
        lastUpdated: new Date().toISOString()
      });

    } catch (error) {
      console.error('Get dashboard statistics error:', error);
      
      if (error.message === 'Access denied') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to view this dashboard',
          code: 'DASHBOARD_ACCESS_DENIED'
        });
      }

      res.status(500).json({
        error: 'Failed to get dashboard statistics',
        message: 'An error occurred while fetching dashboard statistics',
        code: 'DASHBOARD_STATS_ERROR'
      });
    }
  }
);

/**
 * GET /api/stats/my-dashboard
 * Get dashboard statistics for current user
 */
router.get('/my-dashboard',
  requireAuth,
  async (req, res) => {
    try {
      // Get comprehensive stats for dashboard
      const [flashcardStats, flashcardCount] = await Promise.all([
        FlashcardService.getUserStats(req.user.id),
        FlashcardService.getFlashcardCount(req.user.id)
      ]);

      // Calculate dashboard metrics
      const dashboardStats = {
        overview: {
          totalFlashcards: flashcardCount,
          totalReviews: flashcardStats.totalReviews,
          averageDifficulty: flashcardStats.averageDifficulty,
          lastStudySession: flashcardStats.lastStudySession
        },
        progress: {
          reviewedCards: flashcardStats.reviewedCards,
          unreviewedCards: flashcardStats.unreviewedCards,
          completionRate: flashcardCount > 0 ? (flashcardStats.reviewedCards / flashcardCount) * 100 : 0
        },
        spacedRepetition: flashcardStats.spacedRepetition || {
          dueCards: 0,
          overdueCards: 0,
          newCards: flashcardStats.unreviewedCards,
          studyLoad: flashcardStats.unreviewedCards
        },
        difficultyDistribution: flashcardStats.difficultyDistribution || {},
        studyRecommendations: flashcardStats.studyRecommendations || []
      };

      res.json({
        dashboard: dashboardStats,
        lastUpdated: new Date().toISOString()
      });

    } catch (error) {
      console.error('Get current user dashboard statistics error:', error);
      
      res.status(500).json({
        error: 'Failed to get dashboard statistics',
        message: 'An error occurred while fetching your dashboard statistics',
        code: 'DASHBOARD_STATS_ERROR'
      });
    }
  }
);

/**
 * GET /api/stats/performance/:userId
 * Get detailed performance analytics for a user
 */
router.get('/performance/:userId',
  requireAuth,
  requireAdminOrSelf,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { period = '30', metric = 'reviews' } = req.query;

      // Verify user exists
      const userExists = await UserService.userExists(userId);
      if (!userExists) {
        return res.status(404).json({
          error: 'User not found',
          message: 'The requested user does not exist',
          code: 'USER_NOT_FOUND'
        });
      }

      // Validate period
      const validPeriods = ['7', '30', '90', '365'];
      if (!validPeriods.includes(period)) {
        return res.status(400).json({
          error: 'Invalid period',
          message: 'Period must be one of: 7, 30, 90, 365 days',
          code: 'INVALID_PERIOD'
        });
      }

      // Validate metric
      const validMetrics = ['reviews', 'difficulty', 'accuracy'];
      if (!validMetrics.includes(metric)) {
        return res.status(400).json({
          error: 'Invalid metric',
          message: 'Metric must be one of: reviews, difficulty, accuracy',
          code: 'INVALID_METRIC'
        });
      }

      // Get user statistics
      const userStats = await FlashcardService.getUserStats(userId);

      // This would be expanded with actual performance data from the database
      // For now, we'll return computed metrics
      const performanceData = {
        period: `${period} days`,
        metric,
        data: {
          totalReviews: userStats.totalReviews,
          averageDifficulty: userStats.averageDifficulty,
          difficultyDistribution: userStats.difficultyDistribution,
          studyStreak: calculateStudyStreak(userStats.lastStudySession),
          improvementTrend: 'stable' // This would be calculated from historical data
        },
        insights: generatePerformanceInsights(userStats, period, metric)
      };

      res.json({
        userId,
        performance: performanceData,
        generatedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error('Get performance analytics error:', error);
      
      if (error.message === 'Access denied') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to view this performance data',
          code: 'PERFORMANCE_ACCESS_DENIED'
        });
      }

      res.status(500).json({
        error: 'Failed to get performance analytics',
        message: 'An error occurred while fetching performance analytics',
        code: 'PERFORMANCE_STATS_ERROR'
      });
    }
  }
);

/**
 * GET /api/stats/my-performance
 * Get performance analytics for current user
 */
router.get('/my-performance',
  requireAuth,
  async (req, res) => {
    try {
      const { period = '30', metric = 'reviews' } = req.query;

      // Validate parameters
      const validPeriods = ['7', '30', '90', '365'];
      const validMetrics = ['reviews', 'difficulty', 'accuracy'];

      if (!validPeriods.includes(period)) {
        return res.status(400).json({
          error: 'Invalid period',
          message: 'Period must be one of: 7, 30, 90, 365 days',
          code: 'INVALID_PERIOD'
        });
      }

      if (!validMetrics.includes(metric)) {
        return res.status(400).json({
          error: 'Invalid metric',
          message: 'Metric must be one of: reviews, difficulty, accuracy',
          code: 'INVALID_METRIC'
        });
      }

      // Get user statistics
      const userStats = await FlashcardService.getUserStats(req.user.id);

      const performanceData = {
        period: `${period} days`,
        metric,
        data: {
          totalReviews: userStats.totalReviews,
          averageDifficulty: userStats.averageDifficulty,
          difficultyDistribution: userStats.difficultyDistribution,
          studyStreak: calculateStudyStreak(userStats.lastStudySession),
          improvementTrend: 'stable'
        },
        insights: generatePerformanceInsights(userStats, period, metric)
      };

      res.json({
        performance: performanceData,
        generatedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error('Get current user performance analytics error:', error);
      
      res.status(500).json({
        error: 'Failed to get performance analytics',
        message: 'An error occurred while fetching your performance analytics',
        code: 'PERFORMANCE_STATS_ERROR'
      });
    }
  }
);

/**
 * GET /api/stats/export/:userId
 * Export user statistics as JSON
 */
router.get('/export/:userId',
  requireAuth,
  requireAdminOrSelf,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { format = 'json' } = req.query;

      // Verify user exists
      const userExists = await UserService.userExists(userId);
      if (!userExists) {
        return res.status(404).json({
          error: 'User not found',
          message: 'The requested user does not exist',
          code: 'USER_NOT_FOUND'
        });
      }

      // Validate format
      if (format !== 'json') {
        return res.status(400).json({
          error: 'Invalid format',
          message: 'Only JSON format is currently supported',
          code: 'INVALID_FORMAT'
        });
      }

      // Get comprehensive user data
      const [userProfile, flashcardStats, flashcardCount] = await Promise.all([
        UserService.getProfile(userId, req.user.id, req.user.role),
        FlashcardService.getUserStats(userId),
        FlashcardService.getFlashcardCount(userId)
      ]);

      const exportData = {
        exportInfo: {
          userId,
          exportedAt: new Date().toISOString(),
          format,
          version: '1.0'
        },
        userProfile: {
          email: userProfile.email,
          role: userProfile.role,
          createdAt: userProfile.createdAt,
          updatedAt: userProfile.updatedAt
        },
        statistics: {
          ...flashcardStats,
          totalFlashcards: flashcardCount
        }
      };

      // Set appropriate headers for download
      res.setHeader('Content-Disposition', `attachment; filename="user-${userId}-stats-${Date.now()}.json"`);
      res.setHeader('Content-Type', 'application/json');

      res.json(exportData);

    } catch (error) {
      console.error('Export user statistics error:', error);
      
      if (error.message === 'Access denied') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to export this data',
          code: 'EXPORT_ACCESS_DENIED'
        });
      }

      res.status(500).json({
        error: 'Failed to export statistics',
        message: 'An error occurred while exporting statistics',
        code: 'EXPORT_STATS_ERROR'
      });
    }
  }
);

// Helper function to calculate study streak
function calculateStudyStreak(lastStudySession) {
  if (!lastStudySession) return 0;
  
  const lastStudy = new Date(lastStudySession);
  const now = new Date();
  const daysDiff = Math.floor((now - lastStudy) / (1000 * 60 * 60 * 24));
  
  // Simple streak calculation - would be more sophisticated in real implementation
  return daysDiff <= 1 ? 1 : 0;
}

// Helper function to generate performance insights
function generatePerformanceInsights(userStats, period, metric) {
  const insights = [];
  
  if (userStats.averageDifficulty < 2) {
    insights.push({
      type: 'positive',
      message: 'Your cards have low difficulty - great mastery!'
    });
  } else if (userStats.averageDifficulty > 3) {
    insights.push({
      type: 'suggestion',
      message: 'Consider reviewing challenging cards more frequently'
    });
  }
  
  if (userStats.totalReviews > 100) {
    insights.push({
      type: 'achievement',
      message: 'You\'ve completed over 100 reviews - excellent dedication!'
    });
  }
  
  return insights;
}

export default router;