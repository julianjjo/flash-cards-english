import { expect } from '@playwright/test';

/**
 * Page Object Model for Flashcard Management Pages
 * 
 * This module provides reusable methods for interacting with flashcard
 * related functionality including CRUD operations, learning sessions,
 * and spaced repetition workflows.
 * 
 * Usage:
 *   const flashcardPages = new FlashcardPages(page);
 *   await flashcardPages.createFlashcard('Hello', 'Hola');
 */

export class FlashcardPages {
  constructor(page) {
    this.page = page;
  }

  // Navigation methods
  async navigateToFlashcards() {
    await this.page.goto('/home');
    await expect(this.page).toHaveURL('/home');
    await expect(this.page.locator('[data-testid="flashcard-list"]')).toBeVisible();
  }

  // Flashcard creation methods
  async createFlashcard(englishText, spanishText) {
    await this.openCreateForm();
    await this.fillFlashcardForm(englishText, spanishText);
    await this.submitFlashcardForm();
    await this.verifyFlashcardCreated(englishText, spanishText);
  }

  async openCreateForm() {
    await this.page.click('[data-testid="add-flashcard-button"]');
    await expect(this.page.locator('[data-testid="flashcard-form"]')).toBeVisible();
  }

  async fillFlashcardForm(englishText, spanishText) {
    await this.page.fill('input[name="english"]', englishText);
    await this.page.fill('input[name="spanish"]', spanishText);
  }

  async submitFlashcardForm() {
    await this.page.click('button[type="submit"]');
  }

  async verifyFlashcardCreated(englishText, spanishText) {
    await expect(this.page.locator('.success-message')).toContainText('Flashcard created successfully');
    await expect(this.page.locator('[data-testid="flashcard-list"]')).toContainText(englishText);
    await expect(this.page.locator('[data-testid="flashcard-list"]')).toContainText(spanishText);
  }

  async verifyCreateFormValidation(expectedError) {
    await expect(this.page.locator('.field-error')).toContainText(expectedError);
  }

  async verifyCreateLoadingState() {
    await expect(this.page.locator('button[type="submit"]')).toContainText('Creating...');
    await expect(this.page.locator('button[type="submit"]')).toBeDisabled();
  }

  // Flashcard display and interaction methods
  async verifyFlashcardsList() {
    await expect(this.page.locator('[data-testid="flashcard-list"]')).toBeVisible();
    const flashcardItems = this.page.locator('[data-testid="flashcard-item"]');
    expect(await flashcardItems.count()).toBeGreaterThan(0);
    return await flashcardItems.count();
  }

  async getFlashcardByText(text) {
    return this.page.locator('[data-testid="flashcard-item"]').filter({ hasText: text });
  }

  async openFlashcardDetail(identifier) {
    let flashcard;
    if (typeof identifier === 'string') {
      flashcard = await this.getFlashcardByText(identifier);
    } else {
      flashcard = this.page.locator('[data-testid="flashcard-item"]').nth(identifier);
    }
    
    await flashcard.click();
    await expect(this.page.locator('[data-testid="flashcard-detail"]')).toBeVisible();
    return flashcard;
  }

  async verifyFlashcardDetail(englishText, spanishText) {
    await expect(this.page.locator('[data-testid="english-text"]')).toContainText(englishText);
    await expect(this.page.locator('[data-testid="spanish-text"]')).toContainText(spanishText);
    await expect(this.page.locator('[data-testid="difficulty-level"]')).toBeVisible();
  }

  // Search and filtering methods
  async searchFlashcards(searchTerm) {
    await this.page.fill('[data-testid="search-flashcards"]', searchTerm);
    await this.page.waitForTimeout(500); // Allow for search debouncing
  }

  async verifySearchResults(expectedCount, expectedText = null) {
    await expect(this.page.locator('[data-testid="flashcard-item"]')).toHaveCount(expectedCount);
    
    if (expectedText) {
      await expect(this.page.locator('[data-testid="flashcard-item"]')).toContainText(expectedText);
    }
  }

  async clearSearch() {
    await this.page.fill('[data-testid="search-flashcards"]', '');
    await this.page.waitForTimeout(500);
  }

  async filterByDifficulty(difficulty) {
    await this.page.selectOption('[data-testid="difficulty-filter"]', difficulty.toString());
    await this.page.waitForTimeout(500);
  }

