import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

/**
 * Contract Test: POST /api/flashcards with user ownership
 * 
 * This test validates the API contract for flashcard creation with user ownership
 * according to the flashcards-api.json specification.
 * 
 * CRITICAL: This test MUST FAIL initially (TDD requirement)
 */

describe('POST /api/flashcards - User Ownership Contract Test', () => {
  let app;
  let server;
  let userToken;
  let adminToken;

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
      // Register and login regular user
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'createtest@example.com', password: 'password123' });
      
      const userLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'createtest@example.com', password: 'password123' });
      userToken = userLogin.body.accessToken;

      // Admin login
      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: process.env.ADMIN_EMAIL || 'admin@flashcards.com',
          password: process.env.ADMIN_PASS || 'admin123'
        });
      adminToken = adminLogin.body.accessToken;
    } catch (error) {
      console.log('Test user setup failed (expected during TDD):', error.message);
      userToken = 'mock-jwt-token-user';
      adminToken = 'mock-jwt-token-admin';
    }
  });

  describe('Valid Flashcard Creation', () => {
    test('should create flashcard with user ownership', async () => {
      const flashcardData = {
        english: 'Hello',
        spanish: 'Hola'
      };

      const response = await request(app)
        .post('/api/flashcards')
        .set('Authorization', `Bearer ${userToken}`)
        .send(flashcardData)
        .expect('Content-Type', /json/)
        .expect(201);

      // Validate response structure matches contract
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('english', 'Hello');
      expect(response.body).toHaveProperty('spanish', 'Hola');
      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('difficulty');
      expect(response.body).toHaveProperty('reviewCount');

      // Validate data types
      expect(typeof response.body.id).toBe('number');
      expect(typeof response.body.userId).toBe('number');
      expect(typeof response.body.difficulty).toBe('number');
      expect(typeof response.body.reviewCount).toBe('number');

      // Validate default values
      expect(response.body.difficulty).toBe(0);
      expect(response.body.reviewCount).toBe(0);
    });

    test('should assign flashcard to authenticated user', async () => {
      const flashcardData = {
        english: 'Test Card',
        spanish: 'Tarjeta de Prueba'
      };

      const response = await request(app)
        .post('/api/flashcards')
        .set('Authorization', `Bearer ${userToken}`)
        .send(flashcardData)
        .expect(201);

      // Get user profile to verify ownership
      const profileResponse = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.userId).toBe(profileResponse.body.id);
    });

    test('should trim whitespace from text fields', async () => {
      const flashcardData = {
        english: '  Goodbye  ',
        spanish: '  Adiós  '
      };

      const response = await request(app)
        .post('/api/flashcards')
        .set('Authorization', `Bearer ${userToken}`)
        .send(flashcardData)
        .expect(201);

      expect(response.body.english).toBe('Goodbye');
      expect(response.body.spanish).toBe('Adiós');
    });
  });

  describe('Input Validation', () => {
    test('should return 400 for missing english field', async () => {
      const flashcardData = {
        spanish: 'Hola'
      };

      const response = await request(app)
        .post('/api/flashcards')
        .set('Authorization', `Bearer ${userToken}`)
        .send(flashcardData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/english.*required/i);
    });

    test('should return 400 for missing spanish field', async () => {
      const flashcardData = {
        english: 'Hello'
      };

      const response = await request(app)
        .post('/api/flashcards')
        .set('Authorization', `Bearer ${userToken}`)
        .send(flashcardData)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/spanish.*required/i);
    });

    test('should return 400 for empty english field', async () => {
      const flashcardData = {
        english: '',
        spanish: 'Hola'
      };

      const response = await request(app)
        .post('/api/flashcards')
        .set('Authorization', `Bearer ${userToken}`)
        .send(flashcardData)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/english.*required/i);
    });

    test('should return 400 for empty spanish field', async () => {
      const flashcardData = {
        english: 'Hello',
        spanish: ''
      };

      const response = await request(app)
        .post('/api/flashcards')
        .set('Authorization', `Bearer ${userToken}`)
        .send(flashcardData)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/spanish.*required/i);
    });

    test('should return 400 for text fields exceeding max length', async () => {
      const longText = 'a'.repeat(501); // Exceeds 500 char limit
      
      const response = await request(app)
        .post('/api/flashcards')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          english: longText,
          spanish: 'Hola'
        })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toMatch(/english.*maximum.*500/i);
    });
  });

  describe('Authentication Requirements', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const flashcardData = {
        english: 'Hello',
        spanish: 'Hola'
      };

      const response = await request(app)
        .post('/api/flashcards')
        .send(flashcardData)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.error).toBe('UNAUTHORIZED');
      expect(response.body.message).toMatch(/authorization.*required/i);
    });

    test('should return 401 for invalid token', async () => {
      const flashcardData = {
        english: 'Hello',
        spanish: 'Hola'
      };

      const response = await request(app)
        .post('/api/flashcards')
        .set('Authorization', 'Bearer invalid-token')
        .send(flashcardData)
        .expect(401);

      expect(response.body.error).toBe('TOKEN_INVALID');
    });
  });

  describe('Content-Type Validation', () => {
    test('should require application/json content type', async () => {
      const response = await request(app)
        .post('/api/flashcards')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'text/plain')
        .send('english=Hello&spanish=Hola')
        .expect(400);

      expect(response.body.error).toBe('INVALID_CONTENT_TYPE');
    });

    test('should reject form-encoded data', async () => {
      const response = await request(app)
        .post('/api/flashcards')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('english=Hello&spanish=Hola')
        .expect(400);

      expect(response.body.error).toBe('INVALID_CONTENT_TYPE');
    });
  });

  describe('Response Format Validation', () => {
    test('should include requestId in all responses', async () => {
      const response = await request(app)
        .post('/api/flashcards')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('requestId');
      expect(typeof response.body.requestId).toBe('string');
    });

    test('should return consistent error structure', async () => {
      const response = await request(app)
        .post('/api/flashcards')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.message).toBe('string');
    });
  });

  describe('User Isolation Validation', () => {
    test('should not allow setting userId manually', async () => {
      const flashcardData = {
        english: 'Hello',
        spanish: 'Hola',
        userId: 999 // Should be ignored
      };

      const response = await request(app)
        .post('/api/flashcards')
        .set('Authorization', `Bearer ${userToken}`)
        .send(flashcardData)
        .expect(201);

      // Should use token user ID, not provided userId
      expect(response.body.userId).not.toBe(999);
    });

    test('should create flashcard visible only to owner', async () => {
      const flashcardData = {
        english: 'Private Card',
        spanish: 'Tarjeta Privada'
      };

      // User creates flashcard
      const createResponse = await request(app)
        .post('/api/flashcards')
        .set('Authorization', `Bearer ${userToken}`)
        .send(flashcardData)
        .expect(201);

      // Verify user can see their flashcard
      const userFlashcards = await request(app)
        .get('/api/flashcards')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const userCard = userFlashcards.body.find(card => card.id === createResponse.body.id);
      expect(userCard).toBeDefined();

      // Admin should not see user's flashcard in their list
      const adminFlashcards = await request(app)
        .get('/api/flashcards')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const adminCard = adminFlashcards.body.find(card => card.id === createResponse.body.id);
      expect(adminCard).toBeUndefined();
    });
  });

  describe('Data Integrity', () => {
    test('should maintain data integrity for concurrent creations', async () => {
      const flashcardPromises = Array.from({ length: 5 }, (_, i) => 
        request(app)
          .post('/api/flashcards')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            english: `Card ${i}`,
            spanish: `Tarjeta ${i}`
          })
      );

      const responses = await Promise.all(flashcardPromises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // All should have unique IDs
      const ids = responses.map(r => r.body.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});