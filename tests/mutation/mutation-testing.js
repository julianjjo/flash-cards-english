#!/usr/bin/env node

/**
 * Mutation Testing Framework - Code quality validation through mutation analysis
 * 
 * Features:
 * - Automatic code mutation generation
 * - Test suite effectiveness measurement
 * - Mutation score calculation and reporting
 * - Integration with Jest test runner
 * - Advanced mutation operators
 * - Selective mutation testing
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const babel = require('@babel/core');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

class MutationTestingFramework {
  constructor(options = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.sourceDir = options.sourceDir || path.join(this.rootDir, 'server');
    this.testDir = options.testDir || path.join(this.rootDir, 'tests');
    this.outputDir = options.outputDir || path.join(this.rootDir, 'mutation-results');
    this.mutationOperators = options.mutationOperators || this.getDefaultMutationOperators();
    this.threshold = options.threshold || 80; // 80% mutation score threshold
    this.timeoutMultiplier = options.timeoutMultiplier || 2;
    this.maxMutants = options.maxMutants || 100;
    this.excludePatterns = options.excludePatterns || ['node_modules', '.test.', '.spec.'];
  }

  async initialize() {
    await this.ensureOutputDirectory();
    console.log('Mutation testing framework initialized');
  }

  async ensureOutputDirectory() {
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'mutants'), { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'reports'), { recursive: true });
  }

  getDefaultMutationOperators() {
    return {
      // Arithmetic operators
      arithmetic: {
        '+': ['-', '*', '/', '%'],
        '-': ['+', '*', '/', '%'],
        '*': ['+', '-', '/', '%'],
        '/': ['+', '-', '*', '%'],
        '%': ['+', '-', '*', '/']
      },
      
      // Comparison operators  
      comparison: {
        '==': ['!=', '>', '<', '>=', '<='],
        '!=': ['==', '>', '<', '>=', '<='],
        '>': ['<', '>=', '<=', '==', '!='],
        '<': ['>', '>=', '<=', '==', '!='],
        '>=': ['<', '<=', '>', '==', '!='],
        '<=': ['>', '>=', '<', '==', '!='],
        '===': ['!=='],
        '!==': ['===']
      },

      // Logical operators
      logical: {
        '&&': ['||'],
        '||': ['&&']
      },

      // Unary operators
      unary: {
        '!': [''],
        '-': ['+', ''],
        '+': ['-', '']
      },

      // Assignment operators
      assignment: {
        '=': ['+=', '-=', '*=', '/='],
        '+=': ['=', '-=', '*=', '/='],
        '-=': ['=', '+=', '*=', '/='],
        '*=': ['=', '+=', '-=', '/='],
        '/=': ['=', '+=', '-=', '*=']
      },

      // Literal mutations
      literals: {
        numbers: (value) => [0, 1, -1, value + 1, value - 1],
        strings: (value) => ['', 'mutation', value + 'X'],
        booleans: (value) => [!value]
      }
    };
  }

  async findSourceFiles() {
    const sourceFiles = [];
    
    async function walkDir(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else if (entry.name.endsWith('.js') && !entry.name.includes('test')) {
          sourceFiles.push(fullPath);
        }
      }
    }

    await walkDir(this.sourceDir);
    
    // Filter out excluded patterns
    return sourceFiles.filter(file => {
      return !this.excludePatterns.some(pattern => file.includes(pattern));
    });
  }

  async generateMutants(sourceFile) {
    const code = await fs.readFile(sourceFile, 'utf8');
    const ast = babel.parseSync(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });

    const mutants = [];
    let mutantId = 1;

    // Generate mutations using different operators
    for (const [operatorType, operators] of Object.entries(this.mutationOperators)) {
      const operatorMutants = this.generateOperatorMutants(
        ast, 
        sourceFile, 
        operatorType, 
        operators, 
        mutantId
      );
      
      mutants.push(...operatorMutants);
      mutantId += operatorMutants.length;

      // Respect max mutants limit
      if (mutants.length >= this.maxMutants) {
        break;
      }
    }

    return mutants.slice(0, this.maxMutants);
  }

  generateOperatorMutants(ast, sourceFile, operatorType, operators, startId) {
    const mutants = [];
    let mutantId = startId;

    traverse(ast, {
      BinaryExpression: (path) => {
        if (operatorType === 'arithmetic' || operatorType === 'comparison') {
          const operator = path.node.operator;
          const replacements = operators[operator];
          
          if (replacements) {
            for (const replacement of replacements) {
              const mutant = this.createMutant(
                ast,
                sourceFile,
                mutantId++,
                `${operatorType}_${operator}_to_${replacement}`,
                path,
                () => { path.node.operator = replacement; }
              );
              mutants.push(mutant);
            }
          }
        }
      },

      LogicalExpression: (path) => {
        if (operatorType === 'logical') {
          const operator = path.node.operator;
          const replacements = operators[operator];
          
          if (replacements) {
            for (const replacement of replacements) {
              const mutant = this.createMutant(
                ast,
                sourceFile,
                mutantId++,
                `logical_${operator}_to_${replacement}`,
                path,
                () => { path.node.operator = replacement; }
              );
              mutants.push(mutant);
            }
          }
        }
      },

      UnaryExpression: (path) => {
        if (operatorType === 'unary') {
          const operator = path.node.operator;
          const replacements = operators[operator];
          
          if (replacements) {
            for (const replacement of replacements) {
              const mutant = this.createMutant(
                ast,
                sourceFile,
                mutantId++,
                `unary_${operator}_to_${replacement}`,
                path,
                () => {
                  if (replacement === '') {
                    path.replaceWith(path.node.argument);
                  } else {
                    path.node.operator = replacement;
                  }
                }
              );
              mutants.push(mutant);
            }
          }
        }
      },

      NumericLiteral: (path) => {
        if (operatorType === 'literals') {
          const value = path.node.value;
          const replacements = operators.numbers(value);
          
          for (const replacement of replacements) {
            if (replacement !== value) {
              const mutant = this.createMutant(
                ast,
                sourceFile,
                mutantId++,
                `number_${value}_to_${replacement}`,
                path,
                () => { path.node.value = replacement; }
              );
              mutants.push(mutant);
            }
          }
        }
      },

      StringLiteral: (path) => {
        if (operatorType === 'literals') {
          const value = path.node.value;
          const replacements = operators.strings(value);
          
          for (const replacement of replacements) {
            if (replacement !== value) {
              const mutant = this.createMutant(
                ast,
                sourceFile,
                mutantId++,
                `string_${value.slice(0, 10)}_to_${replacement.slice(0, 10)}`,
                path,
                () => { path.node.value = replacement; }
              );
              mutants.push(mutant);
            }
          }
        }
      },

      BooleanLiteral: (path) => {
        if (operatorType === 'literals') {
          const value = path.node.value;
          const replacements = operators.booleans(value);
          
          for (const replacement of replacements) {
            const mutant = this.createMutant(
              ast,
              sourceFile,
              mutantId++,
              `boolean_${value}_to_${replacement}`,
              path,
              () => { path.node.value = replacement; }
            );
            mutants.push(mutant);
          }
        }
      }
    });

    return mutants;
  }

  createMutant(originalAst, sourceFile, id, description, nodePath, mutationFunction) {
    // Clone the AST
    const mutantAst = babel.parseSync(generate(originalAst).code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });

    // Apply mutation
    let mutationApplied = false;
    traverse(mutantAst, {
      enter(path) {
        if (!mutationApplied && 
            path.node.type === nodePath.node.type &&
            path.node.start === nodePath.node.start) {
          
          try {
            mutationFunction.call({ node: path.node }, path);
            mutationApplied = true;
          } catch (error) {
            // Mutation failed, skip this mutant
            console.warn(`Failed to apply mutation ${id}: ${error.message}`);
          }
        }
      }
    });

    if (!mutationApplied) {
      return null;
    }

    // Generate mutated code
    const mutatedCode = generate(mutantAst).code;

    return {
      id: id,
      sourceFile: sourceFile,
      description: description,
      location: {
        line: nodePath.node.loc ? nodePath.node.loc.start.line : 'unknown',
        column: nodePath.node.loc ? nodePath.node.loc.start.column : 'unknown'
      },
      originalCode: generate(originalAst).code,
      mutatedCode: mutatedCode,
      status: 'pending'
    };
  }

  async runTestsAgainstMutant(mutant) {
    const tempDir = path.join(this.outputDir, 'mutants', `mutant-${mutant.id}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Write mutated code to temporary file
    const tempSourceFile = path.join(tempDir, path.basename(mutant.sourceFile));
    await fs.writeFile(tempSourceFile, mutant.mutatedCode);

    // Copy original file for backup
    const backupFile = mutant.sourceFile + '.backup';
    await fs.copyFile(mutant.sourceFile, backupFile);

    try {
      // Replace original with mutated code
      await fs.writeFile(mutant.sourceFile, mutant.mutatedCode);

      // Run tests
      const testCommand = 'npm run test:back -- --bail --silent';
      const startTime = Date.now();
      
      try {
        execSync(testCommand, {
          cwd: this.rootDir,
          stdio: 'pipe',
          timeout: 30000 * this.timeoutMultiplier
        });
        
        // Tests passed - mutant survived (bad)
        mutant.status = 'survived';
        mutant.executionTime = Date.now() - startTime;
        
      } catch (error) {
        // Tests failed - mutant killed (good)
        mutant.status = 'killed';
        mutant.executionTime = Date.now() - startTime;
        mutant.killedBy = this.extractFailedTest(error.stdout?.toString() || '');
      }

    } catch (error) {
      mutant.status = 'error';
      mutant.error = error.message;
      
    } finally {
      // Restore original file
      await fs.copyFile(backupFile, mutant.sourceFile);
      await fs.unlink(backupFile);
    }

    return mutant;
  }

  extractFailedTest(output) {
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('FAIL') || line.includes('●')) {
        return line.trim();
      }
    }
    return 'Unknown test';
  }

  async runMutationTesting(sourceFiles = null) {
    const filesToTest = sourceFiles || await this.findSourceFiles();
    console.log(`Starting mutation testing on ${filesToTest.length} files...`);

    const results = {
      startTime: new Date().toISOString(),
      files: {},
      summary: {
        totalMutants: 0,
        killedMutants: 0,
        survivedMutants: 0,
        errorMutants: 0,
        mutationScore: 0
      }
    };

    for (const sourceFile of filesToTest) {
      console.log(`Generating mutants for: ${path.relative(this.rootDir, sourceFile)}`);
      
      const mutants = await this.generateMutants(sourceFile);
      console.log(`Generated ${mutants.length} mutants`);

      const fileResults = {
        sourceFile: sourceFile,
        mutants: [],
        killedCount: 0,
        survivedCount: 0,
        errorCount: 0,
        mutationScore: 0
      };

      // Run tests against each mutant
      for (let i = 0; i < mutants.length; i++) {
        const mutant = mutants[i];
        if (mutant === null) continue;

        console.log(`Testing mutant ${i + 1}/${mutants.length}: ${mutant.description}`);
        
        const testedMutant = await this.runTestsAgainstMutant(mutant);
        fileResults.mutants.push(testedMutant);

        switch (testedMutant.status) {
          case 'killed':
            fileResults.killedCount++;
            results.summary.killedMutants++;
            break;
          case 'survived':
            fileResults.survivedCount++;
            results.summary.survivedMutants++;
            console.warn(`⚠️  Mutant survived: ${testedMutant.description} at line ${testedMutant.location.line}`);
            break;
          case 'error':
            fileResults.errorCount++;
            results.summary.errorMutants++;
            break;
        }

        results.summary.totalMutants++;
      }

      // Calculate file mutation score
      const totalValidMutants = fileResults.killedCount + fileResults.survivedCount;
      fileResults.mutationScore = totalValidMutants > 0 ? 
        (fileResults.killedCount / totalValidMutants * 100).toFixed(2) : 0;

      results.files[sourceFile] = fileResults;
      
      console.log(`File ${path.relative(this.rootDir, sourceFile)}: ${fileResults.mutationScore}% mutation score`);
    }

    // Calculate overall mutation score
    const totalValidMutants = results.summary.killedMutants + results.summary.survivedMutants;
    results.summary.mutationScore = totalValidMutants > 0 ?
      (results.summary.killedMutants / totalValidMutants * 100).toFixed(2) : 0;

    results.endTime = new Date().toISOString();
    
    console.log(`\nMutation testing completed:`);
    console.log(`Total mutants: ${results.summary.totalMutants}`);
    console.log(`Killed: ${results.summary.killedMutants}`);
    console.log(`Survived: ${results.summary.survivedMutants}`);
    console.log(`Errors: ${results.summary.errorMutants}`);
    console.log(`Mutation Score: ${results.summary.mutationScore}%`);

    return results;
  }

  async generateReport(results) {
    const reportData = {
      ...results,
      threshold: this.threshold,
      passed: parseFloat(results.summary.mutationScore) >= this.threshold
    };

    // Save JSON report
    const jsonReportPath = path.join(this.outputDir, 'mutation-report.json');
    await fs.writeFile(jsonReportPath, JSON.stringify(reportData, null, 2));

    // Generate HTML report
    const htmlReportPath = await this.generateHtmlReport(reportData);

    // Generate console report
    this.generateConsoleReport(reportData);

    return {
      jsonReport: jsonReportPath,
      htmlReport: htmlReportPath,
      passed: reportData.passed
    };
  }

  async generateHtmlReport(results) {
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Mutation Testing Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 1px solid #ddd; padding-bottom: 20px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .score { font-size: 2em; font-weight: bold; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .files { margin-top: 30px; }
        .file { margin-bottom: 30px; border: 1px solid #ddd; border-radius: 8px; padding: 20px; }
        .file h3 { margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
        .status { padding: 4px 8px; border-radius: 4px; color: white; font-size: 0.8em; }
        .status.killed { background-color: #28a745; }
        .status.survived { background-color: #dc3545; }
        .status.error { background-color: #ffc107; color: #000; }
        .mutant-details { font-family: monospace; font-size: 0.8em; }
        .recommendations { background: #e9ecef; padding: 20px; border-radius: 8px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Mutation Testing Report</h1>
        <p>Generated: ${results.endTime}</p>
        <p>Status: <span class="${results.passed ? 'passed' : 'failed'}">${results.passed ? 'PASSED' : 'FAILED'}</span></p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>Mutation Score</h3>
            <div class="score ${results.passed ? 'passed' : 'failed'}">${results.summary.mutationScore}%</div>
            <div>Threshold: ${results.threshold}%</div>
        </div>
        <div class="metric">
            <h3>Total Mutants</h3>
            <div class="score">${results.summary.totalMutants}</div>
        </div>
        <div class="metric">
            <h3>Killed</h3>
            <div class="score passed">${results.summary.killedMutants}</div>
        </div>
        <div class="metric">
            <h3>Survived</h3>
            <div class="score failed">${results.summary.survivedMutants}</div>
        </div>
    </div>

    <div class="files">
        <h2>File Results</h2>
        ${Object.entries(results.files).map(([filePath, fileData]) => `
        <div class="file">
            <h3>${path.relative(results.files[filePath].sourceFile, filePath)}</h3>
            <p>Mutation Score: <strong${fileData.mutationScore >= results.threshold ? ' class="passed"' : ' class="failed"'}>${fileData.mutationScore}%</strong></p>
            <p>Mutants: ${fileData.mutants.length} | Killed: ${fileData.killedCount} | Survived: ${fileData.survivedCount} | Errors: ${fileData.errorCount}</p>
            
            <table>
                <tr>
                    <th>ID</th>
                    <th>Description</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Execution Time</th>
                </tr>
                ${fileData.mutants.map(mutant => `
                <tr>
                    <td>${mutant.id}</td>
                    <td class="mutant-details">${mutant.description}</td>
                    <td>Line ${mutant.location.line}</td>
                    <td><span class="status ${mutant.status}">${mutant.status.toUpperCase()}</span></td>
                    <td>${mutant.executionTime || 'N/A'}ms</td>
                </tr>
                `).join('')}
            </table>
        </div>
        `).join('')}
    </div>

    ${results.summary.survivedMutants > 0 ? `
    <div class="recommendations">
        <h2>Recommendations</h2>
        <p>Your mutation score is ${results.summary.mutationScore}%. ${results.summary.survivedMutants} mutants survived, indicating potential weaknesses in your test suite.</p>
        <ul>
            <li>Review survived mutants to identify missing test cases</li>
            <li>Add tests that specifically target the mutated code paths</li>
            <li>Consider boundary value testing for numeric mutations</li>
            <li>Ensure all logical branches are properly tested</li>
            <li>Add negative test cases for error conditions</li>
        </ul>
    </div>
    ` : ''}
</body>
</html>`;

    const htmlReportPath = path.join(this.outputDir, 'mutation-report.html');
    await fs.writeFile(htmlReportPath, html);
    
    console.log(`HTML report generated: ${htmlReportPath}`);
    return htmlReportPath;
  }

  generateConsoleReport(results) {
    console.log('\n=== MUTATION TESTING REPORT ===');
    console.log(`Generated: ${results.endTime}`);
    console.log(`Overall Status: ${results.passed ? '✅ PASSED' : '❌ FAILED'}`);
    
    console.log('\nSummary:');
    console.log(`  Mutation Score: ${results.summary.mutationScore}% (threshold: ${results.threshold}%)`);
    console.log(`  Total Mutants: ${results.summary.totalMutants}`);
    console.log(`  Killed: ${results.summary.killedMutants}`);
    console.log(`  Survived: ${results.summary.survivedMutants}`);
    console.log(`  Errors: ${results.summary.errorMutants}`);

    console.log('\nFile Results:');
    for (const [filePath, fileData] of Object.entries(results.files)) {
      const status = fileData.mutationScore >= results.threshold ? '✅' : '❌';
      const relativePath = path.relative(this.rootDir, filePath);
      console.log(`  ${status} ${relativePath}: ${fileData.mutationScore}% (${fileData.killedCount}/${fileData.killedCount + fileData.survivedCount} killed)`);
    }

    if (results.summary.survivedMutants > 0) {
      console.log('\n⚠️  Survived Mutants (Review Required):');
      for (const [filePath, fileData] of Object.entries(results.files)) {
        const survivedMutants = fileData.mutants.filter(m => m.status === 'survived');
        if (survivedMutants.length > 0) {
          const relativePath = path.relative(this.rootDir, filePath);
          console.log(`  ${relativePath}:`);
          survivedMutants.forEach(mutant => {
            console.log(`    - ${mutant.description} (Line ${mutant.location.line})`);
          });
        }
      }
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Mutation Testing Framework

Usage: node mutation-testing.js [options] [files...]

Options:
  --threshold=N         Mutation score threshold (default: 80)
  --max-mutants=N       Maximum mutants per file (default: 100)
  --timeout-multiplier=N Timeout multiplier for tests (default: 2)
  --operators=list      Comma-separated mutation operators
  --help                Show this help message

Examples:
  node mutation-testing.js
  node mutation-testing.js --threshold=90
  node mutation-testing.js server/auth.js
  node mutation-testing.js --max-mutants=50 --operators=arithmetic,logical
    `);
    return;
  }

  const options = {};
  const files = [];

  // Parse arguments
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      
      switch (key) {
        case 'threshold':
          options.threshold = parseInt(value);
          break;
        case 'max-mutants':
          options.maxMutants = parseInt(value);
          break;
        case 'timeout-multiplier':
          options.timeoutMultiplier = parseInt(value);
          break;
        case 'operators':
          // Filter mutation operators based on selection
          options.operators = value.split(',');
          break;
      }
    } else {
      files.push(path.resolve(arg));
    }
  }

  const framework = new MutationTestingFramework(options);
  
  try {
    await framework.initialize();
    
    const results = await framework.runMutationTesting(files.length > 0 ? files : null);
    const report = await framework.generateReport(results);
    
    console.log(`\nReports generated:`);
    console.log(`  JSON: ${report.jsonReport}`);
    console.log(`  HTML: ${report.htmlReport}`);
    
    // Exit with appropriate code
    process.exit(report.passed ? 0 : 1);
    
  } catch (error) {
    console.error('Mutation testing failed:', error);
    process.exit(1);
  }
}

// Run CLI if executed directly
if (require.main === module) {
  main();
}

module.exports = MutationTestingFramework;