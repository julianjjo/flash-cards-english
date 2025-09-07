import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

let app;

describe('User Registration Flow Integration Tests', () => {
  beforeAll(async () => {
    // This test MUST fail until the complete registration flow is implemented
    try {
      const appModule = await import('../../index.js');
      app = appModule.default || appModule.app;
    } catch (error) {
      console.log('Expected: App not yet implemented');
    }
  });

  beforeEach(async () => {
    // Clean up database before each test
    // This ensures isolated test scenarios
  });

  afterAll(async () => {
    // Clean up test database
  });

  test('should complete full registration flow successfully', async () => {
    expect(app).toBeDefined(); // This MUST fail initially

    const newUser = {
      email: 'integration-user@example.com',
      password: 'IntegrationTestPass123'
    };

    // Step 1: Register new user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(newUser)
      .expect('Content-Type', /json/)
      .expect(201);

    // Verify registration response
    expect(registerResponse.body).toHaveProperty('success', true);
    expect(registerResponse.body).toHaveProperty('user');
    expect(registerResponse.body).toHaveProperty('token');
    expect(registerResponse.body.user).toHaveProperty('email', newUser.email);
    expect(registerResponse.body.user).toHaveProperty('role', 'user');
    expect(registerResponse.body.user).not.toHaveProperty('password');

    const authToken = registerResponse.body.token;
    const userId = registerResponse.body.user.id;

    // Step 2: Verify user can access protected profile endpoint
    const profileResponse = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(profileResponse.body).toHaveProperty('success', true);
    expect(profileResponse.body.user).toHaveProperty('id', userId);
    expect(profileResponse.body.user).toHaveProperty('email', newUser.email);

    // Step 3: Verify user appears in admin user list (with admin access)
    // First create an admin user
    const adminUser = {
      email: 'admin-integration@example.com',
      password: 'AdminTestPass123'
    };

    const adminRegisterResponse = await request(app)
      .post('/api/auth/register')
      .send(adminUser)
      .expect(201);

    const adminToken = adminRegisterResponse.body.token;
    const adminId = adminRegisterResponse.body.user.id;

    // Promote to admin (this assumes we can modify user role directly)
    // In real implementation, this would be done through database seeding or admin endpoint
    await request(app)
      .put(`/api/admin/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'admin' })
      .expect(200);

    // Now check admin can see the new user
    const usersListResponse = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(usersListResponse.body).toHaveProperty('success', true);
    expect(usersListResponse.body).toHaveProperty('users');
    
    const newUserInList = usersListResponse.body.users.find(u => u.id === userId);
    expect(newUserInList).toBeDefined();
    expect(newUserInList.email).toBe(newUser.email);
    expect(newUserInList.role).toBe('user');

    // Step 4: Verify user can login with created credentials
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: newUser.email,
        password: newUser.password
      })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(loginResponse.body).toHaveProperty('success', true);
    expect(loginResponse.body).toHaveProperty('token');
    expect(loginResponse.body.user).toHaveProperty('id', userId);

    // Step 5: Verify login token works for authenticated requests
    const newAuthToken = loginResponse.body.token;
    
    const profileWithNewTokenResponse = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${newAuthToken}`)
      .expect(200);

    expect(profileWithNewTokenResponse.body.user).toHaveProperty('id', userId);
  });

  test('should handle duplicate email registration gracefully', async () => {
    expect(app).toBeDefined();

    const userData = {
      email: 'duplicate-test@example.com',
      password: 'TestPassword123'
    };

    // First registration should succeed
    const firstRegisterResponse = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    expect(firstRegisterResponse.body).toHaveProperty('success', true);

    // Second registration with same email should fail
    const secondRegisterResponse = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(409);

    expect(secondRegisterResponse.body).toHaveProperty('success', false);
    expect(secondRegisterResponse.body.message).toContain('already exists');

    // Verify only one user exists in database
    // Create admin to check user count
    const adminToken = await createTestAdmin(app);
    
    const usersResponse = await request(app)
      .get('/api/admin/users')
      .query({ search: 'duplicate-test' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const matchingUsers = usersResponse.body.users.filter(u => 
      u.email === userData.email
    );
    expect(matchingUsers).toHaveLength(1);
  });

  test('should maintain data integrity across registration and profile updates', async () => {
    expect(app).toBeDefined();

    const userData = {
      email: 'integrity-test@example.com',
      password: 'TestPassword123'
    };

    // Step 1: Register user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    const authToken = registerResponse.body.token;
    const userId = registerResponse.body.user.id;
    const originalCreatedAt = registerResponse.body.user.created_at;

    // Step 2: Update user profile
    const profileUpdate = {
      email: 'updated-integrity-test@example.com'
    };

    const updateResponse = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(profileUpdate)
      .expect(200);

    expect(updateResponse.body).toHaveProperty('success', true);
    expect(updateResponse.body.user).toHaveProperty('email', profileUpdate.email);
    expect(updateResponse.body.user).toHaveProperty('id', userId);
    expect(updateResponse.body.user).toHaveProperty('created_at', originalCreatedAt);
    expect(updateResponse.body.user.updated_at).not.toBe(originalCreatedAt);

    // Step 3: Verify login works with updated email
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: profileUpdate.email,
        password: userData.password
      })
      .expect(200);

    expect(loginResponse.body).toHaveProperty('success', true);
    expect(loginResponse.body.user).toHaveProperty('id', userId);

    // Step 4: Verify old email no longer works
    await request(app)
      .post('/api/auth/login')
      .send(userData)
      .expect(401);

    // Step 5: Verify profile consistency across all endpoints
    const newAuthToken = loginResponse.body.token;
    
    const profileResponse = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${newAuthToken}`)
      .expect(200);

    expect(profileResponse.body.user).toHaveProperty('email', profileUpdate.email);
    expect(profileResponse.body.user).toHaveProperty('id', userId);
  });

  test('should handle registration validation errors appropriately', async () => {
    expect(app).toBeDefined();

    // Test various validation scenarios
    const validationTests = [
      {
        data: { email: '', password: 'TestPassword123' },
        expectedError: 'email'
      },
      {
        data: { email: 'invalid-email', password: 'TestPassword123' },
        expectedError: 'email'
      },
      {
        data: { email: 'test@example.com', password: '' },
        expectedError: 'password'
      },
      {
        data: { email: 'test@example.com', password: '123' },
        expectedError: 'password'
      },
      {
        data: { email: 'test@example.com' },
        expectedError: 'password'
      },
      {
        data: { password: 'TestPassword123' },
        expectedError: 'email'
      }
    ];

    for (const testCase of validationTests) {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testCase.data)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toHaveProperty(testCase.expectedError);
    }
  });

  test('should properly handle concurrent registration attempts', async () => {
    expect(app).toBeDefined();

    const userData = {
      email: 'concurrent-test@example.com',
      password: 'TestPassword123'
    };

    // Simulate concurrent registration attempts
    const registrationPromises = Array.from({ length: 5 }, () =>
      request(app)
        .post('/api/auth/register')
        .send(userData)
    );

    const responses = await Promise.allSettled(registrationPromises);

    // Only one should succeed
    const successfulResponses = responses.filter(r => 
      r.status === 'fulfilled' && r.value.status === 201
    );
    const failedResponses = responses.filter(r => 
      r.status === 'fulfilled' && r.value.status === 409
    );

    expect(successfulResponses).toHaveLength(1);
    expect(failedResponses).toHaveLength(4);

    // Verify database consistency
    const adminToken = await createTestAdmin(app);
    
    const usersResponse = await request(app)
      .get('/api/admin/users')
      .query({ search: 'concurrent-test' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const matchingUsers = usersResponse.body.users.filter(u => 
      u.email === userData.email
    );
    expect(matchingUsers).toHaveLength(1);
  });
});

// Helper function to create test admin
async function createTestAdmin(app) {
  const adminData = {
    email: `admin-${Date.now()}@example.com`,
    password: 'AdminPassword123'
  };

  const registerResponse = await request(app)
    .post('/api/auth/register')
    .send(adminData)
    .expect(201);

  const adminToken = registerResponse.body.token;
  const adminId = registerResponse.body.user.id;

  // Promote to admin
  await request(app)
    .put(`/api/admin/users/${adminId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ role: 'admin' })
    .expect(200);

  return adminToken;
}