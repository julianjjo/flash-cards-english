import { test, expect } from '@playwright/test';

/**
 * E2E Contract Test: TTS Audio Generation Endpoints
 * 
 * This test validates the E2E text-to-speech functionality contracts for
 * audio generation, playback, and user interaction with audio features.
 * 
 * CRITICAL: This test MUST FAIL initially (TDD requirement)
 * These tests verify the complete audio functionality including TTS generation,
 * audio playback controls, voice selection, and audio caching mechanisms.
 */

test.describe('E2E TTS Audio Contract Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login as test user and navigate to flashcards
    await page.goto('/login');
    await page.fill('input[name="email"]', 'testuser@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/home');
  });

  test.describe('Audio Generation and Playback', () => {
    test('should generate and play TTS audio for English text', async ({ page }) => {
      // Find a flashcard with audio capability
      const flashcardItem = page.locator('[data-testid="flashcard-item"]').first();
      await flashcardItem.click();

      // Verify audio controls are visible
      await expect(page.locator('[data-testid="english-audio-button"]')).toBeVisible();
      
      // Click to generate/play English audio
      await page.click('[data-testid="english-audio-button"]');

      // Verify audio loading state
      await expect(page.locator('[data-testid="audio-loading"]')).toBeVisible();
      await expect(page.locator('[data-testid="english-audio-button"]')).toContainText('Loading...');

      // Wait for audio to load and verify playback controls
      await expect(page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="play-pause-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="audio-progress"]')).toBeVisible();
    });

    test('should generate and play TTS audio for Spanish text', async ({ page }) => {
      const flashcardItem = page.locator('[data-testid="flashcard-item"]').first();
      await flashcardItem.click();

      // Test Spanish audio generation
      await expect(page.locator('[data-testid="spanish-audio-button"]')).toBeVisible();
      await page.click('[data-testid="spanish-audio-button"]');

      // Verify Spanish audio loading and playback
      await expect(page.locator('[data-testid="audio-loading"]')).toBeVisible();
      await expect(page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 10000 });
    });

    test('should handle audio generation errors gracefully', async ({ page }) => {
      // Navigate to a flashcard with potentially problematic text
      const flashcardItem = page.locator('[data-testid="flashcard-item"]').first();
      await flashcardItem.click();

      // Mock network failure or API error by intercepting the request
      await page.route('**/api/flashcards/**/audio**', route => route.abort());

      // Try to play audio
      await page.click('[data-testid="english-audio-button"]');

      // Verify error handling
      await expect(page.locator('[data-testid="audio-error"]')).toBeVisible();
      await expect(page.locator('.error-message')).toContainText('Audio generation failed');
      await expect(page.locator('[data-testid="retry-audio-button"]')).toBeVisible();
    });

    test('should retry failed audio generation', async ({ page }) => {
      const flashcardItem = page.locator('[data-testid="flashcard-item"]').first();
      await flashcardItem.click();

      // Mock initial failure then success
      let requestCount = 0;
      await page.route('**/api/flashcards/**/audio**', route => {
        requestCount++;
        if (requestCount === 1) {
          route.abort(); // First request fails
        } else {
          route.continue(); // Second request succeeds
        }
      });

      // Initial attempt should fail
      await page.click('[data-testid="english-audio-button"]');
      await expect(page.locator('[data-testid="retry-audio-button"]')).toBeVisible();

      // Retry should succeed
      await page.click('[data-testid="retry-audio-button"]');
      await expect(page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Audio Player Controls', () => {
    test('should control audio playback with play/pause button', async ({ page }) => {
      const flashcardItem = page.locator('[data-testid="flashcard-item"]').first();
      await flashcardItem.click();
      
      // Generate audio first
      await page.click('[data-testid="english-audio-button"]');
      await expect(page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 10000 });

      // Test play/pause functionality
      const playButton = page.locator('[data-testid="play-pause-button"]');
      await playButton.click(); // Should start playing
      await expect(playButton).toContainText('Pause');

      await playButton.click(); // Should pause
      await expect(playButton).toContainText('Play');
    });

    test('should display audio progress and duration', async ({ page }) => {
      const flashcardItem = page.locator('[data-testid="flashcard-item"]').first();
      await flashcardItem.click();
      
      await page.click('[data-testid="english-audio-button"]');
      await expect(page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 10000 });

      // Verify progress indicator
      await expect(page.locator('[data-testid="audio-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="audio-duration"]')).toBeVisible();
      await expect(page.locator('[data-testid="audio-current-time"]')).toBeVisible();

      // Verify initial state shows 0:00
      await expect(page.locator('[data-testid="audio-current-time"]')).toContainText('0:00');
    });

    test('should support seeking through audio progress bar', async ({ page }) => {
      const flashcardItem = page.locator('[data-testid="flashcard-item"]').first();
      await flashcardItem.click();
      
      await page.click('[data-testid="english-audio-button"]');
      await expect(page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 10000 });

      // Click on progress bar to seek
      const progressBar = page.locator('[data-testid="audio-progress-bar"]');
      const progressBarBox = await progressBar.boundingBox();
      
      if (progressBarBox) {
        // Click at 50% position
        await page.mouse.click(
          progressBarBox.x + progressBarBox.width * 0.5,
          progressBarBox.y + progressBarBox.height * 0.5
        );

        // Verify position changed (timing may vary)
        await expect(page.locator('[data-testid="audio-current-time"]')).not.toContainText('0:00');
      }
    });

    test('should show volume controls', async ({ page }) => {
      const flashcardItem = page.locator('[data-testid="flashcard-item"]').first();
      await flashcardItem.click();
      
      await page.click('[data-testid="english-audio-button"]');
      await expect(page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 10000 });

      // Verify volume controls
      await expect(page.locator('[data-testid="volume-button"]')).toBeVisible();
      
      // Click volume button to show slider
      await page.click('[data-testid="volume-button"]');
      await expect(page.locator('[data-testid="volume-slider"]')).toBeVisible();
    });
  });

  test.describe('Learning Session Audio Integration', () => {
    test('should integrate audio playback in learning mode', async ({ page }) => {
      // Start learning session
      await page.click('[data-testid="start-learning-button"]');
      await expect(page.locator('[data-testid="learning-interface"]')).toBeVisible();

      // Verify audio buttons are available in learning mode
      await expect(page.locator('[data-testid="english-audio-button"]')).toBeVisible();
      
      // Test automatic audio playback option
      const autoPlayCheckbox = page.locator('[data-testid="auto-play-audio"]');
      if (await autoPlayCheckbox.isVisible()) {
        await autoPlayCheckbox.check();
        
        // Show answer to trigger next card
        await page.click('[data-testid="show-answer-button"]');
        await page.click('[data-testid="quality-3"]');
        
        // Next card should auto-play audio
        await expect(page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 10000 });
      }
    });

    test('should support keyboard shortcuts for audio', async ({ page }) => {
      await page.click('[data-testid="start-learning-button"]');
      
      // Test keyboard shortcut for English audio (e.g., 'E' key)
      await page.press('body', 'e');
      await expect(page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 10000 });
      
      // Test keyboard shortcut for Spanish audio (e.g., 'S' key)
      await page.press('body', 's');
      // Should switch to or start playing Spanish audio
      await expect(page.locator('[data-testid="audio-player"]')).toBeVisible();
    });

    test('should remember audio preferences', async ({ page }) => {
      // Enable auto-play and set volume
      const flashcardItem = page.locator('[data-testid="flashcard-item"]').first();
      await flashcardItem.click();
      
      await page.click('[data-testid="english-audio-button"]');
      await expect(page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 10000 });
      
      // Set volume to 50%
      await page.click('[data-testid="volume-button"]');
      const volumeSlider = page.locator('[data-testid="volume-slider"]');
      await volumeSlider.fill('0.5');

      // Navigate away and back
      await page.goto('/home');
      await flashcardItem.click();
      await page.click('[data-testid="english-audio-button"]');
      
      // Verify volume setting was remembered
      await page.click('[data-testid="volume-button"]');
      const savedVolume = await volumeSlider.inputValue();
      expect(parseFloat(savedVolume)).toBeCloseTo(0.5, 1);
    });
  });

  test.describe('Voice Selection and Quality', () => {
    test('should provide voice selection options', async ({ page }) => {
      const flashcardItem = page.locator('[data-testid="flashcard-item"]').first();
      await flashcardItem.click();

      // Check for voice settings
      const voiceSettings = page.locator('[data-testid="voice-settings"]');
      if (await voiceSettings.isVisible()) {
        await voiceSettings.click();
        
        // Verify voice options are available
        await expect(page.locator('[data-testid="voice-selector"]')).toBeVisible();
        await expect(page.locator('[data-testid="english-voice-select"]')).toBeVisible();
        await expect(page.locator('[data-testid="spanish-voice-select"]')).toBeVisible();
      }
    });

    test('should maintain consistent audio quality', async ({ page }) => {
      const flashcardItem = page.locator('[data-testid="flashcard-item"]').first();
      await flashcardItem.click();

      // Generate audio and check quality indicators
      await page.click('[data-testid="english-audio-button"]');
      await expect(page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 10000 });

      // Verify audio format and quality indicators
      const audioElement = page.locator('audio');
      if (await audioElement.isVisible()) {
        const audioSrc = await audioElement.getAttribute('src');
        expect(audioSrc).toBeTruthy();
        
        // Verify audio loads without errors
        const audioReady = await page.evaluate(() => {
          const audio = document.querySelector('audio');
          return audio && audio.readyState >= 2; // HAVE_CURRENT_DATA
        });
        expect(audioReady).toBe(true);
      }
    });

    test('should handle different text lengths appropriately', async ({ page }) => {
      // Test short text
      await page.click('[data-testid="add-flashcard-button"]');
      await page.fill('input[name="english"]', 'Hi');
      await page.fill('input[name="spanish"]', 'Hola');
      await page.click('button[type="submit"]');

      // Find and test the new short flashcard
      const shortFlashcard = page.locator('[data-testid="flashcard-item"]').filter({ hasText: 'Hi' });
      await shortFlashcard.click();
      await page.click('[data-testid="english-audio-button"]');
      
      // Verify short audio generates quickly
      await expect(page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 5000 });
      
      // Test longer text
      await page.goto('/home');
      await page.click('[data-testid="add-flashcard-button"]');
      await page.fill('input[name="english"]', 'This is a much longer sentence that should take more time to generate audio for and test the system\'s handling of extended text content.');
      await page.fill('input[name="spanish"]', 'Esta es una oración mucho más larga que debería tomar más tiempo generar audio y probar el manejo del sistema de contenido de texto extendido.');
      await page.click('button[type="submit"]');

      // Test the longer flashcard
      const longFlashcard = page.locator('[data-testid="flashcard-item"]').filter({ hasText: 'This is a much longer sentence' });
      await longFlashcard.click();
      await page.click('[data-testid="english-audio-button"]');
      
      // Verify longer audio generates (may take more time)
      await expect(page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Audio Caching and Performance', () => {
    test('should cache generated audio for faster replay', async ({ page }) => {
      const flashcardItem = page.locator('[data-testid="flashcard-item"]').first();
      await flashcardItem.click();

      // First audio generation (should be slower)
      const firstLoadStart = Date.now();
      await page.click('[data-testid="english-audio-button"]');
      await expect(page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 10000 });
      const firstLoadTime = Date.now() - firstLoadStart;

      // Navigate away and back
      await page.goto('/home');
      await flashcardItem.click();

      // Second audio generation (should be faster due to caching)
      const secondLoadStart = Date.now();
      await page.click('[data-testid="english-audio-button"]');
      await expect(page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 5000 });
      const secondLoadTime = Date.now() - secondLoadStart;

      // Second load should be significantly faster
      expect(secondLoadTime).toBeLessThan(firstLoadTime * 0.7);
    });

    test('should handle concurrent audio requests', async ({ page }) => {
      // Open multiple flashcards in different tabs/windows would be ideal,
      // but we can test sequential rapid requests
      const flashcards = page.locator('[data-testid="flashcard-item"]');
      const count = Math.min(await flashcards.count(), 3);

      for (let i = 0; i < count; i++) {
        await flashcards.nth(i).click();
        
        // Rapidly request audio (don't wait for completion)
        await page.click('[data-testid="english-audio-button"]');
        
        // Go back to list for next card
        await page.goto('/home');
      }

      // Verify system handled rapid requests without crashing
      await expect(page.locator('[data-testid="flashcard-list"]')).toBeVisible();
    });

    test('should respect performance targets', async ({ page }) => {
      const flashcardItem = page.locator('[data-testid="flashcard-item"]').first();
      await flashcardItem.click();

      // Measure audio generation performance
      const startTime = Date.now();
      await page.click('[data-testid="english-audio-button"]');
      await expect(page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 10000 });
      const generationTime = Date.now() - startTime;

      // Should meet the <3s performance target from the contract
      expect(generationTime).toBeLessThan(3000);
    });
  });

  test.describe('Accessibility and User Experience', () => {
    test('should provide screen reader support for audio controls', async ({ page }) => {
      const flashcardItem = page.locator('[data-testid="flashcard-item"]').first();
      await flashcardItem.click();

      // Verify accessibility attributes
      const audioButton = page.locator('[data-testid="english-audio-button"]');
      await expect(audioButton).toHaveAttribute('aria-label');
      await expect(audioButton).toHaveAttribute('role', 'button');

      // Generate audio and check player accessibility
      await page.click('[data-testid="english-audio-button"]');
      await expect(page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 10000 });

      const playButton = page.locator('[data-testid="play-pause-button"]');
      await expect(playButton).toHaveAttribute('aria-label');
    });

    test('should support high contrast mode', async ({ page }) => {
      // Simulate high contrast mode
      await page.emulateMedia({ colorScheme: 'dark' });

      const flashcardItem = page.locator('[data-testid="flashcard-item"]').first();
      await flashcardItem.click();
      
      await page.click('[data-testid="english-audio-button"]');
      await expect(page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 10000 });

      // Verify audio controls are visible in high contrast
      await expect(page.locator('[data-testid="play-pause-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="audio-progress"]')).toBeVisible();
    });

    test('should work on mobile devices', async ({ page }) => {
      // Simulate mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      const flashcardItem = page.locator('[data-testid="flashcard-item"]').first();
      await flashcardItem.click();

      // Verify mobile-friendly audio controls
      await expect(page.locator('[data-testid="english-audio-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="english-audio-button"]')).toHaveCSS('min-height', '44px'); // Touch-friendly size

      await page.click('[data-testid="english-audio-button"]');
      await expect(page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 10000 });

      // Verify mobile audio player
      await expect(page.locator('[data-testid="play-pause-button"]')).toHaveCSS('min-height', '44px');
    });

    test('should provide visual feedback for audio states', async ({ page }) => {
      const flashcardItem = page.locator('[data-testid="flashcard-item"]').first();
      await flashcardItem.click();

      const audioButton = page.locator('[data-testid="english-audio-button"]');
      
      // Verify initial state
      await expect(audioButton).not.toHaveClass(/loading/);
      await expect(audioButton).not.toHaveClass(/playing/);

      // Click and verify loading state
      await page.click('[data-testid="english-audio-button"]');
      await expect(audioButton).toHaveClass(/loading/);

      // Verify playing state
      await expect(page.locator('[data-testid="audio-player"]')).toBeVisible({ timeout: 10000 });
      await expect(audioButton).toHaveClass(/has-audio/);
    });
  });
});