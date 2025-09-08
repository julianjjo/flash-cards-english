#!/usr/bin/env node

/**
 * Comprehensive Test Execution and Reporting Framework
 * 
 * This script provides a unified interface for running all E2E tests with:
 * - Test suite selection and filtering
 * - Parallel execution management
 * - Real-time progress reporting
 * - Comprehensive test result aggregation
 * - HTML and JSON report generation
 * - Performance metrics collection
 * - Failure analysis and debugging
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TestRunner {
  constructor() {
    this.testSuites = {
      contracts: {
        path: 'tests/e2e/contracts',
        description: 'Contract tests (TDD validation)',
        priority: 1,
        timeout: 60000
      },
      journeys: {
        path: 'tests/e2e/journeys',
        description: 'User journey tests',
        priority: 2,
        timeout: 120000
      },
      'edge-cases': {
        path: 'tests/e2e/edge-cases',
        description: 'Edge cases and boundary testing',
        priority: 3,
        timeout: 180000
      },
      performance: {
        path: 'tests/e2e/performance',
        description: 'Performance and load testing',
        priority: 4,
        timeout: 300000
      },
      accessibility: {
        path: 'tests/e2e/accessibility',
        description: 'Accessibility and compatibility testing',
        priority: 5,
        timeout: 180000
      }
    };
    
    this.browsers = ['chromium', 'firefox', 'webkit'];
    this.results = {
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        startTime: null,
        endTime: null
      },
      suites: {},
      failures: [],
      performance: {},
      coverage: {}
    };
    
    this.config = {
      parallel: true,
      maxWorkers: 4,
      retries: 2,
      timeout: 30000,
      outputDir: 'tests/reports',
      browsers: ['chromium'],
      headless: true,
      video: false,
      screenshots: 'only-on-failure'
    };
  }

  async parseArguments() {
    const args = process.argv.slice(2);
    const options = {
      suites: [],
      browsers: [],
      grep: null,
      headed: false,
      debug: false,
      parallel: true,
      maxWorkers: 4,
      retries: 2,
      updateSnapshots: false,
      reporter: 'html',
      outputDir: 'tests/reports'
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      switch (arg) {
        case '--suites':
        case '-s':
          options.suites = nextArg ? nextArg.split(',') : Object.keys(this.testSuites);
          i++;
          break;
        case '--browsers':
        case '-b':
          options.browsers = nextArg ? nextArg.split(',') : ['chromium'];
          i++;
          break;
        case '--grep':
        case '-g':
          options.grep = nextArg;
          i++;
          break;
        case '--headed':
          options.headed = true;
          break;
        case '--debug':
          options.debug = true;
          options.headed = true;
          options.parallel = false;
          options.maxWorkers = 1;
          break;
        case '--serial':
          options.parallel = false;
          break;
        case '--workers':
        case '-j':
          options.maxWorkers = parseInt(nextArg) || 4;
          i++;
          break;
        case '--retries':
          options.retries = parseInt(nextArg) || 2;
          i++;
          break;
        case '--update-snapshots':
          options.updateSnapshots = true;
          break;
        case '--reporter':
          options.reporter = nextArg || 'html';
          i++;
          break;
        case '--output-dir':
          options.outputDir = nextArg || 'tests/reports';
          i++;
          break;
        case '--help':
        case '-h':
          this.showHelp();
          process.exit(0);
        default:
          if (arg.startsWith('--')) {
            console.warn(`Unknown option: ${arg}`);
          }
      }
    }

    // Default to all suites if none specified
    if (options.suites.length === 0) {
      options.suites = Object.keys(this.testSuites);
    }

    // Default to chromium if no browsers specified
    if (options.browsers.length === 0) {
      options.browsers = ['chromium'];
    }

    return options;
  }

  showHelp() {
    console.log(`
Flash Cards E2E Test Runner

Usage: node test-runner.js [options]

Options:
  -s, --suites <suites>       Comma-separated test suites to run
                              Available: ${Object.keys(this.testSuites).join(', ')}
                              Default: all suites
  
  -b, --browsers <browsers>   Comma-separated browsers to test
                              Available: ${this.browsers.join(', ')}
                              Default: chromium
  
  -g, --grep <pattern>        Only run tests matching pattern
  
  --headed                    Run tests in headed mode (visible browser)
  --debug                     Enable debug mode (headed, serial, verbose)
  --serial                    Run tests serially instead of parallel
  
  -j, --workers <number>      Maximum number of worker processes
                              Default: 4
  
  --retries <number>          Number of retries for flaky tests
                              Default: 2
  
  --update-snapshots          Update visual snapshots
  
  --reporter <type>           Test reporter type
                              Available: html, json, junit, console
                              Default: html
  
  --output-dir <dir>          Output directory for reports
                              Default: tests/reports
  
  -h, --help                  Show this help message

Examples:
  # Run all tests
  node test-runner.js
  
  # Run only contract and journey tests on Chrome and Firefox
  node test-runner.js --suites contracts,journeys --browsers chromium,firefox
  
  # Run tests matching "auth" pattern in debug mode
  node test-runner.js --grep "auth" --debug
  
  # Run performance tests with custom settings
  node test-runner.js --suites performance --workers 2 --retries 0
    `);
  }

  async ensureOutputDirectory(outputDir) {
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create output directory ${outputDir}:`, error.message);
      process.exit(1);
    }
  }

  async discoverTests(suitePaths) {
    const allTests = {};
    
    for (const suite of suitePaths) {
      if (!this.testSuites[suite]) {
        console.warn(`Unknown test suite: ${suite}`);
        continue;
      }
      
      const suitePath = path.join(process.cwd(), this.testSuites[suite].path);
      
      try {
        const files = await fs.readdir(suitePath);
        const testFiles = files.filter(file => file.endsWith('.test.js'));
        
        allTests[suite] = {
          ...this.testSuites[suite],
          files: testFiles.map(file => path.join(suitePath, file)),
          count: testFiles.length
        };
        
        console.log(`📋 Discovered ${testFiles.length} test files in ${suite}`);
      } catch (error) {
        console.warn(`Failed to read test suite ${suite}:`, error.message);
      }
    }
    
    return allTests;
  }

  async runPlaywrightTests(suiteTests, options) {
    const startTime = Date.now();
    this.results.summary.startTime = new Date().toISOString();
    
    console.log('\n🚀 Starting E2E Test Execution\n');
    console.log(`Configuration:`);
    console.log(`  Browsers: ${options.browsers.join(', ')}`);
    console.log(`  Workers: ${options.maxWorkers}`);
    console.log(`  Retries: ${options.retries}`);
    console.log(`  Mode: ${options.headed ? 'headed' : 'headless'}`);
    console.log(`  Parallel: ${options.parallel}`);
    console.log('');

    const results = {};
    const totalSuites = Object.keys(suiteTests).length;
    let completedSuites = 0;

    // Run test suites in priority order
    const sortedSuites = Object.entries(suiteTests)
      .sort(([,a], [,b]) => a.priority - b.priority);

    for (const [suiteName, suiteConfig] of sortedSuites) {
      console.log(`\n📦 Running ${suiteName} tests (${suiteConfig.count} files)`);
      console.log(`   ${suiteConfig.description}`);
      
      const suiteStartTime = Date.now();
      
      try {
        const suiteResult = await this.runSuite(suiteName, suiteConfig, options);
        results[suiteName] = suiteResult;
        
        const duration = Date.now() - suiteStartTime;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        
        console.log(`   ✅ Completed in ${minutes}m ${seconds}s`);
        console.log(`   📊 ${suiteResult.passed}/${suiteResult.total} tests passed\n`);
        
      } catch (error) {
        console.error(`   ❌ Suite ${suiteName} failed:`, error.message);
        results[suiteName] = {
          passed: 0,
          failed: 1,
          total: 1,
          duration: Date.now() - suiteStartTime,
          error: error.message
        };
      }
      
      completedSuites++;
      const progress = Math.round((completedSuites / totalSuites) * 100);
      console.log(`Progress: ${progress}% (${completedSuites}/${totalSuites} suites)`);
    }

    const totalDuration = Date.now() - startTime;
    this.results.summary.duration = totalDuration;
    this.results.summary.endTime = new Date().toISOString();
    this.results.suites = results;

    return results;
  }

  async runSuite(suiteName, suiteConfig, options) {
    const playwrightArgs = [
      'test',
      ...suiteConfig.files,
      '--config=playwright.config.js'
    ];

    // Add browser configuration
    if (options.browsers.length === 1) {
      playwrightArgs.push(`--project=${options.browsers[0]}`);
    }

    // Add execution options
    if (!options.parallel) {
      playwrightArgs.push('--workers=1');
    } else {
      playwrightArgs.push(`--workers=${options.maxWorkers}`);
    }

    if (options.retries > 0) {
      playwrightArgs.push(`--retries=${options.retries}`);
    }

    if (options.headed) {
      playwrightArgs.push('--headed');
    }

    if (options.debug) {
      playwrightArgs.push('--debug');
    }

    if (options.grep) {
      playwrightArgs.push(`--grep="${options.grep}"`);
    }

    if (options.updateSnapshots) {
      playwrightArgs.push('--update-snapshots');
    }

    // Add timeout
    playwrightArgs.push(`--timeout=${suiteConfig.timeout || 30000}`);

    // Add reporter configuration
    const reporterConfig = this.getReporterConfig(options, suiteName);
    playwrightArgs.push(`--reporter=${reporterConfig}`);

    return new Promise((resolve, reject) => {
      console.log(`   🔧 Command: npx playwright ${playwrightArgs.join(' ')}`);
      
      const child = spawn('npx', ['playwright', ...playwrightArgs], {
        stdio: options.debug ? 'inherit' : ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      if (!options.debug) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
          // Show real-time progress for important messages
          const lines = data.toString().split('\n');
          lines.forEach(line => {
            if (line.includes('Running') || line.includes('passed') || line.includes('failed')) {
              console.log(`   ${line.trim()}`);
            }
          });
        });

        child.stderr.on('data', (data) => {
          stderr += data.toString();
          console.error(`   Error: ${data.toString().trim()}`);
        });
      }

      child.on('close', (code) => {
        const result = this.parsePlaywrightOutput(stdout, stderr, code);
        
        if (code === 0) {
          resolve(result);
        } else {
          reject(new Error(`Playwright exited with code ${code}\nStderr: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to run Playwright: ${error.message}`));
      });
    });
  }

  getReporterConfig(options, suiteName) {
    const reportPath = path.join(options.outputDir, `${suiteName}-report`);
    
    switch (options.reporter) {
      case 'html':
        return `html:${reportPath}.html`;
      case 'json':
        return `json:${reportPath}.json`;
      case 'junit':
        return `junit:${reportPath}.xml`;
      case 'console':
        return 'list';
      default:
        return `html:${reportPath}.html`;
    }
  }

  parsePlaywrightOutput(stdout, stderr, exitCode) {
    const result = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0,
      exitCode
    };

    // Parse test results from stdout
    const lines = stdout.split('\n');
    
    for (const line of lines) {
      // Look for summary lines like "5 passed, 2 failed"
      const summaryMatch = line.match(/(\d+)\s+passed(?:,\s*(\d+)\s+failed)?(?:,\s*(\d+)\s+skipped)?/);
      if (summaryMatch) {
        result.passed = parseInt(summaryMatch[1]) || 0;
        result.failed = parseInt(summaryMatch[2]) || 0;
        result.skipped = parseInt(summaryMatch[3]) || 0;
        result.total = result.passed + result.failed + result.skipped;
      }
      
      // Look for duration
      const durationMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:m|min|minutes?)\s*(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)/);
      if (durationMatch) {
        const minutes = parseFloat(durationMatch[1]) || 0;
        const seconds = parseFloat(durationMatch[2]) || 0;
        result.duration = (minutes * 60 + seconds) * 1000;
      }
    }

    // If we couldn't parse results, make estimates based on exit code
    if (result.total === 0) {
      if (exitCode === 0) {
        result.passed = 1; // At least one test passed
        result.total = 1;
      } else {
        result.failed = 1; // At least one test failed
        result.total = 1;
      }
    }

    return result;
  }

  async generateReports(options) {
    console.log('\n📊 Generating Test Reports...');
    
    await this.ensureOutputDirectory(options.outputDir);
    
    // Aggregate results
    this.aggregateResults();
    
    // Generate different report formats
    await Promise.all([
      this.generateHTMLReport(options.outputDir),
      this.generateJSONReport(options.outputDir),
      this.generateJUnitReport(options.outputDir),
      this.generateConsoleReport()
    ]);
    
    console.log(`📁 Reports generated in: ${options.outputDir}`);
  }

  aggregateResults() {
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const [suiteName, suiteResult] of Object.entries(this.results.suites)) {
      totalTests += suiteResult.total || 0;
      totalPassed += suiteResult.passed || 0;
      totalFailed += suiteResult.failed || 0;
      totalSkipped += suiteResult.skipped || 0;
    }

    this.results.summary.totalTests = totalTests;
    this.results.summary.passed = totalPassed;
    this.results.summary.failed = totalFailed;
    this.results.summary.skipped = totalSkipped;
  }

  async generateHTMLReport(outputDir) {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flash Cards E2E Test Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: #fff; padding: 30px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header h1 { color: #2d3748; margin-bottom: 10px; }
        .header .meta { color: #666; font-size: 14px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
        .stat-card.passed { border-left: 4px solid #48bb78; }
        .stat-card.failed { border-left: 4px solid #f56565; }
        .stat-card.skipped { border-left: 4px solid #ed8936; }
        .stat-card.total { border-left: 4px solid #4299e1; }
        .stat-number { font-size: 2.5rem; font-weight: bold; margin-bottom: 5px; }
        .stat-label { color: #666; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px; }
        .suites { background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }
        .suite { border-bottom: 1px solid #e2e8f0; }
        .suite:last-child { border-bottom: none; }
        .suite-header { padding: 20px; background: #f7fafc; border-left: 4px solid #4299e1; }
        .suite-title { font-size: 1.2rem; font-weight: 600; color: #2d3748; margin-bottom: 5px; }
        .suite-desc { color: #666; font-size: 0.9rem; }
        .suite-stats { padding: 15px 20px; display: flex; gap: 20px; font-size: 0.9rem; }
        .suite-stat { display: flex; align-items: center; gap: 5px; }
        .suite-stat .dot { width: 8px; height: 8px; border-radius: 50%; }
        .suite-stat.passed .dot { background: #48bb78; }
        .suite-stat.failed .dot { background: #f56565; }
        .suite-stat.skipped .dot { background: #ed8936; }
        .success { color: #48bb78; }
        .error { color: #f56565; }
        .warning { color: #ed8936; }
        .footer { text-align: center; margin-top: 40px; padding: 20px; color: #666; font-size: 0.9rem; }
        .progress-bar { width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #48bb78 0%, #4299e1 100%); transition: width 0.3s ease; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧠 Flash Cards E2E Test Report</h1>
            <div class="meta">
                <p><strong>Started:</strong> ${this.results.summary.startTime}</p>
                <p><strong>Completed:</strong> ${this.results.summary.endTime}</p>
                <p><strong>Duration:</strong> ${this.formatDuration(this.results.summary.duration)}</p>
                <p><strong>Status:</strong> <span class="${this.results.summary.failed === 0 ? 'success' : 'error'}">${this.results.summary.failed === 0 ? '✅ PASSED' : '❌ FAILED'}</span></p>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${this.results.summary.totalTests > 0 ? (this.results.summary.passed / this.results.summary.totalTests * 100) : 0}%"></div>
            </div>
        </div>

        <div class="summary">
            <div class="stat-card total">
                <div class="stat-number">${this.results.summary.totalTests}</div>
                <div class="stat-label">Total Tests</div>
            </div>
            <div class="stat-card passed">
                <div class="stat-number">${this.results.summary.passed}</div>
                <div class="stat-label">Passed</div>
            </div>
            <div class="stat-card failed">
                <div class="stat-number">${this.results.summary.failed}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat-card skipped">
                <div class="stat-number">${this.results.summary.skipped}</div>
                <div class="stat-label">Skipped</div>
            </div>
        </div>

        <div class="suites">
            ${Object.entries(this.results.suites).map(([name, suite]) => `
                <div class="suite">
                    <div class="suite-header">
                        <div class="suite-title">${name}</div>
                        <div class="suite-desc">${this.testSuites[name]?.description || 'Test Suite'}</div>
                    </div>
                    <div class="suite-stats">
                        <div class="suite-stat passed">
                            <div class="dot"></div>
                            <span>${suite.passed || 0} passed</span>
                        </div>
                        <div class="suite-stat failed">
                            <div class="dot"></div>
                            <span>${suite.failed || 0} failed</span>
                        </div>
                        <div class="suite-stat skipped">
                            <div class="dot"></div>
                            <span>${suite.skipped || 0} skipped</span>
                        </div>
                        <div class="suite-stat">
                            <span>⏱️ ${this.formatDuration(suite.duration || 0)}</span>
                        </div>
                        ${suite.error ? `<div class="suite-stat error"><span>❌ ${suite.error}</span></div>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="footer">
            <p>Generated by Flash Cards E2E Test Runner</p>
            <p>Report created on ${new Date().toISOString()}</p>
        </div>
    </div>
</body>
</html>`;

    await fs.writeFile(path.join(outputDir, 'test-report.html'), htmlContent);
  }

  async generateJSONReport(outputDir) {
    const jsonReport = {
      summary: this.results.summary,
      suites: this.results.suites,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        runner: 'Flash Cards E2E Test Runner'
      }
    };

    await fs.writeFile(
      path.join(outputDir, 'test-report.json'),
      JSON.stringify(jsonReport, null, 2)
    );
  }

  async generateJUnitReport(outputDir) {
    const escapeXml = (str) => {
      return str.replace(/[<>&'"]/g, (char) => {
        const escapeChars = {
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          "'": '&apos;',
          '"': '&quot;'
        };
        return escapeChars[char];
      });
    };

    const junitXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites 
    name="Flash Cards E2E Tests"
    tests="${this.results.summary.totalTests}"
    failures="${this.results.summary.failed}"
    skipped="${this.results.summary.skipped}"
    time="${(this.results.summary.duration / 1000).toFixed(3)}">
    
    ${Object.entries(this.results.suites).map(([name, suite]) => `
    <testsuite 
        name="${escapeXml(name)}"
        tests="${suite.total || 0}"
        failures="${suite.failed || 0}"
        skipped="${suite.skipped || 0}"
        time="${((suite.duration || 0) / 1000).toFixed(3)}">
        
        ${suite.error ? `
        <testcase name="${escapeXml(name)} - Suite Execution" classname="${escapeXml(name)}">
            <failure message="${escapeXml(suite.error)}">${escapeXml(suite.error)}</failure>
        </testcase>
        ` : `
        <testcase name="${escapeXml(name)} - Tests" classname="${escapeXml(name)}" time="${((suite.duration || 0) / 1000).toFixed(3)}">
            ${suite.failed > 0 ? `<failure message="Some tests failed">${suite.failed} tests failed</failure>` : ''}
        </testcase>
        `}
    </testsuite>
    `).join('')}
    
</testsuites>`;

    await fs.writeFile(path.join(outputDir, 'test-report.xml'), junitXml);
  }

  generateConsoleReport() {
    console.log('\n📈 Test Execution Summary');
    console.log('='.repeat(50));
    
    const passRate = this.results.summary.totalTests > 0 
      ? ((this.results.summary.passed / this.results.summary.totalTests) * 100).toFixed(1)
      : 0;
    
    console.log(`Total Tests:     ${this.results.summary.totalTests}`);
    console.log(`✅ Passed:       ${this.results.summary.passed}`);
    console.log(`❌ Failed:       ${this.results.summary.failed}`);
    console.log(`⏭️  Skipped:      ${this.results.summary.skipped}`);
    console.log(`📊 Pass Rate:    ${passRate}%`);
    console.log(`⏱️  Duration:     ${this.formatDuration(this.results.summary.duration)}`);
    
    console.log('\n📦 Suite Results:');
    console.log('-'.repeat(50));
    
    for (const [suiteName, suite] of Object.entries(this.results.suites)) {
      const suitePassRate = suite.total > 0 ? ((suite.passed / suite.total) * 100).toFixed(1) : 0;
      const status = suite.failed === 0 ? '✅' : '❌';
      
      console.log(`${status} ${suiteName.padEnd(15)} ${suite.passed}/${suite.total} (${suitePassRate}%) - ${this.formatDuration(suite.duration)}`);
      
      if (suite.error) {
        console.log(`   ⚠️  Error: ${suite.error}`);
      }
    }
    
    if (this.results.summary.failed > 0) {
      console.log('\n❌ Test execution completed with failures');
      console.log('Check the detailed reports for more information');
    } else {
      console.log('\n🎉 All tests passed successfully!');
    }
  }

  formatDuration(milliseconds) {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    } else if (milliseconds < 60000) {
      return `${(milliseconds / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(milliseconds / 60000);
      const seconds = Math.floor((milliseconds % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
  }

  async run() {
    try {
      console.log('🧠 Flash Cards E2E Test Runner\n');
      
      const options = await this.parseArguments();
      console.log('Configuration loaded successfully ✅');
      
      const suiteTests = await this.discoverTests(options.suites);
      const totalTestFiles = Object.values(suiteTests).reduce((sum, suite) => sum + suite.count, 0);
      
      if (totalTestFiles === 0) {
        console.log('❌ No test files found for the specified suites');
        process.exit(1);
      }
      
      console.log(`\n📊 Test Discovery Complete:`);
      console.log(`   Suites: ${Object.keys(suiteTests).length}`);
      console.log(`   Files: ${totalTestFiles}`);
      console.log(`   Browsers: ${options.browsers.length}`);
      
      await this.ensureOutputDirectory(options.outputDir);
      
      const results = await this.runPlaywrightTests(suiteTests, options);
      
      await this.generateReports(options);
      
      // Exit with appropriate code
      const hasFailures = Object.values(results).some(suite => suite.failed > 0);
      process.exit(hasFailures ? 1 : 0);
      
    } catch (error) {
      console.error('\n💥 Test runner failed:', error.message);
      
      if (options?.debug) {
        console.error('\n📋 Stack trace:');
        console.error(error.stack);
      }
      
      process.exit(1);
    }
  }
}

// Run the test runner if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new TestRunner();
  runner.run();
}

export default TestRunner;