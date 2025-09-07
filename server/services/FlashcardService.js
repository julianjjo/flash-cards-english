import Flashcard from '../models/Flashcard.js';

/**
 * FlashcardService
 * 
 * Business logic layer for flashcard operations including CRUD operations,
 * spaced repetition algorithm, study session management, and progress tracking.
 * 
 * Implements strict user isolation and study optimization algorithms.
 */

class FlashcardService {
  constructor() {
    // Spaced repetition algorithm parameters
    this.spacedRepetition = {
      // Initial intervals in days for each difficulty level
      initialIntervals: [1, 2, 4, 8, 16, 32],
      
      // Multipliers for interval adjustment based on performance
      easyMultiplier: 2.5,    // Correct answer, increase interval
      goodMultiplier: 2.0,    // Correct answer, normal increase
      hardMultiplier: 1.3,    // Correct answer, small increase
      againMultiplier: 0.5,   // Incorrect answer, reduce interval
      
      // Minimum interval in days
      minInterval: 1,
      
      // Maximum interval in days
      maxInterval: 365
    };
  }

  /**
   * Create a new flashcard
   * @param {Object} flashcardData - Flashcard data
   * @param {number} userId - Owner user ID
   * @returns {Object} Created flashcard
   */
  async createFlashcard(flashcardData, userId) {
    // Validate input data
    const validation = Flashcard.validate(flashcardData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Add user ID to flashcard data
    const dataWithUserId = {
      ...flashcardData,
      userId
    };

    return Flashcard.create(dataWithUserId);
  }

  /**
   * Get flashcard by ID
   * @param {number} flashcardId - Flashcard ID
   * @param {number} userId - Requesting user ID
   * @param {string} userRole - Requesting user role
   * @returns {Object|null} Flashcard data
   */
  async getFlashcard(flashcardId, userId, userRole) {
    return Flashcard.findById(flashcardId, userId, userRole);
  }

  /**
   * Update flashcard
   * @param {number} flashcardId - Flashcard ID
   * @param {Object} updateData - Data to update
   * @param {number} userId - Requesting user ID
   * @param {string} userRole - Requesting user role
   * @returns {Object|null} Updated flashcard
   */
  async updateFlashcard(flashcardId, updateData, userId, userRole) {
    // Validate update data
    const validation = Flashcard.validate(updateData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    return Flashcard.update(flashcardId, updateData, userId, userRole);
  }

  /**
   * Delete flashcard
   * @param {number} flashcardId - Flashcard ID
   * @param {number} userId - Requesting user ID
   * @param {string} userRole - Requesting user role
   * @returns {boolean} Success status
   */
  async deleteFlashcard(flashcardId, userId, userRole) {
    return Flashcard.delete(flashcardId, userId, userRole);
  }

  /**
   * Get user's flashcards with optional filtering
   * @param {number} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} Array of flashcards
   */
  async getUserFlashcards(userId, options = {}) {
    return Flashcard.findByUserId(userId, options);
  }

  /**
   * Get flashcards for study session using spaced repetition
   * @param {number} userId - User ID
   * @param {number} limit - Number of cards to return
   * @returns {Object} Study session data
   */
  async getStudySession(userId, limit = 10) {
    if (limit > 50) {
      throw new Error('Study session limit cannot exceed 50 cards');
    }

    const studyCards = await Flashcard.getStudyCards(userId, limit);
    
    // Calculate study priority scores
    const cardsWithPriority = studyCards.map(card => {
      const priority = this.calculateStudyPriority(card);
      return {
        ...card,
        studyPriority: priority,
        nextReviewDue: this.calculateNextReviewDate(card)
      };
    });

    // Sort by priority (highest first)
    cardsWithPriority.sort((a, b) => b.studyPriority - a.studyPriority);

    return {
      cards: cardsWithPriority,
      totalCards: studyCards.length,
      sessionMetadata: {
        newCards: studyCards.filter(card => !card.lastReviewed).length,
        reviewCards: studyCards.filter(card => card.lastReviewed).length,
        averageDifficulty: studyCards.length > 0 
          ? studyCards.reduce((sum, card) => sum + card.difficulty, 0) / studyCards.length 
          : 0
      }
    };
  }

  /**
   * Review a flashcard and update its difficulty/stats
   * @param {number} flashcardId - Flashcard ID
   * @param {number} performanceRating - Performance rating (0-5)
   * @param {number} userId - User ID
   * @param {string} userRole - User role
   * @returns {Object} Updated flashcard with next review info
   */
  async reviewFlashcard(flashcardId, performanceRating, userId, userRole = 'user') {
    // Validate performance rating
    if (!Number.isInteger(performanceRating) || performanceRating < 0 || performanceRating > 5) {
      throw new Error('Performance rating must be an integer between 0 and 5');
    }

    // Get current flashcard
    const currentCard = await Flashcard.findById(flashcardId, userId, userRole);
    if (!currentCard) {
      throw new Error('Flashcard not found');
    }

    // Calculate new difficulty based on performance
    const newDifficulty = this.calculateNewDifficulty(currentCard.difficulty, performanceRating);

    // Update flashcard with new difficulty
    const updatedCard = await Flashcard.review(flashcardId, newDifficulty, userId, userRole);

    // Add next review date calculation
    if (updatedCard) {
      updatedCard.nextReviewDate = this.calculateNextReviewDate(updatedCard);
      updatedCard.performanceRating = performanceRating;
      updatedCard.studyMetadata = {
        previousDifficulty: currentCard.difficulty,
        difficultyChange: newDifficulty - currentCard.difficulty,
        intervalDays: this.calculateInterval(newDifficulty)
      };
    }

    return updatedCard;
  }

  /**
   * Get user's flashcard statistics
   * @param {number} userId - User ID
   * @returns {Object} Comprehensive flashcard statistics
   */
  async getUserStats(userId) {
    const stats = await Flashcard.getStatsByUserId(userId);
    
    // Add spaced repetition insights
    const cards = await Flashcard.findByUserId(userId);
    const spacedRepetitionStats = this.calculateSpacedRepetitionStats(cards);

    return {
      ...stats,
      spacedRepetition: spacedRepetitionStats,
      studyRecommendations: this.generateStudyRecommendations(stats, spacedRepetitionStats)
    };
  }

  /**
   * Get system-wide statistics (admin only)
   * @param {string} userRole - User role
   * @returns {Object} System statistics
   */
  async getSystemStats(userRole) {
    if (userRole !== 'admin') {
      throw new Error('Admin access required');
    }

    return Flashcard.getSystemStats();
  }

  /**
   * Bulk import flashcards
   * @param {Array} flashcardsData - Array of flashcard data
   * @param {number} userId - User ID
   * @returns {Object} Import results
   */
  async bulkImportFlashcards(flashcardsData, userId) {
    if (!Array.isArray(flashcardsData)) {
      throw new Error('Flashcards data must be an array');
    }

    if (flashcardsData.length > 100) {
      throw new Error('Cannot import more than 100 flashcards at once');
    }

    const results = {
      successful: [],
      failed: [],
      totalProcessed: flashcardsData.length
    };

    for (const [index, cardData] of flashcardsData.entries()) {
      try {
        // Validate each flashcard
        const validation = Flashcard.validate(cardData);
        if (!validation.isValid) {
          results.failed.push({
            index,
            data: cardData,
            errors: validation.errors
          });
          continue;
        }

        // Create flashcard
        const createdCard = await this.createFlashcard(cardData, userId);
        results.successful.push({
          index,
          flashcard: createdCard
        });

      } catch (error) {
        results.failed.push({
          index,
          data: cardData,
          errors: [error.message]
        });
      }
    }

    return results;
  }

  /**
   * Calculate study priority for a flashcard
   * @param {Object} card - Flashcard data
   * @returns {number} Priority score (higher = more priority)
   */
  calculateStudyPriority(card) {
    let priority = 100; // Base priority

    // Never reviewed cards get highest priority
    if (!card.lastReviewed) {
      return priority + 50;
    }

    // Calculate days since last review
    const lastReviewDate = new Date(card.lastReviewed);
    const now = new Date();
    const daysSinceReview = Math.floor((now - lastReviewDate) / (1000 * 60 * 60 * 24));

    // Higher difficulty = lower priority (easier cards reviewed more often)
    priority -= card.difficulty * 10;

    // Longer time since review = higher priority
    priority += Math.min(daysSinceReview * 2, 40);

    // Cards with fewer reviews get slight boost
    if (card.reviewCount < 3) {
      priority += 10;
    }

    return Math.max(priority, 0);
  }

  /**
   * Calculate new difficulty based on performance
   * @param {number} currentDifficulty - Current difficulty (0-5)
   * @param {number} performance - Performance rating (0-5)
   * @returns {number} New difficulty (0-5)
   */
  calculateNewDifficulty(currentDifficulty, performance) {
    let newDifficulty = currentDifficulty;

    switch (performance) {
      case 0: // Again (completely wrong)
        newDifficulty = Math.max(0, currentDifficulty - 2);
        break;
      case 1: // Hard (barely correct)
        newDifficulty = Math.max(0, currentDifficulty - 1);
        break;
      case 2: // Good (correct)
        // Keep same difficulty
        break;
      case 3: // Easy (easily correct)
        newDifficulty = Math.min(5, currentDifficulty + 1);
        break;
      case 4: // Very Easy (instantly correct)
        newDifficulty = Math.min(5, currentDifficulty + 2);
        break;
      case 5: // Perfect (mastered)
        newDifficulty = Math.min(5, currentDifficulty + 3);
        break;
      default:
        // Keep current difficulty for invalid ratings
        break;
    }

    return newDifficulty;
  }

  /**
   * Calculate next review date for a flashcard
   * @param {Object} card - Flashcard data
   * @returns {Date} Next review date
   */
  calculateNextReviewDate(card) {
    if (!card.lastReviewed) {
      // New card should be reviewed tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }

    const intervalDays = this.calculateInterval(card.difficulty);
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + intervalDays);

    return nextReview;
  }

  /**
   * Calculate review interval based on difficulty
   * @param {number} difficulty - Difficulty level (0-5)
   * @returns {number} Interval in days
   */
  calculateInterval(difficulty) {
    const intervals = this.spacedRepetition.initialIntervals;
    const interval = intervals[difficulty] || intervals[5];
    
    return Math.min(
      Math.max(interval, this.spacedRepetition.minInterval),
      this.spacedRepetition.maxInterval
    );
  }

  /**
   * Calculate spaced repetition statistics
   * @param {Array} cards - User's flashcards
   * @returns {Object} Spaced repetition statistics
   */
  calculateSpacedRepetitionStats(cards) {
    const now = new Date();
    let dueCards = 0;
    let overdueCards = 0;
    let newCards = 0;

    cards.forEach(card => {
      if (!card.lastReviewed) {
        newCards++;
      } else {
        const nextReview = this.calculateNextReviewDate(card);
        if (nextReview <= now) {
          dueCards++;
          if (nextReview < new Date(now.getTime() - 24 * 60 * 60 * 1000)) {
            overdueCards++;
          }
        }
      }
    });

    return {
      dueCards,
      overdueCards,
      newCards,
      totalCards: cards.length,
      studyLoad: dueCards + newCards
    };
  }

  /**
   * Generate study recommendations
   * @param {Object} basicStats - Basic flashcard statistics
   * @param {Object} spacedRepetitionStats - Spaced repetition statistics
   * @returns {Object} Study recommendations
   */
  generateStudyRecommendations(basicStats, spacedRepetitionStats) {
    const recommendations = [];

    if (spacedRepetitionStats.overdueCards > 5) {
      recommendations.push({
        type: 'overdue',
        priority: 'high',
        message: `You have ${spacedRepetitionStats.overdueCards} overdue cards. Focus on catching up with reviews.`
      });
    }

    if (spacedRepetitionStats.newCards > 20) {
      recommendations.push({
        type: 'new_cards',
        priority: 'medium',
        message: `You have ${spacedRepetitionStats.newCards} new cards. Consider reviewing them gradually.`
      });
    }

    if (basicStats.averageDifficulty < 2) {
      recommendations.push({
        type: 'difficulty',
        priority: 'low',
        message: 'Your cards have low difficulty. Great job! Consider adding more challenging content.'
      });
    }

    if (basicStats.totalReviews > 100 && spacedRepetitionStats.studyLoad < 5) {
      recommendations.push({
        type: 'maintenance',
        priority: 'low',
        message: 'You\'re in maintenance mode. Keep up with daily reviews to retain knowledge.'
      });
    }

    return recommendations;
  }

  /**
   * Check if user can access flashcard
   * @param {number} flashcardId - Flashcard ID
   * @param {number} userId - User ID
   * @returns {boolean} Access status
   */
  async canUserAccessFlashcard(flashcardId, userId) {
    return Flashcard.existsForUser(flashcardId, userId);
  }

  /**
   * Get flashcard count for user
   * @param {number} userId - User ID
   * @returns {number} Flashcard count
   */
  async getFlashcardCount(userId) {
    return Flashcard.countByUserId(userId);
  }

  /**
   * Delete all flashcards for a user (used when deleting user account)
   * @param {number} userId - User ID
   * @returns {number} Number of deleted flashcards
   */
  async deleteAllUserFlashcards(userId) {
    return Flashcard.deleteAllByUserId(userId);
  }

  /**
   * Validate bulk import data
   * @param {Array} flashcardsData - Flashcards data array
   * @returns {Object} Validation result
   */
  static validateBulkImport(flashcardsData) {
    const errors = [];

    if (!Array.isArray(flashcardsData)) {
      errors.push('Data must be an array of flashcards');
      return { isValid: false, errors };
    }

    if (flashcardsData.length === 0) {
      errors.push('At least one flashcard is required');
    }

    if (flashcardsData.length > 100) {
      errors.push('Cannot import more than 100 flashcards at once');
    }

    // Validate first few items for format
    for (let i = 0; i < Math.min(flashcardsData.length, 3); i++) {
      const validation = Flashcard.validate(flashcardsData[i]);
      if (!validation.isValid) {
        errors.push(`Item ${i + 1}: ${validation.errors.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate performance rating
   * @param {number} rating - Performance rating
   * @returns {Object} Validation result
   */
  static validatePerformanceRating(rating) {
    const errors = [];

    if (rating === undefined || rating === null) {
      errors.push('Performance rating is required');
    } else if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
      errors.push('Performance rating must be an integer between 0 and 5');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
const flashcardService = new FlashcardService();
export default flashcardService;