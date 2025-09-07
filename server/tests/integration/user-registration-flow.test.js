import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

/**
 * Integration Test: Complete User Registration Flow
 * 
 * Tests the complete user journey from registration through login to flashcard creation.
 * This validates the entire authentication and user isolation system working together.
 * 
 * CRITICAL: This test MUST FAIL initially (TDD requirement)
 * Multiple endpoints and services must work together - implementation comes after tests pass
 */

describe('User Registration → Login → Flashcard Creation Flow - Integration Test', () => {
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
    // Clean up test data before each test
    try {
      const { default: db } = await import('../../config/database.js');
      await db.initialize();
      
      // Clean up test users and their flashcards
      const database = db.getDatabase();
      database.prepare('DELETE FROM cards WHERE user_id IN (SELECT id FROM users WHERE email LIKE ?)').run('%integration%');
      database.prepare('DELETE FROM users WHERE email LIKE ?').run('%integration%');
    } catch (error) {
      // Expected to fail during TDD phase
      console.log('Database cleanup failed (expected during TDD):', error.message);
    }
  });

  describe('Complete User Journey', () => {
    test('should support full user lifecycle: register → login → create flashcard → study', async () => {
      // Step 1: User Registration
      const registrationData = {
        email: 'integration.test@example.com',
        password: 'securepassword123'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect('Content-Type', /json/)
        .expect(201);

      // Validate registration response
      expect(registerResponse.body).toHaveProperty('id');
      expect(registerResponse.body).toHaveProperty('email', 'integration.test@example.com');
      expect(registerResponse.body).toHaveProperty('role', 'user');
      expect(registerResponse.body).toHaveProperty('createdAt');

      // Step 2: User Login
      const loginData = {
        email: 'integration.test@example.com',
        password: 'securepassword123'
      };

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect('Content-Type', /json/)
        .expect(200);

      // Validate login response
      expect(loginResponse.body).toHaveProperty('accessToken');
      expect(loginResponse.body).toHaveProperty('user');
      expect(loginResponse.body.user.id).toBe(registerResponse.body.id);

      const accessToken = loginResponse.body.accessToken;

      // Step 3: Profile Verification
      const profileResponse = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(profileResponse.body).toMatchObject({
        id: registerResponse.body.id,
        email: 'integration.test@example.com',
        role: 'user'
      });

      // Step 4: Create First Flashcard
      const flashcardData = {
        english: 'Hello World',
        spanish: 'Hola Mundo'
      };

      const createFlashcardResponse = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(flashcardData)
        .expect('Content-Type', /json/)
        .expect(201);

      // Validate flashcard creation
      expect(createFlashcardResponse.body).toHaveProperty('id');
      expect(createFlashcardResponse.body).toHaveProperty('english', 'Hello World');
      expect(createFlashcardResponse.body).toHaveProperty('spanish', 'Hola Mundo');
      expect(createFlashcardResponse.body).toHaveProperty('userId', registerResponse.body.id);
      expect(createFlashcardResponse.body).toHaveProperty('difficulty', 0);
      expect(createFlashcardResponse.body).toHaveProperty('reviewCount', 0);

      // Step 5: Verify Flashcard in User's Collection
      const flashcardsResponse = await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(flashcardsResponse.body)).toBe(true);
      expect(flashcardsResponse.body).toHaveLength(1);
      expect(flashcardsResponse.body[0]).toMatchObject({
        id: createFlashcardResponse.body.id,
        english: 'Hello World',
        spanish: 'Hola Mundo',
        userId: registerResponse.body.id
      });

      // Step 6: Study Session (Review Flashcard)
      const reviewResponse = await request(app)
        .post(`/api/cards/${createFlashcardResponse.body.id}/review`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ difficulty: 3 })
        .expect(200);

      // Validate review updated the flashcard
      expect(reviewResponse.body.reviewCount).toBe(1);
      expect(reviewResponse.body.difficulty).toBe(3);
      expect(reviewResponse.body).toHaveProperty('lastReviewed');
    });

    test('should maintain user isolation during parallel registrations', async () => {
      // Create multiple users in parallel
      const userPromises = Array.from({ length: 3 }, (_, i) => ({
        email: `parallel.user${i}@example.com`,
        password: 'password123'
      })).map(async (userData, index) => {
        // Register user
        const registerResponse = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(201);

        // Login user
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send(userData)
          .expect(200);

        // Create unique flashcard
        const flashcardResponse = await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
          .send({
            english: `Parallel Card ${index}`,
            spanish: `Tarjeta Paralela ${index}`
          })
          .expect(201);

        return {
          user: registerResponse.body,
          token: loginResponse.body.accessToken,
          flashcard: flashcardResponse.body
        };
      });

      const results = await Promise.all(userPromises);

      // Verify each user only sees their own flashcard
      for (let i = 0; i < results.length; i++) {
        const { token, user, flashcard } = results[i];

        const userFlashcards = await request(app)
          .get('/api/cards')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        // User should have exactly one flashcard (their own)
        expect(userFlashcards.body).toHaveLength(1);
        expect(userFlashcards.body[0]).toMatchObject({
          id: flashcard.id,
          userId: user.id,
          english: `Parallel Card ${i}`
        });

        // Verify they can't see other users' flashcards
        const otherFlashcards = results
          .filter((_, j) => j !== i)
          .map(r => r.flashcard.id);
        
        const foundOtherCards = userFlashcards.body.filter(card => 
          otherFlashcards.includes(card.id)
        );
        expect(foundOtherCards).toHaveLength(0);
      }
    });

    test('should handle session expiry gracefully in user workflow', async () => {
      // Register and login user
      const userData = {
        email: 'session.test@example.com',
        password: 'password123'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(userData)
        .expect(200);

      const accessToken = loginResponse.body.accessToken;

      // Create flashcard with valid token
      await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          english: 'Valid Session Card',
          spanish: 'Tarjeta Sesión Válida'
        })
        .expect(201);

      // Logout to invalidate token
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Try to create flashcard with invalidated token
      await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          english: 'Invalid Session Card',
          spanish: 'Tarjeta Sesión Inválida'
        })
        .expect(401);

      // Re-login should work
      const reloginResponse = await request(app)
        .post('/api/auth/login')
        .send(userData)
        .expect(200);

      // New token should work
      await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${reloginResponse.body.accessToken}`)
        .send({
          english: 'New Session Card',
          spanish: 'Tarjeta Nueva Sesión'
        })
        .expect(201);
    });
  });

  describe('Error Recovery in User Flow', () => {
    test('should handle registration failure and allow retry', async () => {
      // Attempt registration with invalid data
      const invalidData = {
        email: 'invalid-email',
        password: 'short'
      };

      await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      // Retry with valid data should work
      const validData = {
        email: 'retry.test@example.com',
        password: 'validpassword123'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(validData)
        .expect(201);

      // Continue with normal flow
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(validData)
        .expect(200);

      expect(loginResponse.body.user.id).toBe(registerResponse.body.id);
    });

    test('should handle login failure and prevent unauthorized access', async () => {
      // Register user
      const userData = {
        email: 'login.fail@example.com',
        password: 'correctpassword123'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Attempt login with wrong password
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login.fail@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      // Should not be able to access protected resources
      await request(app)
        .get('/api/users/me')
        .expect(401);

      await request(app)
        .post('/api/cards')
        .send({
          english: 'Unauthorized Card',
          spanish: 'Tarjeta No Autorizada'
        })
        .expect(401);

      // Correct login should work
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(userData)
        .expect(200);

      // Now should be able to access protected resources
      await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
        .expect(200);
    });

    test('should handle flashcard creation failure and maintain user state', async () => {
      // Set up authenticated user
      const userData = {
        email: 'flashcard.fail@example.com',
        password: 'password123'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(userData)
        .expect(200);

      const accessToken = loginResponse.body.accessToken;

      // Attempt to create invalid flashcard
      await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          english: '', // Invalid - empty
          spanish: 'Valid Spanish'
        })
        .expect(400);

      // User should still be authenticated
      await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Valid flashcard creation should work
      const flashcardResponse = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          english: 'Valid English',
          spanish: 'Español Válido'
        })
        .expect(201);

      // Verify flashcard was created correctly
      const flashcardsResponse = await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(flashcardsResponse.body).toHaveLength(1);
      expect(flashcardsResponse.body[0].id).toBe(flashcardResponse.body.id);
    });
  });

  describe('User Data Consistency', () => {
    test('should maintain data consistency across user operations', async () => {
      // Register user
      const userData = {
        email: 'consistency.test@example.com',
        password: 'password123'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      const userId = registerResponse.body.id;

      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(userData)
        .expect(200);

      const accessToken = loginResponse.body.accessToken;

      // Create multiple flashcards
      const flashcardPromises = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            english: `Consistency Card ${i}`,
            spanish: `Tarjeta Consistencia ${i}`
          })
          .expect(201)
      );

      const flashcardResponses = await Promise.all(flashcardPromises);

      // Verify all flashcards belong to the user
      const flashcardsResponse = await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(flashcardsResponse.body).toHaveLength(5);
      
      flashcardsResponse.body.forEach((flashcard, index) => {
        expect(flashcard.userId).toBe(userId);
        expect(flashcard.english).toBe(`Consistency Card ${index}`);
        expect(flashcard.difficulty).toBe(0);
        expect(flashcard.reviewCount).toBe(0);
      });

      // Update one flashcard
      const firstFlashcard = flashcardResponses[0].body;
      const updateResponse = await request(app)
        .put(`/api/cards/${firstFlashcard.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          english: 'Updated Consistency Card',
          spanish: 'Tarjeta Consistencia Actualizada'
        })
        .expect(200);

      expect(updateResponse.body.userId).toBe(userId);

      // Review another flashcard
      const secondFlashcard = flashcardResponses[1].body;
      await request(app)
        .post(`/api/cards/${secondFlashcard.id}/review`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ difficulty: 2 })
        .expect(200);

      // Final verification
      const finalFlashcardsResponse = await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(finalFlashcardsResponse.body).toHaveLength(5);

      const updatedCard = finalFlashcardsResponse.body.find(c => c.id === firstFlashcard.id);
      const reviewedCard = finalFlashcardsResponse.body.find(c => c.id === secondFlashcard.id);

      expect(updatedCard.english).toBe('Updated Consistency Card');
      expect(reviewedCard.reviewCount).toBe(1);
      expect(reviewedCard.difficulty).toBe(2);
    });
  });
});