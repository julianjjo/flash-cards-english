import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Database Configuration and Migration Manager
 * Handles SQLite database initialization, migrations, and connection management
 */
class DatabaseConfig {
  constructor() {
    this.db = null;
    this.dbPath = this.getDatabasePath();
    this.migrationsPath = path.join(__dirname, '..', 'migrations');
  }

  /**
   * Get the appropriate database path based on environment
   */
  getDatabasePath() {
    const serverDir = path.join(__dirname, '..');
    
    // Use different databases for different environments
    switch (process.env.NODE_ENV) {
      case 'test':
        return path.join(serverDir, 'flashcards-test.db');
      case 'production':
        return process.env.DATABASE_PATH || path.join(serverDir, 'flashcards-prod.db');
      default:
        return path.join(serverDir, 'flashcards.db');
    }
  }

  /**
   * Initialize database connection and run migrations
   */
  async initialize() {
    try {
      // Create database connection
      this.db = new Database(this.dbPath);
      
      // Enable foreign key constraints
      this.db.pragma('foreign_keys = ON');
      
      // Set performance optimizations
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 10000');
      this.db.pragma('temp_store = MEMORY');

      console.log(`Database initialized at: ${this.dbPath}`);

      // Run migrations
      await this.runMigrations();

      return this.db;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Create migrations tracking table
   */
  createMigrationsTable() {
    const createMigrationTable = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name TEXT UNIQUE NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    this.db.exec(createMigrationTable);
  }

  /**
   * Get executed migrations
   */
  getExecutedMigrations() {
    try {
      const migrations = this.db.prepare(`
        SELECT migration_name FROM schema_migrations ORDER BY executed_at
      `).all();
      
      return migrations.map(m => m.migration_name);
    } catch (error) {
      // Table doesn't exist yet
      return [];
    }
  }

  /**
   * Mark migration as executed
   */
  markMigrationExecuted(migrationName) {
    const insert = this.db.prepare(`
      INSERT INTO schema_migrations (migration_name) VALUES (?)
    `);
    
    insert.run(migrationName);
  }

  /**
   * Run all pending migrations
   */
  async runMigrations() {
    // Create migrations table first
    this.createMigrationsTable();

    // Get list of executed migrations
    const executedMigrations = this.getExecutedMigrations();

    // Read migration files
    if (!fs.existsSync(this.migrationsPath)) {
      console.log('No migrations directory found, skipping migrations');
      return;
    }

    const migrationFiles = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure migrations run in order

    console.log(`Found ${migrationFiles.length} migration files`);

    // Run pending migrations
    for (const file of migrationFiles) {
      const migrationName = path.basename(file, '.sql');
      
      if (!executedMigrations.includes(migrationName)) {
        console.log(`Running migration: ${migrationName}`);
        
        try {
          const migrationPath = path.join(this.migrationsPath, file);
          const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
          
          // Execute migration in transaction
          this.db.transaction(() => {
            this.db.exec(migrationSQL);
            this.markMigrationExecuted(migrationName);
          })();
          
          console.log(`Migration completed: ${migrationName}`);
        } catch (error) {
          console.error(`Migration failed: ${migrationName}`, error);
          throw error;
        }
      } else {
        console.log(`Migration already executed: ${migrationName}`);
      }
    }

    console.log('All migrations completed');
  }

  /**
   * Create initial tables (fallback for environments without migrations)
   */
  createInitialTables() {
    const createCardsTable = `
      CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        en TEXT NOT NULL,
        es TEXT NOT NULL,
        level INTEGER DEFAULT 0,
        nextReview TEXT,
        audio_url TEXT,
        tips TEXT,
        easeFactor REAL DEFAULT 2.5,
        repetitions INTEGER DEFAULT 0,
        lastInterval INTEGER DEFAULT 0,
        user_id INTEGER
      )
    `;

    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `;

    this.db.exec(createCardsTable);
    this.db.exec(createUsersTable);
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('Database connection closed');
    }
  }

  /**
   * Get database instance
   */
  getDatabase() {
    return this.db;
  }

  /**
   * Check database health
   */
  healthCheck() {
    try {
      const result = this.db.prepare('SELECT 1 as health').get();
      return result.health === 1;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Get database statistics
   */
  getStats() {
    try {
      const stats = {
        size: fs.statSync(this.dbPath).size,
        tables: this.db.prepare(`
          SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
        `).all().map(row => row.name),
        userCount: this.db.prepare('SELECT COUNT(*) as count FROM users').get().count,
        cardCount: this.db.prepare('SELECT COUNT(*) as count FROM cards').get().count
      };

      return stats;
    } catch (error) {
      console.error('Failed to get database stats:', error);
      return null;
    }
  }

  /**
   * Backup database
   */
  backup(backupPath) {
    try {
      if (!backupPath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        backupPath = path.join(path.dirname(this.dbPath), `backup-${timestamp}.db`);
      }

      this.db.backup(backupPath);
      console.log(`Database backed up to: ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error('Database backup failed:', error);
      throw error;
    }
  }
}

// Create singleton instance
const dbConfig = new DatabaseConfig();

export default dbConfig;
export { DatabaseConfig };