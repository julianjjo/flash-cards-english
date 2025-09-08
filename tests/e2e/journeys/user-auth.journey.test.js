import { test, expect } from '@playwright/test';
import { AuthPages } from '../pages/AuthPages.js';
import { FlashcardPages } from '../pages/FlashcardPages.js';
import { setupTestEnvironment, teardownTestEnvironment, cleanupTestData } from '../utils/databaseHelpers.js';
import { generateTestEmail, generateTestPassword, TIMEOUTS } from '../utils/testUtils.js';

/**
 * User Authentication Journey Tests
 * 
 * These tests verify complete user authentication workflows including:
 * - User registration with validation
 * - Login and logout flows
 * - Session persistence and token management
 * - Password validation and security
 * - Mobile and accessibility compliance
 */

test.describe('User Authentication Journey', () => {
  let authPages;
  let flashcardPages;

  test.beforeAll(async () => {
    await setupTestEnvironment();
  });

  test.afterAll(async () => {
    await teardownTestEnvironment();
  });

  test.beforeEach(async ({ page }) => {
    authPages = new AuthPages(page);
    flashcardPages = new FlashcardPages(page);
  });

  test.afterEach(async () => {
    // Clean up any test users created during the test
    await cleanupTestData();
  });

  test.describe('Complete Registration Journey', () => {
    test('should successfully register new user and redirect to login', async () => {
      const email = generateTestEmail('registration');
      const password = generateTestPassword();

      // Navigate to registration page
      await authPages.navigateToRegister();
      
      // Fill registration form
      await authPages.fillRegistrationForm(email, password, password);
      
      // Submit registration
      await authPages.submitRegistrationForm();
      
      // Verify successful registration
      await authPages.verifyRegistrationSuccess();
      
      // Should be redirected to login page
      await expect(authPages.page).toHaveURL('/login');
    });

    test('should validate email format during registration', async () => {
      await authPages.navigateToRegister();
      
      // Test invalid email formats
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test..test@example.com',
        'test@example'
      ];
      
      for (const invalidEmail of invalidEmails) {
        await authPages.testEmailValidation(invalidEmail, 'Please enter a valid email address');
      }
    });

    test('should validate password strength during registration', async () => {
      await authPages.navigateToRegister();
      
      // Test weak passwords
      const weakPasswords = [
        '123',
        'password',
        'abc',
        '12345678'
      ];
      
      for (const weakPassword of weakPasswords) {
        await authPages.testPasswordStrength(weakPassword, 'Password must be at least 8 characters');
      }
    });

    test('should validate password confirmation match', async () => {
      await authPages.testPasswordConfirmationMismatch();
    });

    test('should prevent duplicate email registration', async () => {
      const email = generateTestEmail('duplicate');
      const password = generateTestPassword();
      
      // Register user first time
      await authPages.registerUser(email, password);
      await authPages.verifyRegistrationSuccess();
      
      // Try to register same email again
      await authPages.registerUser(email, password);
      await authPages.verifyRegistrationError('Email already exists');
    });
  });

  test.describe('Complete Login Journey', () => {
    test('should successfully login registered user and access protected content', async () => {
      const email = generateTestEmail('login');
      const password = generateTestPassword();
      
      // Register user first
      await authPages.registerUser(email, password);
      await authPages.verifyRegistrationSuccess();
      
      // Now login
      await authPages.loginAs(email, password);
      
      // Verify authenticated state
      await authPages.verifyUserAuthenticated(email);
      
      // Verify access to protected flashcard page
      await flashcardPages.navigateToFlashcards();
      await expect(flashcardPages.page.locator('[data-testid="flashcard-list"]')).toBeVisible();
    });

    test('should reject invalid credentials', async () => {
      await authPages.testInvalidCredentials('nonexistent@example.com', 'wrongpassword');
    });

    test('should handle case insensitive email login', async () => {
      const email = generateTestEmail('case').toLowerCase();
      const password = generateTestPassword();
      
      // Register with lowercase email
      await authPages.registerUser(email, password);
      await authPages.verifyRegistrationSuccess();
      
      // Login with uppercase email
      await authPages.testEmailCaseInsensitivity(email, password);
    });

    test('should show loading state during login', async () => {
      const email = generateTestEmail('loading');
      const password = generateTestPassword();
      
      // Register user first
      await authPages.registerUser(email, password);
      await authPages.verifyRegistrationSuccess();
      
      // Navigate to login and fill form
      await authPages.navigateToLogin();
      await authPages.fillLoginForm(email, password);
      
      // Click submit and immediately check loading state
      await authPages.page.click('button[type="submit"]');
      await authPages.verifyLoginLoadingState();
    });
  });

  test.describe('Session Management Journey', () => {
    test('should persist authentication across page reloads', async () => {
      const email = generateTestEmail('session');
      const password = generateTestPassword();
      
      // Register and login
      await authPages.registerUser(email, password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(email, password);
      
      // Verify session persistence
      await authPages.verifySessionPersistence();
    });

    test('should handle token expiration gracefully', async () => {
      const email = generateTestEmail('token');
      const password = generateTestPassword();
      
      // Register and login
      await authPages.registerUser(email, password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(email, password);
      
      // Simulate token expiration
      await authPages.simulateTokenExpiration();
      
      // Verify token refresh behavior
      await authPages.verifyTokenRefresh();
    });

    test('should redirect unauthenticated users to login', async () => {
      // Try to access protected route without authentication
      await authPages.page.goto('/home');
      
      // Should be redirected to login
      await expect(authPages.page).toHaveURL('/login');
      await authPages.verifyUserNotAuthenticated();
    });
  });

  test.describe('Logout Journey', () => {
    test('should successfully logout and clear authentication state', async () => {
      const email = generateTestEmail('logout');
      const password = generateTestPassword();
      
      // Register, login, and verify authentication
      await authPages.registerUser(email, password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(email, password);
      
      // Perform complete logout flow
      await authPages.performCompleteLogoutFlow();
    });

    test('should prevent access to protected routes after logout', async () => {
      const email = generateTestEmail('logout-protection');
      const password = generateTestPassword();
      
      // Register and login
      await authPages.registerUser(email, password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(email, password);
      
      // Logout
      await authPages.logout();
      
      // Try to access protected flashcard page
      await authPages.page.goto('/home');
      await expect(authPages.page).toHaveURL('/login');
    });
  });

  test.describe('Security Journey', () => {
    test('should implement rate limiting after multiple failed attempts', async () => {
      // This test may take longer due to multiple attempts
      test.setTimeout(TIMEOUTS.VERY_LONG);
      
      await authPages.testAccountLockout();
    });

    test('should not expose sensitive information in error messages', async () => {
      await authPages.navigateToLogin();
      await authPages.fillLoginForm('test@example.com', 'wrongpassword');
      await authPages.submitLoginForm();
      
      // Error should be generic, not revealing whether email exists
      const errorMessage = await authPages.page.locator('.error-message').textContent();
      expect(errorMessage.toLowerCase()).toContain('invalid credentials');
      expect(errorMessage.toLowerCase()).not.toContain('password');
      expect(errorMessage.toLowerCase()).not.toContain('email');
    });

    test('should clear sensitive data from forms on navigation', async () => {
      await authPages.navigateToLogin();
      await authPages.fillLoginForm('test@example.com', 'password123');
      
      // Navigate away and back
      await authPages.page.goto('/register');
      await authPages.page.goto('/login');
      
      // Form fields should be empty
      const emailValue = await authPages.page.inputValue('input[name="email"]');
      const passwordValue = await authPages.page.inputValue('input[name="password"]');
      
      expect(emailValue).toBe('');
      expect(passwordValue).toBe('');
    });
  });

  test.describe('User Experience Journey', () => {
    test('should support keyboard navigation through authentication forms', async () => {
      const email = generateTestEmail('keyboard');
      const password = generateTestPassword();
      
      // Register user first
      await authPages.registerUser(email, password);
      await authPages.verifyRegistrationSuccess();
      
      // Test keyboard-only login
      await authPages.loginUsingKeyboard(email, password);
    });

    test('should provide proper accessibility features', async () => {
      await authPages.verifyAccessibilityFeatures();
    });

    test('should work properly on mobile devices', async () => {
      await authPages.verifyMobileLayout();
      
      // Test mobile registration flow
      const email = generateTestEmail('mobile');
      const password = generateTestPassword();
      
      await authPages.registerUser(email, password);
      await authPages.verifyRegistrationSuccess();
      
      // Test mobile login flow
      await authPages.loginAs(email, password);
      await authPages.verifyUserAuthenticated(email);
    });

    test('should handle network interruptions gracefully', async () => {
      const email = generateTestEmail('network');
      const password = generateTestPassword();
      
      // Register user first
      await authPages.registerUser(email, password);
      await authPages.verifyRegistrationSuccess();
      
      // Simulate network failure during login
      await authPages.page.route('**/api/login', (route) => {
        route.abort('internetdisconnected');
      });
      
      await authPages.navigateToLogin();
      await authPages.fillLoginForm(email, password);
      await authPages.submitLoginForm();
      
      // Should show appropriate error message
      await authPages.verifyLoginError('Network error');
    });
  });

  test.describe('Edge Cases Journey', () => {
    test('should handle special characters in passwords', async () => {
      const email = generateTestEmail('special-chars');
      const password = 'P@ssw0rd!#$%^&*()';
      
      await authPages.registerUser(email, password);
      await authPages.verifyRegistrationSuccess();
      
      await authPages.loginAs(email, password);
      await authPages.verifyUserAuthenticated(email);
    });

    test('should handle unicode characters in email', async () => {
      // Test with international domain
      const email = `test.${Date.now()}@münchen.example.com`;
      const password = generateTestPassword();
      
      // Note: This test might fail if the system doesn't support international domains
      try {
        await authPages.registerUser(email, password);
        await authPages.verifyRegistrationSuccess();
        await authPages.loginAs(email, password);
        await authPages.verifyUserAuthenticated(email);
      } catch (error) {
        // If unicode emails aren't supported, verify appropriate error message
        await authPages.verifyRegistrationError('Invalid email format');
      }
    });

    test('should handle very long email addresses', async () => {
      const longLocal = 'a'.repeat(64); // Maximum local part length
      const email = `${longLocal}@example.com`;
      const password = generateTestPassword();
      
      await authPages.registerUser(email, password);
      
      // Should either succeed or show appropriate validation error
      try {
        await authPages.verifyRegistrationSuccess();
        await authPages.loginAs(email, password);
        await authPages.verifyUserAuthenticated(email);
      } catch (error) {
        await authPages.verifyRegistrationError('Email address too long');
      }
    });

    test('should maintain state during browser back/forward navigation', async () => {
      const email = generateTestEmail('navigation');
      const password = generateTestPassword();
      
      // Register and login
      await authPages.registerUser(email, password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(email, password);
      
      // Navigate to different pages
      await flashcardPages.navigateToFlashcards();
      await authPages.page.goBack();
      await authPages.page.goForward();
      
      // Should still be authenticated
      await authPages.verifyUserAuthenticated(email);
    });
  });

  test.describe('Cross-browser Compatibility Journey', () => {
    test('should work consistently across different browsers', async ({ browserName }) => {
      const email = generateTestEmail(`browser-${browserName}`);
      const password = generateTestPassword();
      
      // Complete registration and login flow
      await authPages.registerUser(email, password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(email, password);
      await authPages.verifyUserAuthenticated(email);
      
      // Verify basic functionality works
      await flashcardPages.navigateToFlashcards();
      await expect(flashcardPages.page.locator('[data-testid="flashcard-list"]')).toBeVisible();
      
      // Logout should work
      await authPages.logout();
      await authPages.verifyUserNotAuthenticated();
    });
  });

  test.describe('Performance Journey', () => {
    test('should complete registration within acceptable time limits', async () => {
      const email = generateTestEmail('performance');
      const password = generateTestPassword();
      
      const startTime = Date.now();
      
      await authPages.registerUser(email, password);
      await authPages.verifyRegistrationSuccess();
      
      const registrationTime = Date.now() - startTime;
      
      // Registration should complete within 5 seconds
      expect(registrationTime).toBeLessThan(5000);
    });

    test('should complete login within acceptable time limits', async () => {
      const email = generateTestEmail('login-performance');
      const password = generateTestPassword();
      
      // Register user first
      await authPages.registerUser(email, password);
      await authPages.verifyRegistrationSuccess();
      
      const startTime = Date.now();
      
      await authPages.loginAs(email, password);
      
      const loginTime = Date.now() - startTime;
      
      // Login should complete within 3 seconds
      expect(loginTime).toBeLessThan(3000);
    });
  });
});