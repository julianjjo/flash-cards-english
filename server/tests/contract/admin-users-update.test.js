import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

let app;
let adminToken;
let userToken;
let adminUserId;
let targetUserId;

describe('PUT /api/admin/users/{id} Contract Tests', () => {
  beforeAll(async () => {
    try {
      const appModule = await import('../../index.js');
      app = appModule.default || appModule.app;
      
      // Register admin user
      const adminData = {
        email: 'admin-update-test@example.com',
        password: 'AdminPassword123'
      };

      const adminResponse = await request(app)
        .post('/api/auth/register')
        .send(adminData);

      adminToken = adminResponse.body.token;
      adminUserId = adminResponse.body.user.id;

      // Register target user to update
      const targetUserData = {
        email: 'target-user@example.com',
        password: 'UserPassword123'
      };

      const targetUserResponse = await request(app)
        .post('/api/auth/register')
        .send(targetUserData);

      targetUserId = targetUserResponse.body.user.id;

      // Register regular user (for testing authorization)
      const userData = {
        email: 'regular-user-update@example.com',
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

  test('should promote user to admin role', async () => {
    expect(app).toBeDefined(); // This MUST fail initially
    expect(adminToken).toBeDefined();
    expect(targetUserId).toBeDefined();

    const updateData = {
      role: 'admin'
    };

    const response = await request(app)
      .put(`/api/admin/users/${targetUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updateData)
      .expect('Content-Type', /json/)
      .expect(200);

    // Verify response structure matches OpenAPI spec
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', 'User role updated successfully');
    expect(response.body).toHaveProperty('user');

    // Verify updated user data
    expect(response.body.user).toHaveProperty('id', targetUserId);
    expect(response.body.user).toHaveProperty('role', 'admin');
    expect(response.body.user).toHaveProperty('updated_at');
    expect(response.body.user).not.toHaveProperty('password');
  });

  test('should demote admin user to regular user', async () => {
    expect(app).toBeDefined();
    expect(adminToken).toBeDefined();
    expect(targetUserId).toBeDefined();

    const updateData = {
      role: 'user'
    };

    const response = await request(app)
      .put(`/api/admin/users/${targetUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updateData)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', 'User role updated successfully');
    expect(response.body.user).toHaveProperty('role', 'user');
  });

  test('should reject role update with invalid role', async () => {
    expect(app).toBeDefined();
    expect(adminToken).toBeDefined();
    expect(targetUserId).toBeDefined();

    const updateData = {
      role: 'invalid-role'
    };

    const response = await request(app)
      .put(`/api/admin/users/${targetUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updateData)
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveProperty('role');
  });

  test('should reject role update for non-existent user', async () => {
    expect(app).toBeDefined();
    expect(adminToken).toBeDefined();

    const nonExistentUserId = 99999;
    const updateData = {
      role: 'admin'
    };

    const response = await request(app)
      .put(`/api/admin/users/${nonExistentUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updateData)
      .expect('Content-Type', /json/)
      .expect(404);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'User not found');
  });

  test('should reject role update request for non-admin user', async () => {
    expect(app).toBeDefined();
    expect(userToken).toBeDefined();
    expect(targetUserId).toBeDefined();

    const updateData = {
      role: 'admin'
    };

    const response = await request(app)
      .put(`/api/admin/users/${targetUserId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send(updateData)
      .expect('Content-Type', /json/)
      .expect(403);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Access forbidden');
    expect(response.body).toHaveProperty('error', 'Admin role required');
  });

  test('should reject role update request without authentication', async () => {
    expect(app).toBeDefined();
    expect(targetUserId).toBeDefined();

    const updateData = {
      role: 'admin'
    };

    const response = await request(app)
      .put(`/api/admin/users/${targetUserId}`)
      .send(updateData)
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Authentication required');
  });

  test('should reject role update with missing role field', async () => {
    expect(app).toBeDefined();
    expect(adminToken).toBeDefined();
    expect(targetUserId).toBeDefined();

    const updateData = {};

    const response = await request(app)
      .put(`/api/admin/users/${targetUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updateData)
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveProperty('role');
  });

  test('should reject role update with invalid user ID format', async () => {
    expect(app).toBeDefined();
    expect(adminToken).toBeDefined();

    const invalidUserId = 'not-a-number';
    const updateData = {
      role: 'admin'
    };

    const response = await request(app)
      .put(`/api/admin/users/${invalidUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updateData)
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body.message).toContain('Invalid user ID');
  });

  test('should handle admin trying to update their own role', async () => {
    expect(app).toBeDefined();
    expect(adminToken).toBeDefined();
    expect(adminUserId).toBeDefined();

    const updateData = {
      role: 'user'
    };

    // This behavior could be allowed or prevented - the test documents expected behavior
    const response = await request(app)
      .put(`/api/admin/users/${adminUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updateData);

    // Expected behavior: Either allow with warning or prevent entirely
    if (response.status === 200) {
      expect(response.body).toHaveProperty('success', true);
    } else if (response.status === 400) {
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('self');
    }
  });
});