/**
 * Test Data Manager - Comprehensive data lifecycle management for E2E tests
 * 
 * Features:
 * - Automated test data creation and cleanup
 * - Database state management
 * - File system cleanup (audio files, uploads)
 * - Memory cleanup and performance monitoring
 * - Test isolation guarantee
 * - Data seeding for specific test scenarios
 */

const fs = require('fs').promises;
const path = require('path');
const Database = require('better-sqlite3');
const { TEST_USERS, TEST_FLASHCARDS, TEST_STUDY_SESSIONS } = require('../fixtures/test-data');
const bcrypt = require('bcrypt');

class TestDataManager {
  constructor(options = {}) {
    this.dbPath = options.dbPath || path.join(__dirname, '../../server/test-flashcards.db');
    this.audioDir = options.audioDir || path.join(__dirname, '../../server/audio');
    this.uploadsDir = options.uploadsDir || path.join(__dirname, '../../server/uploads');
    this.db = null;
    this.createdUsers = new Set();
    this.createdFlashcards = new Set();
    this.createdSessions = new Set();
    this.createdFiles = new Set();
    this.startMemory = process.memoryUsage();
    this.transactionStack = [];
  }

  async initialize() {
    this.db = new Database(this.dbPath);
    await this.setupTables();
    await this.createDirectories();
    this.recordMemoryBaseline();
  }

