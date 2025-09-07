#!/usr/bin/env node

/**
 * Integration Test Runner
 * 
 * Runs comprehensive integration tests for all API endpoints
 * and validates the complete system functionality.
 * 
 * Usage:
 *   npm run test:integration
 *   node scripts/run-integration-tests.js
 * 
 * Features:
 * - Sequential test execution to avoid database conflicts
 * - Detailed reporting with timing information
 * - Test categorization and filtering
 * - Environment setup and cleanup
 * - Coverage reporting
 * - CI/CD integration support
 */

import { exec, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testCategories = [
  {
    name: 'Authentication API',
    pattern: 'tests/integration/api-auth-endpoints.test.js',
    description: 'Tests user authentication, JWT tokens, login/logout, registration'
  },
  {
    name: 'User & Flashcard API',
    pattern: 'tests/integration/api-user-flashcard-endpoints.test.js',
    description: 'Tests user management, flashcard CRUD, study system, user isolation'
  },
  {
    name: 'Admin & Statistics API',
    pattern: 'tests/integration/api-admin-stats-endpoints.test.js',
    description: 'Tests admin operations, statistics, bulk operations, role-based access'
  },
  {
    name: 'Error Handling & Edge Cases',
    pattern: 'tests/integration/api-error-handling.test.js',
    description: 'Tests error conditions, input validation, security, rate limiting'
  },
  {
    name: 'Existing Integration Tests',
    pattern: 'tests/integration/*.test.js',
    description: 'Runs all existing integration tests',
    exclude: [
      'api-auth-endpoints.test.js',
      'api-user-flashcard-endpoints.test.js', 
      'api-admin-stats-endpoints.test.js',
      'api-error-handling.test.js'
    ]
  }
];

class IntegrationTestRunner {
  constructor() {
    this.results = [];
    this.totalStartTime = Date.now();
    this.verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
    this.category = process.argv.find(arg => arg.startsWith('--category='))?.split('=')[1];
    this.bail = process.argv.includes('--bail');
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : level === 'warn' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async checkEnvironment() {
    this.log('Checking test environment...');

    // Check if Jest is available
    try {
      await this.runCommand('npx jest --version', { stdio: 'pipe' });
    } catch (error) {
      this.log('Jest is not available. Please install Jest dependencies.', 'error');
      return false;
    }

    // Check if test files exist
    const testDir = path.join(__dirname, '..', 'tests', 'integration');
    try {
      await fs.access(testDir);
    } catch (error) {
      this.log(`Test directory not found: ${testDir}`, 'error');
      return false;
    }

    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.JEST_WORKER_ID = '1'; // Run in single worker to avoid DB conflicts

    this.log('Environment check passed ✓');
    return true;
  }

  async runCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const child = exec(command, {
        cwd: path.join(__dirname, '..'),
        ...options
      });

      let stdout = '';
      let stderr = '';

      if (child.stdout) child.stdout.on('data', data => stdout += data);
      if (child.stderr) child.stderr.on('data', data => stderr += data);

      child.on('close', code => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject({ stdout, stderr, code, command });
        }
      });

      child.on('error', reject);
    });
  }

  async runTestCategory(category) {
    const startTime = Date.now();
    this.log(`\\n🧪 Running ${category.name}...`);
    this.log(`📝 ${category.description}`);

    try {
      let testPattern = category.pattern;
      
      // Handle exclusions for broad patterns
      if (category.exclude && category.pattern.includes('*')) {
        const testDir = path.join(__dirname, '..', 'tests', 'integration');
        const files = await fs.readdir(testDir);
        const testFiles = files
          .filter(file => file.endsWith('.test.js'))
          .filter(file => !category.exclude.includes(file));
        
        if (testFiles.length === 0) {
          this.log(`No additional test files found for ${category.name}`, 'warn');
          return { success: true, duration: 0, tests: 0, skipped: true };
        }
        
        testPattern = testFiles.map(file => `tests/integration/${file}`).join(' ');
      }

      const jestCommand = [
        'node --experimental-vm-modules ../node_modules/.bin/jest',
        testPattern,
        '--verbose',
        '--runInBand', // Run tests sequentially
        '--forceExit',
        '--detectOpenHandles',
        '--no-cache',
        this.verbose ? '--verbose' : '',
        '--json',
        '--outputFile=test-results.json'
      ].filter(Boolean).join(' ');

      const result = await this.runCommand(jestCommand);
      
      // Parse Jest results
      let testResults;
      try {
        const resultsJson = await fs.readFile(path.join(__dirname, '..', 'test-results.json'), 'utf8');
        testResults = JSON.parse(resultsJson);
      } catch (error) {
        this.log('Could not parse test results JSON', 'warn');
        testResults = { numPassedTests: 0, numFailedTests: 0, numTotalTests: 0 };
      }

      const duration = Date.now() - startTime;
      const passed = testResults.numPassedTests || 0;
      const failed = testResults.numFailedTests || 0;
      const total = testResults.numTotalTests || 0;

      if (failed === 0) {
        this.log(`✅ ${category.name} completed: ${passed}/${total} tests passed (${duration}ms)`, 'success');
      } else {
        this.log(`❌ ${category.name} failed: ${passed}/${total} tests passed, ${failed} failed (${duration}ms)`, 'error');
      }

      return {
        success: failed === 0,
        duration,
        tests: total,
        passed,
        failed,
        category: category.name,
        output: result.stdout
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.log(`💥 ${category.name} crashed: ${error.command || error.message}`, 'error');
      
      if (this.verbose && error.stderr) {
        console.log('STDERR:', error.stderr);
      }

      return {
        success: false,
        duration,
        tests: 0,
        passed: 0,
        failed: 1,
        category: category.name,
        error: error.message,
        crashed: true
      };
    }
  }

  async runAllTests() {
    this.log('🚀 Starting comprehensive API integration tests...');
    this.log(`Running in ${process.env.NODE_ENV || 'development'} environment`);

    // Check environment
    const envOk = await this.checkEnvironment();
    if (!envOk) {
      process.exit(1);
    }

    // Filter categories if specified
    let categoriesToRun = testCategories;
    if (this.category) {
      categoriesToRun = testCategories.filter(cat => 
        cat.name.toLowerCase().includes(this.category.toLowerCase())
      );
      if (categoriesToRun.length === 0) {
        this.log(`No test categories found matching "${this.category}"`, 'error');
        this.log('Available categories:', 'info');
        testCategories.forEach(cat => this.log(`  - ${cat.name}`, 'info'));
        process.exit(1);
      }
    }

    // Run each test category
    for (const category of categoriesToRun) {
      const result = await this.runTestCategory(category);
      this.results.push(result);

      if (!result.success && this.bail) {
        this.log('Stopping due to --bail flag', 'warn');
        break;
      }

      // Small delay between test categories
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await this.generateReport();
  }

  async generateReport() {
    const totalDuration = Date.now() - this.totalStartTime;
    const totalTests = this.results.reduce((sum, r) => sum + r.tests, 0);
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
    const successfulCategories = this.results.filter(r => r.success).length;
    const failedCategories = this.results.filter(r => !r.success).length;

    this.log('\\n📊 INTEGRATION TEST REPORT');
    this.log('=' * 50);
    this.log(`Total Duration: ${totalDuration}ms (${(totalDuration/1000).toFixed(2)}s)`);
    this.log(`Categories: ${successfulCategories}/${this.results.length} successful`);
    this.log(`Tests: ${totalPassed}/${totalTests} passed (${totalFailed} failed)`);
    this.log('');

    // Category breakdown
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const duration = `${result.duration}ms`;
      const tests = result.skipped ? 'skipped' : `${result.passed}/${result.tests}`;
      
      this.log(`${status} ${result.category.padEnd(25)} ${tests.padEnd(10)} ${duration}`);
      
      if (result.error && this.verbose) {
        this.log(`    Error: ${result.error}`, 'error');
      }
    });

    this.log('');

    // Overall result
    const overallSuccess = failedCategories === 0;
    if (overallSuccess) {
      this.log('🎉 ALL INTEGRATION TESTS PASSED!', 'success');
    } else {
      this.log(`💥 ${failedCategories} test categories failed`, 'error');
    }

    // Generate JSON report for CI/CD
    const jsonReport = {
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      success: overallSuccess,
      summary: {
        categories: this.results.length,
        categoriesSuccessful: successfulCategories,
        categoriesFailed: failedCategories,
        totalTests: totalTests,
        totalPassed: totalPassed,
        totalFailed: totalFailed
      },
      results: this.results
    };

    try {
      await fs.writeFile('integration-test-report.json', JSON.stringify(jsonReport, null, 2));
      this.log('📄 Detailed report saved to integration-test-report.json');
    } catch (error) {
      this.log('Could not save JSON report', 'warn');
    }

    // Clean up temporary files
    try {
      await fs.unlink(path.join(__dirname, '..', 'test-results.json'));
    } catch (error) {
      // Ignore cleanup errors
    }

    process.exit(overallSuccess ? 0 : 1);
  }
}

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new IntegrationTestRunner();
  
  // Handle process signals
  process.on('SIGINT', () => {
    console.log('\\n🛑 Test execution interrupted');
    process.exit(1);
  });

  process.on('SIGTERM', () => {
    console.log('\\n🛑 Test execution terminated');
    process.exit(1);
  });

  // Show help
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
🧪 Integration Test Runner

Usage:
  node scripts/run-integration-tests.js [options]
  npm run test:integration

Options:
  --verbose, -v          Show detailed output
  --category=<name>      Run specific test category
  --bail                Stop on first failure
  --help, -h            Show this help

Available Categories:
${testCategories.map(cat => `  • ${cat.name}: ${cat.description}`).join('\\n')}

Examples:
  node scripts/run-integration-tests.js --verbose
  node scripts/run-integration-tests.js --category=auth
  node scripts/run-integration-tests.js --bail
`);
    process.exit(0);
  }

  runner.runAllTests().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

export default IntegrationTestRunner;