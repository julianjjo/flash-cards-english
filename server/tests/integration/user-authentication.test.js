import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

let app;

describe('User Authentication Flow Integration Tests', () => {
  beforeAll(async () => {
    // This test MUST fail until the complete authentication flow is implemented
    try {
      const appModule = await import('../../index.js');
      app = appModule.default || appModule.app;
    } catch (error) {
      console.log('Expected: App not yet implemented');
    }
  });

  beforeEach(async () => {
    // Clean up database before each test
  });

  afterAll(async () => {
    // Clean up test database
  });

  test('should complete full authentication flow successfully', async () => {
    expect(app).toBeDefined(); // This MUST fail initially

    const userData = {
      email: 'auth-flow-test@example.com',
      password: 'AuthTestPassword123'
    };

    // Step 1: Register user for authentication tests
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    const userId = registerResponse.body.user.id;
    
    // Step 2: Login with correct credentials
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send(userData)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(loginResponse.body).toHaveProperty('success', true);
    expect(loginResponse.body).toHaveProperty('user');
    expect(loginResponse.body).toHaveProperty('token');
    expect(loginResponse.body.user).toHaveProperty('id', userId);
    expect(loginResponse.body.user).toHaveProperty('email', userData.email);
    expect(loginResponse.body.user).not.toHaveProperty('password');

    const authToken = loginResponse.body.token;

    // Step 3: Use token to access protected resource
    const profileResponse = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(profileResponse.body).toHaveProperty('success', true);
    expect(profileResponse.body.user).toHaveProperty('id', userId);
    expect(profileResponse.body.user).toHaveProperty('email', userData.email);

    // Step 4: Verify token works for multiple requests
    const secondProfileResponse = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(secondProfileResponse.body.user).toHaveProperty('id', userId);

    // Step 5: Test token with profile update
    const profileUpdate = {
      email: 'updated-auth-test@example.com'
    };

    const updateResponse = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(profileUpdate)
      .expect(200);

    expect(updateResponse.body).toHaveProperty('success', true);
    expect(updateResponse.body.user).toHaveProperty('email', profileUpdate.email);

    // Step 6: Verify updated profile is accessible
    const updatedProfileResponse = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(updatedProfileResponse.body.user).toHaveProperty('email', profileUpdate.email);
  });

  test('should handle invalid login credentials appropriately', async () => {
    expect(app).toBeDefined();

    const userData = {
      email: 'invalid-creds-test@example.com',
      password: 'CorrectPassword123'
    };

    // Register user first
    await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    // Test invalid email
    const invalidEmailResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: userData.password
      })
      .expect(401);

    expect(invalidEmailResponse.body).toHaveProperty('success', false);
    expect(invalidEmailResponse.body.message).toContain('Invalid credentials');

    // Test invalid password
    const invalidPasswordResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: userData.email,
        password: 'WrongPassword123'
      })
      .expect(401);

    expect(invalidPasswordResponse.body).toHaveProperty('success', false);
    expect(invalidPasswordResponse.body.message).toContain('Invalid credentials');

    // Test both invalid
    const bothInvalidResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'wrong@example.com',
        password: 'WrongPassword123'
      })
      .expect(401);

    expect(bothInvalidResponse.body).toHaveProperty('success', false);
  });

  test('should handle token expiration and invalid tokens', async () => {
    expect(app).toBeDefined();

    // Test with completely invalid token
    const invalidTokenResponse = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', 'Bearer invalid-token')
      .expect(403);

    expect(invalidTokenResponse.body).toHaveProperty('success', false);
    expect(invalidTokenResponse.body.message).toContain('Invalid or expired token');

    // Test with malformed token
    const malformedTokenResponse = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', 'Bearer not.a.jwt.token')
      .expect(403);

    expect(malformedTokenResponse.body).toHaveProperty('success', false);

    // Test with empty token
    const emptyTokenResponse = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', 'Bearer ')
      .expect(401);

    expect(emptyTokenResponse.body).toHaveProperty('success', false);
    expect(emptyTokenResponse.body.message).toContain('Authentication required');

    // Test with no Authorization header
    const noAuthResponse = await request(app)
      .get('/api/auth/profile')
      .expect(401);

    expect(noAuthResponse.body).toHaveProperty('success', false);
    expect(noAuthResponse.body.message).toContain('Authentication required');
  });

  test('should handle password change authentication flow', async () => {
    expect(app).toBeDefined();

    const userData = {
      email: 'password-change-test@example.com',
      password: 'OriginalPassword123'
    };

    // Step 1: Register user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    const originalToken = registerResponse.body.token;
    const userId = registerResponse.body.user.id;

    // Step 2: Change password with correct current password
    const newPassword = 'NewPassword456';
    const passwordChangeResponse = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${originalToken}`)
      .send({
        currentPassword: userData.password,
        newPassword: newPassword
      })
      .expect(200);

    expect(passwordChangeResponse.body).toHaveProperty('success', true);

    // Step 3: Verify old password no longer works
    const oldPasswordLoginResponse = await request(app)
      .post('/api/auth/login')
      .send(userData)
      .expect(401);

    expect(oldPasswordLoginResponse.body).toHaveProperty('success', false);

    // Step 4: Verify new password works
    const newPasswordLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: userData.email,
        password: newPassword
      })
      .expect(200);

    expect(newPasswordLoginResponse.body).toHaveProperty('success', true);
    expect(newPasswordLoginResponse.body.user).toHaveProperty('id', userId);

    // Step 5: Verify new token works
    const newToken = newPasswordLoginResponse.body.token;
    const profileResponse = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${newToken}`)
      .expect(200);

    expect(profileResponse.body.user).toHaveProperty('id', userId);

    // Step 6: Verify original token still works (tokens don't invalidate on password change)
    const originalTokenResponse = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${originalToken}`)
      .expect(200);

    expect(originalTokenResponse.body.user).toHaveProperty('id', userId);
  });

  test('should prevent password change with wrong current password', async () => {
    expect(app).toBeDefined();

    const userData = {
      email: 'wrong-current-password-test@example.com',
      password: 'CorrectPassword123'
    };

    // Register user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    const authToken = registerResponse.body.token;

    // Attempt password change with wrong current password
    const passwordChangeResponse = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        currentPassword: 'WrongCurrentPassword123',
        newPassword: 'NewPassword456'
      })
      .expect(401);

    expect(passwordChangeResponse.body).toHaveProperty('success', false);
    expect(passwordChangeResponse.body.message).toContain('current password');

    // Verify original password still works
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send(userData)
      .expect(200);

    expect(loginResponse.body).toHaveProperty('success', true);
  });

  test('should handle concurrent login attempts', async () => {
    expect(app).toBeDefined();

    const userData = {
      email: 'concurrent-login-test@example.com',
      password: 'TestPassword123'
    };

    // Register user
    await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    // Simulate concurrent login attempts
    const loginPromises = Array.from({ length: 5 }, () =>
      request(app)
        .post('/api/auth/login')
        .send(userData)
    );

    const responses = await Promise.all(loginPromises);

    // All should succeed
    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
    });

    // Verify all tokens work
    for (const response of responses) {
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${response.body.token}`)
        .expect(200);

      expect(profileResponse.body).toHaveProperty('success', true);
    }
  });

  test('should maintain session consistency across profile updates', async () => {
    expect(app).toBeDefined();

    const userData = {
      email: 'session-consistency-test@example.com',
      password: 'TestPassword123'
    };

    // Register and login
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send(userData)
      .expect(200);

    const authToken = loginResponse.body.token;
    const userId = loginResponse.body.user.id;

    // Perform multiple profile updates
    const updates = [
      { email: 'updated1@example.com' },
      { email: 'updated2@example.com' },
      { email: 'final@example.com' }
    ];

    for (const update of updates) {
      const updateResponse = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(update)
        .expect(200);

      expect(updateResponse.body.user).toHaveProperty('id', userId);
      expect(updateResponse.body.user).toHaveProperty('email', update.email);

      // Verify profile endpoint reflects the change
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(profileResponse.body.user).toHaveProperty('email', update.email);
    }

    // Verify final login works with the last email
    const finalLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'final@example.com',
        password: userData.password
      })
      .expect(200);

    expect(finalLoginResponse.body.user).toHaveProperty('id', userId);
  });

  test('should validate authentication input properly', async () => {
    expect(app).toBeDefined();

    // Test login validation
    const loginValidationTests = [
      {
        data: { email: '', password: 'TestPassword123' },
        expectedField: 'email'
      },
      {
        data: { email: 'invalid-email', password: 'TestPassword123' },
        expectedField: 'email'
      },
      {
        data: { email: 'test@example.com', password: '' },
        expectedField: 'password'
      },
      {
        data: { email: 'test@example.com' },
        expectedField: 'password'
      },
      {
        data: { password: 'TestPassword123' },
        expectedField: 'email'
      },
      {
        data: {},
        expectedField: 'email'
      }
    ];

    for (const testCase of loginValidationTests) {
      const response = await request(app)
        .post('/api/auth/login')
        .send(testCase.data)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toHaveProperty(testCase.expectedField);
    }
  });
});