import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

let app;

describe('Admin User Management Flow Integration Tests', () => {
  beforeAll(async () => {
    // This test MUST fail until the complete admin user management flow is implemented
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

  test('should complete full admin user management flow successfully', async () => {
    expect(app).toBeDefined(); // This MUST fail initially

    // Step 1: Create admin user
    const adminData = {
      email: 'admin-management-test@example.com',
      password: 'AdminPassword123'
    };

    const adminRegisterResponse = await request(app)
      .post('/api/auth/register')
      .send(adminData)
      .expect(201);

    const adminToken = adminRegisterResponse.body.token;
    const adminId = adminRegisterResponse.body.user.id;

    // Step 2: Promote user to admin (initially this might require direct DB manipulation or special endpoint)
    const promoteToAdminResponse = await request(app)
      .put(`/api/admin/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'admin' })
      .expect(200);

    expect(promoteToAdminResponse.body).toHaveProperty('success', true);
    expect(promoteToAdminResponse.body.user).toHaveProperty('role', 'admin');

    // Step 3: Create regular users to manage
    const regularUsers = [
      {
        email: 'user1-admin-test@example.com',
        password: 'UserPassword123'
      },
      {
        email: 'user2-admin-test@example.com',
        password: 'UserPassword123'
      },
      {
        email: 'user3-admin-test@example.com',
        password: 'UserPassword123'
      }
    ];

    const userIds = [];
    for (const userData of regularUsers) {
      const userResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);
      
      userIds.push(userResponse.body.user.id);
    }

    // Step 4: Admin gets all users list
    const usersListResponse = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(usersListResponse.body).toHaveProperty('success', true);
    expect(usersListResponse.body).toHaveProperty('users');
    expect(usersListResponse.body).toHaveProperty('pagination');
    
    const allUsers = usersListResponse.body.users;
    expect(allUsers.length).toBeGreaterThanOrEqual(4); // Admin + 3 users

    // Verify admin and regular users are in the list
    const adminInList = allUsers.find(u => u.id === adminId);
    expect(adminInList).toBeDefined();
    expect(adminInList.role).toBe('admin');

    userIds.forEach(userId => {
      const userInList = allUsers.find(u => u.id === userId);
      expect(userInList).toBeDefined();
      expect(userInList.role).toBe('user');
    });

    // Step 5: Admin promotes a user to admin
    const userToPromote = userIds[0];
    const promoteUserResponse = await request(app)
      .put(`/api/admin/users/${userToPromote}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'admin' })
      .expect(200);

    expect(promoteUserResponse.body).toHaveProperty('success', true);
    expect(promoteUserResponse.body.user).toHaveProperty('role', 'admin');
    expect(promoteUserResponse.body.user).toHaveProperty('id', userToPromote);

    // Step 6: Verify promoted user appears as admin in users list
    const updatedUsersListResponse = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const promotedUser = updatedUsersListResponse.body.users.find(u => u.id === userToPromote);
    expect(promotedUser).toBeDefined();
    expect(promotedUser.role).toBe('admin');

    // Step 7: Admin demotes the promoted user back to user
    const demoteUserResponse = await request(app)
      .put(`/api/admin/users/${userToPromote}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'user' })
      .expect(200);

    expect(demoteUserResponse.body).toHaveProperty('success', true);
    expect(demoteUserResponse.body.user).toHaveProperty('role', 'user');

    // Step 8: Admin deletes a user
    const userToDelete = userIds[1];
    const deleteUserResponse = await request(app)
      .delete(`/api/admin/users/${userToDelete}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(deleteUserResponse.body).toHaveProperty('success', true);
    expect(deleteUserResponse.body.message).toContain('deleted successfully');

    // Step 9: Verify deleted user no longer appears in users list
    const finalUsersListResponse = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const deletedUser = finalUsersListResponse.body.users.find(u => u.id === userToDelete);
    expect(deletedUser).toBeUndefined();

    // Step 10: Verify deleted user cannot login
    await request(app)
      .post('/api/auth/login')
      .send(regularUsers[1]) // User that was deleted
      .expect(401);
  });

  test('should prevent regular users from accessing admin endpoints', async () => {
    expect(app).toBeDefined();

    // Create regular user
    const userData = {
      email: 'regular-user-admin-test@example.com',
      password: 'UserPassword123'
    };

    const userResponse = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    const userToken = userResponse.body.token;
    const userId = userResponse.body.user.id;

    // Test all admin endpoints with regular user token
    
    // GET /api/admin/users
    await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    // GET /api/admin/users/:id  
    await request(app)
      .get(`/api/admin/users/${userId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    // PUT /api/admin/users/:id
    await request(app)
      .put(`/api/admin/users/${userId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ role: 'admin' })
      .expect(403);

    // DELETE /api/admin/users/:id
    await request(app)
      .delete(`/api/admin/users/${userId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    // Verify all responses have proper error structure
    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Access forbidden');
    expect(response.body).toHaveProperty('error', 'Admin role required');
  });

  test('should handle admin user search and pagination', async () => {
    expect(app).toBeDefined();

    // Create admin
    const admin = await createTestAdmin(app);

    // Create multiple users with searchable emails
    const testUsers = [];
    for (let i = 1; i <= 15; i++) {
      const userData = {
        email: `search-user-${i.toString().padStart(2, '0')}@example.com`,
        password: 'UserPassword123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      testUsers.push(response.body.user);
    }

    // Test pagination
    const page1Response = await request(app)
      .get('/api/admin/users')
      .query({ page: 1, limit: 5 })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(page1Response.body.pagination).toHaveProperty('page', 1);
    expect(page1Response.body.pagination).toHaveProperty('limit', 5);
    expect(page1Response.body.users).toHaveLength(5);

    // Test search functionality
    const searchResponse = await request(app)
      .get('/api/admin/users')
      .query({ search: 'search-user-01' })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(searchResponse.body.users).toHaveLength(1);
    expect(searchResponse.body.users[0].email).toBe('search-user-01@example.com');

    // Test search with partial match
    const partialSearchResponse = await request(app)
      .get('/api/admin/users')
      .query({ search: 'search-user-1' })
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    // Should match search-user-10, search-user-11, etc.
    expect(partialSearchResponse.body.users.length).toBeGreaterThan(1);
    partialSearchResponse.body.users.forEach(user => {
      expect(user.email).toContain('search-user-1');
    });
  });

  test('should prevent admin from deleting themselves', async () => {
    expect(app).toBeDefined();

    // Create admin
    const admin = await createTestAdmin(app);

    // Try to delete self
    const deleteSelfResponse = await request(app)
      .delete(`/api/admin/users/${admin.userId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(400);

    expect(deleteSelfResponse.body).toHaveProperty('success', false);
    expect(deleteSelfResponse.body.message).toContain('delete');
    expect(deleteSelfResponse.body.message).toContain('self');

    // Verify admin still exists and can access admin endpoints
    const profileResponse = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(profileResponse.body.user).toHaveProperty('id', admin.userId);
    expect(profileResponse.body.user).toHaveProperty('role', 'admin');
  });

  test('should handle role changes and permission cascading', async () => {
    expect(app).toBeDefined();

    // Create main admin
    const mainAdmin = await createTestAdmin(app);

    // Create user to promote
    const userData = {
      email: 'role-cascade-test@example.com',
      password: 'UserPassword123'
    };

    const userResponse = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    const userId = userResponse.body.user.id;
    const originalUserToken = userResponse.body.token;

    // Verify user cannot access admin endpoints initially
    await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${originalUserToken}`)
      .expect(403);

    // Promote user to admin
    await request(app)
      .put(`/api/admin/users/${userId}`)
      .set('Authorization', `Bearer ${mainAdmin.token}`)
      .send({ role: 'admin' })
      .expect(200);

    // Verify original token now has admin access
    const adminAccessResponse = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${originalUserToken}`)
      .expect(200);

    expect(adminAccessResponse.body).toHaveProperty('success', true);

    // Login with new admin credentials to get fresh token
    const newAdminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send(userData)
      .expect(200);

    expect(newAdminLoginResponse.body.user).toHaveProperty('role', 'admin');
    const newAdminToken = newAdminLoginResponse.body.token;

    // Verify new token has admin access
    await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${newAdminToken}`)
      .expect(200);

    // Demote back to user
    await request(app)
      .put(`/api/admin/users/${userId}`)
      .set('Authorization', `Bearer ${mainAdmin.token}`)
      .send({ role: 'user' })
      .expect(200);

    // Verify tokens lose admin access (this might require token refresh mechanism)
    // For now, test that new login doesn't have admin access
    const demotedLoginResponse = await request(app)
      .post('/api/auth/login')
      .send(userData)
      .expect(200);

    expect(demotedLoginResponse.body.user).toHaveProperty('role', 'user');

    const demotedToken = demotedLoginResponse.body.token;

    await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${demotedToken}`)
      .expect(403);
  });

  test('should handle admin operations with validation errors', async () => {
    expect(app).toBeDefined();

    const admin = await createTestAdmin(app);

    // Test invalid user ID formats
    const invalidIds = ['abc', '0', '-1', 'null', 'undefined'];

    for (const invalidId of invalidIds) {
      // GET user by invalid ID
      await request(app)
        .get(`/api/admin/users/${invalidId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(400);

      // UPDATE user with invalid ID
      await request(app)
        .put(`/api/admin/users/${invalidId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ role: 'admin' })
        .expect(400);

      // DELETE user with invalid ID
      await request(app)
        .delete(`/api/admin/users/${invalidId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(400);
    }

    // Test invalid role values
    const userData = {
      email: 'validation-test@example.com',
      password: 'UserPassword123'
    };

    const userResponse = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    const userId = userResponse.body.user.id;

    const invalidRoles = ['superadmin', 'moderator', '', null, undefined, 123];

    for (const invalidRole of invalidRoles) {
      const response = await request(app)
        .put(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ role: invalidRole })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toHaveProperty('role');
    }
  });

  test('should maintain audit trail for admin actions', async () => {
    expect(app).toBeDefined();

    const admin = await createTestAdmin(app);

    // Create user for admin actions
    const userData = {
      email: 'audit-trail-test@example.com',
      password: 'UserPassword123'
    };

    const userResponse = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    const userId = userResponse.body.user.id;

    // Perform admin actions
    await request(app)
      .put(`/api/admin/users/${userId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'admin' })
      .expect(200);

    await request(app)
      .put(`/api/admin/users/${userId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'user' })
      .expect(200);

    // Check that user list shows updated timestamps
    const usersListResponse = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    const targetUser = usersListResponse.body.users.find(u => u.id === userId);
    expect(targetUser).toBeDefined();
    expect(targetUser).toHaveProperty('updated_at');
    expect(new Date(targetUser.updated_at).getTime()).toBeGreaterThan(
      new Date(targetUser.created_at).getTime()
    );
  });
});

// Helper function to create test admin
async function createTestAdmin(app) {
  const adminData = {
    email: `test-admin-${Date.now()}@example.com`,
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

  return {
    token: adminToken,
    userId: adminId,
    email: adminData.email
  };
}