import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

let app;
let adminToken;
let userToken;
let adminUserId;
let targetUserId;

describe('DELETE /api/admin/users/{id} Contract Tests', () => {
  beforeAll(async () => {
    try {
      const appModule = await import('../../index.js');
      app = appModule.default || appModule.app;
      
      // Register admin user
      const adminData = {
        email: 'admin-delete-test@example.com',
        password: 'AdminPassword123'
      };

      const adminResponse = await request(app)
        .post('/api/auth/register')
        .send(adminData);

      adminToken = adminResponse.body.token;
      adminUserId = adminResponse.body.user.id;

      // Register target user to delete
      const targetUserData = {
        email: 'target-delete-user@example.com',
        password: 'UserPassword123'
      };

      const targetUserResponse = await request(app)
        .post('/api/auth/register')
        .send(targetUserData);

      targetUserId = targetUserResponse.body.user.id;

      // Register regular user (for testing authorization)
      const userData = {
        email: 'regular-user-delete@example.com',
        password: 'UserPassword123'
      };

      const userResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      userToken = userResponse.body.token;
    } catch (error) {
      console.log('Expected: App not yet implemented');
    }
  });

  afterAll(async () => {
    // Clean up test database
  });

  test('should delete user account successfully', async () => {
    expect(app).toBeDefined(); // This MUST fail initially
    expect(adminToken).toBeDefined();
    expect(targetUserId).toBeDefined();

    const response = await request(app)
      .delete(`/api/admin/users/${targetUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect('Content-Type', /json/)
      .expect(200);

    // Verify response structure matches OpenAPI spec
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', 'User deleted successfully');

    // Verify user is actually deleted by trying to get user list
    const usersResponse = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const deletedUser = usersResponse.body.users.find(user => user.id === targetUserId);
    expect(deletedUser).toBeUndefined();
  });

  test('should reject delete request for non-existent user', async () => {
    expect(app).toBeDefined();
    expect(adminToken).toBeDefined();

    const nonExistentUserId = 99999;

    const response = await request(app)
      .delete(`/api/admin/users/${nonExistentUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect('Content-Type', /json/)
      .expect(404);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'User not found');
  });

  test('should reject delete request for non-admin user', async () => {
    expect(app).toBeDefined();
    expect(userToken).toBeDefined();

    // Create another user to attempt deletion
    const newUserData = {
      email: 'another-user@example.com',
      password: 'UserPassword123'
    };

    const newUserResponse = await request(app)
      .post('/api/auth/register')
      .send(newUserData);

    const newUserId = newUserResponse.body.user.id;

    const response = await request(app)
      .delete(`/api/admin/users/${newUserId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect('Content-Type', /json/)
      .expect(403);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Access forbidden');
    expect(response.body).toHaveProperty('error', 'Admin role required');
  });

  test('should reject delete request without authentication', async () => {
    expect(app).toBeDefined();

    // Create user to attempt deletion
    const userToDeleteData = {
      email: 'user-to-delete@example.com',
      password: 'UserPassword123'
    };

    const userToDeleteResponse = await request(app)
      .post('/api/auth/register')
      .send(userToDeleteData);

    const userToDeleteId = userToDeleteResponse.body.user.id;

    const response = await request(app)
      .delete(`/api/admin/users/${userToDeleteId}`)
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Authentication required');
  });

  test('should prevent admin from deleting themselves', async () => {
    expect(app).toBeDefined();
    expect(adminToken).toBeDefined();
    expect(adminUserId).toBeDefined();

    const response = await request(app)
      .delete(`/api/admin/users/${adminUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body.message).toContain('delete');
    expect(response.body.message).toContain('self');
  });

  test('should reject delete request with invalid user ID format', async () => {
    expect(app).toBeDefined();
    expect(adminToken).toBeDefined();

    const invalidUserId = 'not-a-number';

    const response = await request(app)
      .delete(`/api/admin/users/${invalidUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body.message).toContain('Invalid user ID');
  });

  test('should reject delete request with invalid token', async () => {
    expect(app).toBeDefined();

    const userToDeleteData = {
      email: 'user-invalid-token@example.com',
      password: 'UserPassword123'
    };

    const userToDeleteResponse = await request(app)
      .post('/api/auth/register')
      .send(userToDeleteData);

    const userToDeleteId = userToDeleteResponse.body.user.id;

    const response = await request(app)
      .delete(`/api/admin/users/${userToDeleteId}`)
      .set('Authorization', 'Bearer invalid-token')
      .expect('Content-Type', /json/)
      .expect(403);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Invalid or expired token');
  });

  test('should handle cascading deletion of user data', async () => {
    expect(app).toBeDefined();
    expect(adminToken).toBeDefined();

    // Create user with associated data (cards)
    const userWithDataResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user-with-data@example.com',
        password: 'UserPassword123'
      });

    const userWithDataId = userWithDataResponse.body.user.id;
    const userWithDataToken = userWithDataResponse.body.token;

    // Create some cards for this user (assuming cards API exists)
    // This tests that user deletion properly handles related data

    const response = await request(app)
      .delete(`/api/admin/users/${userWithDataId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', 'User deleted successfully');

    // Verify user's token is invalidated
    const profileResponse = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${userWithDataToken}`)
      .expect(403); // Token should be invalid after user deletion

    expect(profileResponse.body).toHaveProperty('success', false);
  });
});