import { setupTestDb } from './database-setup.js';

export default async function jestGlobalSetup() {
  console.log('🚀 Jest E2E Global Setup...');
  
  // Initialize test database
  await setupTestDb();
  
  // Set environment variables for Jest tests
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = './flashcards-e2e-test.db';
  
  console.log('✅ Jest E2E setup complete');
}