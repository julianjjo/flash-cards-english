import { expect } from '@playwright/test';

/**
 * Common utilities for E2E testing
 * 
 * This module provides shared utilities and helper functions that can be used
 * across all E2E test files to reduce code duplication and improve maintainability.
 * 
 * Usage:
 *   import { waitForElement, verifyPageTitle, generateTestEmail } from '../utils/testUtils.js';
 *   await waitForElement(page, '[data-testid="login-form"]');
 */

// Time constants
export const TIMEOUTS = {
  SHORT: 1000,
  MEDIUM: 5000,
  LONG: 30000,
  VERY_LONG: 60000
};

// Common selectors
export const SELECTORS = {
  // Authentication
  LOGIN_FORM: '[data-testid="login-form"]',
  REGISTER_FORM: '[data-testid="register-form"]',
  EMAIL_INPUT: 'input[name="email"]',
  PASSWORD_INPUT: 'input[name="password"]',
  SUBMIT_BUTTON: 'button[type="submit"]',
  LOGOUT_BUTTON: '[data-testid="logout-button"]',
  USER_PROFILE: '[data-testid="user-profile"]',
  
  // Flashcards
  FLASHCARD_LIST: '[data-testid="flashcard-list"]',
  FLASHCARD_ITEM: '[data-testid="flashcard-item"]',
  FLASHCARD_FORM: '[data-testid="flashcard-form"]',
  ADD_FLASHCARD_BUTTON: '[data-testid="add-flashcard-button"]',
  EDIT_BUTTON: '[data-testid="edit-button"]',
  DELETE_BUTTON: '[data-testid="delete-button"]',
  SEARCH_INPUT: '[data-testid="search-flashcards"]',
  
  // Learning interface
  LEARNING_INTERFACE: '[data-testid="learning-interface"]',
  FLASHCARD_FRONT: '[data-testid="flashcard-front"]',
  FLASHCARD_BACK: '[data-testid="flashcard-back"]',
  SHOW_ANSWER_BUTTON: '[data-testid="show-answer-button"]',
  START_LEARNING_BUTTON: '[data-testid="start-learning-button"]',
  
  // Admin
  ADMIN_DASHBOARD: '[data-testid="admin-dashboard"]',
  ADMIN_MENU: '[data-testid="admin-menu"]',
  USER_MANAGEMENT: '[data-testid="user-management"]',
  SYSTEM_STATS: '[data-testid="system-stats"]',
  
  // Audio
  AUDIO_PLAYER: '[data-testid="audio-player"]',
  PLAY_AUDIO_BUTTON: '[data-testid="play-audio"]',
  TTS_CONTROLS: '[data-testid="tts-controls"]',
  
  // Common UI elements
  SUCCESS_MESSAGE: '.success-message',
  ERROR_MESSAGE: '.error-message',
  LOADING_SPINNER: '[data-testid="loading-spinner"]',
  MODAL: '[data-testid="modal"]',
  CONFIRM_DIALOG: '[data-testid="confirm-dialog"]'
};

