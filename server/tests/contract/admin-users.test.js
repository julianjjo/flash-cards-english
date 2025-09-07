import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

/**
 * Contract Test: GET /api/admin/users
 * 
 * This test validates the API contract for admin user list endpoint
 * according to the admin-api.json specification.
 * 
 * CRITICAL: This test MUST FAIL initially (TDD requirement)
 * The endpoint does not exist yet - implementation comes after tests pass
 */

describe('GET /api/admin/users - Contract Test', () => {
  let app;
  let server;
  let adminToken;
  let regularUserToken;

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
    // Set up admin and regular user tokens
    // Note: This will fail until auth endpoints are implemented
    try {
      // Login admin user (should exist from migration)
      const adminLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: process.env.ADMIN_EMAIL || 'admin@flashcards.com',
          password: process.env.ADMIN_PASS || 'admin123'
        });

      adminToken = adminLoginResponse.body.accessToken;

      // Register and login regular user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'admintest@example.com',
          password: 'password123'
        });

      const userLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admintest@example.com',
          password: 'password123'
        });

      regularUserToken = userLoginResponse.body.accessToken;
    } catch (error) {
      // Expected to fail during TDD phase
      console.log('Test user authentication failed (expected during TDD):', error.message);
      adminToken = 'mock-jwt-token-admin';
      regularUserToken = 'mock-jwt-token-user';
    }
  });

  describe('Valid Admin Requests', () => {
    test('should return 200 with paginated user list for admin', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      // Validate response structure matches contract
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('pagination');

      // Validate users array
      expect(Array.isArray(response.body.users)).toBe(true);

      // Validate pagination structure
      const pagination = response.body.pagination;
      expect(pagination).toHaveProperty('page');
      expect(pagination).toHaveProperty('limit');
      expect(pagination).toHaveProperty('total');
      expect(pagination).toHaveProperty('totalPages');

      expect(typeof pagination.page).toBe('number');
      expect(typeof pagination.limit).toBe('number');
      expect(typeof pagination.total).toBe('number');
      expect(typeof pagination.totalPages).toBe('number');
    });

    test('should return user summaries with required fields', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (response.body.users.length > 0) {
        const user = response.body.users[0];
        
        // Validate user summary structure
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('createdAt');
        expect(user).toHaveProperty('flashcardCount');

        // Validate data types
        expect(typeof user.id).toBe('number');
        expect(typeof user.email).toBe('string');
        expect(typeof user.role).toBe('string');
        expect(typeof user.createdAt).toBe('string');
        expect(typeof user.flashcardCount).toBe('number');

        // Validate role enum
        expect(['user', 'admin']).toContain(user.role);

        // Validate email format
        expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

        // Ensure sensitive fields are not returned
        expect(user).not.toHaveProperty('password');
        expect(user).not.toHaveProperty('password_hash');
      }
    });

    test('should support pagination with page parameter', async () => {
      const response = await request(app)
        .get('/api/admin/users?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
      expect(response.body.users.length).toBeLessThanOrEqual(5);
    });

    test('should support pagination with limit parameter', async () => {
      const response = await request(app)
        .get('/api/admin/users?limit=3')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.pagination.limit).toBe(3);
      expect(response.body.users.length).toBeLessThanOrEqual(3);
    });

    test('should support role filtering', async () => {
      const response = await request(app)
        .get('/api/admin/users?role=admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // All returned users should have admin role
      response.body.users.forEach(user => {
        expect(user.role).toBe('admin');
      });
    });

    test('should use default pagination values when not specified', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(20);
    });
  });

  describe('Access Control', () => {
    test('should return 403 for regular user', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect('Content-Type', /json/)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.error).toBe('FORBIDDEN');
      expect(response.body.message).toMatch(/admin.*access.*required/i);
    });

    test('should return 401 for missing Authorization header', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.error).toBe('UNAUTHORIZED');
      expect(response.body.message).toMatch(/authorization.*required/i);
    });

    test('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'Bearer invalid-token')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.error).toBe('TOKEN_INVALID');
    });
  });

  describe('Query Parameter Validation', () => {
    test('should return 400 for invalid page parameter', async () => {
      const response = await request(app)
        .get('/api/admin/users?page=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/page.*minimum.*1/i);
    });

    test('should return 400 for invalid limit parameter', async () => {
      const response = await request(app)
        .get('/api/admin/users?limit=101')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/limit.*maximum.*100/i);
    });

    test('should return 400 for negative limit', async () => {
      const response = await request(app)
        .get('/api/admin/users?limit=-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/limit.*minimum.*1/i);
    });

    test('should return 400 for invalid role filter', async () => {
      const response = await request(app)
        .get('/api/admin/users?role=invalid_role')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/role.*must.*be.*user.*admin/i);
    });

    test('should handle non-numeric page gracefully', async () => {
      const response = await request(app)
        .get('/api/admin/users?page=abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/page.*must.*be.*number/i);
    });

    test('should handle non-numeric limit gracefully', async () => {
      const response = await request(app)
        .get('/api/admin/users?limit=xyz')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/limit.*must.*be.*number/i);
    });
  });

  describe('Response Format Validation', () => {
    test('should include requestId in all responses', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .expect(401);

      expect(response.body).toHaveProperty('requestId');
      expect(typeof response.body.requestId).toBe('string');
    });

    test('should return consistent error structure', async () => {
      const response = await request(app)
        .get('/api/admin/users?page=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      // Validate error response structure matches contract
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.message).toBe('string');
    });

    test('should calculate pagination correctly', async () => {
      const response = await request(app)
        .get('/api/admin/users?page=2&limit=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const { pagination } = response.body;
      
      if (pagination.total > 1) {
        expect(pagination.page).toBe(2);
        expect(pagination.limit).toBe(1);
        expect(pagination.totalPages).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('Security Validation', () => {
    test('should not expose sensitive user information in list', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.users.forEach(user => {
        // Ensure sensitive fields are not exposed
        const sensitiveFields = [
          'password',
          'password_hash',
          'refresh_token',
          'password_salt'
        ];

        for (const field of sensitiveFields) {
          expect(user).not.toHaveProperty(field);
        }
      });
    });

    test('should only be accessible with valid admin token', async () => {
      // Test various non-admin scenarios
      const invalidScenarios = [
        { token: null, description: 'no token' },
        { token: 'Bearer invalid', description: 'invalid token' },
        { token: regularUserToken, description: 'regular user token' }
      ];

      for (const scenario of invalidScenarios) {
        const requestBuilder = request(app).get('/api/admin/users');
        
        if (scenario.token) {
          requestBuilder.set('Authorization', `Bearer ${scenario.token}`);
        }

        const response = await requestBuilder;
        expect([401, 403]).toContain(response.status);
      }
    });
  });

  describe('HTTP Method Validation', () => {
    test('should only accept GET requests', async () => {
      const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        const response = await request(app)
          [method.toLowerCase()]('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(405);

        expect(response.body.error).toBe('METHOD_NOT_ALLOWED');
      }
    });

    test('should return proper Allow header for unsupported methods', async () => {
      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(405);

      expect(response.headers.allow).toBe('GET');
    });
  });
});