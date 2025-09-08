/**
 * Cleanup Automation - Automated test cleanup and maintenance
 * 
 * Features:
 * - Scheduled cleanup operations
 * - Test environment health monitoring
 * - Automated data lifecycle management
 * - Performance optimization
 * - Resource leak detection
 */

const fs = require('fs').promises;
const path = require('path');
const TestDataManager = require('./data-manager');
const cron = require('node-cron');

class CleanupAutomation {
  constructor(options = {}) {
    this.dataManager = new TestDataManager(options);
    this.cleanupInterval = options.cleanupInterval || 3600000; // 1 hour
    this.maxMemoryUsage = options.maxMemoryUsage || 100; // MB
    this.maxFileAge = options.maxFileAge || 86400000; // 24 hours
    this.logFile = options.logFile || path.join(__dirname, 'cleanup.log');
    this.isRunning = false;
    this.cleanupSchedule = null;
  }

  async initialize() {
    await this.dataManager.initialize();
    await this.setupLogging();
    this.scheduleCleanup();
    await this.log('Cleanup automation initialized');
  }

  async setupLogging() {
    try {
      await fs.access(path.dirname(this.logFile));
    } catch {
      await fs.mkdir(path.dirname(this.logFile), { recursive: true });
    }
  }

  async log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level}: ${message}\n`;
    
    try {
      await fs.appendFile(this.logFile, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
    
    if (level === 'ERROR' || process.env.NODE_ENV === 'development') {
      console.log(logEntry.trim());
    }
  }

  scheduleCleanup() {
    // Schedule cleanup every hour
    this.cleanupSchedule = cron.schedule('0 * * * *', async () => {
      if (!this.isRunning) {
        await this.performScheduledCleanup();
      }
    }, {
      scheduled: false
    });

    this.cleanupSchedule.start();
  }

  async performScheduledCleanup() {
    this.isRunning = true;
    await this.log('Starting scheduled cleanup');

    try {
      // Check memory usage
      const memoryUsage = this.dataManager.getMemoryUsage();
      if (memoryUsage.heapUsed > this.maxMemoryUsage) {
        await this.log(`High memory usage detected: ${memoryUsage.heapUsed.toFixed(2)}MB`, 'WARN');
        await this.performMemoryCleanup();
      }

      // Clean old files
      await this.cleanOldFiles();

      // Validate data integrity
      await this.validateAndRepairData();

      // Optimize database
      await this.optimizeDatabase();

      // Clean temporary files
      await this.cleanTemporaryFiles();

      await this.log('Scheduled cleanup completed successfully');
    } catch (error) {
      await this.log(`Scheduled cleanup failed: ${error.message}`, 'ERROR');
    } finally {
      this.isRunning = false;
    }
  }

  async performMemoryCleanup() {
    await this.log('Performing memory cleanup');

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      await this.log('Garbage collection triggered');
    }

    // Clear data manager caches
    await this.dataManager.fullCleanup();
    await this.dataManager.initialize();

    const newMemoryUsage = this.dataManager.getMemoryUsage();
    await this.log(`Memory after cleanup: ${newMemoryUsage.heapUsed.toFixed(2)}MB`);
  }

  async cleanOldFiles() {
    await this.log('Cleaning old files');
    
    const directories = [
      this.dataManager.audioDir,
      this.dataManager.uploadsDir,
      path.join(__dirname, '../temp')
    ];

    let totalCleaned = 0;

    for (const dir of directories) {
      try {
        const files = await fs.readdir(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = await fs.stat(filePath);
          const age = Date.now() - stats.mtime.getTime();

          if (age > this.maxFileAge) {
            await fs.unlink(filePath);
            totalCleaned++;
            await this.log(`Deleted old file: ${filePath}`);
          }
        }
      } catch (error) {
        // Directory might not exist
        await this.log(`Could not clean directory ${dir}: ${error.message}`, 'WARN');
      }
    }

    await this.log(`Cleaned ${totalCleaned} old files`);
  }

  async validateAndRepairData() {
    await this.log('Validating data integrity');

    const issues = await this.dataManager.validateDataIntegrity();
    
    if (issues.length > 0) {
      await this.log(`Found ${issues.length} data integrity issues:`, 'WARN');
      for (const issue of issues) {
        await this.log(`  - ${issue}`, 'WARN');
      }

      // Attempt automatic repair
      await this.repairDataIntegrity();
    } else {
      await this.log('Data integrity validation passed');
    }
  }

  async repairDataIntegrity() {
    await this.log('Attempting data integrity repair');

    try {
      // Remove orphaned flashcards
      const orphanedFlashcards = this.dataManager.db.prepare(`
        DELETE FROM flashcards 
        WHERE user_id NOT IN (SELECT id FROM users)
      `).run();

      if (orphanedFlashcards.changes > 0) {
        await this.log(`Removed ${orphanedFlashcards.changes} orphaned flashcards`);
      }

      // Remove orphaned study sessions
      const orphanedSessions = this.dataManager.db.prepare(`
        DELETE FROM study_sessions 
        WHERE user_id NOT IN (SELECT id FROM users) 
        OR flashcard_id NOT IN (SELECT id FROM flashcards)
      `).run();

      if (orphanedSessions.changes > 0) {
        await this.log(`Removed ${orphanedSessions.changes} orphaned study sessions`);
      }

      await this.log('Data integrity repair completed');
    } catch (error) {
      await this.log(`Data integrity repair failed: ${error.message}`, 'ERROR');
    }
  }

  async optimizeDatabase() {
    await this.log('Optimizing database');

    try {
      // Vacuum database to reclaim space
      this.dataManager.db.exec('VACUUM');
      
      // Analyze tables for query optimization
      this.dataManager.db.exec('ANALYZE');
      
      // Rebuild indexes
      this.dataManager.db.exec('REINDEX');

      await this.log('Database optimization completed');
    } catch (error) {
      await this.log(`Database optimization failed: ${error.message}`, 'ERROR');
    }
  }

  async cleanTemporaryFiles() {
    await this.log('Cleaning temporary files');

    const tempDirectories = [
      '/tmp',
      require('os').tmpdir(),
      path.join(__dirname, '../temp'),
      path.join(__dirname, '../../.tmp')
    ];

    let totalCleaned = 0;

    for (const tempDir of tempDirectories) {
      try {
        const files = await fs.readdir(tempDir);
        
        // Look for test-related temporary files
        const testFiles = files.filter(file => 
          file.includes('test') || 
          file.includes('playwright') || 
          file.includes('jest') ||
          file.startsWith('tmp-')
        );

        for (const file of testFiles) {
          const filePath = path.join(tempDir, file);
          
          try {
            const stats = await fs.stat(filePath);
            const age = Date.now() - stats.mtime.getTime();

            if (age > this.maxFileAge) {
              if (stats.isDirectory()) {
                await fs.rmdir(filePath, { recursive: true });
              } else {
                await fs.unlink(filePath);
              }
              totalCleaned++;
            }
          } catch (error) {
            // File might be in use or already deleted
            continue;
          }
        }
      } catch (error) {
        // Directory might not exist or be inaccessible
        continue;
      }
    }

    if (totalCleaned > 0) {
      await this.log(`Cleaned ${totalCleaned} temporary files`);
    }
  }

  // Manual cleanup methods
  async forceCleanup() {
    await this.log('Forcing complete cleanup');
    
    this.isRunning = true;
    try {
      await this.dataManager.fullCleanup();
      await this.cleanOldFiles();
      await this.cleanTemporaryFiles();
      await this.performMemoryCleanup();
      await this.log('Force cleanup completed');
    } finally {
      this.isRunning = false;
    }
  }

  async cleanupTestRun(testRunId) {
    await this.log(`Cleaning up test run: ${testRunId}`);

    // Clean specific test data
    await this.dataManager.fullCleanup();

    // Clean test-specific files
    const testSpecificDirs = [
      path.join(this.dataManager.audioDir, testRunId),
      path.join(this.dataManager.uploadsDir, testRunId)
    ];

    for (const dir of testSpecificDirs) {
      try {
        await fs.rmdir(dir, { recursive: true });
        await this.log(`Removed test directory: ${dir}`);
      } catch (error) {
        // Directory might not exist
      }
    }
  }

  // Health monitoring
  async getHealthStatus() {
    const memoryUsage = this.dataManager.getMemoryUsage();
    const dataStats = this.dataManager.getDataStats();
    const dbStats = await this.dataManager.getDatabaseStats();

    return {
      timestamp: new Date().toISOString(),
      isRunning: this.isRunning,
      memory: {
        heapUsed: `${memoryUsage.heapUsed.toFixed(2)}MB`,
        heapTotal: `${memoryUsage.heapTotal.toFixed(2)}MB`,
        rss: `${memoryUsage.rss.toFixed(2)}MB`,
        isHighUsage: memoryUsage.heapUsed > this.maxMemoryUsage
      },
      data: {
        createdUsers: dataStats.users,
        createdFlashcards: dataStats.flashcards,
        createdSessions: dataStats.sessions,
        createdFiles: dataStats.files,
        totalUsers: dbStats.totalUsers,
        totalFlashcards: dbStats.totalFlashcards,
        totalSessions: dbStats.totalSessions
      },
      cleanup: {
        lastRun: this.lastCleanupRun || 'Never',
        nextScheduled: this.cleanupSchedule ? this.cleanupSchedule.nextDate() : 'Not scheduled',
        isScheduled: this.cleanupSchedule ? this.cleanupSchedule.running : false
      }
    };
  }

  async generateCleanupReport() {
    const status = await this.getHealthStatus();
    const issues = await this.dataManager.validateDataIntegrity();

    const report = {
      generatedAt: new Date().toISOString(),
      status: status,
      dataIntegrityIssues: issues,
      recommendations: []
    };

    // Add recommendations based on status
    if (status.memory.isHighUsage) {
      report.recommendations.push('High memory usage detected - consider increasing cleanup frequency');
    }

    if (issues.length > 0) {
      report.recommendations.push('Data integrity issues found - run repair operations');
    }

    if (status.data.createdUsers > 100) {
      report.recommendations.push('Large number of test users - consider bulk cleanup');
    }

    return report;
  }

  // Lifecycle management
  async shutdown() {
    await this.log('Shutting down cleanup automation');
    
    if (this.cleanupSchedule) {
      this.cleanupSchedule.stop();
    }

    await this.forceCleanup();
    await this.log('Cleanup automation shutdown completed');
  }
}

module.exports = CleanupAutomation;