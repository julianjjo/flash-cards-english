import { setupTestDb } from './database-setup.js';

async function globalSetup() {
  console.log('🚀 Starting E2E test suite global setup...');
  
  try {
    // Setup test database
    await setupTestDb();
    console.log('✅ Test database initialized');
    
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_PATH = './flashcards-e2e-test.db';
    process.env.JWT_SECRET = 'test-jwt-secret-for-e2e-only';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-e2e-only';
    
    console.log('✅ Environment variables configured');
    console.log('🎯 E2E test suite ready to run');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

export default globalSetup;