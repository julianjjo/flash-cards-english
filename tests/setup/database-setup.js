import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

class TestDatabaseSetup {
  constructor() {
    this.testDbPath = process.env.DATABASE_PATH || './flashcards-e2e-test.db';
    this.db = null;
  }

  async setupTestDatabase() {
    // Remove existing test database if it exists
    if (fs.existsSync(this.testDbPath)) {
      fs.unlinkSync(this.testDbPath);
    }

    // Create new test database
    this.db = new Database(this.testDbPath);
    this.db.pragma('journal_mode = WAL');
    
    // Create tables
    await this.createTables();
    
    console.log(`Test database created at: ${this.testDbPath}`);
    return this.db;
  }

  async createTables() {
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createFlashcardsTable = `
      CREATE TABLE IF NOT EXISTS flashcards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        english TEXT NOT NULL,
        spanish TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        difficulty INTEGER DEFAULT 1 CHECK(difficulty >= 1 AND difficulty <= 5),
        last_reviewed DATETIME,
        review_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    const createSessionsTable = `
      CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        flashcard_id INTEGER NOT NULL,
        response_quality INTEGER CHECK(response_quality >= 1 AND response_quality <= 5),
        response_time INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (flashcard_id) REFERENCES flashcards(id) ON DELETE CASCADE
      )
    `;

    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_flashcards_user_id ON flashcards(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_flashcards_difficulty ON flashcards(difficulty)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON study_sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_flashcard_id ON study_sessions(flashcard_id)',
    ];

    try {
      this.db.exec(createUsersTable);
      this.db.exec(createFlashcardsTable);
      this.db.exec(createSessionsTable);
      
      createIndexes.forEach(indexSql => {
        this.db.exec(indexSql);
      });

      console.log('Test database tables created successfully');
    } catch (error) {
      console.error('Error creating test database tables:', error);
      throw error;
    }
  }

  async cleanDatabase() {
    if (!this.db) return;

    try {
      // Clear all tables in reverse dependency order
      this.db.exec('DELETE FROM study_sessions');
      this.db.exec('DELETE FROM flashcards');  
      this.db.exec('DELETE FROM users');
      
      // Reset autoincrement counters
      this.db.exec('DELETE FROM sqlite_sequence');
      
      console.log('Test database cleaned');
    } catch (error) {
      console.error('Error cleaning test database:', error);
      throw error;
    }
  }

  async closeDatabase() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async teardownTestDatabase() {
    await this.closeDatabase();
    
    if (fs.existsSync(this.testDbPath)) {
      try {
        fs.unlinkSync(this.testDbPath);
        console.log('Test database removed');
      } catch (error) {
        console.error('Error removing test database:', error);
      }
    }
  }

  getDatabase() {
    return this.db;
  }

  // Transaction wrapper for test isolation
  async withTransaction(callback) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction(callback);
    return transaction();
  }

  // Execute raw SQL for test setup
  async executeSQL(sql, params = []) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      if (params.length > 0) {
        return this.db.prepare(sql).all(params);
      } else {
        return this.db.exec(sql);
      }
    } catch (error) {
      console.error('SQL execution error:', error);
      throw error;
    }
  }
}

// Global test database instance
export const testDb = new TestDatabaseSetup();

// Helper functions for common operations
export const setupTestDb = () => testDb.setupTestDatabase();
export const cleanTestDb = () => testDb.cleanDatabase();
export const closeTestDb = () => testDb.closeDatabase();
export const teardownTestDb = () => testDb.teardownTestDatabase();
export const getTestDb = () => testDb.getDatabase();
export const withTransaction = (callback) => testDb.withTransaction(callback);
export const executeSQL = (sql, params) => testDb.executeSQL(sql, params);

export default TestDatabaseSetup;