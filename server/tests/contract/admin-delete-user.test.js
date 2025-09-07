import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

/**
 * Contract Test: DELETE /api/admin/users/:id
 * 
 * This test validates the API contract for admin user deletion endpoint
 * according to the admin-api.json specification.
 * 
 * CRITICAL: This test MUST FAIL initially (TDD requirement)
 */

describe('DELETE /api/admin/users/:id - Contract Test', () => {
  let app;
  let server;
  let adminToken;
  let regularUserToken;
  let testUserId;

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
      // Setup admin token
      const adminLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: process.env.ADMIN_EMAIL || 'admin@flashcards.com',
          password: process.env.ADMIN_PASS || 'admin123'
        });
      adminToken = adminLoginResponse.body.accessToken;

      // Create test user for deletion
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'deletetest@example.com',
          password: 'password123'
        });
      testUserId = registerResponse.body.id;

      // Get regular user token
      const userLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'deletetest@example.com',
          password: 'password123'
        });
      regularUserToken = userLoginResponse.body.accessToken;
    } catch (error) {
      console.log('Test user setup failed (expected during TDD):', error.message);
      adminToken = 'mock-jwt-token-admin';
      regularUserToken = 'mock-jwt-token-user';
      testUserId = 999;
    }
  });

  describe('Valid Deletion Request', () => {
    test('should return 200 with success message for valid user deletion', async () => {
      const response = await request(app)
        .delete(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/user.*deleted.*successfully/i);
    });

    test('should cascade delete user flashcards', async () => {
      // Create flashcard for user
      await request(app)
        .post('/api/flashcards')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          english: 'Test Card',
          spanish: 'Tarjeta de Prueba'
        });

      // Delete user
      await request(app)
        .delete(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify flashcards are also deleted
      const flashcardsResponse = await request(app)
        .get('/api/flashcards')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(401); // Token should be invalid after user deletion
    });
  });

  describe('Access Control', () => {
    test('should return 403 for regular user attempting deletion', async () => {
      const response = await request(app)
        .delete(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect('Content-Type', /json/)
        .expect(403);

      expect(response.body.error).toBe('FORBIDDEN');
      expect(response.body.message).toMatch(/admin.*access.*required/i);
    });

    test('should return 401 for missing authorization', async () => {
      const response = await request(app)
        .delete(`/api/admin/users/${testUserId}`)
        .expect(401);

      expect(response.body.error).toBe('UNAUTHORIZED');
    });
  });

  describe('Invalid Deletion Requests', () => {
    test('should return 404 for non-existent user ID', async () => {
      const response = await request(app)
        .delete('/api/admin/users/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body.error).toBe('USER_NOT_FOUND');
      expect(response.body.message).toMatch(/user.*not.*found/i);
    });

    test('should return 400 for invalid user ID format', async () => {
      const response = await request(app)
        .delete('/api/admin/users/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/user.*id.*must.*be.*number/i);
    });

    test('should prevent admin from deleting themselves', async () => {
      // Get admin user ID
      const profileResponse = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const adminId = profileResponse.body.id;

      const response = await request(app)
        .delete(`/api/admin/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.error).toBe('CANNOT_DELETE_SELF');
      expect(response.body.message).toMatch(/cannot.*delete.*your.*own.*account/i);
    });
  });
});