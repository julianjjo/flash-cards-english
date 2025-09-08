import { teardownTestDb } from './database-setup.js';

async function globalTeardown() {
  console.log('🧹 Starting E2E test suite global teardown...');
  
  try {
    // Cleanup test database
    await teardownTestDb();
    console.log('✅ Test database cleaned up');
    
    console.log('🎉 E2E test suite teardown complete');
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw here to avoid masking test failures
    console.error(error);
  }
}

export default globalTeardown;