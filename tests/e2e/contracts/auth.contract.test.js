import { test, expect } from '@playwright/test';

/**
 * E2E Contract Test: Authentication Endpoints
 * 
 * This test validates the E2E authentication flow contracts according to
 * the auth-contract.json specification for browser-based interactions.
 * 
 * CRITICAL: This test MUST FAIL initially (TDD requirement)
 * These tests verify the complete authentication user journey including
 * browser state management, form interactions, and navigation flows.
 */

test.describe('E2E Authentication Contract Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test.describe('User Registration Flow', () => {
    test('should complete user registration journey', async ({ page }) => {
      // Navigate to registration page
      await page.click('a[href="/register"]');
      await expect(page).toHaveURL('/register');

      // Fill registration form
      await page.fill('input[name="email"]', 'e2etest@example.com');
      await page.fill('input[name="password"]', 'testpassword123');
      await page.fill('input[name="confirmPassword"]', 'testpassword123');

      // Submit registration
      await page.click('button[type="submit"]');

      // Verify successful registration
      await expect(page).toHaveURL('/login');
      await expect(page.locator('.success-message')).toContainText('Registration successful');
    });

    test('should handle registration validation errors', async ({ page }) => {
      await page.click('a[href="/register"]');

      // Submit form with invalid email
      await page.fill('input[name="email"]', 'invalid-email');
      await page.fill('input[name="password"]', 'pass');
      await page.click('button[type="submit"]');

      // Verify validation errors are displayed
      await expect(page.locator('.error-message')).toContainText('Invalid email format');
      await expect(page.locator('.error-message')).toContainText('Password must be at least 6 characters');
    });

    test('should handle duplicate email registration', async ({ page }) => {
      await page.click('a[href="/register"]');

      // Try to register with existing email
      await page.fill('input[name="email"]', 'admin@example.com'); // Admin user from fixtures
      await page.fill('input[name="password"]', 'newpassword123');
      await page.fill('input[name="confirmPassword"]', 'newpassword123');
      await page.click('button[type="submit"]');

      // Verify duplicate email error
      await expect(page.locator('.error-message')).toContainText('Email already exists');
      await expect(page).toHaveURL('/register');
    });
  });

  test.describe('User Login Flow', () => {
    test('should complete successful login journey', async ({ page }) => {
      // Navigate to login page
      await page.click('a[href="/login"]');
      await expect(page).toHaveURL('/login');

      // Fill login form with valid credentials
      await page.fill('input[name="email"]', 'testuser@example.com');
      await page.fill('input[name="password"]', 'password123');

      // Submit login
      await page.click('button[type="submit"]');

      // Verify successful login - redirected to home/dashboard
      await expect(page).toHaveURL('/home');
      await expect(page.locator('[data-testid="user-profile"]')).toContainText('testuser@example.com');

      // Verify authentication state in localStorage
      const authToken = await page.evaluate(() => localStorage.getItem('authToken'));
      expect(authToken).toBeTruthy();
    });

    test('should handle invalid credentials', async ({ page }) => {
      await page.click('a[href="/login"]');

      // Submit with invalid credentials
      await page.fill('input[name="email"]', 'nonexistent@example.com');
      await page.fill('input[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');

      // Verify error message
      await expect(page.locator('.error-message')).toContainText('Invalid credentials');
      await expect(page).toHaveURL('/login');

      // Verify no authentication token stored
      const authToken = await page.evaluate(() => localStorage.getItem('authToken'));
      expect(authToken).toBeFalsy();
    });

    test('should accept case-insensitive email', async ({ page }) => {
      await page.click('a[href="/login"]');

      // Login with uppercase email
      await page.fill('input[name="email"]', 'TESTUSER@EXAMPLE.COM');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Verify successful login
      await expect(page).toHaveURL('/home');
      await expect(page.locator('[data-testid="user-profile"]')).toContainText('testuser@example.com');
    });
  });

  test.describe('Authentication State Management', () => {
    test('should maintain authentication across page refreshes', async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.fill('input[name="email"]', 'testuser@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/home');

      // Refresh page
      await page.reload();

      // Verify still authenticated
      await expect(page).toHaveURL('/home');
      await expect(page.locator('[data-testid="user-profile"]')).toContainText('testuser@example.com');
    });

    test('should handle token refresh automatically', async ({ page }) => {
      // Login and wait for potential token refresh
      await page.goto('/login');
      await page.fill('input[name="email"]', 'testuser@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to a protected route after some time
      await page.waitForTimeout(1000); // Simulate time passing
      await page.goto('/home');

      // Verify still authenticated (token should refresh automatically)
      await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
    });

    test('should redirect to login when token expires', async ({ page }) => {
      // This test simulates expired token scenario
      // Set an invalid/expired token in localStorage
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.setItem('authToken', 'invalid.expired.token');
      });

      // Try to access protected route
      await page.goto('/home');

      // Should be redirected to login
      await expect(page).toHaveURL('/login');
      await expect(page.locator('.error-message')).toContainText('Session expired');
    });
  });

  test.describe('Logout Flow', () => {
    test('should complete logout journey', async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.fill('input[name="email"]', 'testuser@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/home');

      // Logout
      await page.click('[data-testid="logout-button"]');

      // Verify logged out state
      await expect(page).toHaveURL('/');
      await expect(page.locator('a[href="/login"]')).toBeVisible();

      // Verify token cleared
      const authToken = await page.evaluate(() => localStorage.getItem('authToken'));
      expect(authToken).toBeFalsy();
    });

    test('should prevent access to protected routes after logout', async ({ page }) => {
      // Login and logout
      await page.goto('/login');
      await page.fill('input[name="email"]', 'testuser@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.click('[data-testid="logout-button"]');

      // Try to access protected route
      await page.goto('/home');

      // Should be redirected to login
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Admin Authentication', () => {
    test('should authenticate admin user with elevated access', async ({ page }) => {
      await page.goto('/login');
      
      // Login as admin
      await page.fill('input[name="email"]', 'admin@example.com');
      await page.fill('input[name="password"]', 'adminpass');
      await page.click('button[type="submit"]');

      // Verify admin access
      await expect(page).toHaveURL('/home');
      await expect(page.locator('[data-testid="admin-menu"]')).toBeVisible();
      
      // Verify can access admin dashboard
      await page.click('[data-testid="admin-menu"]');
      await page.click('a[href="/admin"]');
      await expect(page).toHaveURL('/admin');
      await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
    });

    test('should restrict admin routes for regular users', async ({ page }) => {
      // Login as regular user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'testuser@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Try to access admin route
      await page.goto('/admin');

      // Should be forbidden or redirected
      await expect(page).toHaveURL('/home'); // Redirected to home
      await expect(page.locator('.error-message')).toContainText('Access denied');
    });
  });

  test.describe('Form Validation and UX', () => {
    test('should show real-time validation feedback', async ({ page }) => {
      await page.goto('/register');

      // Test email validation
      await page.fill('input[name="email"]', 'invalid');
      await page.blur('input[name="email"]');
      await expect(page.locator('.field-error')).toContainText('Invalid email');

      // Test password strength
      await page.fill('input[name="password"]', '123');
      await page.blur('input[name="password"]');
      await expect(page.locator('.field-error')).toContainText('Password too weak');
    });

    test('should handle form submission loading states', async ({ page }) => {
      await page.goto('/login');

      await page.fill('input[name="email"]', 'testuser@example.com');
      await page.fill('input[name="password"]', 'password123');

      // Click submit and verify loading state
      await page.click('button[type="submit"]');
      await expect(page.locator('button[type="submit"]')).toContainText('Signing in...');
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
    });

    test('should support keyboard navigation', async ({ page }) => {
      await page.goto('/login');

      // Tab through form elements
      await page.press('body', 'Tab'); // Focus email field
      await page.keyboard.type('testuser@example.com');
      
      await page.press('body', 'Tab'); // Focus password field
      await page.keyboard.type('password123');
      
      await page.press('body', 'Tab'); // Focus submit button
      await page.press('body', 'Enter'); // Submit form

      // Verify form submitted
      await expect(page).toHaveURL('/home');
    });
  });
});