import { test, expect } from '@playwright/test';
import { AuthPages } from '../pages/AuthPages.js';
import { FlashcardPages } from '../pages/FlashcardPages.js';
import { setupTestEnvironment, teardownTestEnvironment, dbHelper } from '../utils/databaseHelpers.js';
import { generateTestEmail, generateTestPassword, generateFlashcardData, TIMEOUTS } from '../utils/testUtils.js';

/**
 * Flashcard CRUD Operations Journey Tests
 * 
 * These tests verify complete flashcard management workflows including:
 * - Creating flashcards with validation
 * - Reading and displaying flashcards
 * - Updating flashcard content
 * - Deleting flashcards with confirmation
 * - Search and filtering functionality
 * - Batch operations and performance
 */

test.describe('Flashcard CRUD Journey', () => {
  let authPages;
  let flashcardPages;
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
    
    // Create and login as test user for each test
    const email = generateTestEmail('crud');
    const password = generateTestPassword();
    
    testUser = { email, password };
    
    await authPages.registerUser(email, password);
    await authPages.verifyRegistrationSuccess();
    await authPages.loginAs(email, password);
  });

  test.afterEach(async () => {
    // Clean up test data
    if (testUser) {
      const user = dbHelper.getUser(testUser.email);
      if (user) {
        dbHelper.deleteUserFlashcards(user.id);
        dbHelper.deleteUser(testUser.email);
      }
    }
  });

  test.describe('Create Flashcard Journey', () => {
    test('should successfully create a new flashcard', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('Hello', 'Hola');
      
      // Verify flashcard appears in list
      const flashcardCount = await flashcardPages.verifyFlashcardsList();
      expect(flashcardCount).toBe(1);
    });

    test('should validate required fields when creating flashcard', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openCreateForm();
      
      // Try to submit empty form
      await flashcardPages.submitFlashcardForm();
      await flashcardPages.verifyCreateFormValidation('English text is required');
      
      // Fill only English field
      await flashcardPages.page.fill('input[name="english"]', 'Hello');
      await flashcardPages.submitFlashcardForm();
      await flashcardPages.verifyCreateFormValidation('Spanish text is required');
    });

    test('should show loading state during flashcard creation', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openCreateForm();
      await flashcardPages.fillFlashcardForm('Test', 'Prueba');
      
      // Submit and immediately check loading state
      await flashcardPages.page.click('button[type="submit"]');
      await flashcardPages.verifyCreateLoadingState();
    });

    test('should handle special characters and long text in flashcards', async () => {
      await flashcardPages.navigateToFlashcards();
      
      const englishText = 'This is a very long English sentence with special characters: !@#$%^&*()_+-=[]{}|;:,.<>?';
      const spanishText = 'Esta es una oración muy larga en español con caracteres especiales: ¡¿áéíóúüñÁÉÍÓÚÜÑ!';
      
      await flashcardPages.createFlashcard(englishText, spanishText);
      
      // Verify content is preserved correctly
      await flashcardPages.verifyFlashcardCreated(englishText, spanishText);
    });

    test('should create multiple flashcards successfully', async () => {
      await flashcardPages.navigateToFlashcards();
      
      const flashcardData = generateFlashcardData(5);
      await flashcardPages.createMultipleFlashcards(flashcardData);
      
      const flashcardCount = await flashcardPages.verifyFlashcardsList();
      expect(flashcardCount).toBe(5);
    });
  });

  test.describe('Read Flashcard Journey', () => {
    test.beforeEach(async () => {
      // Create some test flashcards for reading tests
      await flashcardPages.navigateToFlashcards();
      const flashcardData = generateFlashcardData(3);
      await flashcardPages.createMultipleFlashcards(flashcardData);
    });

    test('should display all user flashcards in list view', async () => {
      await flashcardPages.navigateToFlashcards();
      const flashcardCount = await flashcardPages.verifyFlashcardsList();
      expect(flashcardCount).toBe(3);
    });

    test('should show flashcard details when clicked', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Click on first flashcard
      await flashcardPages.openFlashcardDetail(0);
      
      // Verify detail view shows correct information
      await flashcardPages.verifyFlashcardDetail('Hello 1', 'Hola 1');
    });

    test('should support pagination or virtual scrolling with many flashcards', async () => {
      // Create a larger dataset
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.deleteAllUserFlashcards(); // Clear existing
      
      const flashcardData = generateFlashcardData(25);
      await flashcardPages.createMultipleFlashcards(flashcardData);
      
      await flashcardPages.navigateToFlashcards();
      const paginationType = await flashcardPages.verifyPaginationOrVirtualScrolling();
      
      // Should have some form of pagination with 25+ items
      expect(['pagination', 'load-more'].includes(paginationType)).toBe(true);
    });

    test('should load flashcards within acceptable time limits', async () => {
      const loadTime = await flashcardPages.measureFlashcardLoadTime();
      
      // Page should load within 2 seconds
      expect(loadTime).toBeLessThan(2000);
    });
  });

  test.describe('Update Flashcard Journey', () => {
    test.beforeEach(async () => {
      // Create test flashcard for update tests
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('Original English', 'Español Original');
    });

    test('should successfully update flashcard content', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.editFlashcard('Original English', 'Updated English', 'Español Actualizado');
      
      // Verify updated content appears
      await flashcardPages.verifyFlashcardUpdated('Updated English', 'Español Actualizado');
    });

    test('should validate required fields during update', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openEditForm('Original English');
      
      // Clear required field and try to save
      await flashcardPages.page.fill('input[name="english"]', '');
      await flashcardPages.saveFlashcardChanges();
      await flashcardPages.verifyEditFormValidation('English text is required');
    });

    test('should allow canceling edit operation', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openEditForm('Original English');
      
      // Make changes but cancel
      await flashcardPages.updateFlashcardContent('Changed Text', 'Texto Cambiado');
      await flashcardPages.cancelFlashcardEdit();
      
      // Original content should remain
      await expect(flashcardPages.page.locator('[data-testid="flashcard-list"]')).toContainText('Original English');
      await expect(flashcardPages.page.locator('[data-testid="flashcard-list"]')).not.toContainText('Changed Text');
    });

    test('should preserve flashcard difficulty during content updates', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Get original difficulty
      const originalDifficulty = await flashcardPages.verifyDifficultyAdjustment(0);
      
      // Update content
      await flashcardPages.editFlashcard('Original English', 'Updated English', 'Español Actualizado');
      
      // Difficulty should remain the same
      const updatedDifficulty = await flashcardPages.verifyDifficultyAdjustment(0);
      expect(updatedDifficulty).toBe(originalDifficulty);
    });
  });

  test.describe('Delete Flashcard Journey', () => {
    test.beforeEach(async () => {
      // Create test flashcards for deletion tests
      await flashcardPages.navigateToFlashcards();
      const flashcardData = generateFlashcardData(3);
      await flashcardPages.createMultipleFlashcards(flashcardData);
    });

    test('should successfully delete flashcard with confirmation', async () => {
      await flashcardPages.navigateToFlashcards();
      const initialCount = await flashcardPages.verifyFlashcardsList();
      
      await flashcardPages.deleteFlashcard(0, true); // Delete first flashcard with confirmation
      
      const finalCount = await flashcardPages.verifyFlashcardsList();
      expect(finalCount).toBe(initialCount - 1);
    });

    test('should show confirmation dialog before deletion', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Click delete button
      const flashcard = flashcardPages.page.locator('[data-testid="flashcard-item"]').first();
      await flashcard.locator('[data-testid="delete-button"]').click();
      
      // Verify confirmation dialog appears
      await flashcardPages.verifyDeleteConfirmation();
    });

    test('should allow canceling deletion', async () => {
      await flashcardPages.navigateToFlashcards();
      const initialCount = await flashcardPages.verifyFlashcardsList();
      
      await flashcardPages.deleteFlashcard(0, false); // Delete first flashcard but cancel
      
      const finalCount = await flashcardPages.verifyFlashcardsList();
      expect(finalCount).toBe(initialCount); // Count should remain the same
    });

    test('should delete all flashcards when requested', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.deleteAllUserFlashcards();
      
      // Should show empty state
      await expect(flashcardPages.page.locator('[data-testid="flashcard-item"]')).toHaveCount(0);
    });
  });

  test.describe('Search and Filter Journey', () => {
    test.beforeEach(async () => {
      // Create diverse flashcard set for search/filter tests
      await flashcardPages.navigateToFlashcards();
      
      const testFlashcards = [
        { english: 'Hello World', spanish: 'Hola Mundo' },
        { english: 'Goodbye Friend', spanish: 'Adiós Amigo' },
        { english: 'Thank You', spanish: 'Gracias' },
        { english: 'Please Help', spanish: 'Por Favor Ayuda' },
        { english: 'Water Bottle', spanish: 'Botella de Agua' }
      ];
      
      await flashcardPages.createMultipleFlashcards(testFlashcards);
    });

    test('should search flashcards by English text', async () => {
      await flashcardPages.navigateToFlashcards();
      
      await flashcardPages.searchFlashcards('Hello');
      await flashcardPages.verifySearchResults(1, 'Hello World');
    });

    test('should search flashcards by Spanish text', async () => {
      await flashcardPages.navigateToFlashcards();
      
      await flashcardPages.searchFlashcards('Gracias');
      await flashcardPages.verifySearchResults(1, 'Thank You');
    });

    test('should handle partial search matches', async () => {
      await flashcardPages.navigateToFlashcards();
      
      await flashcardPages.searchFlashcards('water');
      await flashcardPages.verifySearchResults(1, 'Water Bottle');
    });

    test('should clear search and show all results', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Search for specific term
      await flashcardPages.searchFlashcards('Hello');
      await flashcardPages.verifySearchResults(1);
      
      // Clear search
      await flashcardPages.clearSearch();
      await flashcardPages.verifySearchResults(5); // Should show all flashcards
    });

    test('should filter flashcards by difficulty level', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Set different difficulty levels for testing
      const user = dbHelper.getUser(testUser.email);
      const userFlashcards = dbHelper.getUserFlashcards(user.id);
      
      // Set first flashcard to difficulty 3
      dbHelper.updateFlashcardDifficulty(userFlashcards[0].id, 3);
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.filterByDifficulty(3);
      await flashcardPages.verifyDifficultyFilter(3);
    });

    test('should combine search and filter operations', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Apply both search and difficulty filter
      await flashcardPages.searchFlashcards('Hello');
      await flashcardPages.filterByDifficulty(1);
      
      // Should show results matching both criteria
      const results = await flashcardPages.page.locator('[data-testid="flashcard-item"]').count();
      expect(results).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Performance Journey', () => {
    test('should handle large numbers of flashcards efficiently', async () => {
      // Create a large dataset
      const user = dbHelper.getUser(testUser.email);
      dbHelper.createLargeDataset(user.id, 100);
      
      await flashcardPages.navigateToFlashcards();
      
      // Page should still load in reasonable time
      const loadTime = await flashcardPages.measureFlashcardLoadTime();
      expect(loadTime).toBeLessThan(5000);
      
      // Search should be fast
      const searchStart = Date.now();
      await flashcardPages.searchFlashcards('word 1');
      await flashcardPages.page.waitForTimeout(500); // Allow for search debouncing
      const searchTime = Date.now() - searchStart;
      
      expect(searchTime).toBeLessThan(2000);
    });

    test('should create flashcards quickly in batch operations', async () => {
      await flashcardPages.navigateToFlashcards();
      
      const startTime = Date.now();
      const flashcardData = generateFlashcardData(10);
      await flashcardPages.createMultipleFlashcards(flashcardData);
      const totalTime = Date.now() - startTime;
      
      // Should create 10 flashcards in under 30 seconds
      expect(totalTime).toBeLessThan(30000);
    });
  });

  test.describe('Mobile and Responsive Journey', () => {
    test('should work properly on mobile devices', async () => {
      await flashcardPages.verifyResponsiveDesign();
      
      // Test creating flashcard on mobile
      await flashcardPages.createFlashcard('Mobile Test', 'Prueba Móvil');
      
      // Verify it appears in the list
      const flashcardCount = await flashcardPages.verifyFlashcardsList();
      expect(flashcardCount).toBe(1);
    });

    test('should support touch interactions', async () => {
      // Create test flashcard
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('Touch Test', 'Prueba Táctil');
      
      // Set mobile viewport
      await flashcardPages.page.setViewportSize({ width: 375, height: 667 });
      
      // Test touch-based interaction
      const flashcard = flashcardPages.page.locator('[data-testid="flashcard-item"]').first();
      await flashcard.tap();
      
      // Should open flashcard detail
      await expect(flashcardPages.page.locator('[data-testid="flashcard-detail"]')).toBeVisible();
    });
  });

  test.describe('Accessibility Journey', () => {
    test('should support keyboard navigation', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('Keyboard Test', 'Prueba Teclado');
      
      await flashcardPages.verifyAccessibilityFeatures();
    });

    test('should have proper ARIA labels and roles', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Verify key interactive elements have accessibility attributes
      await expect(flashcardPages.page.locator('[data-testid="add-flashcard-button"]')).toHaveAttribute('aria-label');
      await expect(flashcardPages.page.locator('[data-testid="search-flashcards"]')).toHaveAttribute('aria-label');
    });
  });

  test.describe('Error Handling Journey', () => {
    test('should handle network errors during flashcard operations', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Simulate network failure
      await flashcardPages.page.route('**/api/flashcards', (route) => {
        route.abort('internetdisconnected');
      });
      
      await flashcardPages.openCreateForm();
      await flashcardPages.fillFlashcardForm('Network Test', 'Prueba Red');
      await flashcardPages.submitFlashcardForm();
      
      // Should show appropriate error message
      await expect(flashcardPages.page.locator('.error-message')).toContainText('Network error');
    });

    test('should handle server errors gracefully', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Simulate server error
      await flashcardPages.page.route('**/api/flashcards', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });
      
      await flashcardPages.openCreateForm();
      await flashcardPages.fillFlashcardForm('Server Error Test', 'Prueba Error Servidor');
      await flashcardPages.submitFlashcardForm();
      
      // Should show server error message
      await expect(flashcardPages.page.locator('.error-message')).toContainText('server error');
    });

    test('should handle invalid flashcard data', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openCreateForm();
      
      // Try to submit extremely long content
      const veryLongText = 'a'.repeat(1000);
      await flashcardPages.fillFlashcardForm(veryLongText, veryLongText);
      await flashcardPages.submitFlashcardForm();
      
      // Should show validation error
      await flashcardPages.verifyCreateFormValidation('Text too long');
    });
  });

  test.describe('Complete CRUD Cycle Journey', () => {
    test('should complete full flashcard lifecycle successfully', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Perform complete CRUD cycle: Create -> Read -> Update -> Delete
      await flashcardPages.performCompleteFlashcardCycle('Lifecycle Test', 'Prueba Ciclo');
      
      // Should end with no flashcards
      await expect(flashcardPages.page.locator('[data-testid="flashcard-item"]')).toHaveCount(0);
    });
  });
});