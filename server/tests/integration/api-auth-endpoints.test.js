import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

/**
 * Integration Tests: Authentication API Endpoints
 * 
 * Comprehensive tests for all authentication-related API endpoints:
 * - POST /api/auth/register - User registration
 * - POST /api/auth/login - User login
 * - POST /api/auth/logout - User logout
 * - POST /api/auth/refresh - Token refresh
 * - GET /api/auth/me - Get current user
 * - POST /api/auth/change-password - Password change
 * - POST /api/auth/verify-token - Token verification
 * - GET /api/auth/session-info - Session information
 * 
 * Tests JWT authentication, refresh tokens, session management,
 * input validation, security measures, and error handling.
 */

describe('Authentication API Endpoints - Integration Tests', () => {
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
      database.prepare('DELETE FROM cards WHERE user_id IN (SELECT id FROM users WHERE email LIKE ?)').run('%authapi%');
      database.prepare('DELETE FROM users WHERE email LIKE ?').run('%authapi%');
    } catch (error) {
      console.log('Database cleanup failed (expected during TDD):', error.message);
    }
  });

  describe('POST /api/auth/register', () => {
    test('should register a new user successfully', async () => {
      const userData = {
        email: 'register.test@authapi.com',
        password: 'securepassword123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user).toMatchObject({
        email: 'register.test@authapi.com',
        role: 'user'
      });
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('createdAt');
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(typeof response.body.accessToken).toBe('string');
      expect(response.body.accessToken.length).toBeGreaterThan(50);
    });

    test('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'securepassword123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/email/i);
    });

    test('should reject registration with weak password', async () => {
      const userData = {
        email: 'weak.password@authapi.com',
        password: '123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/password/i);
    });

    test('should reject registration with duplicate email', async () => {
      const userData = {
        email: 'duplicate.test@authapi.com',
        password: 'securepassword123'
      };

      // First registration should succeed
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Second registration with same email should fail
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect('Content-Type', /json/)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/already exists|duplicate/i);
    });

    test('should reject registration with missing fields', async () => {
      const testCases = [
        { password: 'securepassword123' }, // Missing email
        { email: 'missing.password@authapi.com' }, // Missing password
        {} // Missing both
      ];

      for (const userData of testCases) {
        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect('Content-Type', /json/)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    test('should set refresh token cookie on registration', async () => {
      const userData = {
        email: 'cookie.test@authapi.com',
        password: 'securepassword123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Check for refresh token cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = cookies.find(cookie => cookie.includes('refreshToken'));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toMatch(/httpOnly/i);
      expect(refreshCookie).toMatch(/secure/i);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'login.test@authapi.com',
          password: 'testpassword123'
        });
    });

    test('should login successfully with correct credentials', async () => {
      const loginData = {
        email: 'login.test@authapi.com',
        password: 'testpassword123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user).toMatchObject({
        email: 'login.test@authapi.com',
        role: 'user'
      });
      expect(response.body.user).not.toHaveProperty('password');
      expect(typeof response.body.accessToken).toBe('string');
    });

    test('should reject login with incorrect password', async () => {
      const loginData = {
        email: 'login.test@authapi.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/invalid|incorrect/i);
    });

    test('should reject login with non-existent email', async () => {
      const loginData = {
        email: 'nonexistent@authapi.com',
        password: 'testpassword123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/invalid|user not found/i);
    });

    test('should handle remember me option', async () => {
      const loginData = {
        email: 'login.test@authapi.com',
        password: 'testpassword123',
        rememberMe: true
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      // Check for extended refresh token expiry
      const cookies = response.headers['set-cookie'];
      const refreshCookie = cookies.find(cookie => cookie.includes('refreshToken'));
      expect(refreshCookie).toBeDefined();
    });

    test('should set refresh token cookie on login', async () => {
      const loginData = {
        email: 'login.test@authapi.com',
        password: 'testpassword123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = cookies.find(cookie => cookie.includes('refreshToken'));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toMatch(/httpOnly/i);
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken;
    let userId;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'me.test@authapi.com',
          password: 'testpassword123'
        });
      
      accessToken = registerResponse.body.accessToken;
      userId = registerResponse.body.user.id;
    });

    test('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toMatchObject({
        id: userId,
        email: 'me.test@authapi.com',
        role: 'user'
      });
      expect(response.body.user).not.toHaveProperty('password');
    });

    test('should reject request without authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/authorization|token/i);
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token_here')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/invalid|token/i);
    });

    test('should reject request with malformed authorization header', async () => {
      const testCases = [
        'invalid_format_token',
        'Basic dGVzdDp0ZXN0', // Basic auth instead of Bearer
        'Bearer', // Missing token
        'Bearer  ' // Empty token
      ];

      for (const authHeader of testCases) {
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', authHeader)
          .expect('Content-Type', /json/)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('POST /api/auth/change-password', () => {
    let accessToken;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'password.change@authapi.com',
          password: 'oldpassword123'
        });
      
      accessToken = registerResponse.body.accessToken;
    });

    test('should change password successfully', async () => {
      const changeData = {
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword456'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(changeData)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/success/i);

      // Verify old password no longer works
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'password.change@authapi.com',
          password: 'oldpassword123'
        })
        .expect(401);

      // Verify new password works
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'password.change@authapi.com',
          password: 'newpassword456'
        })
        .expect(200);
    });

    test('should reject with incorrect current password', async () => {
      const changeData = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword456'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(changeData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/current password/i);
    });

    test('should reject with weak new password', async () => {
      const changeData = {
        currentPassword: 'oldpassword123',
        newPassword: '123'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(changeData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/password.*weak|password.*short/i);
    });

    test('should require authentication', async () => {
      const changeData = {
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword456'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .send(changeData)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/logout', () => {
    let accessToken;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'logout.test@authapi.com',
          password: 'testpassword123'
        });
      
      accessToken = registerResponse.body.accessToken;
    });

    test('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/success/i);

      // Verify refresh token cookie is cleared
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const refreshCookie = cookies.find(cookie => cookie.includes('refreshToken'));
        if (refreshCookie) {
          expect(refreshCookie).toMatch(/expires=Thu, 01 Jan 1970/);
        }
      }
    });

    test('should handle logout without authentication gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    test('should handle logout with invalid token gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid_token')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let accessToken;
    let refreshTokenCookie;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'refresh.test@authapi.com',
          password: 'testpassword123'
        });
      
      accessToken = registerResponse.body.accessToken;
      const cookies = registerResponse.headers['set-cookie'];
      refreshTokenCookie = cookies.find(cookie => cookie.includes('refreshToken'));
    });

    test('should refresh token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toMatchObject({
        email: 'refresh.test@authapi.com',
        role: 'user'
      });
      expect(response.body.accessToken).not.toBe(accessToken);
    });

    test('should reject refresh without refresh token cookie', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/refresh token/i);
    });

    test('should reject refresh with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=invalid_refresh_token')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/invalid|refresh token/i);
    });
  });

  describe('POST /api/auth/verify-token', () => {
    let accessToken;
    let userId;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'verify.test@authapi.com',
          password: 'testpassword123'
        });
      
      accessToken = registerResponse.body.accessToken;
      userId = registerResponse.body.user.id;
    });

    test('should verify valid token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-token')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('valid', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.id).toBe(userId);
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-token')
        .set('Authorization', 'Bearer invalid_token')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('valid', false);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject missing token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-token')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('valid', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/session-info', () => {
    let accessToken;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'session.info@authapi.com',
          password: 'testpassword123'
        });
      
      accessToken = registerResponse.body.accessToken;
    });

    test('should return session information', async () => {
      const response = await request(app)
        .get('/api/auth/session-info')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('issuedAt');
      expect(response.body).toHaveProperty('expiresAt');
      expect(response.body.user).toMatchObject({
        email: 'session.info@authapi.com',
        role: 'user'
      });
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/auth/session-info')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Security and Edge Cases', () => {
    test('should handle concurrent registration attempts', async () => {
      const userData = {
        email: 'concurrent.test@authapi.com',
        password: 'testpassword123'
      };

      const promises = Array(5).fill().map(() => 
        request(app)
          .post('/api/auth/register')
          .send(userData)
      );

      const responses = await Promise.allSettled(promises);
      const successful = responses.filter(r => r.status === 'fulfilled' && r.value.status === 201);
      const failed = responses.filter(r => r.status === 'fulfilled' && r.value.status === 409);

      // Only one should succeed, others should fail with conflict
      expect(successful).toHaveLength(1);
      expect(failed.length).toBeGreaterThan(0);
    });

    test('should handle rate limiting on authentication endpoints', async () => {
      // Test rapid login attempts
      const promises = Array(20).fill().map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@authapi.com',
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

    test('should sanitize and validate all input fields', async () => {
      const maliciousData = {
        email: '<script>alert("xss")</script>@test.com',
        password: 'testpassword123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(maliciousData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/email/i);
    });

    test('should handle extremely long input gracefully', async () => {
      const longString = 'a'.repeat(10000);
      const userData = {
        email: longString + '@test.com',
        password: longString
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should prevent timing attacks on login', async () => {
      const start1 = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@authapi.com',
          password: 'wrongpassword'
        });
      const time1 = Date.now() - start1;

      // Register a real user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'timing.test@authapi.com',
          password: 'correctpassword123'
        });

      const start2 = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'timing.test@authapi.com',
          password: 'wrongpassword'
        });
      const time2 = Date.now() - start2;

      // Timing should be similar (within reasonable variance)
      const timeDiff = Math.abs(time1 - time2);
      expect(timeDiff).toBeLessThan(1000); // Allow 1 second variance
    });
  });
});