import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

/**
 * Contract Test: POST /api/auth/login
 * 
 * This test validates the API contract for user login endpoint
 * according to the auth-api.json specification.
 * 
 * CRITICAL: This test MUST FAIL initially (TDD requirement)
 * The endpoint does not exist yet - implementation comes after tests pass
 */

describe('POST /api/auth/login - Contract Test', () => {
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
    // Set up test user for login tests
    // Note: This will fail until registration endpoint is implemented
    try {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'logintest@example.com',
          password: 'password123'
        });
    } catch (error) {
      // Expected to fail during TDD phase
      console.log('Test user setup failed (expected during TDD):', error.message);
    }
  });

  describe('Valid Login Request', () => {
    test('should return 200 with access token and user profile for valid credentials', async () => {
      const loginData = {
        email: 'logintest@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect('Content-Type', /json/)
        .expect(200);

      // Validate response structure matches contract
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
      expect(typeof response.body.accessToken).toBe('string');
      
      // Validate JWT token format (3 parts separated by dots)
      const tokenParts = response.body.accessToken.split('.');
      expect(tokenParts).toHaveLength(3);

      // Validate user profile structure
      const user = response.body.user;
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email', 'logintest@example.com');
      expect(user).toHaveProperty('role');
      expect(user).toHaveProperty('createdAt');
      expect(['user', 'admin']).toContain(user.role);

      // Ensure password is not returned
      expect(user).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('password_hash');
    });

    test('should set httpOnly refresh token cookie', async () => {
      const loginData = {
        email: 'logintest@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      // Check for Set-Cookie header with refresh token
      expect(response.headers['set-cookie']).toBeDefined();
      const cookies = response.headers['set-cookie'];
      const refreshTokenCookie = cookies.find(cookie => cookie.includes('refreshToken'));
      
      expect(refreshTokenCookie).toBeDefined();
      expect(refreshTokenCookie).toMatch(/httpOnly/i);
      expect(refreshTokenCookie).toMatch(/secure/i); // In production
    });

    test('should accept case-insensitive email', async () => {
      const loginData = {
        email: 'LOGINTEST@EXAMPLE.COM',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.user.email).toBe('logintest@example.com');
    });
  });

  describe('Invalid Login Requests', () => {
    test('should return 401 for non-existent email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.error).toBe('INVALID_CREDENTIALS');
      expect(response.body.message).toMatch(/invalid.*credentials/i);
    });

    test('should return 401 for incorrect password', async () => {
      const loginData = {
        email: 'logintest@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.error).toBe('INVALID_CREDENTIALS');
      expect(response.body.message).toMatch(/invalid.*credentials/i);
    });

    test('should return 400 for missing email', async () => {
      const loginData = {
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/email/i);
    });

    test('should return 400 for missing password', async () => {
      const loginData = {
        email: 'logintest@example.com'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/password/i);
    });

    test('should return 400 for invalid email format', async () => {
      const loginData = {
        email: 'invalid-email',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/email/i);
    });
  });

  describe('Rate Limiting', () => {
    test('should return 429 for too many failed login attempts', async () => {
      const loginData = {
        email: 'logintest@example.com',
        password: 'wrongpassword'
      };

      // Attempt multiple failed logins
      const attempts = [];
      for (let i = 0; i < 6; i++) {
        attempts.push(
          request(app)
            .post('/api/auth/login')
            .send(loginData)
        );
      }

      await Promise.all(attempts);

      // Next attempt should be rate limited
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect('Content-Type', /json/)
        .expect(429);

      expect(response.body.error).toBe('TOO_MANY_ATTEMPTS');
      expect(response.body.message).toMatch(/too many.*attempts/i);
    });
  });

  describe('Response Format Validation', () => {
    test('should include requestId in all responses', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' })
        .expect(401);

      expect(response.body).toHaveProperty('requestId');
      expect(typeof response.body.requestId).toBe('string');
    });

    test('should return consistent error structure', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      // Validate error response structure matches contract
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.message).toBe('string');
    });
  });

  describe('Security Validation', () => {
    test('should not reveal whether email exists in error messages', async () => {
      const nonExistentResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        })
        .expect(401);

      const wrongPasswordResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      // Both should return the same generic message
      expect(nonExistentResponse.body.message).toBe(wrongPasswordResponse.body.message);
    });

    test('should use timing-safe password comparison', async () => {
      // This test ensures constant-time comparison to prevent timing attacks
      const start1 = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'a' // Very short wrong password
        })
        .expect(401);
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'verylongwrongpasswordthatdoesnotmatch'
        })
        .expect(401);
      const time2 = Date.now() - start2;

      // Timing should be similar (within reasonable bounds)
      // This is a basic check - real timing attack prevention happens at bcrypt level
      const timeDifference = Math.abs(time1 - time2);
      expect(timeDifference).toBeLessThan(100); // Allow 100ms variance
    });
  });
});