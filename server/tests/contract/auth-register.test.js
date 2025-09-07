import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

// Import the app - will be created later
let app;

describe('POST /api/auth/register Contract Tests', () => {
  beforeAll(async () => {
    // This test MUST fail until the endpoint is implemented
    // Import will fail until server/index.js exports the app
    try {
      const appModule = await import('../../index.js');
      app = appModule.default || appModule.app;
    } catch (error) {
      console.log('Expected: App not yet implemented');
    }
  });

  afterAll(async () => {
    // Clean up test database if needed
  });

  test('should register a new user with valid data', async () => {
    expect(app).toBeDefined(); // This MUST fail initially

    const validUserData = {
      email: 'test@example.com',
      password: 'TestPassword123'
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(validUserData)
      .expect('Content-Type', /json/)
      .expect(201);

    // Verify response structure matches OpenAPI spec
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', 'User registered successfully');
    expect(response.body).toHaveProperty('user');
    expect(response.body).toHaveProperty('token');

    // Verify user object structure
    expect(response.body.user).toHaveProperty('id');
    expect(response.body.user).toHaveProperty('email', 'test@example.com');
    expect(response.body.user).toHaveProperty('role', 'user');
    expect(response.body.user).toHaveProperty('created_at');
    expect(response.body.user).not.toHaveProperty('password'); // Password should not be returned

    // Verify token is a string
    expect(typeof response.body.token).toBe('string');
    expect(response.body.token.length).toBeGreaterThan(0);
  });

  test('should reject registration with invalid email format', async () => {
    expect(app).toBeDefined();

    const invalidEmailData = {
      email: 'invalid-email',
      password: 'TestPassword123'
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(invalidEmailData)
      .expect('Content-Type', /json/)
      .expect(400);

    // Verify error response structure
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Validation failed');
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveProperty('email');
  });

  test('should reject registration with short password', async () => {
    expect(app).toBeDefined();

    const shortPasswordData = {
      email: 'test2@example.com',
      password: '123'
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(shortPasswordData)
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Validation failed');
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveProperty('password');
  });

  test('should reject registration with missing required fields', async () => {
    expect(app).toBeDefined();

    const incompleteData = {
      email: 'test3@example.com'
      // password missing
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(incompleteData)
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveProperty('password');
  });

  test('should reject registration with duplicate email', async () => {
    expect(app).toBeDefined();

    const userData = {
      email: 'duplicate@example.com',
      password: 'TestPassword123'
    };

    // First registration should succeed
    await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    // Second registration with same email should fail
    const response = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect('Content-Type', /json/)
      .expect(409);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body.message).toContain('already exists');
  });

  test('should handle empty request body', async () => {
    expect(app).toBeDefined();

    const response = await request(app)
      .post('/api/auth/register')
      .send({})
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('errors');
  });
});