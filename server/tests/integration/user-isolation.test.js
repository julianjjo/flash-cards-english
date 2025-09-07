import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

/**
 * Integration Test: User Data Isolation
 * 
 * Tests that users cannot access or modify each other's data across all endpoints.
 * This is critical for data security and privacy in the multi-user system.
 * 
 * CRITICAL: This test MUST FAIL initially (TDD requirement)
 * Data isolation must be implemented at database and endpoint levels
 */

describe('User Data Isolation - Integration Test', () => {
  let app;
  let server;
  let alice = {}; // User Alice data
  let bob = {}; // User Bob data  
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
    // Clean up test data
    try {
      const { default: db } = await import('../../config/database.js');
      await db.initialize();
      
      const database = db.getDatabase();
      database.prepare('DELETE FROM cards WHERE user_id IN (SELECT id FROM users WHERE email LIKE ?)').run('%isolation%');
      database.prepare('DELETE FROM users WHERE email LIKE ?').run('%isolation%');
    } catch (error) {
      console.log('Database cleanup failed (expected during TDD):', error.message);
    }

    // Set up test users Alice and Bob
    try {
      // Register Alice
      const aliceRegister = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'alice.isolation@example.com',
          password: 'alicepassword123'
        })
        .expect(201);

      const aliceLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alice.isolation@example.com',
          password: 'alicepassword123'
        })
        .expect(200);

      alice = {
        id: aliceRegister.body.id,
        email: 'alice.isolation@example.com',
        token: aliceLogin.body.accessToken,
        flashcards: []
      };

      // Register Bob
      const bobRegister = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'bob.isolation@example.com',
          password: 'bobpassword123'
        })
        .expect(201);

      const bobLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'bob.isolation@example.com',
          password: 'bobpassword123'
        })
        .expect(200);

      bob = {
        id: bobRegister.body.id,
        email: 'bob.isolation@example.com',
        token: bobLogin.body.accessToken,
        flashcards: []
      };

      // Get admin token
      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: process.env.ADMIN_EMAIL || 'admin@flashcards.com',
          password: process.env.ADMIN_PASS || 'admin123'
        })
        .expect(200);

      adminToken = adminLogin.body.accessToken;

      // Create test flashcards for each user
      const aliceCard = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({
          english: "Alice's Private Card",
          spanish: "Tarjeta Privada de Alice"
        })
        .expect(201);

      alice.flashcards.push(aliceCard.body);

      const bobCard = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({
          english: "Bob's Secret Card",
          spanish: "Tarjeta Secreta de Bob"
        })
        .expect(201);

      bob.flashcards.push(bobCard.body);

    } catch (error) {
      console.log('Test user setup failed (expected during TDD):', error.message);
      alice = { id: 1, email: 'alice@example.com', token: 'mock-alice-token', flashcards: [{ id: 1 }] };
      bob = { id: 2, email: 'bob@example.com', token: 'mock-bob-token', flashcards: [{ id: 2 }] };
      adminToken = 'mock-admin-token';
    }
  });

  describe('Flashcard Access Isolation', () => {
    test('users should only see their own flashcards via GET /api/cards', async () => {
      // Alice gets her flashcards
      const aliceResponse = await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);

      // Alice should only see her flashcards
      expect(aliceResponse.body).toHaveLength(1);
      expect(aliceResponse.body[0]).toMatchObject({
        userId: alice.id,
        english: "Alice's Private Card"
      });

      // Bob gets his flashcards
      const bobResponse = await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(200);

      // Bob should only see his flashcards
      expect(bobResponse.body).toHaveLength(1);
      expect(bobResponse.body[0]).toMatchObject({
        userId: bob.id,
        english: "Bob's Secret Card"
      });

      // Verify Alice can't see Bob's cards and vice versa
      const aliceCardIds = aliceResponse.body.map(card => card.id);
      const bobCardIds = bobResponse.body.map(card => card.id);
      
      expect(aliceCardIds.includes(bob.flashcards[0].id)).toBe(false);
      expect(bobCardIds.includes(alice.flashcards[0].id)).toBe(false);
    });

    test('users cannot access other users flashcards directly by ID', async () => {
      // Alice tries to access Bob's flashcard
      await request(app)
        .get(`/api/cards/${bob.flashcards[0].id}`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(403);

      // Bob tries to access Alice's flashcard
      await request(app)
        .get(`/api/cards/${alice.flashcards[0].id}`)
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(403);
    });

    test('users cannot modify other users flashcards', async () => {
      // Alice tries to update Bob's flashcard
      const updateResponse = await request(app)
        .put(`/api/cards/${bob.flashcards[0].id}`)
        .set('Authorization', `Bearer ${alice.token}`)
        .send({
          english: "Alice trying to hack Bob's card",
          spanish: "Alice tratando de hackear la tarjeta de Bob"
        })
        .expect(403);

      expect(updateResponse.body.error).toBe('FORBIDDEN');

      // Bob tries to update Alice's flashcard
      await request(app)
        .put(`/api/cards/${alice.flashcards[0].id}`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send({
          english: "Bob trying to hack Alice's card",
          spanish: "Bob tratando de hackear la tarjeta de Alice"
        })
        .expect(403);
    });

    test('users cannot delete other users flashcards', async () => {
      // Alice tries to delete Bob's flashcard
      await request(app)
        .delete(`/api/cards/${bob.flashcards[0].id}`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(403);

      // Bob tries to delete Alice's flashcard
      await request(app)
        .delete(`/api/cards/${alice.flashcards[0].id}`)
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(403);

      // Verify flashcards still exist
      const aliceFlashcards = await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);

      const bobFlashcards = await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(200);

      expect(aliceFlashcards.body).toHaveLength(1);
      expect(bobFlashcards.body).toHaveLength(1);
    });

    test('users cannot review other users flashcards', async () => {
      // Alice tries to review Bob's flashcard
      await request(app)
        .post(`/api/cards/${bob.flashcards[0].id}/review`)
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ difficulty: 5 })
        .expect(403);

      // Bob tries to review Alice's flashcard
      await request(app)
        .post(`/api/cards/${alice.flashcards[0].id}/review`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ difficulty: 1 })
        .expect(403);
    });
  });

  describe('Study Session Isolation', () => {
    test('study sessions should only include user-owned flashcards', async () => {
      // Create additional flashcards for both users
      await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ english: 'Alice Card 2', spanish: 'Tarjeta Alice 2' })
        .expect(201);

      await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ english: 'Bob Card 2', spanish: 'Tarjeta Bob 2' })
        .expect(201);

      // Alice gets study session
      const aliceStudy = await request(app)
        .get('/api/cards/study?limit=10')
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);

      // Bob gets study session
      const bobStudy = await request(app)
        .get('/api/cards/study?limit=10')
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(200);

      // Verify study sessions are isolated
      aliceStudy.body.forEach(card => {
        expect(card.userId).toBe(alice.id);
      });

      bobStudy.body.forEach(card => {
        expect(card.userId).toBe(bob.id);
      });

      // Verify no cross-contamination
      const aliceCardIds = aliceStudy.body.map(card => card.id);
      const bobCardIds = bobStudy.body.map(card => card.id);
      
      expect(aliceCardIds.some(id => bobCardIds.includes(id))).toBe(false);
    });
  });

  describe('User Profile Isolation', () => {
    test('users can only access their own profile', async () => {
      // Alice gets her profile
      const aliceProfile = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);

      expect(aliceProfile.body).toMatchObject({
        id: alice.id,
        email: alice.email,
        role: 'user'
      });

      // Bob gets his profile
      const bobProfile = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(200);

      expect(bobProfile.body).toMatchObject({
        id: bob.id,
        email: bob.email,
        role: 'user'
      });

      // Profiles should be different
      expect(aliceProfile.body.id).not.toBe(bobProfile.body.id);
      expect(aliceProfile.body.email).not.toBe(bobProfile.body.email);
    });

    test('users cannot access admin endpoints', async () => {
      // Alice tries to access admin user list
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(403);

      // Bob tries to access admin user list
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(403);

      // Alice tries to delete Bob via admin endpoint
      await request(app)
        .delete(`/api/admin/users/${bob.id}`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(403);
    });
  });

  describe('Admin Privilege Validation', () => {
    test('admin should have access to all user data via admin endpoints', async () => {
      // Admin gets user list
      const userListResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const users = userListResponse.body.users;
      const aliceInList = users.find(u => u.email === alice.email);
      const bobInList = users.find(u => u.email === bob.email);

      expect(aliceInList).toBeDefined();
      expect(bobInList).toBeDefined();

      // Admin gets Alice's flashcards via admin endpoint
      const aliceFlashcardsResponse = await request(app)
        .get(`/api/admin/users/${alice.id}/flashcards`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(aliceFlashcardsResponse.body.flashcards).toHaveLength(1);
      expect(aliceFlashcardsResponse.body.flashcards[0].english).toBe("Alice's Private Card");

      // Admin gets Bob's flashcards via admin endpoint
      const bobFlashcardsResponse = await request(app)
        .get(`/api/admin/users/${bob.id}/flashcards`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(bobFlashcardsResponse.body.flashcards).toHaveLength(1);
      expect(bobFlashcardsResponse.body.flashcards[0].english).toBe("Bob's Secret Card");
    });

    test('admin should still have isolated personal flashcards', async () => {
      // Admin creates personal flashcard
      const adminFlashcard = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          english: 'Admin Personal Card',
          spanish: 'Tarjeta Personal Admin'
        })
        .expect(201);

      // Admin gets personal flashcards (not via admin endpoint)
      const adminPersonalCards = await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Should only see admin's personal cards, not user cards
      expect(adminPersonalCards.body).toHaveLength(1);
      expect(adminPersonalCards.body[0].english).toBe('Admin Personal Card');

      // Should not include Alice's or Bob's cards
      const hasAliceCard = adminPersonalCards.body.some(card => 
        card.english === "Alice's Private Card"
      );
      const hasBobCard = adminPersonalCards.body.some(card => 
        card.english === "Bob's Secret Card"
      );

      expect(hasAliceCard).toBe(false);
      expect(hasBobCard).toBe(false);
    });
  });

  describe('Cross-User Attack Prevention', () => {
    test('should prevent user ID spoofing in requests', async () => {
      // Alice tries to create flashcard claiming to be Bob
      const spoofedFlashcard = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({
          english: 'Spoofed Card',
          spanish: 'Tarjeta Falsificada',
          userId: bob.id // This should be ignored
        })
        .expect(201);

      // Should be assigned to Alice, not Bob
      expect(spoofedFlashcard.body.userId).toBe(alice.id);

      // Bob should not see this card
      const bobCards = await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(200);

      const spoofedCardInBobList = bobCards.body.find(card => 
        card.id === spoofedFlashcard.body.id
      );
      expect(spoofedCardInBobList).toBeUndefined();
    });

    test('should prevent JWT token reuse across users', async () => {
      // Alice logs out
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);

      // Bob tries to use Alice's invalidated token
      await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(401);

      // Alice tries to use her invalidated token
      await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(401);
    });

    test('should prevent SQL injection through user isolation', async () => {
      // Attempt SQL injection via flashcard creation
      const injectionAttempt = await request(app)
        .post('/api/cards')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({
          english: "'; DROP TABLE users; --",
          spanish: "'; SELECT * FROM users; --"
        })
        .expect(201);

      // Should treat as literal text, not SQL
      expect(injectionAttempt.body.english).toBe("'; DROP TABLE users; --");

      // Alice should still be able to login (users table not dropped)
      await request(app)
        .post('/api/auth/login')
        .send({
          email: alice.email,
          password: 'alicepassword123'
        })
        .expect(200);

      // Bob should still exist and be accessible
      await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(200);
    });
  });

  describe('Data Consistency Under Isolation', () => {
    test('should maintain isolation during concurrent operations', async () => {
      // Both users create flashcards simultaneously
      const concurrentOperations = [
        request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${alice.token}`)
          .send({ english: 'Alice Concurrent 1', spanish: 'Alice Concurrente 1' }),
        
        request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${bob.token}`)
          .send({ english: 'Bob Concurrent 1', spanish: 'Bob Concurrente 1' }),
          
        request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${alice.token}`)
          .send({ english: 'Alice Concurrent 2', spanish: 'Alice Concurrente 2' }),
          
        request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${bob.token}`)
          .send({ english: 'Bob Concurrent 2', spanish: 'Bob Concurrente 2' })
      ];

      const results = await Promise.all(concurrentOperations);

      // All operations should succeed
      results.forEach(result => {
        expect(result.status).toBe(201);
      });

      // Verify isolation maintained
      const aliceCards = await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);

      const bobCards = await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(200);

      // Alice should have 3 cards (1 initial + 2 concurrent)
      expect(aliceCards.body).toHaveLength(3);
      aliceCards.body.forEach(card => {
        expect(card.userId).toBe(alice.id);
      });

      // Bob should have 3 cards (1 initial + 2 concurrent)
      expect(bobCards.body).toHaveLength(3);
      bobCards.body.forEach(card => {
        expect(card.userId).toBe(bob.id);
      });
    });
  });
});