  async setupTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS flashcards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        english TEXT NOT NULL,
        spanish TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        difficulty INTEGER DEFAULT 1,
        last_reviewed DATETIME,
        review_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        flashcard_id INTEGER NOT NULL,
        response_quality INTEGER NOT NULL,
        response_time INTEGER,
        session_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (flashcard_id) REFERENCES flashcards(id) ON DELETE CASCADE
      )`
    ];

    for (const table of tables) {
      this.db.exec(table);
    }

    // Create indexes for performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_flashcards_user_id ON flashcards(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_study_sessions_flashcard_id ON study_sessions(flashcard_id)',
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)'
    ];

    for (const index of indexes) {
      this.db.exec(index);
    }
  }

  async createDirectories() {
    const dirs = [this.audioDir, this.uploadsDir];
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
    }
  }

  recordMemoryBaseline() {
    this.startMemory = process.memoryUsage();
  }

  // Transaction Management
  beginTransaction() {
    const transaction = this.db.transaction(() => {});
    this.transactionStack.push(transaction);
    return transaction;
  }

  rollbackTransaction() {
    if (this.transactionStack.length > 0) {
      const transaction = this.transactionStack.pop();
      transaction.rollback();
    }
  }

  commitTransaction() {
    if (this.transactionStack.length > 0) {
      const transaction = this.transactionStack.pop();
      transaction.commit();
    }
  }

  // Data Creation Methods
  async createTestUser(userData = null) {
    const user = userData || TEST_USERS[0];
    const hashedPassword = await bcrypt.hash(user.password, 10);
    
    const stmt = this.db.prepare(`
      INSERT INTO users (email, password_hash, role)
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(user.email, hashedPassword, user.role);
    this.createdUsers.add(result.lastInsertRowid);
    
    return {
      id: result.lastInsertRowid,
      ...user,
      password_hash: hashedPassword
    };
  }

  async createTestFlashcard(flashcardData = null, userId = null) {
    const flashcard = flashcardData || TEST_FLASHCARDS[0];
    const targetUserId = userId || Array.from(this.createdUsers)[0];
    
    const stmt = this.db.prepare(`
      INSERT INTO flashcards (english, spanish, user_id, difficulty, review_count)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      flashcard.english,
      flashcard.spanish,
      targetUserId,
      flashcard.difficulty || 1,
      flashcard.review_count || 0
    );
    
    this.createdFlashcards.add(result.lastInsertRowid);
    
    return {
      id: result.lastInsertRowid,
      ...flashcard,
      user_id: targetUserId
    };
  }

  async createTestStudySession(sessionData = null, userId = null, flashcardId = null) {
    const session = sessionData || TEST_STUDY_SESSIONS[0];
    const targetUserId = userId || Array.from(this.createdUsers)[0];
    const targetFlashcardId = flashcardId || Array.from(this.createdFlashcards)[0];
    
    const stmt = this.db.prepare(`
      INSERT INTO study_sessions (user_id, flashcard_id, response_quality, response_time)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      targetUserId,
      targetFlashcardId,
      session.response_quality,
      session.response_time || 2500
    );
    
    this.createdSessions.add(result.lastInsertRowid);
    
    return {
      id: result.lastInsertRowid,
      ...session,
      user_id: targetUserId,
      flashcard_id: targetFlashcardId
    };
  }

  // File Management
  async createTestAudioFile(filename, content = null) {
    const filePath = path.join(this.audioDir, filename);
    const audioContent = content || Buffer.from('fake-audio-content');
    
    await fs.writeFile(filePath, audioContent);
    this.createdFiles.add(filePath);
    
    return filePath;
  }

  async createTestUpload(filename, content = null) {
    const filePath = path.join(this.uploadsDir, filename);
    const uploadContent = content || Buffer.from('fake-upload-content');
    
    await fs.writeFile(filePath, uploadContent);
    this.createdFiles.add(filePath);
    
    return filePath;
  }

  // Data Seeding for Scenarios
  async seedCompleteUserScenario(userEmail = 'test@example.com') {
    const user = await this.createTestUser({
      email: userEmail,
      password: 'TestPassword123!',
      role: 'user'
    });

    // Create multiple flashcards for this user
    const flashcards = [];
    for (let i = 0; i < 5; i++) {
      const flashcard = await this.createTestFlashcard(
        TEST_FLASHCARDS[i % TEST_FLASHCARDS.length],
        user.id
      );
      flashcards.push(flashcard);
    }

    // Create study sessions
    const sessions = [];
    for (const flashcard of flashcards.slice(0, 3)) {
      const session = await this.createTestStudySession(null, user.id, flashcard.id);
      sessions.push(session);
    }

    // Create audio files
    const audioFile = await this.createTestAudioFile(`audio_${user.id}_hello.wav`);

    return {
      user,
      flashcards,
      sessions,
      audioFile
    };
  }

  async seedAdminScenario() {
    const admin = await this.createTestUser({
      email: 'admin@example.com',
      password: 'AdminPassword123!',
      role: 'admin'
    });

    // Create multiple regular users for admin to manage
    const users = [];
    for (let i = 0; i < 3; i++) {
      const user = await this.createTestUser({
        email: `user${i}@example.com`,
        password: 'UserPassword123!',
        role: 'user'
      });
      users.push(user);

      // Create flashcards for each user
      for (let j = 0; j < 2; j++) {
        await this.createTestFlashcard(
          TEST_FLASHCARDS[j % TEST_FLASHCARDS.length],
          user.id
        );
      }
    }

    return {
      admin,
      users
    };
  }

  async seedPerformanceTestData(userCount = 100, flashcardsPerUser = 50) {
    const users = [];
    
    for (let i = 0; i < userCount; i++) {
      const user = await this.createTestUser({
        email: `perfuser${i}@example.com`,
        password: 'PerfPassword123!',
        role: 'user'
      });
      users.push(user);

      // Create flashcards for performance testing
      for (let j = 0; j < flashcardsPerUser; j++) {
        await this.createTestFlashcard({
          english: `English word ${i}-${j}`,
          spanish: `Palabra española ${i}-${j}`,
          difficulty: Math.floor(Math.random() * 5) + 1,
          review_count: Math.floor(Math.random() * 10)
        }, user.id);
      }
    }

    return users;
  }

  // Cleanup Methods
  async cleanupDatabase() {
    // Clean in reverse dependency order
    if (this.createdSessions.size > 0) {
      const sessionIds = Array.from(this.createdSessions).join(',');
      this.db.exec(`DELETE FROM study_sessions WHERE id IN (${sessionIds})`);
      this.createdSessions.clear();
    }

    if (this.createdFlashcards.size > 0) {
      const flashcardIds = Array.from(this.createdFlashcards).join(',');
      this.db.exec(`DELETE FROM flashcards WHERE id IN (${flashcardIds})`);
      this.createdFlashcards.clear();
    }

    if (this.createdUsers.size > 0) {
      const userIds = Array.from(this.createdUsers).join(',');
      this.db.exec(`DELETE FROM users WHERE id IN (${userIds})`);
      this.createdUsers.clear();
    }

    // Reset auto-increment counters
    this.db.exec(`DELETE FROM sqlite_sequence WHERE name IN ('users', 'flashcards', 'study_sessions')`);
  }

  async cleanupFiles() {
    for (const filePath of this.createdFiles) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // File might not exist or already deleted
        console.warn(`Failed to delete file ${filePath}:`, error.message);
      }
    }
    this.createdFiles.clear();
  }

  async cleanupDirectories() {
    try {
      const audioFiles = await fs.readdir(this.audioDir);
      if (audioFiles.length === 0) {
        await fs.rmdir(this.audioDir);
      }
    } catch (error) {
      // Directory might not be empty or not exist
    }

    try {
      const uploadFiles = await fs.readdir(this.uploadsDir);
      if (uploadFiles.length === 0) {
        await fs.rmdir(this.uploadsDir);
      }
    } catch (error) {
      // Directory might not be empty or not exist
    }
  }

  async fullCleanup() {
    // Rollback any pending transactions
    while (this.transactionStack.length > 0) {
      this.rollbackTransaction();
    }

    await this.cleanupDatabase();
    await this.cleanupFiles();
    await this.cleanupDirectories();
    
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // Monitoring and Diagnostics
  getMemoryUsage() {
    const current = process.memoryUsage();
    return {
      rss: (current.rss - this.startMemory.rss) / 1024 / 1024,
      heapUsed: (current.heapUsed - this.startMemory.heapUsed) / 1024 / 1024,
      heapTotal: (current.heapTotal - this.startMemory.heapTotal) / 1024 / 1024,
      external: (current.external - this.startMemory.external) / 1024 / 1024
    };
  }

  getDataStats() {
    return {
      users: this.createdUsers.size,
      flashcards: this.createdFlashcards.size,
      sessions: this.createdSessions.size,
      files: this.createdFiles.size,
      transactions: this.transactionStack.length
    };
  }

  async getDatabaseStats() {
    const userCount = this.db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const flashcardCount = this.db.prepare('SELECT COUNT(*) as count FROM flashcards').get().count;
    const sessionCount = this.db.prepare('SELECT COUNT(*) as count FROM study_sessions').get().count;
    
    return {
      totalUsers: userCount,
      totalFlashcards: flashcardCount,
      totalSessions: sessionCount
    };
  }

  // Validation Methods
  async validateDataIntegrity() {
    const issues = [];

    // Check for orphaned flashcards
    const orphanedFlashcards = this.db.prepare(`
      SELECT f.id FROM flashcards f 
      LEFT JOIN users u ON f.user_id = u.id 
      WHERE u.id IS NULL
    `).all();

    if (orphanedFlashcards.length > 0) {
      issues.push(`Found ${orphanedFlashcards.length} orphaned flashcards`);
    }

    // Check for orphaned study sessions
    const orphanedSessions = this.db.prepare(`
      SELECT s.id FROM study_sessions s 
      LEFT JOIN users u ON s.user_id = u.id 
      LEFT JOIN flashcards f ON s.flashcard_id = f.id
      WHERE u.id IS NULL OR f.id IS NULL
    `).all();

    if (orphanedSessions.length > 0) {
      issues.push(`Found ${orphanedSessions.length} orphaned study sessions`);
    }

    return issues;
  }
}

module.exports = TestDataManager;