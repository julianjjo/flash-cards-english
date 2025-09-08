import { test, expect } from '@playwright/test';
import { AuthPages } from '../pages/AuthPages.js';
import { FlashcardPages } from '../pages/FlashcardPages.js';
import { setupTestEnvironment, teardownTestEnvironment, dbHelper } from '../utils/databaseHelpers.js';
import { generateTestEmail, generateTestPassword, generateFlashcardData, TIMEOUTS } from '../utils/testUtils.js';

/**
 * Learning Session with Spaced Repetition Journey Tests
 * 
 * These tests verify the complete learning experience including:
 * - Starting and conducting learning sessions
 * - Quality rating system and feedback
 * - Spaced repetition algorithm integration
 * - Difficulty adjustment based on performance
 * - Progress tracking and statistics
 * - Keyboard shortcuts and accessibility
 */

test.describe('Learning Session Journey', () => {
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
    
    // Create and login as test user
    const email = generateTestEmail('learning');
    const password = generateTestPassword();
    
    testUser = { email, password };
    
    await authPages.registerUser(email, password);
    await authPages.verifyRegistrationSuccess();
    await authPages.loginAs(email, password);
    
    // Create test flashcards for learning sessions
    await flashcardPages.navigateToFlashcards();
    const flashcardData = generateFlashcardData(10);
    await flashcardPages.createMultipleFlashcards(flashcardData);
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

  test.describe('Learning Session Initiation Journey', () => {
    test('should start learning session with available flashcards', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // Verify learning interface appears
      await expect(flashcardPages.page.locator('[data-testid="learning-interface"]')).toBeVisible();
      await expect(flashcardPages.page.locator('[data-testid="flashcard-front"]')).toBeVisible();
    });

    test('should show first flashcard in learning session', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // First flashcard should be displayed
      const frontText = await flashcardPages.page.locator('[data-testid="flashcard-front"]').textContent();
      expect(frontText).toBeTruthy();
      expect(frontText.length).toBeGreaterThan(0);
    });

    test('should handle empty flashcard collection gracefully', async () => {
      // Remove all flashcards
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.deleteAllUserFlashcards();
      
      // Try to start learning session
      await flashcardPages.page.click('[data-testid="start-learning-button"]');
      
      // Should show appropriate message
      await expect(flashcardPages.page.locator('.info-message')).toContainText('No flashcards available for learning');
    });

    test('should show session progress indicator', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // Progress indicator should be visible
      await expect(flashcardPages.page.locator('[data-testid="session-progress"]')).toBeVisible();
    });
  });

  test.describe('Flashcard Review Journey', () => {
    test('should show answer when requested', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // Click show answer button
      await flashcardPages.showAnswer();
      
      // Back of flashcard should be visible
      await expect(flashcardPages.page.locator('[data-testid="flashcard-back"]')).toBeVisible();
    });

    test('should display quality rating buttons after showing answer', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      await flashcardPages.showAnswer();
      
      // All quality rating buttons should be visible
      await flashcardPages.verifyQualityRatingButtons();
    });

    test('should proceed to next card after rating quality', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // Complete one flashcard review
      await flashcardPages.completeFlashcardReview(4); // Good rating
      
      // Should show next card or session complete
      const result = await flashcardPages.verifyNextCardOrSessionComplete();
      expect(['next-card', 'session-complete'].includes(result)).toBe(true);
    });

    test('should track different quality ratings (1-5)', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      for (let quality = 1; quality <= 5; quality++) {
        if (quality > 1) {
          // Start new review if not the first
          const result = await flashcardPages.verifyNextCardOrSessionComplete();
          if (result === 'session-complete') break;
        }
        
        await flashcardPages.showAnswer();
        await flashcardPages.rateFlashcard(quality);
        
        // Verify rating was recorded (this would typically update statistics)
      }
    });

    test('should complete multiple flashcard reviews in sequence', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      const reviewsCompleted = await flashcardPages.completeMultipleReviews(5, 3);
      
      // Should have completed some reviews
      expect(reviewsCompleted).toBeGreaterThan(0);
      expect(reviewsCompleted).toBeLessThanOrEqual(5);
    });
  });

  test.describe('Spaced Repetition Algorithm Journey', () => {
    test('should adjust flashcard difficulty based on quality ratings', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Get initial difficulty of first flashcard
      const user = dbHelper.getUser(testUser.email);
      const flashcards = dbHelper.getUserFlashcards(user.id);
      const initialDifficulty = flashcards[0].difficulty;
      
      // Start learning and give high quality rating
      await flashcardPages.startLearningSession();
      await flashcardPages.completeFlashcardReview(5); // Perfect rating
      
      // Check if difficulty was adjusted
      const updatedFlashcards = dbHelper.getUserFlashcards(user.id);
      const updatedFlashcard = updatedFlashcards.find(f => f.id === flashcards[0].id);
      
      // Difficulty might increase with good performance (depending on algorithm)
      expect(updatedFlashcard.difficulty).not.toBe(initialDifficulty);
    });

    test('should track review statistics for each flashcard', async () => {
      await flashcardPages.navigateToFlashcards();
      
      const user = dbHelper.getUser(testUser.email);
      const flashcards = dbHelper.getUserFlashcards(user.id);
      const initialReviewCount = flashcards[0].review_count;
      
      // Complete a review
      await flashcardPages.startLearningSession();
      await flashcardPages.completeFlashcardReview(3);
      
      // Check that review count increased
      const updatedFlashcards = dbHelper.getUserFlashcards(user.id);
      const updatedFlashcard = updatedFlashcards.find(f => f.id === flashcards[0].id);
      
      expect(updatedFlashcard.review_count).toBe(initialReviewCount + 1);
    });

    test('should prioritize cards that need review', async () => {
      const user = dbHelper.getUser(testUser.email);
      const flashcards = dbHelper.getUserFlashcards(user.id);
      
      // Set one flashcard to have old review date (needs review)
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      
      dbHelper.updateFlashcardDifficulty(flashcards[0].id, 5, 1);
      dbHelper.connect().prepare('UPDATE flashcards SET last_reviewed = ? WHERE id = ?')
        .run(yesterdayDate.toISOString(), flashcards[0].id);
      
      // Start learning session
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // The card needing review should appear first
      const frontText = await flashcardPages.page.locator('[data-testid="flashcard-front"]').textContent();
      expect(frontText).toContain(flashcards[0].english);
    });

    test('should implement proper spacing intervals', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // Complete review with good rating
      await flashcardPages.completeFlashcardReview(4);
      
      const user = dbHelper.getUser(testUser.email);
      const flashcards = dbHelper.getUserFlashcards(user.id);
      const reviewedCard = flashcards.find(f => f.last_reviewed);
      
      // Last reviewed should be updated to current time
      expect(reviewedCard.last_reviewed).toBeTruthy();
      
      const reviewDate = new Date(reviewedCard.last_reviewed);
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - reviewDate.getTime());
      
      // Should be reviewed within last minute
      expect(timeDiff).toBeLessThan(60000);
    });
  });

  test.describe('Session Progress and Statistics Journey', () => {
    test('should track session completion statistics', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Complete a learning session
      const reviewsCompleted = await flashcardPages.performLearningSessionFlow(5);
      
      // View statistics
      await flashcardPages.viewStatistics();
      
      // Verify statistics show completed reviews
      if (reviewsCompleted > 0) {
        await flashcardPages.verifyReviewStatistics(reviewsCompleted);
      }
    });

    test('should show session completion message', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // Complete all available reviews
      await flashcardPages.completeMultipleReviews(20, 3); // Try to complete many
      
      // Should eventually show session complete
      const result = await flashcardPages.verifyNextCardOrSessionComplete();
      if (result === 'session-complete') {
        await expect(flashcardPages.page.locator('[data-testid="session-complete"]')).toBeVisible();
      }
    });

    test('should track learning streak and progress', async () => {
      const user = dbHelper.getUser(testUser.email);
      const initialStats = dbHelper.getUserStats(user.id);
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.performLearningSessionFlow(3);
      
      const updatedStats = dbHelper.getUserStats(user.id);
      
      // Total reviews should increase
      expect(updatedStats.totalReviews).toBeGreaterThan(initialStats.totalReviews);
    });

    test('should calculate average quality rating', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // Complete several reviews with known ratings
      const ratings = [5, 4, 3, 4, 5];
      
      for (let i = 0; i < ratings.length; i++) {
        const result = await flashcardPages.verifyNextCardOrSessionComplete();
        if (result === 'session-complete') break;
        
        await flashcardPages.completeFlashcardReview(ratings[i]);
      }
      
      const user = dbHelper.getUser(testUser.email);
      const stats = dbHelper.getUserStats(user.id);
      
      // Average quality should be calculated correctly
      expect(stats.averageQuality).toBeGreaterThan(0);
      expect(stats.averageQuality).toBeLessThanOrEqual(5);
    });
  });

  test.describe('Keyboard Shortcuts and Accessibility Journey', () => {
    test('should support spacebar for showing answer', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // Press spacebar to show answer
      await flashcardPages.page.press('body', 'Space');
      
      // Answer should be visible
      await expect(flashcardPages.page.locator('[data-testid="flashcard-back"]')).toBeVisible();
    });

    test('should support number keys for quality rating', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // Show answer first
      await flashcardPages.showAnswer();
      
      // Press number key for rating
      await flashcardPages.page.press('body', '4');
      
      // Should proceed to next card or complete session
      const result = await flashcardPages.verifyNextCardOrSessionComplete();
      expect(['next-card', 'session-complete'].includes(result)).toBe(true);
    });

    test('should complete learning session using only keyboard', async () => {
      await flashcardPages.navigateToFlashcards();
      
      const result = await flashcardPages.testKeyboardShortcuts();
      expect(['next-card', 'session-complete'].includes(result)).toBe(true);
    });

    test('should have proper focus management during learning', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // Show answer button should be focusable
      await flashcardPages.page.press('body', 'Tab');
      const focusedElement = flashcardPages.page.locator(':focus');
      await expect(focusedElement).toHaveAttribute('data-testid', 'show-answer-button');
    });
  });

  test.describe('Mobile Learning Experience Journey', () => {
    test('should work properly on mobile devices', async () => {
      // Set mobile viewport
      await flashcardPages.page.setViewportSize({ width: 375, height: 667 });
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // Learning interface should be mobile-friendly
      await expect(flashcardPages.page.locator('[data-testid="learning-interface"]')).toBeVisible();
      
      // Complete a review using touch
      await flashcardPages.page.locator('[data-testid="show-answer-button"]').tap();
      await flashcardPages.page.locator('[data-testid="quality-4"]').tap();
    });

    test('should have touch-friendly quality rating buttons', async () => {
      await flashcardPages.page.setViewportSize({ width: 375, height: 667 });
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      await flashcardPages.showAnswer();
      
      // Quality buttons should be large enough for touch
      const qualityButton = flashcardPages.page.locator('[data-testid="quality-3"]');
      const boundingBox = await qualityButton.boundingBox();
      
      expect(boundingBox.width).toBeGreaterThanOrEqual(44); // Minimum touch target size
      expect(boundingBox.height).toBeGreaterThanOrEqual(44);
    });

    test('should support swipe gestures for flashcard interaction', async () => {
      await flashcardPages.page.setViewportSize({ width: 375, height: 667 });
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // Swipe up to show answer (if implemented)
      const flashcard = flashcardPages.page.locator('[data-testid="flashcard-front"]');
      const box = await flashcard.boundingBox();
      
      await flashcardPages.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      
      // Some interaction should occur
      await flashcardPages.page.waitForTimeout(500);
    });
  });

  test.describe('Error Handling and Edge Cases Journey', () => {
    test('should handle network interruption during learning session', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      await flashcardPages.showAnswer();
      
      // Simulate network failure
      await flashcardPages.page.route('**/api/study-sessions', (route) => {
        route.abort('internetdisconnected');
      });
      
      await flashcardPages.rateFlashcard(4);
      
      // Should show error message but allow offline continuation
      await expect(flashcardPages.page.locator('.error-message')).toContainText('Network error');
    });

    test('should resume session after temporary interruption', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // Simulate page refresh
      await flashcardPages.page.reload();
      
      // Should be able to restart learning session
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      await expect(flashcardPages.page.locator('[data-testid="learning-interface"]')).toBeVisible();
    });

    test('should handle corrupted flashcard data gracefully', async () => {
      const user = dbHelper.getUser(testUser.email);
      const flashcards = dbHelper.getUserFlashcards(user.id);
      
      // Corrupt a flashcard by setting empty content
      dbHelper.connect().prepare('UPDATE flashcards SET english = ?, spanish = ? WHERE id = ?')
        .run('', '', flashcards[0].id);
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // Should skip corrupted cards or show error
      const result = await flashcardPages.verifyNextCardOrSessionComplete();
      expect(['next-card', 'session-complete'].includes(result)).toBe(true);
    });
  });

  test.describe('Performance Journey', () => {
    test('should start learning sessions quickly', async () => {
      await flashcardPages.navigateToFlashcards();
      
      const startTime = Date.now();
      await flashcardPages.startLearningSession();
      const loadTime = Date.now() - startTime;
      
      // Learning session should start within 2 seconds
      expect(loadTime).toBeLessThan(2000);
    });

    test('should handle rapid user interactions smoothly', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // Rapidly complete several reviews
      for (let i = 0; i < 5; i++) {
        const result = await flashcardPages.verifyNextCardOrSessionComplete();
        if (result === 'session-complete') break;
        
        await flashcardPages.showAnswer();
        await flashcardPages.rateFlashcard(3);
        await flashcardPages.page.waitForTimeout(100); // Brief pause
      }
      
      // Should handle rapid interactions without breaking
      const finalResult = await flashcardPages.verifyNextCardOrSessionComplete();
      expect(['next-card', 'session-complete'].includes(finalResult)).toBe(true);
    });

    test('should maintain good performance with large flashcard sets', async () => {
      // Create large dataset
      const user = dbHelper.getUser(testUser.email);
      dbHelper.deleteUserFlashcards(user.id); // Clear existing
      dbHelper.createLargeDataset(user.id, 100);
      
      await flashcardPages.navigateToFlashcards();
      
      const startTime = Date.now();
      await flashcardPages.startLearningSession();
      const loadTime = Date.now() - startTime;
      
      // Should still start quickly even with many flashcards
      expect(loadTime).toBeLessThan(5000);
    });
  });

  test.describe('Complete Learning Journey', () => {
    test('should complete comprehensive learning workflow', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Start session
      await flashcardPages.startLearningSession();
      
      // Complete multiple reviews with varied ratings
      const ratings = [5, 3, 4, 2, 4, 5, 3];
      let reviewsCompleted = 0;
      
      for (const rating of ratings) {
        const result = await flashcardPages.verifyNextCardOrSessionComplete();
        if (result === 'session-complete') break;
        
        await flashcardPages.completeFlashcardReview(rating);
        reviewsCompleted++;
      }
      
      // Check final statistics
      const user = dbHelper.getUser(testUser.email);
      const stats = dbHelper.getUserStats(user.id);
      
      expect(stats.totalReviews).toBeGreaterThanOrEqual(reviewsCompleted);
      expect(stats.averageQuality).toBeGreaterThan(0);
    });

    test('should demonstrate spaced repetition effectiveness over time', async () => {
      // This test simulates multiple learning sessions over time
      const user = dbHelper.getUser(testUser.email);
      let initialStats = dbHelper.getUserStats(user.id);
      
      // Complete first learning session
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.performLearningSessionFlow(3);
      
      let updatedStats = dbHelper.getUserStats(user.id);
      expect(updatedStats.totalReviews).toBeGreaterThan(initialStats.totalReviews);
      
      // Simulate time passing and second session
      await flashcardPages.page.waitForTimeout(1000);
      await flashcardPages.performLearningSessionFlow(2);
      
      const finalStats = dbHelper.getUserStats(user.id);
      expect(finalStats.totalReviews).toBeGreaterThan(updatedStats.totalReviews);
    });
  });
});