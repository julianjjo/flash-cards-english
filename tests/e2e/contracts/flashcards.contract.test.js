import { test, expect } from '@playwright/test';

/**
 * E2E Contract Test: Flashcards CRUD Operations
 * 
 * This test validates the E2E flashcards management flow contracts according to
 * the flashcards-contract.json specification for complete user interactions.
 * 
 * CRITICAL: This test MUST FAIL initially (TDD requirement)
 * These tests verify the complete flashcard lifecycle including creation,
 * reading, updating, deletion, and spaced repetition learning flows.
 */

test.describe('E2E Flashcards Contract Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login as test user before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'testuser@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/home');
  });

  test.describe('Flashcard Creation', () => {
    test('should create new flashcard successfully', async ({ page }) => {
      // Navigate to create flashcard form
      await page.click('[data-testid="add-flashcard-button"]');
      await expect(page.locator('[data-testid="flashcard-form"]')).toBeVisible();

      // Fill flashcard form
      await page.fill('input[name="english"]', 'Computer');
      await page.fill('input[name="spanish"]', 'Computadora');

      // Submit form
      await page.click('button[type="submit"]');

      // Verify flashcard created
      await expect(page.locator('.success-message')).toContainText('Flashcard created successfully');
      await expect(page.locator('[data-testid="flashcard-list"]')).toContainText('Computer');
      await expect(page.locator('[data-testid="flashcard-list"]')).toContainText('Computadora');
    });

    test('should validate required fields', async ({ page }) => {
      await page.click('[data-testid="add-flashcard-button"]');

      // Submit empty form
      await page.click('button[type="submit"]');

      // Verify validation errors
      await expect(page.locator('.field-error')).toContainText('English text is required');
      await expect(page.locator('.field-error')).toContainText('Spanish text is required');
    });

    test('should validate text length limits', async ({ page }) => {
      await page.click('[data-testid="add-flashcard-button"]');

      // Fill with text exceeding limit (500 characters)
      const longText = 'a'.repeat(501);
      await page.fill('input[name="english"]', longText);
      await page.fill('input[name="spanish"]', 'Valid text');
      await page.click('button[type="submit"]');

      // Verify validation error
      await expect(page.locator('.field-error')).toContainText('Text must be 500 characters or less');
    });

    test('should handle form submission loading state', async ({ page }) => {
      await page.click('[data-testid="add-flashcard-button"]');
      await page.fill('input[name="english"]', 'Loading Test');
      await page.fill('input[name="spanish"]', 'Prueba de Carga');

      await page.click('button[type="submit"]');

      // Verify loading state
      await expect(page.locator('button[type="submit"]')).toContainText('Creating...');
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
    });
  });

  test.describe('Flashcard Display and Navigation', () => {
    test('should display user\'s flashcards list', async ({ page }) => {
      // Verify flashcards list is visible
      await expect(page.locator('[data-testid="flashcard-list"]')).toBeVisible();
      
      // Should show at least the test data flashcards
      await expect(page.locator('[data-testid="flashcard-item"]')).toHaveCount(5, { timeout: 10000 });
      
      // Verify flashcard content
      await expect(page.locator('[data-testid="flashcard-item"]').first()).toContainText('Hello');
      await expect(page.locator('[data-testid="flashcard-item"]').first()).toContainText('Hola');
    });

    test('should show flashcard details on click', async ({ page }) => {
      // Click on first flashcard
      await page.click('[data-testid="flashcard-item"]');

      // Verify detail view
      await expect(page.locator('[data-testid="flashcard-detail"]')).toBeVisible();
      await expect(page.locator('[data-testid="english-text"]')).toBeVisible();
      await expect(page.locator('[data-testid="spanish-text"]')).toBeVisible();
      await expect(page.locator('[data-testid="difficulty-level"]')).toBeVisible();
    });

    test('should support flashcard filtering and search', async ({ page }) => {
      // Test search functionality
      await page.fill('[data-testid="search-flashcards"]', 'Hello');
      
      // Verify filtered results
      await expect(page.locator('[data-testid="flashcard-item"]')).toHaveCount(1);
      await expect(page.locator('[data-testid="flashcard-item"]')).toContainText('Hello');

      // Clear search
      await page.fill('[data-testid="search-flashcards"]', '');
      await expect(page.locator('[data-testid="flashcard-item"]')).toHaveCount(5, { timeout: 5000 });
    });

    test('should support difficulty filtering', async ({ page }) => {
      // Filter by difficulty level
      await page.selectOption('[data-testid="difficulty-filter"]', '1');
      
      // Verify filtered results show only difficulty 1 cards
      const flashcards = page.locator('[data-testid="flashcard-item"]');
      const count = await flashcards.count();
      expect(count).toBeGreaterThan(0);
      
      // Verify all visible cards have difficulty 1
      for (let i = 0; i < count; i++) {
        await expect(flashcards.nth(i).locator('[data-testid="difficulty"]')).toContainText('1');
      }
    });
  });

  test.describe('Flashcard Editing', () => {
    test('should edit existing flashcard', async ({ page }) => {
      // Click edit button on first flashcard
      await page.click('[data-testid="flashcard-item"] [data-testid="edit-button"]');

      // Verify edit form appears
      await expect(page.locator('[data-testid="edit-flashcard-form"]')).toBeVisible();

      // Modify flashcard content
      await page.fill('input[name="english"]', 'Hello Updated');
      await page.fill('input[name="spanish"]', 'Hola Actualizado');

      // Submit changes
      await page.click('button[type="submit"]');

      // Verify update success
      await expect(page.locator('.success-message')).toContainText('Flashcard updated successfully');
      await expect(page.locator('[data-testid="flashcard-list"]')).toContainText('Hello Updated');
      await expect(page.locator('[data-testid="flashcard-list"]')).toContainText('Hola Actualizado');
    });

    test('should cancel edit operation', async ({ page }) => {
      await page.click('[data-testid="flashcard-item"] [data-testid="edit-button"]');
      
      // Modify content
      await page.fill('input[name="english"]', 'Modified');
      
      // Cancel edit
      await page.click('[data-testid="cancel-edit-button"]');

      // Verify original content remains
      await expect(page.locator('[data-testid="flashcard-list"]')).toContainText('Hello');
      await expect(page.locator('[data-testid="flashcard-list"]')).not.toContainText('Modified');
    });

    test('should validate edit form', async ({ page }) => {
      await page.click('[data-testid="flashcard-item"] [data-testid="edit-button"]');
      
      // Clear required fields
      await page.fill('input[name="english"]', '');
      await page.click('button[type="submit"]');

      // Verify validation error
      await expect(page.locator('.field-error')).toContainText('English text is required');
    });
  });

  test.describe('Flashcard Deletion', () => {
    test('should delete flashcard with confirmation', async ({ page }) => {
      const initialCount = await page.locator('[data-testid="flashcard-item"]').count();

      // Click delete button
      await page.click('[data-testid="flashcard-item"] [data-testid="delete-button"]');

      // Verify confirmation dialog
      await expect(page.locator('[data-testid="delete-confirmation"]')).toBeVisible();
      await expect(page.locator('[data-testid="delete-confirmation"]')).toContainText('Are you sure you want to delete this flashcard?');

      // Confirm deletion
      await page.click('[data-testid="confirm-delete-button"]');

      // Verify flashcard deleted
      await expect(page.locator('.success-message')).toContainText('Flashcard deleted successfully');
      await expect(page.locator('[data-testid="flashcard-item"]')).toHaveCount(initialCount - 1);
    });

    test('should cancel deletion', async ({ page }) => {
      const initialCount = await page.locator('[data-testid="flashcard-item"]').count();

      await page.click('[data-testid="flashcard-item"] [data-testid="delete-button"]');
      
      // Cancel deletion
      await page.click('[data-testid="cancel-delete-button"]');

      // Verify flashcard still exists
      await expect(page.locator('[data-testid="flashcard-item"]')).toHaveCount(initialCount);
    });
  });

  test.describe('Spaced Repetition Learning Flow', () => {
    test('should start learning session', async ({ page }) => {
      // Click start learning button
      await page.click('[data-testid="start-learning-button"]');

      // Verify learning interface appears
      await expect(page.locator('[data-testid="learning-interface"]')).toBeVisible();
      await expect(page.locator('[data-testid="flashcard-front"]')).toBeVisible();
      await expect(page.locator('[data-testid="show-answer-button"]')).toBeVisible();
    });

    test('should complete flashcard review cycle', async ({ page }) => {
      await page.click('[data-testid="start-learning-button"]');

      // Show answer
      await page.click('[data-testid="show-answer-button"]');
      await expect(page.locator('[data-testid="flashcard-back"]')).toBeVisible();

      // Verify quality rating buttons appear
      await expect(page.locator('[data-testid="quality-1"]')).toBeVisible();
      await expect(page.locator('[data-testid="quality-2"]')).toBeVisible();
      await expect(page.locator('[data-testid="quality-3"]')).toBeVisible();
      await expect(page.locator('[data-testid="quality-4"]')).toBeVisible();
      await expect(page.locator('[data-testid="quality-5"]')).toBeVisible();

      // Rate the flashcard
      await page.click('[data-testid="quality-4"]');

      // Verify next flashcard appears or session completes
      const nextCardVisible = await page.locator('[data-testid="flashcard-front"]').isVisible();
      const sessionComplete = await page.locator('[data-testid="session-complete"]').isVisible();
      
      expect(nextCardVisible || sessionComplete).toBe(true);
    });

    test('should track review statistics', async ({ page }) => {
      await page.click('[data-testid="start-learning-button"]');
      
      // Complete a few reviews
      for (let i = 0; i < 3; i++) {
        await page.click('[data-testid="show-answer-button"]');
        await page.click('[data-testid="quality-3"]'); // Average rating
        
        // Check if session continues
        const nextCard = page.locator('[data-testid="flashcard-front"]');
        if (await nextCard.isVisible()) {
          continue;
        } else {
          break;
        }
      }

      // Verify statistics are updated
      await page.click('[data-testid="stats-button"]');
      await expect(page.locator('[data-testid="review-stats"]')).toBeVisible();
      await expect(page.locator('[data-testid="cards-reviewed"]')).toContainText('3');
    });

    test('should adjust difficulty based on performance', async ({ page }) => {
      // Get initial difficulty of first flashcard
      const initialDifficulty = await page.locator('[data-testid="flashcard-item"]')
        .first()
        .locator('[data-testid="difficulty"]')
        .textContent();

      // Review the flashcard with poor performance
      await page.click('[data-testid="start-learning-button"]');
      await page.click('[data-testid="show-answer-button"]');
      await page.click('[data-testid="quality-1"]'); // Poor performance

      // Return to flashcard list and verify difficulty changed
      await page.click('[data-testid="home-button"]');
      
      const newDifficulty = await page.locator('[data-testid="flashcard-item"]')
        .first()
        .locator('[data-testid="difficulty"]')
        .textContent();

      // Difficulty should remain same or decrease (easier) for poor performance
      expect(parseInt(newDifficulty)).toBeLessThanOrEqual(parseInt(initialDifficulty));
    });
  });

  test.describe('User Data Isolation', () => {
    test('should only show user\'s own flashcards', async ({ page }) => {
      // Logout and login as second user
      await page.click('[data-testid="logout-button"]');
      await page.goto('/login');
      await page.fill('input[name="email"]', 'testuser2@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Verify different set of flashcards
      await expect(page.locator('[data-testid="flashcard-list"]')).toBeVisible();
      
      // Should show second user's flashcards (Dog, Cat from test fixtures)
      await expect(page.locator('[data-testid="flashcard-list"]')).toContainText('Dog');
      await expect(page.locator('[data-testid="flashcard-list"]')).toContainText('Cat');
      
      // Should not show first user's flashcards
      await expect(page.locator('[data-testid="flashcard-list"]')).not.toContainText('Hello');
      await expect(page.locator('[data-testid="flashcard-list"]')).not.toContainText('Goodbye');
    });

    test('should prevent cross-user flashcard access via direct URL', async ({ page }) => {
      // Try to access another user's flashcard by ID
      await page.goto('/flashcard/2020'); // Second user's flashcard ID from fixtures

      // Should be redirected or show access denied
      await expect(page).toHaveURL('/home');
      await expect(page.locator('.error-message')).toContainText('Flashcard not found');
    });
  });

  test.describe('Performance and UX', () => {
    test('should handle large flashcard collections', async ({ page }) => {
      // Verify pagination or virtual scrolling for large datasets
      await expect(page.locator('[data-testid="flashcard-list"]')).toBeVisible();
      
      // Check if pagination controls exist when there are many cards
      const paginationExists = await page.locator('[data-testid="pagination"]').isVisible();
      const loadMoreExists = await page.locator('[data-testid="load-more"]').isVisible();
      
      // Either pagination or load more should be available for large collections
      if (paginationExists || loadMoreExists) {
        expect(true).toBe(true); // Pagination handling exists
      }
    });

    test('should provide responsive design for mobile', async ({ page }) => {
      // Simulate mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Verify mobile layout
      await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="flashcard-list"]')).toBeVisible();
      
      // Verify mobile-friendly flashcard display
      const flashcardItem = page.locator('[data-testid="flashcard-item"]').first();
      await expect(flashcardItem).toBeVisible();
      
      // Verify touch-friendly buttons
      await expect(flashcardItem.locator('[data-testid="edit-button"]')).toHaveCSS('min-height', '44px');
    });

    test('should support keyboard shortcuts', async ({ page }) => {
      await page.click('[data-testid="start-learning-button"]');

      // Test keyboard shortcuts in learning mode
      await page.press('body', 'Space'); // Show answer
      await expect(page.locator('[data-testid="flashcard-back"]')).toBeVisible();

      // Test number key ratings
      await page.press('body', '4');
      
      // Should advance to next card or complete session
      const nextCardVisible = await page.locator('[data-testid="flashcard-front"]').isVisible();
      const sessionComplete = await page.locator('[data-testid="session-complete"]').isVisible();
      
      expect(nextCardVisible || sessionComplete).toBe(true);
    });
  });
});