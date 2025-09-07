#!/usr/bin/env node

/**
 * Database Migration Runner
 * Executes database migrations for user management system
 */

import databaseConfig from '../config/database.js';

async function runMigrations() {
  console.log('Starting database migration...');
  
  try {
    // Initialize database and run migrations
    await databaseConfig.initialize();
    
    // Verify migration results
    const stats = await databaseConfig.getStats();
    if (stats) {
      console.log('Migration completed successfully!');
      console.log('Database stats:');
      console.log(`- Users: ${stats.users.count}`);
      console.log(`- Total flashcards: ${stats.flashcards.count}`);
      console.log(`- Flashcards with user assignment: ${stats.flashcardsWithUsers.count}`);
    }

    // Health check
    const health = await databaseConfig.healthCheck();
    console.log(`Database health: ${health.status} (${health.type})`);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    databaseConfig.close();
  }
}

// Run migrations if script is called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}

export { runMigrations };