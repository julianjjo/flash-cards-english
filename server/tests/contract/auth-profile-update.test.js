import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

let app;
let authToken;
let testUserId;

describe('PUT /api/auth/profile Contract Tests', () => {
  beforeAll(async () => {
    try {
      const appModule = await import('../../index.js');
      app = appModule.default || appModule.app;
      
      // Register and login a test user to get auth token
      const userData = {
        email: 'profile-update-test@example.com',
        password: 'TestPassword123'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      authToken = registerResponse.body.token;
      testUserId = registerResponse.body.user.id;
    } catch (error) {
      console.log('Expected: App not yet implemented');
    }
  });

  afterAll(async () => {
    // Clean up test database
  });

  test('should update user email with valid data', async () => {
    expect(app).toBeDefined(); // This MUST fail initially
    expect(authToken).toBeDefined();

    const updateData = {
      email: 'updated-email@example.com'
    };

    const response = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect('Content-Type', /json/)
      .expect(200);

    // Verify response structure matches OpenAPI spec
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', 'Profile updated successfully');
    expect(response.body).toHaveProperty('user');

    // Verify updated user data
    expect(response.body.user).toHaveProperty('id', testUserId);
    expect(response.body.user).toHaveProperty('email', 'updated-email@example.com');
    expect(response.body.user).toHaveProperty('updated_at');
    expect(response.body.user).not.toHaveProperty('password');
  });

  test('should update user password with valid current password', async () => {
    expect(app).toBeDefined();
    expect(authToken).toBeDefined();

    const updateData = {
      currentPassword: 'TestPassword123',
      newPassword: 'NewTestPassword456'
    };

    const response = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', 'Profile updated successfully');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user).not.toHaveProperty('password');

    // Verify new password works by attempting login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'updated-email@example.com',
        password: 'NewTestPassword456'
      })
      .expect(200);

    expect(loginResponse.body).toHaveProperty('success', true);
  });

  test('should reject password update with wrong current password', async () => {
    expect(app).toBeDefined();
    expect(authToken).toBeDefined();

    const updateData = {
      currentPassword: 'WrongPassword123',
      newPassword: 'NewTestPassword789'
    };

    const response = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body.message).toContain('current password');
  });

  test('should reject profile update without authentication', async () => {
    expect(app).toBeDefined();

    const updateData = {
      email: 'unauthorized@example.com'
    };

    const response = await request(app)
      .put('/api/auth/profile')
      .send(updateData)
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Authentication required');
  });

  test('should reject profile update with invalid email format', async () => {
    expect(app).toBeDefined();
    expect(authToken).toBeDefined();

    const updateData = {
      email: 'invalid-email-format'
    };

    const response = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveProperty('email');
  });

  test('should reject password update with short new password', async () => {
    expect(app).toBeDefined();
    expect(authToken).toBeDefined();

    const updateData = {
      currentPassword: 'NewTestPassword456',
      newPassword: '123' // Too short
    };

    const response = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveProperty('newPassword');
  });

  test('should reject new password without current password', async () => {
    expect(app).toBeDefined();
    expect(authToken).toBeDefined();

    const updateData = {
      newPassword: 'SomeNewPassword123'
      // currentPassword missing
    };

    const response = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveProperty('currentPassword');
  });

  test('should reject email update to existing email', async () => {
    expect(app).toBeDefined();
    expect(authToken).toBeDefined();

    // First create another user
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'existing-user@example.com',
        password: 'TestPassword123'
      });

    // Try to update current user's email to existing email
    const updateData = {
      email: 'existing-user@example.com'
    };

    const response = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData)
      .expect('Content-Type', /json/)
      .expect(409);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body.message).toContain('already exists');
  });
});