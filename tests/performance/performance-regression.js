#!/usr/bin/env node

/**
 * Performance Regression Detection and Alerting System
 * 
 * Features:
 * - Baseline performance measurement and storage
 * - Automated regression detection
 * - Performance trend analysis
 * - Alerting system for performance degradations
 * - Historical performance tracking
 * - Detailed performance profiling
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { performance, PerformanceObserver } = require('perf_hooks');
const { execSync } = require('child_process');

class PerformanceRegressionDetector {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:4000';
    this.outputDir = options.outputDir || path.join(process.cwd(), 'performance-results');
    this.baselinesDir = path.join(this.outputDir, 'baselines');
    this.resultsDir = path.join(this.outputDir, 'results');
    this.alertsDir = path.join(this.outputDir, 'alerts');
    
    // Performance thresholds (% degradation to trigger alerts)
    this.thresholds = {
      responseTime: options.responseTimeThreshold || 20, // 20% slower triggers alert
      throughput: options.throughputThreshold || 15,     // 15% less throughput triggers alert
      errorRate: options.errorRateThreshold || 5,        // 5% increase in errors triggers alert
      memoryUsage: options.memoryThreshold || 25,        // 25% more memory usage triggers alert
      cpuUsage: options.cpuThreshold || 30               // 30% more CPU usage triggers alert
    };

    this.testDuration = options.testDuration || 60000;  // 1 minute test duration
    this.warmupTime = options.warmupTime || 10000;      // 10 second warmup
    this.concurrency = options.concurrency || 10;       // Concurrent users

    this.metrics = {
      responseTime: [],
      throughput: 0,
      errorRate: 0,
      memoryUsage: [],
      cpuUsage: [],
      requestCount: 0,
      errorCount: 0,
      customMetrics: {}
    };
  }

  async initialize() {
    await this.ensureDirectories();
    this.setupPerformanceObserver();
    console.log('Performance regression detector initialized');
  }

  async ensureDirectories() {
    const dirs = [this.outputDir, this.baselinesDir, this.resultsDir, this.alertsDir];
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  setupPerformanceObserver() {
    const obs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        if (entry.name.startsWith('http-request')) {
          this.metrics.responseTime.push(entry.duration);
        }
      }
    });
    obs.observe({ entryTypes: ['measure'] });
  }

  // Core Performance Testing Methods
  async runPerformanceTest(testName, testConfig = {}) {
    console.log(`Starting performance test: ${testName}`);
    
    const test = {
      name: testName,
      timestamp: new Date().toISOString(),
      config: {
        duration: testConfig.duration || this.testDuration,
        concurrency: testConfig.concurrency || this.concurrency,
        warmup: testConfig.warmup || this.warmupTime,
        endpoints: testConfig.endpoints || ['/api/flashcards']
      },
      results: {
        responseTime: {
          min: Infinity,
          max: 0,
          avg: 0,
          p50: 0,
          p95: 0,
          p99: 0
        },
        throughput: 0,
        errorRate: 0,
        totalRequests: 0,
        totalErrors: 0,
        memoryUsage: {
          min: Infinity,
          max: 0,
          avg: 0
        },
        cpuUsage: {
          min: Infinity,
          max: 0,
          avg: 0
        }
      }
    };

    // Reset metrics
    this.metrics = {
      responseTime: [],
      throughput: 0,
      errorRate: 0,
      memoryUsage: [],
      cpuUsage: [],
      requestCount: 0,
      errorCount: 0,
      customMetrics: {}
    };

    // Warmup phase
    if (test.config.warmup > 0) {
      console.log('Warming up...');
      await this.warmupPhase(test.config.warmup, test.config.endpoints);
    }

    // Start system monitoring
    const monitoringInterval = this.startSystemMonitoring();

    // Main test phase
    console.log(`Running ${test.config.duration}ms test with ${test.config.concurrency} concurrent users...`);
    
    const startTime = Date.now();
    const promises = [];

    // Create concurrent user sessions
    for (let i = 0; i < test.config.concurrency; i++) {
      promises.push(this.simulateUserSession(test.config.duration, test.config.endpoints, i));
    }

    await Promise.all(promises);
    
    const endTime = Date.now();
    const actualDuration = endTime - startTime;

    // Stop system monitoring
    clearInterval(monitoringInterval);

    // Calculate results
    test.results = this.calculateResults(actualDuration);
    
    console.log(`Performance test completed: ${testName}`);
    console.log(`  Response Time (avg): ${test.results.responseTime.avg.toFixed(2)}ms`);
    console.log(`  Throughput: ${test.results.throughput.toFixed(2)} req/s`);
    console.log(`  Error Rate: ${test.results.errorRate.toFixed(2)}%`);

    // Save results
    await this.saveTestResults(test);

    return test;
  }

  async warmupPhase(duration, endpoints) {
    const warmupPromises = [];
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
      for (const endpoint of endpoints) {
        warmupPromises.push(this.makeRequest(endpoint, { skipMetrics: true }));
        
        // Limit concurrent warmup requests
        if (warmupPromises.length >= 5) {
          await Promise.allSettled(warmupPromises);
          warmupPromises.length = 0;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (warmupPromises.length > 0) {
      await Promise.allSettled(warmupPromises);
    }
  }

  async simulateUserSession(duration, endpoints, userId) {
    const startTime = Date.now();
    const sessionPromises = [];

    while (Date.now() - startTime < duration) {
      // Random endpoint selection
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      
      // Add some randomness to request timing
      const delay = Math.random() * 1000 + 500; // 500-1500ms between requests
      
      sessionPromises.push(
        this.makeTimedRequest(endpoint, userId)
          .then(() => new Promise(resolve => setTimeout(resolve, delay)))
      );

      // Prevent memory buildup
      if (sessionPromises.length >= 100) {
        await Promise.allSettled(sessionPromises);
        sessionPromises.length = 0;
      }
    }

    if (sessionPromises.length > 0) {
      await Promise.allSettled(sessionPromises);
    }
  }

  async makeTimedRequest(endpoint, userId) {
    const requestId = `http-request-${userId}-${Date.now()}`;
    
    performance.mark(`${requestId}-start`);
    
    try {
      const response = await this.makeRequest(endpoint);
      
      performance.mark(`${requestId}-end`);
      performance.measure(requestId, `${requestId}-start`, `${requestId}-end`);
      
      this.metrics.requestCount++;
      
      if (response.status >= 400) {
        this.metrics.errorCount++;
      }
      
      return response;
      
    } catch (error) {
      performance.mark(`${requestId}-end`);
      performance.measure(requestId, `${requestId}-start`, `${requestId}-end`);
      
      this.metrics.requestCount++;
      this.metrics.errorCount++;
      
      throw error;
    }
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await axios({
        method: 'GET',
        url: url,
        timeout: 10000,
        validateStatus: () => true, // Don't throw on HTTP errors
        headers: {
          'Authorization': 'Bearer test-token'
        },
        ...options
      });
      
      return response;
      
    } catch (error) {
      if (error.response) {
        return error.response;
      }
      throw error;
    }
  }

  startSystemMonitoring() {
    const interval = setInterval(async () => {
      try {
        // Memory usage
        const memUsage = process.memoryUsage();
        this.metrics.memoryUsage.push(memUsage.heapUsed / 1024 / 1024); // MB

        // CPU usage (approximate)
        const cpuUsage = process.cpuUsage();
        const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000 / 1000; // Convert to seconds
        this.metrics.cpuUsage.push(cpuPercent);

      } catch (error) {
        console.warn('System monitoring error:', error.message);
      }
    }, 1000);

    return interval;
  }

  calculateResults(actualDuration) {
    const results = {
      responseTime: this.calculateResponseTimeStats(),
      throughput: (this.metrics.requestCount / actualDuration) * 1000, // requests per second
      errorRate: (this.metrics.errorCount / this.metrics.requestCount) * 100,
      totalRequests: this.metrics.requestCount,
      totalErrors: this.metrics.errorCount,
      memoryUsage: this.calculateMemoryStats(),
      cpuUsage: this.calculateCpuStats()
    };

    return results;
  }

  calculateResponseTimeStats() {
    if (this.metrics.responseTime.length === 0) {
      return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = this.metrics.responseTime.sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99)
    };
  }

  calculateMemoryStats() {
    if (this.metrics.memoryUsage.length === 0) {
      return { min: 0, max: 0, avg: 0 };
    }

    const min = Math.min(...this.metrics.memoryUsage);
    const max = Math.max(...this.metrics.memoryUsage);
    const avg = this.metrics.memoryUsage.reduce((sum, val) => sum + val, 0) / this.metrics.memoryUsage.length;

    return { min, max, avg };
  }

  calculateCpuStats() {
    if (this.metrics.cpuUsage.length === 0) {
      return { min: 0, max: 0, avg: 0 };
    }

    const min = Math.min(...this.metrics.cpuUsage);
    const max = Math.max(...this.metrics.cpuUsage);
    const avg = this.metrics.cpuUsage.reduce((sum, val) => sum + val, 0) / this.metrics.cpuUsage.length;

    return { min, max, avg };
  }

  percentile(sortedArray, p) {
    const index = (p / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (lower === upper) {
      return sortedArray[lower];
    }

    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  // Baseline Management
  async saveBaseline(testName, results) {
    const baselinePath = path.join(this.baselinesDir, `${testName}.json`);
    const baseline = {
      testName: testName,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || 'unknown',
      results: results
    };

    await fs.writeFile(baselinePath, JSON.stringify(baseline, null, 2));
    console.log(`Baseline saved: ${baselinePath}`);
    
    return baseline;
  }

  async loadBaseline(testName) {
    const baselinePath = path.join(this.baselinesDir, `${testName}.json`);
    
    try {
      const data = await fs.readFile(baselinePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn(`No baseline found for test: ${testName}`);
      return null;
    }
  }

  async saveTestResults(testResult) {
    const timestamp = testResult.timestamp.replace(/[:.]/g, '-');
    const resultsPath = path.join(this.resultsDir, `${testResult.name}-${timestamp}.json`);
    
    await fs.writeFile(resultsPath, JSON.stringify(testResult, null, 2));
    console.log(`Test results saved: ${resultsPath}`);
  }

  // Regression Detection
  async detectRegression(testName, currentResults) {
    const baseline = await this.loadBaseline(testName);
    
    if (!baseline) {
      console.log(`No baseline found for ${testName}. Creating new baseline.`);
      await this.saveBaseline(testName, currentResults);
      return { hasRegression: false, message: 'Baseline created' };
    }

    const regressions = [];
    const analysis = {
      testName: testName,
      timestamp: new Date().toISOString(),
      baseline: baseline.results,
      current: currentResults,
      regressions: regressions,
      improvements: []
    };

    // Response Time Analysis
    const responseTimeDiff = ((currentResults.responseTime.avg - baseline.results.responseTime.avg) / baseline.results.responseTime.avg) * 100;
    if (responseTimeDiff > this.thresholds.responseTime) {
      regressions.push({
        metric: 'Response Time (avg)',
        baseline: baseline.results.responseTime.avg,
        current: currentResults.responseTime.avg,
        degradation: responseTimeDiff.toFixed(2) + '%',
        severity: responseTimeDiff > 50 ? 'critical' : responseTimeDiff > 30 ? 'high' : 'medium'
      });
    } else if (responseTimeDiff < -10) {
      analysis.improvements.push({
        metric: 'Response Time (avg)',
        improvement: Math.abs(responseTimeDiff).toFixed(2) + '%'
      });
    }

    // Throughput Analysis
    const throughputDiff = ((baseline.results.throughput - currentResults.throughput) / baseline.results.throughput) * 100;
    if (throughputDiff > this.thresholds.throughput) {
      regressions.push({
        metric: 'Throughput',
        baseline: baseline.results.throughput,
        current: currentResults.throughput,
        degradation: throughputDiff.toFixed(2) + '%',
        severity: throughputDiff > 40 ? 'critical' : throughputDiff > 25 ? 'high' : 'medium'
      });
    }

    // Error Rate Analysis
    const errorRateDiff = currentResults.errorRate - baseline.results.errorRate;
    if (errorRateDiff > this.thresholds.errorRate) {
      regressions.push({
        metric: 'Error Rate',
        baseline: baseline.results.errorRate,
        current: currentResults.errorRate,
        degradation: `+${errorRateDiff.toFixed(2)}%`,
        severity: errorRateDiff > 15 ? 'critical' : errorRateDiff > 10 ? 'high' : 'medium'
      });
    }

    // Memory Usage Analysis
    const memoryDiff = ((currentResults.memoryUsage.avg - baseline.results.memoryUsage.avg) / baseline.results.memoryUsage.avg) * 100;
    if (memoryDiff > this.thresholds.memoryUsage) {
      regressions.push({
        metric: 'Memory Usage (avg)',
        baseline: baseline.results.memoryUsage.avg,
        current: currentResults.memoryUsage.avg,
        degradation: memoryDiff.toFixed(2) + '%',
        severity: memoryDiff > 50 ? 'high' : 'medium'
      });
    }

    analysis.hasRegression = regressions.length > 0;
    analysis.severity = this.calculateOverallSeverity(regressions);

    return analysis;
  }

  calculateOverallSeverity(regressions) {
    if (regressions.some(r => r.severity === 'critical')) return 'critical';
    if (regressions.some(r => r.severity === 'high')) return 'high';
    if (regressions.some(r => r.severity === 'medium')) return 'medium';
    return 'low';
  }

  // Alerting System
  async sendAlert(regressionAnalysis) {
    if (!regressionAnalysis.hasRegression) {
      return;
    }

    const alert = {
      id: `alert-${Date.now()}`,
      timestamp: new Date().toISOString(),
      testName: regressionAnalysis.testName,
      severity: regressionAnalysis.severity,
      regressions: regressionAnalysis.regressions,
      message: this.generateAlertMessage(regressionAnalysis)
    };

    // Save alert
    const alertPath = path.join(this.alertsDir, `${alert.id}.json`);
    await fs.writeFile(alertPath, JSON.stringify(alert, null, 2));

    // Console alert
    this.displayConsoleAlert(alert);

    // Additional alerting mechanisms could be added here:
    // - Email notifications
    // - Slack/Teams webhooks  
    // - PagerDuty integration
    // - Custom webhook endpoints

    return alert;
  }

  generateAlertMessage(analysis) {
    const criticalRegressions = analysis.regressions.filter(r => r.severity === 'critical');
    const highRegressions = analysis.regressions.filter(r => r.severity === 'high');

    let message = `🚨 Performance Regression Detected in ${analysis.testName}\n\n`;

    if (criticalRegressions.length > 0) {
      message += `CRITICAL Issues (${criticalRegressions.length}):\n`;
      criticalRegressions.forEach(r => {
        message += `  • ${r.metric}: ${r.degradation} degradation (${r.current} vs baseline ${r.baseline})\n`;
      });
      message += '\n';
    }

    if (highRegressions.length > 0) {
      message += `HIGH Priority Issues (${highRegressions.length}):\n`;
      highRegressions.forEach(r => {
        message += `  • ${r.metric}: ${r.degradation} degradation\n`;
      });
      message += '\n';
    }

    message += `Total regressions detected: ${analysis.regressions.length}\n`;
    message += `Test completed at: ${analysis.timestamp}`;

    return message;
  }

  displayConsoleAlert(alert) {
    console.log('\n' + '='.repeat(80));
    console.log(`🚨 PERFORMANCE REGRESSION ALERT - ${alert.severity.toUpperCase()}`);
    console.log('='.repeat(80));
    console.log(alert.message);
    console.log('='.repeat(80) + '\n');
  }

  // Historical Analysis
  async analyzePerformanceTrends(testName, days = 30) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const results = [];

    try {
      const files = await fs.readdir(this.resultsDir);
      
      for (const file of files) {
        if (file.startsWith(testName) && file.endsWith('.json')) {
          const filePath = path.join(this.resultsDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime > cutoffDate) {
            const data = await fs.readFile(filePath, 'utf8');
            const result = JSON.parse(data);
            results.push(result);
          }
        }
      }

      // Sort by timestamp
      results.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      return this.generateTrendAnalysis(results);

    } catch (error) {
      console.error('Error analyzing trends:', error);
      return null;
    }
  }

  generateTrendAnalysis(results) {
    if (results.length < 2) {
      return { message: 'Insufficient data for trend analysis' };
    }

    const analysis = {
      testCount: results.length,
      timeRange: {
        start: results[0].timestamp,
        end: results[results.length - 1].timestamp
      },
      trends: {
        responseTime: this.calculateTrend(results.map(r => r.results.responseTime.avg)),
        throughput: this.calculateTrend(results.map(r => r.results.throughput)),
        errorRate: this.calculateTrend(results.map(r => r.results.errorRate)),
        memoryUsage: this.calculateTrend(results.map(r => r.results.memoryUsage.avg))
      },
      recommendations: []
    };

    // Generate recommendations based on trends
    if (analysis.trends.responseTime.direction === 'increasing') {
      analysis.recommendations.push('Response times are trending upward - investigate performance bottlenecks');
    }
    
    if (analysis.trends.throughput.direction === 'decreasing') {
      analysis.recommendations.push('Throughput is declining - review system capacity and scaling');
    }
    
    if (analysis.trends.errorRate.direction === 'increasing') {
      analysis.recommendations.push('Error rates are increasing - check system stability and error handling');
    }

    return analysis;
  }

  calculateTrend(values) {
    if (values.length < 2) {
      return { direction: 'stable', slope: 0, confidence: 0 };
    }

    // Simple linear regression to calculate trend
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const xSum = x.reduce((a, b) => a + b, 0);
    const ySum = values.reduce((a, b) => a + b, 0);
    const xxSum = x.reduce((sum, xi) => sum + xi * xi, 0);
    const xySum = x.reduce((sum, xi, i) => sum + xi * values[i], 0);

    const slope = (n * xySum - xSum * ySum) / (n * xxSum - xSum * xSum);
    
    return {
      direction: slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable',
      slope: slope,
      confidence: Math.min(Math.abs(slope) * 10, 1) // Simple confidence metric
    };
  }

  // Main execution methods
  async runRegressionTest(testName, testConfig = {}) {
    console.log(`\n🔄 Running performance regression test: ${testName}`);
    
    try {
      // Run performance test
      const testResult = await this.runPerformanceTest(testName, testConfig);
      
      // Detect regressions
      const regressionAnalysis = await this.detectRegression(testName, testResult.results);
      
      // Send alerts if regressions detected
      if (regressionAnalysis.hasRegression) {
        await this.sendAlert(regressionAnalysis);
      }
      
      // Generate report
      const report = await this.generatePerformanceReport(testResult, regressionAnalysis);
      
      return {
        testResult: testResult,
        regressionAnalysis: regressionAnalysis,
        report: report
      };
      
    } catch (error) {
      console.error(`Performance regression test failed: ${error.message}`);
      throw error;
    }
  }

  async generatePerformanceReport(testResult, regressionAnalysis) {
    const report = {
      testName: testResult.name,
      timestamp: testResult.timestamp,
      results: testResult.results,
      regression: regressionAnalysis,
      status: regressionAnalysis.hasRegression ? 'regression_detected' : 'passed'
    };

    const reportPath = path.join(this.outputDir, `performance-report-${testResult.name}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`Performance report generated: ${reportPath}`);
    
    return reportPath;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Performance Regression Detection System

Usage: node performance-regression.js <command> [options]

Commands:
  test <name>           Run performance test and regression analysis
  baseline <name>       Create/update baseline for test
  trends <name>         Analyze performance trends
  alerts               List recent alerts

Options:
  --duration=N          Test duration in milliseconds (default: 60000)
  --concurrency=N       Number of concurrent users (default: 10)
  --base-url=URL        Base URL for testing (default: http://localhost:4000)

Examples:
  node performance-regression.js test login-performance
  node performance-regression.js baseline api-performance --duration=120000
  node performance-regression.js trends api-performance --days=14
    `);
    return;
  }

  const command = args[0];
  const testName = args[1];
  const options = {};

  // Parse options
  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      
      switch (key) {
        case 'duration':
          options.testDuration = parseInt(value);
          break;
        case 'concurrency':
          options.concurrency = parseInt(value);
          break;
        case 'base-url':
          options.baseUrl = value;
          break;
      }
    }
  }

  const detector = new PerformanceRegressionDetector(options);
  
  try {
    await detector.initialize();
    
    switch (command) {
      case 'test':
        if (!testName) {
          console.error('Test name required');
          process.exit(1);
        }
        
        const result = await detector.runRegressionTest(testName);
        
        console.log('\n📊 Test Summary:');
        console.log(`  Status: ${result.regressionAnalysis.hasRegression ? '❌ Regression Detected' : '✅ Passed'}`);
        console.log(`  Response Time: ${result.testResult.results.responseTime.avg.toFixed(2)}ms`);
        console.log(`  Throughput: ${result.testResult.results.throughput.toFixed(2)} req/s`);
        console.log(`  Error Rate: ${result.testResult.results.errorRate.toFixed(2)}%`);
        
        if (result.regressionAnalysis.hasRegression) {
          console.log(`\n🚨 Regressions (${result.regressionAnalysis.regressions.length}):`);
          result.regressionAnalysis.regressions.forEach(r => {
            console.log(`  • ${r.metric}: ${r.degradation} degradation (${r.severity})`);
          });
        }
        
        process.exit(result.regressionAnalysis.hasRegression ? 1 : 0);
        break;
        
      case 'baseline':
        if (!testName) {
          console.error('Test name required');
          process.exit(1);
        }
        
        const testResult = await detector.runPerformanceTest(testName);
        await detector.saveBaseline(testName, testResult.results);
        console.log(`✅ Baseline created for ${testName}`);
        break;
        
      case 'trends':
        if (!testName) {
          console.error('Test name required');
          process.exit(1);
        }
        
        const trends = await detector.analyzePerformanceTrends(testName);
        if (trends) {
          console.log(`\n📈 Performance Trends for ${testName}:`);
          console.log(`  Tests analyzed: ${trends.testCount}`);
          console.log(`  Time range: ${trends.timeRange.start} to ${trends.timeRange.end}`);
          console.log('\n  Trends:');
          Object.entries(trends.trends).forEach(([metric, trend]) => {
            const arrow = trend.direction === 'increasing' ? '↗️' : 
                         trend.direction === 'decreasing' ? '↘️' : '➡️';
            console.log(`    ${arrow} ${metric}: ${trend.direction} (confidence: ${(trend.confidence * 100).toFixed(0)}%)`);
          });
          
          if (trends.recommendations.length > 0) {
            console.log('\n  Recommendations:');
            trends.recommendations.forEach(rec => console.log(`    • ${rec}`));
          }
        }
        break;
        
      case 'alerts':
        // List recent alerts
        const alertFiles = await fs.readdir(detector.alertsDir);
        const alerts = [];
        
        for (const file of alertFiles.slice(-10)) { // Last 10 alerts
          if (file.endsWith('.json')) {
            const data = await fs.readFile(path.join(detector.alertsDir, file), 'utf8');
            alerts.push(JSON.parse(data));
          }
        }
        
        alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        console.log(`\n🚨 Recent Alerts (${alerts.length}):`);
        alerts.forEach(alert => {
          console.log(`  [${alert.timestamp}] ${alert.testName} - ${alert.severity.toUpperCase()}`);
          console.log(`    ${alert.regressions.length} regressions detected`);
        });
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
    
  } catch (error) {
    console.error('Command failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PerformanceRegressionDetector;