// Test data generators
export function generateTestEmail(prefix = 'test') {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${prefix}.${timestamp}.${random}@example.com`;
}

export function generateTestPassword(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export function generateFlashcardData(count = 5) {
  const flashcards = [];
  const englishWords = ['Hello', 'Goodbye', 'Please', 'Thank you', 'Excuse me', 'Yes', 'No', 'Water', 'Food', 'Help'];
  const spanishWords = ['Hola', 'Adiós', 'Por favor', 'Gracias', 'Disculpe', 'Sí', 'No', 'Agua', 'Comida', 'Ayuda'];
  
  for (let i = 0; i < count; i++) {
    const index = i % englishWords.length;
    flashcards.push({
      english: `${englishWords[index]} ${i + 1}`,
      spanish: `${spanishWords[index]} ${i + 1}`
    });
  }
  
  return flashcards;
}

// Wait utilities
export async function waitForElement(page, selector, options = {}) {
  const timeout = options.timeout || TIMEOUTS.MEDIUM;
  const state = options.state || 'visible';
  
  await page.locator(selector).waitFor({ state, timeout });
  return page.locator(selector);
}

export async function waitForElementToDisappear(page, selector, timeout = TIMEOUTS.MEDIUM) {
  await page.locator(selector).waitFor({ state: 'hidden', timeout });
}

export async function waitForText(page, text, options = {}) {
  const timeout = options.timeout || TIMEOUTS.MEDIUM;
  await page.waitForFunction(
    (searchText) => document.body.textContent.includes(searchText),
    text,
    { timeout }
  );
}

export async function waitForURL(page, urlPattern, timeout = TIMEOUTS.MEDIUM) {
  if (typeof urlPattern === 'string') {
    await expect(page).toHaveURL(urlPattern, { timeout });
  } else {
    await expect(page).toHaveURL(urlPattern, { timeout });
  }
}

// Navigation utilities
export async function navigateAndWait(page, url, expectedSelector = null) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  
  if (expectedSelector) {
    await waitForElement(page, expectedSelector);
  }
}

export async function refreshAndWait(page, expectedSelector = null) {
  await page.reload();
  await page.waitForLoadState('networkidle');
  
  if (expectedSelector) {
    await waitForElement(page, expectedSelector);
  }
}

// Form utilities
export async function fillForm(page, formData) {
  for (const [fieldName, value] of Object.entries(formData)) {
    await page.fill(`input[name="${fieldName}"]`, value);
  }
}

export async function submitForm(page, formSelector = 'form') {
  await page.click(`${formSelector} button[type="submit"]`);
}

export async function fillAndSubmitForm(page, formData, formSelector = 'form') {
  await fillForm(page, formData);
  await submitForm(page, formSelector);
}

// Verification utilities
export async function verifyPageTitle(page, expectedTitle) {
  await expect(page).toHaveTitle(expectedTitle);
}

export async function verifyElementText(page, selector, expectedText) {
  await expect(page.locator(selector)).toContainText(expectedText);
}

export async function verifyElementExists(page, selector) {
  await expect(page.locator(selector)).toBeVisible();
}

export async function verifyElementNotExists(page, selector) {
  await expect(page.locator(selector)).not.toBeVisible();
}

export async function verifySuccessMessage(page, message = null) {
  const successLocator = page.locator(SELECTORS.SUCCESS_MESSAGE);
  await expect(successLocator).toBeVisible();
  
  if (message) {
    await expect(successLocator).toContainText(message);
  }
}

export async function verifyErrorMessage(page, message = null) {
  const errorLocator = page.locator(SELECTORS.ERROR_MESSAGE);
  await expect(errorLocator).toBeVisible();
  
  if (message) {
    await expect(errorLocator).toContainText(message);
  }
}

// Authentication utilities
export async function verifyAuthenticated(page, expectedEmail = null) {
  // Check for auth token in localStorage
  const authToken = await page.evaluate(() => localStorage.getItem('authToken'));
  expect(authToken).toBeTruthy();
  
  // Verify user profile is visible
  await verifyElementExists(page, SELECTORS.USER_PROFILE);
  
  if (expectedEmail) {
    await verifyElementText(page, SELECTORS.USER_PROFILE, expectedEmail);
  }
}

export async function verifyNotAuthenticated(page) {
  // Check that no auth token exists
  const authToken = await page.evaluate(() => localStorage.getItem('authToken'));
  expect(authToken).toBeFalsy();
  
  // Verify login link is available
  await verifyElementExists(page, 'a[href="/login"]');
}

export async function clearAuthToken(page) {
  await page.evaluate(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
  });
}

// Database utilities
export async function clearUserData(page, userId) {
  // This would typically interact with a test API to clear user-specific data
  await page.evaluate((id) => {
    // Clear any cached user data from browser storage
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.includes('user') || key.includes(id)) {
        localStorage.removeItem(key);
      }
    });
  }, userId);
}

// Performance utilities
export async function measurePageLoadTime(page, url) {
  const startTime = Date.now();
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  const endTime = Date.now();
  
  return endTime - startTime;
}

export async function measureElementRenderTime(page, selector) {
  const startTime = Date.now();
  await waitForElement(page, selector);
  const endTime = Date.now();
  
  return endTime - startTime;
}

// Mobile and responsive utilities
export async function setMobileViewport(page) {
  await page.setViewportSize({ width: 375, height: 667 });
}

export async function setTabletViewport(page) {
  await page.setViewportSize({ width: 768, height: 1024 });
}

export async function setDesktopViewport(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
}

// Screenshot utilities
export async function takeScreenshot(page, name, options = {}) {
  const timestamp = Date.now();
  const filename = `${name}-${timestamp}.png`;
  
  await page.screenshot({
    path: `tests/screenshots/${filename}`,
    fullPage: options.fullPage || false,
    ...options
  });
  
  return filename;
}

// Network utilities
export async function interceptNetworkRequests(page, urlPattern, response = null) {
  await page.route(urlPattern, (route) => {
    if (response) {
      route.fulfill(response);
    } else {
      route.continue();
    }
  });
}

export async function waitForNetworkRequest(page, urlPattern, timeout = TIMEOUTS.MEDIUM) {
  return await page.waitForRequest(urlPattern, { timeout });
}

export async function waitForNetworkResponse(page, urlPattern, timeout = TIMEOUTS.MEDIUM) {
  return await page.waitForResponse(urlPattern, { timeout });
}

// Accessibility utilities
export async function verifyAccessibilityAttributes(page, selector) {
  const element = page.locator(selector);
  
  // Check for common accessibility attributes
  const role = await element.getAttribute('role');
  const ariaLabel = await element.getAttribute('aria-label');
  const ariaDescribedBy = await element.getAttribute('aria-describedby');
  
  // At least one accessibility attribute should be present
  expect(role || ariaLabel || ariaDescribedBy).toBeTruthy();
}

export async function testKeyboardNavigation(page, elements) {
  // Tab through elements and verify focus
  for (let i = 0; i < elements.length; i++) {
    await page.press('body', 'Tab');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  }
}

// Error handling utilities
export async function expectNoConsoleErrors(page) {
  const consoleErrors = [];
  
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  
  // Return a function that can be called to assert no errors
  return () => {
    expect(consoleErrors).toHaveLength(0);
  };
}

export async function handleExpectedErrors(page, errorMessages = []) {
  const consoleErrors = [];
  
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const errorText = message.text();
      if (!errorMessages.some(expectedError => errorText.includes(expectedError))) {
        consoleErrors.push(errorText);
      }
    }
  });
  
  return () => {
    expect(consoleErrors).toHaveLength(0);
  };
}

// Retry utilities
export async function retryAction(action, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// Clean up utilities
export async function cleanupTestData(page) {
  // Clear browser storage
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  
  // Clear cookies
  await page.context().clearCookies();
}

// Test state utilities
export class TestState {
  constructor() {
    this.data = new Map();
  }
  
  set(key, value) {
    this.data.set(key, value);
  }
  
  get(key) {
    return this.data.get(key);
  }
  
  has(key) {
    return this.data.has(key);
  }
  
  clear() {
    this.data.clear();
  }
  
  getAll() {
    return Object.fromEntries(this.data);
  }
}

// Export a singleton instance for shared test state
export const testState = new TestState();

// Debug utilities
export async function debugElement(page, selector, message = '') {
  const element = page.locator(selector);
  const isVisible = await element.isVisible();
  const count = await element.count();
  const text = count > 0 ? await element.textContent() : 'N/A';
  
  console.log(`DEBUG ${message}: Selector: ${selector}, Visible: ${isVisible}, Count: ${count}, Text: ${text}`);
}

export async function debugPageState(page, message = '') {
  const url = page.url();
  const title = await page.title();
  
  console.log(`DEBUG ${message}: URL: ${url}, Title: ${title}`);
}

export default {
  TIMEOUTS,
  SELECTORS,
  generateTestEmail,
  generateTestPassword,
  generateFlashcardData,
  waitForElement,
  waitForElementToDisappear,
  waitForText,
  waitForURL,
  navigateAndWait,
  refreshAndWait,
  fillForm,
  submitForm,
  fillAndSubmitForm,
  verifyPageTitle,
  verifyElementText,
  verifyElementExists,
  verifyElementNotExists,
  verifySuccessMessage,
  verifyErrorMessage,
  verifyAuthenticated,
  verifyNotAuthenticated,
  clearAuthToken,
  clearUserData,
  measurePageLoadTime,
  measureElementRenderTime,
  setMobileViewport,
  setTabletViewport,
  setDesktopViewport,
  takeScreenshot,
  interceptNetworkRequests,
  waitForNetworkRequest,
  waitForNetworkResponse,
  verifyAccessibilityAttributes,
  testKeyboardNavigation,
  expectNoConsoleErrors,
  handleExpectedErrors,
  retryAction,
  cleanupTestData,
  TestState,
  testState,
  debugElement,
  debugPageState
};