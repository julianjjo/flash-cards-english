import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

let app;
let authToken;
let testUserId;

describe('GET /api/auth/profile Contract Tests', () => {
  beforeAll(async () => {
    try {
      const appModule = await import('../../index.js');
      app = appModule.default || appModule.app;
      
      // Register and login a test user to get auth token
      const userData = {
        email: 'profile-test@example.com',
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

  test('should get user profile with valid token', async () => {
    expect(app).toBeDefined(); // This MUST fail initially
    expect(authToken).toBeDefined();

    const response = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect('Content-Type', /json/)
      .expect(200);

    // Verify response structure matches OpenAPI spec
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('user');

    // Verify user object structure
    expect(response.body.user).toHaveProperty('id', testUserId);
    expect(response.body.user).toHaveProperty('email', 'profile-test@example.com');
    expect(response.body.user).toHaveProperty('role', 'user');
    expect(response.body.user).toHaveProperty('created_at');
    expect(response.body.user).toHaveProperty('updated_at');
    expect(response.body.user).not.toHaveProperty('password'); // Password should never be returned
  });

  test('should reject profile request without token', async () => {
    expect(app).toBeDefined();

    const response = await request(app)
      .get('/api/auth/profile')
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Authentication required');
    expect(response.body).toHaveProperty('error', 'No token provided');
  });

  test('should reject profile request with invalid token', async () => {
    expect(app).toBeDefined();

    const response = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', 'Bearer invalid-token')
      .expect('Content-Type', /json/)
      .expect(403);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Invalid or expired token');
  });

  test('should reject profile request with malformed authorization header', async () => {
    expect(app).toBeDefined();

    const response = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', 'InvalidFormat token')
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Authentication required');
  });

  test('should reject profile request with empty authorization header', async () => {
    expect(app).toBeDefined();

    const response = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', '')
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Authentication required');
  });
});