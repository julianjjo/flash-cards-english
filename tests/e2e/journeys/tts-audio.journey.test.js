import { test, expect } from '@playwright/test';
import { AuthPages } from '../pages/AuthPages.js';
import { FlashcardPages } from '../pages/FlashcardPages.js';
import { setupTestEnvironment, teardownTestEnvironment, dbHelper } from '../utils/databaseHelpers.js';
import { generateTestEmail, generateTestPassword, TIMEOUTS } from '../utils/testUtils.js';

/**
 * TTS Audio Integration Journey Tests
 * 
 * These tests verify the complete text-to-speech audio experience including:
 * - Audio generation for flashcard content
 * - Playback controls and user interface
 * - Integration with learning sessions
 * - Voice selection and quality settings
 * - Caching and performance optimization
 * - Mobile and accessibility audio support
 * - Error handling and retry mechanisms
 */

test.describe('TTS Audio Integration Journey', () => {
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
    const email = generateTestEmail('audio');
    const password = generateTestPassword();
    
    testUser = { email, password };
    
    await authPages.registerUser(email, password);
    await authPages.verifyRegistrationSuccess();
    await authPages.loginAs(email, password);
    
    // Create test flashcards with varied content
    await flashcardPages.navigateToFlashcards();
    
    const audioTestFlashcards = [
      { english: 'Hello world', spanish: 'Hola mundo' },
      { english: 'How are you today?', spanish: '¿Cómo estás hoy?' },
      { english: 'Thank you very much', spanish: 'Muchas gracias' },
      { english: 'Good morning sunshine', spanish: 'Buenos días sol' },
      { english: 'Where is the library?', spanish: '¿Dónde está la biblioteca?' }
    ];
    
    await flashcardPages.createMultipleFlashcards(audioTestFlashcards);
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

  test.describe('Audio Generation Journey', () => {
    test('should generate audio for English flashcard text', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Open first flashcard detail
      await flashcardPages.openFlashcardDetail(0);
      
      // Verify TTS controls are present
      await expect(flashcardPages.page.locator('[data-testid="tts-controls"]')).toBeVisible();
      await expect(flashcardPages.page.locator('[data-testid="play-english-audio"]')).toBeVisible();
    });

    test('should generate audio for Spanish flashcard text', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      // Spanish TTS button should be available
      await expect(flashcardPages.page.locator('[data-testid="play-spanish-audio"]')).toBeVisible();
    });

    test('should generate audio within performance targets (<3s)', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      const startTime = Date.now();
      
      // Click to generate audio
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      
      // Wait for audio to be ready
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
      
      const generationTime = Date.now() - startTime;
      
      // Should generate within 3 seconds
      expect(generationTime).toBeLessThan(3000);
    });

    test('should show loading state during audio generation', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      // Click audio button and immediately check loading state
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      
      // Loading indicator should appear
      await expect(flashcardPages.page.locator('[data-testid="audio-loading"]')).toBeVisible();
    });

    test('should handle special characters and punctuation in TTS', async () => {
      // Create flashcard with special content
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard(
        'Hello, world! How are you? (Fine, thanks)',
        '¡Hola, mundo! ¿Cómo estás? (Bien, gracias)'
      );
      
      // Test audio generation for special characters
      await flashcardPages.openFlashcardDetail('Hello, world!');
      
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      
      // Should generate audio without errors
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
    });

    test('should handle long text content appropriately', async () => {
      const longText = 'This is a very long sentence that contains many words and should test the text-to-speech system\'s ability to handle extended content without any issues or problems.';
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard(longText, 'Texto muy largo en español');
      
      await flashcardPages.openFlashcardDetail('This is a very long sentence');
      
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      
      // Should handle long text (might take longer but should work)
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Audio Playback Journey', () => {
    test('should play generated audio successfully', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      // Generate and play audio
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
      
      // Audio should start playing
      const audioElement = flashcardPages.page.locator('[data-testid="audio-player"]');
      const isPlaying = await audioElement.evaluate((audio) => !audio.paused);
      
      expect(isPlaying).toBe(true);
    });

    test('should provide playback controls (play/pause)', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
      
      // Pause button should be available during playback
      await expect(flashcardPages.page.locator('[data-testid="pause-audio"]')).toBeVisible();
      
      // Click pause
      await flashcardPages.page.click('[data-testid="pause-audio"]');
      
      // Play button should reappear
      await expect(flashcardPages.page.locator('[data-testid="play-audio"]')).toBeVisible();
    });

    test('should show audio duration and progress', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
      
      // Duration and progress indicators should be visible
      await expect(flashcardPages.page.locator('[data-testid="audio-duration"]')).toBeVisible();
      await expect(flashcardPages.page.locator('[data-testid="audio-progress"]')).toBeVisible();
    });

    test('should support volume control', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
      
      // Volume control should be available
      await expect(flashcardPages.page.locator('[data-testid="volume-control"]')).toBeVisible();
      
      // Test volume adjustment
      await flashcardPages.page.locator('[data-testid="volume-control"]').fill('0.5');
      
      const audioElement = flashcardPages.page.locator('[data-testid="audio-player"]');
      const volume = await audioElement.evaluate((audio) => audio.volume);
      
      expect(volume).toBe(0.5);
    });

    test('should support playback speed control', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
      
      // Speed control should be available
      await expect(flashcardPages.page.locator('[data-testid="playback-speed"]')).toBeVisible();
      
      // Test speed adjustment
      await flashcardPages.page.selectOption('[data-testid="playback-speed"]', '0.75');
      
      const audioElement = flashcardPages.page.locator('[data-testid="audio-player"]');
      const playbackRate = await audioElement.evaluate((audio) => audio.playbackRate);
      
      expect(playbackRate).toBe(0.75);
    });
  });

  test.describe('Learning Session Audio Integration Journey', () => {
    test('should provide audio playback during learning sessions', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // TTS controls should be available in learning interface
      await expect(flashcardPages.page.locator('[data-testid="learning-audio-controls"]')).toBeVisible();
      await expect(flashcardPages.page.locator('[data-testid="play-front-audio"]')).toBeVisible();
    });

    test('should play front side audio before revealing answer', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // Play front side audio
      await flashcardPages.page.click('[data-testid="play-front-audio"]');
      
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
    });

    test('should play back side audio after revealing answer', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // Show answer
      await flashcardPages.showAnswer();
      
      // Back side audio should be available
      await expect(flashcardPages.page.locator('[data-testid="play-back-audio"]')).toBeVisible();
      
      await flashcardPages.page.click('[data-testid="play-back-audio"]');
      
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
    });

    test('should support automatic audio playback option', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Enable auto-play in settings
      await flashcardPages.page.click('[data-testid="audio-settings"]');
      await flashcardPages.page.check('[data-testid="auto-play-audio"]');
      await flashcardPages.page.click('[data-testid="save-audio-settings"]');
      
      // Start learning session
      await flashcardPages.startLearningSession();
      
      // Audio should start automatically
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
    });

    test('should maintain audio preferences across learning sessions', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Set audio preferences
      await flashcardPages.page.click('[data-testid="audio-settings"]');
      await flashcardPages.page.selectOption('[data-testid="voice-selection"]', 'female');
      await flashcardPages.page.locator('[data-testid="audio-speed"]').fill('1.25');
      await flashcardPages.page.click('[data-testid="save-audio-settings"]');
      
      // Start learning session
      await flashcardPages.startLearningSession();
      await flashcardPages.page.click('[data-testid="play-front-audio"]');
      
      // Complete session and start new one
      await flashcardPages.page.click('[data-testid="end-session"]');
      await flashcardPages.startLearningSession();
      
      // Settings should be remembered
      await flashcardPages.page.click('[data-testid="audio-settings"]');
      
      const voiceValue = await flashcardPages.page.inputValue('[data-testid="voice-selection"]');
      const speedValue = await flashcardPages.page.inputValue('[data-testid="audio-speed"]');
      
      expect(voiceValue).toBe('female');
      expect(speedValue).toBe('1.25');
    });
  });

  test.describe('Voice Selection and Quality Journey', () => {
    test('should provide multiple voice options', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      // Open voice settings
      await flashcardPages.page.click('[data-testid="audio-settings"]');
      
      // Multiple voice options should be available
      const voiceOptions = flashcardPages.page.locator('[data-testid="voice-selection"] option');
      const optionCount = await voiceOptions.count();
      
      expect(optionCount).toBeGreaterThan(1);
    });

    test('should support different voices for English and Spanish', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      await flashcardPages.page.click('[data-testid="audio-settings"]');
      
      // Should have language-specific voice options
      await expect(flashcardPages.page.locator('[data-testid="english-voice-selection"]')).toBeVisible();
      await expect(flashcardPages.page.locator('[data-testid="spanish-voice-selection"]')).toBeVisible();
    });

    test('should generate different audio quality based on settings', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      // Test high quality setting
      await flashcardPages.page.click('[data-testid="audio-settings"]');
      await flashcardPages.page.selectOption('[data-testid="audio-quality"]', 'high');
      await flashcardPages.page.click('[data-testid="save-audio-settings"]');
      
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      
      // Should generate high quality audio (this might take longer)
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 10000 });
      
      // Test standard quality
      await flashcardPages.page.click('[data-testid="audio-settings"]');
      await flashcardPages.page.selectOption('[data-testid="audio-quality"]', 'standard');
      await flashcardPages.page.click('[data-testid="save-audio-settings"]');
      
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
    });

    test('should validate voice selection for different languages', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      // Select English voice and generate English audio
      await flashcardPages.page.click('[data-testid="audio-settings"]');
      await flashcardPages.page.selectOption('[data-testid="english-voice-selection"]', 'en-US-male');
      await flashcardPages.page.click('[data-testid="save-audio-settings"]');
      
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
      
      // Select Spanish voice and generate Spanish audio
      await flashcardPages.page.click('[data-testid="audio-settings"]');
      await flashcardPages.page.selectOption('[data-testid="spanish-voice-selection"]', 'es-ES-female');
      await flashcardPages.page.click('[data-testid="save-audio-settings"]');
      
      await flashcardPages.page.click('[data-testid="play-spanish-audio"]');
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
    });
  });

  test.describe('Caching and Performance Journey', () => {
    test('should cache generated audio for repeated playback', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      // Generate audio first time
      const firstGenTime = Date.now();
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
      const firstLoadTime = Date.now() - firstGenTime;
      
      // Play same audio again
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      const secondGenTime = Date.now();
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
      const secondLoadTime = Date.now() - secondGenTime;
      
      // Second time should be significantly faster (cached)
      expect(secondLoadTime).toBeLessThan(firstLoadTime / 2);
    });

    test('should handle cache storage efficiently', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Generate audio for multiple flashcards
      for (let i = 0; i < 3; i++) {
        await flashcardPages.openFlashcardDetail(i);
        await flashcardPages.page.click('[data-testid="play-english-audio"]');
        await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
        await flashcardPages.page.click('[data-testid="close-detail"]');
      }
      
      // Cache should store multiple audio files
      const cacheSize = await flashcardPages.page.evaluate(() => {
        return new Promise((resolve) => {
          navigator.storage.estimate().then((estimate) => {
            resolve(estimate.usage);
          });
        });
      });
      
      expect(cacheSize).toBeGreaterThan(0);
    });

    test('should clear audio cache when requested', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      // Generate audio
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
      
      // Clear cache
      await flashcardPages.page.click('[data-testid="audio-settings"]');
      await flashcardPages.page.click('[data-testid="clear-audio-cache"]');
      
      // Confirm cache clearing
      await expect(flashcardPages.page.locator('[data-testid="cache-cleared-message"]')).toBeVisible();
    });

    test('should manage cache size automatically', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Create many flashcards to test cache management
      const manyFlashcards = [];
      for (let i = 0; i < 20; i++) {
        manyFlashcards.push({
          english: `Test sentence number ${i}`,
          spanish: `Oración de prueba número ${i}`
        });
      }
      
      await flashcardPages.createMultipleFlashcards(manyFlashcards);
      
      // Generate audio for many flashcards
      for (let i = 0; i < 10; i++) {
        await flashcardPages.openFlashcardDetail(i);
        await flashcardPages.page.click('[data-testid="play-english-audio"]');
        await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
        await flashcardPages.page.click('[data-testid="close-detail"]');
      }
      
      // Cache should manage its size automatically
      // This test mainly ensures the system doesn't crash with many audio files
    });
  });

  test.describe('Mobile Audio Experience Journey', () => {
    test('should work properly on mobile devices', async () => {
      // Set mobile viewport
      await flashcardPages.page.setViewportSize({ width: 375, height: 667 });
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      // Audio controls should be mobile-friendly
      await expect(flashcardPages.page.locator('[data-testid="mobile-audio-controls"]')).toBeVisible();
      
      // Play audio using touch
      await flashcardPages.page.locator('[data-testid="play-english-audio"]').tap();
      
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
    });

    test('should support mobile audio interruption handling', async () => {
      await flashcardPages.page.setViewportSize({ width: 375, height: 667 });
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      // Start audio playback
      await flashcardPages.page.locator('[data-testid="play-english-audio"]').tap();
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
      
      // Simulate phone call interruption
      await flashcardPages.page.evaluate(() => {
        const audio = document.querySelector('[data-testid="audio-player"]');
        if (audio) {
          audio.pause();
          audio.dispatchEvent(new Event('pause'));
        }
      });
      
      // Resume controls should be available
      await expect(flashcardPages.page.locator('[data-testid="resume-audio"]')).toBeVisible();
    });

    test('should handle mobile data usage efficiently', async () => {
      await flashcardPages.page.setViewportSize({ width: 375, height: 667 });
      
      // Enable data saver mode
      await flashcardPages.page.click('[data-testid="audio-settings"]');
      await flashcardPages.page.check('[data-testid="data-saver-mode"]');
      await flashcardPages.page.click('[data-testid="save-audio-settings"]');
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      // Should show data usage warning
      await flashcardPages.page.locator('[data-testid="play-english-audio"]').tap();
      
      await expect(flashcardPages.page.locator('[data-testid="data-usage-warning"]')).toBeVisible();
    });
  });

  test.describe('Accessibility Audio Journey', () => {
    test('should support screen reader integration', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      // Audio controls should have proper ARIA labels
      await expect(flashcardPages.page.locator('[data-testid="play-english-audio"]')).toHaveAttribute('aria-label');
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toHaveAttribute('aria-label');
    });

    test('should provide keyboard shortcuts for audio control', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      // Focus audio button and use Enter to play
      await flashcardPages.page.locator('[data-testid="play-english-audio"]').focus();
      await flashcardPages.page.press('[data-testid="play-english-audio"]', 'Enter');
      
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
      
      // Use spacebar to pause
      await flashcardPages.page.press('body', 'Space');
      
      // Audio should pause
      const isPaused = await flashcardPages.page.locator('[data-testid="audio-player"]').evaluate((audio) => audio.paused);
      expect(isPaused).toBe(true);
    });

    test('should announce audio status to screen readers', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      
      // Screen reader announcements should be present
      await expect(flashcardPages.page.locator('[data-testid="audio-status-announcement"]')).toBeVisible();
    });

    test('should support high contrast mode for audio controls', async () => {
      // Enable high contrast mode
      await flashcardPages.page.addStyleTag({
        content: `
          @media (prefers-contrast: high) {
            .audio-control { border: 2px solid white; background: black; }
          }
        `
      });
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      // Audio controls should be visible in high contrast
      await expect(flashcardPages.page.locator('[data-testid="play-english-audio"]')).toBeVisible();
    });
  });

  test.describe('Error Handling and Recovery Journey', () => {
    test('should handle TTS service unavailability gracefully', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      // Simulate TTS service failure
      await flashcardPages.page.route('**/api/tts/**', (route) => {
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Service unavailable' })
        });
      });
      
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      
      // Should show appropriate error message
      await expect(flashcardPages.page.locator('[data-testid="audio-error"]')).toContainText('Audio service unavailable');
    });

    test('should retry failed audio generation automatically', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      let requestCount = 0;
      
      // Simulate intermittent failure
      await flashcardPages.page.route('**/api/tts/**', (route) => {
        requestCount++;
        if (requestCount === 1) {
          route.abort('internetdisconnected');
        } else {
          route.continue();
        }
      });
      
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      
      // Should eventually succeed after retry
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 10000 });
    });

    test('should handle corrupted audio files gracefully', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      // Simulate corrupted audio response
      await flashcardPages.page.route('**/api/tts/**', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'audio/wav',
          body: 'corrupted-audio-data'
        });
      });
      
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      
      // Should show audio error
      await expect(flashcardPages.page.locator('[data-testid="audio-error"]')).toContainText('Audio file corrupted');
    });

    test('should provide manual retry option for failed audio', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      // Simulate failure
      await flashcardPages.page.route('**/api/tts/**', (route) => {
        route.abort('internetdisconnected');
      });
      
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      await expect(flashcardPages.page.locator('[data-testid="audio-error"]')).toBeVisible();
      
      // Retry button should be available
      await expect(flashcardPages.page.locator('[data-testid="retry-audio"]')).toBeVisible();
      
      // Remove route simulation and retry
      await flashcardPages.page.unroute('**/api/tts/**');
      await flashcardPages.page.click('[data-testid="retry-audio"]');
      
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
    });

    test('should handle network timeouts during audio generation', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.openFlashcardDetail(0);
      
      // Simulate very slow response
      await flashcardPages.page.route('**/api/tts/**', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
        route.continue();
      });
      
      await flashcardPages.page.click('[data-testid="play-english-audio"]');
      
      // Should timeout and show error
      await expect(flashcardPages.page.locator('[data-testid="audio-error"]')).toContainText('Request timeout');
    });
  });

  test.describe('Complete TTS Integration Journey', () => {
    test('should demonstrate complete audio-enhanced learning workflow', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Configure audio preferences
      await flashcardPages.page.click('[data-testid="audio-settings"]');
      await flashcardPages.page.selectOption('[data-testid="english-voice-selection"]', 'en-US-female');
      await flashcardPages.page.selectOption('[data-testid="spanish-voice-selection"]', 'es-ES-male');
      await flashcardPages.page.check('[data-testid="auto-play-audio"]');
      await flashcardPages.page.click('[data-testid="save-audio-settings"]');
      
      // Start learning session with audio
      await flashcardPages.startLearningSession();
      
      // Audio should auto-play
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
      
      // Complete review with audio assistance
      await flashcardPages.showAnswer();
      
      // Both sides should have had audio
      await flashcardPages.completeFlashcardReview(5);
      
      // Continue with next card
      const result = await flashcardPages.verifyNextCardOrSessionComplete();
      expect(['next-card', 'session-complete'].includes(result)).toBe(true);
    });

    test('should maintain audio performance across extended usage', async () => {
      await flashcardPages.navigateToFlashcards();
      
      // Generate audio for multiple flashcards
      const startTime = Date.now();
      
      for (let i = 0; i < 5; i++) {
        await flashcardPages.openFlashcardDetail(i);
        await flashcardPages.page.click('[data-testid="play-english-audio"]');
        await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
        await flashcardPages.page.click('[data-testid="play-spanish-audio"]');
        await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
        await flashcardPages.page.click('[data-testid="close-detail"]');
      }
      
      const totalTime = Date.now() - startTime;
      
      // Should maintain good performance even after multiple generations
      expect(totalTime).toBeLessThan(60000); // Under 1 minute for 5 cards
    });

    test('should provide comprehensive audio accessibility experience', async () => {
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.startLearningSession();
      
      // Test keyboard-only audio control
      await flashcardPages.page.press('body', 'Tab'); // Focus audio button
      await flashcardPages.page.press('body', 'Enter'); // Play audio
      
      await expect(flashcardPages.page.locator('[data-testid="audio-player"]')).toBeVisible();
      
      // Test spacebar pause
      await flashcardPages.page.press('body', 'Space');
      
      const isPaused = await flashcardPages.page.locator('[data-testid="audio-player"]').evaluate((audio) => audio.paused);
      expect(isPaused).toBe(true);
      
      // Complete learning with audio assistance
      await flashcardPages.page.press('body', 'Space'); // Resume
      await flashcardPages.showAnswer();
      await flashcardPages.completeFlashcardReview(4);
    });
  });
});