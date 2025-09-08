#!/usr/bin/env node

/**
 * Security Testing Framework - Automated security and penetration testing
 * 
 * Features:
 * - OWASP Top 10 vulnerability scanning
 * - Authentication bypass testing
 * - SQL injection detection
 * - XSS vulnerability testing
 * - CSRF protection validation
 * - Rate limiting verification
 * - Input validation testing
 * - Session management analysis
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');
const crypto = require('crypto');

class SecurityTestingFramework {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:4000';
    this.outputDir = options.outputDir || path.join(process.cwd(), 'security-results');
    this.testTimeout = options.testTimeout || 30000;
    this.maxRetries = options.maxRetries || 3;
    this.severity = options.severity || ['critical', 'high', 'medium', 'low'];
    this.vulnerabilities = [];
    this.testResults = [];
  }

  async initialize() {
    await this.ensureOutputDirectory();
    console.log('Security testing framework initialized');
  }

  async ensureOutputDirectory() {
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'reports'), { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'evidence'), { recursive: true });
  }

  // Authentication Testing
  async testAuthenticationSecurity() {
    console.log('Testing authentication security...');
    const authTests = [];

    // Test 1: SQL Injection in Login
    authTests.push(await this.testSQLInjectionLogin());
    
    // Test 2: Brute Force Protection
    authTests.push(await this.testBruteForceProtection());
    
    // Test 3: Weak Password Acceptance
    authTests.push(await this.testWeakPasswordAcceptance());
    
    // Test 4: Username Enumeration
    authTests.push(await this.testUsernameEnumeration());
    
    // Test 5: Session Management
    authTests.push(await this.testSessionManagement());

    return authTests;
  }

  async testSQLInjectionLogin() {
    const test = {
      name: 'SQL Injection in Login',
      category: 'Authentication',
      severity: 'critical',
      status: 'testing',
      details: []
    };

    const sqlPayloads = [
      "admin'--",
      "admin'/*",
      "' OR '1'='1",
      "' OR 1=1--",
      "' UNION SELECT NULL--",
      "admin'; DROP TABLE users;--",
      "' OR 'x'='x",
      "1' OR '1'='1' /*"
    ];

    try {
      for (const payload of sqlPayloads) {
        const response = await this.makeRequest('/api/auth/login', {
          method: 'POST',
          data: {
            email: payload,
            password: 'test123'
          }
        });

        // Check for signs of SQL injection success
        if (response.status === 200 && response.data.token) {
          test.status = 'vulnerable';
          test.details.push({
            payload: payload,
            response: response.data,
            risk: 'Authentication bypass possible'
          });
        } else if (response.data && response.data.error && 
                   response.data.error.toLowerCase().includes('syntax')) {
          test.status = 'vulnerable';
          test.details.push({
            payload: payload,
            error: response.data.error,
            risk: 'Database error disclosure'
          });
        }
      }

      if (test.status === 'testing') {
        test.status = 'secure';
        test.details.push({ message: 'No SQL injection vulnerabilities detected' });
      }

    } catch (error) {
      test.status = 'error';
      test.details.push({ error: error.message });
    }

    return test;
  }

  async testBruteForceProtection() {
    const test = {
      name: 'Brute Force Protection',
      category: 'Authentication',
      severity: 'high',
      status: 'testing',
      details: []
    };

    try {
      const attempts = 15;
      const testEmail = 'test@example.com';
      let successfulAttempts = 0;

      for (let i = 0; i < attempts; i++) {
        const startTime = Date.now();
        
        try {
          const response = await this.makeRequest('/api/auth/login', {
            method: 'POST',
            data: {
              email: testEmail,
              password: `wrongpassword${i}`
            }
          });

          const responseTime = Date.now() - startTime;

          if (response.status !== 429 && response.status !== 423) {
            successfulAttempts++;
          }

          test.details.push({
            attempt: i + 1,
            status: response.status,
            responseTime: responseTime,
            rateLimited: response.status === 429
          });

        } catch (error) {
          if (error.response && error.response.status === 429) {
            test.details.push({
              attempt: i + 1,
              status: 429,
              rateLimited: true,
              message: 'Rate limited (good)'
            });
          }
        }

        // Small delay between attempts
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (successfulAttempts > 10) {
        test.status = 'vulnerable';
        test.details.unshift({
          risk: 'No rate limiting detected',
          successfulAttempts: successfulAttempts
        });
      } else {
        test.status = 'secure';
        test.details.unshift({
          message: 'Brute force protection appears active',
          blockedAttempts: attempts - successfulAttempts
        });
      }

    } catch (error) {
      test.status = 'error';
      test.details.push({ error: error.message });
    }

    return test;
  }

  async testWeakPasswordAcceptance() {
    const test = {
      name: 'Weak Password Acceptance',
      category: 'Authentication',
      severity: 'medium',
      status: 'testing',
      details: []
    };

    const weakPasswords = [
      '123',
      'password',
      '123456',
      'admin',
      'test',
      'qwerty',
      'abc123',
      '111111'
    ];

    try {
      for (const password of weakPasswords) {
        const response = await this.makeRequest('/api/auth/register', {
          method: 'POST',
          data: {
            email: `test${Math.random()}@example.com`,
            password: password
          }
        });

        if (response.status === 201 || response.status === 200) {
          test.status = 'vulnerable';
          test.details.push({
            weakness: 'Weak password accepted',
            password: password,
            risk: 'Accounts vulnerable to dictionary attacks'
          });
        }
      }

      if (test.status === 'testing') {
        test.status = 'secure';
        test.details.push({ message: 'Strong password policy enforced' });
      }

    } catch (error) {
      test.status = 'error';
      test.details.push({ error: error.message });
    }

    return test;
  }

  async testUsernameEnumeration() {
    const test = {
      name: 'Username Enumeration',
      category: 'Authentication',
      severity: 'low',
      status: 'testing',
      details: []
    };

    try {
      // Test with existing vs non-existing emails
      const existingEmail = 'test@example.com';
      const nonExistingEmail = 'nonexistent@example.com';

      const existingResponse = await this.makeRequest('/api/auth/login', {
        method: 'POST',
        data: {
          email: existingEmail,
          password: 'wrongpassword'
        }
      });

      const nonExistingResponse = await this.makeRequest('/api/auth/login', {
        method: 'POST',
        data: {
          email: nonExistingEmail,
          password: 'wrongpassword'
        }
      });

      // Check for different error messages or response times
      if (existingResponse.data?.error !== nonExistingResponse.data?.error) {
        test.status = 'vulnerable';
        test.details.push({
          vulnerability: 'Different error messages for existing vs non-existing users',
          existingUserError: existingResponse.data?.error,
          nonExistingUserError: nonExistingResponse.data?.error,
          risk: 'Username enumeration possible'
        });
      } else {
        test.status = 'secure';
        test.details.push({ message: 'Consistent error messages prevent enumeration' });
      }

    } catch (error) {
      test.status = 'error';
      test.details.push({ error: error.message });
    }

    return test;
  }

  async testSessionManagement() {
    const test = {
      name: 'Session Management',
      category: 'Authentication',
      severity: 'high',
      status: 'testing',
      details: []
    };

    try {
      // First, authenticate to get a session
      const loginResponse = await this.makeRequest('/api/auth/login', {
        method: 'POST',
        data: {
          email: 'test@example.com',
          password: 'TestPassword123!'
        }
      });

      if (loginResponse.data?.token) {
        const token = loginResponse.data.token;
        
        // Test 1: Token validation
        const authResponse = await this.makeRequest('/api/flashcards', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        // Test 2: Malformed token handling
        const malformedResponse = await this.makeRequest('/api/flashcards', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}malformed`
          }
        });

        // Test 3: No token handling
        const noTokenResponse = await this.makeRequest('/api/flashcards', {
          method: 'GET'
        });

        test.details.push({
          validToken: authResponse.status === 200,
          malformedTokenBlocked: malformedResponse.status === 401,
          noTokenBlocked: noTokenResponse.status === 401
        });

        if (authResponse.status === 200 && 
            malformedResponse.status === 401 && 
            noTokenResponse.status === 401) {
          test.status = 'secure';
          test.details.unshift({ message: 'Session management working correctly' });
        } else {
          test.status = 'vulnerable';
          test.details.unshift({ risk: 'Session management issues detected' });
        }

      } else {
        test.status = 'error';
        test.details.push({ error: 'Could not obtain authentication token for testing' });
      }

    } catch (error) {
      test.status = 'error';
      test.details.push({ error: error.message });
    }

    return test;
  }

  // Input Validation Testing
  async testInputValidation() {
    console.log('Testing input validation...');
    const inputTests = [];

    inputTests.push(await this.testXSSVulnerabilities());
    inputTests.push(await this.testSQLInjectionEndpoints());
    inputTests.push(await this.testFileUploadSecurity());
    inputTests.push(await this.testParameterPollution());

    return inputTests;
  }

  async testXSSVulnerabilities() {
    const test = {
      name: 'Cross-Site Scripting (XSS)',
      category: 'Input Validation',
      severity: 'high',
      status: 'testing',
      details: []
    };

    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '"><script>alert("XSS")</script>',
      "'><script>alert('XSS')</script>",
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<svg onload=alert("XSS")>',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      '<body onload=alert("XSS")>'
    ];

    try {
      // Test XSS in flashcard creation
      for (const payload of xssPayloads) {
        const response = await this.makeRequest('/api/flashcards', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer dummy-token'
          },
          data: {
            english: payload,
            spanish: 'Hola'
          }
        });

        // Check if payload is reflected unescaped
        if (response.data && JSON.stringify(response.data).includes(payload)) {
          test.status = 'vulnerable';
          test.details.push({
            payload: payload,
            endpoint: '/api/flashcards',
            vulnerability: 'Payload reflected without sanitization',
            risk: 'Stored XSS vulnerability'
          });
        }
      }

      if (test.status === 'testing') {
        test.status = 'secure';
        test.details.push({ message: 'No XSS vulnerabilities detected' });
      }

    } catch (error) {
      test.status = 'error';
      test.details.push({ error: error.message });
    }

    return test;
  }

  async testSQLInjectionEndpoints() {
    const test = {
      name: 'SQL Injection in API Endpoints',
      category: 'Input Validation',
      severity: 'critical',
      status: 'testing',
      details: []
    };

    const sqlPayloads = [
      "1' OR '1'='1",
      "1; DROP TABLE users;--",
      "1' UNION SELECT * FROM users--",
      "' OR 1=1--",
      "1' AND SLEEP(5)--"
    ];

    const endpoints = [
      { path: '/api/flashcards', method: 'GET', param: 'id' },
      { path: '/api/users', method: 'GET', param: 'id' }
    ];

    try {
      for (const endpoint of endpoints) {
        for (const payload of sqlPayloads) {
          let url = `${endpoint.path}`;
          if (endpoint.param) {
            url += `?${endpoint.param}=${encodeURIComponent(payload)}`;
          }

          const startTime = Date.now();
          const response = await this.makeRequest(url, {
            method: endpoint.method,
            headers: {
              'Authorization': 'Bearer dummy-token'
            }
          });
          const responseTime = Date.now() - startTime;

          // Check for SQL errors or suspicious response times
          if (response.data && response.data.error && 
              response.data.error.toLowerCase().includes('syntax')) {
            test.status = 'vulnerable';
            test.details.push({
              endpoint: url,
              payload: payload,
              vulnerability: 'SQL syntax error disclosed',
              error: response.data.error,
              risk: 'Database structure disclosure'
            });
          }

          // Check for time-based SQL injection (SLEEP function)
          if (payload.includes('SLEEP') && responseTime > 4000) {
            test.status = 'vulnerable';
            test.details.push({
              endpoint: url,
              payload: payload,
              vulnerability: 'Time-based SQL injection detected',
              responseTime: responseTime,
              risk: 'Database access possible'
            });
          }
        }
      }

      if (test.status === 'testing') {
        test.status = 'secure';
        test.details.push({ message: 'No SQL injection vulnerabilities detected' });
      }

    } catch (error) {
      test.status = 'error';
      test.details.push({ error: error.message });
    }

    return test;
  }

  async testFileUploadSecurity() {
    const test = {
      name: 'File Upload Security',
      category: 'Input Validation',
      severity: 'high',
      status: 'testing',
      details: []
    };

    try {
      // Test malicious file uploads
      const maliciousFiles = [
        { name: 'shell.php', content: '<?php system($_GET["cmd"]); ?>', type: 'application/x-php' },
        { name: 'shell.jsp', content: '<% Runtime.getRuntime().exec(request.getParameter("cmd")); %>', type: 'application/x-jsp' },
        { name: 'test.exe', content: 'MZ\x90\x00', type: 'application/x-msdownload' },
        { name: '../../../etc/passwd', content: 'root:x:0:0:root:/root:/bin/bash', type: 'text/plain' }
      ];

      for (const file of maliciousFiles) {
        // Simulate file upload (adjust endpoint as needed)
        const formData = {
          file: {
            name: file.name,
            content: file.content,
            type: file.type
          }
        };

        try {
          const response = await this.makeRequest('/api/upload', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer dummy-token'
            },
            data: formData
          });

          if (response.status === 200) {
            test.status = 'vulnerable';
            test.details.push({
              vulnerability: 'Malicious file uploaded successfully',
              filename: file.name,
              risk: 'Code execution or path traversal possible'
            });
          }

        } catch (error) {
          // Expected for security - malicious files should be rejected
          test.details.push({
            filename: file.name,
            result: 'Blocked (good)',
            message: error.message
          });
        }
      }

      if (test.status === 'testing') {
        test.status = 'secure';
        test.details.unshift({ message: 'File upload security appears adequate' });
      }

    } catch (error) {
      test.status = 'error';
      test.details.push({ error: error.message });
    }

    return test;
  }

  async testParameterPollution() {
    const test = {
      name: 'HTTP Parameter Pollution',
      category: 'Input Validation',
      severity: 'medium',
      status: 'testing',
      details: []
    };

    try {
      // Test parameter pollution in login
      const response = await this.makeRequest('/api/auth/login', {
        method: 'POST',
        data: 'email=admin@test.com&password=wrong&email=user@test.com&password=correct',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      test.details.push({
        test: 'Parameter pollution in login',
        response: response.status,
        message: 'Parameter pollution handling varies by server implementation'
      });

      test.status = 'info';

    } catch (error) {
      test.status = 'error';
      test.details.push({ error: error.message });
    }

    return test;
  }

  // Business Logic Testing
  async testBusinessLogic() {
    console.log('Testing business logic security...');
    const businessTests = [];

    businessTests.push(await this.testAuthorizationBypass());
    businessTests.push(await this.testDataLeakage());
    businessTests.push(await this.testRoleEscalation());

    return businessTests;
  }

  async testAuthorizationBypass() {
    const test = {
      name: 'Authorization Bypass',
      category: 'Business Logic',
      severity: 'critical',
      status: 'testing',
      details: []
    };

    try {
      // Test accessing other users' data
      const userIds = [1, 2, 3, 999, -1, 'admin'];
      
      for (const userId of userIds) {
        const response = await this.makeRequest(`/api/users/${userId}`, {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer dummy-token-for-user-1'
          }
        });

        if (response.status === 200 && response.data) {
          test.status = 'vulnerable';
          test.details.push({
            vulnerability: 'Unauthorized access to user data',
            userId: userId,
            exposedData: Object.keys(response.data),
            risk: 'Data breach possible'
          });
        }
      }

      if (test.status === 'testing') {
        test.status = 'secure';
        test.details.push({ message: 'Authorization checks appear to be working' });
      }

    } catch (error) {
      test.status = 'error';
      test.details.push({ error: error.message });
    }

    return test;
  }

  async testDataLeakage() {
    const test = {
      name: 'Sensitive Data Leakage',
      category: 'Business Logic',
      severity: 'high',
      status: 'testing',
      details: []
    };

    try {
      // Test for sensitive data in responses
      const endpoints = [
        '/api/users/profile',
        '/api/flashcards',
        '/api/admin/users'
      ];

      const sensitiveFields = [
        'password',
        'password_hash',
        'secret',
        'key',
        'token',
        'private_key',
        'api_key'
      ];

      for (const endpoint of endpoints) {
        const response = await this.makeRequest(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer dummy-token'
          }
        });

        if (response.data) {
          const responseStr = JSON.stringify(response.data).toLowerCase();
          
          for (const field of sensitiveFields) {
            if (responseStr.includes(field)) {
              test.status = 'vulnerable';
              test.details.push({
                endpoint: endpoint,
                vulnerability: 'Sensitive field detected in response',
                field: field,
                risk: 'Sensitive data leakage'
              });
            }
          }
        }
      }

      if (test.status === 'testing') {
        test.status = 'secure';
        test.details.push({ message: 'No sensitive data leakage detected' });
      }

    } catch (error) {
      test.status = 'error';
      test.details.push({ error: error.message });
    }

    return test;
  }

  async testRoleEscalation() {
    const test = {
      name: 'Privilege Escalation',
      category: 'Business Logic',
      severity: 'critical',
      status: 'testing',
      details: []
    };

    try {
      // Test accessing admin endpoints with user token
      const adminEndpoints = [
        '/api/admin/users',
        '/api/admin/stats',
        '/api/admin/settings'
      ];

      for (const endpoint of adminEndpoints) {
        const response = await this.makeRequest(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer user-level-token'
          }
        });

        if (response.status === 200) {
          test.status = 'vulnerable';
          test.details.push({
            vulnerability: 'User token can access admin endpoint',
            endpoint: endpoint,
            risk: 'Privilege escalation possible'
          });
        }
      }

      if (test.status === 'testing') {
        test.status = 'secure';
        test.details.push({ message: 'Role-based access control working correctly' });
      }

    } catch (error) {
      test.status = 'error';
      test.details.push({ error: error.message });
    }

    return test;
  }

  // Utility Methods
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      method: options.method || 'GET',
      url: url,
      timeout: this.testTimeout,
      validateStatus: () => true, // Don't throw on HTTP errors
      ...options
    };

    try {
      const response = await axios(config);
      return response;
    } catch (error) {
      if (error.response) {
        return error.response;
      }
      throw error;
    }
  }

  // Main Testing Method
  async runSecurityTests() {
    console.log('Starting comprehensive security testing...');
    
    const results = {
      startTime: new Date().toISOString(),
      testResults: [],
      summary: {
        totalTests: 0,
        passed: 0,
        vulnerabilities: 0,
        errors: 0,
        criticalVulns: 0,
        highVulns: 0,
        mediumVulns: 0,
        lowVulns: 0
      }
    };

    try {
      // Run all test categories
      const authTests = await this.testAuthenticationSecurity();
      const inputTests = await this.testInputValidation();
      const businessTests = await this.testBusinessLogic();

      const allTests = [...authTests, ...inputTests, ...businessTests];
      results.testResults = allTests;

      // Calculate summary
      for (const test of allTests) {
        results.summary.totalTests++;
        
        switch (test.status) {
          case 'secure':
            results.summary.passed++;
            break;
          case 'vulnerable':
            results.summary.vulnerabilities++;
            switch (test.severity) {
              case 'critical': results.summary.criticalVulns++; break;
              case 'high': results.summary.highVulns++; break;
              case 'medium': results.summary.mediumVulns++; break;
              case 'low': results.summary.lowVulns++; break;
            }
            break;
          case 'error':
            results.summary.errors++;
            break;
        }
      }

      results.endTime = new Date().toISOString();
      
      console.log('\n=== SECURITY TEST SUMMARY ===');
      console.log(`Total Tests: ${results.summary.totalTests}`);
      console.log(`Passed: ${results.summary.passed}`);
      console.log(`Vulnerabilities: ${results.summary.vulnerabilities}`);
      console.log(`Errors: ${results.summary.errors}`);
      console.log(`Critical: ${results.summary.criticalVulns}`);
      console.log(`High: ${results.summary.highVulns}`);
      console.log(`Medium: ${results.summary.mediumVulns}`);
      console.log(`Low: ${results.summary.lowVulns}`);

      return results;

    } catch (error) {
      console.error('Security testing failed:', error);
      throw error;
    }
  }

  async generateSecurityReport(results) {
    const reportData = {
      ...results,
      overallRisk: this.calculateOverallRisk(results.summary),
      recommendations: this.generateRecommendations(results.testResults)
    };

    // Save JSON report
    const jsonReportPath = path.join(this.outputDir, 'security-report.json');
    await fs.writeFile(jsonReportPath, JSON.stringify(reportData, null, 2));

    // Generate HTML report
    const htmlReportPath = await this.generateHtmlSecurityReport(reportData);

    return {
      jsonReport: jsonReportPath,
      htmlReport: htmlReportPath,
      overallRisk: reportData.overallRisk
    };
  }

  calculateOverallRisk(summary) {
    if (summary.criticalVulns > 0) return 'Critical';
    if (summary.highVulns > 2) return 'High';
    if (summary.highVulns > 0 || summary.mediumVulns > 3) return 'Medium';
    if (summary.mediumVulns > 0 || summary.lowVulns > 0) return 'Low';
    return 'Minimal';
  }

  generateRecommendations(testResults) {
    const recommendations = [];
    
    for (const test of testResults) {
      if (test.status === 'vulnerable') {
        switch (test.name) {
          case 'SQL Injection in Login':
            recommendations.push('Implement parameterized queries and input sanitization');
            break;
          case 'Brute Force Protection':
            recommendations.push('Implement rate limiting and account lockout mechanisms');
            break;
          case 'Cross-Site Scripting (XSS)':
            recommendations.push('Implement proper input/output encoding and CSP headers');
            break;
          case 'Authorization Bypass':
            recommendations.push('Review and strengthen authorization checks');
            break;
          default:
            recommendations.push(`Address ${test.name} vulnerability`);
        }
      }
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  async generateHtmlSecurityReport(results) {
    // Similar HTML generation as in mutation testing
    // Implementation would be similar but focused on security findings
    const htmlReportPath = path.join(this.outputDir, 'security-report.html');
    
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Security Testing Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .critical { color: #721c24; background-color: #f5c6cb; }
        .high { color: #856404; background-color: #fff3cd; }
        .medium { color: #004085; background-color: #cce7ff; }
        .low { color: #155724; background-color: #d4edda; }
        .secure { color: #155724; }
        /* Additional styles... */
    </style>
