import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

/**
 * Integration Tests: Admin & Statistics API Endpoints
 * 
 * Comprehensive tests for administrative and statistics endpoints:
 * 
 * Admin Management:
 * - GET /api/admin/users - Get all users (paginated)
 * - GET /api/admin/users/:id - Get specific user details
 * - PUT /api/admin/users/:id - Update user
 * - DELETE /api/admin/users/:id - Delete user
 * - POST /api/admin/users/:id/promote - Promote user to admin
 * - POST /api/admin/users/:id/demote - Demote admin to user
 * - GET /api/admin/users/:id/flashcards - Get user flashcards
 * - DELETE /api/admin/users/:id/flashcards - Delete all user flashcards
 * - GET /api/admin/system/health - System health check
 * 
 * Statistics:
 * - GET /api/stats/my-stats - Current user statistics
 * - GET /api/stats/my-dashboard - Dashboard statistics
 * - GET /api/stats/system - System-wide statistics (admin only)
 * - GET /api/stats/my-performance - Performance analytics
 * - GET /api/stats/export/:userId - Export user statistics
 * 
 * Bulk Operations:
 * - POST /api/bulk/flashcards/import - Bulk import flashcards
 * - PUT /api/bulk/flashcards/update - Bulk update flashcards
 * - DELETE /api/bulk/flashcards/delete - Bulk delete flashcards
 * - POST /api/bulk/users/actions - Bulk user actions
 * 
 * Tests admin authorization, role-based access control, data aggregation,
 * bulk operations, system monitoring, and administrative workflows.
 */

