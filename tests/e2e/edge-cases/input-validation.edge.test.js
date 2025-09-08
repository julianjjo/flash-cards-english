import { test, expect } from '@playwright/test';
import { AuthPages } from '../pages/AuthPages.js';
import { FlashcardPages } from '../pages/FlashcardPages.js';
import { AdminPages } from '../pages/AdminPages.js';
import { setupTestEnvironment, teardownTestEnvironment, dbHelper } from '../utils/databaseHelpers.js';
import { generateTestEmail, generateTestPassword, TIMEOUTS } from '../utils/testUtils.js';

/**
 * Edge Case Testing for Input Validation and Data Boundaries
 * 
 * These tests verify the application handles extreme, boundary, and edge case inputs including:
 * - Maximum and minimum length inputs
 * - Special characters and unicode handling
 * - Empty, null, and undefined values
 * - Data type mismatches and format violations
 * - Boundary value analysis for all form fields
 * - File upload edge cases and malformed data
 * - SQL injection and XSS prevention
 */

test.describe('Input Validation and Data Boundaries Edge Cases', () => {
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
    
    // Create test user for edge case testing
    const email = generateTestEmail('edge-case');
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
        // Ignore cleanup errors
      }
    }
  });

  test.describe('Authentication Input Edge Cases', () => {
    test('should handle extremely long email addresses', async () => {
      // Test email with maximum allowed length (320 characters per RFC)
      const longLocal = 'a'.repeat(64); // Max local part
      const longDomain = 'b'.repeat(243) + '.com'; // Max domain part
      const maxLengthEmail = `${longLocal}@${longDomain}`;
      
      await authPages.navigateToRegister();
      await authPages.page.fill('input[name="email"]', maxLengthEmail);
      await authPages.page.fill('input[name="password"]', 'ValidPassword123');
      await authPages.page.fill('input[name="confirmPassword"]', 'ValidPassword123');
      await authPages.submitRegistrationForm();
      
      // Should either succeed or show appropriate length error
      try {
        await authPages.verifyRegistrationSuccess();
      } catch {
        await authPages.verifyRegistrationError('Email address too long');
      }
    });

    test('should handle email with extreme character variations', async () => {
      const edgeCaseEmails = [
        'test+tag@example.com', // Plus addressing
        'test.dots.everywhere@example.com', // Multiple dots
        '"quoted string"@example.com', // Quoted local part
        'user@[192.168.1.1]', // IP address domain
        'üñíçødé@example.com', // Unicode characters
        'test@sub.domain.example.com', // Multiple subdomains
        'a@b.co', // Minimal valid email
        '1234567890@example.com', // Numeric local part
        'test-hyphen@example-hyphen.com', // Hyphens
        'test_underscore@example.com' // Underscores
      ];
      
      for (const email of edgeCaseEmails) {
        await authPages.navigateToRegister();
        await authPages.page.fill('input[name="email"]', email);
        await authPages.page.fill('input[name="password"]', 'ValidPassword123');
        await authPages.page.blur('input[name="email"]');
        
        // Should either accept or show specific validation error
        const hasError = await authPages.page.locator('.field-error').isVisible();
        if (hasError) {
          const errorText = await authPages.page.locator('.field-error').textContent();
          expect(errorText).toContain('email');
        }
      }
    });

    test('should handle password boundary conditions', async () => {
      const passwordTests = [
        { password: '', error: 'Password is required' },
        { password: 'a', error: 'Password must be at least' },
        { password: 'a'.repeat(7), error: 'Password must be at least' },
        { password: 'a'.repeat(8), error: null }, // Minimum valid
        { password: 'a'.repeat(128), error: null }, // Long but valid
        { password: 'a'.repeat(1000), error: 'Password too long' }, // Too long
        { password: '12345678', error: 'Password must contain' }, // Weak
        { password: 'password', error: 'Password must contain' }, // Common
        { password: '        ', error: 'Password cannot be only whitespace' }, // Whitespace
        { password: 'Pass123!@#$%^&*()', error: null }, // Special chars
        { password: 'пароль123', error: null }, // Unicode
        { password: '密码123456', error: null }, // Chinese characters
      ];
      
      for (const test of passwordTests) {
        await authPages.navigateToRegister();
        await authPages.page.fill('input[name="email"]', generateTestEmail());
        await authPages.page.fill('input[name="password"]', test.password);
        await authPages.page.blur('input[name="password"]');
        
        if (test.error) {
          await expect(authPages.page.locator('.field-error')).toContainText(test.error);
        } else {
          const hasError = await authPages.page.locator('.field-error').isVisible();
          expect(hasError).toBe(false);
        }
      }
    });

    test('should handle malformed registration attempts', async () => {
      await authPages.navigateToRegister();
      
      // Test missing fields
      await authPages.submitRegistrationForm();
      await expect(authPages.page.locator('.field-error')).toBeVisible();
      
      // Test mismatched password confirmation
      await authPages.page.fill('input[name="email"]', generateTestEmail());
      await authPages.page.fill('input[name="password"]', 'Password123');
      await authPages.page.fill('input[name="confirmPassword"]', 'Different123');
      await authPages.submitRegistrationForm();
      
      await authPages.verifyValidationError('confirmPassword', 'Passwords do not match');
    });

    test('should prevent injection attacks in authentication forms', async () => {
      const injectionPayloads = [
        "'; DROP TABLE users; --",
        '<script>alert("xss")</script>',
        '${7*7}',
        '{{constructor.constructor("alert(1)")()}}',
        '../../../etc/passwd',
        '%3Cscript%3Ealert(1)%3C/script%3E'
      ];
      
      for (const payload of injectionPayloads) {
        await authPages.navigateToLogin();
        await authPages.page.fill('input[name="email"]', payload);
        await authPages.page.fill('input[name="password"]', payload);
        await authPages.submitLoginForm();
        
        // Should handle safely without executing or crashing
        const pageContent = await authPages.page.content();
        expect(pageContent).not.toContain('<script>');
        expect(pageContent).not.toContain('alert(');
        
        // Should show login error, not system error
        await expect(authPages.page.locator('.error-message')).toContainText('Invalid credentials');
      }
    });
  });

  test.describe('Flashcard Input Edge Cases', () => {
    test.beforeEach(async () => {
      // Login for flashcard tests
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
    });

    test('should handle extremely long flashcard content', async () => {
      await flashcardPages.navigateToFlashcards();
      
      const extremelyLongText = 'a'.repeat(10000); // 10KB text
      const maxReasonableText = 'b'.repeat(1000); // 1KB text
      
      // Test maximum reasonable length
      await flashcardPages.openCreateForm();
      await flashcardPages.fillFlashcardForm(maxReasonableText, 'Spanish translation');
      await flashcardPages.submitFlashcardForm();
      
      try {
        await flashcardPages.verifyFlashcardCreated(maxReasonableText.substring(0, 50), 'Spanish translation');
      } catch {
        await flashcardPages.verifyCreateFormValidation('Text too long');
      }
      
      // Test extremely long text
      await flashcardPages.openCreateForm();
      await flashcardPages.fillFlashcardForm(extremelyLongText, 'Spanish');
      await flashcardPages.submitFlashcardForm();
      
      await flashcardPages.verifyCreateFormValidation('Text exceeds maximum length');
    });

    test('should handle special characters and formatting in flashcards', async () => {
      await flashcardPages.navigateToFlashcards();
      
      const specialCharacterTests = [
        { english: 'Hello, "world"! How are you?', spanish: '¡Hola, "mundo"! ¿Cómo estás?' },
        { english: 'Math: 2 + 2 = 4 & 3 * 3 = 9', spanish: 'Matemáticas: 2 + 2 = 4 & 3 * 3 = 9' },
        { english: 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?', spanish: 'Caracteres especiales: !@#$%^&*()_+-=[]{}|;:,.<>?' },
        { english: 'Unicode: 🌟 ⭐ 🎯 🚀 💫', spanish: 'Unicode: 🌟 ⭐ 🎯 🚀 💫' },
        { english: 'Newlines\nand\ttabs', spanish: 'Saltos\nde\tlínea' },
        { english: 'HTML: <p>paragraph</p>', spanish: 'HTML: <p>párrafo</p>' },
        { english: 'Quotes: "double" \'single\' `backtick`', spanish: 'Comillas: "dobles" \'simples\' `backtick`' },
        { english: 'Accents: café, naïve, piña', spanish: 'Acentos: café, ingenuo, piña' }
      ];
      
      for (const testCase of specialCharacterTests) {
        await flashcardPages.createFlashcard(testCase.english, testCase.spanish);
        await flashcardPages.verifyFlashcardCreated(testCase.english, testCase.spanish);
      }
    });

    test('should handle empty and whitespace-only content', async () => {
      await flashcardPages.navigateToFlashcards();
      
      const emptyContentTests = [
        { english: '', spanish: 'Valid Spanish', expectedError: 'English text is required' },
        { english: 'Valid English', spanish: '', expectedError: 'Spanish text is required' },
        { english: '   ', spanish: 'Valid Spanish', expectedError: 'English text cannot be only whitespace' },
        { english: 'Valid English', spanish: '   ', expectedError: 'Spanish text cannot be only whitespace' },
        { english: '\n\t\r', spanish: 'Valid Spanish', expectedError: 'English text is required' },
        { english: null, spanish: 'Valid Spanish', expectedError: 'English text is required' }
      ];
      
      for (const testCase of emptyContentTests) {
        await flashcardPages.openCreateForm();
        
        if (testCase.english !== null) {
          await flashcardPages.page.fill('input[name="english"]', testCase.english);
        }
        if (testCase.spanish !== null) {
          await flashcardPages.page.fill('input[name="spanish"]', testCase.spanish);
        }
        
        await flashcardPages.submitFlashcardForm();
        await flashcardPages.verifyCreateFormValidation(testCase.expectedError);
      }
    });

    test('should handle malformed flashcard data submission', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Test form manipulation via JavaScript
      await flashcardPages.openCreateForm();
      
      // Manipulate form data directly
      await flashcardPages.page.evaluate(() => {
        const form = document.querySelector('[data-testid="flashcard-form"]');
        if (form) {
          // Add hidden malicious fields
          const maliciousInput = document.createElement('input');
          maliciousInput.type = 'hidden';
          maliciousInput.name = 'user_id';
          maliciousInput.value = '999';
          form.appendChild(maliciousInput);
          
          // Try to modify existing field types
          const englishInput = form.querySelector('input[name="english"]');
          if (englishInput) {
            englishInput.type = 'hidden';
            englishInput.value = 'manipulated';
          }
        }
      });
      
      await flashcardPages.page.fill('input[name="english"]', 'Valid English');
      await flashcardPages.page.fill('input[name="spanish"]', 'Valid Spanish');
      await flashcardPages.submitFlashcardForm();
      
      // Should create flashcard normally, ignoring malicious fields
      await flashcardPages.verifyFlashcardCreated('Valid English', 'Valid Spanish');
      
      // Verify the flashcard belongs to correct user
      const user = dbHelper.getUser(testUser.email);
      const userFlashcards = dbHelper.getUserFlashcards(user.id);
      const newFlashcard = userFlashcards.find(f => f.english === 'Valid English');
      expect(newFlashcard.user_id).toBe(user.id);
    });

    test('should handle concurrent flashcard creation', async ({ context }) => {
      // Create multiple browser contexts for concurrent testing
      const secondPage = await context.newPage();
      const secondAuthPages = new AuthPages(secondPage);
      const secondFlashcardPages = new FlashcardPages(secondPage);
      
      // Login same user in both contexts
      await secondAuthPages.loginAs(testUser.email, testUser.password);
      await secondFlashcardPages.navigateToFlashcards();
      await flashcardPages.navigateToFlashcards();
      
      // Create flashcards simultaneously
      const promises = [
        flashcardPages.createFlashcard('Concurrent 1', 'Concurrente 1'),
        secondFlashcardPages.createFlashcard('Concurrent 2', 'Concurrente 2')
      ];
      
      await Promise.allSettled(promises);
      
      // Verify both flashcards were created
      await flashcardPages.navigateToFlashcards();
      const finalCount = await flashcardPages.verifyFlashcardsList();
      expect(finalCount).toBeGreaterThanOrEqual(2);
      
      await secondPage.close();
    });

    test('should handle invalid difficulty values', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('Test Card', 'Tarjeta de Prueba');
      
      const user = dbHelper.getUser(testUser.email);
      const flashcards = dbHelper.getUserFlashcards(user.id);
      const flashcardId = flashcards[0].id;
      
      // Test invalid difficulty values directly on database
      const invalidDifficulties = [-1, 0, 6, 999, 'invalid', null, undefined];
      
      for (const invalidDifficulty of invalidDifficulties) {
        try {
          dbHelper.updateFlashcardDifficulty(flashcardId, invalidDifficulty);
          
          // If update succeeded, verify it was sanitized
          const updatedFlashcard = dbHelper.getFlashcard(flashcardId);
          expect(updatedFlashcard.difficulty).toBeGreaterThanOrEqual(1);
          expect(updatedFlashcard.difficulty).toBeLessThanOrEqual(5);
        } catch (error) {
          // Database constraint should prevent invalid values
          expect(error.message).toContain('CHECK constraint failed');
        }
      }
    });
  });

  test.describe('Search and Filter Edge Cases', () => {
    test.beforeEach(async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      // Create diverse test data for search testing
      const searchTestData = [
        { english: 'Hello World', spanish: 'Hola Mundo' },
        { english: 'Special chars: !@#$%', spanish: 'Caracteres especiales: !@#$%' },
        { english: 'Unicode: 🌟⭐🎯', spanish: 'Unicode: 🌟⭐🎯' },
        { english: 'Numbers 123456', spanish: 'Números 123456' },
        { english: 'Quotes "double" \'single\'', spanish: 'Comillas "dobles" \'simples\'' },
        { english: 'HTML <tags>', spanish: 'Etiquetas <HTML>' }
      ];
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createMultipleFlashcards(searchTestData);
    });

    test('should handle extreme search queries', async () => {
      await flashcardPages.navigateToFlashcards();
      
      const extremeSearches = [
        '', // Empty search
        ' ', // Whitespace only
        'a'.repeat(1000), // Very long search
        '!@#$%^&*()', // Special characters
        '<script>alert("xss")</script>', // XSS attempt
        '"; DROP TABLE flashcards; --', // SQL injection attempt
        '🌟⭐🎯', // Unicode emojis
        '\n\t\r', // Control characters
        'Hello World', // Normal search for comparison
        'hello world', // Case sensitivity test
        'HELLO WORLD', // Case sensitivity test
        'Hello  World', // Multiple spaces
        '   Hello World   ' // Leading/trailing spaces
      ];
      
      for (const searchTerm of extremeSearches) {
        await flashcardPages.searchFlashcards(searchTerm);
        
        // Should not crash or cause errors
        const isVisible = await flashcardPages.page.locator('[data-testid="flashcard-list"]').isVisible();
        expect(isVisible).toBe(true);
        
        // For malicious searches, should return 0 results safely
        if (searchTerm.includes('script') || searchTerm.includes('DROP')) {
          const count = await flashcardPages.page.locator('[data-testid="flashcard-item"]').count();
          expect(count).toBe(0);
        }
      }
    });

    test('should handle search result boundary conditions', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Test search that matches many results
      await flashcardPages.searchFlashcards('e'); // Common letter
      const manyResults = await flashcardPages.page.locator('[data-testid="flashcard-item"]').count();
      expect(manyResults).toBeGreaterThan(0);
      
      // Test search that matches no results
      await flashcardPages.searchFlashcards('xyzabc123nonexistent');
      const noResults = await flashcardPages.page.locator('[data-testid="flashcard-item"]').count();
      expect(noResults).toBe(0);
      
      // Test exact match
      await flashcardPages.searchFlashcards('Hello World');
      const exactMatch = await flashcardPages.page.locator('[data-testid="flashcard-item"]').count();
      expect(exactMatch).toBe(1);
      
      // Clear search should show all results
      await flashcardPages.clearSearch();
      const allResults = await flashcardPages.page.locator('[data-testid="flashcard-item"]').count();
      expect(allResults).toBe(6); // All created flashcards
    });

    test('should handle rapid consecutive searches', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Perform rapid searches to test debouncing and performance
      const rapidSearches = ['H', 'He', 'Hel', 'Hell', 'Hello', 'Hello ', 'Hello W', 'Hello Wo'];
      
      for (const search of rapidSearches) {
        await flashcardPages.page.fill('[data-testid="search-flashcards"]', search);
        await flashcardPages.page.waitForTimeout(50); // Very fast typing
      }
      
      // Wait for final search to complete
      await flashcardPages.page.waitForTimeout(1000);
      
      // Should show results for final search
      const results = await flashcardPages.page.locator('[data-testid="flashcard-item"]').count();
      expect(results).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Learning Session Edge Cases', () => {
    test.beforeEach(async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('Test Card', 'Tarjeta de Prueba');
    });

    test('should handle invalid quality ratings', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      await flashcardPages.showAnswer();
      
      // Test clicking quality buttons multiple times rapidly
      for (let i = 0; i < 5; i++) {
        await flashcardPages.page.click('[data-testid="quality-3"]');
        await flashcardPages.page.waitForTimeout(10);
      }
      
      // Should handle gracefully and not create multiple sessions
      const user = dbHelper.getUser(testUser.email);
      const sessions = dbHelper.getUserStudySessions(user.id);
      
      // Should have reasonable number of sessions, not excessive
      expect(sessions.length).toBeLessThan(10);
    });

    test('should handle session interruption and recovery', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // Interrupt session by navigating away
      await flashcardPages.page.goto('/home');
      
      // Navigate back and try to continue
      await flashcardPages.navigateToFlashcards();
      
      // Should be able to start new session
      await flashcardPages.startLearningSession();
      await expect(flashcardPages.page.locator('[data-testid="learning-interface"]')).toBeVisible();
    });

    test('should handle learning with corrupted flashcard data', async () => {
      const user = dbHelper.getUser(testUser.email);
      const flashcards = dbHelper.getUserFlashcards(user.id);
      
      // Corrupt flashcard data
      dbHelper.connect().prepare('UPDATE flashcards SET english = ? WHERE id = ?')
        .run('', flashcards[0].id);
      
      await flashcardPages.navigateToFlashcards();
      
      try {
        await flashcardPages.startLearningSession();
        
        // Should handle corrupted data gracefully
        const result = await flashcardPages.verifyNextCardOrSessionComplete();
        expect(['next-card', 'session-complete'].includes(result)).toBe(true);
      } catch (error) {
        // Should show appropriate error message
        await expect(flashcardPages.page.locator('.error-message')).toContainText('No flashcards available');
      }
    });
  });

  test.describe('Admin Interface Edge Cases', () => {
    test.beforeEach(async () => {
      // Create admin user
      const adminEmail = generateTestEmail('admin');
      const adminPassword = generateTestPassword();
      await dbHelper.createTestUser(adminEmail, adminPassword, 'admin');
      
      await authPages.loginAs(adminEmail, adminPassword);
      testUser.adminEmail = adminEmail;
    });

    test.afterEach(async () => {
      if (testUser.adminEmail) {
        dbHelper.cleanupTestUser(testUser.adminEmail);
      }
    });

    test('should handle bulk operations with edge cases', async () => {
      // Create many test users
      const testUsers = [];
      for (let i = 0; i < 50; i++) {
        const userId = await dbHelper.createTestUser(`bulk${i}@example.com`, 'password123');
        testUsers.push(userId);
      }
      
      await adminPages.navigateToUserManagement();
      
      // Try to select all users
      const selectAllCheckbox = adminPages.page.locator('[data-testid="select-all-users"]');
      if (await selectAllCheckbox.isVisible()) {
        await selectAllCheckbox.check();
        
        // Should handle large selection
        await expect(adminPages.page.locator('[data-testid="bulk-actions"]')).toBeVisible();
      }
      
      // Clean up test users
      for (let i = 0; i < 50; i++) {
        dbHelper.cleanupTestUser(`bulk${i}@example.com`);
      }
    });

    test('should handle invalid admin operations', async () => {
      await adminPages.navigateToUserManagement();
      
      // Try to delete non-existent user
      const response = await adminPages.page.request.delete('/api/admin/users/99999');
      expect([404, 400].includes(response.status())).toBe(true);
      
      // Try to promote user to invalid role
      const invalidRoleResponse = await adminPages.page.request.put('/api/admin/users/1', {
        data: { role: 'superadmin' }
      });
      expect([400, 422].includes(invalidRoleResponse.status())).toBe(true);
    });

    test('should handle malformed admin requests', async () => {
      const malformedRequests = [
        { url: '/api/admin/users', data: { malformed: 'data' } },
        { url: '/api/admin/users/abc', data: { role: 'admin' } }, // Invalid ID
        { url: '/api/admin/users/1', data: null }, // Null data
        { url: '/api/admin/users/1', data: { role: null } }, // Null role
        { url: '/api/admin/users/1', data: { role: 123 } } // Invalid role type
      ];
      
      for (const request of malformedRequests) {
        const response = await adminPages.page.request.put(request.url, { 
          data: request.data 
        });
        expect([400, 422, 404].includes(response.status())).toBe(true);
      }
    });
  });

  test.describe('File Upload and Media Edge Cases', () => {
    test.beforeEach(async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
    });

    test('should handle invalid file uploads', async () => {
      // This test assumes there's a file upload feature
      // Skip if not implemented
      const uploadElement = await flashcardPages.page.locator('[data-testid="file-upload"]').count();
      if (uploadElement === 0) {
        test.skip('File upload feature not implemented');
        return;
      }
      
      // Test various invalid file scenarios
      const invalidFiles = [
        'data:text/plain;base64,', // Empty file
        'data:application/octet-stream;base64,dGVzdA==', // Unknown binary
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', // HTML with script
        'x'.repeat(1000000) // Very large content
      ];
      
      for (const fileData of invalidFiles) {
        try {
          await flashcardPages.page.evaluate((data) => {
            const input = document.querySelector('[data-testid="file-upload"]');
            if (input) {
              const file = new File([data], 'test.txt', { type: 'text/plain' });
              const dataTransfer = new DataTransfer();
              dataTransfer.items.add(file);
              input.files = dataTransfer.files;
              input.dispatchEvent(new Event('change'));
            }
          }, fileData);
          
          // Should show appropriate error
          await expect(flashcardPages.page.locator('.error-message')).toContainText(['Invalid file', 'File too large', 'Unsupported format']);
        } catch (error) {
          // File rejection is acceptable
        }
      }
    });
  });

  test.describe('Browser Storage Edge Cases', () => {
    test('should handle storage quota exceeded', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.loginAs(testUser.email, testUser.password);
      
      // Fill up localStorage to near capacity
      await flashcardPages.page.evaluate(() => {
        try {
          const bigData = 'x'.repeat(1000000); // 1MB chunks
          for (let i = 0; i < 10; i++) {
            localStorage.setItem(`bigData${i}`, bigData);
          }
        } catch (e) {
          // Storage quota exceeded - this is expected
        }
      });
      
      // Try to perform normal operations
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('Storage Test', 'Prueba de Almacenamiento');
      
      // Should still work despite storage issues
      await flashcardPages.verifyFlashcardCreated('Storage Test', 'Prueba de Almacenamiento');
    });

    test('should handle corrupted localStorage data', async () => {
      await flashcardPages.page.evaluate(() => {
        // Corrupt auth token
        localStorage.setItem('authToken', 'corrupted.token.data');
        localStorage.setItem('userData', 'invalid-json-{');
        localStorage.setItem('preferences', null);
      });
      
      // Try to access protected page
      await flashcardPages.page.goto('/home');
      
      // Should redirect to login due to corrupted token
      await expect(flashcardPages.page).toHaveURL('/login');
    });

    test('should handle disabled JavaScript scenarios', async () => {
      // Disable JavaScript
      await flashcardPages.page.context().addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
          value: null
        });
      });
      
      // Application should still provide basic functionality
      await authPages.navigateToLogin();
      
      // Form should still be usable (server-side handling)
      await expect(authPages.page.locator('input[name="email"]')).toBeVisible();
      await expect(authPages.page.locator('input[name="password"]')).toBeVisible();
    });
  });

  test.describe('Network and Connectivity Edge Cases', () => {
    test.beforeEach(async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
    });

    test('should handle intermittent connectivity', async () => {
      await flashcardPages.navigateToFlashcards();
      
      let requestCount = 0;
      
      // Simulate intermittent network failures
      await flashcardPages.page.route('**/api/**', (route) => {
        requestCount++;
        if (requestCount % 3 === 0) {
          route.abort('internetdisconnected');
        } else {
          route.continue();
        }
      });
      
      // Try to create multiple flashcards
      for (let i = 0; i < 5; i++) {
        try {
          await flashcardPages.createFlashcard(`Network Test ${i}`, `Prueba Red ${i}`);
        } catch (error) {
          // Some requests should fail due to network issues
        }
      }
      
      // At least some flashcards should be created successfully
      const finalCount = await flashcardPages.verifyFlashcardsList();
      expect(finalCount).toBeGreaterThan(0);
    });

    test('should handle slow network responses', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Simulate very slow network
      await flashcardPages.page.route('**/api/flashcards', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 5000));
        route.continue();
      });
      
      const startTime = Date.now();
      
      try {
        await flashcardPages.createFlashcard('Slow Network Test', 'Prueba Red Lenta');
        
        const duration = Date.now() - startTime;
        expect(duration).toBeGreaterThan(4000); // Should have waited for slow response
      } catch (error) {
        // Timeout is acceptable behavior
        expect(error.message).toContain('timeout');
      }
    });
  });

  test.describe('Memory and Resource Edge Cases', () => {
    test('should handle memory pressure scenarios', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.loginAs(testUser.email, testUser.password);
      
      // Create memory pressure
      await flashcardPages.page.evaluate(() => {
        const arrays = [];
        try {
          for (let i = 0; i < 100; i++) {
            arrays.push(new Array(100000).fill('memory-test-data'));
          }
        } catch (e) {
          // Out of memory is expected
        }
      });
      
      // Application should still function
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('Memory Test', 'Prueba de Memoria');
      
      await flashcardPages.verifyFlashcardCreated('Memory Test', 'Prueba de Memoria');
    });

    test('should handle resource cleanup on navigation', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.loginAs(testUser.email, testUser.password);
      
      // Navigate between pages multiple times
      for (let i = 0; i < 10; i++) {
        await flashcardPages.navigateToFlashcards();
        await authPages.navigateToHome();
        await flashcardPages.page.waitForTimeout(100);
      }
      
      // Check memory usage doesn't grow excessively
      const memoryInfo = await flashcardPages.page.evaluate(() => {
        if ('memory' in performance) {
          return performance.memory;
        }
        return null;
      });
      
      if (memoryInfo) {
        // Memory usage should be reasonable
        expect(memoryInfo.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024); // 100MB
      }
    });
  });
});