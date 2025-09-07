import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseConfig {
  constructor() {
    this.db = null;
    this.isD1 = process.env.NODE_ENV === 'production' && process.env.D1_URL;
    this.dbPath = path.join(__dirname, '..', 'flashcards.db');
  }

  /**
   * Initialize database connection
   * Uses D1 in production (Cloudflare) or SQLite locally
   */
  async initialize() {
    try {
      if (this.isD1) {
        // D1 database for production (Cloudflare)
        console.log('Initializing D1 database connection...');
        this.db = await this.initializeD1();
      } else {
        // Local SQLite database for development
        console.log('Initializing local SQLite database...');
        this.db = this.initializeSQLite();
      }

      // Run migrations
      await this.runMigrations();
      
      console.log(`Database initialized successfully (${this.isD1 ? 'D1' : 'SQLite'})`);
      return this.db;
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize D1 database connection for production
   */
  async initializeD1() {
    // D1 database wrapper for production
    // This is a simplified wrapper - in production, D1 would be injected via Cloudflare Workers
    const d1Config = {
      url: process.env.D1_URL,
      apiKey: process.env.D1_API_KEY
    };

    // For now, we'll use SQLite locally but with D1-compatible SQL
    // In actual deployment, this would use Cloudflare's D1 binding
    console.log('D1 configuration loaded, using SQLite with D1-compatible syntax');
    return this.initializeSQLite();
  }

  /**
   * Initialize SQLite database for local development
   */
  initializeSQLite() {
    try {
      const db = new Database(this.dbPath, { 
        verbose: process.env.NODE_ENV === 'development' ? console.log : null 
      });

      // Configure SQLite for optimal performance
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('cache_size = 1000000');
      db.pragma('foreign_keys = ON');

      return db;
    } catch (error) {
      console.error('SQLite initialization failed:', error);
      throw error;
    }
  }

  /**
   * Run database migrations
   */
  async runMigrations() {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found, skipping migrations');
      return;
    }

    // Create migrations table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        executed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Get list of migration files
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    // Get already executed migrations
    const executedMigrations = this.db.prepare(
      'SELECT filename FROM migrations'
    ).all().map(row => row.filename);

    // Execute pending migrations
    for (const filename of migrationFiles) {
      if (!executedMigrations.includes(filename)) {
        console.log(`Executing migration: ${filename}`);
        await this.executeMigration(filename);
      }
    }
  }

  /**
   * Execute a single migration file
   */
  async executeMigration(filename) {
    const migrationPath = path.join(__dirname, '..', 'migrations', filename);
    let migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    try {
      // Replace placeholders with actual environment values
      if (migrationSQL.includes('ADMIN_EMAIL_PLACEHOLDER')) {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@flashcards.com';
        const adminPassword = process.env.ADMIN_PASS || 'admin123';
        const passwordHash = await bcrypt.hash(adminPassword, 12);

        migrationSQL = migrationSQL
          .replace('ADMIN_EMAIL_PLACEHOLDER', adminEmail)
          .replace('ADMIN_PASSWORD_HASH_PLACEHOLDER', passwordHash);
      }

      // Execute migration with special handling for ALTER TABLE operations
      try {
        this.db.transaction(() => {
          // Execute the full migration SQL, but catch ADD COLUMN errors
          try {
            this.db.exec(migrationSQL);
          } catch (error) {
            // If it's a duplicate column error, try to continue
            if (error.message.includes('duplicate column name')) {
              console.log(`Some columns already exist, attempting partial migration...`);
              // Try to execute individual statements
              const statements = migrationSQL
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'));
              
              for (const statement of statements) {
                if (statement.trim().length > 0) {
                  try {
                    this.db.exec(statement + ';');
                  } catch (stmtError) {
                    if (stmtError.message.includes('duplicate column name') || 
                        stmtError.message.includes('already exists')) {
                      console.log(`Skipping existing object: ${statement.substring(0, 50)}...`);
                      continue;
                    }
                    throw stmtError;
                  }
                }
              }
            } else {
              throw error;
            }
          }
          
          // Record migration as executed
          this.db.prepare(
            'INSERT INTO migrations (filename) VALUES (?)'
          ).run(filename);
        })();
      } catch (transactionError) {
        throw transactionError;
      }

      console.log(`Migration ${filename} executed successfully`);
    } catch (error) {
      console.error(`Migration ${filename} failed:`, error);
      throw error;
    }
  }

  /**
   * Get database instance
   */
  getDatabase() {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db && !this.isD1) {
      this.db.close();
      console.log('Database connection closed');
    }
  }

  /**
   * Check database health
   */
  async healthCheck() {
    try {
      if (this.isD1) {
        // D1 health check - would use D1 specific query
        const result = this.db.prepare('SELECT 1 as health').get();
        return { status: 'connected', type: 'D1', result };
      } else {
        // SQLite health check
        const result = this.db.prepare('SELECT 1 as health').get();
        return { status: 'connected', type: 'SQLite', result };
      }
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      const stats = {
        users: this.db.prepare('SELECT COUNT(*) as count FROM users').get(),
        cards: this.db.prepare('SELECT COUNT(*) as count FROM cards').get(),
        cardsWithUsers: this.db.prepare('SELECT COUNT(*) as count FROM cards WHERE user_id IS NOT NULL').get()
      };
      return stats;
    } catch (error) {
      console.error('Error getting database stats:', error);
      return null;
    }
  }
}

// Singleton instance
const databaseConfig = new DatabaseConfig();

export default databaseConfig;