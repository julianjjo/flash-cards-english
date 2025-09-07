import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

/**
 * Contract Test: PUT /api/flashcards/:id with ownership validation
 * 
 * This test validates the API contract for flashcard updates with ownership validation
 * according to the flashcards-api.json specification.
 * 
 * CRITICAL: This test MUST FAIL initially (TDD requirement)
 */

describe('PUT /api/flashcards/:id - Ownership Validation Contract Test', () => {
  let app;
  let server;
  let user1Token;
  let user2Token;
  let adminToken;
  let user1FlashcardId;
  let user2FlashcardId;

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
      // Set up User 1
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'updateuser1@example.com', password: 'password123' });
      
      const user1Login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'updateuser1@example.com', password: 'password123' });
      user1Token = user1Login.body.accessToken;

      // Set up User 2
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'updateuser2@example.com', password: 'password123' });
      
      const user2Login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'updateuser2@example.com', password: 'password123' });
      user2Token = user2Login.body.accessToken;

      // Admin token
      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: process.env.ADMIN_EMAIL || 'admin@flashcards.com',
          password: process.env.ADMIN_PASS || 'admin123'
        });
      adminToken = adminLogin.body.accessToken;

      // Create test flashcards
      const user1Card = await request(app)
        .post('/api/flashcards')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ english: 'User 1 Card', spanish: 'Tarjeta Usuario 1' });
      user1FlashcardId = user1Card.body.id;

      const user2Card = await request(app)
        .post('/api/flashcards')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ english: 'User 2 Card', spanish: 'Tarjeta Usuario 2' });
      user2FlashcardId = user2Card.body.id;
    } catch (error) {
      console.log('Test setup failed (expected during TDD):', error.message);
      user1Token = 'mock-jwt-token-user1';
      user2Token = 'mock-jwt-token-user2';
      adminToken = 'mock-jwt-token-admin';
      user1FlashcardId = 1;
      user2FlashcardId = 2;
    }
  });

  describe('Valid Flashcard Updates', () => {
    test('should update owned flashcard successfully', async () => {
      const updateData = {
        english: 'Updated English',
        spanish: 'Español Actualizado'
      };

      const response = await request(app)
        .put(`/api/flashcards/${user1FlashcardId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(updateData)
        .expect('Content-Type', /json/)
        .expect(200);

      // Validate response structure
      expect(response.body).toHaveProperty('id', user1FlashcardId);
      expect(response.body).toHaveProperty('english', 'Updated English');
      expect(response.body).toHaveProperty('spanish', 'Español Actualizado');
      expect(response.body).toHaveProperty('userId');
    });

    test('should allow partial updates', async () => {
      const updateData = {
        english: 'Only English Updated'
      };

      const response = await request(app)
        .put(`/api/flashcards/${user1FlashcardId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.english).toBe('Only English Updated');
      expect(response.body.spanish).toBe('Tarjeta Usuario 1'); // Should remain unchanged
    });

    test('should trim whitespace in updates', async () => {
      const updateData = {
        english: '  Trimmed English  ',
        spanish: '  Español Recortado  '
      };

      const response = await request(app)
        .put(`/api/flashcards/${user1FlashcardId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.english).toBe('Trimmed English');
      expect(response.body.spanish).toBe('Español Recortado');
    });
  });

  describe('Ownership Validation', () => {
    test('should return 403 when trying to update another users flashcard', async () => {
      const updateData = {
        english: 'Unauthorized Update',
        spanish: 'Actualización No Autorizada'
      };

      const response = await request(app)
        .put(`/api/flashcards/${user2FlashcardId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(updateData)
        .expect('Content-Type', /json/)
        .expect(403);

      expect(response.body.error).toBe('FORBIDDEN');
      expect(response.body.message).toMatch(/access.*denied.*not.*your.*flashcard/i);
    });

    test('should allow admin to update any flashcard', async () => {
      const updateData = {
        english: 'Admin Updated',
        spanish: 'Actualizado por Admin'
      };

      const response = await request(app)
        .put(`/api/flashcards/${user1FlashcardId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.english).toBe('Admin Updated');
      expect(response.body.spanish).toBe('Actualizado por Admin');
    });
  });

  describe('Input Validation', () => {
    test('should return 400 for empty english field', async () => {
      const updateData = {
        english: '',
        spanish: 'Valid Spanish'
      };

      const response = await request(app)
        .put(`/api/flashcards/${user1FlashcardId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(updateData)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/english.*required/i);
    });

    test('should return 400 for empty spanish field', async () => {
      const updateData = {
        english: 'Valid English',
        spanish: ''
      };

      const response = await request(app)
        .put(`/api/flashcards/${user1FlashcardId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(updateData)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/spanish.*required/i);
    });

    test('should return 400 for text exceeding max length', async () => {
      const longText = 'a'.repeat(501);
      const updateData = {
        english: longText,
        spanish: 'Valid Spanish'
      };

      const response = await request(app)
        .put(`/api/flashcards/${user1FlashcardId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(updateData)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/english.*maximum.*500/i);
    });

    test('should ignore attempts to modify userId', async () => {
      const updateData = {
        english: 'Updated Text',
        spanish: 'Texto Actualizado',
        userId: 999 // Should be ignored
      };

      const response = await request(app)
        .put(`/api/flashcards/${user1FlashcardId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(updateData)
        .expect(200);

      // userId should remain unchanged
      expect(response.body.userId).not.toBe(999);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent flashcard ID', async () => {
      const updateData = {
        english: 'Updated',
        spanish: 'Actualizado'
      };

      const response = await request(app)
        .put('/api/flashcards/99999')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(updateData)
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body.error).toBe('FLASHCARD_NOT_FOUND');
      expect(response.body.message).toMatch(/flashcard.*not.*found/i);
    });

    test('should return 400 for invalid flashcard ID format', async () => {
      const updateData = {
        english: 'Updated',
        spanish: 'Actualizado'
      };

      const response = await request(app)
        .put('/api/flashcards/invalid-id')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(updateData)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/flashcard.*id.*must.*be.*number/i);
    });

    test('should return 401 for unauthenticated requests', async () => {
      const updateData = {
        english: 'Updated',
        spanish: 'Actualizado'
      };

      const response = await request(app)
        .put(`/api/flashcards/${user1FlashcardId}`)
        .send(updateData)
        .expect(401);

      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    test('should return 401 for invalid token', async () => {
      const updateData = {
        english: 'Updated',
        spanish: 'Actualizado'
      };

      const response = await request(app)
        .put(`/api/flashcards/${user1FlashcardId}`)
        .set('Authorization', 'Bearer invalid-token')
        .send(updateData)
        .expect(401);

      expect(response.body.error).toBe('TOKEN_INVALID');
    });
  });

  describe('Content-Type Validation', () => {
    test('should require application/json content type', async () => {
      const response = await request(app)
        .put(`/api/flashcards/${user1FlashcardId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .set('Content-Type', 'text/plain')
        .send('english=Updated')
        .expect(400);

      expect(response.body.error).toBe('INVALID_CONTENT_TYPE');
    });
  });

  describe('Response Format Validation', () => {
    test('should include requestId in all responses', async () => {
      const response = await request(app)
        .put('/api/flashcards/invalid')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('requestId');
      expect(typeof response.body.requestId).toBe('string');
    });

    test('should return consistent error structure', async () => {
      const response = await request(app)
        .put('/api/flashcards/99999')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ english: 'test' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.message).toBe('string');
    });
  });

  describe('HTTP Method Validation', () => {
    test('should only accept PUT requests for updates', async () => {
      const methods = ['POST', 'GET', 'DELETE', 'PATCH'];

      for (const method of methods) {
        const response = await request(app)
          [method.toLowerCase()](`/api/flashcards/${user1FlashcardId}`)
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ english: 'test' });

        // Should get method not allowed or the specific endpoint behavior
        expect([404, 405]).toContain(response.status);
      }
    });
  });

  describe('Concurrent Update Handling', () => {
    test('should handle concurrent updates safely', async () => {
      const updatePromises = Array.from({ length: 3 }, (_, i) =>
        request(app)
          .put(`/api/flashcards/${user1FlashcardId}`)
          .set('Authorization', `Bearer ${user1Token}`)
          .send({
            english: `Concurrent Update ${i}`,
            spanish: `Actualización Concurrente ${i}`
          })
      );

      const responses = await Promise.all(updatePromises);

      // At least one should succeed
      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBeGreaterThan(0);

      // All successful responses should have valid structure
      successfulResponses.forEach(response => {
        expect(response.body).toHaveProperty('id', user1FlashcardId);
        expect(response.body).toHaveProperty('english');
        expect(response.body).toHaveProperty('spanish');
      });
    });
  });
});