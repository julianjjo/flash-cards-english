import { test, expect } from '@playwright/test';
import { setupTestDb, cleanTestDb, getTestDb, teardownTestDb } from './database-setup.js';
import { createTestDataManager } from '../fixtures/test-data.js';

test.describe('E2E Setup Validation', () => {
  test.beforeAll(async () => {
    await setupTestDb();
  });

  test.afterAll(async () => {
    await teardownTestDb();
  });

  test.beforeEach(async () => {
    await cleanTestDb();
  });

  test('should initialize test database correctly', async () => {
    const db = getTestDb();
    expect(db).toBeTruthy();
    
    // Test table creation
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map(t => t.name);
    
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('flashcards');
    expect(tableNames).toContain('study_sessions');
  });

  test('should create test data fixtures', async () => {
    const db = getTestDb();
    const testDataManager = createTestDataManager(db);
    
    await testDataManager.setupAllTestData();
    
    // Verify users were created
    const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
    expect(users.count).toBeGreaterThan(0);
    
    // Verify flashcards were created
    const flashcards = db.prepare('SELECT COUNT(*) as count FROM flashcards').get();
    expect(flashcards.count).toBeGreaterThan(0);
    
    // Verify study sessions were created
    const sessions = db.prepare('SELECT COUNT(*) as count FROM study_sessions').get();
    expect(sessions.count).toBeGreaterThan(0);
  });

  test('should clean test data properly', async () => {
    const db = getTestDb();
    const testDataManager = createTestDataManager(db);
    
    // Create test data
    await testDataManager.setupAllTestData();
    
    // Clean it
    await testDataManager.cleanAllTestData();
    
    // Verify cleanup
    const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const flashcards = db.prepare('SELECT COUNT(*) as count FROM flashcards').get();
    const sessions = db.prepare('SELECT COUNT(*) as count FROM study_sessions').get();
    
    expect(users.count).toBe(0);
    expect(flashcards.count).toBe(0);
    expect(sessions.count).toBe(0);
  });
});