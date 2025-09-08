#!/usr/bin/env node

/**
 * API Contract Testing Framework - Comprehensive API schema validation and contract testing
 * 
 * Features:
 * - OpenAPI/Swagger schema validation
 * - Consumer-driven contract testing
 * - API versioning compatibility testing
 * - Request/response schema validation
 * - Contract evolution testing
 * - Provider-consumer contract verification
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

class APIContractTester {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:4000';
    this.outputDir = options.outputDir || path.join(process.cwd(), 'contract-results');
    this.schemasDir = path.join(__dirname, 'schemas');
    this.contractsDir = path.join(__dirname, 'consumer-contracts');
    
    // Initialize AJV with formats
    this.ajv = new Ajv({ 
      allErrors: true, 
      strict: false,
      validateFormats: true
    });
    addFormats(this.ajv);
    
    this.testResults = [];
    this.contractViolations = [];
  }

  async initialize() {
    await this.ensureDirectories();
    await this.loadSchemas();
    console.log('API Contract testing framework initialized');
  }

  async ensureDirectories() {
    const dirs = [this.outputDir, this.schemasDir, this.contractsDir];
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async loadSchemas() {
    // Load API schemas
    this.schemas = {};
    
    try {
      const schemaFiles = await fs.readdir(this.schemasDir);
      
      for (const file of schemaFiles) {
        if (file.endsWith('.json')) {
          const schemaPath = path.join(this.schemasDir, file);
          const schemaContent = await fs.readFile(schemaPath, 'utf8');
          const schemaName = file.replace('.json', '');
          
          this.schemas[schemaName] = JSON.parse(schemaContent);
        }
      }
    } catch (error) {
      console.warn('No schema files found. Creating default schemas...');
      await this.createDefaultSchemas();
    }
  }

  async createDefaultSchemas() {
    // Create default API schemas based on Flash Cards API
    const schemas = {
      'user-schema': {
        type: 'object',
        properties: {
          id: { type: 'integer', minimum: 1 },
          email: { 
            type: 'string', 
            format: 'email',
            minLength: 5,
            maxLength: 255
          },
          role: { 
            type: 'string', 
            enum: ['user', 'admin'] 
          },
          created_at: { 
            type: 'string', 
            format: 'date-time' 
          },
          updated_at: { 
            type: 'string', 
            format: 'date-time' 
          }
        },
        required: ['id', 'email', 'role'],
        additionalProperties: false
      },

      'flashcard-schema': {
        type: 'object',
        properties: {
          id: { type: 'integer', minimum: 1 },
          english: { 
            type: 'string', 
            minLength: 1,
            maxLength: 1000
          },
          spanish: { 
            type: 'string', 
            minLength: 1,
            maxLength: 1000
          },
          user_id: { type: 'integer', minimum: 1 },
          difficulty: { 
            type: 'integer', 
            minimum: 1, 
            maximum: 5 
          },
          last_reviewed: { 
            type: ['string', 'null'], 
            format: 'date-time' 
          },
          review_count: { 
            type: 'integer', 
            minimum: 0 
          },
          created_at: { 
            type: 'string', 
            format: 'date-time' 
          },
          updated_at: { 
            type: 'string', 
            format: 'date-time' 
          }
        },
        required: ['id', 'english', 'spanish', 'user_id'],
        additionalProperties: false
      },

      'auth-response-schema': {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          token: { 
            type: 'string', 
            minLength: 10 
          },
          user: { 
            $ref: '#/definitions/user' 
          },
          expires_in: { 
            type: 'integer', 
            minimum: 1 
          }
        },
        required: ['success', 'token', 'user'],
        definitions: {
          user: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              email: { type: 'string', format: 'email' },
              role: { type: 'string' }
            },
            required: ['id', 'email', 'role']
          }
        }
      },

      'error-response-schema': {
        type: 'object',
        properties: {
          success: { 
            type: 'boolean', 
            const: false 
          },
          error: { 
            type: 'string', 
            minLength: 1 
          },
          code: { 
            type: 'string',
            pattern: '^[A-Z_]+$'
          },
          details: {
            type: 'object'
          }
        },
        required: ['success', 'error'],
        additionalProperties: false
      },

      'flashcard-list-response-schema': {
        type: 'object',
        properties: {
          success: { type: 'boolean', const: true },
          data: {
            type: 'array',
            items: { $ref: '#/definitions/flashcard' }
          },
          total: { type: 'integer', minimum: 0 },
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1 }
        },
        required: ['success', 'data'],
        definitions: {
          flashcard: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              english: { type: 'string' },
              spanish: { type: 'string' },
              difficulty: { type: 'integer', minimum: 1, maximum: 5 }
            },
            required: ['id', 'english', 'spanish']
          }
        }
      }
    };

    // Save schemas to files
    for (const [schemaName, schema] of Object.entries(schemas)) {
      const schemaPath = path.join(this.schemasDir, `${schemaName}.json`);
      await fs.writeFile(schemaPath, JSON.stringify(schema, null, 2));
    }

    this.schemas = schemas;
    console.log('Default API schemas created');
  }

  // Contract Testing Methods
  async testAuthenticationContract() {
    const test = {
      name: 'Authentication API Contract',
      endpoint: '/api/auth/login',
      method: 'POST',
      scenarios: [],
      violations: []
    };

    // Test 1: Valid login
    const validLoginTest = await this.testScenario({
      name: 'Valid Login',
      endpoint: '/api/auth/login',
      method: 'POST',
      requestData: {
        email: 'test@example.com',
        password: 'TestPassword123!'
      },
      expectedStatus: 200,
      responseSchema: 'auth-response-schema',
      contractRules: [
        { field: 'token', rule: 'required', description: 'JWT token must be present' },
        { field: 'user.email', rule: 'matches_request', description: 'Response email must match request' },
        { field: 'expires_in', rule: 'positive_number', description: 'Token expiration must be positive' }
      ]
    });
    test.scenarios.push(validLoginTest);

    // Test 2: Invalid credentials
    const invalidLoginTest = await this.testScenario({
      name: 'Invalid Credentials',
      endpoint: '/api/auth/login',
      method: 'POST',
      requestData: {
        email: 'test@example.com',
        password: 'wrongpassword'
      },
      expectedStatus: 401,
      responseSchema: 'error-response-schema',
      contractRules: [
        { field: 'success', rule: 'equals', value: false, description: 'Success must be false' },
        { field: 'error', rule: 'required', description: 'Error message must be present' }
      ]
    });
    test.scenarios.push(invalidLoginTest);

    // Test 3: Missing fields
    const missingFieldsTest = await this.testScenario({
      name: 'Missing Required Fields',
      endpoint: '/api/auth/login',
      method: 'POST',
      requestData: {
        email: 'test@example.com'
        // Missing password
      },
      expectedStatus: 400,
      responseSchema: 'error-response-schema',
      contractRules: [
        { field: 'error', rule: 'contains', value: 'password', description: 'Error must mention missing password' }
      ]
    });
    test.scenarios.push(missingFieldsTest);

    // Calculate overall test result
    test.passed = test.scenarios.every(s => s.passed);
    test.violations = test.scenarios.flatMap(s => s.violations);

    return test;
  }

  async testFlashcardsContract() {
    const test = {
      name: 'Flashcards API Contract',
      endpoint: '/api/flashcards',
      method: 'GET',
      scenarios: [],
      violations: []
    };

    // First, authenticate to get token
    const authResponse = await this.authenticateTestUser();
    const token = authResponse.token;

    // Test 1: Get flashcards list
    const getFlashcardsTest = await this.testScenario({
      name: 'Get Flashcards List',
      endpoint: '/api/flashcards',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      expectedStatus: 200,
      responseSchema: 'flashcard-list-response-schema',
      contractRules: [
        { field: 'data', rule: 'is_array', description: 'Data must be an array' },
        { field: 'data[*].id', rule: 'required', description: 'Each flashcard must have an ID' },
        { field: 'data[*].english', rule: 'required', description: 'Each flashcard must have English text' },
        { field: 'data[*].spanish', rule: 'required', description: 'Each flashcard must have Spanish text' }
      ]
    });
    test.scenarios.push(getFlashcardsTest);

    // Test 2: Create flashcard
    const createFlashcardTest = await this.testScenario({
      name: 'Create Flashcard',
      endpoint: '/api/flashcards',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      requestData: {
        english: 'Hello',
        spanish: 'Hola'
      },
      expectedStatus: 201,
      responseSchema: 'flashcard-schema',
      contractRules: [
        { field: 'id', rule: 'required', description: 'Created flashcard must have ID' },
        { field: 'english', rule: 'matches_request', description: 'English text must match request' },
        { field: 'spanish', rule: 'matches_request', description: 'Spanish text must match request' },
        { field: 'user_id', rule: 'required', description: 'User ID must be set' }
      ]
    });
    test.scenarios.push(createFlashcardTest);

    // Test 3: Unauthorized access
    const unauthorizedTest = await this.testScenario({
      name: 'Unauthorized Access',
      endpoint: '/api/flashcards',
      method: 'GET',
      // No authorization header
      expectedStatus: 401,
      responseSchema: 'error-response-schema',
      contractRules: [
        { field: 'success', rule: 'equals', value: false, description: 'Success must be false' },
        { field: 'error', rule: 'contains', value: 'token', description: 'Error must mention token' }
      ]
    });
    test.scenarios.push(unauthorizedTest);

    test.passed = test.scenarios.every(s => s.passed);
    test.violations = test.scenarios.flatMap(s => s.violations);

    return test;
  }

  async testScenario(scenario) {
    const result = {
      name: scenario.name,
      endpoint: scenario.endpoint,
      method: scenario.method,
      passed: true,
      violations: [],
      response: null,
      validationResults: []
    };

    try {
      // Make API request
      const requestConfig = {
        method: scenario.method,
        url: `${this.baseUrl}${scenario.endpoint}`,
        timeout: 10000,
        validateStatus: () => true, // Don't throw on HTTP errors
        ...scenario.headers && { headers: scenario.headers },
        ...scenario.requestData && { data: scenario.requestData }
      };

      const response = await axios(requestConfig);
      result.response = {
        status: response.status,
        headers: response.headers,
        data: response.data
      };

      // Validate status code
      if (response.status !== scenario.expectedStatus) {
        result.passed = false;
        result.violations.push({
          type: 'status_code_mismatch',
          expected: scenario.expectedStatus,
          actual: response.status,
          severity: 'high'
        });
      }

      // Validate response schema
      if (scenario.responseSchema && this.schemas[scenario.responseSchema]) {
        const schemaValidation = this.validateResponseSchema(
          response.data, 
          this.schemas[scenario.responseSchema]
        );
        
        result.validationResults.push(schemaValidation);
        
        if (!schemaValidation.valid) {
          result.passed = false;
          result.violations.push(...schemaValidation.errors.map(error => ({
            type: 'schema_violation',
            field: error.instancePath,
            message: error.message,
            severity: 'high'
          })));
        }
      }

      // Validate contract rules
      if (scenario.contractRules) {
        for (const rule of scenario.contractRules) {
          const ruleValidation = this.validateContractRule(
            response.data, 
            rule, 
            scenario.requestData
          );
          
          if (!ruleValidation.valid) {
            result.passed = false;
            result.violations.push({
              type: 'contract_rule_violation',
              rule: rule.rule,
              field: rule.field,
              description: rule.description,
              message: ruleValidation.message,
              severity: 'medium'
            });
          }
        }
      }

    } catch (error) {
      result.passed = false;
      result.violations.push({
        type: 'request_error',
        message: error.message,
        severity: 'critical'
      });
    }

    return result;
  }

  validateResponseSchema(data, schema) {
    const validate = this.ajv.compile(schema);
    const valid = validate(data);
    
    return {
      valid: valid,
      errors: validate.errors || []
    };
  }

  validateContractRule(responseData, rule, requestData) {
    const { field, rule: ruleName, value, description } = rule;
    
    try {
      const fieldValue = this.getNestedValue(responseData, field);
      
      switch (ruleName) {
        case 'required':
          return {
            valid: fieldValue !== undefined && fieldValue !== null,
            message: `Field '${field}' is required but was ${fieldValue}`
          };
          
        case 'equals':
          return {
            valid: fieldValue === value,
            message: `Field '${field}' should equal '${value}' but was '${fieldValue}'`
          };
          
        case 'contains':
          return {
            valid: typeof fieldValue === 'string' && fieldValue.toLowerCase().includes(value.toLowerCase()),
            message: `Field '${field}' should contain '${value}' but was '${fieldValue}'`
          };
          
        case 'matches_request':
          const requestFieldValue = this.getNestedValue(requestData, field.replace('response.', ''));
          return {
            valid: fieldValue === requestFieldValue,
            message: `Field '${field}' should match request value '${requestFieldValue}' but was '${fieldValue}'`
          };
          
        case 'is_array':
          return {
            valid: Array.isArray(fieldValue),
            message: `Field '${field}' should be an array but was ${typeof fieldValue}`
          };
          
        case 'positive_number':
          return {
            valid: typeof fieldValue === 'number' && fieldValue > 0,
            message: `Field '${field}' should be a positive number but was '${fieldValue}'`
          };
          
        default:
          return {
            valid: false,
            message: `Unknown rule: ${ruleName}`
          };
      }
      
    } catch (error) {
      return {
        valid: false,
        message: `Error validating rule '${ruleName}' for field '${field}': ${error.message}`
      };
    }
  }

  getNestedValue(obj, path) {
    if (!path || !obj) return obj;
    
    // Handle array notation like data[*].id
    if (path.includes('[*]')) {
      const [arrayPath, fieldPath] = path.split('[*].');
      const arrayValue = this.getNestedValue(obj, arrayPath);
      
      if (Array.isArray(arrayValue)) {
        return arrayValue.every(item => this.getNestedValue(item, fieldPath) !== undefined);
      }
      return false;
    }
    
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  async authenticateTestUser() {
    try {
      const response = await axios({
        method: 'POST',
        url: `${this.baseUrl}/api/auth/login`,
        data: {
          email: 'test@example.com',
          password: 'TestPassword123!'
        }
      });
      
      return response.data;
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  // Consumer Contract Testing
  async testConsumerContracts() {
    console.log('Testing consumer contracts...');
    const results = [];

    try {
      const contractFiles = await fs.readdir(this.contractsDir);
      
      for (const file of contractFiles) {
        if (file.endsWith('.json')) {
          const contractPath = path.join(this.contractsDir, file);
          const contractData = JSON.parse(await fs.readFile(contractPath, 'utf8'));
          
          const contractResult = await this.validateConsumerContract(contractData);
          results.push(contractResult);
        }
      }
    } catch (error) {
      console.warn('No consumer contracts found');
    }

    return results;
  }

  async validateConsumerContract(contract) {
    const result = {
      consumer: contract.consumer,
      provider: contract.provider,
      interactions: [],
      passed: true
    };

    for (const interaction of contract.interactions) {
      const interactionResult = await this.testContractInteraction(interaction);
      result.interactions.push(interactionResult);
      
      if (!interactionResult.passed) {
        result.passed = false;
      }
    }

    return result;
  }

  async testContractInteraction(interaction) {
    const result = {
      description: interaction.description,
      passed: true,
      violations: []
    };

    try {
      // Execute the interaction
      const requestConfig = {
        method: interaction.request.method,
        url: `${this.baseUrl}${interaction.request.path}`,
        ...interaction.request.headers && { headers: interaction.request.headers },
        ...interaction.request.body && { data: interaction.request.body }
      };

      const response = await axios(requestConfig);

      // Validate response matches expected
      const expected = interaction.response;
      
      if (response.status !== expected.status) {
        result.passed = false;
        result.violations.push({
          type: 'status_mismatch',
          expected: expected.status,
          actual: response.status
        });
      }

      // Validate response headers
      if (expected.headers) {
        for (const [headerName, headerValue] of Object.entries(expected.headers)) {
          if (response.headers[headerName.toLowerCase()] !== headerValue) {
            result.passed = false;
            result.violations.push({
              type: 'header_mismatch',
              header: headerName,
              expected: headerValue,
              actual: response.headers[headerName.toLowerCase()]
            });
          }
        }
      }

      // Validate response body structure
      if (expected.body) {
        const bodyValidation = this.validateContractBody(response.data, expected.body);
        if (!bodyValidation.valid) {
          result.passed = false;
          result.violations.push(...bodyValidation.violations);
        }
      }

    } catch (error) {
      result.passed = false;
      result.violations.push({
        type: 'execution_error',
        message: error.message
      });
    }

    return result;
  }

  validateContractBody(actualBody, expectedBody) {
    // Implement contract body validation logic
    // This is a simplified version - real implementation would be more comprehensive
    
    const violations = [];
    
    if (typeof expectedBody !== typeof actualBody) {
      violations.push({
        type: 'type_mismatch',
        expected: typeof expectedBody,
        actual: typeof actualBody
      });
    }

    if (typeof expectedBody === 'object' && expectedBody !== null) {
      for (const key of Object.keys(expectedBody)) {
        if (!(key in actualBody)) {
          violations.push({
            type: 'missing_field',
            field: key
          });
        }
      }
    }

    return {
      valid: violations.length === 0,
      violations: violations
    };
  }

  // API Versioning Tests
  async testAPIVersioning() {
    const test = {
      name: 'API Versioning Compatibility',
      versions: ['v1', 'v2'],
      scenarios: [],
      violations: []
    };

    // Test version headers
    for (const version of test.versions) {
      const versionTest = await this.testScenario({
        name: `API Version ${version}`,
        endpoint: '/api/flashcards',
        method: 'GET',
        headers: {
          'Accept': `application/vnd.api+json;version=${version}`,
          'Authorization': 'Bearer test-token'
        },
        expectedStatus: [200, 404], // 404 if version not supported
        contractRules: [
          { field: 'version', rule: 'equals', value: version, description: `Response should indicate version ${version}` }
        ]
      });
      
      test.scenarios.push(versionTest);
    }

    return test;
  }

  // Main Testing Method
  async runContractTests() {
    console.log('Starting API contract testing...');
    
    const results = {
      startTime: new Date().toISOString(),
      testResults: [],
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        violations: 0,
        criticalViolations: 0,
        highViolations: 0,
        mediumViolations: 0,
        lowViolations: 0
      }
    };

    try {
      // Run contract tests
      const authContractTest = await this.testAuthenticationContract();
      const flashcardsContractTest = await this.testFlashcardsContract();
      const versioningTest = await this.testAPIVersioning();
      const consumerContractTests = await this.testConsumerContracts();

      results.testResults = [
        authContractTest,
        flashcardsContractTest,
        versioningTest,
        ...consumerContractTests
      ];

      // Calculate summary
      for (const test of results.testResults) {
        results.summary.totalTests++;
        
        if (test.passed) {
          results.summary.passed++;
        } else {
          results.summary.failed++;
        }

        // Count violations by severity
        if (test.violations) {
          results.summary.violations += test.violations.length;
          
          for (const violation of test.violations) {
            switch (violation.severity) {
              case 'critical': results.summary.criticalViolations++; break;
              case 'high': results.summary.highViolations++; break;
              case 'medium': results.summary.mediumViolations++; break;
              case 'low': results.summary.lowViolations++; break;
            }
          }
        }
      }

      results.endTime = new Date().toISOString();
      
      console.log('\n=== CONTRACT TEST SUMMARY ===');
      console.log(`Total Tests: ${results.summary.totalTests}`);
      console.log(`Passed: ${results.summary.passed}`);
      console.log(`Failed: ${results.summary.failed}`);
      console.log(`Contract Violations: ${results.summary.violations}`);
      console.log(`Critical: ${results.summary.criticalViolations}`);
      console.log(`High: ${results.summary.highViolations}`);
      console.log(`Medium: ${results.summary.mediumViolations}`);

      return results;

    } catch (error) {
      console.error('Contract testing failed:', error);
      throw error;
    }
  }

  async generateContractReport(results) {
    const reportData = {
      ...results,
      overallStatus: results.summary.failed === 0 ? 'PASSED' : 'FAILED',
      recommendations: this.generateContractRecommendations(results.testResults)
    };

    // Save JSON report
    const jsonReportPath = path.join(this.outputDir, 'contract-test-report.json');
    await fs.writeFile(jsonReportPath, JSON.stringify(reportData, null, 2));

    // Generate HTML report
    const htmlReportPath = await this.generateContractHtmlReport(reportData);

    return {
      jsonReport: jsonReportPath,
      htmlReport: htmlReportPath,
      overallStatus: reportData.overallStatus
    };
  }

  generateContractRecommendations(testResults) {
    const recommendations = [];
    
    for (const test of testResults) {
      if (test.violations && test.violations.length > 0) {
        const criticalViolations = test.violations.filter(v => v.severity === 'critical');
        const schemaViolations = test.violations.filter(v => v.type === 'schema_violation');
        
        if (criticalViolations.length > 0) {
          recommendations.push(`Critical: Fix ${criticalViolations.length} critical violations in ${test.name}`);
        }
        
        if (schemaViolations.length > 0) {
          recommendations.push(`Schema: Update API schemas to match actual responses in ${test.name}`);
        }
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('All API contracts are compliant - maintain current standards');
    }

    return [...new Set(recommendations)];
  }

  async generateContractHtmlReport(results) {
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>API Contract Testing Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 1px solid #ddd; padding-bottom: 20px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .count { font-size: 2em; font-weight: bold; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .violations { color: #ffc107; }
        .critical { color: #721c24; }
        .tests { margin-top: 30px; }
        .test { margin-bottom: 30px; border: 1px solid #ddd; border-radius: 8px; padding: 20px; }
        .test h3 { margin-top: 0; }
        .violation { background: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; margin: 5px 0; border-radius: 4px; }
        .scenario { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .status-passed { color: #28a745; font-weight: bold; }
        .status-failed { color: #dc3545; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>API Contract Testing Report</h1>
        <p>Generated: ${results.endTime}</p>
        <p>Status: <span class="${results.overallStatus === 'PASSED' ? 'status-passed' : 'status-failed'}">${results.overallStatus}</span></p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>Total Tests</h3>
            <div class="count">${results.summary.totalTests}</div>
        </div>
        <div class="metric">
            <h3>Passed</h3>
            <div class="count passed">${results.summary.passed}</div>
        </div>
        <div class="metric">
            <h3>Failed</h3>
            <div class="count failed">${results.summary.failed}</div>
        </div>
        <div class="metric">
            <h3>Violations</h3>
            <div class="count violations">${results.summary.violations}</div>
        </div>
    </div>

    <div class="tests">
        <h2>Test Results</h2>
        ${results.testResults.map(test => `
        <div class="test">
            <h3>${test.name} - <span class="${test.passed ? 'status-passed' : 'status-failed'}">${test.passed ? 'PASSED' : 'FAILED'}</span></h3>
            
            ${test.scenarios ? test.scenarios.map(scenario => `
            <div class="scenario">
                <h4>${scenario.name} - <span class="${scenario.passed ? 'status-passed' : 'status-failed'}">${scenario.passed ? 'PASSED' : 'FAILED'}</span></h4>
                <p><strong>Endpoint:</strong> ${scenario.method} ${scenario.endpoint}</p>
                ${scenario.response ? `<p><strong>Status:</strong> ${scenario.response.status}</p>` : ''}
                
                ${scenario.violations && scenario.violations.length > 0 ? `
                <h5>Violations:</h5>
                ${scenario.violations.map(violation => `
                <div class="violation">
                    <strong>${violation.type}:</strong> ${violation.message || violation.description || 'Contract violation detected'}
                    ${violation.severity ? `<span style="float: right; font-weight: bold; color: ${violation.severity === 'critical' ? '#721c24' : '#856404'}">${violation.severity.toUpperCase()}</span>` : ''}
                </div>
                `).join('')}
                ` : '<p style="color: #28a745;">✅ No violations detected</p>'}
            </div>
            `).join('') : ''}
            
            ${test.violations && test.violations.length > 0 ? `
            <h4>Overall Violations:</h4>
            ${test.violations.map(violation => `
            <div class="violation">
                <strong>${violation.type}:</strong> ${violation.message || violation.description}
                ${violation.severity ? `<span style="float: right; font-weight: bold;">${violation.severity.toUpperCase()}</span>` : ''}
            </div>
            `).join('')}
            ` : ''}
        </div>
        `).join('')}
    </div>

    <div style="margin-top: 30px; padding: 20px; background: #e9ecef; border-radius: 8px;">
        <h2>Recommendations</h2>
        <ul>
            ${results.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
</body>
</html>`;

    const htmlReportPath = path.join(this.outputDir, 'contract-test-report.html');
    await fs.writeFile(htmlReportPath, html);
    
    console.log(`Contract test report generated: ${htmlReportPath}`);
    return htmlReportPath;
  }
}

// CLI Interface
async function main() {
  const options = {
    baseUrl: process.env.BASE_URL || 'http://localhost:4000'
  };

  const tester = new APIContractTester(options);
  
  try {
    await tester.initialize();
    const results = await tester.runContractTests();
    const report = await tester.generateContractReport(results);
    
    console.log(`\nContract test reports generated:`);
    console.log(`JSON: ${report.jsonReport}`);
    console.log(`HTML: ${report.htmlReport}`);
    console.log(`Overall Status: ${report.overallStatus}`);
    
    // Exit with error code if any tests failed
    const exitCode = report.overallStatus === 'FAILED' ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('Contract testing failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = APIContractTester;