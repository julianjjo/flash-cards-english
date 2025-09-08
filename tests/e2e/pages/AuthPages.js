import { expect } from '@playwright/test';

/**
 * Page Object Model for Authentication Pages
 * 
 * This module provides reusable methods for interacting with authentication
 * related pages including login, registration, and user profile management.
 * 
 * Usage:
 *   const authPages = new AuthPages(page);
 *   await authPages.loginAs('user@example.com', 'password');
 */

export class AuthPages {
  constructor(page) {
    this.page = page;
  }

  // Page navigation methods
  async navigateToLogin() {
    await this.page.goto('/login');
    await expect(this.page).toHaveURL('/login');
  }

  async navigateToRegister() {
    await this.page.goto('/register');
    await expect(this.page).toHaveURL('/register');
  }

  // Login page interactions
  async loginAs(email, password) {
    await this.navigateToLogin();
    await this.fillLoginForm(email, password);
    await this.submitLoginForm();
    
    // Wait for successful login redirect
    await expect(this.page).toHaveURL('/home');
    await this.verifyUserAuthenticated(email);
  }

  async fillLoginForm(email, password) {
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
  }

  async submitLoginForm() {
    await this.page.click('button[type="submit"]');
  }

  async verifyLoginError(expectedError) {
    await expect(this.page.locator('.error-message')).toContainText(expectedError);
  }

  async verifyLoginLoadingState() {
    await expect(this.page.locator('button[type="submit"]')).toContainText('Signing in...');
    await expect(this.page.locator('button[type="submit"]')).toBeDisabled();
  }

  // Registration page interactions
  async registerUser(email, password, confirmPassword = null) {
    await this.navigateToRegister();
    await this.fillRegistrationForm(email, password, confirmPassword || password);
    await this.submitRegistrationForm();
  }

  async fillRegistrationForm(email, password, confirmPassword) {
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    if (await this.page.locator('input[name="confirmPassword"]').isVisible()) {
      await this.page.fill('input[name="confirmPassword"]', confirmPassword);
    }
  }

  async submitRegistrationForm() {
    await this.page.click('button[type="submit"]');
  }

  async verifyRegistrationSuccess() {
    await expect(this.page).toHaveURL('/login');
    await expect(this.page.locator('.success-message')).toContainText('Registration successful');
  }

  async verifyRegistrationError(expectedError) {
    await expect(this.page.locator('.error-message')).toContainText(expectedError);
  }

  async verifyValidationError(field, expectedError) {
    const fieldError = this.page.locator(`input[name="${field}"] + .field-error, .field-error:has-text("${expectedError}")`);
    await expect(fieldError).toContainText(expectedError);
  }

  // Authentication state management
  async verifyUserAuthenticated(expectedEmail = null) {
    // Verify authentication token exists
    const authToken = await this.page.evaluate(() => localStorage.getItem('authToken'));
    expect(authToken).toBeTruthy();

    // Verify user profile displays
    await expect(this.page.locator('[data-testid="user-profile"]')).toBeVisible();
    
    if (expectedEmail) {
      await expect(this.page.locator('[data-testid="user-profile"]')).toContainText(expectedEmail);
    }
  }

  async verifyUserNotAuthenticated() {
    // Verify no authentication token
    const authToken = await this.page.evaluate(() => localStorage.getItem('authToken'));
    expect(authToken).toBeFalsy();

    // Verify login link is visible
    await expect(this.page.locator('a[href="/login"]')).toBeVisible();
  }

  async verifyAdminUser() {
    await this.verifyUserAuthenticated();
    await expect(this.page.locator('[data-testid="admin-menu"]')).toBeVisible();
  }

  async verifyRegularUser() {
    await this.verifyUserAuthenticated();
    await expect(this.page.locator('[data-testid="admin-menu"]')).not.toBeVisible();
  }

  // Logout functionality
  async logout() {
    await this.page.click('[data-testid="logout-button"]');
    await expect(this.page).toHaveURL('/');
    await this.verifyUserNotAuthenticated();
  }

  // Session management
  async verifySessionPersistence() {
    await this.page.reload();
    await expect(this.page).toHaveURL('/home');
    await this.verifyUserAuthenticated();
  }

  async simulateTokenExpiration() {
    await this.page.evaluate(() => {
      localStorage.setItem('authToken', 'invalid.expired.token');
    });
  }

  async verifyTokenRefresh() {
    // Wait for automatic token refresh
    await this.page.waitForTimeout(1000);
    
    // Try to access a protected route
    await this.page.goto('/home');
    
    // Should either be authenticated or redirected to login
    const currentUrl = this.page.url();
    if (currentUrl.includes('/login')) {
      await this.verifyUserNotAuthenticated();
    } else {
      await this.verifyUserAuthenticated();
    }
  }

  // Form validation helpers
  async testEmailValidation(invalidEmail, expectedError) {
    await this.navigateToRegister();
    await this.page.fill('input[name="email"]', invalidEmail);
    await this.page.blur('input[name="email"]');
    await this.verifyValidationError('email', expectedError);
  }

