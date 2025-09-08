import { test, expect } from '@playwright/test';
import { AuthPages } from '../pages/AuthPages.js';
import { AdminPages } from '../pages/AdminPages.js';
import { FlashcardPages } from '../pages/FlashcardPages.js';
import { setupTestEnvironment, teardownTestEnvironment, dbHelper } from '../utils/databaseHelpers.js';
import { generateTestEmail, generateTestPassword, TIMEOUTS } from '../utils/testUtils.js';

/**
 * Admin Dashboard Management Journey Tests
 * 
 * These tests verify the complete admin dashboard experience including:
 * - Admin authentication and access control
 * - User management operations (view, edit, delete, promote)
 * - System statistics and analytics dashboard
 * - Configuration management
 * - Activity logging and audit trails
 * - Performance and responsive admin interface
 */

test.describe('Admin Dashboard Journey', () => {
  let authPages;
  let adminPages;
  let flashcardPages;
  let adminUser;
  let regularUsers = [];

  test.beforeAll(async () => {
    await setupTestEnvironment();
  });

  test.afterAll(async () => {
    await teardownTestEnvironment();
  });

  test.beforeEach(async ({ page }) => {
    authPages = new AuthPages(page);
    adminPages = new AdminPages(page);
    flashcardPages = new FlashcardPages(page);
    
    // Create admin user
    const adminEmail = generateTestEmail('admin');
    const adminPassword = generateTestPassword();
    
    adminUser = { email: adminEmail, password: adminPassword };
    
    await dbHelper.createTestUser(adminEmail, adminPassword, 'admin');
    
    // Create several regular users for management testing
    regularUsers = [];
    for (let i = 0; i < 3; i++) {
      const userEmail = generateTestEmail(`user${i}`);
      const userPassword = generateTestPassword();
      const userId = await dbHelper.createTestUser(userEmail, userPassword, 'user');
      
      regularUsers.push({ 
        id: userId, 
        email: userEmail, 
        password: userPassword 
      });
      
      // Create some flashcards for each user
      for (let j = 0; j < 5; j++) {
        dbHelper.createFlashcard(userId, `English ${i}-${j}`, `Spanish ${i}-${j}`, (j % 5) + 1);
      }
    }
    
    // Login as admin
    await authPages.loginAs(adminUser.email, adminUser.password);
    await authPages.verifyAdminUser();
  });

  test.afterEach(async () => {
    // Clean up test data
    if (adminUser) {
      dbHelper.cleanupTestUser(adminUser.email);
    }
    
    for (const user of regularUsers) {
      dbHelper.cleanupTestUser(user.email);
    }
    
    regularUsers = [];
  });

  test.describe('Admin Access Control Journey', () => {
    test('should allow admin users to access admin dashboard', async () => {
      await adminPages.navigateToAdminDashboard();
      
      // Verify admin dashboard elements are visible
      await expect(adminPages.page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
      await expect(adminPages.page.locator('[data-testid="user-management"]')).toBeVisible();
      await expect(adminPages.page.locator('[data-testid="system-stats"]')).toBeVisible();
    });

    test('should prevent regular users from accessing admin dashboard', async () => {
      // Logout admin and login as regular user
      await authPages.logout();
      await authPages.loginAs(regularUsers[0].email, regularUsers[0].password);
      await authPages.verifyRegularUser();
      
      // Try to access admin dashboard directly
      await adminPages.page.goto('/admin');
      
      // Should be redirected or show access denied
      await authPages.verifyAccessDenied();
    });

    test('should show admin menu items only to admin users', async () => {
      // Verify admin menu is visible
      await expect(adminPages.page.locator('[data-testid="admin-menu"]')).toBeVisible();
      
      // Logout and login as regular user
      await authPages.logout();
      await authPages.loginAs(regularUsers[0].email, regularUsers[0].password);
      
      // Admin menu should not be visible
      await expect(adminPages.page.locator('[data-testid="admin-menu"]')).not.toBeVisible();
    });

    test('should handle admin session expiration gracefully', async () => {
      await adminPages.navigateToAdminDashboard();
      
      // Simulate token expiration
      await authPages.simulateTokenExpiration();
      
      // Try to perform admin action
      await adminPages.page.click('[data-testid="user-management"]');
      
      // Should be redirected to login
      await expect(adminPages.page).toHaveURL('/login');
    });
  });

  test.describe('User Management Journey', () => {
    test('should display all users in management interface', async () => {
      await adminPages.navigateToUserManagement();
      
      const userCount = await adminPages.verifyUsersList();
      
      // Should show admin + regular users (at least 4 total)
      expect(userCount).toBeGreaterThanOrEqual(4);
    });

    test('should show user details and statistics', async () => {
      await adminPages.navigateToUserManagement();
      
      // View first regular user details
      await adminPages.viewUserDetails(regularUsers[0].email);
      
      await adminPages.verifyUserProfile(regularUsers[0].email, 'user');
    });

    test('should edit user information successfully', async () => {
      await adminPages.navigateToUserManagement();
      
      const newEmail = generateTestEmail('updated');
      await adminPages.editUser(regularUsers[0].email, {
        email: newEmail,
        role: 'user'
      });
      
      await adminPages.verifyUserUpdated();
      
      // Update local reference
      regularUsers[0].email = newEmail;
    });

    test('should promote user to admin role', async () => {
      await adminPages.navigateToUserManagement();
      
      // Promote first user to admin
      await adminPages.promoteUserToAdmin(regularUsers[0].email);
      
      await adminPages.verifyUserRoleChanged(regularUsers[0].email, 'admin');
      
      // Demote back to user
      await adminPages.demoteAdminToUser(regularUsers[0].email);
      
      await adminPages.verifyUserRoleChanged(regularUsers[0].email, 'user');
    });

    test('should suspend user account', async () => {
      await adminPages.navigateToUserManagement();
      
      await adminPages.suspendUser(regularUsers[0].email);
      
      await adminPages.verifyUserSuspended(regularUsers[0].email);
      
      // Try to login as suspended user
      await authPages.logout();
      await authPages.testInvalidCredentials(regularUsers[0].email, regularUsers[0].password);
    });

    test('should delete user account with confirmation', async () => {
      await adminPages.navigateToUserManagement();
      
      const initialUserCount = await adminPages.verifyUsersList();
      
      await adminPages.deleteUser(regularUsers[0].email, true); // With confirmation
      
      await adminPages.verifyUserDeleted();
      
      const finalUserCount = await adminPages.verifyUsersList();
      expect(finalUserCount).toBe(initialUserCount - 1);
    });

    test('should cancel user deletion when requested', async () => {
      await adminPages.navigateToUserManagement();
      
      const initialUserCount = await adminPages.verifyUsersList();
      
      await adminPages.deleteUser(regularUsers[0].email, false); // Cancel deletion
      
      const finalUserCount = await adminPages.verifyUsersList();
      expect(finalUserCount).toBe(initialUserCount); // Count unchanged
    });

    test('should search and filter users', async () => {
      await adminPages.navigateToUserManagement();
      
      // Search for specific user
      await adminPages.searchUsers(regularUsers[0].email);
      
      await adminPages.verifyUserSearchResults(1, regularUsers[0].email);
      
      // Clear search
      await adminPages.clearUserSearch();
      
      const allUsersCount = await adminPages.verifyUsersList();
      expect(allUsersCount).toBeGreaterThan(1);
    });

    test('should filter users by role', async () => {
      await adminPages.navigateToUserManagement();
      
      // Filter by admin role
      await adminPages.filterUsersByRole('admin');
      
      await adminPages.verifyUserRoleFilter('admin');
      
      // Filter by user role
      await adminPages.filterUsersByRole('user');
      
      await adminPages.verifyUserRoleFilter('user');
    });

    test('should bulk select and manage users', async () => {
      await adminPages.navigateToUserManagement();
      
      // Select multiple users
      await adminPages.selectMultipleUsers([regularUsers[0].email, regularUsers[1].email]);
      
      // Verify bulk actions are available
      await adminPages.verifyBulkActionsAvailable();
      
      // Perform bulk action (e.g., role change)
      await adminPages.performBulkRoleChange('admin');
      
      await adminPages.verifyBulkActionCompleted();
    });
  });

  test.describe('System Statistics Dashboard Journey', () => {
    test('should display comprehensive system statistics', async () => {
      await adminPages.navigateToSystemStats();
      
      await adminPages.verifySystemStatsDisplay();
      
      // Verify key metrics are shown
      await expect(adminPages.page.locator('[data-testid="total-users"]')).toBeVisible();
      await expect(adminPages.page.locator('[data-testid="total-flashcards"]')).toBeVisible();
      await expect(adminPages.page.locator('[data-testid="active-users"]')).toBeVisible();
    });

    test('should show accurate user and flashcard counts', async () => {
      await adminPages.navigateToSystemStats();
      
      // Get actual counts from database
      const systemStats = dbHelper.getSystemStats();
      
      await adminPages.verifyUserCount(systemStats.totalUsers);
      await adminPages.verifyFlashcardCount(systemStats.totalFlashcards);
    });

    test('should display activity charts and graphs', async () => {
      await adminPages.navigateToSystemStats();
      
      await adminPages.verifyActivityCharts();
      
      // Verify different chart types are present
      await expect(adminPages.page.locator('[data-testid="user-activity-chart"]')).toBeVisible();
      await expect(adminPages.page.locator('[data-testid="flashcard-creation-chart"]')).toBeVisible();
    });

    test('should show real-time updates', async () => {
      await adminPages.navigateToSystemStats();
      
      // Get initial counts
      const initialStats = await adminPages.getCurrentStats();
      
      // Create new user and flashcard in background
      const newUserId = await dbHelper.createTestUser('realtime@example.com', 'password123');
      dbHelper.createFlashcard(newUserId, 'Realtime Test', 'Prueba Tiempo Real');
      
      // Refresh stats
      await adminPages.refreshSystemStats();
      
      const updatedStats = await adminPages.getCurrentStats();
      
      // Counts should have increased
      expect(updatedStats.totalUsers).toBeGreaterThan(initialStats.totalUsers);
      expect(updatedStats.totalFlashcards).toBeGreaterThan(initialStats.totalFlashcards);
      
      // Cleanup
      dbHelper.cleanupTestUser('realtime@example.com');
    });

    test('should export statistics reports', async () => {
      await adminPages.navigateToSystemStats();
      
      // Test different export formats
      await adminPages.exportStatistics('csv');
      await adminPages.verifyExportDownload('csv');
      
      await adminPages.exportStatistics('pdf');
      await adminPages.verifyExportDownload('pdf');
    });

    test('should filter statistics by date range', async () => {
      await adminPages.navigateToSystemStats();
      
      // Set date filter for last 7 days
      await adminPages.setStatsDateFilter('7days');
      
      await adminPages.verifyStatsDateFilter('7days');
      
      // Set custom date range
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      await adminPages.setCustomDateRange(startDate, new Date());
      
      await adminPages.verifyCustomDateRange();
    });
  });

  test.describe('System Configuration Journey', () => {
    test('should access system configuration panel', async () => {
      await adminPages.navigateToSystemConfig();
      
      await expect(adminPages.page.locator('[data-testid="system-config"]')).toBeVisible();
    });

    test('should update system settings', async () => {
      await adminPages.navigateToSystemConfig();
      
      // Update various settings
      await adminPages.updateSystemSetting('maxFlashcardsPerUser', '1000');
      await adminPages.updateSystemSetting('sessionTimeout', '3600');
      
      await adminPages.saveSystemSettings();
      
      await adminPages.verifySystemSettingsUpdated();
    });

    test('should manage feature flags', async () => {
      await adminPages.navigateToSystemConfig();
      
      // Toggle feature flags
      await adminPages.toggleFeatureFlag('audioEnabled', true);
      await adminPages.toggleFeatureFlag('betaFeatures', false);
      
      await adminPages.saveSystemSettings();
      
      await adminPages.verifyFeatureFlagsUpdated();
    });

    test('should backup system data', async () => {
      await adminPages.navigateToSystemConfig();
      
      await adminPages.initiateSystemBackup();
      
      await adminPages.verifyBackupInProgress();
      
      // Wait for backup completion (with timeout)
      await adminPages.verifyBackupCompleted();
    });

    test('should validate configuration changes', async () => {
      await adminPages.navigateToSystemConfig();
      
      // Try to set invalid configuration
      await adminPages.updateSystemSetting('maxFlashcardsPerUser', '-1');
      
      await adminPages.saveSystemSettings();
      
      // Should show validation error
      await adminPages.verifyConfigurationError('Invalid value');
    });
  });

  test.describe('Activity Logging and Audit Trail Journey', () => {
    test('should log admin actions', async () => {
      await adminPages.navigateToUserManagement();
      
      // Perform an action that should be logged
      await adminPages.editUser(regularUsers[0].email, {
        email: regularUsers[0].email,
        role: 'admin'
      });
      
      // Check activity log
      await adminPages.navigateToActivityLog();
      
      await adminPages.verifyRecentActivity('User role changed');
    });

    test('should display comprehensive audit trail', async () => {
      await adminPages.navigateToActivityLog();
      
      await adminPages.verifyAuditTrailDisplay();
      
      // Verify log entries have required information
      await adminPages.verifyLogEntryDetails();
    });

    test('should filter activity logs', async () => {
      await adminPages.navigateToActivityLog();
      
      // Filter by action type
      await adminPages.filterActivityByType('user_management');
      
      await adminPages.verifyActivityFilterResults();
      
      // Filter by user
      await adminPages.filterActivityByUser(adminUser.email);
      
      await adminPages.verifyActivityFilterResults();
    });

    test('should export activity logs', async () => {
      await adminPages.navigateToActivityLog();
      
      await adminPages.exportActivityLog('csv');
      
      await adminPages.verifyExportDownload('csv');
    });

    test('should search activity logs', async () => {
      await adminPages.navigateToActivityLog();
      
      await adminPages.searchActivityLog('user role');
      
      await adminPages.verifyActivitySearchResults('user role');
    });
  });

  test.describe('Performance and Responsive Design Journey', () => {
    test('should load admin dashboard quickly', async () => {
      const startTime = Date.now();
      
      await adminPages.navigateToAdminDashboard();
      
      const loadTime = Date.now() - startTime;
      
      // Dashboard should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('should handle large user datasets efficiently', async () => {
      // Create many users for performance testing
      const testUsers = [];
      for (let i = 0; i < 50; i++) {
        const userId = await dbHelper.createTestUser(`perftest${i}@example.com`, 'password123');
        testUsers.push(userId);
      }
      
      const startTime = Date.now();
      
      await adminPages.navigateToUserManagement();
      
      const loadTime = Date.now() - startTime;
      
      // Should handle large dataset within 5 seconds
      expect(loadTime).toBeLessThan(5000);
      
      // Cleanup
      for (const userId of testUsers) {
        dbHelper.cleanupTestUser(`perftest${testUsers.indexOf(userId)}@example.com`);
      }
    });

    test('should work properly on mobile devices', async () => {
      await adminPages.verifyMobileAdminInterface();
      
      // Test basic admin functions on mobile
      await adminPages.navigateToUserManagement();
      
      const userCount = await adminPages.verifyUsersList();
      expect(userCount).toBeGreaterThan(0);
    });

    test('should support keyboard navigation', async () => {
      await adminPages.navigateToAdminDashboard();
      
      await adminPages.testKeyboardNavigation();
    });

    test('should be accessible to users with disabilities', async () => {
      await adminPages.navigateToAdminDashboard();
      
      await adminPages.verifyAccessibilityFeatures();
    });
  });

  test.describe('Error Handling Journey', () => {
    test('should handle network errors during admin operations', async () => {
      await adminPages.navigateToUserManagement();
      
      // Simulate network failure
      await adminPages.page.route('**/api/admin/**', (route) => {
        route.abort('internetdisconnected');
      });
      
      // Try to perform admin action
      await adminPages.editUser(regularUsers[0].email, {
        email: 'updated@example.com',
        role: 'user'
      });
      
      // Should show network error
      await expect(adminPages.page.locator('.error-message')).toContainText('Network error');
    });

    test('should handle server errors gracefully', async () => {
      await adminPages.navigateToUserManagement();
      
      // Simulate server error
      await adminPages.page.route('**/api/admin/users/*', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });
      
      // Try to edit user
      await adminPages.editUser(regularUsers[0].email, {
        email: 'test@example.com',
        role: 'user'
      });
      
      // Should show server error
      await expect(adminPages.page.locator('.error-message')).toContainText('server error');
    });

    test('should validate admin input data', async () => {
      await adminPages.navigateToUserManagement();
      
      // Try to set invalid email
      await adminPages.editUser(regularUsers[0].email, {
        email: 'invalid-email',
        role: 'user'
      });
      
      // Should show validation error
      await adminPages.verifyUserEditError('Invalid email format');
    });

    test('should handle concurrent admin operations', async ({ context }) => {
      // Create second admin session
      const secondPage = await context.newPage();
      const secondAuthPages = new AuthPages(secondPage);
      const secondAdminPages = new AdminPages(secondPage);
      
      await secondAuthPages.loginAs(adminUser.email, adminUser.password);
      await secondAdminPages.navigateToUserManagement();
      
      // Both sessions try to edit same user
      await adminPages.navigateToUserManagement();
      
      // First session starts edit
      await adminPages.editUser(regularUsers[0].email, {
        email: 'first@example.com',
        role: 'admin'
      });
      
      // Second session tries to edit same user
      await secondAdminPages.editUser(regularUsers[0].email, {
        email: 'second@example.com',
        role: 'user'
      });
      
      // Should handle conflict gracefully
      await expect(secondPage.locator('.warning-message')).toContainText('User is being edited');
      
      await secondPage.close();
    });
  });

  test.describe('Security Journey', () => {
    test('should log out admin after period of inactivity', async () => {
      await adminPages.navigateToAdminDashboard();
      
      // Simulate long inactivity
      await adminPages.simulateInactivity();
      
      // Try to perform admin action
      await adminPages.navigateToUserManagement();
      
      // Should be redirected to login
      await expect(adminPages.page).toHaveURL('/login');
    });

    test('should require confirmation for destructive actions', async () => {
      await adminPages.navigateToUserManagement();
      
      // Try to delete user
      const userRow = adminPages.page.locator('[data-testid="user-row"]').filter({ hasText: regularUsers[0].email });
      await userRow.locator('[data-testid="delete-button"]').click();
      
      // Should show confirmation dialog
      await adminPages.verifyDeleteConfirmation();
    });

    test('should prevent unauthorized API access', async () => {
      // Logout admin
      await authPages.logout();
      
      // Try to access admin API directly
      const response = await adminPages.page.request.get('/api/admin/users');
      
      expect(response.status()).toBe(401); // Unauthorized
    });

    test('should audit sensitive operations', async () => {
      await adminPages.navigateToUserManagement();
      
      // Perform sensitive operation
      await adminPages.deleteUser(regularUsers[0].email, true);
      
      // Check that it's logged
      await adminPages.navigateToActivityLog();
      
      await adminPages.verifyRecentActivity('User deleted');
    });
  });

  test.describe('Complete Admin Workflow Journey', () => {
    test('should demonstrate complete user lifecycle management', async () => {
      await adminPages.navigateToUserManagement();
      
      // View all users
      const initialCount = await adminPages.verifyUsersList();
      
      // Create new user through admin interface
      await adminPages.createNewUser('admin-created@example.com', 'user');
      
      await adminPages.verifyUserCreated();
      
      const afterCreateCount = await adminPages.verifyUsersList();
      expect(afterCreateCount).toBe(initialCount + 1);
      
      // Edit the user
      await adminPages.editUser('admin-created@example.com', {
        email: 'admin-updated@example.com',
        role: 'admin'
      });
      
      await adminPages.verifyUserUpdated();
      
      // Suspend the user
      await adminPages.suspendUser('admin-updated@example.com');
      
      await adminPages.verifyUserSuspended('admin-updated@example.com');
      
      // Finally delete the user
      await adminPages.deleteUser('admin-updated@example.com', true);
      
      await adminPages.verifyUserDeleted();
      
      const finalCount = await adminPages.verifyUsersList();
      expect(finalCount).toBe(initialCount);
    });

    test('should demonstrate complete system monitoring workflow', async () => {
      // Check initial system state
      await adminPages.navigateToSystemStats();
      
      const initialStats = await adminPages.getCurrentStats();
      
      // Monitor system activity
      await adminPages.navigateToActivityLog();
      
      await adminPages.verifyRecentActivity();
      
      // Perform admin action
      await adminPages.navigateToUserManagement();
      await adminPages.promoteUserToAdmin(regularUsers[0].email);
      
      // Verify action was logged
      await adminPages.navigateToActivityLog();
      await adminPages.verifyRecentActivity('User role changed');
      
      // Check updated statistics
      await adminPages.navigateToSystemStats();
      await adminPages.refreshSystemStats();
      
      const updatedStats = await adminPages.getCurrentStats();
      expect(updatedStats).toBeDefined();
    });
  });
});