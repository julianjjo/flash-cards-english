import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

/**
 * Contract Test: POST /api/auth/register
 * 
 * This test validates the API contract for user registration endpoint
 * according to the auth-api.json specification.
 * 
 * CRITICAL: This test MUST FAIL initially (TDD requirement)
 * The endpoint does not exist yet - implementation comes after tests pass
 */

describe('POST /api/auth/register - Contract Test', () => {
  let app;
  let server;

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
    // Clean up users table for each test
    // Note: This will fail until database and models are implemented
    try {
      const { default: db } = await import('../../config/database.js');
      await db.initialize();
      db.getDatabase().prepare('DELETE FROM users WHERE email LIKE ?').run('%test%');
    } catch (error) {
      // Expected to fail during TDD phase - database not set up yet
      console.log('Database cleanup failed (expected during TDD):', error.message);
    }
  });

  describe('Valid Registration Request', () => {
    test('should return 201 with user profile for valid registration data', async () => {
      const registrationData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect('Content-Type', /json/)
        .expect(201);

      // Validate response structure matches contract
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email', 'test@example.com');
      expect(response.body).toHaveProperty('role', 'user');
      expect(response.body).toHaveProperty('createdAt');
      expect(typeof response.body.id).toBe('number');
      expect(typeof response.body.createdAt).toBe('string');
      
      // Ensure password is not returned
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('password_hash');
    });

    test('should store email in lowercase', async () => {
      const registrationData = {
        email: 'TEST@EXAMPLE.COM',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect(201);

      expect(response.body.email).toBe('test@example.com');
    });
  });

  describe('Invalid Registration Requests', () => {
    test('should return 400 for missing email', async () => {
      const registrationData = {
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/email/i);
    });

    test('should return 400 for missing password', async () => {
      const registrationData = {
        email: 'test@example.com'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/password/i);
    });

    test('should return 400 for invalid email format', async () => {
      const registrationData = {
        email: 'invalid-email',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/email/i);
    });

    test('should return 400 for password shorter than 8 characters', async () => {
      const registrationData = {
        email: 'test@example.com',
        password: 'short'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/password.*8/i);
    });

    test('should return 409 for duplicate email registration', async () => {
      const registrationData = {
        email: 'duplicate@example.com',
        password: 'password123'
      };

      // First registration should succeed
      await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect(201);

      // Second registration with same email should fail
      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect('Content-Type', /json/)
        .expect(409);

      expect(response.body.error).toBe('EMAIL_ALREADY_EXISTS');
      expect(response.body.message).toMatch(/already.*registered/i);
    });
  });

  describe('Response Format Validation', () => {
    test('should include requestId in error responses', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('requestId');
      expect(typeof response.body.requestId).toBe('string');
    });

    test('should return consistent error structure', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({})
        .expect(400);

      // Validate error response structure matches contract
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.message).toBe('string');
    });
  });

  describe('Content-Type Validation', () => {
    test('should reject non-JSON requests', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send('email=test@example.com&password=password123')
        .expect(400);

      expect(response.body.error).toBe('INVALID_CONTENT_TYPE');
    });

    test('should require Content-Type: application/json', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'text/plain')
        .send('{"email":"test@example.com","password":"password123"}')
        .expect(400);

      expect(response.body.error).toBe('INVALID_CONTENT_TYPE');
    });
  });
});