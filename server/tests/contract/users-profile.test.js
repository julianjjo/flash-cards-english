import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

/**
 * Contract Test: GET /api/users/me
 * 
 * This test validates the API contract for user profile endpoint
 * according to the auth-api.json specification.
 * 
 * CRITICAL: This test MUST FAIL initially (TDD requirement)
 * The endpoint does not exist yet - implementation comes after tests pass
 */

describe('GET /api/users/me - Contract Test', () => {
  let app;
  let server;
  let testUserToken;
  let adminUserToken;

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
    // Set up authenticated users for profile tests
    // Note: This will fail until auth endpoints are implemented
    try {
      // Register and login regular user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'profiletest@example.com',
          password: 'password123'
        });

      const userLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'profiletest@example.com',
          password: 'password123'
        });

      testUserToken = userLoginResponse.body.accessToken;

      // Login admin user (should exist from migration)
      const adminLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: process.env.ADMIN_EMAIL || 'admin@flashcards.com',
          password: process.env.ADMIN_PASS || 'admin123'
        });

      adminUserToken = adminLoginResponse.body.accessToken;
    } catch (error) {
      // Expected to fail during TDD phase
      console.log('Test user authentication failed (expected during TDD):', error.message);
      testUserToken = 'mock-jwt-token-user';
      adminUserToken = 'mock-jwt-token-admin';
    }
  });

  describe('Valid Profile Request', () => {
    test('should return 200 with user profile for authenticated user', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      // Validate response structure matches contract
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('role');
      expect(response.body).toHaveProperty('createdAt');

      // Validate data types
      expect(typeof response.body.id).toBe('number');
      expect(typeof response.body.email).toBe('string');
      expect(typeof response.body.role).toBe('string');
      expect(typeof response.body.createdAt).toBe('string');

      // Validate role is valid enum value
      expect(['user', 'admin']).toContain(response.body.role);

      // Validate email format
      expect(response.body.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

      // Validate createdAt is ISO timestamp
      expect(response.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // Ensure sensitive fields are not returned
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('password_hash');
    });

    test('should return correct profile for regular user', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(response.body.email).toBe('profiletest@example.com');
      expect(response.body.role).toBe('user');
    });

    test('should return correct profile for admin user', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .expect(200);

      expect(response.body.role).toBe('admin');
      expect(response.body.email).toBe(process.env.ADMIN_EMAIL || 'admin@flashcards.com');
    });
  });

  describe('Unauthenticated Profile Requests', () => {
    test('should return 401 for missing Authorization header', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.error).toBe('UNAUTHORIZED');
      expect(response.body.message).toMatch(/authorization.*required/i);
    });

    test('should return 401 for invalid Authorization header format', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'InvalidFormat token')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.error).toBe('INVALID_TOKEN_FORMAT');
      expect(response.body.message).toMatch(/bearer.*token/i);
    });

    test('should return 401 for expired JWT token', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.error).toBe('TOKEN_EXPIRED');
      expect(response.body.message).toMatch(/token.*expired/i);
    });

    test('should return 401 for malformed JWT token', async () => {
      const malformedToken = 'not.a.valid.jwt.token';

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${malformedToken}`)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.error).toBe('TOKEN_INVALID');
      expect(response.body.message).toMatch(/invalid.*token/i);
    });

    test('should return 401 for JWT token with invalid signature', async () => {
      const invalidSignatureToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNjE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.invalid_signature';

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${invalidSignatureToken}`)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.error).toBe('TOKEN_INVALID');
      expect(response.body.message).toMatch(/invalid.*signature/i);
    });

    test('should return 401 for blacklisted JWT token', async () => {
      // Simulate a token that has been blacklisted (logged out)
      const blacklistedToken = testUserToken;

      // First logout the token
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${blacklistedToken}`)
        .expect(200);

      // Then try to use it for profile
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${blacklistedToken}`)
        .expect(401);

      expect(response.body.error).toBe('TOKEN_INVALID');
    });
  });

  describe('Response Format Validation', () => {
    test('should include requestId in all responses', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .expect(401);

      expect(response.body).toHaveProperty('requestId');
      expect(typeof response.body.requestId).toBe('string');
    });

    test('should return consistent error structure', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid')
        .expect(401);

      // Validate error response structure matches contract
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.message).toBe('string');
    });

    test('should return profile with all required fields and correct types', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      // Check all required fields exist
      const requiredFields = ['id', 'email', 'role', 'createdAt'];
      for (const field of requiredFields) {
        expect(response.body).toHaveProperty(field);
      }

      // Check field types match contract
      expect(typeof response.body.id).toBe('number');
      expect(typeof response.body.email).toBe('string');
      expect(typeof response.body.role).toBe('string');
      expect(typeof response.body.createdAt).toBe('string');

      // Validate enum constraints
      expect(['user', 'admin']).toContain(response.body.role);
    });
  });

  describe('Security Validation', () => {
    test('should not expose sensitive user information', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      // Ensure sensitive fields are not exposed
      const sensitiveFields = [
        'password',
        'password_hash',
        'refresh_token',
        'password_salt',
        'internal_id',
        'hash'
      ];

      for (const field of sensitiveFields) {
        expect(response.body).not.toHaveProperty(field);
      }
    });

    test('should only return profile for token owner', async () => {
      // This test ensures token validation returns correct user data
      const userResponse = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      const adminResponse = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .expect(200);

      // Should return different users
      expect(userResponse.body.id).not.toBe(adminResponse.body.id);
      expect(userResponse.body.email).not.toBe(adminResponse.body.email);
      expect(userResponse.body.role).toBe('user');
      expect(adminResponse.body.role).toBe('admin');
    });

    test('should validate JWT token signature with correct secret', async () => {
      // Token with valid format but signed with wrong secret
      const wrongSecretToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNjE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.wrong_secret_signature';

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${wrongSecretToken}`)
        .expect(401);

      expect(response.body.error).toBe('TOKEN_INVALID');
    });
  });

  describe('HTTP Method Validation', () => {
    test('should only accept GET requests', async () => {
      const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        const response = await request(app)
          [method.toLowerCase()]('/api/users/me')
          .set('Authorization', `Bearer ${testUserToken}`)
          .expect(405);

        expect(response.body.error).toBe('METHOD_NOT_ALLOWED');
      }
    });

    test('should return proper Allow header for unsupported methods', async () => {
      const response = await request(app)
        .post('/api/users/me')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(405);

      expect(response.headers.allow).toBe('GET');
    });
  });
});