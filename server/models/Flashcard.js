import databaseConfig from '../config/database.js';

/**
 * Flashcard Model (Enhanced with User Isolation)
 * 
 * Handles all database operations for flashcards with strict user isolation.
 * Each flashcard belongs to exactly one user and cannot be accessed by others
 * (except admin users via admin endpoints).
 * 
 * Compatible with D1 database (SQLite syntax)
 */

class Flashcard {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize the model with database connection
   */
  async initialize() {
    if (!this.db) {
      await databaseConfig.initialize();
      this.db = databaseConfig.getDatabase();
    }
    return this;
  }

  /**
   * Create a new flashcard for a specific user
   * @param {Object} flashcardData - Flashcard data
   * @param {string} flashcardData.english - English text
   * @param {string} flashcardData.spanish - Spanish text
   * @param {number} flashcardData.userId - Owner user ID
   * @param {number} [flashcardData.difficulty=0] - Initial difficulty
   * @returns {Object} Created flashcard
   */
  async create(flashcardData) {
    await this.initialize();

    const { english, spanish, userId, difficulty = 0 } = flashcardData;

    // Validate required fields
    if (!english || !spanish || !userId) {
      throw new Error('English, Spanish, and userId are required');
    }

    // Validate and sanitize text fields
    const englishText = english.trim();
    const spanishText = spanish.trim();

    if (!englishText || !spanishText) {
      throw new Error('English and Spanish text cannot be empty');
    }

    if (englishText.length > 500 || spanishText.length > 500) {
      throw new Error('Text fields cannot exceed 500 characters');
    }

    // Validate userId
    if (!Number.isInteger(Number(userId))) {
      throw new Error('Valid userId is required');
    }

    // Validate difficulty
    if (!Number.isInteger(difficulty) || difficulty < 0) {
      throw new Error('Difficulty must be a non-negative integer');
    }

    try {
      // Insert new flashcard
      const insertStatement = this.db.prepare(`
        INSERT INTO flashcards (english, spanish, user_id, difficulty, review_count, last_reviewed) 
        VALUES (?, ?, ?, ?, 0, NULL)
      `);

      const result = insertStatement.run(
        englishText,
        spanishText,
        Number(userId),
        difficulty
      );

      // Return created flashcard
      return this.findById(result.lastInsertRowid, userId);

    } catch (error) {
      if (error.message.includes('FOREIGN KEY constraint failed')) {
        throw new Error('Invalid user ID');
      }
      throw error;
    }
  }

  /**
   * Find flashcard by ID with user ownership validation
   * @param {number} id - Flashcard ID
   * @param {number} requestingUserId - ID of user requesting access
   * @param {string} [userRole='user'] - Role of requesting user
   * @returns {Object|null} Flashcard data
   */
  async findById(id, requestingUserId, userRole = 'user') {
    await this.initialize();

    if (!id || !Number.isInteger(Number(id))) {
      throw new Error('Valid flashcard ID is required');
    }

    if (!requestingUserId || !Number.isInteger(Number(requestingUserId))) {
      throw new Error('Valid requesting user ID is required');
    }

    let query = `
      SELECT 
        id, 
        english, 
        spanish, 
        user_id as userId,
        difficulty, 
        review_count as reviewCount,
        last_reviewed as lastReviewed
      FROM flashcards 
      WHERE id = ?
    `;

    const params = [Number(id)];

    // Add user ownership filter unless admin
    if (userRole !== 'admin') {
      query += ' AND user_id = ?';
      params.push(Number(requestingUserId));
    }

    const flashcard = this.db.prepare(query).get(...params);
    return flashcard || null;
  }

  /**
   * Find all flashcards for a specific user
   * @param {number} userId - User ID
   * @param {Object} [options] - Query options
   * @param {number} [options.limit] - Maximum number of results
   * @param {string} [options.orderBy='last_reviewed'] - Sort field
   * @param {string} [options.order='ASC'] - Sort direction
   * @returns {Array} Array of flashcards
   */
  async findByUserId(userId, options = {}) {
    await this.initialize();

    if (!userId || !Number.isInteger(Number(userId))) {
      throw new Error('Valid user ID is required');
    }

    const { limit, orderBy = 'last_reviewed', order = 'ASC' } = options;

    // Validate orderBy field
    const allowedOrderFields = ['id', 'english', 'spanish', 'difficulty', 'review_count', 'last_reviewed'];
    if (!allowedOrderFields.includes(orderBy)) {
      throw new Error(`Invalid orderBy field. Allowed: ${allowedOrderFields.join(', ')}`);
    }

    // Validate order direction
    const normalizedOrder = order.toUpperCase();
    if (!['ASC', 'DESC'].includes(normalizedOrder)) {
      throw new Error('Order must be ASC or DESC');
    }

    let query = `
      SELECT 
        id, 
        english, 
        spanish, 
        user_id as userId,
        difficulty, 
        review_count as reviewCount,
        last_reviewed as lastReviewed
      FROM flashcards 
      WHERE user_id = ?
      ORDER BY ${orderBy} ${normalizedOrder}
    `;

    const params = [Number(userId)];

    // Add limit if specified
    if (limit && Number.isInteger(limit) && limit > 0) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const flashcards = this.db.prepare(query).all(...params);
    return flashcards;
  }

