import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

let app;
let adminToken;
let userToken;
let adminUserId;
let regularUserId;

describe('GET /api/admin/users Contract Tests', () => {
  beforeAll(async () => {
    try {
      const appModule = await import('../../index.js');
      app = appModule.default || appModule.app;
      
      // Register admin user
      const adminData = {
        email: 'admin-test@example.com',
        password: 'AdminPassword123'
      };

      const adminResponse = await request(app)
        .post('/api/auth/register')
        .send(adminData);

      adminToken = adminResponse.body.token;
      adminUserId = adminResponse.body.user.id;

      // Promote to admin (this will be implemented later)
      // For now, we'll assume the test will manually handle this

      // Register regular user
      const userData = {
        email: 'regular-user@example.com',
        password: 'UserPassword123'
      };

      const userResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      userToken = userResponse.body.token;
      regularUserId = userResponse.body.user.id;
    } catch (error) {
      console.log('Expected: App not yet implemented');
    }
  });

  afterAll(async () => {
    // Clean up test database
  });

  test('should get all users for admin user', async () => {
    expect(app).toBeDefined(); // This MUST fail initially
    expect(adminToken).toBeDefined();

    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect('Content-Type', /json/)
      .expect(200);

    // Verify response structure matches OpenAPI spec
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('users');
    expect(response.body).toHaveProperty('pagination');

    // Verify users array structure
    expect(Array.isArray(response.body.users)).toBe(true);
    expect(response.body.users.length).toBeGreaterThan(0);

    // Verify user object structure
    const user = response.body.users[0];
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('role');
    expect(user).toHaveProperty('created_at');
    expect(user).toHaveProperty('updated_at');
    expect(user).not.toHaveProperty('password'); // Password should never be returned

    // Verify pagination structure
    expect(response.body.pagination).toHaveProperty('page');
    expect(response.body.pagination).toHaveProperty('limit');
    expect(response.body.pagination).toHaveProperty('total');
    expect(response.body.pagination).toHaveProperty('totalPages');
  });

  test('should support pagination parameters', async () => {
    expect(app).toBeDefined();
    expect(adminToken).toBeDefined();

    const response = await request(app)
      .get('/api/admin/users')
      .query({ page: 1, limit: 10 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.pagination).toHaveProperty('page', 1);
    expect(response.body.pagination).toHaveProperty('limit', 10);
  });

  test('should support search parameter', async () => {
    expect(app).toBeDefined();
    expect(adminToken).toBeDefined();

    const response = await request(app)
      .get('/api/admin/users')
      .query({ search: 'admin-test' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('users');

    // Should filter results based on search
    if (response.body.users.length > 0) {
      const foundUser = response.body.users.find(user => 
        user.email.includes('admin-test')
      );
      expect(foundUser).toBeDefined();
    }
  });

  test('should reject users list request for non-admin user', async () => {
    expect(app).toBeDefined();
    expect(userToken).toBeDefined();

    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect('Content-Type', /json/)
      .expect(403);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Access forbidden');
    expect(response.body).toHaveProperty('error', 'Admin role required');
  });

  test('should reject users list request without authentication', async () => {
    expect(app).toBeDefined();

    const response = await request(app)
      .get('/api/admin/users')
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Authentication required');
  });

  test('should reject users list request with invalid token', async () => {
    expect(app).toBeDefined();

    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', 'Bearer invalid-token')
      .expect('Content-Type', /json/)
      .expect(403);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Invalid or expired token');
  });

  test('should handle large page numbers gracefully', async () => {
    expect(app).toBeDefined();
    expect(adminToken).toBeDefined();

    const response = await request(app)
      .get('/api/admin/users')
      .query({ page: 999, limit: 10 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.users).toHaveLength(0); // Should return empty array for out-of-range pages
  });
});