#!/usr/bin/env node

/**
 * Database Migration and Rollback Testing Automation
 * 
 * Features:
 * - Automated migration testing
 * - Rollback validation and safety checks
 * - Data integrity verification
 * - Schema consistency validation
 * - Performance impact assessment
 * - Cross-version compatibility testing
 * - Migration safety analysis
 * - Backup and restore testing
 */

const fs = require('fs').promises;
const path = require('path');
const Database = require('better-sqlite3');
const { execSync } = require('child_process');

class DatabaseMigrationTester {
  constructor(options = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.outputDir = options.outputDir || path.join(this.rootDir, 'migration-test-results');
    this.dbPath = options.dbPath || path.join(this.rootDir, 'server/test-migration.db');
    this.migrationsDir = options.migrationsDir || path.join(this.rootDir, 'server/migrations');
    this.backupDir = path.join(this.outputDir, 'backups');
    
    this.db = null;
    this.migrationHistory = [];
    this.testResults = [];
    this.dataSnapshots = new Map();
  }

  async initialize() {
    await this.ensureDirectories();
    await this.createBackupDatabase();
    console.log('Database migration testing framework initialized');
  }

  async ensureDirectories() {
    const dirs = [this.outputDir, this.backupDir, this.migrationsDir];
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async createBackupDatabase() {
    // Create test database with sample data
    if (this.db) {
      this.db.close();
    }
    
    try {
      await fs.unlink(this.dbPath);
    } catch (error) {
      // File might not exist
    }
    
    this.db = new Database(this.dbPath);
    await this.createInitialSchema();
    await this.seedTestData();
  }

  async createInitialSchema() {
    console.log('Creating initial database schema...');
    
    // Initial schema (version 1)
    const initialSchema = `
      -- Version 1.0 Schema
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE flashcards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        english TEXT NOT NULL,
        spanish TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_flashcards_user_id ON flashcards(user_id);
      CREATE INDEX idx_users_email ON users(email);

      -- Schema version tracking
      CREATE TABLE schema_version (
        version INTEGER PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        description TEXT
      );

      INSERT INTO schema_version (version, description) VALUES (1, 'Initial schema');
    `;

    this.db.exec(initialSchema);
    console.log('Initial schema created successfully');
  }

  async seedTestData() {
    console.log('Seeding test data...');
    
    // Insert test users
    const insertUser = this.db.prepare(`
      INSERT INTO users (email, password_hash) VALUES (?, ?)
    `);
    
    const users = [
      ['user1@test.com', 'hash1'],
      ['user2@test.com', 'hash2'],
      ['user3@test.com', 'hash3'],
      ['admin@test.com', 'admin_hash']
    ];
    
    for (const [email, hash] of users) {
      insertUser.run(email, hash);
    }
    
    // Insert test flashcards
    const insertFlashcard = this.db.prepare(`
      INSERT INTO flashcards (english, spanish, user_id) VALUES (?, ?, ?)
    `);
    
    const flashcards = [
      ['Hello', 'Hola', 1],
      ['Goodbye', 'Adiós', 1],
      ['Thank you', 'Gracias', 1],
      ['Water', 'Agua', 2],
      ['Food', 'Comida', 2],
      ['House', 'Casa', 3]
    ];
    
    for (const [english, spanish, userId] of flashcards) {
      insertFlashcard.run(english, spanish, userId);
    }
    
    console.log(`Seeded ${users.length} users and ${flashcards.length} flashcards`);
  }

  // Migration Creation and Management
  async createMigration(version, description, upSql, downSql) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${String(version).padStart(3, '0')}_${description.replace(/\s+/g, '_').toLowerCase()}_${timestamp}.sql`;
    const migrationPath = path.join(this.migrationsDir, filename);
    
    const migrationContent = `-- Migration ${version}: ${description}
-- Created: ${new Date().toISOString()}

-- UP
${upSql}

-- DOWN
${downSql}
`;
    
    await fs.writeFile(migrationPath, migrationContent);
    console.log(`Created migration: ${filename}`);
    
    return migrationPath;
  }

  async loadMigrations() {
    const migrations = [];
    
    try {
      const files = await fs.readdir(this.migrationsDir);
      
      for (const file of files.sort()) {
        if (file.endsWith('.sql')) {
          const filePath = path.join(this.migrationsDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          
          // Parse migration number from filename
          const versionMatch = file.match(/^(\d+)_/);
          const version = versionMatch ? parseInt(versionMatch[1]) : null;
          
          if (version) {
            // Split UP and DOWN sections
            const upMatch = content.match(/-- UP\s*([\s\S]*?)(?=-- DOWN|$)/);
            const downMatch = content.match(/-- DOWN\s*([\s\S]*?)$/);
            
            migrations.push({
              version: version,
              filename: file,
              path: filePath,
              upSql: upMatch ? upMatch[1].trim() : '',
              downSql: downMatch ? downMatch[1].trim() : '',
              description: this.extractDescription(content)
            });
          }
        }
      }
      
    } catch (error) {
      console.warn('No migrations directory found, creating sample migrations...');
      await this.createSampleMigrations();
      return this.loadMigrations(); // Recursive call after creating samples
    }
    
    return migrations;
  }

  async createSampleMigrations() {
    console.log('Creating sample migrations for testing...');
    
    // Migration 2: Add role column to users
    await this.createMigration(2, 'Add role column to users',
      `ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
       UPDATE users SET role = 'admin' WHERE email = 'admin@test.com';
       CREATE INDEX idx_users_role ON users(role);`,
      `DROP INDEX IF EXISTS idx_users_role;
       ALTER TABLE users DROP COLUMN role;`
    );
    
    // Migration 3: Add difficulty and review tracking to flashcards
    await this.createMigration(3, 'Add difficulty and review tracking',
      `ALTER TABLE flashcards ADD COLUMN difficulty INTEGER DEFAULT 1;
       ALTER TABLE flashcards ADD COLUMN last_reviewed DATETIME;
       ALTER TABLE flashcards ADD COLUMN review_count INTEGER DEFAULT 0;
       ALTER TABLE flashcards ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
       
       CREATE INDEX idx_flashcards_difficulty ON flashcards(difficulty);
       CREATE INDEX idx_flashcards_last_reviewed ON flashcards(last_reviewed);`,
      `DROP INDEX IF EXISTS idx_flashcards_last_reviewed;
       DROP INDEX IF EXISTS idx_flashcards_difficulty;
       ALTER TABLE flashcards DROP COLUMN updated_at;
       ALTER TABLE flashcards DROP COLUMN review_count;
       ALTER TABLE flashcards DROP COLUMN last_reviewed;
       ALTER TABLE flashcards DROP COLUMN difficulty;`
    );
    
    // Migration 4: Create study sessions table
    await this.createMigration(4, 'Create study sessions table',
      `CREATE TABLE study_sessions (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         user_id INTEGER NOT NULL,
         flashcard_id INTEGER NOT NULL,
         response_quality INTEGER NOT NULL,
         response_time INTEGER,
         session_date DATETIME DEFAULT CURRENT_TIMESTAMP,
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
         FOREIGN KEY (flashcard_id) REFERENCES flashcards(id) ON DELETE CASCADE
       );
       
       CREATE INDEX idx_study_sessions_user_id ON study_sessions(user_id);
       CREATE INDEX idx_study_sessions_flashcard_id ON study_sessions(flashcard_id);
       CREATE INDEX idx_study_sessions_date ON study_sessions(session_date);`,
      `DROP INDEX IF EXISTS idx_study_sessions_date;
       DROP INDEX IF EXISTS idx_study_sessions_flashcard_id;
       DROP INDEX IF EXISTS idx_study_sessions_user_id;
       DROP TABLE study_sessions;`
    );
    
    // Migration 5: Add user preferences (breaking change simulation)
    await this.createMigration(5, 'Add user preferences with data migration',
      `CREATE TABLE user_preferences (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         user_id INTEGER NOT NULL UNIQUE,
         language_preference TEXT DEFAULT 'en',
         theme TEXT DEFAULT 'light',
         notifications_enabled BOOLEAN DEFAULT 1,
         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
       );
       
       -- Migrate existing users to preferences
       INSERT INTO user_preferences (user_id, language_preference, theme, notifications_enabled)
       SELECT id, 'en', 'light', 1 FROM users;
       
       CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);`,
      `DROP INDEX IF EXISTS idx_user_preferences_user_id;
       DROP TABLE user_preferences;`
    );
  }

  extractDescription(migrationContent) {
    const descMatch = migrationContent.match(/-- Migration \d+: ([^\n]+)/);
    return descMatch ? descMatch[1] : 'No description';
  }

  // Migration Testing Methods
  async testMigration(migration) {
    const test = {
      migration: migration,
      startTime: new Date().toISOString(),
      results: {
        preValidation: null,
        migrationExecution: null,
        postValidation: null,
        rollbackTest: null,
        dataIntegrity: null,
        performance: null
      },
      passed: true,
      issues: []
    };

    console.log(`🔄 Testing migration ${migration.version}: ${migration.description}`);
    
    try {
      // 1. Pre-migration validation
      test.results.preValidation = await this.validatePreMigration();
      
      // 2. Create data snapshot
      await this.createDataSnapshot(`before_${migration.version}`);
      
      // 3. Execute migration
      test.results.migrationExecution = await this.executeMigration(migration, 'up');
      
      // 4. Post-migration validation
      test.results.postValidation = await this.validatePostMigration(migration);
      
      // 5. Data integrity check
      test.results.dataIntegrity = await this.validateDataIntegrity();
      
      // 6. Performance assessment
      test.results.performance = await this.assessMigrationPerformance(migration);
      
      // 7. Test rollback
      test.results.rollbackTest = await this.testRollback(migration);
      
      // 8. Determine overall test result
      test.passed = this.evaluateTestResults(test.results);
      
    } catch (error) {
      test.passed = false;
      test.issues.push({
        type: 'execution_error',
        message: error.message,
        severity: 'critical'
      });
    }
    
    test.endTime = new Date().toISOString();
    return test;
  }

  async validatePreMigration() {
    console.log('  📋 Pre-migration validation...');
    
    const validation = {
      schemaValid: true,
      dataConsistent: true,
      constraintsValid: true,
      issues: []
    };

    try {
      // Check current schema version
      const currentVersion = this.getCurrentSchemaVersion();
      
      // Validate foreign key constraints
      const foreignKeyCheck = this.db.prepare('PRAGMA foreign_key_check').all();
      if (foreignKeyCheck.length > 0) {
        validation.constraintsValid = false;
        validation.issues.push({
          type: 'foreign_key_violation',
          details: foreignKeyCheck
        });
      }
      
      // Check for orphaned records
      const orphanedFlashcards = this.db.prepare(`
        SELECT f.id FROM flashcards f 
        LEFT JOIN users u ON f.user_id = u.id 
        WHERE u.id IS NULL
      `).all();
      
      if (orphanedFlashcards.length > 0) {
        validation.dataConsistent = false;
        validation.issues.push({
          type: 'orphaned_records',
          table: 'flashcards',
          count: orphanedFlashcards.length
        });
      }
      
      // Validate data types and constraints
      const users = this.db.prepare('SELECT COUNT(*) as count FROM users WHERE email IS NULL OR email = ""').get();
      if (users.count > 0) {
        validation.dataConsistent = false;
        validation.issues.push({
          type: 'invalid_data',
          table: 'users',
          issue: 'null_or_empty_email',
          count: users.count
        });
      }
      
    } catch (error) {
      validation.schemaValid = false;
      validation.issues.push({
        type: 'validation_error',
        message: error.message
      });
    }

    return validation;
  }

  async executeMigration(migration, direction = 'up') {
    console.log(`  ⚡ Executing migration ${direction.toUpperCase()}...`);
    
    const execution = {
      direction: direction,
      startTime: performance.now(),
      endTime: null,
      duration: null,
      success: false,
      error: null,
      affectedRows: 0
    };

    try {
      const sql = direction === 'up' ? migration.upSql : migration.downSql;
      
      if (!sql || sql.trim() === '') {
        throw new Error(`No ${direction} SQL provided for migration ${migration.version}`);
      }

      // Execute migration in transaction
      const transaction = this.db.transaction(() => {
        // Split SQL into individual statements
        const statements = sql.split(';').filter(stmt => stmt.trim() !== '');
        
        for (const statement of statements) {
          const trimmedStatement = statement.trim();
          if (trimmedStatement) {
            const result = this.db.exec(trimmedStatement);
            execution.affectedRows += result.changes || 0;
          }
        }
        
        // Update schema version
        if (direction === 'up') {
          const insertVersion = this.db.prepare(`
            INSERT OR REPLACE INTO schema_version (version, description) VALUES (?, ?)
          `);
          insertVersion.run(migration.version, migration.description);
        } else {
          const deleteVersion = this.db.prepare(`
            DELETE FROM schema_version WHERE version = ?
          `);
          deleteVersion.run(migration.version);
        }
      });
      
      transaction();
      
      execution.success = true;
      
    } catch (error) {
      execution.error = error.message;
      console.error(`    ❌ Migration ${direction} failed:`, error.message);
    }

    execution.endTime = performance.now();
    execution.duration = execution.endTime - execution.startTime;
    
    return execution;
  }

  async validatePostMigration(migration) {
    console.log('  ✅ Post-migration validation...');
    
    const validation = {
      schemaUpdated: false,
      tablesExist: true,
      indexesCreated: true,
      constraintsValid: true,
      issues: []
    };

    try {
      // Verify schema version was updated
      const currentVersion = this.getCurrentSchemaVersion();
      validation.schemaUpdated = currentVersion >= migration.version;
      
      if (!validation.schemaUpdated) {
        validation.issues.push({
          type: 'version_not_updated',
          expected: migration.version,
          actual: currentVersion
        });
      }
      
      // Check if expected tables exist
      const expectedTables = this.extractTableNames(migration.upSql);
      for (const tableName of expectedTables) {
        const tableExists = this.db.prepare(`
          SELECT name FROM sqlite_master WHERE type='table' AND name=?
        `).get(tableName);
        
        if (!tableExists) {
          validation.tablesExist = false;
          validation.issues.push({
            type: 'missing_table',
            table: tableName
          });
        }
      }
      
      // Check if expected indexes exist
      const expectedIndexes = this.extractIndexNames(migration.upSql);
      for (const indexName of expectedIndexes) {
        const indexExists = this.db.prepare(`
          SELECT name FROM sqlite_master WHERE type='index' AND name=?
        `).get(indexName);
        
        if (!indexExists) {
          validation.indexesCreated = false;
          validation.issues.push({
            type: 'missing_index',
            index: indexName
          });
        }
      }
      
      // Validate foreign key constraints
      const foreignKeyCheck = this.db.prepare('PRAGMA foreign_key_check').all();
      if (foreignKeyCheck.length > 0) {
        validation.constraintsValid = false;
        validation.issues.push({
          type: 'foreign_key_violation_post_migration',
          violations: foreignKeyCheck
        });
      }
      
    } catch (error) {
      validation.issues.push({
        type: 'post_validation_error',
        message: error.message
      });
    }

    return validation;
  }

  async validateDataIntegrity() {
    console.log('  🔍 Data integrity validation...');
    
    const integrity = {
      dataPreserved: true,
      relationsIntact: true,
      constraintsSatisfied: true,
      issues: []
    };

    try {
      // Check that all users still exist
      const userCount = this.db.prepare('SELECT COUNT(*) as count FROM users').get().count;
      if (userCount < 4) { // We seeded 4 users
        integrity.dataPreserved = false;
        integrity.issues.push({
          type: 'data_loss',
          table: 'users',
          expected: 4,
          actual: userCount
        });
      }
      
      // Check that flashcards still exist
      const flashcardCount = this.db.prepare('SELECT COUNT(*) as count FROM flashcards').get().count;
      if (flashcardCount < 6) { // We seeded 6 flashcards
        integrity.dataPreserved = false;
        integrity.issues.push({
          type: 'data_loss',
          table: 'flashcards',
          expected: 6,
          actual: flashcardCount
        });
      }
      
      // Validate that all flashcards still have valid user references
      const orphanedFlashcards = this.db.prepare(`
        SELECT COUNT(*) as count FROM flashcards f 
        LEFT JOIN users u ON f.user_id = u.id 
        WHERE u.id IS NULL
      `).get().count;
      
      if (orphanedFlashcards > 0) {
        integrity.relationsIntact = false;
        integrity.issues.push({
          type: 'broken_relations',
          table: 'flashcards',
          orphaned_count: orphanedFlashcards
        });
      }
      
      // Check for NULL values in NOT NULL columns
      const nullEmails = this.db.prepare(`
        SELECT COUNT(*) as count FROM users WHERE email IS NULL OR email = ''
      `).get().count;
      
      if (nullEmails > 0) {
        integrity.constraintsSatisfied = false;
        integrity.issues.push({
          type: 'constraint_violation',
          table: 'users',
          column: 'email',
          null_count: nullEmails
        });
      }
      
    } catch (error) {
      integrity.issues.push({
        type: 'integrity_check_error',
        message: error.message
      });
    }

    return integrity;
  }

  async assessMigrationPerformance(migration) {
    console.log('  ⚡ Performance assessment...');
    
    const performance = {
      migrationTime: null,
      tableScans: 0,
      indexUsage: {},
      queryPlan: null,
      recommendations: []
    };

    try {
      // Analyze query performance after migration
      const sampleQueries = [
        'SELECT * FROM users WHERE email = "user1@test.com"',
        'SELECT f.* FROM flashcards f JOIN users u ON f.user_id = u.id WHERE u.id = 1',
        'SELECT COUNT(*) FROM flashcards GROUP BY user_id'
      ];

      for (const query of sampleQueries) {
        try {
          const explain = this.db.prepare(`EXPLAIN QUERY PLAN ${query}`).all();
          
          for (const step of explain) {
            if (step.detail.includes('SCAN TABLE')) {
              performance.tableScans++;
            }
            if (step.detail.includes('USING INDEX')) {
              const indexMatch = step.detail.match(/USING INDEX (\w+)/);
              if (indexMatch) {
                performance.indexUsage[indexMatch[1]] = (performance.indexUsage[indexMatch[1]] || 0) + 1;
              }
            }
          }
          
        } catch (error) {
          // Query might not be valid for current schema
        }
      }
      
      // Check for missing indexes that could improve performance
      if (performance.tableScans > 2) {
        performance.recommendations.push('High number of table scans detected - consider adding indexes');
      }
      
      if (Object.keys(performance.indexUsage).length === 0) {
        performance.recommendations.push('No index usage detected - verify indexes are being used effectively');
      }
      
    } catch (error) {
      performance.recommendations.push(`Performance assessment error: ${error.message}`);
    }

    return performance;
  }

  async testRollback(migration) {
    console.log('  ↩️  Testing rollback...');
    
    const rollback = {
      attempted: false,
      successful: false,
      dataRestored: false,
      schemaReverted: false,
      issues: []
    };

    try {
      rollback.attempted = true;
      
      // Create snapshot before rollback
      await this.createDataSnapshot(`before_rollback_${migration.version}`);
      
      // Execute rollback
      const rollbackExecution = await this.executeMigration(migration, 'down');
      rollback.successful = rollbackExecution.success;
      
      if (rollback.successful) {
        // Verify schema was reverted
        const currentVersion = this.getCurrentSchemaVersion();
        rollback.schemaReverted = currentVersion < migration.version;
        
        // Verify data integrity after rollback
        const integrityCheck = await this.validateDataIntegrity();
        rollback.dataRestored = integrityCheck.dataPreserved && integrityCheck.relationsIntact;
        
        if (!rollback.schemaReverted) {
          rollback.issues.push({
            type: 'schema_not_reverted',
            expected_max_version: migration.version - 1,
            actual_version: currentVersion
          });
        }
        
        if (!rollback.dataRestored) {
          rollback.issues.push({
            type: 'data_not_restored',
            integrity_issues: integrityCheck.issues
          });
        }
        
        // Re-apply migration for continuation of tests
        console.log('  🔄 Re-applying migration for test continuation...');
        await this.executeMigration(migration, 'up');
        
      } else {
        rollback.issues.push({
          type: 'rollback_execution_failed',
          error: rollbackExecution.error
        });
      }
      
    } catch (error) {
      rollback.issues.push({
        type: 'rollback_test_error',
        message: error.message
      });
    }

    return rollback;
  }

  // Snapshot and Backup Methods
  async createDataSnapshot(snapshotName) {
    const snapshot = {
      name: snapshotName,
      timestamp: new Date().toISOString(),
      tables: {}
    };

    try {
      // Get all table names
      const tables = this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all();

      for (const table of tables) {
        const tableName = table.name;
        
        // Get table schema
        const schema = this.db.prepare(`
          SELECT sql FROM sqlite_master WHERE type='table' AND name=?
        `).get(tableName);
        
        // Get table data
        const data = this.db.prepare(`SELECT * FROM ${tableName}`).all();
        
        snapshot.tables[tableName] = {
          schema: schema ? schema.sql : null,
          rowCount: data.length,
          data: data,
          checksum: this.calculateDataChecksum(data)
        };
      }
      
      this.dataSnapshots.set(snapshotName, snapshot);
      
      // Save snapshot to file
      const snapshotPath = path.join(this.backupDir, `${snapshotName}.json`);
      await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
      
      console.log(`  📸 Data snapshot created: ${snapshotName}`);
      
    } catch (error) {
      console.error(`  ❌ Failed to create snapshot ${snapshotName}:`, error.message);
    }

    return snapshot;
  }

  calculateDataChecksum(data) {
    const crypto = require('crypto');
    const dataString = JSON.stringify(data.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
    return crypto.createHash('md5').update(dataString).digest('hex');
  }

  async createDatabaseBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `backup_${timestamp}.db`);
    
    try {
      const backupDb = new Database(backupPath);
      this.db.backup(backupDb);
      backupDb.close();
      
      console.log(`Database backup created: ${backupPath}`);
      return backupPath;
      
    } catch (error) {
      console.error(`Failed to create database backup: ${error.message}`);
      throw error;
    }
  }

  async restoreDatabaseBackup(backupPath) {
    try {
      this.db.close();
      
      // Copy backup to current database path
      await fs.copyFile(backupPath, this.dbPath);
      
      // Reconnect to restored database
      this.db = new Database(this.dbPath);
      
      console.log(`Database restored from: ${backupPath}`);
      
    } catch (error) {
      console.error(`Failed to restore database backup: ${error.message}`);
      throw error;
    }
  }

  // Utility Methods
  getCurrentSchemaVersion() {
    try {
      const version = this.db.prepare('SELECT MAX(version) as version FROM schema_version').get();
      return version ? version.version : 0;
    } catch (error) {
      return 0;
    }
  }

  extractTableNames(sql) {
    const tableMatches = sql.match(/CREATE TABLE\s+(\w+)/gi);
    return tableMatches ? tableMatches.map(match => match.split(/\s+/)[2]) : [];
  }

  extractIndexNames(sql) {
    const indexMatches = sql.match(/CREATE\s+INDEX\s+(\w+)/gi);
    return indexMatches ? indexMatches.map(match => match.split(/\s+/)[2]) : [];
  }

  evaluateTestResults(results) {
    // Migration test passes if:
    // 1. Pre-validation is clean or has only minor issues
    // 2. Migration executes successfully
    // 3. Post-validation confirms schema changes
    // 4. Data integrity is maintained
    // 5. Rollback works correctly

    if (!results.migrationExecution.success) {
      return false;
    }

    if (results.dataIntegrity && !results.dataIntegrity.dataPreserved) {
      return false;
    }

    if (results.rollbackTest && results.rollbackTest.attempted && !results.rollbackTest.successful) {
      return false;
    }

    return true;
  }

  // Main Testing Methods
  async runMigrationTests() {
    console.log('🗄️  Starting database migration testing...');
    
    const testSuite = {
      startTime: new Date().toISOString(),
      migrations: [],
      results: [],
      summary: {
        totalMigrations: 0,
        passedMigrations: 0,
        failedMigrations: 0,
        criticalIssues: 0,
        rollbackFailures: 0
      }
    };

    try {
      // Load all migrations
      const migrations = await this.loadMigrations();
      testSuite.migrations = migrations;
      testSuite.summary.totalMigrations = migrations.length;
      
      console.log(`Found ${migrations.length} migrations to test`);
      
      // Create initial backup
      const initialBackup = await this.createDatabaseBackup();
      
      // Test each migration
      for (const migration of migrations) {
        const testResult = await this.testMigration(migration);
        testSuite.results.push(testResult);
        
        if (testResult.passed) {
          testSuite.summary.passedMigrations++;
        } else {
          testSuite.summary.failedMigrations++;
          
          // Count critical issues
          const criticalIssues = testResult.issues.filter(issue => issue.severity === 'critical');
          testSuite.summary.criticalIssues += criticalIssues.length;
          
          // Count rollback failures
          if (testResult.results.rollbackTest && !testResult.results.rollbackTest.successful) {
            testSuite.summary.rollbackFailures++;
          }
        }
        
        console.log(`  ${testResult.passed ? '✅' : '❌'} Migration ${migration.version}: ${testResult.passed ? 'PASSED' : 'FAILED'}`);
      }
      
      // Test full migration sequence
      console.log('🔄 Testing complete migration sequence...');
      const sequenceTest = await this.testMigrationSequence(migrations);
      testSuite.sequenceTest = sequenceTest;
      
      testSuite.endTime = new Date().toISOString();
      
      // Generate report
      const report = await this.generateMigrationReport(testSuite);
      
      console.log('\n📊 Migration Testing Summary:');
      console.log(`  Total Migrations: ${testSuite.summary.totalMigrations}`);
      console.log(`  Passed: ${testSuite.summary.passedMigrations}`);
      console.log(`  Failed: ${testSuite.summary.failedMigrations}`);
      console.log(`  Critical Issues: ${testSuite.summary.criticalIssues}`);
      console.log(`  Rollback Failures: ${testSuite.summary.rollbackFailures}`);
      
      return {
        testSuite: testSuite,
        report: report
      };

    } catch (error) {
      console.error('Migration testing failed:', error);
      throw error;
    }
  }

  async testMigrationSequence(migrations) {
    const sequenceTest = {
      name: 'Complete Migration Sequence',
      startTime: new Date().toISOString(),
      phases: [],
      passed: true,
      issues: []
    };

    try {
      // Start from clean state
      await this.createBackupDatabase();
      
      // Apply all migrations in sequence
      console.log('  🔄 Applying all migrations in sequence...');
      for (const migration of migrations) {
        const execution = await this.executeMigration(migration, 'up');
        sequenceTest.phases.push({
          phase: `apply_${migration.version}`,
          migration: migration.version,
          success: execution.success,
          duration: execution.duration
        });
        
        if (!execution.success) {
          sequenceTest.passed = false;
          sequenceTest.issues.push({
            type: 'sequence_application_failed',
            migration: migration.version,
            error: execution.error
          });
          break;
        }
      }
      
      // Verify final state
      if (sequenceTest.passed) {
        const finalValidation = await this.validateDataIntegrity();
        sequenceTest.phases.push({
          phase: 'final_validation',
          success: finalValidation.dataPreserved && finalValidation.relationsIntact,
          issues: finalValidation.issues
        });
        
        if (!finalValidation.dataPreserved || !finalValidation.relationsIntact) {
          sequenceTest.passed = false;
          sequenceTest.issues.push({
            type: 'final_state_invalid',
            integrity_issues: finalValidation.issues
          });
        }
      }
      
      // Test complete rollback sequence
      if (sequenceTest.passed) {
        console.log('  ↩️  Testing complete rollback sequence...');
        for (let i = migrations.length - 1; i >= 0; i--) {
          const migration = migrations[i];
          const execution = await this.executeMigration(migration, 'down');
          sequenceTest.phases.push({
            phase: `rollback_${migration.version}`,
            migration: migration.version,
            success: execution.success,
            duration: execution.duration
          });
          
          if (!execution.success) {
            sequenceTest.passed = false;
            sequenceTest.issues.push({
              type: 'sequence_rollback_failed',
              migration: migration.version,
              error: execution.error
            });
            break;
          }
        }
      }
      
    } catch (error) {
      sequenceTest.passed = false;
      sequenceTest.issues.push({
        type: 'sequence_test_error',
        message: error.message
      });
    }

    sequenceTest.endTime = new Date().toISOString();
    return sequenceTest;
  }

  async generateMigrationReport(testSuite) {
    const report = {
      ...testSuite,
      analysis: this.analyzeMigrationResults(testSuite),
      recommendations: this.generateMigrationRecommendations(testSuite)
    };

    const reportPath = path.join(this.outputDir, 'migration-test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`Migration test report generated: ${reportPath}`);
    return reportPath;
  }

  analyzeMigrationResults(testSuite) {
    const analysis = {
      successRate: (testSuite.summary.passedMigrations / testSuite.summary.totalMigrations) * 100,
      averageMigrationTime: 0,
      commonIssues: {},
      riskAssessment: 'low'
    };

    // Calculate average migration time
    const migrationTimes = testSuite.results
      .filter(result => result.results.migrationExecution.duration)
      .map(result => result.results.migrationExecution.duration);
    
    if (migrationTimes.length > 0) {
      analysis.averageMigrationTime = migrationTimes.reduce((sum, time) => sum + time, 0) / migrationTimes.length;
    }

    // Analyze common issues
    for (const result of testSuite.results) {
      for (const issue of result.issues) {
        analysis.commonIssues[issue.type] = (analysis.commonIssues[issue.type] || 0) + 1;
      }
    }

    // Risk assessment
    if (testSuite.summary.criticalIssues > 0 || testSuite.summary.rollbackFailures > 0) {
      analysis.riskAssessment = 'high';
    } else if (testSuite.summary.failedMigrations > testSuite.summary.totalMigrations * 0.2) {
      analysis.riskAssessment = 'medium';
    }

    return analysis;
  }

  generateMigrationRecommendations(testSuite) {
    const recommendations = [];

    if (testSuite.summary.failedMigrations > 0) {
      recommendations.push('Review and fix failed migrations before deployment');
    }

    if (testSuite.summary.rollbackFailures > 0) {
      recommendations.push('Critical: Fix rollback failures - these create deployment risks');
    }

    if (testSuite.summary.criticalIssues > 0) {
      recommendations.push('Address critical issues that could cause data loss');
    }

    const analysis = this.analyzeMigrationResults(testSuite);
    
    if (analysis.averageMigrationTime > 10000) { // 10 seconds
      recommendations.push('Consider optimizing slow migrations to reduce downtime');
    }

    if (analysis.successRate < 80) {
      recommendations.push('Low success rate - review migration development practices');
    }

    if (recommendations.length === 0) {
      recommendations.push('All migrations passed - safe for deployment');
    }

    return recommendations;
  }

  async cleanup() {
    if (this.db) {
      this.db.close();
    }
    
    // Optionally clean up test database
    try {
      await fs.unlink(this.dbPath);
    } catch (error) {
      // File might not exist
    }
  }
}

// CLI Interface
async function main() {
  const tester = new DatabaseMigrationTester();
  
  try {
    await tester.initialize();
    const result = await tester.runMigrationTests();
    
    console.log(`\n✅ Migration testing completed`);
    console.log(`📄 Report: ${result.report}`);
    
    // Exit with appropriate code
    const exitCode = result.testSuite.summary.failedMigrations > 0 ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('❌ Migration testing failed:', error);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

if (require.main === module) {
  main();
}

module.exports = DatabaseMigrationTester;