  /**
   * Update flashcard with user ownership validation
   * @param {number} id - Flashcard ID
   * @param {Object} updateData - Data to update
   * @param {number} requestingUserId - ID of user requesting update
   * @param {string} [userRole='user'] - Role of requesting user
   * @returns {Object|null} Updated flashcard
   */
  async update(id, updateData, requestingUserId, userRole = 'user') {
    await this.initialize();

    if (!id || !Number.isInteger(Number(id))) {
      throw new Error('Valid flashcard ID is required');
    }

    if (!requestingUserId || !Number.isInteger(Number(requestingUserId))) {
      throw new Error('Valid requesting user ID is required');
    }

    // First check if flashcard exists and user has access
    const existingFlashcard = await this.findById(id, requestingUserId, userRole);
    if (!existingFlashcard) {
      return null; // Not found or no access
    }

    // Only allow updating specific fields
    const allowedFields = ['english', 'spanish', 'difficulty'];
    const updates = {};
    let hasUpdates = false;

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'english' || field === 'spanish') {
          const text = updateData[field].trim();
          if (!text) {
            throw new Error(`${field} text cannot be empty`);
          }
          if (text.length > 500) {
            throw new Error(`${field} text cannot exceed 500 characters`);
          }
          updates[field] = text;
        } else if (field === 'difficulty') {
          const difficulty = Number(updateData[field]);
          if (!Number.isInteger(difficulty) || difficulty < 0) {
            throw new Error('Difficulty must be a non-negative integer');
          }
          updates[field] = difficulty;
        }
        hasUpdates = true;
      }
    }

    if (!hasUpdates) {
      // No updates needed, return current flashcard
      return existingFlashcard;
    }

    // Build dynamic update query
    const setClause = Object.keys(updates).map(field => `${field} = ?`).join(', ');
    const values = Object.values(updates);

    // Add WHERE conditions
    let whereClause = 'WHERE id = ?';
    values.push(Number(id));

    // Add user ownership filter unless admin
    if (userRole !== 'admin') {
      whereClause += ' AND user_id = ?';
      values.push(Number(requestingUserId));
    }

    try {
      const updateStatement = this.db.prepare(`
        UPDATE flashcards SET ${setClause} ${whereClause}
      `);

      const result = updateStatement.run(...values);

      if (result.changes === 0) {
        return null; // Not found or no access
      }

      return this.findById(id, requestingUserId, userRole);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete flashcard with user ownership validation
   * @param {number} id - Flashcard ID
   * @param {number} requestingUserId - ID of user requesting deletion
   * @param {string} [userRole='user'] - Role of requesting user
   * @returns {boolean} Success status
   */
  async delete(id, requestingUserId, userRole = 'user') {
    await this.initialize();

    if (!id || !Number.isInteger(Number(id))) {
      throw new Error('Valid flashcard ID is required');
    }

    if (!requestingUserId || !Number.isInteger(Number(requestingUserId))) {
      throw new Error('Valid requesting user ID is required');
    }

    // Build WHERE clause with ownership validation
    let whereClause = 'WHERE id = ?';
    const params = [Number(id)];

    // Add user ownership filter unless admin
    if (userRole !== 'admin') {
      whereClause += ' AND user_id = ?';
      params.push(Number(requestingUserId));
    }

    const deleteStatement = this.db.prepare(`
      DELETE FROM flashcards ${whereClause}
    `);

    const result = deleteStatement.run(...params);
    return result.changes > 0;
  }

  /**
   * Review flashcard (update difficulty and statistics)
   * @param {number} id - Flashcard ID
   * @param {number} difficulty - New difficulty level (0-5)
   * @param {number} requestingUserId - ID of user reviewing
   * @param {string} [userRole='user'] - Role of requesting user
   * @returns {Object|null} Updated flashcard
   */
  async review(id, difficulty, requestingUserId, userRole = 'user') {
    await this.initialize();

    if (!id || !Number.isInteger(Number(id))) {
      throw new Error('Valid flashcard ID is required');
    }

    if (!Number.isInteger(difficulty) || difficulty < 0 || difficulty > 5) {
      throw new Error('Difficulty must be an integer between 0 and 5');
    }

    if (!requestingUserId || !Number.isInteger(Number(requestingUserId))) {
      throw new Error('Valid requesting user ID is required');
    }

    // First check if flashcard exists and user has access
    const existingFlashcard = await this.findById(id, requestingUserId, userRole);
    if (!existingFlashcard) {
      return null; // Not found or no access
    }

    const now = new Date().toISOString();

    // Build WHERE clause with ownership validation
    let whereClause = 'WHERE id = ?';
    const params = [difficulty, now, Number(id)];

    // Add user ownership filter unless admin
    if (userRole !== 'admin') {
      whereClause += ' AND user_id = ?';
      params.push(Number(requestingUserId));
    }

    try {
      const updateStatement = this.db.prepare(`
        UPDATE flashcards 
        SET difficulty = ?, 
            last_reviewed = ?, 
            review_count = review_count + 1 
        ${whereClause}
      `);

      const result = updateStatement.run(...params);

      if (result.changes === 0) {
        return null; // Not found or no access
      }

      return this.findById(id, requestingUserId, userRole);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get flashcards for study session (spaced repetition)
   * @param {number} userId - User ID
   * @param {number} [limit=10] - Maximum number of flashcards
   * @returns {Array} Array of flashcards ordered by spaced repetition priority
   */
  async getStudyCards(userId, limit = 10) {
    await this.initialize();

    if (!userId || !Number.isInteger(Number(userId))) {
      throw new Error('Valid user ID is required');
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new Error('Limit must be between 1 and 50');
    }

    // Spaced repetition query: prioritize cards that haven't been reviewed recently
    // or have lower difficulty (need more practice)
    const query = `
      SELECT 
        id, 
        english, 
        spanish, 
        user_id as userId,
        difficulty, 
        review_count as reviewCount,
        last_reviewed as lastReviewed
      FROM flashcards 
      WHERE user_id = ?
      ORDER BY 
        CASE 
          WHEN last_reviewed IS NULL THEN 0
          ELSE julianday('now') - julianday(last_reviewed) 
        END DESC,
        difficulty ASC,
        review_count ASC
      LIMIT ?
    `;

    const flashcards = this.db.prepare(query).all(Number(userId), limit);
    return flashcards;
  }

  /**
   * Get flashcard statistics for a user
   * @param {number} userId - User ID
   * @returns {Object} Flashcard statistics
   */
  async getStatsByUserId(userId) {
    await this.initialize();

    if (!userId || !Number.isInteger(Number(userId))) {
      throw new Error('Valid user ID is required');
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_flashcards,
        AVG(difficulty) as average_difficulty,
        SUM(review_count) as total_reviews,
        COUNT(CASE WHEN last_reviewed IS NOT NULL THEN 1 END) as reviewed_cards,
        COUNT(CASE WHEN last_reviewed IS NULL THEN 1 END) as unreviewed_cards,
        COUNT(CASE WHEN difficulty = 0 THEN 1 END) as difficulty_0,
        COUNT(CASE WHEN difficulty = 1 THEN 1 END) as difficulty_1,
        COUNT(CASE WHEN difficulty = 2 THEN 1 END) as difficulty_2,
        COUNT(CASE WHEN difficulty = 3 THEN 1 END) as difficulty_3,
        COUNT(CASE WHEN difficulty = 4 THEN 1 END) as difficulty_4,
        COUNT(CASE WHEN difficulty = 5 THEN 1 END) as difficulty_5,
        MAX(last_reviewed) as last_study_session
      FROM flashcards 
      WHERE user_id = ?
    `;

    const stats = this.db.prepare(statsQuery).get(Number(userId));

    return {
      totalFlashcards: stats.total_flashcards,
      averageDifficulty: stats.average_difficulty ? Math.round(stats.average_difficulty * 100) / 100 : 0,
      totalReviews: stats.total_reviews,
      reviewedCards: stats.reviewed_cards,
      unreviewedCards: stats.unreviewed_cards,
      difficultyDistribution: {
        0: stats.difficulty_0,
        1: stats.difficulty_1,
        2: stats.difficulty_2,
        3: stats.difficulty_3,
        4: stats.difficulty_4,
        5: stats.difficulty_5
      },
      lastStudySession: stats.last_study_session
    };
  }

  /**
   * Get all flashcards for a user (admin function)
   * @param {number} userId - User ID
   * @returns {Array} All flashcards for the user
   */
  async findAllByUserId(userId) {
    await this.initialize();

    if (!userId || !Number.isInteger(Number(userId))) {
      throw new Error('Valid user ID is required');
    }

    const query = `
      SELECT 
        id, 
        english, 
        spanish, 
        user_id as userId,
        difficulty, 
        review_count as reviewCount,
        last_reviewed as lastReviewed
      FROM flashcards 
      WHERE user_id = ?
      ORDER BY id ASC
    `;

    const flashcards = this.db.prepare(query).all(Number(userId));
    return flashcards;
  }

  /**
   * Delete all flashcards for a user (used when deleting user account)
   * @param {number} userId - User ID
   * @returns {number} Number of deleted flashcards
   */
  async deleteAllByUserId(userId) {
    await this.initialize();

    if (!userId || !Number.isInteger(Number(userId))) {
      throw new Error('Valid user ID is required');
    }

    const deleteStatement = this.db.prepare('DELETE FROM flashcards WHERE user_id = ?');
    const result = deleteStatement.run(Number(userId));

    return result.changes;
  }

  /**
   * Get system-wide flashcard statistics (admin function)
   * @returns {Object} System flashcard statistics
   */
  async getSystemStats() {
    await this.initialize();

    const statsQuery = `
      SELECT 
        COUNT(*) as total_flashcards,
        AVG(difficulty) as average_difficulty,
        SUM(review_count) as total_reviews,
        COUNT(DISTINCT user_id) as users_with_flashcards,
        COUNT(CASE WHEN last_reviewed > datetime('now', '-7 days') THEN 1 END) as reviewed_last_week,
        COUNT(CASE WHEN last_reviewed > datetime('now', '-30 days') THEN 1 END) as reviewed_last_month
      FROM flashcards
    `;

    const stats = this.db.prepare(statsQuery).get();

    return {
      totalFlashcards: stats.total_flashcards,
      averageDifficulty: stats.average_difficulty ? Math.round(stats.average_difficulty * 100) / 100 : 0,
      totalReviews: stats.total_reviews,
      usersWithFlashcards: stats.users_with_flashcards,
      reviewedLastWeek: stats.reviewed_last_week,
      reviewedLastMonth: stats.reviewed_last_month
    };
  }

  /**
   * Check if flashcard exists and belongs to user
   * @param {number} id - Flashcard ID
   * @param {number} userId - User ID
   * @returns {boolean} Whether flashcard exists and belongs to user
   */
  async existsForUser(id, userId) {
    await this.initialize();

    if (!id || !Number.isInteger(Number(id)) || !userId || !Number.isInteger(Number(userId))) {
      return false;
    }

    const flashcard = this.db.prepare(
      'SELECT id FROM flashcards WHERE id = ? AND user_id = ?'
    ).get(Number(id), Number(userId));

    return !!flashcard;
  }

  /**
   * Get flashcard count for a user
   * @param {number} userId - User ID
   * @returns {number} Number of flashcards
   */
  async countByUserId(userId) {
    await this.initialize();

    if (!userId || !Number.isInteger(Number(userId))) {
      throw new Error('Valid user ID is required');
    }

    const result = this.db.prepare(
      'SELECT COUNT(*) as count FROM flashcards WHERE user_id = ?'
    ).get(Number(userId));

    return result.count;
  }

  /**
   * Validate user access to flashcard
   * @param {number} flashcardId - Flashcard ID
   * @param {number} userId - User ID
   * @param {string} userRole - User role
   * @returns {boolean} Whether user can access flashcard
   */
  static canUserAccess(flashcardId, userId, userRole) {
    // Admin can access all flashcards
    if (userRole === 'admin') {
      return true;
    }

    // For regular users, additional database check needed
    // This is just a helper method - actual validation done in model methods
    return Number.isInteger(Number(flashcardId)) && Number.isInteger(Number(userId));
  }

  /**
   * Validate flashcard data
   * @param {Object} data - Flashcard data to validate
   * @returns {Object} Validation result
   */
  static validate(data) {
    const errors = [];

    if (!data.english || !data.english.trim()) {
      errors.push('English text is required');
    } else if (data.english.trim().length > 500) {
      errors.push('English text cannot exceed 500 characters');
    }

    if (!data.spanish || !data.spanish.trim()) {
      errors.push('Spanish text is required');
    } else if (data.spanish.trim().length > 500) {
      errors.push('Spanish text cannot exceed 500 characters');
    }

    if (data.difficulty !== undefined) {
      const difficulty = Number(data.difficulty);
      if (!Number.isInteger(difficulty) || difficulty < 0 || difficulty > 5) {
        errors.push('Difficulty must be an integer between 0 and 5');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
const flashcardModel = new Flashcard();
export default flashcardModel;