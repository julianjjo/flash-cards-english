import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

/**
 * Integration Test: Admin Dashboard User Management
 * 
 * Tests the complete admin workflow for managing users and their data.
 * Validates admin-only access controls and user management capabilities.
 * 
 * CRITICAL: This test MUST FAIL initially (TDD requirement)
 * Admin endpoints and role-based access control must be implemented
 */

describe('Admin Dashboard User Management - Integration Test', () => {
  let app;
  let server;
  let adminToken;
  let regularUserToken;
  let testUsers = [];

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
      database.prepare('DELETE FROM cards WHERE user_id IN (SELECT id FROM users WHERE email LIKE ?)').run('%admin.test%');
      database.prepare('DELETE FROM users WHERE email LIKE ?').run('%admin.test%');
    } catch (error) {
      console.log('Database cleanup failed (expected during TDD):', error.message);
    }

    testUsers = [];

    try {
      // Get admin token
      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: process.env.ADMIN_EMAIL || 'admin@flashcards.com',
          password: process.env.ADMIN_PASS || 'admin123'
        })
        .expect(200);

      adminToken = adminLogin.body.accessToken;

      // Create test users for management
      const testUserData = [
        { email: 'user1.admin.test@example.com', password: 'password123', name: 'Test User 1' },
        { email: 'user2.admin.test@example.com', password: 'password123', name: 'Test User 2' },
        { email: 'user3.admin.test@example.com', password: 'password123', name: 'Test User 3' }
      ];

      for (const userData of testUserData) {
        // Register user
        const registerResponse = await request(app)
          .post('/api/auth/register')
          .send({
            email: userData.email,
            password: userData.password
          })
          .expect(201);

        // Login to get token
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: userData.email,
            password: userData.password
          })
          .expect(200);

        // Create some flashcards for the user
        const flashcardPromises = Array.from({ length: 3 }, (_, i) =>
          request(app)
            .post('/api/cards')
            .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
            .send({
              english: `${userData.name} Card ${i + 1}`,
              spanish: `Tarjeta ${i + 1} de ${userData.name}`
            })
            .expect(201)
        );

        const flashcardResponses = await Promise.all(flashcardPromises);

        testUsers.push({
          id: registerResponse.body.id,
          email: userData.email,
          token: loginResponse.body.accessToken,
          flashcards: flashcardResponses.map(r => r.body)
        });
      }

      // Set regular user token (first test user)
      regularUserToken = testUsers[0].token;

    } catch (error) {
      console.log('Test setup failed (expected during TDD):', error.message);
      adminToken = 'mock-admin-token';
      regularUserToken = 'mock-user-token';
      testUsers = [
        { id: 1, email: 'user1@example.com', flashcards: [{ id: 1 }] },
        { id: 2, email: 'user2@example.com', flashcards: [{ id: 2 }] },
        { id: 3, email: 'user3@example.com', flashcards: [{ id: 3 }] }
      ];
    }
  });

  describe('Admin User List Management', () => {
    test('admin should be able to view paginated user list', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      // Validate response structure
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('pagination');

      // Should contain test users
      const userEmails = response.body.users.map(u => u.email);
      testUsers.forEach(testUser => {
        expect(userEmails).toContain(testUser.email);
      });

      // Validate user summary structure
      response.body.users.forEach(user => {
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('createdAt');
        expect(user).toHaveProperty('flashcardCount');

        // Ensure no sensitive data
        expect(user).not.toHaveProperty('password');
        expect(user).not.toHaveProperty('password_hash');
      });

      // Validate pagination
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('totalPages');
    });

    test('admin should be able to filter users by role', async () => {
      // Get only regular users
      const userResponse = await request(app)
        .get('/api/admin/users?role=user')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // All returned users should have 'user' role
      userResponse.body.users.forEach(user => {
        expect(user.role).toBe('user');
      });

      // Should include test users
      const testUserEmails = testUsers.map(u => u.email);
      const returnedEmails = userResponse.body.users.map(u => u.email);
      testUserEmails.forEach(email => {
        expect(returnedEmails).toContain(email);
      });

      // Get only admin users
      const adminResponse = await request(app)
        .get('/api/admin/users?role=admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // All returned users should have 'admin' role
      adminResponse.body.users.forEach(user => {
        expect(user.role).toBe('admin');
      });
    });

    test('admin should be able to paginate through user list', async () => {
      // Get first page
      const page1Response = await request(app)
        .get('/api/admin/users?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(page1Response.body.pagination.page).toBe(1);
      expect(page1Response.body.pagination.limit).toBe(2);
      expect(page1Response.body.users.length).toBeLessThanOrEqual(2);

      if (page1Response.body.pagination.totalPages > 1) {
        // Get second page
        const page2Response = await request(app)
          .get('/api/admin/users?page=2&limit=2')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(page2Response.body.pagination.page).toBe(2);
        
        // Pages should have different users
        const page1Ids = page1Response.body.users.map(u => u.id);
        const page2Ids = page2Response.body.users.map(u => u.id);
        
        const overlap = page1Ids.filter(id => page2Ids.includes(id));
        expect(overlap).toHaveLength(0);
      }
    });

    test('regular users should not be able to access admin user list', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect('Content-Type', /json/)
        .expect(403);

      expect(response.body.error).toBe('FORBIDDEN');
      expect(response.body.message).toMatch(/admin.*access.*required/i);
    });
  });

  describe('Individual User Management', () => {
    test('admin should be able to view detailed user information', async () => {
      const testUser = testUsers[0];
      
      const response = await request(app)
        .get(`/api/admin/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      // Validate detailed user structure
      expect(response.body).toMatchObject({
        id: testUser.id,
        email: testUser.email,
        role: 'user'
      });

      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
      expect(response.body).toHaveProperty('flashcardCount');
      expect(response.body).toHaveProperty('lastLoginAt');

      // Should have correct flashcard count
      expect(response.body.flashcardCount).toBe(3);

      // Should not expose sensitive information
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('password_hash');
    });

    test('admin should be able to view users flashcards', async () => {
      const testUser = testUsers[0];
      
      const response = await request(app)
        .get(`/api/admin/users/${testUser.id}/flashcards`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('flashcards');
      expect(response.body).toHaveProperty('count');

      // Should have 3 flashcards
      expect(response.body.flashcards).toHaveLength(3);
      expect(response.body.count).toBe(3);

      // Validate flashcard structure
      response.body.flashcards.forEach(flashcard => {
        expect(flashcard).toHaveProperty('id');
        expect(flashcard).toHaveProperty('english');
        expect(flashcard).toHaveProperty('spanish');
        expect(flashcard).toHaveProperty('userId', testUser.id);
        expect(flashcard).toHaveProperty('difficulty');
        expect(flashcard).toHaveProperty('reviewCount');
      });

      // Should match created flashcards
      const expectedTexts = testUser.flashcards.map(f => f.english);
      const actualTexts = response.body.flashcards.map(f => f.english);
      expectedTexts.forEach(text => {
        expect(actualTexts).toContain(text);
      });
    });

    test('regular users should not be able to access other users details', async () => {
      const testUser = testUsers[1]; // Different user than the token owner
      
      await request(app)
        .get(`/api/admin/users/${testUser.id}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);

      await request(app)
        .get(`/api/admin/users/${testUser.id}/flashcards`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('User Deletion Management', () => {
    test('admin should be able to delete user accounts', async () => {
      const testUser = testUsers[2]; // Use last test user for deletion
      
      // Verify user exists
      await request(app)
        .get(`/api/admin/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Delete user
      const deleteResponse = await request(app)
        .delete(`/api/admin/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(deleteResponse.body).toHaveProperty('success', true);
      expect(deleteResponse.body).toHaveProperty('message');
      expect(deleteResponse.body.message).toMatch(/user.*deleted.*successfully/i);

      // Verify user no longer exists
      await request(app)
        .get(`/api/admin/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      // Verify user can no longer login
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'password123'
        })
        .expect(401);

      // Verify user's token is invalid
      await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(401);
    });

    test('user deletion should cascade delete flashcards', async () => {
      const testUser = testUsers[1];
      
      // Verify user has flashcards
      const flashcardsResponse = await request(app)
        .get(`/api/admin/users/${testUser.id}/flashcards`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(flashcardsResponse.body.flashcards).toHaveLength(3);

      // Delete user
      await request(app)
        .delete(`/api/admin/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Try to access user's flashcards (should fail since user is deleted)
      await request(app)
        .get(`/api/admin/users/${testUser.id}/flashcards`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      // Verify flashcards don't appear in admin's personal collection
      const adminFlashcards = await request(app)
        .get('/api/cards')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const deletedUserCards = adminFlashcards.body.filter(card => 
        card.userId === testUser.id
      );
      expect(deletedUserCards).toHaveLength(0);
    });

    test('admin should not be able to delete themselves', async () => {
      // Get admin profile to get admin ID
      const adminProfile = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const adminId = adminProfile.body.id;

      // Try to delete self
      const response = await request(app)
        .delete(`/api/admin/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.error).toBe('CANNOT_DELETE_SELF');
      expect(response.body.message).toMatch(/cannot.*delete.*your.*own.*account/i);

      // Verify admin still exists
      await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    test('regular users should not be able to delete any accounts', async () => {
      const testUser = testUsers[0];
      
      // Try to delete another user
      await request(app)
        .delete(`/api/admin/users/${testUsers[1].id}`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(403);

      // Try to delete themselves via admin endpoint
      await request(app)
        .delete(`/api/admin/users/${testUser.id}`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(403);
    });
  });

  describe('System Statistics', () => {
    test('admin should be able to view system statistics', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      // Validate statistics structure
      expect(response.body).toHaveProperty('totalUsers');
      expect(response.body).toHaveProperty('totalFlashcards');
      expect(response.body).toHaveProperty('activeUsers');
      expect(response.body).toHaveProperty('adminUsers');

      // Validate data types
      expect(typeof response.body.totalUsers).toBe('number');
      expect(typeof response.body.totalFlashcards).toBe('number');
      expect(typeof response.body.activeUsers).toBe('number');
      expect(typeof response.body.adminUsers).toBe('number');

      // Should have reasonable values
      expect(response.body.totalUsers).toBeGreaterThan(0);
      expect(response.body.totalFlashcards).toBeGreaterThan(0);
      expect(response.body.adminUsers).toBeGreaterThanOrEqual(1); // At least the test admin
    });

    test('regular users should not be able to access system statistics', async () => {
      await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });
  });

  describe('Admin Workflow Integration', () => {
    test('should support complete admin workflow: list → view details → manage → delete', async () => {
      // Step 1: Admin lists users
      const userListResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const targetUser = userListResponse.body.users.find(u => 
        u.email === testUsers[0].email
      );
      expect(targetUser).toBeDefined();

      // Step 2: Admin views user details
      const userDetailResponse = await request(app)
        .get(`/api/admin/users/${targetUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(userDetailResponse.body.email).toBe(targetUser.email);
      expect(userDetailResponse.body.flashcardCount).toBe(3);

      // Step 3: Admin views user's flashcards
      const flashcardsResponse = await request(app)
        .get(`/api/admin/users/${targetUser.id}/flashcards`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(flashcardsResponse.body.flashcards).toHaveLength(3);

      // Step 4: Admin gets system stats
      const statsResponse = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const initialUserCount = statsResponse.body.totalUsers;
      const initialFlashcardCount = statsResponse.body.totalFlashcards;

      // Step 5: Admin deletes user
      await request(app)
        .delete(`/api/admin/users/${targetUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Step 6: Verify changes reflected in stats
      const updatedStatsResponse = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(updatedStatsResponse.body.totalUsers).toBe(initialUserCount - 1);
      expect(updatedStatsResponse.body.totalFlashcards).toBe(initialFlashcardCount - 3);

      // Step 7: Verify user no longer appears in list
      const updatedUserListResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const deletedUserInList = updatedUserListResponse.body.users.find(u => 
        u.id === targetUser.id
      );
      expect(deletedUserInList).toBeUndefined();
    });
  });

  describe('Error Handling in Admin Operations', () => {
    test('should handle non-existent user operations gracefully', async () => {
      const nonExistentId = 99999;

      // View non-existent user
      await request(app)
        .get(`/api/admin/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      // View non-existent user's flashcards
      await request(app)
        .get(`/api/admin/users/${nonExistentId}/flashcards`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      // Delete non-existent user
      await request(app)
        .delete(`/api/admin/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    test('should validate admin endpoint parameters', async () => {
      // Invalid user ID format
      await request(app)
        .get('/api/admin/users/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      // Invalid pagination parameters
      await request(app)
        .get('/api/admin/users?page=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      await request(app)
        .get('/api/admin/users?limit=101')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      await request(app)
        .get('/api/admin/users?role=invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });
});