</head>
<body>
    <h1>Security Testing Report</h1>
    <div class="summary">
        <h2>Overall Risk Level: <span class="${results.overallRisk.toLowerCase()}">${results.overallRisk}</span></h2>
        <p>Total Tests: ${results.summary.totalTests}</p>
        <p>Vulnerabilities Found: ${results.summary.vulnerabilities}</p>
    </div>
    <!-- Rest of HTML report... -->
</body>
</html>`;

    await fs.writeFile(htmlReportPath, html);
    console.log(`Security report generated: ${htmlReportPath}`);
    
    return htmlReportPath;
  }
}

// CLI Interface
async function main() {
  const options = {
    baseUrl: process.env.BASE_URL || 'http://localhost:4000'
  };

  const framework = new SecurityTestingFramework(options);
  
  try {
    await framework.initialize();
    const results = await framework.runSecurityTests();
    const report = await framework.generateSecurityReport(results);
    
    console.log(`\nSecurity reports generated:`);
    console.log(`JSON: ${report.jsonReport}`);
    console.log(`HTML: ${report.htmlReport}`);
    console.log(`Overall Risk: ${report.overallRisk}`);
    
    // Exit with error code if critical or high vulnerabilities found
    const exitCode = (results.summary.criticalVulns > 0 || results.summary.highVulns > 0) ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('Security testing failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = SecurityTestingFramework;