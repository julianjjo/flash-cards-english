import bcrypt from 'bcrypt';

export const TEST_USERS = {
  regularUser: {
    id: 1001,
    email: 'testuser@example.com',
    password: 'password123',
    password_hash: '', // Will be generated in setupTestUsers
    role: 'user',
  },
  adminUser: {
    id: 1002,
    email: 'admin@example.com', 
    password: 'adminpass',
    password_hash: '', // Will be generated in setupTestUsers
    role: 'admin',
  },
  secondUser: {
    id: 1003,
    email: 'testuser2@example.com',
    password: 'password123',
    password_hash: '', // Will be generated in setupTestUsers
    role: 'user',
  },
};

export const TEST_FLASHCARDS = {
  basicSet: [
    {
      id: 2001,
      english: 'Hello',
      spanish: 'Hola',
      user_id: 1001,
      difficulty: 1,
      review_count: 0,
    },
    {
      id: 2002,
      english: 'Goodbye',
      spanish: 'Adiós',
      user_id: 1001,
      difficulty: 1,
      review_count: 0,
    },
    {
      id: 2003,
      english: 'Thank you',
      spanish: 'Gracias',
      user_id: 1001,
      difficulty: 2,
      review_count: 3,
      last_reviewed: new Date().toISOString(),
    },
    {
      id: 2004,
      english: 'Please',
      spanish: 'Por favor',
      user_id: 1001,
      difficulty: 1,
      review_count: 1,
    },
    {
      id: 2005,
      english: 'Yes',
      spanish: 'Sí',
      user_id: 1001,
      difficulty: 3,
      review_count: 10,
      last_reviewed: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    },
  ],
  algorithmTestSet: [
    {
      id: 2010,
      english: 'Water',
      spanish: 'Agua',
      user_id: 1001,
      difficulty: 1,
      review_count: 0,
    },
    {
      id: 2011,
      english: 'Fire',
      spanish: 'Fuego',
      user_id: 1001,
      difficulty: 2,
      review_count: 2,
    },
    {
      id: 2012,
      english: 'Earth',
      spanish: 'Tierra',
      user_id: 1001,
      difficulty: 3,
      review_count: 5,
    },
    {
      id: 2013,
      english: 'Air',
      spanish: 'Aire',
      user_id: 1001,
      difficulty: 4,
      review_count: 8,
    },
    {
      id: 2014,
      english: 'Mountain',
      spanish: 'Montaña',
      user_id: 1001,
      difficulty: 5,
      review_count: 15,
      last_reviewed: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    },
  ],
  isolationTestSet: [
    {
      id: 2020,
      english: 'Dog',
      spanish: 'Perro',
      user_id: 1003, // Second user
      difficulty: 1,
      review_count: 0,
    },
    {
      id: 2021,
      english: 'Cat',
      spanish: 'Gato',
      user_id: 1003, // Second user
      difficulty: 2,
      review_count: 1,
    },
  ],
};

export const TEST_STUDY_SESSIONS = [
  {
    id: 3001,
    user_id: 1001,
    flashcard_id: 2003,
    response_quality: 4,
    response_time: 3500, // 3.5 seconds
    created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  },
  {
    id: 3002,
    user_id: 1001,
    flashcard_id: 2005,
    response_quality: 5,
    response_time: 2100, // 2.1 seconds
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
  },
  {
    id: 3003,
    user_id: 1001,
    flashcard_id: 2004,
    response_quality: 3,
    response_time: 5200, // 5.2 seconds
    created_at: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
  },
];

// Authentication tokens for testing
export const TEST_TOKENS = {
  validUserToken: null, // Will be generated during setup
  validAdminToken: null, // Will be generated during setup
  expiredToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid',
  invalidToken: 'invalid.token.here',
};

// Test data utility functions
export class TestDataManager {
  constructor(database) {
    this.db = database;
  }

