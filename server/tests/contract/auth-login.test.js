import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

let app;

describe('POST /api/auth/login Contract Tests', () => {
  beforeAll(async () => {
    try {
      const appModule = await import('../../index.js');
      app = appModule.default || appModule.app;
    } catch (error) {
      console.log('Expected: App not yet implemented');
    }
  });

  afterAll(async () => {
    // Clean up test database
  });

  test('should authenticate user with valid credentials', async () => {
    expect(app).toBeDefined(); // This MUST fail initially

    // First register a user to test login
    const userData = {
      email: 'login-test@example.com',
      password: 'TestPassword123'
    };

    await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    // Now test login
    const loginCredentials = {
      email: 'login-test@example.com',
      password: 'TestPassword123'
    };

    const response = await request(app)
      .post('/api/auth/login')
      .send(loginCredentials)
      .expect('Content-Type', /json/)
      .expect(200);

    // Verify response structure matches OpenAPI spec
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', 'Login successful');
    expect(response.body).toHaveProperty('user');
    expect(response.body).toHaveProperty('token');

    // Verify user object structure
    expect(response.body.user).toHaveProperty('id');
    expect(response.body.user).toHaveProperty('email', 'login-test@example.com');
    expect(response.body.user).toHaveProperty('role', 'user');
    expect(response.body.user).not.toHaveProperty('password');

    // Verify token
    expect(typeof response.body.token).toBe('string');
    expect(response.body.token.length).toBeGreaterThan(0);
  });

  test('should reject login with invalid email', async () => {
    expect(app).toBeDefined();

    const invalidCredentials = {
      email: 'nonexistent@example.com',
      password: 'TestPassword123'
    };

    const response = await request(app)
      .post('/api/auth/login')
      .send(invalidCredentials)
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body.message).toContain('Invalid credentials');
  });

  test('should reject login with invalid password', async () => {
    expect(app).toBeDefined();

    const invalidCredentials = {
      email: 'login-test@example.com',
      password: 'WrongPassword123'
    };

    const response = await request(app)
      .post('/api/auth/login')
      .send(invalidCredentials)
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body.message).toContain('Invalid credentials');
  });

  test('should reject login with missing email', async () => {
    expect(app).toBeDefined();

    const incompleteCredentials = {
      password: 'TestPassword123'
    };

    const response = await request(app)
      .post('/api/auth/login')
      .send(incompleteCredentials)
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveProperty('email');
  });

  test('should reject login with missing password', async () => {
    expect(app).toBeDefined();

    const incompleteCredentials = {
      email: 'test@example.com'
    };

    const response = await request(app)
      .post('/api/auth/login')
      .send(incompleteCredentials)
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveProperty('password');
  });

  test('should reject login with invalid email format', async () => {
    expect(app).toBeDefined();

    const invalidFormatCredentials = {
      email: 'invalid-email-format',
      password: 'TestPassword123'
    };

    const response = await request(app)
      .post('/api/auth/login')
      .send(invalidFormatCredentials)
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveProperty('email');
  });

  test('should handle empty request body', async () => {
    expect(app).toBeDefined();

    const response = await request(app)
      .post('/api/auth/login')
      .send({})
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('errors');
  });
});