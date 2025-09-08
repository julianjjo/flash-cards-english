import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Database helpers for E2E testing
 * 
 * This module provides utilities for managing test database state,
 * creating test data, and ensuring data isolation between tests.
 * 
 * Usage:
 *   import { DatabaseHelper } from '../utils/databaseHelpers.js';
 *   const dbHelper = new DatabaseHelper();
 *   await dbHelper.createTestUser('test@example.com', 'password');
 */

export class DatabaseHelper {
  constructor() {
    // Use a separate test database
    this.dbPath = process.env.NODE_ENV === 'test' 
      ? path.join(__dirname, '../../../server/flashcards-test.db')
      : path.join(__dirname, '../../../server/flashcards.db');
    
    this.db = null;
  }

  // Initialize database connection
  connect() {
    if (!this.db) {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.ensureTablesExist();
    }
    return this.db;
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // Ensure all required tables exist
  ensureTablesExist() {
    const db = this.connect();
    
    // Create users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create flashcards table
    db.exec(`
      CREATE TABLE IF NOT EXISTS flashcards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        english TEXT NOT NULL,
        spanish TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
        last_reviewed DATETIME,
        review_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Create study_sessions table for tracking learning progress
    db.exec(`
      CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        flashcard_id INTEGER NOT NULL,
        quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
        response_time INTEGER,
        session_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (flashcard_id) REFERENCES flashcards (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_flashcards_user_id ON flashcards (user_id);
      CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions (user_id);
      CREATE INDEX IF NOT EXISTS idx_study_sessions_flashcard_id ON study_sessions (flashcard_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
    `);
  }

  // Transaction wrapper for test isolation
  runInTransaction(callback) {
    const db = this.connect();
    const transaction = db.transaction(callback);
    return transaction();
  }

  // Clear all data from tables
  clearAllData() {
    const db = this.connect();
    db.exec('DELETE FROM study_sessions');
    db.exec('DELETE FROM flashcards');
    db.exec('DELETE FROM users');
    
    // Reset auto-increment counters
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'flashcards', 'study_sessions')");
  }

  // User management methods
  async createTestUser(email, password, role = 'user') {
    const db = this.connect();
    const passwordHash = await bcrypt.hash(password, 10);
    
    const stmt = db.prepare(`
      INSERT INTO users (email, password_hash, role)
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(email, passwordHash, role);
    return result.lastInsertRowid;
  }

  getUser(email) {
    const db = this.connect();
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  }

  getUserById(userId) {
    const db = this.connect();
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(userId);
  }

  deleteUser(email) {
    const db = this.connect();
    const stmt = db.prepare('DELETE FROM users WHERE email = ?');
    return stmt.run(email);
  }

  getAllUsers() {
    const db = this.connect();
    const stmt = db.prepare('SELECT * FROM users ORDER BY created_at');
    return stmt.all();
  }

  updateUserRole(email, role) {
    const db = this.connect();
    const stmt = db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?');
    return stmt.run(role, email);
  }

  // Flashcard management methods
  createFlashcard(userId, english, spanish, difficulty = 1) {
    const db = this.connect();
    const stmt = db.prepare(`
      INSERT INTO flashcards (user_id, english, spanish, difficulty)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(userId, english, spanish, difficulty);
    return result.lastInsertRowid;
  }

  getFlashcard(flashcardId) {
    const db = this.connect();
    const stmt = db.prepare('SELECT * FROM flashcards WHERE id = ?');
    return stmt.get(flashcardId);
  }

  getUserFlashcards(userId) {
    const db = this.connect();
    const stmt = db.prepare('SELECT * FROM flashcards WHERE user_id = ? ORDER BY created_at');
    return stmt.all(userId);
  }

  updateFlashcard(flashcardId, english, spanish) {
    const db = this.connect();
    const stmt = db.prepare(`
      UPDATE flashcards 
      SET english = ?, spanish = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    return stmt.run(english, spanish, flashcardId);
  }

  updateFlashcardDifficulty(flashcardId, difficulty, reviewCount = null) {
    const db = this.connect();
    
    let sql = 'UPDATE flashcards SET difficulty = ?, last_reviewed = CURRENT_TIMESTAMP';
    let params = [difficulty];
    
    if (reviewCount !== null) {
      sql += ', review_count = ?';
      params.push(reviewCount);
    }
    
    sql += ', updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    params.push(flashcardId);
    
    const stmt = db.prepare(sql);
    return stmt.run(...params);
  }

  deleteFlashcard(flashcardId) {
    const db = this.connect();
    const stmt = db.prepare('DELETE FROM flashcards WHERE id = ?');
    return stmt.run(flashcardId);
  }

  deleteUserFlashcards(userId) {
    const db = this.connect();
    const stmt = db.prepare('DELETE FROM flashcards WHERE user_id = ?');
    return stmt.run(userId);
  }

  // Study session methods
  createStudySession(userId, flashcardId, qualityRating, responseTime = null) {
    const db = this.connect();
    const stmt = db.prepare(`
      INSERT INTO study_sessions (user_id, flashcard_id, quality_rating, response_time)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(userId, flashcardId, qualityRating, responseTime);
    return result.lastInsertRowid;
  }

  getUserStudySessions(userId) {
    const db = this.connect();
    const stmt = db.prepare(`
      SELECT ss.*, f.english, f.spanish
      FROM study_sessions ss
      JOIN flashcards f ON ss.flashcard_id = f.id
      WHERE ss.user_id = ?
      ORDER BY ss.session_date DESC
    `);
    return stmt.all(userId);
  }

  getFlashcardStudySessions(flashcardId) {
    const db = this.connect();
    const stmt = db.prepare('SELECT * FROM study_sessions WHERE flashcard_id = ? ORDER BY session_date');
    return stmt.all(flashcardId);
  }

  // Statistics methods
  getUserStats(userId) {
    const db = this.connect();
    
    const totalFlashcards = db.prepare('SELECT COUNT(*) as count FROM flashcards WHERE user_id = ?').get(userId).count;
    const totalReviews = db.prepare('SELECT COUNT(*) as count FROM study_sessions WHERE user_id = ?').get(userId).count;
    const avgQuality = db.prepare('SELECT AVG(quality_rating) as avg FROM study_sessions WHERE user_id = ?').get(userId).avg || 0;
    
    const difficultyDistribution = db.prepare(`
      SELECT difficulty, COUNT(*) as count 
      FROM flashcards 
      WHERE user_id = ? 
      GROUP BY difficulty
    `).all(userId);
    
    const recentActivity = db.prepare(`
      SELECT DATE(session_date) as date, COUNT(*) as reviews
      FROM study_sessions 
      WHERE user_id = ? AND session_date > datetime('now', '-30 days')
      GROUP BY DATE(session_date)
      ORDER BY date DESC
    `).all(userId);
    
    return {
      totalFlashcards,
      totalReviews,
      averageQuality: Math.round(avgQuality * 100) / 100,
      difficultyDistribution,
      recentActivity
    };
  }

  getSystemStats() {
    const db = this.connect();
    
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const totalFlashcards = db.prepare('SELECT COUNT(*) as count FROM flashcards').get().count;
    const totalStudySessions = db.prepare('SELECT COUNT(*) as count FROM study_sessions').get().count;
    const activeUsersToday = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count 
      FROM study_sessions 
      WHERE DATE(session_date) = DATE('now')
    `).get().count;
    
    return {
      totalUsers,
      totalFlashcards,
      totalStudySessions,
      activeUsersToday
    };
  }

  // Test data creation helpers
  async createTestDataSet(userEmail, password, flashcardCount = 10) {
    return this.runInTransaction(async () => {
      // Create user
      const userId = await this.createTestUser(userEmail, password);
      
      // Create flashcards
      const flashcardData = [
        { english: 'Hello', spanish: 'Hola' },
        { english: 'Goodbye', spanish: 'Adiós' },
        { english: 'Please', spanish: 'Por favor' },
        { english: 'Thank you', spanish: 'Gracias' },
        { english: 'Excuse me', spanish: 'Disculpe' },
        { english: 'Yes', spanish: 'Sí' },
        { english: 'No', spanish: 'No' },
        { english: 'Water', spanish: 'Agua' },
        { english: 'Food', spanish: 'Comida' },
        { english: 'Help', spanish: 'Ayuda' }
      ];
      
      const flashcardIds = [];
      
      for (let i = 0; i < flashcardCount; i++) {
        const data = flashcardData[i % flashcardData.length];
        const suffix = i >= flashcardData.length ? ` ${Math.floor(i / flashcardData.length) + 1}` : '';
        
        const flashcardId = this.createFlashcard(
          userId,
          `${data.english}${suffix}`,
          `${data.spanish}${suffix}`,
          Math.floor(Math.random() * 5) + 1 // Random difficulty 1-5
        );
        
        flashcardIds.push(flashcardId);
      }
      
      // Create some study sessions
      const sessionCount = Math.min(flashcardCount * 2, 20);
      for (let i = 0; i < sessionCount; i++) {
        const flashcardId = flashcardIds[Math.floor(Math.random() * flashcardIds.length)];
        const quality = Math.floor(Math.random() * 5) + 1;
        const responseTime = Math.floor(Math.random() * 5000) + 1000; // 1-6 seconds
        
        this.createStudySession(userId, flashcardId, quality, responseTime);
      }
      
      return { userId, flashcardIds };
    });
  }

  async createMultipleTestUsers(count = 3) {
    const users = [];
    
    for (let i = 0; i < count; i++) {
      const email = `testuser${i + 1}@example.com`;
      const password = 'password123';
      const role = i === 0 ? 'admin' : 'user'; // First user is admin
      
      const userId = await this.createTestUser(email, password, role);
      users.push({ userId, email, password, role });
    }
    
    return users;
  }

  // Data validation methods
  validateFlashcardOwnership(flashcardId, expectedUserId) {
    const flashcard = this.getFlashcard(flashcardId);
    return flashcard && flashcard.user_id === expectedUserId;
  }

  validateUserDataIsolation(userId1, userId2) {
    const user1Flashcards = this.getUserFlashcards(userId1);
    const user2Flashcards = this.getUserFlashcards(userId2);
    
    // Check that users don't have access to each other's flashcards
    const user1Ids = user1Flashcards.map(f => f.id);
    const user2Ids = user2Flashcards.map(f => f.id);
    
    const hasOverlap = user1Ids.some(id => user2Ids.includes(id));
    return !hasOverlap;
  }

  // Performance test helpers
  createLargeDataset(userId, flashcardCount = 1000) {
    const db = this.connect();
    const insertStmt = db.prepare(`
      INSERT INTO flashcards (user_id, english, spanish, difficulty)
      VALUES (?, ?, ?, ?)
    `);
    
    const transaction = db.transaction((flashcards) => {
      for (const flashcard of flashcards) {
        insertStmt.run(flashcard.userId, flashcard.english, flashcard.spanish, flashcard.difficulty);
      }
    });
    
    const flashcards = [];
    for (let i = 0; i < flashcardCount; i++) {
      flashcards.push({
        userId,
        english: `English word ${i + 1}`,
        spanish: `Palabra española ${i + 1}`,
        difficulty: (i % 5) + 1
      });
    }
    
    transaction(flashcards);
    return flashcardCount;
  }

  // Cleanup methods
  cleanupTestUser(email) {
    const user = this.getUser(email);
    if (user) {
      // Delete user's study sessions
      const db = this.connect();
      db.prepare('DELETE FROM study_sessions WHERE user_id = ?').run(user.id);
      
      // Delete user's flashcards
      db.prepare('DELETE FROM flashcards WHERE user_id = ?').run(user.id);
      
      // Delete user
      db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    }
  }

  cleanupTestData(testEmails = []) {
    const db = this.connect();
    
    if (testEmails.length > 0) {
      // Clean up specific test users
      for (const email of testEmails) {
        this.cleanupTestUser(email);
      }
    } else {
      // Clean up all test data (users with test email patterns)
      const testUsers = db.prepare("SELECT id FROM users WHERE email LIKE '%test%' OR email LIKE '%example.com'").all();
      
      for (const user of testUsers) {
        db.prepare('DELETE FROM study_sessions WHERE user_id = ?').run(user.id);
        db.prepare('DELETE FROM flashcards WHERE user_id = ?').run(user.id);
      }
      
      db.prepare("DELETE FROM users WHERE email LIKE '%test%' OR email LIKE '%example.com'").run();
    }
  }
}

// Singleton instance for shared database operations
export const dbHelper = new DatabaseHelper();

// Export convenience functions
export async function createTestUser(email, password, role = 'user') {
  return await dbHelper.createTestUser(email, password, role);
}

export function getUser(email) {
  return dbHelper.getUser(email);
}

export function createFlashcard(userId, english, spanish, difficulty = 1) {
  return dbHelper.createFlashcard(userId, english, spanish, difficulty);
}

export function getUserFlashcards(userId) {
  return dbHelper.getUserFlashcards(userId);
}

export function createStudySession(userId, flashcardId, qualityRating, responseTime = null) {
  return dbHelper.createStudySession(userId, flashcardId, qualityRating, responseTime);
}

export function getUserStats(userId) {
  return dbHelper.getUserStats(userId);
}

export function cleanupTestData(testEmails = []) {
  return dbHelper.cleanupTestData(testEmails);
}

export async function setupTestEnvironment() {
  // Ensure database is connected and tables exist
  dbHelper.connect();
  
  // Clear any existing test data
  dbHelper.cleanupTestData();
  
  // Create default admin user for tests
  try {
    await dbHelper.createTestUser('admin@example.com', 'adminpass', 'admin');
  } catch (error) {
    // User might already exist, ignore
  }
  
  return dbHelper;
}

export function teardownTestEnvironment() {
  dbHelper.cleanupTestData();
  dbHelper.close();
}

export default {
  DatabaseHelper,
  dbHelper,
  createTestUser,
  getUser,
  createFlashcard,
  getUserFlashcards,
  createStudySession,
  getUserStats,
  cleanupTestData,
  setupTestEnvironment,
  teardownTestEnvironment
};