  async setupTestUsers() {
    const insertUser = this.db.prepare(`
      INSERT OR REPLACE INTO users (id, email, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    for (const user of Object.values(TEST_USERS)) {
      // Generate password hash if not already done
      if (!user.password_hash) {
        user.password_hash = await bcrypt.hash(user.password, 10);
      }
      
      insertUser.run(user.id, user.email, user.password_hash, user.role);
    }

    console.log('✅ Test users created');
  }

  async setupTestFlashcards() {
    const insertFlashcard = this.db.prepare(`
      INSERT OR REPLACE INTO flashcards 
      (id, english, spanish, user_id, difficulty, review_count, last_reviewed, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const allFlashcards = [
      ...TEST_FLASHCARDS.basicSet,
      ...TEST_FLASHCARDS.algorithmTestSet,
      ...TEST_FLASHCARDS.isolationTestSet,
    ];

    for (const flashcard of allFlashcards) {
      insertFlashcard.run(
        flashcard.id,
        flashcard.english,
        flashcard.spanish,
        flashcard.user_id,
        flashcard.difficulty,
        flashcard.review_count,
        flashcard.last_reviewed || null
      );
    }

    console.log('✅ Test flashcards created');
  }

  async setupTestSessions() {
    const insertSession = this.db.prepare(`
      INSERT OR REPLACE INTO study_sessions 
      (id, user_id, flashcard_id, response_quality, response_time, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const session of TEST_STUDY_SESSIONS) {
      insertSession.run(
        session.id,
        session.user_id,
        session.flashcard_id,
        session.response_quality,
        session.response_time,
        session.created_at
      );
    }

    console.log('✅ Test study sessions created');
  }

  async setupAllTestData() {
    try {
      await this.setupTestUsers();
      await this.setupTestFlashcards();
      await this.setupTestSessions();
      console.log('🎯 All test data setup complete');
    } catch (error) {
      console.error('❌ Test data setup failed:', error);
      throw error;
    }
  }

  async cleanAllTestData() {
    try {
      this.db.exec('DELETE FROM study_sessions WHERE id >= 3000');
      this.db.exec('DELETE FROM flashcards WHERE id >= 2000');
      this.db.exec('DELETE FROM users WHERE id >= 1000');
      console.log('🧹 Test data cleaned');
    } catch (error) {
      console.error('❌ Test data cleanup failed:', error);
      throw error;
    }
  }

  // Helper methods for specific test scenarios
  getUserByEmail(email) {
    return Object.values(TEST_USERS).find(user => user.email === email);
  }

  getFlashcardsByUserId(userId) {
    const allFlashcards = [
      ...TEST_FLASHCARDS.basicSet,
      ...TEST_FLASHCARDS.algorithmTestSet,
      ...TEST_FLASHCARDS.isolationTestSet,
    ];
    return allFlashcards.filter(card => card.user_id === userId);
  }

  getSessionsByUserId(userId) {
    return TEST_STUDY_SESSIONS.filter(session => session.user_id === userId);
  }
}

// Factory function for creating test data manager
export const createTestDataManager = (database) => {
  return new TestDataManager(database);
};

// Common test scenarios
export const TEST_SCENARIOS = {
  newUserRegistration: {
    email: 'newuser@example.com',
    password: 'newpassword123',
  },
  loginFlow: {
    validCredentials: {
      email: TEST_USERS.regularUser.email,
      password: TEST_USERS.regularUser.password,
    },
    invalidCredentials: {
      email: 'invalid@example.com',
      password: 'wrongpassword',
    },
  },
  flashcardCreation: {
    newFlashcard: {
      english: 'Computer',
      spanish: 'Computadora',
    },
    duplicateFlashcard: {
      english: 'Hello',
      spanish: 'Hola',
    },
  },
  spacedRepetition: {
    easyResponse: { quality: 5 },
    normalResponse: { quality: 3 },
    hardResponse: { quality: 1 },
  },
};

export default {
  TEST_USERS,
  TEST_FLASHCARDS,
  TEST_STUDY_SESSIONS,
  TEST_TOKENS,
  TEST_SCENARIOS,
  TestDataManager,
  createTestDataManager,
};