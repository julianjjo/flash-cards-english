import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

/**
 * Integration Tests: User Management & Flashcard API Endpoints
 * 
 * Comprehensive tests for user and flashcard management endpoints:
 * 
 * User Management:
 * - GET /api/users/me - Get current user profile
 * - PUT /api/users/me - Update current user profile
 * - DELETE /api/users/me - Delete current user account
 * - GET /api/users/me/stats - Get current user statistics
 * - POST /api/users/me/change-password - Change password
 * 
 * Flashcard Management:
 * - POST /api/cards - Create flashcard
 * - GET /api/cards - Get user flashcards
 * - GET /api/cards/:id - Get specific flashcard
 * - PUT /api/cards/:id - Update flashcard
 * - DELETE /api/cards/:id - Delete flashcard
 * - POST /api/cards/:id/review - Review flashcard
 * - GET /api/cards/my/count - Get flashcard count
 * 
 * Study System:
 * - GET /api/study/my-session - Get study session
 * - GET /api/study/my-due - Get due cards
 * - POST /api/study/review/:id - Review card in study
 * - GET /api/study/my-recommendations - Get study recommendations
 * 
 * Tests authentication, authorization, data validation, user isolation,
 * spaced repetition algorithm, and error handling.
 */

describe('User Management & Flashcard API Endpoints - Integration Tests', () => {
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
      database.prepare('DELETE FROM cards WHERE user_id IN (SELECT id FROM users WHERE email LIKE ?)').run('%userapi%');
      database.prepare('DELETE FROM users WHERE email LIKE ?').run('%userapi%');
    } catch (error) {
      console.log('Database cleanup failed (expected during TDD):', error.message);
    }
  });

  // Helper function to create authenticated user
  const createAuthenticatedUser = async (email, password = 'testpassword123') => {
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({ email, password })
      .expect(201);

    return {
      user: registerResponse.body.user,
      accessToken: registerResponse.body.accessToken
    };
  };

  describe('User Profile Management', () => {
    describe('GET /api/users/me', () => {
      test('should return current user profile', async () => {
        const { user, accessToken } = await createAuthenticatedUser('profile.test@userapi.com');

        const response = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toMatchObject({
          id: user.id,
          email: 'profile.test@userapi.com',
          role: 'user'
        });
        expect(response.body).toHaveProperty('createdAt');
        expect(response.body).toHaveProperty('updatedAt');
        expect(response.body).not.toHaveProperty('password');
        expect(response.body).not.toHaveProperty('passwordHash');
      });

      test('should require authentication', async () => {
        const response = await request(app)
          .get('/api/users/me')
          .expect('Content-Type', /json/)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('PUT /api/users/me', () => {
      test('should update user profile successfully', async () => {
        const { accessToken } = await createAuthenticatedUser('update.test@userapi.com');

        const updateData = {
          email: 'updated.test@userapi.com'
        };

        const response = await request(app)
          .put('/api/users/me')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('user');
        expect(response.body.user.email).toBe('updated.test@userapi.com');
        expect(response.body).toHaveProperty('message');

        // Verify the update persisted
        const profileResponse = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(profileResponse.body.email).toBe('updated.test@userapi.com');
      });

      test('should reject invalid email update', async () => {
        const { accessToken } = await createAuthenticatedUser('invalid.update@userapi.com');

        const updateData = {
          email: 'invalid-email-format'
        };

        const response = await request(app)
          .put('/api/users/me')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData)
          .expect('Content-Type', /json/)
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/email/i);
      });

      test('should reject duplicate email update', async () => {
        await createAuthenticatedUser('existing@userapi.com');
        const { accessToken } = await createAuthenticatedUser('duplicate.update@userapi.com');

        const updateData = {
          email: 'existing@userapi.com'
        };

        const response = await request(app)
          .put('/api/users/me')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData)
          .expect('Content-Type', /json/)
          .expect(409);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/already exists|duplicate/i);
      });

      test('should require authentication', async () => {
        const response = await request(app)
          .put('/api/users/me')
          .send({ email: 'test@example.com' })
          .expect('Content-Type', /json/)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('DELETE /api/users/me', () => {
      test('should delete user account and all associated data', async () => {
        const { user, accessToken } = await createAuthenticatedUser('delete.test@userapi.com');

        // Create some flashcards first
        await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            english: 'Test Card',
            spanish: 'Tarjeta de Prueba'
          })
          .expect(201);

        // Delete the account
        const response = await request(app)
          .delete('/api/users/me')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toMatch(/success/i);

        // Verify user can't authenticate anymore
        await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(401);

        // Verify login no longer works
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'delete.test@userapi.com',
            password: 'testpassword123'
          })
          .expect(401);
      });

      test('should require authentication', async () => {
        const response = await request(app)
          .delete('/api/users/me')
          .expect('Content-Type', /json/)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/users/me/stats', () => {
      test('should return user statistics', async () => {
        const { accessToken } = await createAuthenticatedUser('stats.test@userapi.com');

        // Create some flashcards and reviews
        const flashcardResponse = await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            english: 'Statistics Test',
            spanish: 'Prueba Estadísticas'
          })
          .expect(201);

        // Review the flashcard
        await request(app)
          .post(`/api/cards/${flashcardResponse.body.id}/review`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ performanceRating: 4 })
          .expect(200);

        const response = await request(app)
          .get('/api/users/me/stats')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('totalFlashcards');
        expect(response.body).toHaveProperty('totalReviews');
        expect(response.body).toHaveProperty('averageDifficulty');
        expect(response.body).toHaveProperty('reviewedCards');
        expect(response.body).toHaveProperty('unreviewedCards');
        expect(response.body.totalFlashcards).toBe(1);
        expect(response.body.totalReviews).toBe(1);
      });

      test('should require authentication', async () => {
        const response = await request(app)
          .get('/api/users/me/stats')
          .expect('Content-Type', /json/)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Flashcard Management', () => {
    describe('POST /api/cards', () => {
      test('should create flashcard successfully', async () => {
        const { user, accessToken } = await createAuthenticatedUser('flashcard.create@userapi.com');

        const flashcardData = {
          english: 'Hello World',
          spanish: 'Hola Mundo'
        };

        const response = await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(flashcardData)
          .expect('Content-Type', /json/)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toMatchObject({
          english: 'Hello World',
          spanish: 'Hola Mundo',
          userId: user.id,
          difficulty: 0,
          reviewCount: 0
        });
        expect(response.body).toHaveProperty('createdAt');
        expect(response.body).toHaveProperty('updatedAt');
      });

      test('should reject flashcard with missing fields', async () => {
        const { accessToken } = await createAuthenticatedUser('flashcard.missing@userapi.com');

        const testCases = [
          { spanish: 'Hola Mundo' }, // Missing english
          { english: 'Hello World' }, // Missing spanish
          {} // Missing both
        ];

        for (const flashcardData of testCases) {
          const response = await request(app)
            .post('/api/cards')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(flashcardData)
            .expect('Content-Type', /json/)
            .expect(400);

          expect(response.body).toHaveProperty('error');
        }
      });

      test('should reject empty flashcard content', async () => {
        const { accessToken } = await createAuthenticatedUser('flashcard.empty@userapi.com');

        const flashcardData = {
          english: '   ', // Only whitespace
          spanish: ''     // Empty
        };

        const response = await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(flashcardData)
          .expect('Content-Type', /json/)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      test('should require authentication', async () => {
        const response = await request(app)
          .post('/api/cards')
          .send({
            english: 'Test',
            spanish: 'Prueba'
          })
          .expect('Content-Type', /json/)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/cards', () => {
      test('should return user flashcards only', async () => {
        const { accessToken: token1 } = await createAuthenticatedUser('flashcard.user1@userapi.com');
        const { accessToken: token2 } = await createAuthenticatedUser('flashcard.user2@userapi.com');

        // User 1 creates flashcards
        await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${token1}`)
          .send({ english: 'User 1 Card 1', spanish: 'Tarjeta 1 Usuario 1' })
          .expect(201);

        await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${token1}`)
          .send({ english: 'User 1 Card 2', spanish: 'Tarjeta 2 Usuario 1' })
          .expect(201);

        // User 2 creates a flashcard
        await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${token2}`)
          .send({ english: 'User 2 Card 1', spanish: 'Tarjeta 1 Usuario 2' })
          .expect(201);

        // User 1 should only see their cards
        const response1 = await request(app)
          .get('/api/cards')
          .set('Authorization', `Bearer ${token1}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(Array.isArray(response1.body)).toBe(true);
        expect(response1.body).toHaveLength(2);
        response1.body.forEach(card => {
          expect(card.english).toMatch(/User 1/);
        });

        // User 2 should only see their card
        const response2 = await request(app)
          .get('/api/cards')
          .set('Authorization', `Bearer ${token2}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response2.body).toHaveLength(1);
        expect(response2.body[0].english).toMatch(/User 2/);
      });

      test('should support pagination', async () => {
        const { accessToken } = await createAuthenticatedUser('flashcard.pagination@userapi.com');

        // Create 15 flashcards
        const createPromises = Array.from({ length: 15 }, (_, i) =>
          request(app)
            .post('/api/cards')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              english: `Card ${i + 1}`,
              spanish: `Tarjeta ${i + 1}`
            })
        );

        await Promise.all(createPromises);

        // Test pagination
        const page1 = await request(app)
          .get('/api/cards?page=1&limit=10')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        const page2 = await request(app)
          .get('/api/cards?page=2&limit=10')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(page1.body).toHaveLength(10);
        expect(page2.body).toHaveLength(5);

        // Ensure no overlap
        const page1Ids = page1.body.map(card => card.id);
        const page2Ids = page2.body.map(card => card.id);
        const intersection = page1Ids.filter(id => page2Ids.includes(id));
        expect(intersection).toHaveLength(0);
      });

      test('should require authentication', async () => {
        const response = await request(app)
          .get('/api/cards')
          .expect('Content-Type', /json/)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/cards/:id', () => {
      test('should return specific flashcard', async () => {
        const { accessToken } = await createAuthenticatedUser('flashcard.specific@userapi.com');

        const createResponse = await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            english: 'Specific Card',
            spanish: 'Tarjeta Específica'
          })
          .expect(201);

        const flashcardId = createResponse.body.id;

        const response = await request(app)
          .get(`/api/cards/${flashcardId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toMatchObject({
          id: flashcardId,
          english: 'Specific Card',
          spanish: 'Tarjeta Específica'
        });
      });

      test('should reject access to other user flashcards', async () => {
        const { accessToken: token1 } = await createAuthenticatedUser('flashcard.owner@userapi.com');
        const { accessToken: token2 } = await createAuthenticatedUser('flashcard.other@userapi.com');

        const createResponse = await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${token1}`)
          .send({
            english: 'Private Card',
            spanish: 'Tarjeta Privada'
          })
          .expect(201);

        const flashcardId = createResponse.body.id;

        // User 2 should not be able to access User 1's flashcard
        const response = await request(app)
          .get(`/api/cards/${flashcardId}`)
          .set('Authorization', `Bearer ${token2}`)
          .expect('Content-Type', /json/)
          .expect(404);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/not found|access denied/i);
      });

      test('should return 404 for non-existent flashcard', async () => {
        const { accessToken } = await createAuthenticatedUser('flashcard.nonexistent@userapi.com');

        const response = await request(app)
          .get('/api/cards/999999')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect('Content-Type', /json/)
          .expect(404);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('PUT /api/cards/:id', () => {
      test('should update flashcard successfully', async () => {
        const { accessToken } = await createAuthenticatedUser('flashcard.update@userapi.com');

        const createResponse = await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            english: 'Original Card',
            spanish: 'Tarjeta Original'
          })
          .expect(201);

        const flashcardId = createResponse.body.id;

        const updateData = {
          english: 'Updated Card',
          spanish: 'Tarjeta Actualizada'
        };

        const response = await request(app)
          .put(`/api/cards/${flashcardId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toMatchObject({
          id: flashcardId,
          english: 'Updated Card',
          spanish: 'Tarjeta Actualizada'
        });

        // Verify the update persisted
        const getResponse = await request(app)
          .get(`/api/cards/${flashcardId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(getResponse.body.english).toBe('Updated Card');
        expect(getResponse.body.spanish).toBe('Tarjeta Actualizada');
      });

      test('should reject update of other user flashcards', async () => {
        const { accessToken: token1 } = await createAuthenticatedUser('flashcard.update1@userapi.com');
        const { accessToken: token2 } = await createAuthenticatedUser('flashcard.update2@userapi.com');

        const createResponse = await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${token1}`)
          .send({
            english: 'Private Card',
            spanish: 'Tarjeta Privada'
          })
          .expect(201);

        const flashcardId = createResponse.body.id;

        // User 2 should not be able to update User 1's flashcard
        const response = await request(app)
          .put(`/api/cards/${flashcardId}`)
          .set('Authorization', `Bearer ${token2}`)
          .send({
            english: 'Hacked Card',
            spanish: 'Tarjeta Hackeada'
          })
          .expect('Content-Type', /json/)
          .expect(404);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('DELETE /api/cards/:id', () => {
      test('should delete flashcard successfully', async () => {
        const { accessToken } = await createAuthenticatedUser('flashcard.delete@userapi.com');

        const createResponse = await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            english: 'Delete Me',
            spanish: 'Borrame'
          })
          .expect(201);

        const flashcardId = createResponse.body.id;

        const response = await request(app)
          .delete(`/api/cards/${flashcardId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toMatch(/success/i);

        // Verify flashcard is gone
        await request(app)
          .get(`/api/cards/${flashcardId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(404);
      });

      test('should reject deletion of other user flashcards', async () => {
        const { accessToken: token1 } = await createAuthenticatedUser('flashcard.delete1@userapi.com');
        const { accessToken: token2 } = await createAuthenticatedUser('flashcard.delete2@userapi.com');

        const createResponse = await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${token1}`)
          .send({
            english: 'Protected Card',
            spanish: 'Tarjeta Protegida'
          })
          .expect(201);

        const flashcardId = createResponse.body.id;

        // User 2 should not be able to delete User 1's flashcard
        const response = await request(app)
          .delete(`/api/cards/${flashcardId}`)
          .set('Authorization', `Bearer ${token2}`)
          .expect('Content-Type', /json/)
          .expect(404);

        expect(response.body).toHaveProperty('error');

        // Verify flashcard still exists for owner
        await request(app)
          .get(`/api/cards/${flashcardId}`)
          .set('Authorization', `Bearer ${token1}`)
          .expect(200);
      });
    });

    describe('POST /api/cards/:id/review', () => {
      test('should review flashcard and update spaced repetition', async () => {
        const { accessToken } = await createAuthenticatedUser('flashcard.review@userapi.com');

        const createResponse = await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            english: 'Review Card',
            spanish: 'Tarjeta de Repaso'
          })
          .expect(201);

        const flashcardId = createResponse.body.id;

        const reviewData = {
          performanceRating: 4 // Good performance
        };

        const response = await request(app)
          .post(`/api/cards/${flashcardId}/review`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(reviewData)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('id', flashcardId);
        expect(response.body).toHaveProperty('reviewCount');
        expect(response.body.reviewCount).toBeGreaterThan(0);
        expect(response.body).toHaveProperty('lastReviewed');
        expect(response.body).toHaveProperty('nextReview');

        // Verify spaced repetition algorithm updated the card
        const getResponse = await request(app)
          .get(`/api/cards/${flashcardId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(getResponse.body.reviewCount).toBeGreaterThan(0);
        expect(new Date(getResponse.body.nextReview).getTime()).toBeGreaterThan(Date.now());
      });

      test('should validate performance rating range', async () => {
        const { accessToken } = await createAuthenticatedUser('flashcard.rating@userapi.com');

        const createResponse = await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            english: 'Rating Test',
            spanish: 'Prueba de Calificación'
          })
          .expect(201);

        const flashcardId = createResponse.body.id;

        const invalidRatings = [-1, 0, 6, 10, 'invalid'];

        for (const rating of invalidRatings) {
          const response = await request(app)
            .post(`/api/cards/${flashcardId}/review`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ performanceRating: rating })
            .expect('Content-Type', /json/)
            .expect(400);

          expect(response.body).toHaveProperty('error');
          expect(response.body.error).toMatch(/rating|performance/i);
        }
      });

      test('should reject review of other user flashcards', async () => {
        const { accessToken: token1 } = await createAuthenticatedUser('flashcard.review1@userapi.com');
        const { accessToken: token2 } = await createAuthenticatedUser('flashcard.review2@userapi.com');

        const createResponse = await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${token1}`)
          .send({
            english: 'Private Review',
            spanish: 'Repaso Privado'
          })
          .expect(201);

        const flashcardId = createResponse.body.id;

        // User 2 should not be able to review User 1's flashcard
        const response = await request(app)
          .post(`/api/cards/${flashcardId}/review`)
          .set('Authorization', `Bearer ${token2}`)
          .send({ performanceRating: 4 })
          .expect('Content-Type', /json/)
          .expect(404);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/cards/my/count', () => {
      test('should return accurate flashcard count', async () => {
        const { accessToken } = await createAuthenticatedUser('flashcard.count@userapi.com');

        // Initially should be 0
        let response = await request(app)
          .get('/api/cards/my/count')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('count', 0);

        // Create 3 flashcards
        const createPromises = Array.from({ length: 3 }, (_, i) =>
          request(app)
            .post('/api/cards')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              english: `Count Card ${i + 1}`,
              spanish: `Tarjeta Cuenta ${i + 1}`
            })
        );

        await Promise.all(createPromises);

        // Should now be 3
        response = await request(app)
          .get('/api/cards/my/count')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('count', 3);
      });

      test('should require authentication', async () => {
        const response = await request(app)
          .get('/api/cards/my/count')
          .expect('Content-Type', /json/)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Study System', () => {
    describe('GET /api/study/my-due', () => {
      test('should return due flashcards for review', async () => {
        const { accessToken } = await createAuthenticatedUser('study.due@userapi.com');

        // Create a flashcard
        const createResponse = await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            english: 'Due Card',
            spanish: 'Tarjeta Vencida'
          })
          .expect(201);

        const response = await request(app)
          .get('/api/study/my-due')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('cards');
        expect(Array.isArray(response.body.cards)).toBe(true);
        expect(response.body.cards).toHaveLength(1);
        expect(response.body.cards[0]).toMatchObject({
          id: createResponse.body.id,
          english: 'Due Card',
          spanish: 'Tarjeta Vencida'
        });
      });

      test('should respect due date calculations', async () => {
        const { accessToken } = await createAuthenticatedUser('study.schedule@userapi.com');

        // Create and review a flashcard to set future due date
        const createResponse = await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            english: 'Future Card',
            spanish: 'Tarjeta Futura'
          })
          .expect(201);

        const flashcardId = createResponse.body.id;

        // Review with good performance (should schedule for future)
        await request(app)
          .post(`/api/cards/${flashcardId}/review`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ performanceRating: 5 })
          .expect(200);

        // Should not appear in due cards immediately
        const response = await request(app)
          .get('/api/study/my-due')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        const dueCard = response.body.cards.find(card => card.id === flashcardId);
        expect(dueCard).toBeUndefined();
      });

      test('should support pagination and limits', async () => {
        const { accessToken } = await createAuthenticatedUser('study.pagination@userapi.com');

        // Create 25 flashcards
        const createPromises = Array.from({ length: 25 }, (_, i) =>
          request(app)
            .post('/api/cards')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              english: `Due Card ${i + 1}`,
              spanish: `Tarjeta Vencida ${i + 1}`
            })
        );

        await Promise.all(createPromises);

        // Test with limit
        const response = await request(app)
          .get('/api/study/my-due?limit=10')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body.cards).toHaveLength(10);
      });

      test('should require authentication', async () => {
        const response = await request(app)
          .get('/api/study/my-due')
          .expect('Content-Type', /json/)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/study/my-session', () => {
      test('should return study session with due cards', async () => {
        const { accessToken } = await createAuthenticatedUser('study.session@userapi.com');

        // Create flashcards
        await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            english: 'Session Card 1',
            spanish: 'Tarjeta Sesión 1'
          })
          .expect(201);

        await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            english: 'Session Card 2',
            spanish: 'Tarjeta Sesión 2'
          })
          .expect(201);

        const response = await request(app)
          .get('/api/study/my-session')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('sessionId');
        expect(response.body).toHaveProperty('cards');
        expect(response.body).toHaveProperty('totalCards');
        expect(response.body).toHaveProperty('completedCards');
        expect(Array.isArray(response.body.cards)).toBe(true);
        expect(response.body.cards.length).toBeGreaterThan(0);
      });

      test('should handle empty study session', async () => {
        const { accessToken } = await createAuthenticatedUser('study.empty@userapi.com');

        const response = await request(app)
          .get('/api/study/my-session')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('cards');
        expect(response.body.cards).toHaveLength(0);
        expect(response.body).toHaveProperty('totalCards', 0);
      });
    });

    describe('POST /api/study/review/:id', () => {
      test('should review card in study context', async () => {
        const { accessToken } = await createAuthenticatedUser('study.reviewcard@userapi.com');

        const createResponse = await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            english: 'Study Review Card',
            spanish: 'Tarjeta Repaso Estudio'
          })
          .expect(201);

        const flashcardId = createResponse.body.id;

        const response = await request(app)
          .post(`/api/study/review/${flashcardId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ performanceRating: 3 })
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('flashcard');
        expect(response.body).toHaveProperty('sessionProgress');
        expect(response.body.flashcard.id).toBe(flashcardId);
        expect(response.body.flashcard.reviewCount).toBeGreaterThan(0);
      });
    });

    describe('GET /api/study/my-recommendations', () => {
      test('should return study recommendations', async () => {
        const { accessToken } = await createAuthenticatedUser('study.recommendations@userapi.com');

        // Create some flashcards with different difficulties
        await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            english: 'Easy Card',
            spanish: 'Tarjeta Fácil'
          })
          .expect(201);

        const response = await request(app)
          .get('/api/study/my-recommendations')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('recommendations');
        expect(Array.isArray(response.body.recommendations)).toBe(true);
      });
    });
  });

  describe('User Isolation and Security', () => {
    test('should maintain strict user isolation across all endpoints', async () => {
      const { user: user1, accessToken: token1 } = await createAuthenticatedUser('isolation1@userapi.com');
      const { user: user2, accessToken: token2 } = await createAuthenticatedUser('isolation2@userapi.com');

      // User 1 creates flashcards
      const card1Response = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${token1}`)
        .send({ english: 'User1 Card1', spanish: 'Tarjeta1 Usuario1' })
        .expect(201);

      const card2Response = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${token1}`)
        .send({ english: 'User1 Card2', spanish: 'Tarjeta2 Usuario1' })
        .expect(201);

      // User 2 creates flashcards
      const card3Response = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${token2}`)
        .send({ english: 'User2 Card1', spanish: 'Tarjeta1 Usuario2' })
        .expect(201);

      // Verify user 1 can only access their own flashcards
      const user1Cards = await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(user1Cards.body).toHaveLength(2);
      expect(user1Cards.body.every(card => card.userId === user1.id)).toBe(true);

      // Verify user 2 can only access their own flashcards
      const user2Cards = await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(user2Cards.body).toHaveLength(1);
      expect(user2Cards.body.every(card => card.userId === user2.id)).toBe(true);

      // Verify user 2 cannot access user 1's specific flashcard
      await request(app)
        .get(`/api/cards/${card1Response.body.id}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(404);

      // Verify user 2 cannot update user 1's flashcard
      await request(app)
        .put(`/api/cards/${card1Response.body.id}`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ english: 'Hacked', spanish: 'Hackeado' })
        .expect(404);

      // Verify user 2 cannot delete user 1's flashcard
      await request(app)
        .delete(`/api/cards/${card1Response.body.id}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(404);

      // Verify user 2 cannot review user 1's flashcard
      await request(app)
        .post(`/api/cards/${card1Response.body.id}/review`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ performanceRating: 4 })
        .expect(404);

      // Verify study sessions are isolated
      const user1Study = await request(app)
        .get('/api/study/my-due')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      const user2Study = await request(app)
        .get('/api/study/my-due')
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(user1Study.body.cards).toHaveLength(2);
      expect(user2Study.body.cards).toHaveLength(1);

      // Verify statistics are isolated
      const user1Stats = await request(app)
        .get('/api/users/me/stats')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      const user2Stats = await request(app)
        .get('/api/users/me/stats')
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(user1Stats.body.totalFlashcards).toBe(2);
      expect(user2Stats.body.totalFlashcards).toBe(1);
    });
  });

  describe('Data Consistency and Edge Cases', () => {
    test('should handle concurrent flashcard operations gracefully', async () => {
      const { accessToken } = await createAuthenticatedUser('concurrent.ops@userapi.com');

      // Create flashcards concurrently
      const createPromises = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            english: `Concurrent Card ${i}`,
            spanish: `Tarjeta Concurrente ${i}`
          })
      );

      const responses = await Promise.allSettled(createPromises);
      const successful = responses.filter(r => r.status === 'fulfilled' && r.value.status === 201);

      expect(successful.length).toBe(10);

      // Verify all cards exist
      const allCards = await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(allCards.body).toHaveLength(10);
    });

    test('should handle large datasets efficiently', async () => {
      const { accessToken } = await createAuthenticatedUser('large.dataset@userapi.com');

      // Create 100 flashcards
      const batchSize = 10;
      const totalCards = 100;
      
      for (let i = 0; i < totalCards; i += batchSize) {
        const batch = Array.from({ length: Math.min(batchSize, totalCards - i) }, (_, j) => {
          const cardNum = i + j + 1;
          return request(app)
            .post('/api/cards')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              english: `Large Dataset Card ${cardNum}`,
              spanish: `Tarjeta Dataset Grande ${cardNum}`
            });
        });

        await Promise.all(batch);
      }

      // Test pagination with large dataset
      const page1 = await request(app)
        .get('/api/cards?page=1&limit=25')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(page1.body).toHaveLength(25);

      // Test count
      const count = await request(app)
        .get('/api/cards/my/count')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(count.body.count).toBe(totalCards);
    });

    test('should maintain data integrity during cascading deletions', async () => {
      const { user, accessToken } = await createAuthenticatedUser('cascade.delete@userapi.com');

      // Create flashcards and reviews
      const createResponse = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          english: 'Cascade Test',
          spanish: 'Prueba Cascada'
        })
        .expect(201);

      // Review the flashcard
      await request(app)
        .post(`/api/cards/${createResponse.body.id}/review`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ performanceRating: 4 })
        .expect(200);

      // Delete user account
      await request(app)
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify all user data is cleaned up (this would be tested at database level)
      // For now, verify the user can't authenticate
      await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });
});