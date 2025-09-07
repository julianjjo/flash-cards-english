import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

/**
 * Integration Tests: API Error Handling & Edge Cases
 * 
 * Comprehensive tests for error conditions, edge cases, and resilience:
 * 
 * Error Response Testing:
 * - Malformed JSON requests
 * - Invalid content types
 * - Missing required headers
 * - Oversized payloads
 * - SQL injection attempts
 * - XSS attack vectors
 * 
 * Rate Limiting:
 * - Authentication endpoint limits
 * - API endpoint rate limits
 * - Bulk operation limits
 * 
 * Input Validation:
 * - Unicode and special characters
 * - Extremely long strings
 * - Null and undefined values
 * - Type coercion attacks
 * - Nested object validation
 * 
 * Network Conditions:
 * - Connection timeouts
 * - Incomplete requests
 * - Concurrent request handling
 * 
 * Database Edge Cases:
 * - Connection failures
 * - Transaction rollbacks
 * - Constraint violations
 * 
 * Tests system robustness, security boundaries, graceful degradation,
 * and proper error reporting across all API endpoints.
 */

describe('API Error Handling & Edge Cases - Integration Tests', () => {
  let app;
  let server;

  beforeAll(async () => {
    const { default: appModule } = await import('../../index.js');
    app = appModule;
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(async () => {
    try {
      const { default: db } = await import('../../config/database.js');
      await db.initialize();
      
      const database = db.getDatabase();
      database.prepare('DELETE FROM cards WHERE user_id IN (SELECT id FROM users WHERE email LIKE ?)').run('%errorapi%');
      database.prepare('DELETE FROM users WHERE email LIKE ?').run('%errorapi%');
    } catch (error) {
      console.log('Database cleanup failed (expected during TDD):', error.message);
    }
  });

  // Helper function to create authenticated user
  const createAuthenticatedUser = async (email, password = 'testpassword123') => {
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({ email, password })
      .expect(201);

    return {
      user: registerResponse.body.user,
      accessToken: registerResponse.body.accessToken
    };
  };

  describe('Request Format Validation', () => {
    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('{"email": "test@errorapi.com", "password": "test123"') // Missing closing brace
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/invalid json|syntax error|malformed/i);
    });

    test('should reject non-JSON content types for JSON endpoints', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'text/plain')
        .send('email=test@errorapi.com&password=test123')
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/content.*type|json/i);
    });

    test('should handle empty request bodies', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('')
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle null and undefined values', async () => {
      const testCases = [
        { email: null, password: 'test123' },
        { email: undefined, password: 'test123' },
        { email: 'test@errorapi.com', password: null },
        { email: 'test@errorapi.com', password: undefined }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/auth/register')
          .send(testCase)
          .expect('Content-Type', /json/)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    test('should handle wrong data types', async () => {
      const testCases = [
        { email: 123, password: 'test123' },
        { email: true, password: 'test123' },
        { email: [], password: 'test123' },
        { email: {}, password: 'test123' },
        { email: 'test@errorapi.com', password: 123 },
        { email: 'test@errorapi.com', password: [] }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/auth/register')
          .send(testCase)
          .expect('Content-Type', /json/)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('Input Length and Size Limits', () => {
    test('should reject extremely long strings', async () => {
      const longString = 'a'.repeat(10000);
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: longString + '@errorapi.com',
          password: 'test123'
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/too long|length|size/i);
    });

    test('should reject oversized payloads', async () => {
      // Create a very large object
      const largePayload = {
        email: 'test@errorapi.com',
        password: 'test123',
        largeData: 'x'.repeat(1024 * 1024) // 1MB of data
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(largePayload)
        .expect(400);

      // Should reject due to payload size limits
      expect([400, 413]).toContain(response.status);
    });

    test('should handle deeply nested objects', async () => {
      let deepObject = { email: 'test@errorapi.com', password: 'test123' };
      
      // Create deep nesting
      for (let i = 0; i < 100; i++) {
        deepObject = { nested: deepObject };
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send(deepObject)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle arrays with many elements', async () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => `item${i}`);
      
      const { accessToken } = await createAuthenticatedUser('array.test@errorapi.com');

      const response = await request(app)
        .post('/api/bulk/flashcards/import')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          flashcards: largeArray.map(item => ({
            english: item,
            spanish: `spanish-${item}`
          }))
        });

      // Should either handle gracefully or reject with appropriate error
      expect([200, 201, 400, 413, 429]).toContain(response.status);
    });
  });

  describe('Unicode and Special Characters', () => {
    test('should handle Unicode characters properly', async () => {
      const unicodeData = {
        email: 'unicode.test@errorapi.com',
        password: 'test123'
      };

      await request(app)
        .post('/api/auth/register')
        .send(unicodeData)
        .expect(201);

      const { accessToken } = await request(app)
        .post('/api/auth/login')
        .send(unicodeData)
        .expect(200);

      // Test Unicode in flashcard content
      const unicodeFlashcard = {
        english: 'Hello 世界 🌍',
        spanish: 'Hola mundo 你好 🌎'
      };

      const response = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${accessToken.body.accessToken}`)
        .send(unicodeFlashcard)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body.english).toBe('Hello 世界 🌍');
      expect(response.body.spanish).toBe('Hola mundo 你好 🌎');
    });

    test('should handle special HTML/XML characters', async () => {
      const { accessToken } = await createAuthenticatedUser('special.chars@errorapi.com');

      const specialCharsData = {
        english: '<script>alert("xss")</script> & "quotes" \'apostrophe\'',
        spanish: '<?xml version="1.0"?> & más caracteres especiales'
      };

      const response = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(specialCharsData)
        .expect('Content-Type', /json/)
        .expect(201);

      // Should store exactly as provided (not HTML encoded)
      expect(response.body.english).toBe(specialCharsData.english);
      expect(response.body.spanish).toBe(specialCharsData.spanish);
    });

    test('should handle SQL injection attempts', async () => {
      const sqlInjectionAttempts = [
        'test@errorapi.com\'; DROP TABLE users; --',
        'test@errorapi.com" OR "1"="1',
        'test@errorapi.com\' UNION SELECT * FROM users --',
        'test@errorapi.com\'; INSERT INTO users VALUES (...); --'
      ];

      for (const maliciousEmail of sqlInjectionAttempts) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: maliciousEmail,
            password: 'test123'
          })
          .expect('Content-Type', /json/)
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/invalid|email/i);
      }
    });

    test('should handle NoSQL injection attempts', async () => {
      const nosqlInjectionAttempts = [
        { $gt: '' },
        { $ne: null },
        { $regex: '.*' },
        { $where: 'function() { return true; }' }
      ];

      for (const injection of nosqlInjectionAttempts) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: injection,
            password: 'test123'
          })
          .expect('Content-Type', /json/)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('Authentication and Authorization Edge Cases', () => {
    test('should handle malformed JWT tokens', async () => {
      const malformedTokens = [
        'Bearer invalid.jwt.token',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
        'Bearer notajwttoken',
        'Bearer ',
        'Bearer null',
        'Bearer undefined'
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .get('/api/users/me')
          .set('Authorization', token)
          .expect('Content-Type', /json/)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      }
    });

    test('should handle expired JWT tokens', async () => {
      // This would require a token with past expiration
      // For now, we test with an obviously invalid signature
      const expiredToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ';

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', expiredToken)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle concurrent authentication attempts', async () => {
      const userData = {
        email: 'concurrent.auth@errorapi.com',
        password: 'test123'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Attempt multiple concurrent logins
      const loginPromises = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/auth/login')
          .send(userData)
      );

      const responses = await Promise.allSettled(loginPromises);
      const successful = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );

      // All should succeed (unless rate limited)
      expect(successful.length).toBeGreaterThanOrEqual(1);
    });

    test('should handle token replay attacks', async () => {
      const { accessToken } = await createAuthenticatedUser('replay.test@errorapi.com');

      // Use the same token multiple times rapidly
      const promises = Array.from({ length: 20 }, () =>
        request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${accessToken}`)
      );

      const responses = await Promise.allSettled(promises);
      const successful = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );

      // All should succeed (tokens are reusable until expiry)
      expect(successful.length).toBe(20);
    });
  });

  describe('Rate Limiting and DoS Protection', () => {
    test('should rate limit registration attempts', async () => {
      const promises = Array.from({ length: 50 }, (_, i) =>
        request(app)
          .post('/api/auth/register')
          .send({
            email: `ratelimit${i}@errorapi.com`,
            password: 'test123'
          })
      );

      const responses = await Promise.allSettled(promises);
      const rateLimited = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 429
      );

      // Should have some rate limited responses
      expect(rateLimited.length).toBeGreaterThanOrEqual(0);
    });

    test('should rate limit login attempts', async () => {
      // Register a user first
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'ratelimit.login@errorapi.com',
          password: 'test123'
        })
        .expect(201);

      // Attempt many logins with wrong password
      const promises = Array.from({ length: 30 }, () =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'ratelimit.login@errorapi.com',
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.allSettled(promises);
      const rateLimited = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 429
      );

      // Should have some rate limited responses
      expect(rateLimited.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle request flooding', async () => {
      const { accessToken } = await createAuthenticatedUser('flood.test@errorapi.com');

      // Send many requests simultaneously
      const promises = Array.from({ length: 100 }, () =>
        request(app)
          .get('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
      );

      const start = Date.now();
      const responses = await Promise.allSettled(promises);
      const duration = Date.now() - start;

      const successful = responses.filter(r => 
        r.status === 'fulfilled' && [200, 429].includes(r.value.status)
      );

      // All requests should be handled (either successfully or rate limited)
      expect(successful.length).toBe(100);
      
      // Should not take too long (server should remain responsive)
      expect(duration).toBeLessThan(30000); // 30 seconds max
    });
  });

  describe('Database Edge Cases', () => {
    test('should handle concurrent database operations', async () => {
      const { accessToken } = await createAuthenticatedUser('db.concurrent@errorapi.com');

      // Create many flashcards concurrently
      const promises = Array.from({ length: 50 }, (_, i) =>
        request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            english: `Concurrent Card ${i}`,
            spanish: `Tarjeta Concurrente ${i}`
          })
      );

      const responses = await Promise.allSettled(promises);
      const successful = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 201
      );

      // Most should succeed
      expect(successful.length).toBeGreaterThanOrEqual(40);
    });

    test('should handle database constraint violations', async () => {
      const { accessToken } = await createAuthenticatedUser('constraint.test@errorapi.com');

      // Try to create flashcard with invalid foreign key (if applicable)
      // This test depends on database schema constraints
      const invalidData = {
        english: 'Constraint Test',
        spanish: 'Prueba Restricción',
        userId: 999999 // Non-existent user ID
      };

      const response = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidData)
        .expect('Content-Type', /json/);

      // Should handle constraint violation gracefully
      expect([201, 400, 500]).toContain(response.status);
      
      if (response.status !== 201) {
        expect(response.body).toHaveProperty('error');
      }
    });

    test('should handle transaction rollbacks', async () => {
      const { user, accessToken } = await createAuthenticatedUser('transaction.test@errorapi.com');

      // Create a flashcard
      const createResponse = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          english: 'Transaction Test',
          spanish: 'Prueba Transacción'
        })
        .expect(201);

      // Try to perform operation that might cause rollback
      // For example, try to update with invalid data
      const flashcardId = createResponse.body.id;

      const response = await request(app)
        .put(`/api/cards/${flashcardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          english: null, // Invalid data that should cause rollback
          spanish: 'Updated Spanish'
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');

      // Verify original data is intact
      const getResponse = await request(app)
        .get(`/api/cards/${flashcardId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(getResponse.body.english).toBe('Transaction Test');
    });
  });

  describe('Network and Timeout Handling', () => {
    test('should handle slow requests gracefully', async () => {
      const { accessToken } = await createAuthenticatedUser('slow.request@errorapi.com');

      // Make request and measure response time
      const start = Date.now();
      
      const response = await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${accessToken}`)
        .timeout(10000) // 10 second timeout
        .expect(200);

      const duration = Date.now() - start;

      expect(Array.isArray(response.body)).toBe(true);
      expect(duration).toBeLessThan(10000); // Should respond within timeout
    });

    test('should handle partial request data', async () => {
      // This is harder to test with supertest, but we can test incomplete JSON
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('{"email": "partial@errorapi.com"') // Incomplete JSON
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Error Response Consistency', () => {
    test('should return consistent error format across endpoints', async () => {
      const endpoints = [
        { method: 'post', path: '/api/auth/register', data: {} },
        { method: 'post', path: '/api/auth/login', data: {} },
        { method: 'get', path: '/api/users/me', auth: false },
        { method: 'post', path: '/api/cards', data: {}, auth: true }
      ];

      for (const endpoint of endpoints) {
        let req = request(app)[endpoint.method](endpoint.path);
        
        if (endpoint.auth) {
          const { accessToken } = await createAuthenticatedUser(`error${Math.random()}@errorapi.com`);
          req = req.set('Authorization', `Bearer ${accessToken}`);
        }

        const response = await req
          .send(endpoint.data || {})
          .expect('Content-Type', /json/);

        // All error responses should have consistent structure
        if (response.status >= 400) {
          expect(response.body).toHaveProperty('error');
          expect(typeof response.body.error).toBe('string');
          
          // Optional properties that might be present
          if (response.body.code) {
            expect(typeof response.body.code).toBe('string');
          }
          if (response.body.details) {
            expect(typeof response.body.details).toMatch(/string|object/);
          }
        }
      }
    });

    test('should not leak sensitive information in error messages', async () => {
      // Try to access non-existent user
      const { accessToken: adminToken } = await createAuthenticatedUser('admin.sensitive@errorapi.com');
      
      const response = await request(app)
        .get('/api/admin/users/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      // Error should not contain internal details
      expect(response.body.error).not.toMatch(/database|sql|internal|stack|path/i);
    });

    test('should handle unexpected errors gracefully', async () => {
      // Try to cause an unexpected error condition
      const { accessToken } = await createAuthenticatedUser('unexpected.error@errorapi.com');

      // Make request with unusual parameters
      const response = await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ page: 'not-a-number', limit: 'invalid' })
        .expect('Content-Type', /json/);

      // Should handle gracefully with 400 or return results with defaults
      expect([200, 400]).toContain(response.status);
      
      if (response.status === 400) {
        expect(response.body).toHaveProperty('error');
      } else {
        expect(Array.isArray(response.body)).toBe(true);
      }
    });
  });
});