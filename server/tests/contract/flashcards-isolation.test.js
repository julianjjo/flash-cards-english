import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

/**
 * Contract Test: GET /api/flashcards with user isolation
 * 
 * This test validates the API contract for flashcard retrieval with user isolation
 * according to the flashcards-api.json specification.
 * 
 * CRITICAL: This test MUST FAIL initially (TDD requirement)
 */

describe('GET /api/flashcards - User Isolation Contract Test', () => {
  let app;
  let server;
  let user1Token;
  let user2Token;
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
      // Register User 1
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'user1@example.com', password: 'password123' });
      
      const user1Login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user1@example.com', password: 'password123' });
      user1Token = user1Login.body.accessToken;

      // Register User 2
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'user2@example.com', password: 'password123' });
      
      const user2Login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user2@example.com', password: 'password123' });
      user2Token = user2Login.body.accessToken;

      // Admin token
      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: process.env.ADMIN_EMAIL || 'admin@flashcards.com',
          password: process.env.ADMIN_PASS || 'admin123'
        });
      adminToken = adminLogin.body.accessToken;
    } catch (error) {
      console.log('Test user setup failed (expected during TDD):', error.message);
      user1Token = 'mock-jwt-token-user1';
      user2Token = 'mock-jwt-token-user2';
      adminToken = 'mock-jwt-token-admin';
    }
  });

  describe('User Isolation Validation', () => {
    test('should return only user-owned flashcards', async () => {
      const response = await request(app)
        .get('/api/flashcards')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      // All flashcards should belong to the authenticated user
      response.body.forEach(flashcard => {
        expect(flashcard).toHaveProperty('userId');
        expect(flashcard.userId).toBe(1); // Assuming user1 has ID 1
      });
    });

    test('should not return other users flashcards', async () => {
      // User 1 creates a flashcard
      await request(app)
        .post('/api/flashcards')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ english: 'User 1 Card', spanish: 'Tarjeta Usuario 1' });

      // User 2 gets flashcards
      const user2Response = await request(app)
        .get('/api/flashcards')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      // User 2 should not see User 1's flashcard
      const user1Cards = user2Response.body.filter(card => 
        card.english === 'User 1 Card'
      );
      expect(user1Cards).toHaveLength(0);
    });

    test('should return different flashcards for different users', async () => {
      // User 1 creates flashcard
      await request(app)
        .post('/api/flashcards')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ english: 'Unique Card 1', spanish: 'Tarjeta Única 1' });

      // User 2 creates different flashcard
      await request(app)
        .post('/api/flashcards')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ english: 'Unique Card 2', spanish: 'Tarjeta Única 2' });

      // Get User 1's flashcards
      const user1Response = await request(app)
        .get('/api/flashcards')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      // Get User 2's flashcards
      const user2Response = await request(app)
        .get('/api/flashcards')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      // Verify isolation
      const user1HasCard1 = user1Response.body.some(card => card.english === 'Unique Card 1');
      const user1HasCard2 = user1Response.body.some(card => card.english === 'Unique Card 2');
      const user2HasCard1 = user2Response.body.some(card => card.english === 'Unique Card 1');
      const user2HasCard2 = user2Response.body.some(card => card.english === 'Unique Card 2');

      expect(user1HasCard1).toBe(true);
      expect(user1HasCard2).toBe(false);
      expect(user2HasCard1).toBe(false);
      expect(user2HasCard2).toBe(true);
    });
  });

  describe('Authentication Requirements', () => {
    test('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/flashcards')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.error).toBe('UNAUTHORIZED');
      expect(response.body.message).toMatch(/authorization.*required/i);
    });

    test('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/flashcards')
        .set('Authorization', 'Bearer invalid-token')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.error).toBe('TOKEN_INVALID');
    });
  });

  describe('Response Format Validation', () => {
    test('should return array of flashcards with correct structure', async () => {
      const response = await request(app)
        .get('/api/flashcards')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      if (response.body.length > 0) {
        const flashcard = response.body[0];
        
        // Validate flashcard structure
        expect(flashcard).toHaveProperty('id');
        expect(flashcard).toHaveProperty('english');
        expect(flashcard).toHaveProperty('spanish');
        expect(flashcard).toHaveProperty('userId');
        expect(flashcard).toHaveProperty('difficulty');
        expect(flashcard).toHaveProperty('reviewCount');

        // Validate data types
        expect(typeof flashcard.id).toBe('number');
        expect(typeof flashcard.english).toBe('string');
        expect(typeof flashcard.spanish).toBe('string');
        expect(typeof flashcard.userId).toBe('number');
        expect(typeof flashcard.difficulty).toBe('number');
        expect(typeof flashcard.reviewCount).toBe('number');
      }
    });

    test('should include requestId in error responses', async () => {
      const response = await request(app)
        .get('/api/flashcards')
        .expect(401);

      expect(response.body).toHaveProperty('requestId');
      expect(typeof response.body.requestId).toBe('string');
    });
  });

  describe('Admin Access', () => {
    test('should allow admin to see all flashcards via admin endpoint', async () => {
      // This test ensures admin has separate access pattern
      // Regular flashcard endpoint should still be user-isolated for admin
      const response = await request(app)
        .get('/api/flashcards')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Even admin should only see their own flashcards via this endpoint
      response.body.forEach(flashcard => {
        expect(flashcard.userId).toBe(1); // Admin user ID
      });
    });
  });

  describe('Empty State Handling', () => {
    test('should return empty array for user with no flashcards', async () => {
      // Register new user with no flashcards
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'empty@example.com', password: 'password123' });
      
      const emptyUserLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'empty@example.com', password: 'password123' });

      const response = await request(app)
        .get('/api/flashcards')
        .set('Authorization', `Bearer ${emptyUserLogin.body.accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });
  });
});