  async testPasswordStrength(weakPassword, expectedError) {
    await this.navigateToRegister();
    await this.page.fill('input[name="password"]', weakPassword);
    await this.page.blur('input[name="password"]');
    await this.verifyValidationError('password', expectedError);
  }

  async testPasswordConfirmationMismatch() {
    await this.navigateToRegister();
    await this.page.fill('input[name="password"]', 'password123');
    await this.page.fill('input[name="confirmPassword"]', 'different123');
    await this.page.blur('input[name="confirmPassword"]');
    await this.verifyValidationError('confirmPassword', 'Passwords do not match');
  }

  // Keyboard navigation helpers
  async loginUsingKeyboard(email, password) {
    await this.navigateToLogin();
    
    // Tab to email field and type
    await this.page.press('body', 'Tab');
    await this.page.keyboard.type(email);
    
    // Tab to password field and type
    await this.page.press('body', 'Tab');
    await this.page.keyboard.type(password);
    
    // Tab to submit button and press Enter
    await this.page.press('body', 'Tab');
    await this.page.press('body', 'Enter');
    
    await expect(this.page).toHaveURL('/home');
  }

  // Case sensitivity helpers
  async testEmailCaseInsensitivity(email, password) {
    await this.loginAs(email.toUpperCase(), password);
    await this.verifyUserAuthenticated(email.toLowerCase());
  }

  // Security testing helpers
  async testInvalidCredentials(email, password) {
    await this.navigateToLogin();
    await this.fillLoginForm(email, password);
    await this.submitLoginForm();
    await this.verifyLoginError('Invalid credentials');
    await expect(this.page).toHaveURL('/login');
    await this.verifyUserNotAuthenticated();
  }

  async testAccountLockout() {
    // Attempt multiple failed logins to test rate limiting
    const invalidCredentials = [
      { email: 'test@example.com', password: 'wrong1' },
      { email: 'test@example.com', password: 'wrong2' },
      { email: 'test@example.com', password: 'wrong3' },
      { email: 'test@example.com', password: 'wrong4' },
      { email: 'test@example.com', password: 'wrong5' },
    ];

    for (const { email, password } of invalidCredentials) {
      await this.testInvalidCredentials(email, password);
      await this.page.waitForTimeout(100); // Brief pause between attempts
    }

    // Next attempt should show rate limiting
    await this.navigateToLogin();
    await this.fillLoginForm('test@example.com', 'wrong6');
    await this.submitLoginForm();
    await this.verifyLoginError('Too many failed attempts');
  }

  // Mobile and responsive helpers
  async verifyMobileLayout() {
    await this.page.setViewportSize({ width: 375, height: 667 });
    await this.navigateToLogin();
    
    // Verify mobile-friendly form layout
    await expect(this.page.locator('input[name="email"]')).toBeVisible();
    await expect(this.page.locator('input[name="password"]')).toBeVisible();
    await expect(this.page.locator('button[type="submit"]')).toHaveCSS('min-height', '44px');
  }

  // Accessibility helpers
  async verifyAccessibilityFeatures() {
    await this.navigateToLogin();
    
    // Verify form labels and ARIA attributes
    await expect(this.page.locator('label[for="email"], input[name="email"][aria-label]')).toBeVisible();
    await expect(this.page.locator('label[for="password"], input[name="password"][aria-label]')).toBeVisible();
    
    // Verify button has proper role
    await expect(this.page.locator('button[type="submit"]')).toHaveAttribute('role', 'button');
  }

  // Common user login shortcuts
  async loginAsTestUser() {
    await this.loginAs('testuser@example.com', 'password123');
  }

  async loginAsSecondUser() {
    await this.loginAs('testuser2@example.com', 'password123');
  }

  async loginAsAdmin() {
    await this.loginAs('admin@example.com', 'adminpass');
  }

  // Navigation after authentication
  async navigateToHome() {
    await this.page.goto('/home');
    await expect(this.page).toHaveURL('/home');
  }

  async navigateToAdmin() {
    await this.page.click('[data-testid="admin-menu"]');
    await this.page.click('a[href="/admin"]');
    await expect(this.page).toHaveURL('/admin');
  }

  async verifyAccessDenied() {
    await expect(this.page).toHaveURL('/home'); // Redirected back
    await expect(this.page.locator('.error-message')).toContainText('Access denied');
  }

  // Utility methods for common test patterns
  async performCompleteLoginFlow(userType = 'regular') {
    switch (userType) {
      case 'admin':
        await this.loginAsAdmin();
        await this.verifyAdminUser();
        break;
      case 'second':
        await this.loginAsSecondUser();
        await this.verifyRegularUser();
        break;
      default:
        await this.loginAsTestUser();
        await this.verifyRegularUser();
    }
  }

  async performCompleteLogoutFlow() {
    await this.verifyUserAuthenticated();
    await this.logout();
    
    // Verify protected routes are inaccessible
    await this.page.goto('/home');
    await expect(this.page).toHaveURL('/login');
  }
}

export default AuthPages;