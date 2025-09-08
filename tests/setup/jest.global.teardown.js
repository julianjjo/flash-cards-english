import { teardownTestDb } from './database-setup.js';

export default async function jestGlobalTeardown() {
  console.log('🧹 Jest E2E Global Teardown...');
  
  // Cleanup test database
  await teardownTestDb();
  
  console.log('✅ Jest E2E teardown complete');
}