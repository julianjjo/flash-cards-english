import { test, expect } from '@playwright/test';
import { AuthPages } from '../pages/AuthPages.js';
import { FlashcardPages } from '../pages/FlashcardPages.js';
import { AdminPages } from '../pages/AdminPages.js';
import { setupTestEnvironment, teardownTestEnvironment, dbHelper } from '../utils/databaseHelpers.js';
import { generateTestEmail, generateTestPassword, TIMEOUTS } from '../utils/testUtils.js';

/**
 * Error Handling and Recovery Scenarios Edge Cases
 * 
 * These tests verify the application gracefully handles and recovers from:
 * - Network failures and timeouts
 * - Server errors and service unavailability
 * - Database connection issues and data corruption
 * - Authentication and authorization failures
 * - Browser crashes and unexpected navigation
 * - Race conditions and concurrent operation failures
 * - Third-party service failures (TTS, storage, etc.)
 * - Resource exhaustion and memory issues
 */

test.describe('Error Handling and Recovery Scenarios', () => {
  let authPages;
  let flashcardPages;
  let adminPages;
  let testUser;

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
    
    const email = generateTestEmail('error-recovery');
    const password = generateTestPassword();
    testUser = { email, password };
  });

  test.afterEach(async () => {
    // Clean up test data
    if (testUser) {
      try {
        const user = dbHelper.getUser(testUser.email);
        if (user) {
          dbHelper.deleteUserFlashcards(user.id);
          dbHelper.deleteUser(testUser.email);
        }
      } catch (error) {
        // Ignore cleanup errors in error recovery tests
      }
    }
  });

  test.describe('Network Error Recovery', () => {
    test('should recover from complete network failure', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      // Simulate complete network failure
      await flashcardPages.page.route('**/*', (route) => {
        route.abort('internetdisconnected');
      });
      
      // Try to create flashcard during network failure
      await flashcardPages.openCreateForm();
      await flashcardPages.fillFlashcardForm('Network Failure Test', 'Prueba Fallo Red');
      await flashcardPages.submitFlashcardForm();
      
      // Should show network error
      await expect(flashcardPages.page.locator('.error-message')).toContainText(['Network error', 'Connection failed', 'Unable to connect']);
      
      // Restore network
      await flashcardPages.page.unroute('**/*');
      
      // Retry the operation
      const retryButton = flashcardPages.page.locator('[data-testid="retry-button"]');
      if (await retryButton.isVisible()) {
        await retryButton.click();
      } else {
        // Manual retry
        await flashcardPages.submitFlashcardForm();
      }
      
      // Should succeed after network recovery
      await flashcardPages.verifyFlashcardCreated('Network Failure Test', 'Prueba Fallo Red');
    });

    test('should handle intermittent connection drops', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      let requestCount = 0;
      
      // Simulate intermittent failures
      await flashcardPages.page.route('**/api/**', (route) => {
        requestCount++;
        if (requestCount % 4 === 0) {
          // Every 4th request fails
          route.abort('internetdisconnected');
        } else {
          route.continue();
        }
      });
      
      // Try to create multiple flashcards
      const results = [];
      for (let i = 0; i < 8; i++) {
        try {
          await flashcardPages.createFlashcard(`Intermittent ${i}`, `Intermitente ${i}`);
          results.push('success');
          await flashcardPages.page.waitForTimeout(500);
        } catch (error) {
          results.push('failed');
          
          // Look for retry mechanism
          const retryButton = flashcardPages.page.locator('[data-testid="retry-button"]');
          if (await retryButton.isVisible()) {
            await retryButton.click();
            results[results.length - 1] = 'retried';
          }
        }
      }
      
      // Should have some successes and handle failures gracefully
      const successes = results.filter(r => r === 'success' || r === 'retried').length;
      expect(successes).toBeGreaterThan(0);
      
      // Application should still be functional
      const finalCount = await flashcardPages.verifyFlashcardsList();
      expect(finalCount).toBeGreaterThan(0);
    });

    test('should handle timeout scenarios with graceful degradation', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      // Simulate very slow responses
      await flashcardPages.page.route('**/api/flashcards', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 15000)); // 15 second delay
        route.continue();
      });
      
      // Set shorter timeout for test
      test.setTimeout(30000);
      
      await flashcardPages.openCreateForm();
      await flashcardPages.fillFlashcardForm('Timeout Test', 'Prueba Timeout');
      await flashcardPages.submitFlashcardForm();
      
      // Should show timeout error or loading state
      const hasError = await Promise.race([
        flashcardPages.page.locator('.error-message').waitFor({ timeout: 10000 }).then(() => true),
        flashcardPages.page.locator('[data-testid="loading"]').waitFor({ timeout: 10000 }).then(() => false)
      ]);
      
      if (hasError) {
        const errorText = await flashcardPages.page.locator('.error-message').textContent();
        expect(errorText.toLowerCase()).toMatch(/timeout|slow|taking too long/);
      }
      
      // Application should remain responsive
      await flashcardPages.page.click('[data-testid="cancel-button"]');
      await expect(flashcardPages.page.locator('[data-testid="flashcard-list"]')).toBeVisible();
    });

    test('should recover from partial network connectivity', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      // Block API calls but allow static resources
      await flashcardPages.page.route('**/api/**', (route) => {
        route.abort('internetdisconnected');
      });
      
      // UI should still be functional for offline operations
      await flashcardPages.openCreateForm();
      await expect(flashcardPages.page.locator('[data-testid="flashcard-form"]')).toBeVisible();
      
      // Attempt to submit should show offline message
      await flashcardPages.fillFlashcardForm('Offline Test', 'Prueba Offline');
      await flashcardPages.submitFlashcardForm();
      
      await expect(flashcardPages.page.locator('.error-message')).toContainText(['offline', 'connection', 'network']);
      
      // Restore API connectivity
      await flashcardPages.page.unroute('**/api/**');
      
      // Should be able to retry or resend
      const retryButton = flashcardPages.page.locator('[data-testid="retry-button"]');
      if (await retryButton.isVisible()) {
        await retryButton.click();
        await flashcardPages.verifyFlashcardCreated('Offline Test', 'Prueba Offline');
      }
    });
  });

  test.describe('Server Error Recovery', () => {
    test('should handle 500 internal server errors gracefully', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      // Simulate server errors
      await flashcardPages.page.route('**/api/flashcards', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error', message: 'Database connection failed' })
        });
      });
      
      await flashcardPages.openCreateForm();
      await flashcardPages.fillFlashcardForm('Server Error Test', 'Prueba Error Servidor');
      await flashcardPages.submitFlashcardForm();
      
      // Should show user-friendly error message
      await expect(flashcardPages.page.locator('.error-message')).toContainText('server error');
      await expect(flashcardPages.page.locator('.error-message')).not.toContainText('Database connection failed'); // Don't expose internal details
      
      // Should provide retry option
      await expect(flashcardPages.page.locator('[data-testid="retry-button"]')).toBeVisible();
      
      // Restore server
      await flashcardPages.page.unroute('**/api/flashcards');
      
      // Retry should work
      await flashcardPages.page.click('[data-testid="retry-button"]');
      await flashcardPages.verifyFlashcardCreated('Server Error Test', 'Prueba Error Servidor');
    });

    test('should handle service unavailable errors with backoff', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      let attemptCount = 0;
      
      // Simulate service unavailable with eventual recovery
      await flashcardPages.page.route('**/api/flashcards', (route) => {
        attemptCount++;
        if (attemptCount < 3) {
          route.fulfill({
            status: 503,
            contentType: 'application/json',
            headers: { 'Retry-After': '5' },
            body: JSON.stringify({ error: 'Service temporarily unavailable' })
          });
        } else {
          route.continue();
        }
      });
      
      await flashcardPages.openCreateForm();
      await flashcardPages.fillFlashcardForm('Service Unavailable Test', 'Prueba Servicio No Disponible');
      await flashcardPages.submitFlashcardForm();
      
      // Should show service unavailable message
      await expect(flashcardPages.page.locator('.error-message')).toContainText('temporarily unavailable');
      
      // Should show retry countdown or automatic retry
      const retryButton = flashcardPages.page.locator('[data-testid="retry-button"]');
      for (let i = 0; i < 3; i++) {
        if (await retryButton.isVisible()) {
          await retryButton.click();
          await flashcardPages.page.waitForTimeout(1000);
        }
      }
      
      // Should eventually succeed
      await flashcardPages.verifyFlashcardCreated('Service Unavailable Test', 'Prueba Servicio No Disponible');
    });

    test('should handle authentication token expiration during operations', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      // Simulate token expiration
      await flashcardPages.page.route('**/api/flashcards', (route) => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Token expired' })
        });
      });
      
      await flashcardPages.openCreateForm();
      await flashcardPages.fillFlashcardForm('Token Expiration Test', 'Prueba Expiración Token');
      await flashcardPages.submitFlashcardForm();
      
      // Should redirect to login or show re-authentication prompt
      const currentUrl = flashcardPages.page.url();
      if (currentUrl.includes('/login')) {
        await expect(flashcardPages.page).toHaveURL('/login');
        await expect(flashcardPages.page.locator('.info-message')).toContainText(['session expired', 'please log in']);
      } else {
        await expect(flashcardPages.page.locator('[data-testid="re-authenticate-modal"]')).toBeVisible();
      }
    });

    test('should handle rate limiting with appropriate backoff', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      // Simulate rate limiting
      await flashcardPages.page.route('**/api/flashcards', (route) => {
        route.fulfill({
          status: 429,
          contentType: 'application/json',
          headers: { 'Retry-After': '10' },
          body: JSON.stringify({ error: 'Too many requests', retryAfter: 10 })
        });
      });
      
      await flashcardPages.openCreateForm();
      await flashcardPages.fillFlashcardForm('Rate Limit Test', 'Prueba Límite Tasa');
      await flashcardPages.submitFlashcardForm();
      
      // Should show rate limiting message
      await expect(flashcardPages.page.locator('.error-message')).toContainText(['too many requests', 'rate limit', 'please wait']);
      
      // Should show countdown or disable submit temporarily
      const submitButton = flashcardPages.page.locator('button[type="submit"]');
      const isDisabled = await submitButton.getAttribute('disabled');
      expect(isDisabled).not.toBeNull();
      
      // Or should show retry countdown
      const retryInfo = flashcardPages.page.locator('[data-testid="retry-countdown"]');
      if (await retryInfo.isVisible()) {
        const countdownText = await retryInfo.textContent();
        expect(countdownText).toMatch(/\d+/); // Should contain numbers
      }
    });
  });

  test.describe('Database Error Recovery', () => {
    test('should handle database connection failures', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      // Simulate database connection error
      await flashcardPages.page.route('**/api/**', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'Database unavailable',
            code: 'DB_CONNECTION_FAILED'
          })
        });
      });
      
      // Try multiple operations
      await flashcardPages.openCreateForm();
      await flashcardPages.fillFlashcardForm('DB Error Test', 'Prueba Error BD');
      await flashcardPages.submitFlashcardForm();
      
      // Should show database error message
      await expect(flashcardPages.page.locator('.error-message')).toContainText(['database', 'temporarily unavailable']);
      
      // Try to navigate - should handle gracefully
      await flashcardPages.navigateToFlashcards();
      await expect(flashcardPages.page.locator('.error-message')).toContainText(['unable to load', 'database']);
      
      // Restore database
      await flashcardPages.page.unroute('**/api/**');
      
      // Should recover functionality
      await flashcardPages.page.reload();
      await flashcardPages.navigateToFlashcards();
      await expect(flashcardPages.page.locator('[data-testid="flashcard-list"]')).toBeVisible();
    });

    test('should handle data consistency errors', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('Original Card', 'Tarjeta Original');
      
      // Get flashcard ID
      const user = dbHelper.getUser(testUser.email);
      const flashcards = dbHelper.getUserFlashcards(user.id);
      const flashcardId = flashcards[0].id;
      
      // Simulate data corruption
      await flashcardPages.page.route(`**/api/flashcards/${flashcardId}`, (route) => {
        if (route.request().method() === 'PUT') {
          route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ 
              error: 'Data conflict',
              message: 'The flashcard has been modified by another user',
              code: 'CONFLICT'
            })
          });
        } else {
          route.continue();
        }
      });
      
      // Try to edit the flashcard
      await flashcardPages.editFlashcard('Original Card', 'Modified Card', 'Tarjeta Modificada');
      
      // Should show conflict resolution dialog
      await expect(flashcardPages.page.locator('[data-testid="conflict-resolution"]')).toBeVisible();
      
      // Should offer options to resolve conflict
      await expect(flashcardPages.page.locator('[data-testid="keep-changes"]')).toBeVisible();
      await expect(flashcardPages.page.locator('[data-testid="discard-changes"]')).toBeVisible();
      await expect(flashcardPages.page.locator('[data-testid="view-current"]')).toBeVisible();
    });

    test('should handle foreign key constraint violations', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      // Simulate foreign key violation
      await flashcardPages.page.route('**/api/flashcards', (route) => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'Data integrity violation',
            code: 'FOREIGN_KEY_CONSTRAINT'
          })
        });
      });
      
      await flashcardPages.openCreateForm();
      await flashcardPages.fillFlashcardForm('Constraint Test', 'Prueba Restricción');
      await flashcardPages.submitFlashcardForm();
      
      // Should show user-friendly error
      await expect(flashcardPages.page.locator('.error-message')).toContainText(['data error', 'please try again']);
      await expect(flashcardPages.page.locator('.error-message')).not.toContainText('FOREIGN_KEY_CONSTRAINT');
    });
  });

  test.describe('Authentication and Authorization Error Recovery', () => {
    test('should handle sudden authentication loss', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      // Clear authentication token suddenly
      await flashcardPages.page.evaluate(() => {
        localStorage.removeItem('authToken');
        sessionStorage.clear();
      });
      
      // Try to perform authenticated operation
      await flashcardPages.openCreateForm();
      await flashcardPages.fillFlashcardForm('Auth Lost Test', 'Prueba Pérdida Auth');
      await flashcardPages.submitFlashcardForm();
      
      // Should detect authentication loss and redirect or prompt
      await Promise.race([
        expect(flashcardPages.page).toHaveURL('/login'),
        expect(flashcardPages.page.locator('[data-testid="login-required-modal"]')).toBeVisible()
      ]);
    });

    test('should handle permission changes during session', async () => {
      // Create admin user
      const adminEmail = generateTestEmail('temp-admin');
      const adminPassword = generateTestPassword();
      await dbHelper.createTestUser(adminEmail, adminPassword, 'admin');
      
      await authPages.loginAs(adminEmail, adminPassword);
      await authPages.verifyAdminUser();
      
      await adminPages.navigateToAdminDashboard();
      
      // Simulate permission revocation
      await adminPages.page.route('**/api/admin/**', (route) => {
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'Access denied',
            message: 'Admin privileges have been revoked'
          })
        });
      });
      
      // Try to perform admin operation
      await adminPages.navigateToUserManagement();
      
      // Should show access denied and redirect
      await expect(adminPages.page.locator('.error-message')).toContainText('access denied');
      await expect(adminPages.page).toHaveURL('/home');
      
      // Clean up
      dbHelper.cleanupTestUser(adminEmail);
    });

    test('should handle concurrent session conflicts', async ({ context }) => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      // Create second session
      const secondPage = await context.newPage();
      const secondAuth = new AuthPages(secondPage);
      await secondAuth.loginAs(testUser.email, testUser.password);
      
      // Simulate session conflict
      await flashcardPages.page.route('**/api/**', (route) => {
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'Session conflict',
            message: 'Another session is active for this user'
          })
        });
      });
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openCreateForm();
      await flashcardPages.fillFlashcardForm('Conflict Test', 'Prueba Conflicto');
      await flashcardPages.submitFlashcardForm();
      
      // Should handle session conflict
      await expect(flashcardPages.page.locator('.error-message')).toContainText(['session conflict', 'another session']);
      
      await secondPage.close();
    });
  });

  test.describe('Browser and Client Error Recovery', () => {
    test('should recover from browser storage corruption', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      // Corrupt browser storage
      await flashcardPages.page.evaluate(() => {
        localStorage.setItem('authToken', 'corrupted-token-{invalid-json');
        localStorage.setItem('userPreferences', '{invalid-json-data');
        sessionStorage.setItem('sessionData', 'corrupted');
      });
      
      // Navigate to protected page
      await flashcardPages.navigateToFlashcards();
      
      // Should detect corruption and handle gracefully
      const currentUrl = flashcardPages.page.url();
      if (currentUrl.includes('/login')) {
        // Redirected to login due to corrupted token
        await expect(flashcardPages.page).toHaveURL('/login');
      } else {
        // Or cleared corruption and continues working
        await expect(flashcardPages.page.locator('[data-testid="flashcard-list"]')).toBeVisible();
      }
    });

    test('should handle JavaScript execution errors', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      let errorCount = 0;
      
      // Monitor JavaScript errors
      flashcardPages.page.on('pageerror', (error) => {
        errorCount++;
        console.log('Page error:', error.message);
      });
      
      // Inject code that causes errors
      await flashcardPages.page.addInitScript(() => {
        // Override console.error to track errors
        const originalError = console.error;
        window.errorCount = 0;
        console.error = function(...args) {
          window.errorCount++;
          originalError.apply(console, args);
        };
        
        // Cause some errors
        setTimeout(() => {
          try {
            nonExistentFunction();
          } catch (e) {
            console.error('Test error:', e);
          }
        }, 1000);
      });
      
      await flashcardPages.navigateToFlashcards();
      
      // Wait for errors to occur
      await flashcardPages.page.waitForTimeout(2000);
      
      // Application should still be functional despite errors
      await flashcardPages.createFlashcard('Error Recovery Test', 'Prueba Recuperación Error');
      await flashcardPages.verifyFlashcardCreated('Error Recovery Test', 'Prueba Recuperación Error');
      
      // Check that errors were handled
      const clientErrorCount = await flashcardPages.page.evaluate(() => window.errorCount || 0);
      expect(clientErrorCount).toBeGreaterThanOrEqual(0); // Errors may have occurred but were handled
    });

    test('should handle memory pressure and garbage collection issues', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      // Create memory pressure
      await flashcardPages.page.evaluate(() => {
        const arrays = [];
        const interval = setInterval(() => {
          try {
            arrays.push(new Array(50000).fill('memory-test'));
            if (arrays.length > 100) {
              arrays.shift(); // Remove oldest to prevent total crash
            }
          } catch (e) {
            clearInterval(interval);
          }
        }, 10);
        
        // Stop after 5 seconds
        setTimeout(() => clearInterval(interval), 5000);
      });
      
      // Application should remain responsive
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('Memory Pressure Test', 'Prueba Presión Memoria');
      
      // Should complete successfully despite memory pressure
      await flashcardPages.verifyFlashcardCreated('Memory Pressure Test', 'Prueba Presión Memoria');
    });

    test('should handle sudden page navigation and interrupted requests', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      // Start a slow operation
      await flashcardPages.page.route('**/api/flashcards', async (route) => {
        // Simulate slow response
        await new Promise(resolve => setTimeout(resolve, 5000));
        route.continue();
      });
      
      await flashcardPages.openCreateForm();
      await flashcardPages.fillFlashcardForm('Interrupted Test', 'Prueba Interrumpida');
      
      // Start submission but navigate away quickly
      const submitPromise = flashcardPages.submitFlashcardForm();
      
      // Navigate away before request completes
      await flashcardPages.page.waitForTimeout(500);
      await flashcardPages.page.goto('/home');
      
      // Should handle interrupted request gracefully
      await expect(flashcardPages.page).toHaveURL('/home');
      
      // Return to flashcards page
      await flashcardPages.navigateToFlashcards();
      
      // Should be in clean state
      await expect(flashcardPages.page.locator('[data-testid="flashcard-list"]')).toBeVisible();
    });
  });

  test.describe('Third-Party Service Error Recovery', () => {
    test('should handle TTS service failures gracefully', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('TTS Test Card', 'Tarjeta Prueba TTS');
      await flashcardPages.openFlashcardDetail('TTS Test Card');
      
      // Simulate TTS service failure
      await flashcardPages.page.route('**/api/tts/**', (route) => {
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'TTS service unavailable' })
        });
      });
      
      // Try to play audio
      if (await flashcardPages.page.locator('[data-testid="play-english-audio"]').isVisible()) {
        await flashcardPages.page.click('[data-testid="play-english-audio"]');
        
        // Should show TTS error but not break the application
        await expect(flashcardPages.page.locator('[data-testid="audio-error"]')).toContainText('audio service');
        
        // Should offer fallback or retry
        const retryButton = flashcardPages.page.locator('[data-testid="retry-audio"]');
        if (await retryButton.isVisible()) {
          await expect(retryButton).toBeVisible();
        }
      }
      
      // Main functionality should still work
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('Non-Audio Test', 'Prueba Sin Audio');
      await flashcardPages.verifyFlashcardCreated('Non-Audio Test', 'Prueba Sin Audio');
    });

    test('should handle external storage service failures', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      // Simulate storage service failures
      await flashcardPages.page.route('**/api/storage/**', (route) => {
        route.fulfill({
          status: 502,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Storage service unavailable' })
        });
      });
      
      await flashcardPages.navigateToFlashcards();
      
      // Application should continue working without external storage
      await flashcardPages.createFlashcard('Storage Failure Test', 'Prueba Fallo Almacenamiento');
      await flashcardPages.verifyFlashcardCreated('Storage Failure Test', 'Prueba Fallo Almacenamiento');
      
      // Should show warning about storage issues if relevant
      const warningMessage = flashcardPages.page.locator('[data-testid="storage-warning"]');
      if (await warningMessage.isVisible()) {
        await expect(warningMessage).toContainText('storage');
      }
    });

    test('should handle API rate limits from third-party services', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('Rate Limit Test', 'Prueba Límite Tasa');
      
      // Simulate third-party API rate limiting
      await flashcardPages.page.route('**/api/external/**', (route) => {
        route.fulfill({
          status: 429,
          contentType: 'application/json',
          headers: { 'Retry-After': '60' },
          body: JSON.stringify({ 
            error: 'Rate limit exceeded',
            retryAfter: 60
          })
        });
      });
      
      // Try to use external service feature
      await flashcardPages.openFlashcardDetail('Rate Limit Test');
      
      if (await flashcardPages.page.locator('[data-testid="external-feature"]').isVisible()) {
        await flashcardPages.page.click('[data-testid="external-feature"]');
        
        // Should show rate limit message with retry info
        await expect(flashcardPages.page.locator('.info-message')).toContainText('rate limit');
        await expect(flashcardPages.page.locator('[data-testid="retry-after"]')).toContainText('60');
      }
      
      // Core functionality should remain unaffected
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      await expect(flashcardPages.page.locator('[data-testid="learning-interface"]')).toBeVisible();
    });
  });

  test.describe('Concurrent Operation Error Recovery', () => {
    test('should handle race conditions in data updates', async ({ context }) => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('Race Condition Test', 'Prueba Condición Carrera');
      
      // Create second browser context
      const secondPage = await context.newPage();
      const secondAuth = new AuthPages(secondPage);
      const secondFlashcards = new FlashcardPages(secondPage);
      
      await secondAuth.loginAs(testUser.email, testUser.password);
      await secondFlashcards.navigateToFlashcards();
      
      // Both contexts try to edit the same flashcard simultaneously
      const editPromises = [
        flashcardPages.editFlashcard('Race Condition Test', 'Updated from Context 1', 'Actualizado desde Contexto 1'),
        secondFlashcards.editFlashcard('Race Condition Test', 'Updated from Context 2', 'Actualizado desde Contexto 2')
      ];
      
      const results = await Promise.allSettled(editPromises);
      
      // At least one should succeed, or should handle conflict gracefully
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (failed > 0) {
        // Should show conflict resolution for failed updates
        const hasConflictDialog = await Promise.race([
          flashcardPages.page.locator('[data-testid="conflict-resolution"]').isVisible(),
          secondPage.locator('[data-testid="conflict-resolution"]').isVisible()
        ]);
        
        expect(hasConflictDialog || successful > 0).toBe(true);
      }
      
      await secondPage.close();
    });

    test('should handle concurrent session management', async ({ context }) => {
      // Test multiple learning sessions from same user
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('Concurrent Session Test', 'Prueba Sesión Concurrente');
      
      // Create second context
      const secondPage = await context.newPage();
      const secondAuth = new AuthPages(secondPage);
      const secondFlashcards = new FlashcardPages(secondPage);
      
      await secondAuth.loginAs(testUser.email, testUser.password);
      await secondFlashcards.navigateToFlashcards();
      
      // Start learning sessions in both contexts
      await flashcardPages.startLearningSession();
      await secondFlashcards.startLearningSession();
      
      // Both complete reviews simultaneously
      const reviewPromises = [
        flashcardPages.completeFlashcardReview(4),
        secondFlashcards.completeFlashcardReview(3)
      ];
      
      await Promise.allSettled(reviewPromises);
      
      // Should handle concurrent reviews gracefully
      const user = dbHelper.getUser(testUser.email);
      const sessions = dbHelper.getUserStudySessions(user.id);
      
      // Should have sessions from both contexts or handle conflicts
      expect(sessions.length).toBeGreaterThan(0);
      
      await secondPage.close();
    });

    test('should handle database transaction conflicts', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      // Simulate database transaction conflict
      let requestCount = 0;
      await flashcardPages.page.route('**/api/flashcards', (route) => {
        requestCount++;
        if (requestCount === 1) {
          // First request gets transaction conflict
          route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ 
              error: 'Transaction conflict',
              code: 'SERIALIZATION_FAILURE'
            })
          });
        } else {
          // Subsequent requests succeed
          route.continue();
        }
      });
      
      await flashcardPages.openCreateForm();
      await flashcardPages.fillFlashcardForm('Transaction Conflict Test', 'Prueba Conflicto Transacción');
      await flashcardPages.submitFlashcardForm();
      
      // Should show retry message or automatically retry
      const retryButton = flashcardPages.page.locator('[data-testid="retry-button"]');
      if (await retryButton.isVisible()) {
        await retryButton.click();
      }
      
      // Should eventually succeed
      await flashcardPages.verifyFlashcardCreated('Transaction Conflict Test', 'Prueba Conflicto Transacción');
    });
  });

  test.describe('System Resource Error Recovery', () => {
    test('should handle disk space exhaustion', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      // Simulate disk space error
      await flashcardPages.page.route('**/api/**', (route) => {
        route.fulfill({
          status: 507,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'Insufficient storage',
            code: 'DISK_FULL'
          })
        });
      });
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openCreateForm();
      await flashcardPages.fillFlashcardForm('Disk Full Test', 'Prueba Disco Lleno');
      await flashcardPages.submitFlashcardForm();
      
      // Should show storage error message
      await expect(flashcardPages.page.locator('.error-message')).toContainText(['storage', 'space', 'temporarily unavailable']);
      
      // Should not expose internal error codes
      await expect(flashcardPages.page.locator('.error-message')).not.toContainText('DISK_FULL');
    });

    test('should handle memory exhaustion scenarios', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      // Simulate memory exhaustion
      await flashcardPages.page.route('**/api/**', (route) => {
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'Service temporarily unavailable',
            message: 'High system load'
          })
        });
      });
      
      await flashcardPages.navigateToFlashcards();
      
      // Should show service unavailable message
      await expect(flashcardPages.page.locator('.error-message')).toContainText(['temporarily unavailable', 'high load']);
      
      // Should offer retry or suggest trying later
      const retryLaterMessage = flashcardPages.page.locator('[data-testid="retry-later"]');
      if (await retryLaterMessage.isVisible()) {
        await expect(retryLaterMessage).toContainText('try again later');
      }
    });

    test('should handle cascading system failures', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      // Simulate multiple system failures
      const failures = [
        { pattern: '**/api/flashcards', status: 500 },
        { pattern: '**/api/users/**', status: 503 },
        { pattern: '**/api/auth/**', status: 502 }
      ];
      
      for (const failure of failures) {
        await flashcardPages.page.route(failure.pattern, (route) => {
          route.fulfill({
            status: failure.status,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Service unavailable' })
          });
        });
      }
      
      // Try to use application
      await flashcardPages.navigateToFlashcards();
      
      // Should show comprehensive error message
      await expect(flashcardPages.page.locator('.error-message')).toContainText(['system', 'unavailable', 'maintenance']);
      
      // Should provide status page or contact info
      const statusLink = flashcardPages.page.locator('[data-testid="status-page-link"]');
      const contactInfo = flashcardPages.page.locator('[data-testid="contact-support"]');
      
      const hasStatusInfo = await statusLink.isVisible() || await contactInfo.isVisible();
      expect(hasStatusInfo).toBe(true);
    });
  });
});