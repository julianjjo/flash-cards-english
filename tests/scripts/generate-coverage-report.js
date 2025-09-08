#!/usr/bin/env node

/**
 * Coverage Report Generator - Comprehensive test coverage analysis
 * 
 * Features:
 * - Multi-project coverage aggregation
 * - HTML and JSON report generation
 * - Coverage trend analysis
 * - Threshold validation
 * - CI/CD integration
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class CoverageReportGenerator {
  constructor(options = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.outputDir = options.outputDir || path.join(this.rootDir, 'coverage');
    this.thresholds = options.thresholds || {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90
    };
    this.projects = options.projects || ['backend', 'frontend', 'e2e'];
  }

  async initialize() {
    await this.ensureOutputDirectory();
    console.log('Coverage report generator initialized');
  }

  async ensureOutputDirectory() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      await fs.mkdir(path.join(this.outputDir, 'html'), { recursive: true });
      await fs.mkdir(path.join(this.outputDir, 'json'), { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create output directory: ${error.message}`);
    }
  }

  async generateCoverage() {
    console.log('Generating comprehensive coverage report...');

    const coverageData = {
      timestamp: new Date().toISOString(),
      projects: {},
      summary: {},
      thresholds: this.thresholds,
      passed: true
    };

    // Generate coverage for each project
    for (const project of this.projects) {
      console.log(`Generating coverage for ${project}...`);
      
      try {
        const projectCoverage = await this.generateProjectCoverage(project);
        coverageData.projects[project] = projectCoverage;
      } catch (error) {
        console.error(`Failed to generate coverage for ${project}:`, error.message);
        coverageData.projects[project] = {
          error: error.message,
          coverage: null
        };
      }
    }

    // Calculate summary
    coverageData.summary = this.calculateSummary(coverageData.projects);
    
    // Validate thresholds
    coverageData.passed = this.validateThresholds(coverageData.summary);

    // Generate reports
    await this.generateReports(coverageData);

    return coverageData;
  }

  async generateProjectCoverage(project) {
    const configMap = {
      backend: 'jest.config.backend.js',
      frontend: 'jest.config.frontend.js',
      e2e: 'jest.config.e2e.js'
    };

    const configFile = configMap[project];
    if (!configFile) {
      throw new Error(`Unknown project: ${project}`);
    }

    const configPath = path.join(this.rootDir, configFile);
    
    try {
      // Check if config exists
      await fs.access(configPath);
    } catch (error) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    // Run Jest with coverage
    const command = `npx jest --config=${configFile} --coverage --coverageReporters=json --coverageReporters=html --silent`;
    
    try {
      console.log(`Running: ${command}`);
      execSync(command, { 
        cwd: this.rootDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Read coverage data
      const coverageJsonPath = path.join(this.rootDir, 'coverage', 'coverage-final.json');
      const coverageJson = JSON.parse(await fs.readFile(coverageJsonPath, 'utf8'));

      // Move coverage files to project-specific directory
      await this.moveProjectCoverage(project);

      return this.parseCoverageData(coverageJson);
    } catch (error) {
      console.error(`Coverage generation failed for ${project}:`, error.message);
      return {
        error: error.message,
        coverage: null
      };
    }
  }

  async moveProjectCoverage(project) {
    const sourceCoverageDir = path.join(this.rootDir, 'coverage');
    const targetCoverageDir = path.join(this.outputDir, project);

    try {
      await fs.mkdir(targetCoverageDir, { recursive: true });

      // Move HTML report
      try {
        await fs.rename(
          path.join(sourceCoverageDir, 'lcov-report'),
          path.join(targetCoverageDir, 'html')
        );
      } catch (error) {
        // Directory might not exist
      }

      // Copy JSON report
      try {
        const jsonData = await fs.readFile(path.join(sourceCoverageDir, 'coverage-final.json'), 'utf8');
        await fs.writeFile(path.join(targetCoverageDir, 'coverage.json'), jsonData);
      } catch (error) {
        // File might not exist
      }

      // Copy LCOV report
      try {
        const lcovData = await fs.readFile(path.join(sourceCoverageDir, 'lcov.info'), 'utf8');
        await fs.writeFile(path.join(targetCoverageDir, 'lcov.info'), lcovData);
      } catch (error) {
        // File might not exist
      }

    } catch (error) {
      console.warn(`Failed to move coverage files for ${project}:`, error.message);
    }
  }

  parseCoverageData(coverageJson) {
    let totalStatements = 0;
    let coveredStatements = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalLines = 0;
    let coveredLines = 0;

    const files = {};

    for (const [filePath, fileData] of Object.entries(coverageJson)) {
      // Statements
      const statements = fileData.s || {};
      const statementTotal = Object.keys(statements).length;
      const statementCovered = Object.values(statements).filter(count => count > 0).length;
      
      // Branches
      const branches = fileData.b || {};
      let branchTotal = 0;
      let branchCovered = 0;
      for (const branchArray of Object.values(branches)) {
        branchTotal += branchArray.length;
        branchCovered += branchArray.filter(count => count > 0).length;
      }

      // Functions
      const functions = fileData.f || {};
      const functionTotal = Object.keys(functions).length;
      const functionCovered = Object.values(functions).filter(count => count > 0).length;

      // Lines
      const lines = fileData.l || {};
      const lineTotal = Object.keys(lines).length;
      const lineCovered = Object.values(lines).filter(count => count > 0).length;

      totalStatements += statementTotal;
      coveredStatements += statementCovered;
      totalBranches += branchTotal;
      coveredBranches += branchCovered;
      totalFunctions += functionTotal;
      coveredFunctions += functionCovered;
      totalLines += lineTotal;
      coveredLines += lineCovered;

      files[filePath] = {
        statements: {
          total: statementTotal,
          covered: statementCovered,
          percentage: statementTotal > 0 ? (statementCovered / statementTotal * 100).toFixed(2) : '0.00'
        },
        branches: {
          total: branchTotal,
          covered: branchCovered,
          percentage: branchTotal > 0 ? (branchCovered / branchTotal * 100).toFixed(2) : '0.00'
        },
        functions: {
          total: functionTotal,
          covered: functionCovered,
          percentage: functionTotal > 0 ? (functionCovered / functionTotal * 100).toFixed(2) : '0.00'
        },
        lines: {
          total: lineTotal,
          covered: lineCovered,
          percentage: lineTotal > 0 ? (lineCovered / lineTotal * 100).toFixed(2) : '0.00'
        }
      };
    }

    return {
      summary: {
        statements: {
          total: totalStatements,
          covered: coveredStatements,
          percentage: totalStatements > 0 ? (coveredStatements / totalStatements * 100).toFixed(2) : '0.00'
        },
        branches: {
          total: totalBranches,
          covered: coveredBranches,
          percentage: totalBranches > 0 ? (coveredBranches / totalBranches * 100).toFixed(2) : '0.00'
        },
        functions: {
          total: totalFunctions,
          covered: coveredFunctions,
          percentage: totalFunctions > 0 ? (coveredFunctions / totalFunctions * 100).toFixed(2) : '0.00'
        },
        lines: {
          total: totalLines,
          covered: coveredLines,
          percentage: totalLines > 0 ? (coveredLines / totalLines * 100).toFixed(2) : '0.00'
        }
      },
      files: files,
      fileCount: Object.keys(files).length
    };
  }

  calculateSummary(projects) {
    let totalStatements = 0;
    let coveredStatements = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalLines = 0;
    let coveredLines = 0;
    let totalFiles = 0;

    for (const [projectName, projectData] of Object.entries(projects)) {
      if (projectData.error || !projectData.summary) {
        continue;
      }

      const summary = projectData.summary;
      totalStatements += summary.statements.total;
      coveredStatements += summary.statements.covered;
      totalBranches += summary.branches.total;
      coveredBranches += summary.branches.covered;
      totalFunctions += summary.functions.total;
      coveredFunctions += summary.functions.covered;
      totalLines += summary.lines.total;
      coveredLines += summary.lines.covered;
      totalFiles += projectData.fileCount || 0;
    }

    return {
      statements: {
        total: totalStatements,
        covered: coveredStatements,
        percentage: totalStatements > 0 ? (coveredStatements / totalStatements * 100).toFixed(2) : '0.00'
      },
      branches: {
        total: totalBranches,
        covered: coveredBranches,
        percentage: totalBranches > 0 ? (coveredBranches / totalBranches * 100).toFixed(2) : '0.00'
      },
      functions: {
        total: totalFunctions,
        covered: coveredFunctions,
        percentage: totalFunctions > 0 ? (coveredFunctions / totalFunctions * 100).toFixed(2) : '0.00'
      },
      lines: {
        total: totalLines,
        covered: coveredLines,
        percentage: totalLines > 0 ? (coveredLines / totalLines * 100).toFixed(2) : '0.00'
      },
      totalFiles: totalFiles
    };
  }

  validateThresholds(summary) {
    const results = {};
    let allPassed = true;

    for (const [metric, threshold] of Object.entries(this.thresholds)) {
      const percentage = parseFloat(summary[metric].percentage);
      const passed = percentage >= threshold;
      
      results[metric] = {
        percentage: percentage,
        threshold: threshold,
        passed: passed,
        difference: (percentage - threshold).toFixed(2)
      };

      if (!passed) {
        allPassed = false;
      }
    }

    return {
      passed: allPassed,
      results: results
    };
  }

  async generateReports(coverageData) {
    console.log('Generating coverage reports...');

    // JSON Report
    await this.generateJsonReport(coverageData);

    // HTML Report
    await this.generateHtmlReport(coverageData);

    // Console Report
    this.generateConsoleReport(coverageData);

    // Badge Generation
    await this.generateBadges(coverageData);

    console.log(`Coverage reports generated in: ${this.outputDir}`);
  }

  async generateJsonReport(coverageData) {
    const jsonPath = path.join(this.outputDir, 'coverage-summary.json');
    await fs.writeFile(jsonPath, JSON.stringify(coverageData, null, 2));
    console.log(`JSON report saved: ${jsonPath}`);
  }

  async generateHtmlReport(coverageData) {
    const htmlContent = this.generateHtmlContent(coverageData);
    const htmlPath = path.join(this.outputDir, 'index.html');
    await fs.writeFile(htmlPath, htmlContent);
    console.log(`HTML report saved: ${htmlPath}`);
  }

  generateHtmlContent(coverageData) {
    const { summary, projects, thresholds, passed } = coverageData;

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Test Coverage Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 1px solid #ddd; padding-bottom: 20px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .percentage { font-size: 2em; font-weight: bold; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .projects { margin-top: 30px; }
        .project { margin-bottom: 30px; border: 1px solid #ddd; border-radius: 8px; padding: 20px; }
        .project h2 { margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
        .status { padding: 4px 8px; border-radius: 4px; color: white; font-size: 0.8em; }
        .status.pass { background-color: #28a745; }
        .status.fail { background-color: #dc3545; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Flash Cards Application - Test Coverage Report</h1>
        <p>Generated: ${coverageData.timestamp}</p>
        <p>Status: <span class="status ${passed.passed ? 'pass' : 'fail'}">${passed.passed ? 'PASSED' : 'FAILED'}</span></p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>Statements</h3>
            <div class="percentage ${parseFloat(summary.statements.percentage) >= thresholds.statements ? 'passed' : 'failed'}">
                ${summary.statements.percentage}%
            </div>
            <div>${summary.statements.covered} / ${summary.statements.total}</div>
        </div>
        <div class="metric">
            <h3>Branches</h3>
            <div class="percentage ${parseFloat(summary.branches.percentage) >= thresholds.branches ? 'passed' : 'failed'}">
                ${summary.branches.percentage}%
            </div>
            <div>${summary.branches.covered} / ${summary.branches.total}</div>
        </div>
        <div class="metric">
            <h3>Functions</h3>
            <div class="percentage ${parseFloat(summary.functions.percentage) >= thresholds.functions ? 'passed' : 'failed'}">
                ${summary.functions.percentage}%
            </div>
            <div>${summary.functions.covered} / ${summary.functions.total}</div>
        </div>
        <div class="metric">
            <h3>Lines</h3>
            <div class="percentage ${parseFloat(summary.lines.percentage) >= thresholds.lines ? 'passed' : 'failed'}">
                ${summary.lines.percentage}%
            </div>
            <div>${summary.lines.covered} / ${summary.lines.total}</div>
        </div>
    </div>

    <div class="projects">
        <h2>Project Coverage</h2>
        ${Object.entries(projects).map(([name, data]) => `
        <div class="project">
            <h2>${name.charAt(0).toUpperCase() + name.slice(1)} Project</h2>
            ${data.error ? `
            <p style="color: #dc3545;">Error: ${data.error}</p>
            ` : `
            <table>
                <tr>
                    <th>Metric</th>
                    <th>Coverage</th>
                    <th>Total</th>
                    <th>Covered</th>
                    <th>Status</th>
                </tr>
                <tr>
                    <td>Statements</td>
                    <td>${data.summary.statements.percentage}%</td>
                    <td>${data.summary.statements.total}</td>
                    <td>${data.summary.statements.covered}</td>
                    <td><span class="status ${parseFloat(data.summary.statements.percentage) >= thresholds.statements ? 'pass' : 'fail'}">
                        ${parseFloat(data.summary.statements.percentage) >= thresholds.statements ? 'PASS' : 'FAIL'}
                    </span></td>
                </tr>
                <tr>
                    <td>Branches</td>
                    <td>${data.summary.branches.percentage}%</td>
                    <td>${data.summary.branches.total}</td>
                    <td>${data.summary.branches.covered}</td>
                    <td><span class="status ${parseFloat(data.summary.branches.percentage) >= thresholds.branches ? 'pass' : 'fail'}">
                        ${parseFloat(data.summary.branches.percentage) >= thresholds.branches ? 'PASS' : 'FAIL'}
                    </span></td>
                </tr>
                <tr>
                    <td>Functions</td>
                    <td>${data.summary.functions.percentage}%</td>
                    <td>${data.summary.functions.total}</td>
                    <td>${data.summary.functions.covered}</td>
                    <td><span class="status ${parseFloat(data.summary.functions.percentage) >= thresholds.functions ? 'pass' : 'fail'}">
                        ${parseFloat(data.summary.functions.percentage) >= thresholds.functions ? 'PASS' : 'FAIL'}
                    </span></td>
                </tr>
                <tr>
                    <td>Lines</td>
                    <td>${data.summary.lines.percentage}%</td>
                    <td>${data.summary.lines.total}</td>
                    <td>${data.summary.lines.covered}</td>
                    <td><span class="status ${parseFloat(data.summary.lines.percentage) >= thresholds.lines ? 'pass' : 'fail'}">
                        ${parseFloat(data.summary.lines.percentage) >= thresholds.lines ? 'PASS' : 'FAIL'}
                    </span></td>
                </tr>
            </table>
            <p><strong>Files:</strong> ${data.fileCount || 0}</p>
            <p><a href="${name}/html/index.html">View detailed ${name} coverage report</a></p>
            `}
        </div>
        `).join('')}
    </div>

    <div class="thresholds">
        <h2>Coverage Thresholds</h2>
        <table>
            <tr>
                <th>Metric</th>
                <th>Threshold</th>
                <th>Current</th>
                <th>Difference</th>
                <th>Status</th>
            </tr>
            ${Object.entries(passed.results).map(([metric, result]) => `
            <tr>
                <td>${metric.charAt(0).toUpperCase() + metric.slice(1)}</td>
                <td>${result.threshold}%</td>
                <td>${result.percentage}%</td>
                <td>${result.difference > 0 ? '+' : ''}${result.difference}%</td>
                <td><span class="status ${result.passed ? 'pass' : 'fail'}">
                    ${result.passed ? 'PASS' : 'FAIL'}
                </span></td>
            </tr>
            `).join('')}
        </table>
    </div>
</body>
</html>`;
  }

  generateConsoleReport(coverageData) {
    const { summary, passed } = coverageData;

    console.log('\n=== COVERAGE REPORT ===');
    console.log(`Generated: ${coverageData.timestamp}`);
    console.log(`Overall Status: ${passed.passed ? '✅ PASSED' : '❌ FAILED'}`);
    
    console.log('\nSummary:');
    console.log(`  Statements: ${summary.statements.percentage}% (${summary.statements.covered}/${summary.statements.total})`);
    console.log(`  Branches:   ${summary.branches.percentage}% (${summary.branches.covered}/${summary.branches.total})`);
    console.log(`  Functions:  ${summary.functions.percentage}% (${summary.functions.covered}/${summary.functions.total})`);
    console.log(`  Lines:      ${summary.lines.percentage}% (${summary.lines.covered}/${summary.lines.total})`);
    
    console.log('\nThreshold Results:');
    for (const [metric, result] of Object.entries(passed.results)) {
      const status = result.passed ? '✅' : '❌';
      const diff = result.difference > 0 ? `+${result.difference}` : result.difference;
      console.log(`  ${metric.padEnd(10)}: ${status} ${result.percentage}% (threshold: ${result.threshold}%, diff: ${diff}%)`);
    }

    console.log('\nProject Coverage:');
    for (const [name, data] of Object.entries(coverageData.projects)) {
      if (data.error) {
        console.log(`  ${name}: ❌ ERROR - ${data.error}`);
      } else {
        console.log(`  ${name}: ${data.summary.statements.percentage}% statements, ${data.fileCount || 0} files`);
      }
    }

    console.log(`\nDetailed reports available in: ${this.outputDir}`);
  }

  async generateBadges(coverageData) {
    const badges = {};
    const { summary } = coverageData;

    // Generate badge URLs (shields.io style)
    for (const [metric, data] of Object.entries(summary)) {
      if (metric === 'totalFiles') continue;

      const percentage = parseFloat(data.percentage);
      const color = percentage >= 90 ? 'brightgreen' : 
                   percentage >= 80 ? 'green' :
                   percentage >= 70 ? 'yellow' :
                   percentage >= 60 ? 'orange' : 'red';

      badges[metric] = {
        url: `https://img.shields.io/badge/coverage-${percentage}%25-${color}`,
        markdown: `![Coverage ${metric}](https://img.shields.io/badge/coverage-${percentage}%25-${color})`,
        percentage: percentage,
        color: color
      };
    }

    // Save badges data
    const badgesPath = path.join(this.outputDir, 'badges.json');
    await fs.writeFile(badgesPath, JSON.stringify(badges, null, 2));

    console.log(`Coverage badges generated: ${badgesPath}`);
  }
}

// CLI Entry Point
async function main() {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      options[key] = value || true;
    }
  }

  if (args.includes('--help')) {
    console.log(`
Coverage Report Generator

Usage: node generate-coverage-report.js [options]

Options:
  --help                Show this help message
  --output-dir=DIR     Output directory for reports (default: ./coverage)
  --projects=LIST      Comma-separated list of projects (default: backend,frontend,e2e)
  --threshold-statements=N  Statements threshold (default: 90)
  --threshold-branches=N    Branches threshold (default: 85)
  --threshold-functions=N   Functions threshold (default: 90)
  --threshold-lines=N       Lines threshold (default: 90)

Examples:
  node generate-coverage-report.js
  node generate-coverage-report.js --output-dir=./reports
  node generate-coverage-report.js --projects=backend,e2e
  node generate-coverage-report.js --threshold-statements=95
    `);
    return;
  }

  // Configure options
  if (options['output-dir']) {
    options.outputDir = path.resolve(options['output-dir']);
  }

  if (options.projects) {
    options.projects = options.projects.split(',');
  }

  const thresholds = {};
  for (const metric of ['statements', 'branches', 'functions', 'lines']) {
    if (options[`threshold-${metric}`]) {
      thresholds[metric] = parseInt(options[`threshold-${metric}`]);
    }
  }
  if (Object.keys(thresholds).length > 0) {
    options.thresholds = { ...options.thresholds, ...thresholds };
  }

  const generator = new CoverageReportGenerator(options);
  
  try {
    await generator.initialize();
    const result = await generator.generateCoverage();
    
    // Exit with appropriate code
    process.exit(result.passed.passed ? 0 : 1);
  } catch (error) {
    console.error('Coverage generation failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = CoverageReportGenerator;