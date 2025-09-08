#!/usr/bin/env node

/**
 * Data Cleanup Script - Command-line tool for test data management
 * 
 * Usage:
 *   node data-cleanup.js [command] [options]
 * 
 * Commands:
 *   clean-all       - Clean all test data
 *   clean-files     - Clean only test files
 *   clean-db       - Clean only database
 *   health-check   - Check environment health
 *   force-cleanup  - Force complete cleanup
 *   validate       - Validate data integrity
 *   repair         - Repair data integrity issues
 *   optimize       - Optimize database performance
 *   report         - Generate cleanup report
 */

const path = require('path');
const TestDataManager = require('../setup/data-manager');
const CleanupAutomation = require('../setup/cleanup-automation');
const TestLifecycleManager = require('../setup/test-lifecycle');

class DataCleanupCLI {
  constructor() {
    this.dataManager = null;
    this.cleanupAutomation = null;
    this.lifecycleManager = null;
  }

  async initialize() {
    this.dataManager = new TestDataManager();
    this.cleanupAutomation = new CleanupAutomation();
    this.lifecycleManager = new TestLifecycleManager();

    await this.dataManager.initialize();
    await this.cleanupAutomation.initialize();
  }

  async executeCommand(command, options = {}) {
    console.log(`Executing: ${command}`);
    console.log('Options:', options);
    console.log('---');

    const startTime = Date.now();

    try {
      switch (command) {
        case 'clean-all':
          await this.cleanAll(options);
          break;

        case 'clean-files':
          await this.cleanFiles(options);
          break;

        case 'clean-db':
          await this.cleanDatabase(options);
          break;

        case 'health-check':
          await this.healthCheck(options);
          break;

        case 'force-cleanup':
          await this.forceCleanup(options);
          break;

        case 'validate':
          await this.validateData(options);
          break;

        case 'repair':
          await this.repairData(options);
          break;

        case 'optimize':
          await this.optimizeDatabase(options);
          break;

        case 'report':
          await this.generateReport(options);
          break;

        case 'schedule':
          await this.scheduleCleanup(options);
          break;

        case 'seed':
          await this.seedTestData(options);
          break;

        default:
          this.showHelp();
          return;
      }

      const duration = Date.now() - startTime;
      console.log('---');
      console.log(`Command completed successfully in ${duration}ms`);

    } catch (error) {
      console.error('---');
      console.error(`Command failed: ${error.message}`);
      console.error('Stack trace:', error.stack);
      process.exit(1);
    }
  }

  async cleanAll(options) {
    console.log('Performing complete cleanup...');

    // Database cleanup
    console.log('Cleaning database...');
    await this.dataManager.cleanupDatabase();
    
    // File cleanup
    console.log('Cleaning files...');
    await this.dataManager.cleanupFiles();
    
    // Directory cleanup
    console.log('Cleaning directories...');
    await this.dataManager.cleanupDirectories();

    // Cleanup automation
    if (!options.skipScheduled) {
      console.log('Running scheduled cleanup...');
      await this.cleanupAutomation.performScheduledCleanup();
    }

    console.log('Complete cleanup finished');
  }

  async cleanFiles(options) {
    console.log('Cleaning test files...');

    await this.dataManager.cleanupFiles();
    await this.dataManager.cleanupDirectories();

    if (options.includeTmp) {
      console.log('Cleaning temporary files...');
      await this.cleanupAutomation.cleanTemporaryFiles();
    }

    console.log('File cleanup finished');
  }

  async cleanDatabase(options) {
    console.log('Cleaning test database...');

    if (options.vacuum) {
      console.log('Vacuuming database...');
      this.dataManager.db.exec('VACUUM');
    }

    await this.dataManager.cleanupDatabase();

    if (options.resetCounters) {
      console.log('Resetting auto-increment counters...');
      this.dataManager.db.exec(`DELETE FROM sqlite_sequence WHERE name IN ('users', 'flashcards', 'study_sessions')`);
    }

    console.log('Database cleanup finished');
  }

