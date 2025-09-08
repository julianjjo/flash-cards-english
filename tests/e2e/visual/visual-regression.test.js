/**
 * Visual Regression Tests - Screenshot comparison and UI consistency validation
 * 
 * Features:
 * - Cross-browser screenshot comparison
 * - Responsive design validation
 * - Component visual consistency
 * - Theme and styling regression detection
 * - Automatic baseline generation and management
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;
const { TestDataManager } = require('../../setup/data-manager');
const { TEST_USERS } = require('../../fixtures/test-data');

class VisualRegressionTester {
  constructor(page, browserName) {
    this.page = page;
    this.browserName = browserName;
    this.baselineDir = path.join(__dirname, '../../visual-baselines', browserName);
    this.resultsDir = path.join(__dirname, '../../visual-results', browserName);
    this.dataManager = new TestDataManager();
  }

  async initialize() {
    await this.dataManager.initialize();
    await this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.baselineDir, { recursive: true });
      await fs.mkdir(this.resultsDir, { recursive: true });
    } catch (error) {
      // Directories might already exist
    }
  }

  async takeScreenshot(name, options = {}) {
    const screenshotOptions = {
      path: path.join(this.resultsDir, `${name}.png`),
      fullPage: options.fullPage || false,
      clip: options.clip,
      mask: options.mask || [],
      threshold: options.threshold || 0.2,
      ...options
    };

    return await this.page.screenshot(screenshotOptions);
  }

  async compareVisual(name, options = {}) {
    // Configure visual comparison options
    const visualOptions = {
      threshold: options.threshold || 0.2,
      maxDiffPixels: options.maxDiffPixels || 100,
      animations: 'disabled',
      ...options
    };

    return await expect(this.page).toHaveScreenshot(`${name}.png`, visualOptions);
  }

  async maskDynamicElements() {
    // Mask elements that change dynamically (timestamps, etc.)
    const dynamicSelectors = [
      '[data-testid="timestamp"]',
      '[data-testid="current-time"]',
      '.loading-spinner',
      '.progress-indicator'
    ];

    const masks = [];
    for (const selector of dynamicSelectors) {
      try {
        const element = this.page.locator(selector);
        if (await element.isVisible()) {
          masks.push(element);
        }
      } catch (error) {
        // Element might not exist on this page
      }
    }

    return masks;
  }

  async waitForStableState() {
    // Wait for animations and loading to complete
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000); // Additional wait for animations
    
    // Wait for any loading indicators to disappear
    try {
      await this.page.waitForSelector('.loading', { state: 'hidden', timeout: 5000 });
    } catch (error) {
      // Loading indicator might not exist
    }
  }

  async setupTestUser() {
    const user = await this.dataManager.createTestUser(TEST_USERS[0]);
    
    // Create sample flashcards for consistent visuals
    const flashcards = [];
    const sampleCards = [
      { english: 'Hello', spanish: 'Hola' },
      { english: 'Goodbye', spanish: 'Adiós' },
      { english: 'Thank you', spanish: 'Gracias' },
      { english: 'Please', spanish: 'Por favor' },
      { english: 'Water', spanish: 'Agua' }
    ];

    for (const card of sampleCards) {
      const flashcard = await this.dataManager.createTestFlashcard(card, user.id);
      flashcards.push(flashcard);
    }

    return { user, flashcards };
  }
}

// Test Configuration
test.describe('Visual Regression Tests', () => {
  let visualTester;
  let testUser;

  test.beforeEach(async ({ page, browserName }) => {
    visualTester = new VisualRegressionTester(page, browserName);
    await visualTester.initialize();
    
    // Set up test data
    const userData = await visualTester.setupTestUser();
    testUser = userData.user;
  });

  test.afterEach(async () => {
    if (visualTester.dataManager) {
      await visualTester.dataManager.fullCleanup();
    }
  });

  // Landing Page Visual Tests
  test.describe('Landing Page', () => {
    test('should match baseline screenshot', async ({ page }) => {
      await page.goto('/');
      await visualTester.waitForStableState();
      
      const masks = await visualTester.maskDynamicElements();
      await visualTester.compareVisual('landing-page', {
        mask: masks,
        fullPage: true
      });
    });

    test('should match mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await visualTester.waitForStableState();
      
      await visualTester.compareVisual('landing-page-mobile', {
        fullPage: true
      });
    });

    test('should match tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      await visualTester.waitForStableState();
      
      await visualTester.compareVisual('landing-page-tablet', {
        fullPage: true
      });
    });
  });

  // Authentication Pages
  test.describe('Authentication Pages', () => {
    test('login page should match baseline', async ({ page }) => {
      await page.goto('/login');
      await visualTester.waitForStableState();
      
      await visualTester.compareVisual('login-page');
    });

    test('register page should match baseline', async ({ page }) => {
      await page.goto('/register');
      await visualTester.waitForStableState();
      
      await visualTester.compareVisual('register-page');
    });

    test('login form with validation errors', async ({ page }) => {
      await page.goto('/login');
      
      // Trigger validation errors
      await page.click('button[type="submit"]');
      await page.waitForSelector('.error-message', { state: 'visible' });
      
      await visualTester.compareVisual('login-page-with-errors');
    });

    test('login form filled state', async ({ page }) => {
      await page.goto('/login');
      
      // Fill form
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      
      await visualTester.compareVisual('login-page-filled');
    });
  });

  // Home Page (Authenticated)
  test.describe('Home Page - Authenticated', () => {
    test.beforeEach(async ({ page }) => {
      // Login user
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL('/home');
    });

    test('home page should match baseline', async ({ page }) => {
      await visualTester.waitForStableState();
      
      const masks = await visualTester.maskDynamicElements();
      await visualTester.compareVisual('home-page-authenticated', {
        mask: masks,
        fullPage: true
      });
    });

    test('flashcard component should match baseline', async ({ page }) => {
      // Wait for flashcard to be visible
      await page.waitForSelector('[data-testid="flashcard"]', { state: 'visible' });
      
      const flashcardElement = page.locator('[data-testid="flashcard"]');
      await expect(flashcardElement).toHaveScreenshot('flashcard-component.png');
    });

    test('flashcard flipped state', async ({ page }) => {
      await page.waitForSelector('[data-testid="flashcard"]', { state: 'visible' });
      
      // Flip the card
      await page.click('[data-testid="flashcard"]');
      await page.waitForTimeout(500); // Wait for flip animation
      
      const flashcardElement = page.locator('[data-testid="flashcard"]');
      await expect(flashcardElement).toHaveScreenshot('flashcard-component-flipped.png');
    });

    test('study session controls', async ({ page }) => {
      await page.waitForSelector('[data-testid="study-controls"]', { state: 'visible' });
      
      const controlsElement = page.locator('[data-testid="study-controls"]');
      await expect(controlsElement).toHaveScreenshot('study-controls.png');
    });
  });

  // Admin Dashboard
  test.describe('Admin Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      // Create admin user and login
      const adminUser = await visualTester.dataManager.createTestUser({
        email: 'admin@test.com',
        password: 'AdminPassword123!',
        role: 'admin'
      });

      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', adminUser.email);
      await page.fill('[data-testid="password-input"]', 'AdminPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL('/admin');
    });

    test('admin dashboard should match baseline', async ({ page }) => {
      await visualTester.waitForStableState();
      
      const masks = await visualTester.maskDynamicElements();
      await visualTester.compareVisual('admin-dashboard', {
        mask: masks,
        fullPage: true
      });
    });

    test('user management table', async ({ page }) => {
      await page.waitForSelector('[data-testid="users-table"]', { state: 'visible' });
      
      const tableElement = page.locator('[data-testid="users-table"]');
      await expect(tableElement).toHaveScreenshot('users-table.png', {
        mask: [page.locator('[data-testid="user-id"]')] // Mask dynamic IDs
      });
    });

    test('add user modal', async ({ page }) => {
      await page.click('[data-testid="add-user-button"]');
      await page.waitForSelector('[data-testid="add-user-modal"]', { state: 'visible' });
      
      const modalElement = page.locator('[data-testid="add-user-modal"]');
      await expect(modalElement).toHaveScreenshot('add-user-modal.png');
    });
  });

  // Error Pages
  test.describe('Error Pages', () => {
    test('404 page should match baseline', async ({ page }) => {
      await page.goto('/nonexistent-page');
      await visualTester.waitForStableState();
      
      await visualTester.compareVisual('404-page');
    });

    test('network error state', async ({ page }) => {
      // Mock network failure
      await page.route('**/api/**', route => route.abort());
      
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      
      // Wait for error message
      await page.waitForSelector('[data-testid="network-error"]', { state: 'visible' });
      
      await visualTester.compareVisual('network-error-state');
    });
  });

  // Component States
  test.describe('Component States', () => {
    test.beforeEach(async ({ page }) => {
      // Login user
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL('/home');
    });

    test('loading states', async ({ page }) => {
      // Navigate to a page that shows loading
      await page.route('**/api/flashcards', route => {
        // Delay the response to capture loading state
        setTimeout(() => route.continue(), 2000);
      });

      await page.reload();
      
      // Capture loading state
      await page.waitForSelector('[data-testid="loading-spinner"]', { state: 'visible' });
      await visualTester.compareVisual('loading-state');
    });

    test('empty state', async ({ page }) => {
      // Remove all flashcards to show empty state
      await visualTester.dataManager.cleanupDatabase();
      
      await page.reload();
      await page.waitForSelector('[data-testid="empty-state"]', { state: 'visible' });
      
      await visualTester.compareVisual('empty-state');
    });

    test('success notification', async ({ page }) => {
      // Trigger a success action
      await page.click('[data-testid="add-flashcard-button"]');
      await page.fill('[data-testid="english-input"]', 'Test English');
      await page.fill('[data-testid="spanish-input"]', 'Test Español');
      await page.click('[data-testid="save-flashcard"]');
      
      // Wait for success notification
      await page.waitForSelector('[data-testid="success-notification"]', { state: 'visible' });
      
      await visualTester.compareVisual('success-notification');
    });

    test('error notification', async ({ page }) => {
      // Mock API error
      await page.route('**/api/flashcards', route => route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Server error' })
      }));

      await page.click('[data-testid="add-flashcard-button"]');
      await page.fill('[data-testid="english-input"]', 'Test English');
      await page.fill('[data-testid="spanish-input"]', 'Test Español');
      await page.click('[data-testid="save-flashcard"]');
      
      // Wait for error notification
      await page.waitForSelector('[data-testid="error-notification"]', { state: 'visible' });
      
      await visualTester.compareVisual('error-notification');
    });
  });

  // Cross-browser Consistency
  test.describe('Cross-browser Consistency', () => {
    test('consistent rendering across browsers', async ({ page, browserName }) => {
      await page.goto('/');
      await visualTester.waitForStableState();
      
      // Take screenshot for comparison across browsers
      await visualTester.compareVisual(`cross-browser-${browserName}`, {
        fullPage: true
      });
    });

    test('form elements consistency', async ({ page, browserName }) => {
      await page.goto('/login');
      
      // Focus on form elements to test styling
      await page.focus('[data-testid="email-input"]');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      
      const formElement = page.locator('form');
      await expect(formElement).toHaveScreenshot(`form-elements-${browserName}.png`);
    });
  });

  // Responsive Design Validation
  test.describe('Responsive Design', () => {
    const viewports = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1920, height: 1080 },
      { name: 'small-desktop', width: 1366, height: 768 }
    ];

    viewports.forEach(viewport => {
      test(`should render correctly on ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/');
        await visualTester.waitForStableState();
        
        await visualTester.compareVisual(`responsive-${viewport.name}`, {
          fullPage: true
        });
      });
    });

    test('navigation menu responsive behavior', async ({ page }) => {
      // Test mobile menu
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      
      // Login first
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL('/home');
      
      // Open mobile menu
      await page.click('[data-testid="mobile-menu-toggle"]');
      await page.waitForSelector('[data-testid="mobile-menu"]', { state: 'visible' });
      
      await visualTester.compareVisual('mobile-navigation-menu');
    });
  });
});

// Visual Regression Utilities
test.describe('Visual Regression Utilities', () => {
  test('generate baseline screenshots', async ({ page, browserName }) => {
    if (process.env.UPDATE_SNAPSHOTS !== 'true') {
      test.skip();
    }

    const visualTester = new VisualRegressionTester(page, browserName);
    await visualTester.initialize();
    
    console.log(`Generating baseline screenshots for ${browserName}...`);
    
    // Generate baselines for key pages
    const pages = [
      { url: '/', name: 'landing-page' },
      { url: '/login', name: 'login-page' },
      { url: '/register', name: 'register-page' }
    ];

    for (const { url, name } of pages) {
      await page.goto(url);
      await visualTester.waitForStableState();
      await visualTester.takeScreenshot(`${name}-baseline`);
    }
  });
});

module.exports = { VisualRegressionTester };