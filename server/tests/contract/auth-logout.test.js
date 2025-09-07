import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

/**
 * Contract Test: POST /api/auth/logout
 * 
 * This test validates the API contract for user logout endpoint
 * according to the auth-api.json specification.
 * 
 * CRITICAL: This test MUST FAIL initially (TDD requirement)
 * The endpoint does not exist yet - implementation comes after tests pass
 */

describe('POST /api/auth/logout - Contract Test', () => {
  let app;
  let server;
  let testUserToken;
  let testUserCookie;

  beforeAll(async () => {
    // Import app after environment setup
    const { default: appModule } = await import('../../index.js');
    app = appModule;
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(async () => {
    // Set up authenticated user for logout tests
    // Note: This will fail until login endpoint is implemented
    try {
      // Register test user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'logouttest@example.com',
          password: 'password123'
        });

      // Login to get tokens
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logouttest@example.com',
          password: 'password123'
        });

      testUserToken = loginResponse.body.accessToken;
      testUserCookie = loginResponse.headers['set-cookie'];
    } catch (error) {
      // Expected to fail during TDD phase
      console.log('Test user authentication failed (expected during TDD):', error.message);
      testUserToken = 'mock-jwt-token-for-testing';
      testUserCookie = ['refreshToken=mock-refresh-token; HttpOnly'];
    }
  });

  describe('Valid Logout Request', () => {
    test('should return 200 with success message for authenticated user', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${testUserToken}`)
        .set('Cookie', testUserCookie)
        .expect('Content-Type', /json/)
        .expect(200);

      // Validate response structure matches contract
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
      expect(response.body.message).toMatch(/logout.*successful/i);
    });

    test('should clear refresh token cookie', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${testUserToken}`)
        .set('Cookie', testUserCookie)
        .expect(200);

      // Check for Set-Cookie header that clears the refresh token
      expect(response.headers['set-cookie']).toBeDefined();
      const cookies = response.headers['set-cookie'];
      const clearCookie = cookies.find(cookie => 
        cookie.includes('refreshToken=') && cookie.includes('expires=')
      );
      
      expect(clearCookie).toBeDefined();
      // Cookie should be set to expire in the past
      expect(clearCookie).toMatch(/expires=.*Thu.*01.*Jan.*1970/i);
    });

    test('should invalidate access token', async () => {
      // First logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      // Try to use the same token for protected resource
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(401);

      expect(response.body.error).toBe('TOKEN_INVALID');
    });
  });

  describe('Unauthenticated Logout Requests', () => {
    test('should return 401 for missing Authorization header', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.error).toBe('UNAUTHORIZED');
      expect(response.body.message).toMatch(/authorization.*required/i);
    });

    test('should return 401 for invalid Authorization header format', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'InvalidFormat token')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.error).toBe('INVALID_TOKEN_FORMAT');
      expect(response.body.message).toMatch(/bearer.*token/i);
    });

    test('should return 401 for expired JWT token', async () => {
      // Mock expired token (this would be generated with past expiration)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.error).toBe('TOKEN_EXPIRED');
      expect(response.body.message).toMatch(/token.*expired/i);
    });

    test('should return 401 for malformed JWT token', async () => {
      const malformedToken = 'not.a.valid.jwt.token';

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${malformedToken}`)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.error).toBe('TOKEN_INVALID');
      expect(response.body.message).toMatch(/invalid.*token/i);
    });

    test('should return 401 for JWT token with invalid signature', async () => {
      // Token with valid format but wrong signature
      const invalidSignatureToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNjE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.invalid_signature';

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${invalidSignatureToken}`)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.error).toBe('TOKEN_INVALID');
      expect(response.body.message).toMatch(/invalid.*signature/i);
    });
  });

  describe('Already Logged Out Token', () => {
    test('should handle logout of already blacklisted token gracefully', async () => {
      // First logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      // Second logout with same token
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.error).toBe('TOKEN_INVALID');
      expect(response.body.message).toMatch(/invalid.*token/i);
    });
  });

  describe('Response Format Validation', () => {
    test('should include requestId in all responses', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body).toHaveProperty('requestId');
      expect(typeof response.body.requestId).toBe('string');
    });

    test('should return consistent error structure', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid')
        .expect(401);

      // Validate error response structure matches contract
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.message).toBe('string');
    });

    test('should return consistent success structure', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      // Validate success response structure matches contract
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.success).toBe('boolean');
      expect(typeof response.body.message).toBe('string');
    });
  });

  describe('Security Validation', () => {
    test('should not accept logout without proper authentication', async () => {
      // Test various invalid auth scenarios
      const invalidAuthScenarios = [
        { header: null, description: 'no auth header' },
        { header: 'Bearer ', description: 'empty token' },
        { header: 'Basic dGVzdDp0ZXN0', description: 'wrong auth type' },
        { header: 'Bearer token-without-dots', description: 'malformed JWT' }
      ];

      for (const scenario of invalidAuthScenarios) {
        const request_builder = request(app).post('/api/auth/logout');
        
        if (scenario.header) {
          request_builder.set('Authorization', scenario.header);
        }

        const response = await request_builder.expect(401);
        expect(response.body.error).toMatch(/UNAUTHORIZED|INVALID_TOKEN_FORMAT|TOKEN_INVALID/);
      }
    });

    test('should prevent logout with tokens from different secret', async () => {
      // Token signed with different secret (would fail signature verification)
      const wrongSecretToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNjE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.wrong_secret_signature';

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${wrongSecretToken}`)
        .expect(401);

      expect(response.body.error).toBe('TOKEN_INVALID');
    });
  });
});