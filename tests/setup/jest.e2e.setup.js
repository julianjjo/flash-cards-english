import { cleanTestDb } from './database-setup.js';

// Setup that runs before each test file
beforeAll(async () => {
  // Ensure clean database state for each test file
  await cleanTestDb();
});

// Cleanup after each test file
afterAll(async () => {
  await cleanTestDb();
});

// Global test configuration
jest.setTimeout(30000); // 30 seconds per test