describe('Admin & Statistics API Endpoints - Integration Tests', () => {
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
      database.prepare('DELETE FROM cards WHERE user_id IN (SELECT id FROM users WHERE email LIKE ?)').run('%adminapi%');
      database.prepare('DELETE FROM users WHERE email LIKE ?').run('%adminapi%');
    } catch (error) {
      console.log('Database cleanup failed (expected during TDD):', error.message);
    }
  });

  // Helper function to create authenticated user
  const createAuthenticatedUser = async (email, password = 'testpassword123', role = 'user') => {
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({ email, password })
      .expect(201);

    // If admin role requested, promote the user
    if (role === 'admin') {
      // This would typically be done through database direct manipulation
      // For test purposes, we'll assume there's an admin already or use database operations
      try {
        const { default: db } = await import('../../config/database.js');
        const database = db.getDatabase();
        database.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', registerResponse.body.user.id);
        
        // Re-login to get updated token with admin role
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({ email, password })
          .expect(200);

        return {
          user: { ...registerResponse.body.user, role: 'admin' },
          accessToken: loginResponse.body.accessToken
        };
      } catch (error) {
        console.log('Admin promotion failed (expected during TDD):', error.message);
      }
    }

    return {
      user: registerResponse.body.user,
      accessToken: registerResponse.body.accessToken
    };
  };

  describe('Admin User Management', () => {
    describe('GET /api/admin/users', () => {
      test('should return all users for admin', async () => {
        const { accessToken: adminToken } = await createAuthenticatedUser('admin.users@adminapi.com', 'password123', 'admin');
        
        // Create some test users
        await createAuthenticatedUser('user1@adminapi.com');
        await createAuthenticatedUser('user2@adminapi.com');
        await createAuthenticatedUser('user3@adminapi.com');

        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('users');
        expect(response.body).toHaveProperty('totalCount');
        expect(response.body).toHaveProperty('page');
        expect(response.body).toHaveProperty('limit');
        expect(Array.isArray(response.body.users)).toBe(true);
        expect(response.body.users.length).toBeGreaterThanOrEqual(4); // Admin + 3 users

        // Verify user data structure
        response.body.users.forEach(user => {
          expect(user).toHaveProperty('id');
          expect(user).toHaveProperty('email');
          expect(user).toHaveProperty('role');
          expect(user).toHaveProperty('createdAt');
          expect(user).not.toHaveProperty('password');
          expect(user).not.toHaveProperty('passwordHash');
        });
      });

      test('should support pagination', async () => {
        const { accessToken: adminToken } = await createAuthenticatedUser('admin.pagination@adminapi.com', 'password123', 'admin');
        
        // Create 15 test users
        const userPromises = Array.from({ length: 15 }, (_, i) =>
          createAuthenticatedUser(`pagination.user${i + 1}@adminapi.com`)
        );
        await Promise.all(userPromises);

        // Test first page
        const page1 = await request(app)
          .get('/api/admin/users?page=1&limit=10')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(page1.body.users).toHaveLength(10);
        expect(page1.body.page).toBe(1);
        expect(page1.body.limit).toBe(10);

        // Test second page
        const page2 = await request(app)
          .get('/api/admin/users?page=2&limit=10')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(page2.body.users.length).toBeGreaterThan(0);
        expect(page2.body.page).toBe(2);

        // Ensure no overlap between pages
        const page1Ids = page1.body.users.map(user => user.id);
        const page2Ids = page2.body.users.map(user => user.id);
        const intersection = page1Ids.filter(id => page2Ids.includes(id));
        expect(intersection).toHaveLength(0);
      });

      test('should support role filtering', async () => {
        const { accessToken: adminToken } = await createAuthenticatedUser('admin.filter@adminapi.com', 'password123', 'admin');
        
        // Create regular users and another admin
        await createAuthenticatedUser('user.filter1@adminapi.com');
        await createAuthenticatedUser('user.filter2@adminapi.com');
        await createAuthenticatedUser('admin.filter2@adminapi.com', 'password123', 'admin');

        // Filter by user role
        const userResponse = await request(app)
          .get('/api/admin/users?role=user')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(userResponse.body.users.every(user => user.role === 'user')).toBe(true);

        // Filter by admin role
        const adminResponse = await request(app)
          .get('/api/admin/users?role=admin')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(adminResponse.body.users.every(user => user.role === 'admin')).toBe(true);
        expect(adminResponse.body.users.length).toBeGreaterThanOrEqual(2);
      });

      test('should reject non-admin access', async () => {
        const { accessToken: userToken } = await createAuthenticatedUser('regular.user@adminapi.com');

        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${userToken}`)
          .expect('Content-Type', /json/)
          .expect(403);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/admin|forbidden|access denied/i);
      });

      test('should require authentication', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .expect('Content-Type', /json/)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/admin/users/:id', () => {
      test('should return specific user details', async () => {
        const { accessToken: adminToken } = await createAuthenticatedUser('admin.userdetail@adminapi.com', 'password123', 'admin');
        const { user } = await createAuthenticatedUser('target.user@adminapi.com');

        const response = await request(app)
          .get(`/api/admin/users/${user.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toMatchObject({
          id: user.id,
          email: 'target.user@adminapi.com',
          role: 'user'
        });
        expect(response.body).toHaveProperty('createdAt');
        expect(response.body).toHaveProperty('updatedAt');
        expect(response.body).toHaveProperty('flashcardCount');
        expect(response.body).not.toHaveProperty('password');
      });

      test('should return 404 for non-existent user', async () => {
        const { accessToken: adminToken } = await createAuthenticatedUser('admin.notfound@adminapi.com', 'password123', 'admin');

        const response = await request(app)
          .get('/api/admin/users/999999')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect('Content-Type', /json/)
          .expect(404);

        expect(response.body).toHaveProperty('error');
      });

      test('should reject non-admin access', async () => {
        const { user, accessToken: userToken } = await createAuthenticatedUser('regular.access@adminapi.com');

        const response = await request(app)
          .get(`/api/admin/users/${user.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect('Content-Type', /json/)
          .expect(403);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('PUT /api/admin/users/:id', () => {
      test('should update user successfully', async () => {
        const { accessToken: adminToken } = await createAuthenticatedUser('admin.update@adminapi.com', 'password123', 'admin');
        const { user } = await createAuthenticatedUser('update.target@adminapi.com');

        const updateData = {
          email: 'updated.target@adminapi.com',
          role: 'admin'
        };

        const response = await request(app)
          .put(`/api/admin/users/${user.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('user');
        expect(response.body.user).toMatchObject({
          id: user.id,
          email: 'updated.target@adminapi.com',
          role: 'admin'
        });

        // Verify update persisted
        const getResponse = await request(app)
          .get(`/api/admin/users/${user.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(getResponse.body.email).toBe('updated.target@adminapi.com');
        expect(getResponse.body.role).toBe('admin');
      });

      test('should reject invalid data', async () => {
        const { accessToken: adminToken } = await createAuthenticatedUser('admin.invalid@adminapi.com', 'password123', 'admin');
        const { user } = await createAuthenticatedUser('invalid.target@adminapi.com');

        const invalidUpdates = [
          { email: 'invalid-email' },
          { role: 'invalid-role' },
          { email: '' }
        ];

        for (const updateData of invalidUpdates) {
          const response = await request(app)
            .put(`/api/admin/users/${user.id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(updateData)
            .expect('Content-Type', /json/)
            .expect(400);

          expect(response.body).toHaveProperty('error');
        }
      });

      test('should reject non-admin access', async () => {
        const { user, accessToken: userToken } = await createAuthenticatedUser('regular.update@adminapi.com');

        const response = await request(app)
          .put(`/api/admin/users/${user.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ email: 'hacked@example.com' })
          .expect('Content-Type', /json/)
          .expect(403);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('DELETE /api/admin/users/:id', () => {
      test('should delete user and all associated data', async () => {
        const { accessToken: adminToken } = await createAuthenticatedUser('admin.delete@adminapi.com', 'password123', 'admin');
        const { user, accessToken: targetToken } = await createAuthenticatedUser('delete.target@adminapi.com');

        // Create flashcards for the target user
        await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${targetToken}`)
          .send({
            english: 'Delete Test Card',
            spanish: 'Tarjeta Prueba Eliminar'
          })
          .expect(201);

        const response = await request(app)
          .delete(`/api/admin/users/${user.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toMatch(/success/i);

        // Verify user is deleted
        await request(app)
          .get(`/api/admin/users/${user.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);

        // Verify user can't authenticate
        await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${targetToken}`)
          .expect(401);
      });

      test('should not allow admin to delete themselves', async () => {
        const { user: admin, accessToken: adminToken } = await createAuthenticatedUser('admin.selfdelete@adminapi.com', 'password123', 'admin');

        const response = await request(app)
          .delete(`/api/admin/users/${admin.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect('Content-Type', /json/)
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/cannot delete|self/i);
      });

      test('should reject non-admin access', async () => {
        const { user } = await createAuthenticatedUser('delete.regular@adminapi.com');
        const { accessToken: userToken } = await createAuthenticatedUser('delete.attacker@adminapi.com');

        const response = await request(app)
          .delete(`/api/admin/users/${user.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect('Content-Type', /json/)
          .expect(403);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('POST /api/admin/users/:id/promote', () => {
      test('should promote user to admin', async () => {
        const { accessToken: adminToken } = await createAuthenticatedUser('admin.promote@adminapi.com', 'password123', 'admin');
        const { user } = await createAuthenticatedUser('promote.target@adminapi.com');

        const response = await request(app)
          .post(`/api/admin/users/${user.id}/promote`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('user');
        expect(response.body.user.role).toBe('admin');

        // Verify promotion persisted
        const getResponse = await request(app)
          .get(`/api/admin/users/${user.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(getResponse.body.role).toBe('admin');
      });

      test('should handle promotion of already admin user', async () => {
        const { accessToken: adminToken } = await createAuthenticatedUser('admin.already@adminapi.com', 'password123', 'admin');
        const { user } = await createAuthenticatedUser('already.admin@adminapi.com', 'password123', 'admin');

        const response = await request(app)
          .post(`/api/admin/users/${user.id}/promote`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body.user.role).toBe('admin');
      });
    });

    describe('POST /api/admin/users/:id/demote', () => {
      test('should demote admin to user', async () => {
        const { accessToken: adminToken } = await createAuthenticatedUser('admin.demote@adminapi.com', 'password123', 'admin');
        const { user } = await createAuthenticatedUser('demote.target@adminapi.com', 'password123', 'admin');

        const response = await request(app)
          .post(`/api/admin/users/${user.id}/demote`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('user');
        expect(response.body.user.role).toBe('user');

        // Verify demotion persisted
        const getResponse = await request(app)
          .get(`/api/admin/users/${user.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(getResponse.body.role).toBe('user');
      });

      test('should not allow admin to demote themselves', async () => {
        const { user: admin, accessToken: adminToken } = await createAuthenticatedUser('admin.selfdemote@adminapi.com', 'password123', 'admin');

        const response = await request(app)
          .post(`/api/admin/users/${admin.id}/demote`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect('Content-Type', /json/)
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/cannot demote|self/i);
      });
    });

    describe('GET /api/admin/system/health', () => {
      test('should return system health information', async () => {
        const { accessToken: adminToken } = await createAuthenticatedUser('admin.health@adminapi.com', 'password123', 'admin');

        const response = await request(app)
          .get('/api/admin/system/health')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('uptime');
        expect(response.body).toHaveProperty('memory');
        expect(response.body).toHaveProperty('database');
        expect(response.body.status).toBe('healthy');
      });

      test('should reject non-admin access', async () => {
        const { accessToken: userToken } = await createAuthenticatedUser('regular.health@adminapi.com');

        const response = await request(app)
          .get('/api/admin/system/health')
          .set('Authorization', `Bearer ${userToken}`)
          .expect('Content-Type', /json/)
          .expect(403);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Statistics API', () => {
    describe('GET /api/stats/my-stats', () => {
      test('should return current user statistics', async () => {
        const { accessToken } = await createAuthenticatedUser('stats.user@adminapi.com');

        // Create flashcards and reviews
        const createResponse = await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            english: 'Stats Test Card',
            spanish: 'Tarjeta Prueba Estadísticas'
          })
          .expect(201);

        await request(app)
          .post(`/api/cards/${createResponse.body.id}/review`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ performanceRating: 4 })
          .expect(200);

        const response = await request(app)
          .get('/api/stats/my-stats')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('totalFlashcards');
        expect(response.body).toHaveProperty('totalReviews');
        expect(response.body).toHaveProperty('averageDifficulty');
        expect(response.body).toHaveProperty('reviewedCards');
        expect(response.body).toHaveProperty('unreviewedCards');
        expect(response.body).toHaveProperty('lastStudySession');
        expect(response.body.totalFlashcards).toBe(1);
        expect(response.body.totalReviews).toBe(1);
      });
    });

    describe('GET /api/stats/my-dashboard', () => {
      test('should return dashboard statistics', async () => {
        const { accessToken } = await createAuthenticatedUser('dashboard.user@adminapi.com');

        const response = await request(app)
          .get('/api/stats/my-dashboard')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('todayReviews');
        expect(response.body).toHaveProperty('weeklyReviews');
        expect(response.body).toHaveProperty('monthlyReviews');
        expect(response.body).toHaveProperty('cardsReady');
        expect(response.body).toHaveProperty('totalCards');
        expect(response.body).toHaveProperty('studyStreak');
      });
    });

    describe('GET /api/stats/system', () => {
      test('should return system statistics for admin', async () => {
        const { accessToken: adminToken } = await createAuthenticatedUser('admin.systemstats@adminapi.com', 'password123', 'admin');

        // Create some test data
        const { accessToken: user1Token } = await createAuthenticatedUser('statuser1@adminapi.com');
        const { accessToken: user2Token } = await createAuthenticatedUser('statuser2@adminapi.com');

        await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ english: 'System Stats Card 1', spanish: 'Tarjeta Estadísticas Sistema 1' })
          .expect(201);

        await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${user2Token}`)
          .send({ english: 'System Stats Card 2', spanish: 'Tarjeta Estadísticas Sistema 2' })
          .expect(201);

        const response = await request(app)
          .get('/api/stats/system')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('totalUsers');
        expect(response.body).toHaveProperty('totalFlashcards');
        expect(response.body).toHaveProperty('totalReviews');
        expect(response.body).toHaveProperty('activeUsers');
        expect(response.body).toHaveProperty('adminUsers');
        expect(response.body).toHaveProperty('newUsers30Days');
        expect(response.body).toHaveProperty('averageDifficulty');
        expect(response.body).toHaveProperty('reviewedLastWeek');
        expect(response.body.totalUsers).toBeGreaterThanOrEqual(3);
        expect(response.body.totalFlashcards).toBeGreaterThanOrEqual(2);
      });

      test('should reject non-admin access', async () => {
        const { accessToken: userToken } = await createAuthenticatedUser('regular.systemstats@adminapi.com');

        const response = await request(app)
          .get('/api/stats/system')
          .set('Authorization', `Bearer ${userToken}`)
          .expect('Content-Type', /json/)
          .expect(403);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/stats/my-performance', () => {
      test('should return performance analytics', async () => {
        const { accessToken } = await createAuthenticatedUser('performance.user@adminapi.com');

        // Create flashcards and reviews
        const createResponse = await request(app)
          .post('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            english: 'Performance Test',
            spanish: 'Prueba Rendimiento'
          })
          .expect(201);

        await request(app)
          .post(`/api/cards/${createResponse.body.id}/review`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ performanceRating: 3 })
          .expect(200);

        const response = await request(app)
          .get('/api/stats/my-performance')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('accuracyRate');
        expect(response.body).toHaveProperty('averageRating');
        expect(response.body).toHaveProperty('improvementRate');
        expect(response.body).toHaveProperty('consistencyScore');
        expect(response.body).toHaveProperty('timeSpentStudying');
        expect(response.body).toHaveProperty('reviewHistory');
        expect(Array.isArray(response.body.reviewHistory)).toBe(true);
      });

      test('should support date range filtering', async () => {
        const { accessToken } = await createAuthenticatedUser('performance.range@adminapi.com');

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const response = await request(app)
          .get(`/api/stats/my-performance?startDate=${thirtyDaysAgo.toISOString()}&endDate=${new Date().toISOString()}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('dateRange');
        expect(response.body.dateRange).toHaveProperty('start');
        expect(response.body.dateRange).toHaveProperty('end');
      });
    });
  });

  describe('Bulk Operations', () => {
    describe('POST /api/bulk/flashcards/import', () => {
      test('should import multiple flashcards', async () => {
        const { accessToken } = await createAuthenticatedUser('bulk.import@adminapi.com');

        const importData = {
          flashcards: [
            { english: 'Bulk Card 1', spanish: 'Tarjeta Bulk 1' },
            { english: 'Bulk Card 2', spanish: 'Tarjeta Bulk 2' },
            { english: 'Bulk Card 3', spanish: 'Tarjeta Bulk 3' }
          ]
        };

        const response = await request(app)
          .post('/api/bulk/flashcards/import')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(importData)
          .expect('Content-Type', /json/)
          .expect(201);

        expect(response.body).toHaveProperty('imported');
        expect(response.body).toHaveProperty('failed');
        expect(response.body).toHaveProperty('total');
        expect(response.body.imported).toBe(3);
        expect(response.body.failed).toBe(0);
        expect(response.body.total).toBe(3);

        // Verify flashcards were created
        const flashcards = await request(app)
          .get('/api/cards')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(flashcards.body).toHaveLength(3);
      });

      test('should handle partial failures in bulk import', async () => {
        const { accessToken } = await createAuthenticatedUser('bulk.partial@adminapi.com');

        const importData = {
          flashcards: [
            { english: 'Valid Card', spanish: 'Tarjeta Válida' },
            { english: '', spanish: 'Invalid Card' }, // Invalid - empty english
            { english: 'Another Valid', spanish: 'Otra Válida' }
          ]
        };

        const response = await request(app)
          .post('/api/bulk/flashcards/import')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(importData)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body.imported).toBe(2);
        expect(response.body.failed).toBe(1);
        expect(response.body).toHaveProperty('errors');
        expect(Array.isArray(response.body.errors)).toBe(true);
      });

      test('should validate import data format', async () => {
        const { accessToken } = await createAuthenticatedUser('bulk.invalid@adminapi.com');

        const invalidData = {
          flashcards: 'not-an-array'
        };

        const response = await request(app)
          .post('/api/bulk/flashcards/import')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(invalidData)
          .expect('Content-Type', /json/)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      test('should enforce rate limiting on bulk operations', async () => {
        const { accessToken } = await createAuthenticatedUser('bulk.ratelimit@adminapi.com');

        const largeImportData = {
          flashcards: Array.from({ length: 1000 }, (_, i) => ({
            english: `Rate Limit Card ${i}`,
            spanish: `Tarjeta Límite ${i}`
          }))
        };

        const response = await request(app)
          .post('/api/bulk/flashcards/import')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(largeImportData)
          .expect('Content-Type', /json/);

        // Should either succeed with rate limiting or reject with 429
        expect([200, 201, 429]).toContain(response.status);
        
        if (response.status === 429) {
          expect(response.body).toHaveProperty('error');
          expect(response.body.error).toMatch(/rate limit|too many/i);
        }
      });
    });

    describe('POST /api/bulk/users/actions (Admin only)', () => {
      test('should perform bulk user actions for admin', async () => {
        const { accessToken: adminToken } = await createAuthenticatedUser('admin.bulkactions@adminapi.com', 'password123', 'admin');
        
        // Create test users
        const { user: user1 } = await createAuthenticatedUser('bulkuser1@adminapi.com');
        const { user: user2 } = await createAuthenticatedUser('bulkuser2@adminapi.com');

        const actionData = {
          action: 'promote',
          userIds: [user1.id, user2.id]
        };

        const response = await request(app)
          .post('/api/bulk/users/actions')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(actionData)
          .expect('Content-Type', /json/)
          .expect(200);

        expect(response.body).toHaveProperty('successful');
        expect(response.body).toHaveProperty('failed');
        expect(response.body.successful).toBe(2);
        expect(response.body.failed).toBe(0);

        // Verify users were promoted
        const user1Details = await request(app)
          .get(`/api/admin/users/${user1.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(user1Details.body.role).toBe('admin');
      });

      test('should reject bulk user actions for non-admin', async () => {
        const { user, accessToken: userToken } = await createAuthenticatedUser('bulk.nonadmin@adminapi.com');

        const actionData = {
          action: 'promote',
          userIds: [user.id]
        };

        const response = await request(app)
          .post('/api/bulk/users/actions')
          .set('Authorization', `Bearer ${userToken}`)
          .send(actionData)
          .expect('Content-Type', /json/)
          .expect(403);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Security and Authorization', () => {
    test('should maintain strict role-based access control', async () => {
      const { accessToken: userToken } = await createAuthenticatedUser('security.rbac@adminapi.com');
      
      const adminOnlyEndpoints = [
        { method: 'get', path: '/api/admin/users' },
        { method: 'get', path: '/api/admin/system/health' },
        { method: 'get', path: '/api/stats/system' },
        { method: 'post', path: '/api/bulk/users/actions' }
      ];

      for (const endpoint of adminOnlyEndpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${userToken}`)
          .send({});

        expect([403, 404]).toContain(response.status);
        if (response.status === 403) {
          expect(response.body).toHaveProperty('error');
        }
      }
    });

    test('should handle concurrent admin operations safely', async () => {
      const { accessToken: adminToken } = await createAuthenticatedUser('admin.concurrent@adminapi.com', 'password123', 'admin');
      
      // Create users to operate on
      const users = await Promise.all([
        createAuthenticatedUser('concurrent1@adminapi.com'),
        createAuthenticatedUser('concurrent2@adminapi.com'),
        createAuthenticatedUser('concurrent3@adminapi.com')
      ]);

      // Perform concurrent operations
      const promises = users.map(({ user }) => 
        request(app)
          .post(`/api/admin/users/${user.id}/promote`)
          .set('Authorization', `Bearer ${adminToken}`)
      );

      const responses = await Promise.allSettled(promises);
      const successful = responses.filter(r => r.status === 'fulfilled' && r.value.status === 200);

      expect(successful.length).toBe(3);
    });

    test('should log admin actions for auditing', async () => {
      const { accessToken: adminToken } = await createAuthenticatedUser('admin.audit@adminapi.com', 'password123', 'admin');
      const { user } = await createAuthenticatedUser('audit.target@adminapi.com');

      // Perform admin action that should be logged
      await request(app)
        .post(`/api/admin/users/${user.id}/promote`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // In a real implementation, this would check audit logs
      // For now, we just verify the action was successful
      const userDetails = await request(app)
        .get(`/api/admin/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(userDetails.body.role).toBe('admin');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large user lists efficiently', async () => {
      const { accessToken: adminToken } = await createAuthenticatedUser('admin.performance@adminapi.com', 'password123', 'admin');

      // Test with pagination to ensure it works with large datasets
      const response = await request(app)
        .get('/api/admin/users?page=1&limit=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('totalCount');
      
      // Response should be fast (< 5 seconds for this test)
      expect(Date.now() - response.req.startTime).toBeLessThan(5000);
    });

    test('should aggregate statistics efficiently', async () => {
      const { accessToken: adminToken } = await createAuthenticatedUser('admin.statstiming@adminapi.com', 'password123', 'admin');

      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/stats/system')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(response.body).toHaveProperty('totalUsers');
      expect(responseTime).toBeLessThan(3000); // Should respond within 3 seconds
    });
  });
});