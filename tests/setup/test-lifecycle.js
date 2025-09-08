/**
 * Test Lifecycle Manager - Complete test environment lifecycle management
 * 
 * Features:
 * - Pre-test setup and validation
 * - Post-test cleanup and verification
 * - Test isolation enforcement
 * - Resource management
 * - Environment health monitoring
 */

const TestDataManager = require('./data-manager');
const CleanupAutomation = require('./cleanup-automation');
const { performance } = require('perf_hooks');

class TestLifecycleManager {
  constructor(options = {}) {
    this.dataManager = new TestDataManager(options);
    this.cleanupAutomation = new CleanupAutomation(options);
    this.testSessions = new Map();
    this.globalStartTime = null;
    this.maxConcurrentTests = options.maxConcurrentTests || 5;
    this.activeTests = new Set();
    this.failedTests = new Set();
    this.testMetrics = new Map();
  }

  async initialize() {
    await this.dataManager.initialize();
    await this.cleanupAutomation.initialize();
    this.globalStartTime = performance.now();
    
    console.log('Test lifecycle manager initialized');
  }

  // Test Session Management
  async startTestSession(testName, options = {}) {
    const sessionId = `${testName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Enforce concurrency limits
    if (this.activeTests.size >= this.maxConcurrentTests) {
      throw new Error(`Maximum concurrent tests (${this.maxConcurrentTests}) exceeded`);
    }

    const session = {
      id: sessionId,
      name: testName,
      startTime: performance.now(),
      dataManager: new TestDataManager(options),
      createdData: {
        users: new Set(),
        flashcards: new Set(),
        sessions: new Set(),
        files: new Set()
      },
      metrics: {
        memoryStart: process.memoryUsage(),
        setupTime: 0,
        executionTime: 0,
        cleanupTime: 0
      },
      isolated: options.isolated !== false, // Default to true
      skipCleanup: options.skipCleanup === true
    };

    await session.dataManager.initialize();
    
    // Begin transaction for isolated tests
    if (session.isolated) {
      session.transaction = session.dataManager.beginTransaction();
    }

    this.testSessions.set(sessionId, session);
    this.activeTests.add(sessionId);
    
    session.metrics.setupTime = performance.now() - session.startTime;
    
    console.log(`Test session started: ${sessionId} (${testName})`);
    return sessionId;
  }

  async endTestSession(sessionId, testPassed = true) {
    const session = this.testSessions.get(sessionId);
    if (!session) {
      throw new Error(`Test session not found: ${sessionId}`);
    }

    const endTime = performance.now();
    session.endTime = endTime;
    session.metrics.executionTime = endTime - session.startTime - session.metrics.setupTime;
    
    const cleanupStartTime = performance.now();

    try {
      if (!testPassed) {
        this.failedTests.add(sessionId);
        console.warn(`Test failed: ${session.name} (${sessionId})`);
      }

      // Cleanup based on test result and configuration
      if (!session.skipCleanup) {
        if (session.isolated && session.transaction) {
          // Rollback transaction for isolated tests
          session.dataManager.rollbackTransaction();
        } else {
          // Manual cleanup for non-isolated tests
          await session.dataManager.fullCleanup();
        }
      }

      session.metrics.cleanupTime = performance.now() - cleanupStartTime;
      session.metrics.memoryEnd = process.memoryUsage();
      session.metrics.memoryDelta = {
        rss: (session.metrics.memoryEnd.rss - session.metrics.memoryStart.rss) / 1024 / 1024,
        heapUsed: (session.metrics.memoryEnd.heapUsed - session.metrics.memoryStart.heapUsed) / 1024 / 1024
      };

      // Store metrics for analysis
      this.testMetrics.set(sessionId, {
        name: session.name,
        passed: testPassed,
        duration: session.metrics.executionTime,
        memoryDelta: session.metrics.memoryDelta,
        setupTime: session.metrics.setupTime,
        cleanupTime: session.metrics.cleanupTime
      });

    } catch (error) {
      console.error(`Cleanup failed for test session ${sessionId}:`, error);
      this.failedTests.add(sessionId);
    } finally {
      this.activeTests.delete(sessionId);
      this.testSessions.delete(sessionId);
      
      console.log(`Test session ended: ${sessionId} (${testPassed ? 'PASSED' : 'FAILED'})`);
    }
  }

  // Data Management Helpers
  async createTestUser(sessionId, userData = null) {
    const session = this.testSessions.get(sessionId);
    if (!session) {
      throw new Error(`Test session not found: ${sessionId}`);
    }

    const user = await session.dataManager.createTestUser(userData);
    session.createdData.users.add(user.id);
    return user;
  }

  async createTestFlashcard(sessionId, flashcardData = null, userId = null) {
    const session = this.testSessions.get(sessionId);
    if (!session) {
      throw new Error(`Test session not found: ${sessionId}`);
    }

    const flashcard = await session.dataManager.createTestFlashcard(flashcardData, userId);
    session.createdData.flashcards.add(flashcard.id);
    return flashcard;
  }

  async seedCompleteScenario(sessionId, userEmail = null) {
    const session = this.testSessions.get(sessionId);
    if (!session) {
      throw new Error(`Test session not found: ${sessionId}`);
    }

    const scenario = await session.dataManager.seedCompleteUserScenario(userEmail);
    
    // Track created data
    session.createdData.users.add(scenario.user.id);
    scenario.flashcards.forEach(f => session.createdData.flashcards.add(f.id));
    scenario.sessions.forEach(s => session.createdData.sessions.add(s.id));
    
    return scenario;
  }

  // Environment Validation
  async validateTestEnvironment() {
    const issues = [];

    // Check database connectivity
    try {
      await this.dataManager.getDatabaseStats();
    } catch (error) {
      issues.push(`Database connectivity issue: ${error.message}`);
    }

    // Check memory usage
    const memory = process.memoryUsage();
    const memoryUsageMB = memory.heapUsed / 1024 / 1024;
    if (memoryUsageMB > 200) {
      issues.push(`High memory usage: ${memoryUsageMB.toFixed(2)}MB`);
    }

    // Check file system permissions
    try {
      await this.dataManager.createDirectories();
    } catch (error) {
      issues.push(`File system access issue: ${error.message}`);
    }

    // Check for orphaned data
    const dataIntegrityIssues = await this.dataManager.validateDataIntegrity();
    if (dataIntegrityIssues.length > 0) {
      issues.push(...dataIntegrityIssues);
    }

    return {
      isHealthy: issues.length === 0,
      issues: issues,
      timestamp: new Date().toISOString()
    };
  }

  // Batch Operations
  async setupTestSuite(suiteConfig) {
    console.log(`Setting up test suite: ${suiteConfig.name}`);

    // Pre-seed common data if specified
    if (suiteConfig.seedData) {
      const seedSession = await this.startTestSession(`seed-${suiteConfig.name}`, { 
        skipCleanup: true 
      });

      try {
        if (suiteConfig.seedData.users) {
          for (const userData of suiteConfig.seedData.users) {
            await this.createTestUser(seedSession, userData);
          }
        }

        if (suiteConfig.seedData.adminScenario) {
          const session = this.testSessions.get(seedSession);
          await session.dataManager.seedAdminScenario();
        }

        if (suiteConfig.seedData.performanceData) {
          const session = this.testSessions.get(seedSession);
          await session.dataManager.seedPerformanceTestData(
            suiteConfig.seedData.performanceData.userCount,
            suiteConfig.seedData.performanceData.flashcardsPerUser
          );
        }

      } finally {
        await this.endTestSession(seedSession, true);
      }
    }

    // Validate environment before running tests
    const validation = await this.validateTestEnvironment();
    if (!validation.isHealthy) {
      console.warn('Test environment validation failed:', validation.issues);
      
      if (suiteConfig.strictValidation !== false) {
        throw new Error(`Test environment validation failed: ${validation.issues.join(', ')}`);
      }
    }

    console.log(`Test suite setup completed: ${suiteConfig.name}`);
  }

  async teardownTestSuite(suiteName) {
    console.log(`Tearing down test suite: ${suiteName}`);

    // End any active test sessions
    const activeSessions = Array.from(this.activeTests);
    for (const sessionId of activeSessions) {
      console.warn(`Force-ending active test session: ${sessionId}`);
      await this.endTestSession(sessionId, false);
    }

    // Perform comprehensive cleanup
    await this.cleanupAutomation.forceCleanup();

    console.log(`Test suite teardown completed: ${suiteName}`);
  }

  // Metrics and Reporting
  generateTestReport() {
    const totalTests = this.testMetrics.size + this.failedTests.size;
    const passedTests = this.testMetrics.size - this.failedTests.size;
    const failedCount = this.failedTests.size;

    const metrics = Array.from(this.testMetrics.values());
    const averageDuration = metrics.length > 0 ? 
      metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length : 0;

    const totalMemoryDelta = metrics.reduce((sum, m) => sum + m.memoryDelta.heapUsed, 0);
    const averageMemoryDelta = metrics.length > 0 ? totalMemoryDelta / metrics.length : 0;

    return {
      summary: {
        totalTests: totalTests,
        passed: passedTests,
        failed: failedCount,
        passRate: totalTests > 0 ? (passedTests / totalTests * 100).toFixed(2) + '%' : '0%',
        totalDuration: performance.now() - this.globalStartTime,
        averageTestDuration: averageDuration,
        averageMemoryDelta: averageMemoryDelta
      },
      performance: {
        slowestTests: metrics
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 5)
          .map(m => ({ name: m.name, duration: m.duration })),
        memoryIntensiveTests: metrics
          .sort((a, b) => b.memoryDelta.heapUsed - a.memoryDelta.heapUsed)
          .slice(0, 5)
          .map(m => ({ name: m.name, memoryDelta: m.memoryDelta.heapUsed }))
      },
      health: {
        activeTests: this.activeTests.size,
        failedTests: Array.from(this.failedTests),
        concurrencyUtilization: (this.activeTests.size / this.maxConcurrentTests * 100).toFixed(2) + '%'
      },
      timestamp: new Date().toISOString()
    };
  }

  // Lifecycle Management
  async shutdown() {
    console.log('Shutting down test lifecycle manager');

    // End all active sessions
    const activeSessions = Array.from(this.activeTests);
    for (const sessionId of activeSessions) {
      await this.endTestSession(sessionId, false);
    }

    // Generate final report
    const finalReport = this.generateTestReport();
    console.log('Final test report:', JSON.stringify(finalReport, null, 2));

    // Shutdown cleanup automation
    await this.cleanupAutomation.shutdown();

    console.log('Test lifecycle manager shutdown completed');
  }
}

module.exports = TestLifecycleManager;