  async healthCheck(options) {
    console.log('Performing health check...');

    // Environment validation
    const envHealth = await this.lifecycleManager.validateTestEnvironment();
    console.log('\nEnvironment Health:');
    console.log(`Status: ${envHealth.isHealthy ? 'HEALTHY' : 'ISSUES FOUND'}`);
    
    if (!envHealth.isHealthy) {
      console.log('Issues:');
      envHealth.issues.forEach(issue => console.log(`  - ${issue}`));
    }

    // Memory usage
    const memoryUsage = this.dataManager.getMemoryUsage();
    console.log('\nMemory Usage:');
    console.log(`  Heap Used: ${memoryUsage.heapUsed.toFixed(2)} MB`);
    console.log(`  Heap Total: ${memoryUsage.heapTotal.toFixed(2)} MB`);
    console.log(`  RSS: ${memoryUsage.rss.toFixed(2)} MB`);

    // Data statistics
    const dataStats = this.dataManager.getDataStats();
    console.log('\nData Statistics:');
    console.log(`  Created Users: ${dataStats.users}`);
    console.log(`  Created Flashcards: ${dataStats.flashcards}`);
    console.log(`  Created Sessions: ${dataStats.sessions}`);
    console.log(`  Created Files: ${dataStats.files}`);

    // Database statistics
    const dbStats = await this.dataManager.getDatabaseStats();
    console.log('\nDatabase Statistics:');
    console.log(`  Total Users: ${dbStats.totalUsers}`);
    console.log(`  Total Flashcards: ${dbStats.totalFlashcards}`);
    console.log(`  Total Sessions: ${dbStats.totalSessions}`);

    // Cleanup automation status
    if (options.includeAutomation) {
      const automationStatus = await this.cleanupAutomation.getHealthStatus();
      console.log('\nCleanup Automation:');
      console.log(`  Is Running: ${automationStatus.isRunning}`);
      console.log(`  Memory Usage: ${automationStatus.memory.heapUsed}`);
      console.log(`  Next Scheduled: ${automationStatus.cleanup.nextScheduled}`);
    }
  }

  async forceCleanup(options) {
    console.log('Performing force cleanup...');

    await this.cleanupAutomation.forceCleanup();

    if (options.includeOptimization) {
      console.log('Optimizing database...');
      await this.optimizeDatabase();
    }

    console.log('Force cleanup finished');
  }

  async validateData(options) {
    console.log('Validating data integrity...');

    const issues = await this.dataManager.validateDataIntegrity();

    if (issues.length === 0) {
      console.log('✅ Data integrity validation PASSED');
    } else {
      console.log('❌ Data integrity validation FAILED');
      console.log(`Found ${issues.length} issues:`);
      issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });

      if (options.autoRepair) {
        console.log('\nAttempting automatic repair...');
        await this.repairData({ silent: true });
      }
    }
  }

  async repairData(options) {
    console.log('Repairing data integrity issues...');

    const issuesBefore = await this.dataManager.validateDataIntegrity();
    
    if (issuesBefore.length === 0) {
      console.log('No data integrity issues found');
      return;
    }

    // Perform repairs through cleanup automation
    await this.cleanupAutomation.repairDataIntegrity();

    // Validate after repair
    const issuesAfter = await this.dataManager.validateDataIntegrity();
    
    const repairedCount = issuesBefore.length - issuesAfter.length;
    
    if (!options.silent) {
      console.log(`Repair completed:`);
      console.log(`  Issues before: ${issuesBefore.length}`);
      console.log(`  Issues after: ${issuesAfter.length}`);
      console.log(`  Issues repaired: ${repairedCount}`);

      if (issuesAfter.length > 0) {
        console.log('Remaining issues:');
        issuesAfter.forEach(issue => console.log(`  - ${issue}`));
      }
    }
  }

  async optimizeDatabase(options) {
    console.log('Optimizing database performance...');

    const startTime = Date.now();

    // Vacuum
    console.log('Running VACUUM...');
    this.dataManager.db.exec('VACUUM');

    // Analyze
    console.log('Running ANALYZE...');
    this.dataManager.db.exec('ANALYZE');

    // Reindex
    console.log('Rebuilding indexes...');
    this.dataManager.db.exec('REINDEX');

    const duration = Date.now() - startTime;
    console.log(`Database optimization completed in ${duration}ms`);

    if (options.showStats) {
      const stats = await this.dataManager.getDatabaseStats();
      console.log('Post-optimization statistics:');
      console.log(`  Total Users: ${stats.totalUsers}`);
      console.log(`  Total Flashcards: ${stats.totalFlashcards}`);
      console.log(`  Total Sessions: ${stats.totalSessions}`);
    }
  }

  async generateReport(options) {
    console.log('Generating cleanup report...');

    const report = await this.cleanupAutomation.generateCleanupReport();

    if (options.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('\n=== CLEANUP REPORT ===');
      console.log(`Generated: ${report.generatedAt}`);
      
      console.log('\nStatus:');
      console.log(`  Memory Usage: ${report.status.memory.heapUsed} (High: ${report.status.memory.isHighUsage})`);
      console.log(`  Active Tests: ${report.status.data.createdUsers} users, ${report.status.data.createdFlashcards} flashcards`);
      console.log(`  Database: ${report.status.data.totalUsers} total users, ${report.status.data.totalFlashcards} total flashcards`);
      
      if (report.dataIntegrityIssues.length > 0) {
        console.log('\nData Integrity Issues:');
        report.dataIntegrityIssues.forEach(issue => console.log(`  - ${issue}`));
      }
      
      if (report.recommendations.length > 0) {
        console.log('\nRecommendations:');
        report.recommendations.forEach(rec => console.log(`  - ${rec}`));
      }
    }

    if (options.save) {
      const fs = require('fs').promises;
      const filename = options.save === true ? 
        `cleanup-report-${Date.now()}.json` : 
        options.save;
      
      await fs.writeFile(filename, JSON.stringify(report, null, 2));
      console.log(`\nReport saved to: ${filename}`);
    }
  }

  async scheduleCleanup(options) {
    console.log('Managing scheduled cleanup...');

    if (options.start) {
      this.cleanupAutomation.scheduleCleanup();
      console.log('Cleanup scheduling started');
    }

    if (options.stop) {
      if (this.cleanupAutomation.cleanupSchedule) {
        this.cleanupAutomation.cleanupSchedule.stop();
        console.log('Cleanup scheduling stopped');
      }
    }

    if (options.status) {
      const status = await this.cleanupAutomation.getHealthStatus();
      console.log(`Scheduled cleanup status: ${status.cleanup.isScheduled ? 'RUNNING' : 'STOPPED'}`);
      console.log(`Next scheduled run: ${status.cleanup.nextScheduled}`);
    }
  }

  async seedTestData(options) {
    console.log('Seeding test data...');

    if (options.users) {
      const count = parseInt(options.users) || 5;
      console.log(`Creating ${count} test users...`);
      
      for (let i = 0; i < count; i++) {
        await this.dataManager.createTestUser({
          email: `testuser${i}@example.com`,
          password: 'TestPassword123!',
          role: 'user'
        });
      }
    }

    if (options.admin) {
      console.log('Creating admin scenario...');
      await this.dataManager.seedAdminScenario();
    }

    if (options.performance) {
      const userCount = parseInt(options.performanceUsers) || 100;
      const flashcardsPerUser = parseInt(options.performanceFlashcards) || 50;
      
      console.log(`Creating performance test data: ${userCount} users, ${flashcardsPerUser} flashcards each...`);
      await this.dataManager.seedPerformanceTestData(userCount, flashcardsPerUser);
    }

    console.log('Test data seeding completed');
  }

  showHelp() {
    console.log(`
Data Cleanup CLI - Test data management tool

USAGE:
  node data-cleanup.js <command> [options]

COMMANDS:
  clean-all           Clean all test data (database + files)
  clean-files         Clean only test files and directories
  clean-db           Clean only test database
  health-check       Check test environment health
  force-cleanup      Force complete cleanup (all data + optimization)
  validate           Validate data integrity
  repair             Repair data integrity issues
  optimize           Optimize database performance
  report             Generate detailed cleanup report
  schedule           Manage scheduled cleanup
  seed               Seed test data

EXAMPLES:
  node data-cleanup.js clean-all
  node data-cleanup.js health-check --includeAutomation
  node data-cleanup.js clean-db --vacuum --resetCounters
  node data-cleanup.js validate --autoRepair
  node data-cleanup.js report --format=json --save=report.json
  node data-cleanup.js seed --users=10 --admin --performance
  node data-cleanup.js schedule --start

OPTIONS:
  --help              Show this help message
  --verbose           Show detailed output
  --skipScheduled     Skip scheduled cleanup operations
  --includeTmp        Include temporary file cleanup
  --vacuum            Vacuum database during cleanup
  --resetCounters     Reset auto-increment counters
  --includeAutomation Include automation status in health check
  --autoRepair        Automatically repair issues found during validation
  --silent            Suppress non-essential output
  --showStats         Show statistics after operations
  --format=json       Output in JSON format
  --save[=filename]   Save report to file
  --users=N           Number of test users to create
  --admin             Create admin scenario
  --performance       Create performance test data
  --performanceUsers=N      Users for performance testing (default: 100)
  --performanceFlashcards=N Flashcards per user (default: 50)
`);
  }

  async shutdown() {
    if (this.cleanupAutomation) {
      await this.cleanupAutomation.shutdown();
    }
    
    if (this.dataManager) {
      await this.dataManager.fullCleanup();
    }

    if (this.lifecycleManager) {
      await this.lifecycleManager.shutdown();
    }
  }
}

// CLI Entry Point
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    const cli = new DataCleanupCLI();
    cli.showHelp();
    return;
  }

  const command = args[0];
  const options = {};

  // Parse options
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      
      if (value) {
        options[key] = value;
      } else {
        options[key] = true;
      }
    }
  }

  const cli = new DataCleanupCLI();
  
  try {
    await cli.initialize();
    await cli.executeCommand(command, options);
  } finally {
    await cli.shutdown();
  }
}

// Run CLI if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = DataCleanupCLI;