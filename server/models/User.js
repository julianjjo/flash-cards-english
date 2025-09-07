import databaseConfig from '../config/database.js';

/**
 * User Model
 * 
 * Handles all database operations for users including authentication,
 * profile management, and admin user oversight.
 * 
 * Compatible with D1 database (SQLite syntax)
 */

class User {
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
   * Create a new user
   * @param {Object} userData - User data
   * @param {string} userData.email - User email (will be lowercased)
   * @param {string} userData.password_hash - Bcrypt hashed password
   * @param {string} [userData.role='user'] - User role (user|admin)
   * @returns {Object} Created user without password_hash
   */
  async create(userData) {
    await this.initialize();

    const { email, password_hash, role = 'user' } = userData;
    
    // Validate required fields
    if (!email || !password_hash) {
      throw new Error('Email and password_hash are required');
    }

    // Validate role
    if (!['user', 'admin'].includes(role)) {
      throw new Error('Role must be either "user" or "admin"');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const now = new Date().toISOString();

    try {
      // Check if user already exists
      const existingUser = this.db.prepare(
        'SELECT id FROM users WHERE email = ?'
      ).get(normalizedEmail);

      if (existingUser) {
        throw new Error('Email already registered');
      }

      // Insert new user
      const insertStatement = this.db.prepare(`
        INSERT INTO users (email, password_hash, role, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = insertStatement.run(
        normalizedEmail,
        password_hash,
        role,
        now,
        now
      );

      // Return created user without password_hash
      return this.findById(result.lastInsertRowid);

    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new Error('Email already registered');
      }
      throw error;
    }
  }

  /**
   * Find user by ID
   * @param {number} id - User ID
   * @returns {Object|null} User data without password_hash
   */
  async findById(id) {
    await this.initialize();

    if (!id || !Number.isInteger(Number(id))) {
      throw new Error('Valid user ID is required');
    }

    const user = this.db.prepare(`
      SELECT id, email, role, created_at, updated_at 
      FROM users 
      WHERE id = ?
    `).get(Number(id));

    return user || null;
  }

  /**
   * Find user by email (for authentication)
   * @param {string} email - User email
   * @returns {Object|null} User data with password_hash for verification
   */
  async findByEmail(email) {
    await this.initialize();

    if (!email) {
      throw new Error('Email is required');
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    const user = this.db.prepare(`
      SELECT id, email, password_hash, role, created_at, updated_at 
      FROM users 
      WHERE email = ?
    `).get(normalizedEmail);

    return user || null;
  }

  /**
   * Find user by email for public data (without password_hash)
   * @param {string} email - User email
   * @returns {Object|null} User data without password_hash
   */
  async findByEmailPublic(email) {
    await this.initialize();

    if (!email) {
      throw new Error('Email is required');
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    const user = this.db.prepare(`
      SELECT id, email, role, created_at, updated_at 
      FROM users 
      WHERE email = ?
    `).get(normalizedEmail);

    return user || null;
  }

  /**
   * Update user profile
   * @param {number} id - User ID
   * @param {Object} updateData - Data to update
   * @returns {Object|null} Updated user data
   */
  async update(id, updateData) {
    await this.initialize();

    if (!id || !Number.isInteger(Number(id))) {
      throw new Error('Valid user ID is required');
    }

    // Only allow updating specific fields
    const allowedFields = ['email', 'role'];
    const updates = {};
    let hasUpdates = false;

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates[field] = field === 'email' 
          ? updateData[field].toLowerCase().trim() 
          : updateData[field];
        hasUpdates = true;
      }
    }

    if (!hasUpdates) {
      // No updates needed, return current user
      return this.findById(id);
    }

    // Validate email if being updated
    if (updates.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.email)) {
        throw new Error('Invalid email format');
      }

      // Check if email is already taken by another user
      const existingUser = this.db.prepare(
        'SELECT id FROM users WHERE email = ? AND id != ?'
      ).get(updates.email, Number(id));

      if (existingUser) {
        throw new Error('Email already taken');
      }
    }

    // Validate role if being updated
    if (updates.role && !['user', 'admin'].includes(updates.role)) {
      throw new Error('Role must be either "user" or "admin"');
    }

    const now = new Date().toISOString();
    updates.updated_at = now;

    // Build dynamic update query
    const setClause = Object.keys(updates).map(field => `${field} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(Number(id));

    try {
      const updateStatement = this.db.prepare(`
        UPDATE users SET ${setClause} WHERE id = ?
      `);

      const result = updateStatement.run(...values);

      if (result.changes === 0) {
        return null; // User not found
      }

      return this.findById(id);

    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new Error('Email already taken');
      }
      throw error;
    }
  }

  /**
   * Update user password
   * @param {number} id - User ID
   * @param {string} password_hash - New bcrypt hashed password
   * @returns {boolean} Success status
   */
  async updatePassword(id, password_hash) {
    await this.initialize();

    if (!id || !Number.isInteger(Number(id))) {
      throw new Error('Valid user ID is required');
    }

    if (!password_hash) {
      throw new Error('Password hash is required');
    }

    const now = new Date().toISOString();

    const updateStatement = this.db.prepare(`
      UPDATE users 
      SET password_hash = ?, updated_at = ? 
      WHERE id = ?
    `);

    const result = updateStatement.run(password_hash, now, Number(id));
    return result.changes > 0;
  }

  /**
   * Delete user by ID
   * @param {number} id - User ID
   * @returns {boolean} Success status
   */
  async delete(id) {
    await this.initialize();

    if (!id || !Number.isInteger(Number(id))) {
      throw new Error('Valid user ID is required');
    }

    // Note: Flashcards will be cascade deleted by foreign key constraint
    const deleteStatement = this.db.prepare('DELETE FROM users WHERE id = ?');
    const result = deleteStatement.run(Number(id));

    return result.changes > 0;
  }

  /**
   * Get paginated list of users (admin function)
   * @param {Object} options - Query options
   * @param {number} [options.page=1] - Page number (1-based)
   * @param {number} [options.limit=20] - Items per page
   * @param {string} [options.role] - Filter by role
   * @returns {Object} Paginated user list with metadata
   */
  async findAll(options = {}) {
    await this.initialize();

    const { page = 1, limit = 20, role } = options;

    // Validate pagination parameters
    if (!Number.isInteger(page) || page < 1) {
      throw new Error('Page must be a positive integer');
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }

    // Build WHERE clause
    let whereClause = '';
    let whereParams = [];

    if (role) {
      if (!['user', 'admin'].includes(role)) {
        throw new Error('Role must be either "user" or "admin"');
      }
      whereClause = 'WHERE role = ?';
      whereParams = [role];
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const countResult = this.db.prepare(countQuery).get(...whereParams);
    const total = countResult.total;

    // Calculate pagination
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);

    // Get users with flashcard counts
    const usersQuery = `
      SELECT 
        u.id, 
        u.email, 
        u.role, 
        u.created_at,
        COUNT(f.id) as flashcard_count
      FROM users u
      LEFT JOIN flashcards f ON u.id = f.user_id
      ${whereClause}
      GROUP BY u.id, u.email, u.role, u.created_at
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const queryParams = [...whereParams, limit, offset];
    const users = this.db.prepare(usersQuery).all(...queryParams);

    // Format response
    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.created_at,
      flashcardCount: user.flashcard_count
    }));

    return {
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };
  }

  /**
   * Get user details with additional metadata (admin function)
   * @param {number} id - User ID
   * @returns {Object|null} Detailed user information
   */
  async findByIdDetailed(id) {
    await this.initialize();

    if (!id || !Number.isInteger(Number(id))) {
      throw new Error('Valid user ID is required');
    }

    const userQuery = `
      SELECT 
        u.id,
        u.email,
        u.role,
        u.created_at,
        u.updated_at,
        COUNT(f.id) as flashcard_count,
        MAX(f.last_reviewed) as last_activity
      FROM users u
      LEFT JOIN flashcards f ON u.id = f.user_id
      WHERE u.id = ?
      GROUP BY u.id, u.email, u.role, u.created_at, u.updated_at
    `;

    const user = this.db.prepare(userQuery).get(Number(id));

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      flashcardCount: user.flashcard_count,
      lastLoginAt: user.last_activity // Using last_reviewed as proxy for activity
    };
  }

  /**
   * Get system-wide user statistics (admin function)
   * @returns {Object} User statistics
   */
  async getStats() {
    await this.initialize();

    const statsQuery = `
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_users,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as regular_users,
        SUM(CASE WHEN datetime(created_at) > datetime('now', '-30 days') THEN 1 ELSE 0 END) as new_users_30_days,
        (
          SELECT COUNT(*) 
          FROM flashcards f 
          JOIN users u ON f.user_id = u.id 
          WHERE f.last_reviewed > datetime('now', '-30 days')
        ) as active_users_30_days
      FROM users
    `;

    const stats = this.db.prepare(statsQuery).get();

    return {
      totalUsers: stats.total_users,
      adminUsers: stats.admin_users,
      regularUsers: stats.regular_users,
      newUsers30Days: stats.new_users_30_days,
      activeUsers: stats.active_users_30_days
    };
  }

  /**
   * Check if user exists
   * @param {number} id - User ID
   * @returns {boolean} Whether user exists
   */
  async exists(id) {
    await this.initialize();

    if (!id || !Number.isInteger(Number(id))) {
      return false;
    }

    const user = this.db.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).get(Number(id));

    return !!user;
  }

  /**
   * Get user count
   * @returns {number} Total number of users
   */
  async count() {
    await this.initialize();

    const result = this.db.prepare('SELECT COUNT(*) as count FROM users').get();
    return result.count;
  }

  /**
   * Validate user ownership (helper method)
   * @param {number} userId - User ID
   * @param {number} resourceUserId - Resource owner ID
   * @param {string} userRole - User role
   * @returns {boolean} Whether user can access resource
   */
  static canAccessResource(userId, resourceUserId, userRole) {
    // Admin can access everything
    if (userRole === 'admin') {
      return true;
    }

    // Users can only access their own resources
    return Number(userId) === Number(resourceUserId);
  }

  /**
   * Sanitize user data for public response (remove sensitive fields)
   * @param {Object} user - User data
   * @returns {Object} Sanitized user data
   */
  static sanitize(user) {
    if (!user) return null;

    const { password_hash, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  /**
   * Validate user role
   * @param {string} role - Role to validate
   * @returns {boolean} Whether role is valid
   */
  static isValidRole(role) {
    return ['user', 'admin'].includes(role);
  }

  /**
   * Check if user is admin
   * @param {Object} user - User object
   * @returns {boolean} Whether user is admin
   */
  static isAdmin(user) {
    return user && user.role === 'admin';
  }
}

// Export singleton instance
const userModel = new User();
export default userModel;