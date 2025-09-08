#!/usr/bin/env node

/**
 * Visual Comparison Tool - Advanced screenshot comparison and management
 * 
 * Features:
 * - Baseline screenshot management
 * - Cross-browser comparison
 * - Diff visualization and reporting
 * - Automated baseline updates
 * - CI/CD integration support
 */

const fs = require('fs').promises;
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');

class VisualComparisonTool {
  constructor(options = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.baselinesDir = options.baselinesDir || path.join(this.rootDir, 'tests/visual-baselines');
    this.resultsDir = options.resultsDir || path.join(this.rootDir, 'tests/visual-results');
    this.diffsDir = options.diffsDir || path.join(this.rootDir, 'tests/visual-diffs');
    this.threshold = options.threshold || 0.1;
    this.browsers = options.browsers || ['chromium', 'firefox', 'webkit'];
  }

  async initialize() {
    await this.ensureDirectories();
    console.log('Visual comparison tool initialized');
  }

  async ensureDirectories() {
    const dirs = [
      this.baselinesDir,
      this.resultsDir,
      this.diffsDir,
      ...this.browsers.map(browser => path.join(this.baselinesDir, browser)),
      ...this.browsers.map(browser => path.join(this.resultsDir, browser)),
      ...this.browsers.map(browser => path.join(this.diffsDir, browser))
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async compareScreenshot(testName, browser, options = {}) {
    const baselinePath = path.join(this.baselinesDir, browser, `${testName}.png`);
    const resultPath = path.join(this.resultsDir, browser, `${testName}.png`);
    const diffPath = path.join(this.diffsDir, browser, `${testName}.png`);

    try {
      // Check if baseline exists
      await fs.access(baselinePath);
    } catch (error) {
      console.warn(`Baseline not found for ${testName} (${browser}). Creating new baseline.`);
      await this.createBaseline(testName, browser);
      return { status: 'baseline_created', diff: 0 };
    }

    try {
      // Check if result exists
      await fs.access(resultPath);
    } catch (error) {
      console.error(`Result screenshot not found: ${resultPath}`);
      return { status: 'error', message: 'Result screenshot not found' };
    }

    // Load images
    const baseline = PNG.sync.read(await fs.readFile(baselinePath));
    const result = PNG.sync.read(await fs.readFile(resultPath));

    // Check dimensions match
    if (baseline.width !== result.width || baseline.height !== result.height) {
      console.error(`Dimension mismatch for ${testName} (${browser})`);
      return {
        status: 'dimension_mismatch',
        baseline: { width: baseline.width, height: baseline.height },
        result: { width: result.width, height: result.height }
      };
    }

    // Create diff image
    const diff = new PNG({ width: baseline.width, height: baseline.height });

    // Compare pixels
    const pixelDiff = pixelmatch(
      baseline.data,
      result.data,
      diff.data,
      baseline.width,
      baseline.height,
      {
        threshold: options.threshold || this.threshold,
        alpha: 0.1,
        antialiasing: true,
        diffColor: [255, 0, 0], // Red for differences
        diffColorAlt: [0, 255, 0] // Green for anti-aliasing
      }
    );

    // Save diff image
    await fs.writeFile(diffPath, PNG.sync.write(diff));

    // Calculate difference percentage
    const totalPixels = baseline.width * baseline.height;
    const diffPercentage = (pixelDiff / totalPixels) * 100;

    const comparisonResult = {
      status: diffPercentage <= this.threshold ? 'passed' : 'failed',
      pixelDiff: pixelDiff,
      totalPixels: totalPixels,
      diffPercentage: diffPercentage.toFixed(4),
      threshold: this.threshold,
      diffPath: diffPath
    };

    console.log(`${testName} (${browser}): ${comparisonResult.status.toUpperCase()} - ${comparisonResult.diffPercentage}% difference`);

    return comparisonResult;
  }

  async createBaseline(testName, browser) {
    const resultPath = path.join(this.resultsDir, browser, `${testName}.png`);
    const baselinePath = path.join(this.baselinesDir, browser, `${testName}.png`);

    try {
      await fs.copyFile(resultPath, baselinePath);
      console.log(`Created baseline: ${baselinePath}`);
    } catch (error) {
      console.error(`Failed to create baseline for ${testName} (${browser}):`, error.message);
    }
  }

  async updateBaseline(testName, browser) {
    const resultPath = path.join(this.resultsDir, browser, `${testName}.png`);
    const baselinePath = path.join(this.baselinesDir, browser, `${testName}.png`);

    try {
      await fs.copyFile(resultPath, baselinePath);
      console.log(`Updated baseline: ${baselinePath}`);
    } catch (error) {
      console.error(`Failed to update baseline for ${testName} (${browser}):`, error.message);
    }
  }

  async compareAllScreenshots() {
    const results = {};

    for (const browser of this.browsers) {
      const resultsPath = path.join(this.resultsDir, browser);
      
      try {
        const screenshots = await fs.readdir(resultsPath);
        results[browser] = {};

        for (const screenshot of screenshots) {
          if (screenshot.endsWith('.png')) {
            const testName = screenshot.replace('.png', '');
            const comparison = await this.compareScreenshot(testName, browser);
            results[browser][testName] = comparison;
          }
        }
      } catch (error) {
        console.warn(`No results found for browser: ${browser}`);
        results[browser] = {};
      }
    }

    return results;
  }

  async generateReport(results) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        baselineCreated: 0,
        errors: 0
      },
      browsers: {},
      failures: []
    };

