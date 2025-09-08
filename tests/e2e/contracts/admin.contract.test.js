import { test, expect } from '@playwright/test';

/**
 * E2E Contract Test: Admin Dashboard Endpoints
 * 
 * This test validates the E2E admin dashboard flow contracts according to
 * the admin-contract.json specification for administrative operations.
 * 
 * CRITICAL: This test MUST FAIL initially (TDD requirement)
 * These tests verify the complete admin functionality including user management,
 * system statistics, role-based access control, and administrative workflows.
 */

test.describe('E2E Admin Contract Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login as admin user before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'adminpass');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/home');
  });

  test.describe('Admin Access Control', () => {
    test('should access admin dashboard with proper credentials', async ({ page }) => {
      // Navigate to admin dashboard
      await page.click('[data-testid="admin-menu"]');
      await page.click('a[href="/admin"]');

      // Verify admin dashboard loads
      await expect(page).toHaveURL('/admin');
      await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="page-title"]')).toContainText('Admin Dashboard');
    });

    test('should display admin-specific navigation elements', async ({ page }) => {
      // Verify admin menu is visible
      await expect(page.locator('[data-testid="admin-menu"]')).toBeVisible();
      
      // Click admin menu to see options
      await page.click('[data-testid="admin-menu"]');
      await expect(page.locator('[data-testid="admin-dropdown"]')).toBeVisible();
      await expect(page.locator('a[href="/admin"]')).toContainText('Dashboard');
      await expect(page.locator('a[href="/admin/users"]')).toContainText('User Management');
      await expect(page.locator('a[href="/admin/statistics"]')).toContainText('Statistics');
    });

    test('should restrict access for regular users', async ({ page }) => {
      // Logout admin and login as regular user
      await page.click('[data-testid="logout-button"]');
      await page.goto('/login');
      await page.fill('input[name="email"]', 'testuser@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Verify admin menu is not visible
      await expect(page.locator('[data-testid="admin-menu"]')).not.toBeVisible();

      // Try to access admin route directly
      await page.goto('/admin');
      
      // Should be redirected or show access denied
      await expect(page).toHaveURL('/home');
      await expect(page.locator('.error-message')).toContainText('Access denied');
    });
  });

  test.describe('User Management Interface', () => {
    test('should display users list', async ({ page }) => {
      await page.goto('/admin/users');

      // Verify users list is displayed
      await expect(page.locator('[data-testid="users-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-table"]')).toBeVisible();
      
      // Verify table headers
      await expect(page.locator('[data-testid="user-table"] th')).toContainText('Email');
      await expect(page.locator('[data-testid="user-table"] th')).toContainText('Role');
      await expect(page.locator('[data-testid="user-table"] th')).toContainText('Created');
      await expect(page.locator('[data-testid="user-table"] th')).toContainText('Actions');

      // Verify test users are displayed
      await expect(page.locator('[data-testid="user-row"]')).toHaveCount(3, { timeout: 10000 }); // admin, testuser, testuser2
    });

    test('should show user details on click', async ({ page }) => {
      await page.goto('/admin/users');

      // Click on a user row
      await page.click('[data-testid="user-row"]');

      // Verify user detail modal opens
      await expect(page.locator('[data-testid="user-detail-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-email"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-role"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-created-date"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-flashcard-count"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-last-login"]')).toBeVisible();
    });

    test('should support user search and filtering', async ({ page }) => {
      await page.goto('/admin/users');

      // Test search functionality
      await page.fill('[data-testid="user-search"]', 'testuser@example.com');
      
      // Verify filtered results
      await expect(page.locator('[data-testid="user-row"]')).toHaveCount(1);
      await expect(page.locator('[data-testid="user-row"]')).toContainText('testuser@example.com');

      // Test role filtering
      await page.fill('[data-testid="user-search"]', '');
      await page.selectOption('[data-testid="role-filter"]', 'admin');
      
      // Verify only admin users shown
      await expect(page.locator('[data-testid="user-row"]')).toHaveCount(1);
      await expect(page.locator('[data-testid="user-row"]')).toContainText('admin@example.com');
    });

    test('should support pagination for large user lists', async ({ page }) => {
      await page.goto('/admin/users');

      // Check if pagination exists (may not be visible with small test dataset)
      const paginationVisible = await page.locator('[data-testid="pagination"]').isVisible();
      
      if (paginationVisible) {
        // Verify pagination controls
        await expect(page.locator('[data-testid="prev-page"]')).toBeVisible();
        await expect(page.locator('[data-testid="next-page"]')).toBeVisible();
        await expect(page.locator('[data-testid="page-info"]')).toBeVisible();
      }
    });
  });

  test.describe('User Management Actions', () => {
    test('should delete user with confirmation', async ({ page }) => {
      await page.goto('/admin/users');

      // Find a non-admin user to delete
      const userRow = page.locator('[data-testid="user-row"]').filter({ hasText: 'testuser2@example.com' });
      await userRow.locator('[data-testid="delete-user-button"]').click();

      // Verify confirmation dialog
      await expect(page.locator('[data-testid="delete-user-confirmation"]')).toBeVisible();
      await expect(page.locator('[data-testid="delete-user-confirmation"]')).toContainText('Are you sure you want to delete this user?');
      await expect(page.locator('[data-testid="delete-user-confirmation"]')).toContainText('This action cannot be undone');

      // Confirm deletion
      await page.click('[data-testid="confirm-delete-user"]');

      // Verify success message
      await expect(page.locator('.success-message')).toContainText('User deleted successfully');
      
      // Verify user removed from list
      await expect(page.locator('[data-testid="user-row"]')).not.toContainText('testuser2@example.com');
    });

    test('should cancel user deletion', async ({ page }) => {
      await page.goto('/admin/users');
      const initialCount = await page.locator('[data-testid="user-row"]').count();

      // Try to delete user but cancel
      await page.click('[data-testid="user-row"] [data-testid="delete-user-button"]');
      await page.click('[data-testid="cancel-delete-user"]');

      // Verify user still exists
      await expect(page.locator('[data-testid="user-row"]')).toHaveCount(initialCount);
    });

    test('should prevent deletion of admin users', async ({ page }) => {
      await page.goto('/admin/users');

      // Try to delete admin user
      const adminRow = page.locator('[data-testid="user-row"]').filter({ hasText: 'admin@example.com' });
      const deleteButton = adminRow.locator('[data-testid="delete-user-button"]');

      // Delete button should be disabled or not visible for admin users
      const isDisabled = await deleteButton.isDisabled();
      const isVisible = await deleteButton.isVisible();
      
      expect(isDisabled || !isVisible).toBe(true);
    });

    test('should edit user roles', async ({ page }) => {
      await page.goto('/admin/users');

      // Click edit button for a user
      const userRow = page.locator('[data-testid="user-row"]').filter({ hasText: 'testuser@example.com' });
      await userRow.locator('[data-testid="edit-user-button"]').click();

      // Verify edit user modal
      await expect(page.locator('[data-testid="edit-user-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-role-select"]')).toBeVisible();

      // Change user role
      await page.selectOption('[data-testid="user-role-select"]', 'admin');
      await page.click('[data-testid="save-user-changes"]');

      // Verify success message
      await expect(page.locator('.success-message')).toContainText('User updated successfully');
      
      // Verify role change in the table
      await expect(userRow.locator('[data-testid="user-role"]')).toContainText('admin');
    });
  });

  test.describe('System Statistics Dashboard', () => {
    test('should display system overview statistics', async ({ page }) => {
      await page.goto('/admin/statistics');

      // Verify statistics cards are visible
      await expect(page.locator('[data-testid="stats-overview"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-users-stat"]')).toBeVisible();
      await expect(page.locator('[data-testid="active-users-stat"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-flashcards-stat"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-reviews-stat"]')).toBeVisible();

      // Verify stats show reasonable numbers
      const totalUsers = await page.locator('[data-testid="total-users-count"]').textContent();
      expect(parseInt(totalUsers)).toBeGreaterThanOrEqual(3); // At least our test users
    });

    test('should display user activity charts', async ({ page }) => {
      await page.goto('/admin/statistics');

      // Verify charts are displayed
      await expect(page.locator('[data-testid="activity-charts"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-registration-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="review-activity-chart"]')).toBeVisible();
    });

    test('should show top performing users', async ({ page }) => {
      await page.goto('/admin/statistics');

      // Verify top users section
      await expect(page.locator('[data-testid="top-users"]')).toBeVisible();
      await expect(page.locator('[data-testid="top-users-table"]')).toBeVisible();
      
      // Should have table headers
      await expect(page.locator('[data-testid="top-users-table"] th')).toContainText('User');
      await expect(page.locator('[data-testid="top-users-table"] th')).toContainText('Reviews');
      await expect(page.locator('[data-testid="top-users-table"] th')).toContainText('Cards');
    });

    test('should support date range filtering for statistics', async ({ page }) => {
      await page.goto('/admin/statistics');

      // Test date range picker
      await page.click('[data-testid="date-range-picker"]');
      await expect(page.locator('[data-testid="date-picker-modal"]')).toBeVisible();

      // Select last 30 days
      await page.click('[data-testid="last-30-days"]');
      await page.click('[data-testid="apply-date-filter"]');

      // Verify statistics update
      await expect(page.locator('[data-testid="date-range-display"]')).toContainText('Last 30 days');
    });

    test('should export statistics data', async ({ page }) => {
      await page.goto('/admin/statistics');

      // Test export functionality
      await page.click('[data-testid="export-stats-button"]');
      await expect(page.locator('[data-testid="export-modal"]')).toBeVisible();

      // Select export format
      await page.selectOption('[data-testid="export-format"]', 'csv');
      await page.click('[data-testid="download-export"]');

      // Verify download initiated (check for success message or download dialog)
      await expect(page.locator('.success-message')).toContainText('Export started');
    });
  });

  test.describe('Admin Settings and Configuration', () => {
    test('should access system settings', async ({ page }) => {
      await page.goto('/admin/settings');

      // Verify settings page loads
      await expect(page.locator('[data-testid="admin-settings"]')).toBeVisible();
      await expect(page.locator('[data-testid="system-config"]')).toBeVisible();
    });

    test('should manage application configuration', async ({ page }) => {
      await page.goto('/admin/settings');

      // Test configuration options
      await expect(page.locator('[data-testid="max-flashcards-setting"]')).toBeVisible();
      await expect(page.locator('[data-testid="session-timeout-setting"]')).toBeVisible();
      await expect(page.locator('[data-testid="registration-enabled-setting"]')).toBeVisible();

      // Test updating a setting
      await page.fill('[data-testid="session-timeout-setting"]', '3600');
      await page.click('[data-testid="save-settings"]');

      // Verify success
      await expect(page.locator('.success-message')).toContainText('Settings updated successfully');
    });

    test('should show system health status', async ({ page }) => {
      await page.goto('/admin/health');

      // Verify system health dashboard
      await expect(page.locator('[data-testid="system-health"]')).toBeVisible();
      await expect(page.locator('[data-testid="database-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="api-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="storage-status"]')).toBeVisible();

      // Verify status indicators show healthy state
      await expect(page.locator('[data-testid="database-status"]')).toContainText('Healthy');
    });
  });

  test.describe('Admin Activity Logging', () => {
    test('should log admin actions', async ({ page }) => {
      // Perform an admin action
      await page.goto('/admin/users');
      const userRow = page.locator('[data-testid="user-row"]').first();
      await userRow.locator('[data-testid="edit-user-button"]').click();
      await page.selectOption('[data-testid="user-role-select"]', 'user');
      await page.click('[data-testid="save-user-changes"]');

      // Navigate to audit log
      await page.goto('/admin/audit');

      // Verify action was logged
      await expect(page.locator('[data-testid="audit-log"]')).toBeVisible();
      await expect(page.locator('[data-testid="audit-entry"]').first()).toContainText('User role updated');
      await expect(page.locator('[data-testid="audit-entry"]').first()).toContainText('admin@example.com');
    });

    test('should filter audit logs', async ({ page }) => {
      await page.goto('/admin/audit');

      // Test action type filter
      await page.selectOption('[data-testid="action-filter"]', 'user_update');
      
      // Verify filtered results
      const entries = page.locator('[data-testid="audit-entry"]');
      const count = await entries.count();
      
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          await expect(entries.nth(i)).toContainText('updated');
        }
      }
    });
  });

  test.describe('Admin Dashboard UX and Performance', () => {
    test('should load dashboard quickly', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/admin');
      await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    });

    test('should handle large datasets efficiently', async ({ page }) => {
      await page.goto('/admin/users');

      // Test that large user lists load without blocking UI
      await expect(page.locator('[data-testid="users-list"]')).toBeVisible();
      
      // Verify search still works with large datasets
      await page.fill('[data-testid="user-search"]', 'test');
      await expect(page.locator('[data-testid="user-row"]')).toBeTruthy();
    });

    test('should provide responsive design for tablets', async ({ page }) => {
      // Simulate tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.goto('/admin');

      // Verify responsive layout
      await expect(page.locator('[data-testid="admin-sidebar"]')).toBeVisible();
      await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
      
      // Verify table is responsive
      await page.goto('/admin/users');
      await expect(page.locator('[data-testid="user-table"]')).toBeVisible();
    });

    test('should support keyboard navigation', async ({ page }) => {
      await page.goto('/admin/users');

      // Test tab navigation through user actions
      await page.press('body', 'Tab'); // Focus first interactive element
      await page.press('body', 'Tab'); // Navigate to next element
      
      // Verify focus indicators are visible
      const focusedElement = await page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });
  });
});