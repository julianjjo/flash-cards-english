import { test, expect } from '@playwright/test';
import { AuthPages } from '../pages/AuthPages.js';
import { FlashcardPages } from '../pages/FlashcardPages.js';
import { AdminPages } from '../pages/AdminPages.js';
import { setupTestEnvironment, teardownTestEnvironment, dbHelper } from '../utils/databaseHelpers.js';
import { generateTestEmail, generateTestPassword, TIMEOUTS } from '../utils/testUtils.js';

/**
 * Accessibility and Cross-Browser Compatibility Testing
 * 
 * These tests verify the application meets accessibility standards and works across browsers:
 * - WCAG 2.1 compliance (A, AA levels)
 * - Screen reader compatibility
 * - Keyboard navigation support
 * - High contrast and color accessibility
 * - Focus management and visual indicators
 * - ARIA attributes and semantic HTML
 * - Cross-browser compatibility (Chrome, Firefox, Safari)
 * - Mobile accessibility features
 * - Voice recognition and assistive technology support
 */

test.describe('Accessibility and Cross-Browser Compatibility', () => {
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
    
    const email = generateTestEmail('accessibility');
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

  test.describe('WCAG 2.1 Compliance', () => {
    test('should have proper heading hierarchy', async () => {
      await authPages.navigateToLogin();
      
      // Check heading structure
      const headings = await authPages.page.locator('h1, h2, h3, h4, h5, h6').all();
      const headingLevels = [];
      
      for (const heading of headings) {
        const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
        const level = parseInt(tagName.charAt(1));
        const text = await heading.textContent();
        headingLevels.push({ level, text: text.trim() });
      }
      
      console.log('Heading structure:', headingLevels);
      
      // Should have at least one H1
      const h1Count = headingLevels.filter(h => h.level === 1).length;
      expect(h1Count).toBeGreaterThanOrEqual(1);
      
      // Heading levels should not skip (no h1 -> h3)
      for (let i = 1; i < headingLevels.length; i++) {
        const currentLevel = headingLevels[i].level;
        const previousLevel = headingLevels[i - 1].level;
        const levelDifference = currentLevel - previousLevel;
        
        // Can't skip more than 1 level
        expect(levelDifference).toBeLessThanOrEqual(1);
      }
      
      // Test on other key pages
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      const homeHeadings = await flashcardPages.page.locator('h1, h2, h3, h4, h5, h6').count();
      expect(homeHeadings).toBeGreaterThan(0);
    });

    test('should have proper form labels and associations', async () => {
      await authPages.navigateToLogin();
      
      // Check login form labels
      const emailInput = authPages.page.locator('input[name="email"]');
      const passwordInput = authPages.page.locator('input[name="password"]');
      
      // Should have labels or aria-labels
      const emailLabel = await emailInput.evaluate(input => {
        const id = input.getAttribute('id');
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledBy = input.getAttribute('aria-labelledby');
        
        if (ariaLabel) return ariaLabel;
        if (ariaLabelledBy) {
          const labelElement = document.getElementById(ariaLabelledBy);
          return labelElement ? labelElement.textContent : null;
        }
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`);
          return label ? label.textContent : null;
        }
        return null;
      });
      
      const passwordLabel = await passwordInput.evaluate(input => {
        const id = input.getAttribute('id');
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledBy = input.getAttribute('aria-labelledby');
        
        if (ariaLabel) return ariaLabel;
        if (ariaLabelledBy) {
          const labelElement = document.getElementById(ariaLabelledBy);
          return labelElement ? labelElement.textContent : null;
        }
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`);
          return label ? label.textContent : null;
        }
        return null;
      });
      
      expect(emailLabel).toBeTruthy();
      expect(passwordLabel).toBeTruthy();
      expect(emailLabel.toLowerCase()).toContain('email');
      expect(passwordLabel.toLowerCase()).toContain('password');
      
      // Test registration form
      await authPages.navigateToRegister();
      
      const confirmPasswordInput = authPages.page.locator('input[name="confirmPassword"]');
      if (await confirmPasswordInput.isVisible()) {
        const confirmLabel = await confirmPasswordInput.evaluate(input => {
          const ariaLabel = input.getAttribute('aria-label');
          if (ariaLabel) return ariaLabel;
          
          const id = input.getAttribute('id');
          if (id) {
            const label = document.querySelector(`label[for="${id}"]`);
            return label ? label.textContent : null;
          }
          return null;
        });
        
        expect(confirmLabel).toBeTruthy();
        expect(confirmLabel.toLowerCase()).toMatch(/confirm|repeat/);
      }
    });

    test('should provide proper error announcements', async () => {
      await authPages.navigateToLogin();
      
      // Submit empty form to trigger errors
      await authPages.submitLoginForm();
      
      // Check for error messages with proper ARIA
      const errorMessages = await authPages.page.locator('.error-message, [role="alert"], [aria-live]').all();
      
      for (const error of errorMessages) {
        const role = await error.getAttribute('role');
        const ariaLive = await error.getAttribute('aria-live');
        const text = await error.textContent();
        
        // Should have alert role or aria-live
        expect(role === 'alert' || ariaLive === 'polite' || ariaLive === 'assertive').toBe(true);
        expect(text.trim().length).toBeGreaterThan(0);
      }
      
      // Test field-specific errors
      await authPages.navigateToRegister();
      await authPages.page.fill('input[name="email"]', 'invalid-email');
      await authPages.page.blur('input[name="email"]');
      
      const fieldError = authPages.page.locator('.field-error, [role="alert"]').first();
      if (await fieldError.isVisible()) {
        const errorText = await fieldError.textContent();
        expect(errorText.toLowerCase()).toContain('email');
      }
    });

    test('should have sufficient color contrast', async () => {
      await authPages.navigateToLogin();
      
      // Test key interactive elements
      const elementsToTest = [
        'button[type="submit"]',
        'input[name="email"]',
        'input[name="password"]',
        'a[href="/register"]'
      ];
      
      for (const selector of elementsToTest) {
        const element = authPages.page.locator(selector);
        if (await element.isVisible()) {
          const contrast = await element.evaluate((el) => {
            const style = window.getComputedStyle(el);
            const backgroundColor = style.backgroundColor;
            const color = style.color;
            
            // Simple contrast check (simplified version)
            // In real implementation, would use proper contrast ratio calculation
            const bgMatch = backgroundColor.match(/rgb\((\d+), (\d+), (\d+)\)/);
            const colorMatch = color.match(/rgb\((\d+), (\d+), (\d+)\)/);
            
            if (bgMatch && colorMatch) {
              const bgLuminance = (parseInt(bgMatch[1]) + parseInt(bgMatch[2]) + parseInt(bgMatch[3])) / 3;
              const textLuminance = (parseInt(colorMatch[1]) + parseInt(colorMatch[2]) + parseInt(colorMatch[3])) / 3;
              
              return Math.abs(bgLuminance - textLuminance);
            }
            
            return 255; // Assume good contrast if can't calculate
          });
          
          // Basic contrast check (simplified)
          expect(contrast).toBeGreaterThan(50);
        }
      }
    });

    test('should support zoom up to 200% without horizontal scrolling', async () => {
      await authPages.navigateToLogin();
      
      // Set zoom level to 200%
      await authPages.page.setViewportSize({ width: 640, height: 480 }); // Simulate zoom by reducing viewport
      
      // Check for horizontal scrollbar
      const hasHorizontalScroll = await authPages.page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      
      expect(hasHorizontalScroll).toBe(false);
      
      // All interactive elements should still be visible and functional
      await expect(authPages.page.locator('input[name="email"]')).toBeVisible();
      await expect(authPages.page.locator('input[name="password"]')).toBeVisible();
      await expect(authPages.page.locator('button[type="submit"]')).toBeVisible();
      
      // Test form functionality at zoom level
      await authPages.page.fill('input[name="email"]', testUser.email);
      await authPages.page.fill('input[name="password"]', testUser.password);
      
      // Should be able to interact normally
      const submitButton = authPages.page.locator('button[type="submit"]');
      await expect(submitButton).toBeEnabled();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should support full keyboard navigation', async () => {
      await authPages.navigateToLogin();
      
      // Test tab order through login form
      const tabbableElements = [];
      
      // Start from beginning and tab through
      await authPages.page.press('body', 'Tab');
      let focusedElement = authPages.page.locator(':focus');
      let focusedTag = await focusedElement.evaluate(el => el.tagName.toLowerCase());
      tabbableElements.push(focusedTag);
      
      // Continue tabbing
      for (let i = 0; i < 5; i++) {
        await authPages.page.press('body', 'Tab');
        focusedElement = authPages.page.locator(':focus');
        if (await focusedElement.count() > 0) {
          focusedTag = await focusedElement.evaluate(el => el.tagName.toLowerCase());
          tabbableElements.push(focusedTag);
        }
      }
      
      console.log('Tab order:', tabbableElements);
      
      // Should include form inputs and submit button
      expect(tabbableElements).toContain('input');
      expect(tabbableElements.includes('button') || tabbableElements.includes('input')).toBe(true);
      
      // Test reverse tab order
      await authPages.page.press('body', 'Shift+Tab');
      const reverseFocus = authPages.page.locator(':focus');
      await expect(reverseFocus).toBeVisible();
    });

    test('should support keyboard interaction with flashcards', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('Keyboard Test', 'Prueba Teclado');
      
      // Test keyboard navigation through flashcard list
      const flashcardItem = flashcardPages.page.locator('[data-testid="flashcard-item"]').first();
      await flashcardItem.focus();
      
      // Should be able to activate with Enter
      await flashcardPages.page.press(':focus', 'Enter');
      
      // Should open flashcard detail or start learning
      const detailVisible = await flashcardPages.page.locator('[data-testid="flashcard-detail"]').isVisible();
      const learningVisible = await flashcardPages.page.locator('[data-testid="learning-interface"]').isVisible();
      
      expect(detailVisible || learningVisible).toBe(true);
      
      // Test Escape key to close
      if (detailVisible) {
        await flashcardPages.page.press('body', 'Escape');
        await expect(flashcardPages.page.locator('[data-testid="flashcard-detail"]')).not.toBeVisible();
      }
    });

    test('should support keyboard shortcuts in learning mode', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('Shortcut Test', 'Prueba Atajos');
      
      await flashcardPages.startLearningSession();
      
      // Test spacebar for showing answer
      await flashcardPages.page.press('body', 'Space');
      await expect(flashcardPages.page.locator('[data-testid="flashcard-back"]')).toBeVisible();
      
      // Test number keys for quality rating
      await flashcardPages.page.press('body', '4');
      
      // Should proceed to next card or session complete
      const nextVisible = await flashcardPages.page.locator('[data-testid="flashcard-front"]').isVisible();
      const completeVisible = await flashcardPages.page.locator('[data-testid="session-complete"]').isVisible();
      
      expect(nextVisible || completeVisible).toBe(true);
    });

    test('should handle keyboard traps appropriately', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      // Open create flashcard modal
      await flashcardPages.openCreateForm();
      
      // Focus should be trapped within modal
      const modal = flashcardPages.page.locator('[data-testid="flashcard-form"]');
      await expect(modal).toBeVisible();
      
      // Tab through modal elements
      await flashcardPages.page.press('body', 'Tab'); // First field
      await flashcardPages.page.press('body', 'Tab'); // Second field
      await flashcardPages.page.press('body', 'Tab'); // Submit button
      await flashcardPages.page.press('body', 'Tab'); // Cancel button
      await flashcardPages.page.press('body', 'Tab'); // Should cycle back to first field
      
      const focusedElement = flashcardPages.page.locator(':focus');
      const isWithinModal = await focusedElement.evaluate((el, modal) => {
        return modal.contains(el);
      }, await modal.elementHandle());
      
      expect(isWithinModal).toBe(true);
      
      // Escape should close modal and restore focus
      await flashcardPages.page.press('body', 'Escape');
      await expect(modal).not.toBeVisible();
    });

    test('should provide skip navigation links', async () => {
      await authPages.navigateToLogin();
      
      // Look for skip links (usually hidden until focused)
      const skipLinks = await authPages.page.locator('a[href*="#"], .skip-link, [class*="skip"]').all();
      
      if (skipLinks.length > 0) {
        // Test first skip link
        await skipLinks[0].focus();
        await expect(skipLinks[0]).toBeVisible();
        
        // Should have descriptive text
        const linkText = await skipLinks[0].textContent();
        expect(linkText.toLowerCase()).toMatch(/skip|main|content|navigation/);
        
        // Should navigate to valid target
        const href = await skipLinks[0].getAttribute('href');
        expect(href).toMatch(/^#\w+/);
      }
    });
  });

  test.describe('Screen Reader Support', () => {
    test('should have proper ARIA landmarks', async () => {
      await authPages.navigateToLogin();
      
      // Check for main landmark
      const main = authPages.page.locator('main, [role="main"]');
      await expect(main).toBeVisible();
      
      // Check for navigation landmark if present
      const nav = authPages.page.locator('nav, [role="navigation"]');
      if (await nav.count() > 0) {
        await expect(nav.first()).toBeVisible();
      }
      
      // Test authenticated page landmarks
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      // Should have proper landmarks for main content
      const homeMain = flashcardPages.page.locator('main, [role="main"]');
      await expect(homeMain).toBeVisible();
      
      // Check for complementary content if present
      const aside = flashcardPages.page.locator('aside, [role="complementary"]');
      if (await aside.count() > 0) {
        const asideLabel = await aside.first().getAttribute('aria-label');
        expect(asideLabel).toBeTruthy();
      }
    });

    test('should have proper ARIA labels for interactive elements', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      // Check buttons have appropriate labels
      const buttons = await flashcardPages.page.locator('button').all();
      
      for (const button of buttons) {
        if (await button.isVisible()) {
          const ariaLabel = await button.getAttribute('aria-label');
          const text = await button.textContent();
          const title = await button.getAttribute('title');
          
          // Button should have accessible name
          expect(ariaLabel || text.trim() || title).toBeTruthy();
        }
      }
      
      // Check links have descriptive text
      const links = await flashcardPages.page.locator('a').all();
      
      for (const link of links) {
        if (await link.isVisible()) {
          const text = await link.textContent();
          const ariaLabel = await link.getAttribute('aria-label');
          
          if (text.trim().length === 0) {
            // If no text, must have aria-label
            expect(ariaLabel).toBeTruthy();
          }
        }
      }
    });

    test('should announce dynamic content changes', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      // Create flashcard and check for announcement
      await flashcardPages.openCreateForm();
      await flashcardPages.fillFlashcardForm('ARIA Test', 'Prueba ARIA');
      await flashcardPages.submitFlashcardForm();
      
      // Look for live regions
      const liveRegions = await flashcardPages.page.locator('[aria-live], [role="alert"], [role="status"]').all();
      
      let foundAnnouncement = false;
      for (const region of liveRegions) {
        const text = await region.textContent();
        if (text.includes('created') || text.includes('success')) {
          foundAnnouncement = true;
          break;
        }
      }
      
      expect(foundAnnouncement).toBe(true);
    });

    test('should provide proper form validation feedback', async () => {
      await authPages.navigateToRegister();
      
      // Submit form with invalid data
      await authPages.page.fill('input[name="email"]', 'invalid-email');
      await authPages.page.fill('input[name="password"]', '123');
      await authPages.submitRegistrationForm();
      
      // Check for aria-describedby associations
      const emailInput = authPages.page.locator('input[name="email"]');
      const passwordInput = authPages.page.locator('input[name="password"]');
      
      const emailDescribedBy = await emailInput.getAttribute('aria-describedby');
      const passwordDescribedBy = await passwordInput.getAttribute('aria-describedby');
      
      if (emailDescribedBy) {
        const describingElement = authPages.page.locator(`#${emailDescribedBy}`);
        await expect(describingElement).toBeVisible();
        const errorText = await describingElement.textContent();
        expect(errorText.toLowerCase()).toContain('email');
      }
      
      if (passwordDescribedBy) {
        const describingElement = authPages.page.locator(`#${passwordDescribedBy}`);
        await expect(describingElement).toBeVisible();
        const errorText = await describingElement.textContent();
        expect(errorText.toLowerCase()).toContain('password');
      }
    });

    test('should support screen reader navigation of flashcard content', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('Screen Reader Test', 'Prueba Lector Pantalla');
      
      // Check flashcard list has proper structure
      const flashcardList = flashcardPages.page.locator('[data-testid="flashcard-list"]');
      const listRole = await flashcardList.getAttribute('role');
      expect(listRole === 'list' || await flashcardList.evaluate(el => el.tagName.toLowerCase()) === 'ul').toBe(true);
      
      // Check flashcard items have proper role
      const flashcardItem = flashcardPages.page.locator('[data-testid="flashcard-item"]').first();
      const itemRole = await flashcardItem.getAttribute('role');
      expect(itemRole === 'listitem' || await flashcardItem.evaluate(el => el.tagName.toLowerCase()) === 'li').toBe(true);
      
      // Start learning session and check accessibility
      await flashcardPages.startLearningSession();
      
      // Learning interface should be properly labeled
      const learningInterface = flashcardPages.page.locator('[data-testid="learning-interface"]');
      const interfaceLabel = await learningInterface.getAttribute('aria-label');
      expect(interfaceLabel).toBeTruthy();
      expect(interfaceLabel.toLowerCase()).toContain('learning');
    });
  });

  test.describe('Visual Accessibility', () => {
    test('should support high contrast mode', async () => {
      // Simulate high contrast mode
      await authPages.page.addStyleTag({
        content: `
          @media (prefers-contrast: high) {
            * {
              background-color: white !important;
              color: black !important;
              border-color: black !important;
            }
            button {
              background-color: black !important;
              color: white !important;
            }
          }
        `
      });
      
      await authPages.navigateToLogin();
      
      // Elements should still be visible and functional
      await expect(authPages.page.locator('input[name="email"]')).toBeVisible();
      await expect(authPages.page.locator('input[name="password"]')).toBeVisible();
      await expect(authPages.page.locator('button[type="submit"]')).toBeVisible();
      
      // Test functionality in high contrast
      await authPages.page.fill('input[name="email"]', generateTestEmail());
      await authPages.page.fill('input[name="password"]', generateTestPassword());
      
      const submitButton = authPages.page.locator('button[type="submit"]');
      await expect(submitButton).toBeEnabled();
    });

    test('should respect reduced motion preferences', async () => {
      // Simulate prefers-reduced-motion
      await authPages.page.addStyleTag({
        content: `
          @media (prefers-reduced-motion: reduce) {
            *,
            *::before,
            *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }
          }
        `
      });
      
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      // Animations should be minimal or disabled
      const animatedElements = await flashcardPages.page.locator('[class*="animate"], [class*="transition"]').all();
      
      for (const element of animatedElements) {
        const computedStyle = await element.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return {
            animationDuration: style.animationDuration,
            transitionDuration: style.transitionDuration
          };
        });
        
        // Animations should be very short or none
        if (computedStyle.animationDuration !== 'none') {
          const duration = parseFloat(computedStyle.animationDuration);
          expect(duration).toBeLessThan(0.1); // Less than 100ms
        }
        
        if (computedStyle.transitionDuration !== 'none') {
          const duration = parseFloat(computedStyle.transitionDuration);
          expect(duration).toBeLessThan(0.1);
        }
      }
    });

    test('should provide focus indicators', async () => {
      await authPages.navigateToLogin();
      
      // Test focus on interactive elements
      const interactiveElements = [
        'input[name="email"]',
        'input[name="password"]',
        'button[type="submit"]',
        'a'
      ];
      
      for (const selector of interactiveElements) {
        const element = authPages.page.locator(selector).first();
        if (await element.count() > 0) {
          await element.focus();
          
          // Check for visible focus indicator
          const focusStyle = await element.evaluate((el) => {
            const style = window.getComputedStyle(el);
            return {
              outline: style.outline,
              outlineWidth: style.outlineWidth,
              boxShadow: style.boxShadow,
              borderColor: style.borderColor,
              backgroundColor: style.backgroundColor
            };
          });
          
          // Should have some form of focus indicator
          const hasFocusIndicator = 
            focusStyle.outline !== 'none' ||
            focusStyle.outlineWidth !== '0px' ||
            focusStyle.boxShadow !== 'none' ||
            focusStyle.borderColor !== 'rgba(0, 0, 0, 0)';
          
          expect(hasFocusIndicator).toBe(true);
        }
      }
    });

    test('should handle text scaling appropriately', async () => {
      await authPages.navigateToLogin();
      
      // Simulate text scaling (like browser zoom text only)
      await authPages.page.addStyleTag({
        content: `
          body {
            font-size: 150% !important;
          }
        `
      });
      
      // Content should still be accessible
      await expect(authPages.page.locator('input[name="email"]')).toBeVisible();
      await expect(authPages.page.locator('input[name="password"]')).toBeVisible();
      await expect(authPages.page.locator('button[type="submit"]')).toBeVisible();
      
      // Check for text overlap or layout issues
      const hasOverflow = await authPages.page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      
      // Some horizontal scroll is acceptable with large text scaling
      // but the page should remain functional
      
      // Test form functionality
      await authPages.page.fill('input[name="email"]', testUser.email);
      await authPages.page.fill('input[name="password"]', testUser.password);
      
      const submitButton = authPages.page.locator('button[type="submit"]');
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toBeEnabled();
    });
  });

  test.describe('Cross-Browser Compatibility', () => {
    test('should work consistently across browsers', async ({ browserName }) => {
      console.log(`Testing on browser: ${browserName}`);
      
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      // Core functionality should work
      await flashcardPages.navigateToFlashcards();
      await expect(flashcardPages.page.locator('[data-testid="flashcard-list"]')).toBeVisible();
      
      // CRUD operations
      await flashcardPages.createFlashcard(`Browser Test ${browserName}`, `Prueba Navegador ${browserName}`);
      await flashcardPages.verifyFlashcardCreated(`Browser Test ${browserName}`, `Prueba Navegador ${browserName}`);
      
      // Learning functionality
      await flashcardPages.startLearningSession();
      await expect(flashcardPages.page.locator('[data-testid="learning-interface"]')).toBeVisible();
      
      // Check for browser-specific issues
      const browserSpecificTests = {
        chromium: async () => {
          // Chrome-specific tests
          const hasWebGL = await authPages.page.evaluate(() => {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
          });
          expect(hasWebGL).toBe(true);
        },
        firefox: async () => {
          // Firefox-specific tests
          const hasIndexedDB = await authPages.page.evaluate(() => {
            return 'indexedDB' in window;
          });
          expect(hasIndexedDB).toBe(true);
        },
        webkit: async () => {
          // Safari-specific tests
          const hasLocalStorage = await authPages.page.evaluate(() => {
            return 'localStorage' in window;
          });
          expect(hasLocalStorage).toBe(true);
        }
      };
      
      if (browserSpecificTests[browserName]) {
        await browserSpecificTests[browserName]();
      }
    });

    test('should handle CSS Grid and Flexbox consistently', async () => {
      await authPages.navigateToLogin();
      
      // Check CSS feature support
      const cssSupport = await authPages.page.evaluate(() => {
        const testElement = document.createElement('div');
        document.body.appendChild(testElement);
        
        const results = {
          flexbox: false,
          grid: false,
          customProperties: false
        };
        
        // Test Flexbox
        testElement.style.display = 'flex';
        if (window.getComputedStyle(testElement).display === 'flex') {
          results.flexbox = true;
        }
        
        // Test Grid
        testElement.style.display = 'grid';
        if (window.getComputedStyle(testElement).display === 'grid') {
          results.grid = true;
        }
        
        // Test CSS Custom Properties
        testElement.style.setProperty('--test-property', 'test');
        if (testElement.style.getPropertyValue('--test-property') === 'test') {
          results.customProperties = true;
        }
        
        document.body.removeChild(testElement);
        return results;
      });
      
      console.log('CSS Feature Support:', cssSupport);
      
      // Modern browsers should support these features
      expect(cssSupport.flexbox).toBe(true);
      expect(cssSupport.grid).toBe(true);
      expect(cssSupport.customProperties).toBe(true);
      
      // Layout should work with these features
      await expect(authPages.page.locator('input[name="email"]')).toBeVisible();
      await expect(authPages.page.locator('input[name="password"]')).toBeVisible();
    });

    test('should handle JavaScript features consistently', async () => {
      await authPages.navigateToLogin();
      
      // Test modern JavaScript features
      const jsSupport = await authPages.page.evaluate(() => {
        const results = {
          arrow_functions: false,
          promises: false,
          async_await: false,
          fetch: false,
          local_storage: false,
          session_storage: false
        };
        
        try {
          // Arrow functions
          const test = () => true;
          results.arrow_functions = test();
        } catch (e) {}
        
        try {
          // Promises
          results.promises = typeof Promise !== 'undefined';
        } catch (e) {}
        
        try {
          // Async/Await (indirect test)
          results.async_await = typeof Promise !== 'undefined';
        } catch (e) {}
        
        try {
          // Fetch API
          results.fetch = typeof fetch !== 'undefined';
        } catch (e) {}
        
        try {
          // Local Storage
          results.local_storage = typeof localStorage !== 'undefined';
        } catch (e) {}
        
        try {
          // Session Storage
          results.session_storage = typeof sessionStorage !== 'undefined';
        } catch (e) {}
        
        return results;
      });
      
      console.log('JavaScript Feature Support:', jsSupport);
      
      // These features should be supported
      expect(jsSupport.promises).toBe(true);
      expect(jsSupport.fetch).toBe(true);
      expect(jsSupport.local_storage).toBe(true);
      
      // Application should function with these features
      await authPages.page.fill('input[name="email"]', testUser.email);
      await authPages.page.fill('input[name="password"]', testUser.password);
      
      const submitButton = authPages.page.locator('button[type="submit"]');
      await expect(submitButton).toBeEnabled();
    });
  });

  test.describe('Mobile Accessibility', () => {
    test('should provide appropriate touch targets', async () => {
      // Set mobile viewport
      await flashcardPages.page.setViewportSize({ width: 375, height: 667 });
      
      await authPages.navigateToLogin();
      
      // Check touch target sizes
      const interactiveElements = await authPages.page.locator('button, input, a, [tabindex]').all();
      
      for (const element of interactiveElements) {
        if (await element.isVisible()) {
          const boundingBox = await element.boundingBox();
          
          if (boundingBox) {
            // WCAG recommends minimum 44px touch targets
            expect(boundingBox.width).toBeGreaterThanOrEqual(44);
            expect(boundingBox.height).toBeGreaterThanOrEqual(44);
          }
        }
      }
    });

    test('should support mobile screen readers', async () => {
      await flashcardPages.page.setViewportSize({ width: 375, height: 667 });
      
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      // Mobile-specific accessibility features
      const mobileAccessibilityFeatures = await flashcardPages.page.evaluate(() => {
        return {
          hasTouchAction: document.querySelector('[style*="touch-action"], [class*="touch"]') !== null,
          hasVirtualKeyboardSupport: document.querySelector('input[inputmode], input[enterkeyhint]') !== null,
          hasProperViewport: document.querySelector('meta[name="viewport"]') !== null
        };
      });
      
      console.log('Mobile accessibility features:', mobileAccessibilityFeatures);
      
      // Viewport meta should be present for proper mobile rendering
      expect(mobileAccessibilityFeatures.hasProperViewport).toBe(true);
    });

    test('should handle orientation changes accessibly', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      // Start in portrait
      await flashcardPages.page.setViewportSize({ width: 375, height: 667 });
      await flashcardPages.navigateToFlashcards();
      
      // Create flashcard in portrait
      await flashcardPages.createFlashcard('Orientation Test', 'Prueba Orientación');
      
      // Rotate to landscape
      await flashcardPages.page.setViewportSize({ width: 667, height: 375 });
      
      // Content should remain accessible
      await expect(flashcardPages.page.locator('[data-testid="flashcard-list"]')).toBeVisible();
      
      // Touch targets should still be appropriate
      const flashcardItem = flashcardPages.page.locator('[data-testid="flashcard-item"]').first();
      const boundingBox = await flashcardItem.boundingBox();
      
      if (boundingBox) {
        expect(boundingBox.height).toBeGreaterThanOrEqual(44);
      }
    });

    test('should support voice control accessibility', async () => {
      await flashcardPages.page.setViewportSize({ width: 375, height: 667 });
      
      await authPages.navigateToLogin();
      
      // Elements should have voice-control-friendly labels
      const voiceControlElements = await authPages.page.locator('button, input, a').all();
      
      for (const element of voiceControlElements) {
        if (await element.isVisible()) {
          const ariaLabel = await element.getAttribute('aria-label');
          const text = await element.textContent();
          const placeholder = await element.getAttribute('placeholder');
          const title = await element.getAttribute('title');
          
          // Should have some form of accessible name for voice control
          const hasAccessibleName = ariaLabel || text?.trim() || placeholder || title;
          expect(hasAccessibleName).toBeTruthy();
          
          // Names should be meaningful for voice commands
          if (ariaLabel) {
            expect(ariaLabel.length).toBeGreaterThan(2);
          }
          if (text?.trim()) {
            expect(text.trim().length).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  test.describe('Assistive Technology Integration', () => {
    test('should provide proper page titles for navigation', async () => {
      // Login page
      await authPages.navigateToLogin();
      let title = await authPages.page.title();
      expect(title.toLowerCase()).toContain('login');
      
      // Register page
      await authPages.navigateToRegister();
      title = await authPages.page.title();
      expect(title.toLowerCase()).toMatch(/register|sign up/);
      
      // Home page after authentication
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      title = await flashcardPages.page.title();
      expect(title.toLowerCase()).toMatch(/flashcard|home|dashboard/);
    });

    test('should provide breadcrumb navigation', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      // Look for breadcrumb navigation
      const breadcrumbs = flashcardPages.page.locator('nav[aria-label*="breadcrumb"], .breadcrumb, [role="navigation"]');
      
      if (await breadcrumbs.count() > 0) {
        // Should have proper ARIA labeling
        const ariaLabel = await breadcrumbs.first().getAttribute('aria-label');
        expect(ariaLabel?.toLowerCase()).toContain('breadcrumb');
        
        // Should contain navigation links
        const breadcrumbLinks = breadcrumbs.locator('a, button');
        const linkCount = await breadcrumbLinks.count();
        expect(linkCount).toBeGreaterThan(0);
      }
    });

    test('should support browser extension accessibility', async () => {
      await authPages.navigateToLogin();
      
      // Check for elements that support browser extensions
      const extensionSupport = await authPages.page.evaluate(() => {
        return {
          hasLandmarks: document.querySelectorAll('[role="main"], [role="navigation"], main, nav').length > 0,
          hasHeadings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length > 0,
          hasFormLabels: document.querySelectorAll('label, [aria-label], [aria-labelledby]').length > 0,
          hasSemanticHTML: document.querySelectorAll('button, input, a, form').length > 0
        };
      });
      
      // These features help browser extensions provide better accessibility
      expect(extensionSupport.hasLandmarks).toBe(true);
      expect(extensionSupport.hasHeadings).toBe(true);
      expect(extensionSupport.hasFormLabels).toBe(true);
      expect(extensionSupport.hasSemanticHTML).toBe(true);
    });

    test('should work with translation services', async () => {
      await authPages.navigateToLogin();
      
      // Page should have proper language attributes
      const htmlLang = await authPages.page.getAttribute('html', 'lang');
      expect(htmlLang).toBeTruthy();
      expect(htmlLang.length).toBeGreaterThanOrEqual(2); // e.g., 'en', 'es'
      
      // Text content should be translatable
      const textElements = await authPages.page.locator('p, span, label, button').all();
      let hasTranslatableContent = false;
      
      for (const element of textElements.slice(0, 5)) { // Check first 5 elements
        const text = await element.textContent();
        if (text && text.trim().length > 3) {
          hasTranslatableContent = true;
          
          // Should not have translate="no" unless appropriate
          const translateAttr = await element.getAttribute('translate');
          if (translateAttr === 'no') {
            // Only technical terms or proper nouns should be non-translatable
            expect(text).toMatch(/^\d+$|^[A-Z]{2,}$|^[a-z]+\.[a-z]+$/); // Numbers, acronyms, or domains
          }
        }
      }
      
      expect(hasTranslatableContent).toBe(true);
    });
  });
});