    // Process results
    for (const [browser, browserResults] of Object.entries(results)) {
      report.browsers[browser] = {
        totalTests: Object.keys(browserResults).length,
        passed: 0,
        failed: 0,
        baselineCreated: 0,
        errors: 0,
        tests: browserResults
      };

      for (const [testName, result] of Object.entries(browserResults)) {
        report.summary.totalTests++;
        report.browsers[browser].totalTests++;

        switch (result.status) {
          case 'passed':
            report.summary.passed++;
            report.browsers[browser].passed++;
            break;
          case 'failed':
            report.summary.failed++;
            report.browsers[browser].failed++;
            report.failures.push({
              test: testName,
              browser: browser,
              diffPercentage: result.diffPercentage,
              diffPath: result.diffPath
            });
            break;
          case 'baseline_created':
            report.summary.baselineCreated++;
            report.browsers[browser].baselineCreated++;
            break;
          case 'error':
          case 'dimension_mismatch':
            report.summary.errors++;
            report.browsers[browser].errors++;
            report.failures.push({
              test: testName,
              browser: browser,
              error: result.message || result.status
            });
            break;
        }
      }
    }

    return report;
  }

  async generateHtmlReport(report) {
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Visual Regression Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 1px solid #ddd; padding-bottom: 20px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .count { font-size: 2em; font-weight: bold; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .created { color: #007bff; }
        .errors { color: #ffc107; }
        .browsers { margin-top: 30px; }
        .browser { margin-bottom: 30px; border: 1px solid #ddd; border-radius: 8px; padding: 20px; }
        .browser h2 { margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
        .status { padding: 4px 8px; border-radius: 4px; color: white; font-size: 0.8em; }
        .status.passed { background-color: #28a745; }
        .status.failed { background-color: #dc3545; }
        .status.created { background-color: #007bff; }
        .status.error { background-color: #ffc107; color: #000; }
        .diff-image { max-width: 200px; max-height: 150px; }
        .failures { margin-top: 30px; }
        .failure { background: #f8f9fa; border-left: 4px solid #dc3545; padding: 15px; margin-bottom: 15px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Visual Regression Test Report</h1>
        <p>Generated: ${report.timestamp}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>Total Tests</h3>
            <div class="count">${report.summary.totalTests}</div>
        </div>
        <div class="metric">
            <h3>Passed</h3>
            <div class="count passed">${report.summary.passed}</div>
        </div>
        <div class="metric">
            <h3>Failed</h3>
            <div class="count failed">${report.summary.failed}</div>
        </div>
        <div class="metric">
            <h3>Baselines Created</h3>
            <div class="count created">${report.summary.baselineCreated}</div>
        </div>
        <div class="metric">
            <h3>Errors</h3>
            <div class="count errors">${report.summary.errors}</div>
        </div>
    </div>

    <div class="browsers">
        <h2>Browser Results</h2>
        ${Object.entries(report.browsers).map(([browser, data]) => `
        <div class="browser">
            <h2>${browser.charAt(0).toUpperCase() + browser.slice(1)}</h2>
            <p>Tests: ${data.totalTests} | Passed: ${data.passed} | Failed: ${data.failed} | Created: ${data.baselineCreated} | Errors: ${data.errors}</p>
            <table>
                <tr>
                    <th>Test Name</th>
                    <th>Status</th>
                    <th>Difference</th>
                    <th>Action</th>
                </tr>
                ${Object.entries(data.tests).map(([testName, result]) => `
                <tr>
                    <td>${testName}</td>
                    <td><span class="status ${result.status}">${result.status.toUpperCase()}</span></td>
                    <td>${result.diffPercentage ? result.diffPercentage + '%' : '-'}</td>
                    <td>
                        ${result.diffPath ? `<a href="${path.relative(this.rootDir, result.diffPath)}" target="_blank">View Diff</a>` : '-'}
                    </td>
                </tr>
                `).join('')}
            </table>
        </div>
        `).join('')}
    </div>

    ${report.failures.length > 0 ? `
    <div class="failures">
        <h2>Failures (${report.failures.length})</h2>
        ${report.failures.map(failure => `
        <div class="failure">
            <h4>${failure.test} (${failure.browser})</h4>
            ${failure.diffPercentage ? `<p>Difference: ${failure.diffPercentage}%</p>` : ''}
            ${failure.error ? `<p>Error: ${failure.error}</p>` : ''}
            ${failure.diffPath ? `<p><a href="${path.relative(this.rootDir, failure.diffPath)}" target="_blank">View Diff Image</a></p>` : ''}
        </div>
        `).join('')}
    </div>
    ` : ''}
</body>
</html>`;

    const reportPath = path.join(this.rootDir, 'visual-regression-report.html');
    await fs.writeFile(reportPath, html);
    console.log(`HTML report generated: ${reportPath}`);

    return reportPath;
  }

  async cleanupOldResults(daysOld = 7) {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    const directories = [this.resultsDir, this.diffsDir];

    for (const directory of directories) {
      for (const browser of this.browsers) {
        const browserDir = path.join(directory, browser);
        
        try {
          const files = await fs.readdir(browserDir);
          
          for (const file of files) {
            const filePath = path.join(browserDir, file);
            const stats = await fs.stat(filePath);
            
            if (stats.mtime.getTime() < cutoffTime) {
              await fs.unlink(filePath);
              cleanedCount++;
            }
          }
        } catch (error) {
          // Directory might not exist
        }
      }
    }

    console.log(`Cleaned up ${cleanedCount} old visual test files`);
    return cleanedCount;
  }

  async listBaselines() {
    const baselines = {};

    for (const browser of this.browsers) {
      const browserDir = path.join(this.baselinesDir, browser);
      baselines[browser] = [];

      try {
        const files = await fs.readdir(browserDir);
        for (const file of files) {
          if (file.endsWith('.png')) {
            const stats = await fs.stat(path.join(browserDir, file));
            baselines[browser].push({
              name: file.replace('.png', ''),
              created: stats.ctime,
              modified: stats.mtime,
              size: stats.size
            });
          }
        }
      } catch (error) {
        // Directory might not exist
      }
    }

    return baselines;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Visual Comparison Tool

Usage: node visual-comparison.js <command> [options]

Commands:
  compare               Compare all screenshots
  compare-test <name>   Compare specific test
  create-baseline <test> <browser>  Create baseline for test
  update-baseline <test> <browser>  Update baseline for test
  update-all-baselines  Update all baselines from results
  list-baselines        List all baseline screenshots
  cleanup               Clean up old result files
  report                Generate comparison report

Options:
  --threshold=N         Pixel difference threshold (default: 0.1)
  --browsers=list       Comma-separated browser list
  --days=N             Days old for cleanup (default: 7)

Examples:
  node visual-comparison.js compare
  node visual-comparison.js compare-test login-page
  node visual-comparison.js create-baseline login-page chromium
  node visual-comparison.js cleanup --days=3
    `);
    return;
  }

  const command = args[0];
  const options = {};

  // Parse options
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      options[key] = value || true;
    }
  }

  // Configure tool
  const toolOptions = {};
  if (options.threshold) toolOptions.threshold = parseFloat(options.threshold);
  if (options.browsers) toolOptions.browsers = options.browsers.split(',');

  const tool = new VisualComparisonTool(toolOptions);
  await tool.initialize();

  try {
    switch (command) {
      case 'compare':
        const results = await tool.compareAllScreenshots();
        const report = await tool.generateReport(results);
        await tool.generateHtmlReport(report);
        console.log(`\nSummary: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.baselineCreated} baselines created`);
        process.exit(report.summary.failed > 0 ? 1 : 0);
        break;

      case 'compare-test':
        if (args[1]) {
          const testName = args[1];
          for (const browser of tool.browsers) {
            await tool.compareScreenshot(testName, browser);
          }
        } else {
          console.error('Test name required');
        }
        break;

      case 'create-baseline':
        if (args[1] && args[2]) {
          await tool.createBaseline(args[1], args[2]);
        } else {
          console.error('Test name and browser required');
        }
        break;

      case 'update-baseline':
        if (args[1] && args[2]) {
          await tool.updateBaseline(args[1], args[2]);
        } else {
          console.error('Test name and browser required');
        }
        break;

      case 'update-all-baselines':
        const allResults = await tool.compareAllScreenshots();
        for (const [browser, browserResults] of Object.entries(allResults)) {
          for (const testName of Object.keys(browserResults)) {
            await tool.updateBaseline(testName, browser);
          }
        }
        break;

      case 'list-baselines':
        const baselines = await tool.listBaselines();
        console.log(JSON.stringify(baselines, null, 2));
        break;

      case 'cleanup':
        const days = parseInt(options.days) || 7;
        await tool.cleanupOldResults(days);
        break;

      case 'report':
        const reportResults = await tool.compareAllScreenshots();
        const reportData = await tool.generateReport(reportResults);
        await tool.generateHtmlReport(reportData);
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

// Install required dependencies check
const requiredPackages = ['pngjs', 'pixelmatch'];
const missingPackages = [];

for (const pkg of requiredPackages) {
  try {
    require.resolve(pkg);
  } catch (error) {
    missingPackages.push(pkg);
  }
}

if (missingPackages.length > 0) {
  console.warn(`Missing required packages: ${missingPackages.join(', ')}`);
  console.warn(`Install with: npm install ${missingPackages.join(' ')}`);
}

// Run CLI if executed directly
if (require.main === module) {
  main();
}

module.exports = VisualComparisonTool;