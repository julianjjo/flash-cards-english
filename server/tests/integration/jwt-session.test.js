import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

/**
 * Integration Test: JWT Token Refresh and Session Management
 * 
 * Tests the complete JWT session lifecycle including token refresh,
 * blacklisting, expiration handling, and session security.
 * 
 * CRITICAL: This test MUST FAIL initially (TDD requirement)
 * JWT session management must be implemented with proper security
 */

describe('JWT Session Management - Integration Test', () => {
  let app;
  let server;
  let testUser = {};

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
    // Clean up test data
    try {
      const { default: db } = await import('../../config/database.js');
      await db.initialize();
      
      const database = db.getDatabase();
      database.prepare('DELETE FROM cards WHERE user_id IN (SELECT id FROM users WHERE email LIKE ?)').run('%jwt.test%');
      database.prepare('DELETE FROM users WHERE email LIKE ?').run('%jwt.test%');
    } catch (error) {
      console.log('Database cleanup failed (expected during TDD):', error.message);
    }

    // Set up test user
    try {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'jwt.test@example.com',
          password: 'securepassword123'
        })
        .expect(201);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'jwt.test@example.com',
          password: 'securepassword123'
        })
        .expect(200);

      testUser = {
        id: registerResponse.body.id,
        email: 'jwt.test@example.com',
        accessToken: loginResponse.body.accessToken,
        refreshCookie: loginResponse.headers['set-cookie']
      };
    } catch (error) {
      console.log('Test user setup failed (expected during TDD):', error.message);
      testUser = {
        id: 1,
        email: 'jwt.test@example.com',
        accessToken: 'mock-access-token',
        refreshCookie: ['refreshToken=mock-refresh-token; HttpOnly']
      };
    }
  });

  describe('Token Validation and Usage', () => {
    test('valid access token should allow access to protected resources', async () => {
      // Access user profile
      const profileResponse = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200);

      expect(profileResponse.body).toMatchObject({
        id: testUser.id,
        email: testUser.email,
        role: 'user'
      });

      // Create flashcard
      const flashcardResponse = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          english: 'JWT Test Card',
          spanish: 'Tarjeta Prueba JWT'
        })
        .expect(201);

      expect(flashcardResponse.body.userId).toBe(testUser.id);

      // Access flashcards
      const flashcardsResponse = await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200);

      expect(flashcardsResponse.body).toHaveLength(1);
      expect(flashcardsResponse.body[0].id).toBe(flashcardResponse.body.id);
    });

    test('invalid access token should be rejected', async () => {
      const invalidTokens = [
        'invalid-token',
        'Bearer invalid-token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid'
      ];

      for (const token of invalidTokens) {
        await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);
      }
    });

    test('expired access token should be rejected', async () => {
      // Create a token with past expiration (mock expired token)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNjE2MjM5MDIyLCJleHAiOjE2MTYyMzkwMjJ9.expired';

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error).toBe('TOKEN_EXPIRED');
    });

    test('malformed JWT structure should be rejected', async () => {
      const malformedTokens = [
        'not.a.valid.jwt.token.with.too.many.parts',
        'only.two.parts',
        'singlepart',
        '',
        'Bearer ',
        'Basic dGVzdDp0ZXN0' // Basic auth instead of JWT
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .get('/api/users/me')
          .set('Authorization', token)
          .expect(401);

        expect([
          'TOKEN_INVALID',
          'INVALID_TOKEN_FORMAT',
          'UNAUTHORIZED'
        ]).toContain(response.body.error);
      }
    });
  });

  describe('Token Refresh Mechanism', () => {
    test('should refresh access token with valid refresh token', async () => {
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', testUser.refreshCookie)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(refreshResponse.body).toHaveProperty('accessToken');
      expect(typeof refreshResponse.body.accessToken).toBe('string');

      // New token should be different from original
      expect(refreshResponse.body.accessToken).not.toBe(testUser.accessToken);

      // New token should work for protected resources
      const profileResponse = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${refreshResponse.body.accessToken}`)
        .expect(200);

      expect(profileResponse.body.id).toBe(testUser.id);

      // Should set new refresh token cookie
      expect(refreshResponse.headers['set-cookie']).toBeDefined();
      const newRefreshCookie = refreshResponse.headers['set-cookie'];
      expect(newRefreshCookie.some(cookie => cookie.includes('refreshToken='))).toBe(true);
    });

    test('should reject refresh request without refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.error).toBe('REFRESH_TOKEN_REQUIRED');
      expect(response.body.message).toMatch(/refresh.*token.*required/i);
    });

    test('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=invalid-refresh-token')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.error).toBe('INVALID_REFRESH_TOKEN');
    });

    test('should implement refresh token rotation', async () => {
      // First refresh
      const firstRefresh = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', testUser.refreshCookie)
        .expect(200);

      const firstNewRefreshCookie = firstRefresh.headers['set-cookie'];

      // Second refresh with new refresh token
      const secondRefresh = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', firstNewRefreshCookie)
        .expect(200);

      // Should get another new refresh token
      expect(secondRefresh.headers['set-cookie']).toBeDefined();

      // Original refresh token should no longer work
      await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', testUser.refreshCookie)
        .expect(401);
    });
  });

  describe('Session Logout and Token Blacklisting', () => {
    test('logout should invalidate access token and clear refresh token', async () => {
      // Verify token works before logout
      await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200);

      // Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .set('Cookie', testUser.refreshCookie)
        .expect(200);

      expect(logoutResponse.body.success).toBe(true);

      // Should clear refresh token cookie
      expect(logoutResponse.headers['set-cookie']).toBeDefined();
      const clearCookie = logoutResponse.headers['set-cookie'].find(cookie => 
        cookie.includes('refreshToken=') && cookie.includes('expires=')
      );
      expect(clearCookie).toBeDefined();

      // Access token should no longer work
      await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(401);

      // Refresh token should no longer work
      await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', testUser.refreshCookie)
        .expect(401);
    });

    test('should maintain blacklist across server operations', async () => {
      // Create flashcard to verify functionality
      await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .send({
          english: 'Before Logout',
          spanish: 'Antes del Logout'
        })
        .expect(201);

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200);

      // Try multiple operations with blacklisted token
      const operations = [
        () => request(app).get('/api/users/me').set('Authorization', `Bearer ${testUser.accessToken}`),
        () => request(app).get('/api/cards').set('Authorization', `Bearer ${testUser.accessToken}`),
        () => request(app).post('/api/cards').set('Authorization', `Bearer ${testUser.accessToken}`).send({ english: 'test', spanish: 'test' }),
        () => request(app).post('/api/auth/logout').set('Authorization', `Bearer ${testUser.accessToken}`)
      ];

      for (const operation of operations) {
        await operation().expect(401);
      }
    });

    test('should handle multiple logout attempts gracefully', async () => {
      // First logout should succeed
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200);

      // Second logout with same token should fail gracefully
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(401);
    });
  });

  describe('Session Security', () => {
    test('should prevent session fixation attacks', async () => {
      // Get new login tokens
      const newLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'securepassword123'
        })
        .expect(200);

      const newAccessToken = newLoginResponse.body.accessToken;
      const newRefreshCookie = newLoginResponse.headers['set-cookie'];

      // New tokens should be different from original
      expect(newAccessToken).not.toBe(testUser.accessToken);

      // Old tokens should still work (haven't been logged out)
      await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200);

      // New tokens should work
      await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      // Logout with new token should not affect old token
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .set('Cookie', newRefreshCookie)
        .expect(200);

      // Old token should still work
      await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200);

      // New token should be invalidated
      await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(401);
    });

    test('should prevent token reuse across different users', async () => {
      // Create second user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'jwt.test2@example.com',
          password: 'password123'
        })
        .expect(201);

      const user2LoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'jwt.test2@example.com',
          password: 'password123'
        })
        .expect(200);

      const user2Token = user2LoginResponse.body.accessToken;

      // Each user should only see their own profile
      const user1Profile = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200);

      const user2Profile = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(user1Profile.body.email).toBe(testUser.email);
      expect(user2Profile.body.email).toBe('jwt.test2@example.com');
      expect(user1Profile.body.id).not.toBe(user2Profile.body.id);

      // User1's token should not work as User2
      expect(user1Profile.body.id).toBe(testUser.id);
      expect(user2Profile.body.id).not.toBe(testUser.id);
    });

    test('should handle concurrent sessions safely', async () => {
      // Create multiple concurrent operations
      const operations = Array.from({ length: 5 }, (_, i) => 
        request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${testUser.accessToken}`)
          .send({
            english: `Concurrent Card ${i}`,
            spanish: `Tarjeta Concurrente ${i}`
          })
      );

      const responses = await Promise.all(operations);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.userId).toBe(testUser.id);
      });

      // All should have unique IDs
      const ids = responses.map(r => r.body.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);

      // Verify all flashcards exist
      const flashcardsResponse = await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200);

      expect(flashcardsResponse.body).toHaveLength(5);
    });
  });

  describe('Token Payload Security', () => {
    test('JWT should contain only necessary claims', async () => {
      // Decode JWT token (just the payload, signature verification happens server-side)
      const tokenParts = testUser.accessToken.split('.');
      expect(tokenParts).toHaveLength(3);

      // Decode payload (base64url decode)
      const payload = JSON.parse(
        Buffer.from(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
      );

      // Should contain required claims
      expect(payload).toHaveProperty('userId', testUser.id);
      expect(payload).toHaveProperty('email', testUser.email);
      expect(payload).toHaveProperty('role', 'user');
      expect(payload).toHaveProperty('iat'); // issued at
      expect(payload).toHaveProperty('exp'); // expires

      // Should not contain sensitive information
      expect(payload).not.toHaveProperty('password');
      expect(payload).not.toHaveProperty('password_hash');
      expect(payload).not.toHaveProperty('refreshToken');

      // Validate expiration is reasonable (15 minutes from issue)
      const currentTime = Math.floor(Date.now() / 1000);
      const tokenAge = currentTime - payload.iat;
      const tokenTimeToLive = payload.exp - payload.iat;
      
      expect(tokenAge).toBeLessThan(300); // Less than 5 minutes old
      expect(tokenTimeToLive).toBe(900); // 15 minutes TTL
    });

    test('should generate different tokens for each login', async () => {
      // Login multiple times
      const loginPromises = Array.from({ length: 3 }, () =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'securepassword123'
          })
          .expect(200)
      );

      const responses = await Promise.all(loginPromises);
      const tokens = responses.map(r => r.body.accessToken);

      // All tokens should be different
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);

      // All tokens should work
      for (const token of tokens) {
        await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
      }
    });

    test('should include proper security headers in auth responses', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'securepassword123'
        })
        .expect(200);

      // Should set secure httpOnly refresh token cookie
      const refreshCookie = loginResponse.headers['set-cookie'].find(cookie => 
        cookie.includes('refreshToken=')
      );

      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toMatch(/httponly/i);
      
      // In production should also have Secure flag
      if (process.env.NODE_ENV === 'production') {
        expect(refreshCookie).toMatch(/secure/i);
      }

      // Should have proper cache control
      expect(loginResponse.headers['cache-control']).toMatch(/no-cache|no-store/i);
    });
  });
});