  async verifyDifficultyFilter(expectedDifficulty) {
    const flashcards = this.page.locator('[data-testid="flashcard-item"]');
    const count = await flashcards.count();
    
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(flashcards.nth(i).locator('[data-testid="difficulty"]')).toContainText(expectedDifficulty.toString());
      }
    }
  }

  // Flashcard editing methods
  async editFlashcard(identifier, newEnglish, newSpanish) {
    await this.openEditForm(identifier);
    await this.updateFlashcardContent(newEnglish, newSpanish);
    await this.saveFlashcardChanges();
    await this.verifyFlashcardUpdated(newEnglish, newSpanish);
  }

  async openEditForm(identifier) {
    let flashcard;
    if (typeof identifier === 'string') {
      flashcard = await this.getFlashcardByText(identifier);
    } else {
      flashcard = this.page.locator('[data-testid="flashcard-item"]').nth(identifier);
    }
    
    await flashcard.locator('[data-testid="edit-button"]').click();
    await expect(this.page.locator('[data-testid="edit-flashcard-form"]')).toBeVisible();
  }

  async updateFlashcardContent(englishText, spanishText) {
    await this.page.fill('input[name="english"]', englishText);
    await this.page.fill('input[name="spanish"]', spanishText);
  }

  async saveFlashcardChanges() {
    await this.page.click('button[type="submit"]');
  }

  async cancelFlashcardEdit() {
    await this.page.click('[data-testid="cancel-edit-button"]');
  }

  async verifyFlashcardUpdated(englishText, spanishText) {
    await expect(this.page.locator('.success-message')).toContainText('Flashcard updated successfully');
    await expect(this.page.locator('[data-testid="flashcard-list"]')).toContainText(englishText);
    await expect(this.page.locator('[data-testid="flashcard-list"]')).toContainText(spanishText);
  }

  async verifyEditFormValidation(expectedError) {
    await expect(this.page.locator('.field-error')).toContainText(expectedError);
  }

  // Flashcard deletion methods
  async deleteFlashcard(identifier, confirm = true) {
    const initialCount = await this.verifyFlashcardsList();
    
    let flashcard;
    if (typeof identifier === 'string') {
      flashcard = await this.getFlashcardByText(identifier);
    } else {
      flashcard = this.page.locator('[data-testid="flashcard-item"]').nth(identifier);
    }
    
    await flashcard.locator('[data-testid="delete-button"]').click();
    await this.verifyDeleteConfirmation();
    
    if (confirm) {
      await this.confirmDeletion();
      await this.verifyFlashcardDeleted(initialCount);
    } else {
      await this.cancelDeletion();
      await this.verifyDeletionCancelled(initialCount);
    }
  }

  async verifyDeleteConfirmation() {
    await expect(this.page.locator('[data-testid="delete-confirmation"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="delete-confirmation"]')).toContainText('Are you sure you want to delete this flashcard?');
  }

  async confirmDeletion() {
    await this.page.click('[data-testid="confirm-delete-button"]');
  }

  async cancelDeletion() {
    await this.page.click('[data-testid="cancel-delete-button"]');
  }

  async verifyFlashcardDeleted(previousCount) {
    await expect(this.page.locator('.success-message')).toContainText('Flashcard deleted successfully');
    await expect(this.page.locator('[data-testid="flashcard-item"]')).toHaveCount(previousCount - 1);
  }

  async verifyDeletionCancelled(previousCount) {
    await expect(this.page.locator('[data-testid="flashcard-item"]')).toHaveCount(previousCount);
  }

  // Learning session methods
  async startLearningSession() {
    await this.page.click('[data-testid="start-learning-button"]');
    await expect(this.page.locator('[data-testid="learning-interface"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="flashcard-front"]')).toBeVisible();
  }

  async showAnswer() {
    await this.page.click('[data-testid="show-answer-button"]');
    await expect(this.page.locator('[data-testid="flashcard-back"]')).toBeVisible();
    await this.verifyQualityRatingButtons();
  }

  async verifyQualityRatingButtons() {
    for (let i = 1; i <= 5; i++) {
      await expect(this.page.locator(`[data-testid="quality-${i}"]`)).toBeVisible();
    }
  }

  async rateFlashcard(quality) {
    await this.page.click(`[data-testid="quality-${quality}"]`);
  }

  async completeFlashcardReview(quality = 3) {
    await this.showAnswer();
    await this.rateFlashcard(quality);
  }

  async verifyNextCardOrSessionComplete() {
    const nextCardVisible = await this.page.locator('[data-testid="flashcard-front"]').isVisible();
    const sessionComplete = await this.page.locator('[data-testid="session-complete"]').isVisible();
    
    expect(nextCardVisible || sessionComplete).toBe(true);
    return nextCardVisible ? 'next-card' : 'session-complete';
  }

  async completeMultipleReviews(count = 3, quality = 3) {
    let reviewsCompleted = 0;
    
    for (let i = 0; i < count; i++) {
      const result = await this.verifyNextCardOrSessionComplete();
      if (result === 'session-complete') {
        break;
      }
      
      await this.completeFlashcardReview(quality);
      reviewsCompleted++;
    }
    
    return reviewsCompleted;
  }

  // Statistics and progress methods
  async viewStatistics() {
    await this.page.click('[data-testid="stats-button"]');
    await expect(this.page.locator('[data-testid="review-stats"]')).toBeVisible();
  }

  async verifyReviewStatistics(expectedReviews) {
    await expect(this.page.locator('[data-testid="cards-reviewed"]')).toContainText(expectedReviews.toString());
  }

  async verifyDifficultyAdjustment(flashcardIdentifier, expectedDirection) {
    const flashcard = typeof flashcardIdentifier === 'string' 
      ? await this.getFlashcardByText(flashcardIdentifier)
      : this.page.locator('[data-testid="flashcard-item"]').nth(flashcardIdentifier);
    
    const difficultyElement = flashcard.locator('[data-testid="difficulty"]');
    const currentDifficulty = parseInt(await difficultyElement.textContent());
    
    // Return current difficulty for comparison in tests
    return currentDifficulty;
  }

  // User data isolation methods
  async verifyUserFlashcardsOnly(expectedTexts) {
    await this.navigateToFlashcards();
    
    const flashcardItems = this.page.locator('[data-testid="flashcard-item"]');
    const count = await flashcardItems.count();
    
    // Verify expected flashcards are present
    for (const text of expectedTexts) {
      await expect(this.page.locator('[data-testid="flashcard-list"]')).toContainText(text);
    }
    
    return count;
  }

  async verifyNoUnauthorizedFlashcards(forbiddenTexts) {
    for (const text of forbiddenTexts) {
      await expect(this.page.locator('[data-testid="flashcard-list"]')).not.toContainText(text);
    }
  }

  async attemptUnauthorizedAccess(flashcardId) {
    await this.page.goto(`/flashcard/${flashcardId}`);
    
    // Should be redirected or show access denied
    await expect(this.page).toHaveURL('/home');
    await expect(this.page.locator('.error-message')).toContainText('Flashcard not found');
  }

  // Performance and UX methods
  async verifyResponsiveDesign() {
    await this.page.setViewportSize({ width: 375, height: 667 });
    await this.navigateToFlashcards();
    
    // Verify mobile layout
    await expect(this.page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="flashcard-list"]')).toBeVisible();
    
    // Verify touch-friendly buttons
    const flashcardItem = this.page.locator('[data-testid="flashcard-item"]').first();
    await expect(flashcardItem.locator('[data-testid="edit-button"]')).toHaveCSS('min-height', '44px');
  }

  async verifyPaginationOrVirtualScrolling() {
    await this.navigateToFlashcards();
    
    const paginationExists = await this.page.locator('[data-testid="pagination"]').isVisible();
    const loadMoreExists = await this.page.locator('[data-testid="load-more"]').isVisible();
    
    // Return which pagination method is used
    if (paginationExists) return 'pagination';
    if (loadMoreExists) return 'load-more';
    return 'none';
  }

  // Keyboard shortcuts and accessibility
  async testKeyboardShortcuts() {
    await this.startLearningSession();
    
    // Test spacebar for show answer
    await this.page.press('body', 'Space');
    await expect(this.page.locator('[data-testid="flashcard-back"]')).toBeVisible();
    
    // Test number key for rating
    await this.page.press('body', '4');
    
    return await this.verifyNextCardOrSessionComplete();
  }

  async verifyAccessibilityFeatures() {
    await this.navigateToFlashcards();
    
    // Verify ARIA labels and roles
    await expect(this.page.locator('[data-testid="add-flashcard-button"]')).toHaveAttribute('aria-label');
    await expect(this.page.locator('[data-testid="search-flashcards"]')).toHaveAttribute('aria-label');
    
    // Verify keyboard navigation
    await this.page.press('body', 'Tab');
    const focusedElement = this.page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  }

  // Batch operations and utilities
  async createMultipleFlashcards(flashcardData) {
    const createdCards = [];
    
    for (const { english, spanish } of flashcardData) {
      await this.createFlashcard(english, spanish);
      createdCards.push({ english, spanish });
    }
    
    return createdCards;
  }

  async deleteAllUserFlashcards() {
    await this.navigateToFlashcards();
    
    let flashcardCount = await this.verifyFlashcardsList();
    
    while (flashcardCount > 0) {
      await this.deleteFlashcard(0); // Always delete first card
      flashcardCount--;
    }
    
    await expect(this.page.locator('[data-testid="flashcard-item"]')).toHaveCount(0);
  }

  async measureFlashcardLoadTime() {
    const startTime = Date.now();
    await this.navigateToFlashcards();
    await expect(this.page.locator('[data-testid="flashcard-list"]')).toBeVisible();
    const loadTime = Date.now() - startTime;
    
    return loadTime;
  }

  // Common test patterns
  async performCompleteFlashcardCycle(english, spanish) {
    // Create -> View -> Edit -> Delete cycle
    await this.createFlashcard(english, spanish);
    await this.openFlashcardDetail(english);
    await this.verifyFlashcardDetail(english, spanish);
    
    await this.navigateToFlashcards();
    await this.editFlashcard(english, `${english} Updated`, `${spanish} Actualizado`);
    
    await this.deleteFlashcard(`${english} Updated`);
  }

  async performLearningSessionFlow(sessionLength = 5) {
    await this.startLearningSession();
    
    const completedReviews = await this.completeMultipleReviews(sessionLength);
    
    if (await this.page.locator('[data-testid="session-complete"]').isVisible()) {
      await this.verifyReviewStatistics(completedReviews);
    }
    
    return completedReviews;
  }
}

export default FlashcardPages;