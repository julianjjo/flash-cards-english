import { test, expect } from '@playwright/test';
import { AuthPages } from '../pages/AuthPages.js';
import { FlashcardPages } from '../pages/FlashcardPages.js';
import { AdminPages } from '../pages/AdminPages.js';
import { setupTestEnvironment, teardownTestEnvironment, dbHelper } from '../utils/databaseHelpers.js';
import { generateTestEmail, generateTestPassword, generateFlashcardData } from '../utils/testUtils.js';

/**
 * Cross-User Data Isolation Journey Tests
 * 
 * These tests verify complete data security and isolation between users including:
 * - User flashcard data isolation (no cross-user access)
 * - Learning session data separation
 * - Admin access boundaries and user management isolation
 * - API endpoint security and unauthorized access prevention
 * - Session security and token isolation
 * - Direct URL access protection
 * - Database-level data integrity and isolation
 */

test.describe('Cross-User Data Isolation Journey', () => {
  let authPages;
  let flashcardPages;
  let adminPages;
  let users = [];

  test.beforeAll(async () => {
    await setupTestEnvironment();
  });

  test.afterAll(async () => {
    await teardownTestEnvironment();
  });

  test.beforeEach(async ({ page }) => {
    authPages = new AuthPages(page);
    flashcardPages = new FlashcardPages(page);
    adminPages = new AdminPages(page);
    
    // Create multiple test users with distinct data sets
    users = [];
    
    for (let i = 0; i < 4; i++) {
      const email = generateTestEmail(`isolation-user${i}`);
      const password = generateTestPassword();
      const role = i === 0 ? 'admin' : 'user';
      
      const userId = await dbHelper.createTestUser(email, password, role);
      
      // Create unique flashcards for each user
      const userFlashcards = [];
      for (let j = 0; j < 5; j++) {
        const flashcardId = dbHelper.createFlashcard(
          userId,
          `User${i} English ${j}`,
          `Usuario${i} Español ${j}`,
          (j % 5) + 1
        );
        userFlashcards.push(flashcardId);
      }
      
      // Create study sessions for each user
      for (let j = 0; j < 3; j++) {
        dbHelper.createStudySession(
          userId,
          userFlashcards[j % userFlashcards.length],
          Math.floor(Math.random() * 5) + 1,
          Math.floor(Math.random() * 5000) + 1000
        );
      }
      
      users.push({
        id: userId,
        email,
        password,
        role,
        flashcards: userFlashcards
      });
    }
  });

  test.afterEach(async () => {
    // Clean up all test users
    for (const user of users) {
      dbHelper.cleanupTestUser(user.email);
    }
    users = [];
  });

  test.describe('Flashcard Data Isolation Journey', () => {
    test('should only show user-specific flashcards in list view', async () => {
      // Login as first user
      await authPages.loginAs(users[1].email, users[1].password);
      
      // Navigate to flashcards
      await flashcardPages.navigateToFlashcards();
      
      // Verify only this user's flashcards are visible
      const expectedTexts = [`User1 English 0`, `User1 English 1`, `User1 English 2`];
      const actualCount = await flashcardPages.verifyUserFlashcardsOnly(expectedTexts);
      
      expect(actualCount).toBe(5); // User should have exactly 5 flashcards
      
      // Verify other users' flashcards are NOT visible
      const forbiddenTexts = [`User2 English 0`, `User3 English 0`, `User0 English 0`];
      await flashcardPages.verifyNoUnauthorizedFlashcards(forbiddenTexts);
    });

    test('should prevent access to other users\' flashcard details via direct URL', async () => {
      // Login as second user
      await authPages.loginAs(users[2].email, users[2].password);
      
      // Try to access first user's flashcard directly
      const otherUserFlashcardId = users[1].flashcards[0];
      
      await flashcardPages.attemptUnauthorizedAccess(otherUserFlashcardId);
      
      // Should be redirected or show access denied
      await expect(flashcardPages.page).toHaveURL('/home');
      await expect(flashcardPages.page.locator('.error-message')).toContainText('Flashcard not found');
    });

    test('should isolate flashcard creation between users', async () => {
      // Login as first user and create flashcard
      await authPages.loginAs(users[1].email, users[1].password);
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('User1 New Card', 'Usuario1 Nueva Tarjeta');
      
      const user1Count = await flashcardPages.verifyFlashcardsList();
      
      // Logout and login as second user
      await authPages.logout();
      await authPages.loginAs(users[2].email, users[2].password);
      await flashcardPages.navigateToFlashcards();
      
      const user2Count = await flashcardPages.verifyFlashcardsList();
      
      // User2 should still have original count (5), not see User1's new card
      expect(user2Count).toBe(5);
      
      // Verify User1's new card is not visible
      await expect(flashcardPages.page.locator('[data-testid="flashcard-list"]')).not.toContainText('User1 New Card');
    });

    test('should prevent editing other users\' flashcards', async () => {
      // Login as first user
      await authPages.loginAs(users[1].email, users[1].password);
      
      // Get another user's flashcard ID and try to edit via API
      const otherUserFlashcardId = users[2].flashcards[0];
      
      // Attempt API call to edit other user's flashcard
      const response = await flashcardPages.page.request.put(
        `/api/flashcards/${otherUserFlashcardId}`,
        {
          data: {
            english: 'Unauthorized Edit',
            spanish: 'Edición No Autorizada'
          }
        }
      );
      
      // Should be forbidden
      expect(response.status()).toBe(403);
    });

    test('should prevent deleting other users\' flashcards', async () => {
      // Login as first user
      await authPages.loginAs(users[1].email, users[1].password);
      
      // Try to delete another user's flashcard via API
      const otherUserFlashcardId = users[2].flashcards[0];
      
      const response = await flashcardPages.page.request.delete(`/api/flashcards/${otherUserFlashcardId}`);
      
      // Should be forbidden
      expect(response.status()).toBe(403);
      
      // Verify flashcard still exists for owner
      await authPages.logout();
      await authPages.loginAs(users[2].email, users[2].password);
      await flashcardPages.navigateToFlashcards();
      
      const flashcardCount = await flashcardPages.verifyFlashcardsList();
      expect(flashcardCount).toBe(5); // All flashcards should still exist
    });

    test('should isolate search results between users', async () => {
      // Login as first user
      await authPages.loginAs(users[1].email, users[1].password);
      await flashcardPages.navigateToFlashcards();
      
      // Search for pattern that exists in multiple users' data
      await flashcardPages.searchFlashcards('English 0');
      
      // Should only find this user's matching flashcard
      await flashcardPages.verifySearchResults(1, 'User1 English 0');
      
      // Should not find other users' matching flashcards
      await expect(flashcardPages.page.locator('[data-testid="flashcard-list"]')).not.toContainText('User2 English 0');
    });
  });

  test.describe('Learning Session Data Isolation Journey', () => {
    test('should isolate learning sessions between users', async () => {
      // Login as first user and complete some learning
      await authPages.loginAs(users[1].email, users[1].password);
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // Complete a few reviews
      await flashcardPages.completeMultipleReviews(3, 4);
      
      // Check user's statistics
      await flashcardPages.viewStatistics();
      await expect(flashcardPages.page.locator('[data-testid="cards-reviewed"]')).not.toHaveText('0');
      
      // Logout and login as different user
      await authPages.logout();
      await authPages.loginAs(users[2].email, users[2].password);
      await flashcardPages.navigateToFlashcards();
      
      // Start learning session - should not see other user's progress
      await flashcardPages.startLearningSession();
      
      // This user's statistics should be independent
      await flashcardPages.page.click('[data-testid="end-session"]');
      await flashcardPages.viewStatistics();
      
      // Should show this user's existing study sessions (created in beforeEach)
      const reviewCount = await flashcardPages.page.locator('[data-testid="cards-reviewed"]').textContent();
      expect(parseInt(reviewCount)).toBeGreaterThan(0); // Has their own sessions
      expect(parseInt(reviewCount)).not.toBe(3); // But not the other user's new reviews
    });

    test('should prevent access to other users\' learning statistics', async () => {
      // Login as first user
      await authPages.loginAs(users[1].email, users[1].password);
      
      // Try to access another user's statistics via API
      const response = await flashcardPages.page.request.get(`/api/users/${users[2].id}/stats`);
      
      // Should be forbidden
      expect(response.status()).toBe(403);
    });

    test('should isolate difficulty adjustments between users', async () => {
      // Get initial difficulties for both users
      const user1Flashcards = dbHelper.getUserFlashcards(users[1].id);
      const user2Flashcards = dbHelper.getUserFlashcards(users[2].id);
      
      const user1InitialDifficulty = user1Flashcards[0].difficulty;
      const user2InitialDifficulty = user2Flashcards[0].difficulty;
      
      // Login as first user and affect difficulty
      await authPages.loginAs(users[1].email, users[1].password);
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      await flashcardPages.completeFlashcardReview(5); // High rating should change difficulty
      
      // Check that only user1's flashcard difficulty changed
      const updatedUser1Flashcards = dbHelper.getUserFlashcards(users[1].id);
      const updatedUser2Flashcards = dbHelper.getUserFlashcards(users[2].id);
      
      // User1's difficulty should be different
      expect(updatedUser1Flashcards[0].difficulty).not.toBe(user1InitialDifficulty);
      
      // User2's difficulty should remain unchanged
      expect(updatedUser2Flashcards[0].difficulty).toBe(user2InitialDifficulty);
    });

    test('should prevent unauthorized study session creation', async () => {
      // Login as first user
      await authPages.loginAs(users[1].email, users[1].password);
      
      // Try to create study session for another user's flashcard
      const otherUserFlashcardId = users[2].flashcards[0];
      
      const response = await flashcardPages.page.request.post('/api/study-sessions', {
        data: {
          flashcardId: otherUserFlashcardId,
          qualityRating: 5,
          responseTime: 2000
        }
      });
      
      // Should be forbidden
      expect(response.status()).toBe(403);
    });
  });

  test.describe('Admin Access Isolation Journey', () => {
    test('should allow admin to view all users but isolate their personal data', async () => {
      // Login as admin user
      await authPages.loginAs(users[0].email, users[0].password);
      await authPages.verifyAdminUser();
      
      // Admin can view user management
      await adminPages.navigateToUserManagement();
      
      const userCount = await adminPages.verifyUsersList();
      expect(userCount).toBeGreaterThanOrEqual(4); // Should see all users
      
      // But admin's personal flashcards should be separate
      await flashcardPages.navigateToFlashcards();
      
      // Admin should only see their own flashcards
      const expectedTexts = [`User0 English 0`, `User0 English 1`];
      await flashcardPages.verifyUserFlashcardsOnly(expectedTexts);
      
      // Admin should not see other users' flashcards in their personal area
      const forbiddenTexts = [`User1 English 0`, `User2 English 0`];
      await flashcardPages.verifyNoUnauthorizedFlashcards(forbiddenTexts);
    });

    test('should prevent regular users from accessing admin functions', async () => {
      // Login as regular user
      await authPages.loginAs(users[1].email, users[1].password);
      await authPages.verifyRegularUser();
      
      // Try to access admin API endpoints
      const adminEndpoints = [
        '/api/admin/users',
        '/api/admin/system-stats',
        '/api/admin/activity-logs'
      ];
      
      for (const endpoint of adminEndpoints) {
        const response = await flashcardPages.page.request.get(endpoint);
        expect(response.status()).toBe(403);
      }
      
      // Try to access admin pages directly
      await adminPages.page.goto('/admin');
      await authPages.verifyAccessDenied();
    });

    test('should isolate admin actions and prevent privilege escalation', async () => {
      // Login as regular user
      await authPages.loginAs(users[1].email, users[1].password);
      
      // Try to promote another user (should fail)
      const response = await adminPages.page.request.put(`/api/admin/users/${users[2].id}`, {
        data: {
          role: 'admin'
        }
      });
      
      expect(response.status()).toBe(403);
      
      // Try to modify own role (should fail)
      const selfPromoteResponse = await adminPages.page.request.put(`/api/admin/users/${users[1].id}`, {
        data: {
          role: 'admin'
        }
      });
      
      expect(selfPromoteResponse.status()).toBe(403);
    });

    test('should prevent admin from accessing users\' personal learning data', async () => {
      // Login as admin
      await authPages.loginAs(users[0].email, users[0].password);
      
      // Admin can view user management
      await adminPages.navigateToUserManagement();
      
      // But cannot directly access user's flashcard content through admin interface
      await adminPages.viewUserDetails(users[1].email);
      
      // Should see user profile, not flashcard content
      await adminPages.verifyUserProfile(users[1].email, 'user');
      
      // Admin cannot edit user's flashcards through admin interface
      await expect(adminPages.page.locator('[data-testid="user-flashcards"]')).not.toBeVisible();
    });
  });

  test.describe('Session Security and Token Isolation Journey', () => {
    test('should prevent session sharing between users', async () => {
      // Login as first user and get session info
      await authPages.loginAs(users[1].email, users[1].password);
      
      const user1Token = await authPages.page.evaluate(() => localStorage.getItem('authToken'));
      expect(user1Token).toBeTruthy();
      
      // Logout and login as different user
      await authPages.logout();
      await authPages.loginAs(users[2].email, users[2].password);
      
      const user2Token = await authPages.page.evaluate(() => localStorage.getItem('authToken'));
      expect(user2Token).toBeTruthy();
      
      // Tokens should be different
      expect(user1Token).not.toBe(user2Token);
      
      // Try to use first user's token (simulate token theft)
      await authPages.page.evaluate((token) => {
        localStorage.setItem('authToken', token);
      }, user1Token);
      
      // Try to access protected resource
      const response = await authPages.page.request.get('/api/flashcards');
      
      // Should be unauthorized (token should be invalid/expired)
      expect([401, 403].includes(response.status())).toBe(true);
    });

    test('should invalidate session on logout and prevent reuse', async () => {
      // Login and get token
      await authPages.loginAs(users[1].email, users[1].password);
      
      const token = await authPages.page.evaluate(() => localStorage.getItem('authToken'));
      expect(token).toBeTruthy();
      
      // Logout
      await authPages.logout();
      
      // Try to use old token
      await authPages.page.evaluate((oldToken) => {
        localStorage.setItem('authToken', oldToken);
      }, token);
      
      // Try to access protected resource
      const response = await authPages.page.request.get('/api/flashcards');
      
      // Should be unauthorized
      expect(response.status()).toBe(401);
    });

    test('should prevent concurrent session abuse', async ({ context }) => {
      // Login in first browser context
      await authPages.loginAs(users[1].email, users[1].password);
      await authPages.verifyUserAuthenticated();
      
      // Create second browser context and login same user
      const secondPage = await context.newPage();
      const secondAuthPages = new AuthPages(secondPage);
      const secondFlashcardPages = new FlashcardPages(secondPage);
      
      await secondAuthPages.loginAs(users[1].email, users[1].password);
      
      // Both sessions should work independently
      await flashcardPages.navigateToFlashcards();
      await secondFlashcardPages.navigateToFlashcards();
      
      const firstPageCount = await flashcardPages.verifyFlashcardsList();
      const secondPageCount = await secondFlashcardPages.verifyFlashcardsList();
      
      expect(firstPageCount).toBe(secondPageCount);
      
      // Actions in one session shouldn't directly affect the other immediately
      await flashcardPages.createFlashcard('Session 1 Card', 'Tarjeta Sesión 1');
      
      // Second session should initially not see the change until refresh
      const countBeforeRefresh = await secondFlashcardPages.verifyFlashcardsList();
      expect(countBeforeRefresh).toBe(5); // Original count
      
      await secondPage.close();
    });

    test('should enforce session timeout and reauthentication', async () => {
      // Login
      await authPages.loginAs(users[1].email, users[1].password);
      
      // Simulate session timeout by manipulating token
      await authPages.simulateTokenExpiration();
      
      // Try to access protected resource
      await flashcardPages.navigateToFlashcards();
      
      // Should be redirected to login due to expired session
      await expect(flashcardPages.page).toHaveURL('/login');
    });
  });

  test.describe('API Security and Direct Access Prevention Journey', () => {
    test('should require authentication for all protected API endpoints', async () => {
      // Test without authentication
      const protectedEndpoints = [
        '/api/flashcards',
        '/api/study-sessions',
        '/api/users/profile',
        '/api/admin/users'
      ];
      
      for (const endpoint of protectedEndpoints) {
        const response = await flashcardPages.page.request.get(endpoint);
        expect(response.status()).toBe(401); // Unauthorized
      }
    });

    test('should validate user ownership for resource-specific endpoints', async () => {
      // Login as first user
      await authPages.loginAs(users[1].email, users[1].password);
      
      // Try to access another user's specific resources
      const otherUserFlashcardId = users[2].flashcards[0];
      
      const unauthorizedRequests = [
        { method: 'GET', url: `/api/flashcards/${otherUserFlashcardId}` },
        { method: 'PUT', url: `/api/flashcards/${otherUserFlashcardId}`, data: { english: 'hack', spanish: 'hack' } },
        { method: 'DELETE', url: `/api/flashcards/${otherUserFlashcardId}` }
      ];
      
      for (const request of unauthorizedRequests) {
        let response;
        switch (request.method) {
          case 'GET':
            response = await flashcardPages.page.request.get(request.url);
            break;
          case 'PUT':
            response = await flashcardPages.page.request.put(request.url, { data: request.data });
            break;
          case 'DELETE':
            response = await flashcardPages.page.request.delete(request.url);
            break;
        }
        
        expect([403, 404].includes(response.status())).toBe(true); // Forbidden or Not Found
      }
    });

    test('should prevent SQL injection and parameter tampering', async () => {
      // Login as regular user
      await authPages.loginAs(users[1].email, users[1].password);
      
      // Try SQL injection in search
      await flashcardPages.navigateToFlashcards();
      
      const maliciousSearches = [
        "'; DROP TABLE flashcards; --",
        "1' OR '1'='1",
        "'; SELECT * FROM users WHERE role='admin'; --"
      ];
      
      for (const maliciousSearch of maliciousSearches) {
        await flashcardPages.searchFlashcards(maliciousSearch);
        
        // Should not crash or reveal other data
        const results = await flashcardPages.page.locator('[data-testid="flashcard-item"]').count();
        expect(results).toBeLessThanOrEqual(5); // Only user's own flashcards
      }
    });

    test('should validate and sanitize user input across all endpoints', async () => {
      // Login
      await authPages.loginAs(users[1].email, users[1].password);
      await flashcardPages.navigateToFlashcards();
      
      // Try to create flashcard with malicious content
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        '{{constructor.constructor("alert(1)")()}}',
        '${7*7}',
        '<img src="x" onerror="alert(1)">'
      ];
      
      for (const maliciousInput of maliciousInputs) {
        await flashcardPages.openCreateForm();
        await flashcardPages.fillFlashcardForm(maliciousInput, 'safe spanish');
        await flashcardPages.submitFlashcardForm();
        
        // Should either reject the input or sanitize it
        // The exact behavior depends on implementation, but should not execute scripts
        const pageContent = await flashcardPages.page.content();
        expect(pageContent).not.toContain('<script>');
      }
    });
  });

  test.describe('Database-Level Data Integrity Journey', () => {
    test('should maintain referential integrity between users and flashcards', async () => {
      // Verify database constraints are working
      const user1 = users[1];
      const user1Flashcards = dbHelper.getUserFlashcards(user1.id);
      
      // All flashcards should belong to the correct user
      for (const flashcard of user1Flashcards) {
        expect(flashcard.user_id).toBe(user1.id);
      }
      
      // Database should enforce foreign key constraints
      // This test verifies at the database level
      const validation = dbHelper.validateFlashcardOwnership(user1Flashcards[0].id, user1.id);
      expect(validation).toBe(true);
      
      const invalidValidation = dbHelper.validateFlashcardOwnership(user1Flashcards[0].id, users[2].id);
      expect(invalidValidation).toBe(false);
    });

    test('should enforce data isolation at database query level', async () => {
      // Verify database queries properly filter by user
      const user1Id = users[1].id;
      const user2Id = users[2].id;
      
      // User isolation should be enforced
      const isolationValid = dbHelper.validateUserDataIsolation(user1Id, user2Id);
      expect(isolationValid).toBe(true);
      
      // Study sessions should also be isolated
      const user1Sessions = dbHelper.getUserStudySessions(user1Id);
      const user2Sessions = dbHelper.getUserStudySessions(user2Id);
      
      // Sessions should belong to correct users
      for (const session of user1Sessions) {
        expect(session.user_id).toBe(user1Id);
      }
      
      for (const session of user2Sessions) {
        expect(session.user_id).toBe(user2Id);
      }
      
      // No session crossover
      const user1SessionIds = user1Sessions.map(s => s.id);
      const user2SessionIds = user2Sessions.map(s => s.id);
      
      const hasOverlap = user1SessionIds.some(id => user2SessionIds.includes(id));
      expect(hasOverlap).toBe(false);
    });

    test('should handle user deletion with proper cascade behavior', async () => {
      // Create temporary user for deletion test
      const tempUserId = await dbHelper.createTestUser('temp-delete@example.com', 'password123');
      const tempFlashcardId = dbHelper.createFlashcard(tempUserId, 'Temp Card', 'Tarjeta Temporal');
      dbHelper.createStudySession(tempUserId, tempFlashcardId, 5);
      
      // Verify data exists
      let tempUserFlashcards = dbHelper.getUserFlashcards(tempUserId);
      let tempUserSessions = dbHelper.getUserStudySessions(tempUserId);
      
      expect(tempUserFlashcards.length).toBe(1);
      expect(tempUserSessions.length).toBe(1);
      
      // Delete user
      dbHelper.cleanupTestUser('temp-delete@example.com');
      
      // Verify cascading deletion worked
      tempUserFlashcards = dbHelper.getUserFlashcards(tempUserId);
      tempUserSessions = dbHelper.getUserStudySessions(tempUserId);
      
      expect(tempUserFlashcards.length).toBe(0);
      expect(tempUserSessions.length).toBe(0);
      
      // Verify other users' data is unaffected
      const user1Flashcards = dbHelper.getUserFlashcards(users[1].id);
      expect(user1Flashcards.length).toBe(5);
    });
  });

  test.describe('Complete Data Isolation Workflow Journey', () => {
    test('should demonstrate comprehensive multi-user workflow with perfect isolation', async () => {
      // User 1: Create flashcard and study
      await authPages.loginAs(users[1].email, users[1].password);
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('User1 Private', 'Usuario1 Privado');
      await flashcardPages.startLearningSession();
      await flashcardPages.completeMultipleReviews(2, 4);
      
      const user1FinalCount = await flashcardPages.verifyFlashcardsList();
      
      // User 2: Independent workflow
      await authPages.logout();
      await authPages.loginAs(users[2].email, users[2].password);
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('User2 Secret', 'Usuario2 Secreto');
      
      const user2FinalCount = await flashcardPages.verifyFlashcardsList();
      
      // Verify complete isolation
      expect(user1FinalCount).toBe(6); // 5 original + 1 new
      expect(user2FinalCount).toBe(6); // 5 original + 1 new
      
      // Verify User2 cannot see User1's data
      await expect(flashcardPages.page.locator('[data-testid="flashcard-list"]')).not.toContainText('User1 Private');
      await flashcardPages.verifyNoUnauthorizedFlashcards(['User1 Private']);
      
      // Admin verification
      await authPages.logout();
      await authPages.loginAs(users[0].email, users[0].password); // Admin
      await adminPages.navigateToUserManagement();
      
      // Admin can see users but not their private content in user management
      const allUsers = await adminPages.verifyUsersList();
      expect(allUsers).toBeGreaterThanOrEqual(4);
      
      // Admin's personal flashcards remain isolated
      await flashcardPages.navigateToFlashcards();
      const adminFlashcardCount = await flashcardPages.verifyFlashcardsList();
      expect(adminFlashcardCount).toBe(5); // Only admin's flashcards
      
      await flashcardPages.verifyNoUnauthorizedFlashcards(['User1 Private', 'User2 Secret']);
    });

    test('should maintain isolation under concurrent user operations', async ({ context }) => {
      // Create multiple browser contexts for concurrent testing
      const user1Page = await context.newPage();
      const user2Page = await context.newPage();
      
      const user1Auth = new AuthPages(user1Page);
      const user2Auth = new AuthPages(user2Page);
      const user1Flashcards = new FlashcardPages(user1Page);
      const user2Flashcards = new FlashcardPages(user2Page);
      
      // Login both users simultaneously
      await Promise.all([
        user1Auth.loginAs(users[1].email, users[1].password),
        user2Auth.loginAs(users[2].email, users[2].password)
      ]);
      
      // Navigate both to flashcards
      await Promise.all([
        user1Flashcards.navigateToFlashcards(),
        user2Flashcards.navigateToFlashcards()
      ]);
      
      // Concurrent operations
      await Promise.all([
        user1Flashcards.createFlashcard('Concurrent 1', 'Concurrente 1'),
        user2Flashcards.createFlashcard('Concurrent 2', 'Concurrente 2')
      ]);
      
      // Verify isolation maintained
      const user1Count = await user1Flashcards.verifyFlashcardsList();
      const user2Count = await user2Flashcards.verifyFlashcardsList();
      
      expect(user1Count).toBe(6); // 5 + 1 new
      expect(user2Count).toBe(6); // 5 + 1 new
      
      // Verify each user only sees their own content
      await expect(user1Page.locator('[data-testid="flashcard-list"]')).toContainText('Concurrent 1');
      await expect(user1Page.locator('[data-testid="flashcard-list"]')).not.toContainText('Concurrent 2');
      
      await expect(user2Page.locator('[data-testid="flashcard-list"]')).toContainText('Concurrent 2');
      await expect(user2Page.locator('[data-testid="flashcard-list"]')).not.toContainText('Concurrent 1');
      
      await user1Page.close();
      await user2Page.close();
    });

    test('should prevent all known attack vectors against data isolation', async () => {
      // Login as regular user
      await authPages.loginAs(users[1].email, users[1].password);
      
      // Test various attack vectors
      const attackVectors = [
        // Direct ID manipulation
        async () => {
          const response = await flashcardPages.page.request.get(`/api/flashcards/${users[2].flashcards[0]}`);
          return response.status();
        },
        
        // Parameter pollution
        async () => {
          const response = await flashcardPages.page.request.get(`/api/flashcards?userId=${users[2].id}`);
          return response.status();
        },
        
        // Header manipulation
        async () => {
          const response = await flashcardPages.page.request.get('/api/flashcards', {
            headers: { 'X-User-ID': users[2].id.toString() }
          });
          return response.status();
        },
        
        // Body parameter injection
        async () => {
          const response = await flashcardPages.page.request.post('/api/flashcards', {
            data: {
              english: 'Attack',
              spanish: 'Ataque',
              user_id: users[2].id
            }
          });
          return response.status();
        }
      ];
      
      // All attack vectors should fail
      for (const attack of attackVectors) {
        const statusCode = await attack();
        expect([400, 401, 403, 404].includes(statusCode)).toBe(true);
      }
      
      // Verify data integrity maintained
      const user1Flashcards = dbHelper.getUserFlashcards(users[1].id);
      const user2Flashcards = dbHelper.getUserFlashcards(users[2].id);
      
      expect(user1Flashcards.length).toBe(5);
      expect(user2Flashcards.length).toBe(5);
      
      // Verify no cross-contamination
      expect(dbHelper.validateUserDataIsolation(users[1].id, users[2].id)).toBe(true);
    });
  });
});