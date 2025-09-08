import { expect } from '@playwright/test';

/**
 * Page Object Model for Admin Dashboard Pages
 * 
 * This module provides reusable methods for interacting with admin
 * functionality including user management, system statistics,
 * configuration, and administrative workflows.
 * 
 * Usage:
 *   const adminPages = new AdminPages(page);
 *   await adminPages.navigateToUserManagement();
 */

export class AdminPages {
  constructor(page) {
    this.page = page;
  }

  // Navigation methods
  async navigateToAdminDashboard() {
    await this.page.click('[data-testid="admin-menu"]');
    await this.page.click('a[href="/admin"]');
    await expect(this.page).toHaveURL('/admin');
    await expect(this.page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
  }

  async navigateToUserManagement() {
    await this.page.goto('/admin/users');
    await expect(this.page).toHaveURL('/admin/users');
    await expect(this.page.locator('[data-testid="users-list"]')).toBeVisible();
  }

  async navigateToStatistics() {
    await this.page.goto('/admin/statistics');
    await expect(this.page).toHaveURL('/admin/statistics');
    await expect(this.page.locator('[data-testid="stats-overview"]')).toBeVisible();
  }

  async navigateToSettings() {
    await this.page.goto('/admin/settings');
    await expect(this.page).toHaveURL('/admin/settings');
    await expect(this.page.locator('[data-testid="admin-settings"]')).toBeVisible();
  }

  async navigateToAuditLog() {
    await this.page.goto('/admin/audit');
    await expect(this.page).toHaveURL('/admin/audit');
    await expect(this.page.locator('[data-testid="audit-log"]')).toBeVisible();
  }

  // Access control verification methods
  async verifyAdminMenuAccess() {
    await expect(this.page.locator('[data-testid="admin-menu"]')).toBeVisible();
  }

  async verifyAdminMenuNotVisible() {
    await expect(this.page.locator('[data-testid="admin-menu"]')).not.toBeVisible();
  }

  async verifyAdminMenuOptions() {
    await this.page.click('[data-testid="admin-menu"]');
    await expect(this.page.locator('[data-testid="admin-dropdown"]')).toBeVisible();
    await expect(this.page.locator('a[href="/admin"]')).toContainText('Dashboard');
    await expect(this.page.locator('a[href="/admin/users"]')).toContainText('User Management');
    await expect(this.page.locator('a[href="/admin/statistics"]')).toContainText('Statistics');
  }

  async verifyAccessDenied() {
    await expect(this.page).toHaveURL('/home');
    await expect(this.page.locator('.error-message')).toContainText('Access denied');
  }

  // User management methods
  async verifyUsersTable() {
    await expect(this.page.locator('[data-testid="user-table"]')).toBeVisible();
    
    // Verify table headers
    await expect(this.page.locator('[data-testid="user-table"] th')).toContainText('Email');
    await expect(this.page.locator('[data-testid="user-table"] th')).toContainText('Role');
    await expect(this.page.locator('[data-testid="user-table"] th')).toContainText('Created');
    await expect(this.page.locator('[data-testid="user-table"] th')).toContainText('Actions');
    
    return await this.page.locator('[data-testid="user-row"]').count();
  }

  async getUserRowByEmail(email) {
    return this.page.locator('[data-testid="user-row"]').filter({ hasText: email });
  }

  async viewUserDetails(email) {
    const userRow = await this.getUserRowByEmail(email);
    await userRow.click();
    
    await expect(this.page.locator('[data-testid="user-detail-modal"]')).toBeVisible();
    await this.verifyUserDetailModal();
  }

  async verifyUserDetailModal() {
    await expect(this.page.locator('[data-testid="user-email"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="user-role"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="user-created-date"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="user-flashcard-count"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="user-last-login"]')).toBeVisible();
  }

  async closeUserDetailModal() {
    await this.page.press('body', 'Escape');
    await expect(this.page.locator('[data-testid="user-detail-modal"]')).not.toBeVisible();
  }

  // User search and filtering methods
  async searchUsers(searchTerm) {
    await this.page.fill('[data-testid="user-search"]', searchTerm);
    await this.page.waitForTimeout(500); // Allow for search debouncing
  }

  async verifySearchResults(expectedCount, expectedEmail = null) {
    await expect(this.page.locator('[data-testid="user-row"]')).toHaveCount(expectedCount);
    
    if (expectedEmail) {
      await expect(this.page.locator('[data-testid="user-row"]')).toContainText(expectedEmail);
    }
  }

  async clearUserSearch() {
    await this.page.fill('[data-testid="user-search"]', '');
    await this.page.waitForTimeout(500);
  }

  async filterUsersByRole(role) {
    await this.page.selectOption('[data-testid="role-filter"]', role);
    await this.page.waitForTimeout(500);
  }

  async verifyRoleFilter(expectedRole) {
    const userRows = this.page.locator('[data-testid="user-row"]');
    const count = await userRows.count();
    
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(userRows.nth(i).locator('[data-testid="user-role"]')).toContainText(expectedRole);
      }
    }
  }

  // User management actions
  async deleteUser(email, confirm = true) {
    const initialCount = await this.verifyUsersTable();
    const userRow = await this.getUserRowByEmail(email);
    
    await userRow.locator('[data-testid="delete-user-button"]').click();
    await this.verifyDeleteUserConfirmation();
    
    if (confirm) {
      await this.confirmUserDeletion();
      await this.verifyUserDeleted(initialCount, email);
    } else {
      await this.cancelUserDeletion();
      await this.verifyUserDeletionCancelled(initialCount);
    }
  }

  async verifyDeleteUserConfirmation() {
    await expect(this.page.locator('[data-testid="delete-user-confirmation"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="delete-user-confirmation"]')).toContainText('Are you sure you want to delete this user?');
    await expect(this.page.locator('[data-testid="delete-user-confirmation"]')).toContainText('This action cannot be undone');
  }

  async confirmUserDeletion() {
    await this.page.click('[data-testid="confirm-delete-user"]');
  }

  async cancelUserDeletion() {
    await this.page.click('[data-testid="cancel-delete-user"]');
  }

  async verifyUserDeleted(previousCount, email) {
    await expect(this.page.locator('.success-message')).toContainText('User deleted successfully');
    await expect(this.page.locator('[data-testid="user-row"]')).toHaveCount(previousCount - 1);
    await expect(this.page.locator('[data-testid="user-row"]')).not.toContainText(email);
  }

  async verifyUserDeletionCancelled(previousCount) {
    await expect(this.page.locator('[data-testid="user-row"]')).toHaveCount(previousCount);
  }

  async verifyAdminUserProtection(adminEmail) {
    const adminRow = await this.getUserRowByEmail(adminEmail);
    const deleteButton = adminRow.locator('[data-testid="delete-user-button"]');
    
    // Delete button should be disabled or not visible for admin users
    const isDisabled = await deleteButton.isDisabled();
    const isVisible = await deleteButton.isVisible();
    
    expect(isDisabled || !isVisible).toBe(true);
  }

  // User role management
  async editUserRole(email, newRole) {
    const userRow = await this.getUserRowByEmail(email);
    await userRow.locator('[data-testid="edit-user-button"]').click();
    
    await expect(this.page.locator('[data-testid="edit-user-modal"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="user-role-select"]')).toBeVisible();
    
    await this.page.selectOption('[data-testid="user-role-select"]', newRole);
    await this.page.click('[data-testid="save-user-changes"]');
    
    await this.verifyUserRoleUpdated(email, newRole);
  }

  async verifyUserRoleUpdated(email, expectedRole) {
    await expect(this.page.locator('.success-message')).toContainText('User updated successfully');
    const userRow = await this.getUserRowByEmail(email);
    await expect(userRow.locator('[data-testid="user-role"]')).toContainText(expectedRole);
  }

  async cancelUserEdit() {
    await this.page.click('[data-testid="cancel-user-edit"]');
    await expect(this.page.locator('[data-testid="edit-user-modal"]')).not.toBeVisible();
  }

  // Pagination methods
  async verifyPagination() {
    const paginationVisible = await this.page.locator('[data-testid="pagination"]').isVisible();
    
    if (paginationVisible) {
      await expect(this.page.locator('[data-testid="prev-page"]')).toBeVisible();
      await expect(this.page.locator('[data-testid="next-page"]')).toBeVisible();
      await expect(this.page.locator('[data-testid="page-info"]')).toBeVisible();
      return true;
    }
    
    return false;
  }

  async navigateToNextPage() {
    await this.page.click('[data-testid="next-page"]');
    await this.page.waitForTimeout(500);
  }

  async navigateToPreviousPage() {
    await this.page.click('[data-testid="prev-page"]');
    await this.page.waitForTimeout(500);
  }

  // Statistics dashboard methods
  async verifyStatisticsOverview() {
    await expect(this.page.locator('[data-testid="total-users-stat"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="active-users-stat"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="total-flashcards-stat"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="total-reviews-stat"]')).toBeVisible();
  }

  async verifyStatisticsValues() {
    const totalUsers = await this.page.locator('[data-testid="total-users-count"]').textContent();
    const totalUsersCount = parseInt(totalUsers);
    
    expect(totalUsersCount).toBeGreaterThanOrEqual(1); // At least admin user
    return {
      totalUsers: totalUsersCount,
    };
  }

  async verifyActivityCharts() {
    await expect(this.page.locator('[data-testid="activity-charts"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="user-registration-chart"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="review-activity-chart"]')).toBeVisible();
  }

  async verifyTopUsersTable() {
    await expect(this.page.locator('[data-testid="top-users"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="top-users-table"]')).toBeVisible();
    
    // Verify table headers
    await expect(this.page.locator('[data-testid="top-users-table"] th')).toContainText('User');
    await expect(this.page.locator('[data-testid="top-users-table"] th')).toContainText('Reviews');
    await expect(this.page.locator('[data-testid="top-users-table"] th')).toContainText('Cards');
  }

  // Date filtering for statistics
  async openDateRangePicker() {
    await this.page.click('[data-testid="date-range-picker"]');
    await expect(this.page.locator('[data-testid="date-picker-modal"]')).toBeVisible();
  }

  async selectDateRange(range) {
    await this.openDateRangePicker();
    await this.page.click(`[data-testid="${range}"]`);
    await this.page.click('[data-testid="apply-date-filter"]');
    await expect(this.page.locator('[data-testid="date-range-display"]')).toContainText(range.replace('-', ' '));
  }

  // Export functionality
  async exportStatistics(format = 'csv') {
    await this.page.click('[data-testid="export-stats-button"]');
    await expect(this.page.locator('[data-testid="export-modal"]')).toBeVisible();
    
    await this.page.selectOption('[data-testid="export-format"]', format);
    await this.page.click('[data-testid="download-export"]');
    
    await expect(this.page.locator('.success-message')).toContainText('Export started');
  }

  // System settings methods
  async verifySystemSettings() {
    await expect(this.page.locator('[data-testid="system-config"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="max-flashcards-setting"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="session-timeout-setting"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="registration-enabled-setting"]')).toBeVisible();
  }

  async updateSystemSetting(settingName, value) {
    await this.page.fill(`[data-testid="${settingName}"]`, value);
    await this.page.click('[data-testid="save-settings"]');
    
    await expect(this.page.locator('.success-message')).toContainText('Settings updated successfully');
  }

  async verifySystemHealth() {
    await this.page.goto('/admin/health');
    
    await expect(this.page.locator('[data-testid="system-health"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="database-status"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="api-status"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="storage-status"]')).toBeVisible();
    
    // Verify healthy status
    await expect(this.page.locator('[data-testid="database-status"]')).toContainText('Healthy');
  }

  // Audit log methods
  async verifyAuditLog() {
    await expect(this.page.locator('[data-testid="audit-log"]')).toBeVisible();
    
    const auditEntries = this.page.locator('[data-testid="audit-entry"]');
    return await auditEntries.count();
  }

  async verifyAuditEntry(action, adminEmail = 'admin@example.com') {
    const auditEntry = this.page.locator('[data-testid="audit-entry"]').first();
    await expect(auditEntry).toContainText(action);
    await expect(auditEntry).toContainText(adminEmail);
  }

  async filterAuditLog(actionType) {
    await this.page.selectOption('[data-testid="action-filter"]', actionType);
    await this.page.waitForTimeout(500);
  }

  async verifyFilteredAuditEntries(expectedAction) {
    const entries = this.page.locator('[data-testid="audit-entry"]');
    const count = await entries.count();
    
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(entries.nth(i)).toContainText(expectedAction);
      }
    }
  }

  // Performance and UX methods
  async measureDashboardLoadTime() {
    const startTime = Date.now();
    await this.navigateToAdminDashboard();
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    return loadTime;
  }

  async verifyResponsiveDesign() {
    await this.page.setViewportSize({ width: 768, height: 1024 });
    await this.navigateToAdminDashboard();
    
    // Verify responsive layout
    await expect(this.page.locator('[data-testid="admin-sidebar"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="main-content"]')).toBeVisible();
    
    // Verify table responsiveness
    await this.navigateToUserManagement();
    await expect(this.page.locator('[data-testid="user-table"]')).toBeVisible();
  }

  async verifyKeyboardNavigation() {
    await this.navigateToUserManagement();
    
    // Test tab navigation through user actions
    await this.page.press('body', 'Tab');
    await this.page.press('body', 'Tab');
    
    // Verify focus indicators are visible
    const focusedElement = this.page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  }

  // Batch operations and utilities
  async performCompleteUserManagementFlow(testEmail) {
    // View users -> Search -> View details -> Edit role -> Delete
    await this.navigateToUserManagement();
    const initialCount = await this.verifyUsersTable();
    
    await this.searchUsers(testEmail);
    await this.verifySearchResults(1, testEmail);
    
    await this.viewUserDetails(testEmail);
    await this.closeUserDetailModal();
    
    await this.clearUserSearch();
    await this.editUserRole(testEmail, 'user');
    
    await this.deleteUser(testEmail);
    
    return { initialCount, finalCount: initialCount - 1 };
  }

  async verifyCompleteStatisticsDashboard() {
    await this.navigateToStatistics();
    
    await this.verifyStatisticsOverview();
    const stats = await this.verifyStatisticsValues();
    await this.verifyActivityCharts();
    await this.verifyTopUsersTable();
    
    return stats;
  }

  async performSystemConfigurationTest() {
    await this.navigateToSettings();
    await this.verifySystemSettings();
    
    // Test updating a setting
    await this.updateSystemSetting('session-timeout-setting', '3600');
    
    // Verify system health
    await this.verifySystemHealth();
  }

  async verifyAdminWorkflowLogging(action) {
    // Perform an admin action and verify it's logged
    const initialEntryCount = await this.verifyAuditLog();
    
    // The specific action would be performed by the calling test
    // This method just verifies the logging worked
    const finalEntryCount = await this.verifyAuditLog();
    expect(finalEntryCount).toBeGreaterThan(initialEntryCount);
    
    await this.verifyAuditEntry(action);
  }

  // Admin access control helpers
  async attemptAdminAccessAsRegularUser() {
    // Assumes user is already logged in as regular user
    await this.verifyAdminMenuNotVisible();
    
    // Try to access admin routes directly
    await this.page.goto('/admin');
    await this.verifyAccessDenied();
    
    await this.page.goto('/admin/users');
    await this.verifyAccessDenied();
    
    await this.page.goto('/admin/statistics');
    await this.verifyAccessDenied();
  }

  // Data consistency verification
  async verifyDataConsistency() {
    await this.navigateToStatistics();
    const stats = await this.verifyStatisticsValues();
    
    await this.navigateToUserManagement();
    const actualUserCount = await this.verifyUsersTable();
    
    // Statistics should match actual user count
    expect(stats.totalUsers).toBe(actualUserCount);
  }
}

export default AdminPages;