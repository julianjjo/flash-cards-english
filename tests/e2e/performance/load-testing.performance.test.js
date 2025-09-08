import { test, expect } from '@playwright/test';
import { AuthPages } from '../pages/AuthPages.js';
import { FlashcardPages } from '../pages/FlashcardPages.js';
import { AdminPages } from '../pages/AdminPages.js';
import { setupTestEnvironment, teardownTestEnvironment, dbHelper } from '../utils/databaseHelpers.js';
import { generateTestEmail, generateTestPassword, TIMEOUTS } from '../utils/testUtils.js';

/**
 * Performance Testing and Load Scenarios
 * 
 * These tests verify the application performs well under various load conditions:
 * - Page load time benchmarks
 * - Large dataset handling
 * - Concurrent user simulations
 * - Memory usage monitoring
 * - Database query performance
 * - Network payload optimization
 * - Caching effectiveness
 * - Mobile device performance
 */

test.describe('Performance Testing and Load Scenarios', () => {
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
    
    const email = generateTestEmail('performance');
    const password = generateTestPassword();
    testUser = { email, password };
    
    // Set longer timeout for performance tests
    test.setTimeout(120000); // 2 minutes
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

  test.describe('Page Load Performance', () => {
    test('should load login page within performance benchmark', async () => {
      const startTime = Date.now();
      
      await authPages.navigateToLogin();
      
      const loadTime = Date.now() - startTime;
      
      // Login page should load within 2 seconds
      expect(loadTime).toBeLessThan(2000);
      
      // Measure specific performance metrics
      const performanceMetrics = await authPages.page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
          firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
        };
      });
      
      expect(performanceMetrics.domContentLoaded).toBeLessThan(1000);
      expect(performanceMetrics.firstContentfulPaint).toBeLessThan(1500);
    });

    test('should load home page efficiently after authentication', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      
      const startTime = Date.now();
      
      await authPages.loginAs(testUser.email, testUser.password);
      
      const loginTime = Date.now() - startTime;
      
      // Login and redirect should complete within 3 seconds
      expect(loginTime).toBeLessThan(3000);
      
      // Measure home page load performance
      const homeStartTime = Date.now();
      await flashcardPages.navigateToFlashcards();
      const homeLoadTime = Date.now() - homeStartTime;
      
      expect(homeLoadTime).toBeLessThan(2000);
    });

    test('should load with efficient resource caching', async () => {
      // First load
      const firstLoadStart = Date.now();
      await authPages.navigateToLogin();
      const firstLoadTime = Date.now() - firstLoadStart;
      
      // Second load (should be faster due to caching)
      await authPages.page.reload();
      const secondLoadStart = Date.now();
      await authPages.page.waitForLoadState('networkidle');
      const secondLoadTime = Date.now() - secondLoadStart;
      
      // Second load should be significantly faster
      expect(secondLoadTime).toBeLessThan(firstLoadTime * 0.7);
      
      // Check cache headers and resource loading
      const cachedResources = await authPages.page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        return resources.filter(resource => 
          resource.transferSize === 0 || // Served from cache
          resource.transferSize < resource.decodedBodySize * 0.1 // Compressed/cached
        ).length;
      });
      
      expect(cachedResources).toBeGreaterThan(0);
    });

    test('should maintain performance with large CSS and JavaScript bundles', async () => {
      const resourceMetrics = await authPages.page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        const scripts = resources.filter(r => r.name.includes('.js'));
        const styles = resources.filter(r => r.name.includes('.css'));
        
        return {
          totalJSSize: scripts.reduce((sum, r) => sum + r.transferSize, 0),
          totalCSSSize: styles.reduce((sum, r) => sum + r.transferSize, 0),
          scriptLoadTime: Math.max(...scripts.map(r => r.duration)),
          styleLoadTime: Math.max(...styles.map(r => r.duration))
        };
      });
      
      // JavaScript bundle should be reasonable size (< 1MB)
      expect(resourceMetrics.totalJSSize).toBeLessThan(1024 * 1024);
      
      // CSS should be small (< 200KB)
      expect(resourceMetrics.totalCSSSize).toBeLessThan(200 * 1024);
      
      // Scripts should load quickly
      expect(resourceMetrics.scriptLoadTime).toBeLessThan(1000);
    });
  });

  test.describe('Large Dataset Performance', () => {
    test('should handle 1000+ flashcards efficiently', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      const user = dbHelper.getUser(testUser.email);
      
      // Create large dataset
      console.log('Creating large dataset of flashcards...');
      const createStartTime = Date.now();
      dbHelper.createLargeDataset(user.id, 1000);
      const createTime = Date.now() - createStartTime;
      
      console.log(`Dataset creation took ${createTime}ms`);
      expect(createTime).toBeLessThan(10000); // Should create within 10 seconds
      
      // Test loading large dataset
      const loadStartTime = Date.now();
      await flashcardPages.navigateToFlashcards();
      const loadTime = Date.now() - loadStartTime;
      
      console.log(`Page load with 1000 flashcards took ${loadTime}ms`);
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
      
      // Verify pagination or virtualization is working
      const visibleCards = await flashcardPages.page.locator('[data-testid="flashcard-item"]').count();
      expect(visibleCards).toBeLessThan(100); // Should not render all 1000 at once
      expect(visibleCards).toBeGreaterThan(0); // But should show some cards
    });

    test('should search efficiently in large datasets', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      const user = dbHelper.getUser(testUser.email);
      
      // Create searchable dataset
      dbHelper.createLargeDataset(user.id, 500);
      
      await flashcardPages.navigateToFlashcards();
      
      // Measure search performance
      const searchStartTime = Date.now();
      await flashcardPages.searchFlashcards('word 100');
      await flashcardPages.page.waitForTimeout(1000); // Allow for debouncing
      const searchTime = Date.now() - searchStartTime;
      
      console.log(`Search in 500 flashcards took ${searchTime}ms`);
      expect(searchTime).toBeLessThan(2000); // Search should complete within 2 seconds
      
      // Verify search results
      const results = await flashcardPages.page.locator('[data-testid="flashcard-item"]').count();
      expect(results).toBeGreaterThan(0);
      expect(results).toBeLessThan(50); // Should be filtered results
    });

    test('should handle rapid dataset mutations', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      // Measure rapid card creation
      const startTime = Date.now();
      
      const createPromises = [];
      for (let i = 0; i < 20; i++) {
        createPromises.push(
          flashcardPages.createFlashcard(`Rapid ${i}`, `Rápido ${i}`)
        );
      }
      
      // Execute some in parallel
      const batchSize = 5;
      for (let i = 0; i < createPromises.length; i += batchSize) {
        const batch = createPromises.slice(i, i + batchSize);
        await Promise.allSettled(batch);
        await flashcardPages.page.waitForTimeout(100); // Brief pause between batches
      }
      
      const totalTime = Date.now() - startTime;
      
      console.log(`Created 20 flashcards in ${totalTime}ms`);
      expect(totalTime).toBeLessThan(60000); // Should complete within 1 minute
      
      // Verify final state
      const finalCount = await flashcardPages.verifyFlashcardsList();
      expect(finalCount).toBeGreaterThanOrEqual(15); // Most should have been created
    });

    test('should maintain performance during bulk operations', async () => {
      // Create admin for bulk operations
      const adminEmail = generateTestEmail('perf-admin');
      const adminPassword = generateTestPassword();
      await dbHelper.createTestUser(adminEmail, adminPassword, 'admin');
      
      // Create many users for bulk testing
      const testUsers = [];
      for (let i = 0; i < 100; i++) {
        const userId = await dbHelper.createTestUser(`bulk${i}@example.com`, 'password123');
        testUsers.push(userId);
      }
      
      await authPages.loginAs(adminEmail, adminPassword);
      await adminPages.navigateToUserManagement();
      
      // Measure bulk operation performance
      const bulkStartTime = Date.now();
      
      // Load user list with 100+ users
      await adminPages.page.waitForLoadState('networkidle');
      const loadTime = Date.now() - bulkStartTime;
      
      console.log(`Loaded 100+ users in admin panel in ${loadTime}ms`);
      expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds
      
      // Clean up
      for (let i = 0; i < 100; i++) {
        dbHelper.cleanupTestUser(`bulk${i}@example.com`);
      }
      dbHelper.cleanupTestUser(adminEmail);
    });
  });

  test.describe('Concurrent User Simulation', () => {
    test('should handle multiple concurrent users', async ({ context }) => {
      const numberOfUsers = 5;
      const users = [];
      const pages = [];
      const authPagesList = [];
      const flashcardPagesList = [];
      
      // Create multiple user contexts
      for (let i = 0; i < numberOfUsers; i++) {
        const email = generateTestEmail(`concurrent${i}`);
        const password = generateTestPassword();
        const userId = await dbHelper.createTestUser(email, password, 'user');
        
        // Create some flashcards for each user
        for (let j = 0; j < 10; j++) {
          dbHelper.createFlashcard(userId, `User${i} Card${j}`, `Usuario${i} Tarjeta${j}`);
        }
        
        users.push({ id: userId, email, password });
      }
      
      // Create browser contexts and pages
      for (let i = 0; i < numberOfUsers; i++) {
        const page = await context.newPage();
        const authPage = new AuthPages(page);
        const flashcardPage = new FlashcardPages(page);
        
        pages.push(page);
        authPagesList.push(authPage);
        flashcardPagesList.push(flashcardPage);
      }
      
      // Concurrent login
      const loginStartTime = Date.now();
      
      const loginPromises = users.map((user, index) =>
        authPagesList[index].loginAs(user.email, user.password)
      );
      
      await Promise.all(loginPromises);
      
      const loginTime = Date.now() - loginStartTime;
      console.log(`${numberOfUsers} concurrent logins took ${loginTime}ms`);
      expect(loginTime).toBeLessThan(15000); // All logins within 15 seconds
      
      // Concurrent operations
      const operationStartTime = Date.now();
      
      const operationPromises = flashcardPagesList.map(async (flashcardPage, index) => {
        await flashcardPage.navigateToFlashcards();
        await flashcardPage.createFlashcard(`Concurrent ${index}`, `Concurrente ${index}`);
        await flashcardPage.startLearningSession();
        return flashcardPage.completeFlashcardReview(4);
      });
      
      const results = await Promise.allSettled(operationPromises);
      
      const operationTime = Date.now() - operationStartTime;
      console.log(`${numberOfUsers} concurrent operations took ${operationTime}ms`);
      
      // Most operations should succeed
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThanOrEqual(numberOfUsers * 0.8); // 80% success rate
      
      // Clean up
      for (const page of pages) {
        await page.close();
      }
      
      for (const user of users) {
        dbHelper.cleanupTestUser(user.email);
      }
    });

    test('should handle concurrent learning sessions', async ({ context }) => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      
      const user = dbHelper.getUser(testUser.email);
      
      // Create flashcards for learning
      for (let i = 0; i < 20; i++) {
        dbHelper.createFlashcard(user.id, `Learning ${i}`, `Aprendizaje ${i}`);
      }
      
      // Create multiple sessions for same user
      const sessionPages = [];
      const flashcardPagesList = [];
      
      for (let i = 0; i < 3; i++) {
        const page = await context.newPage();
        const auth = new AuthPages(page);
        const flashcards = new FlashcardPages(page);
        
        await auth.loginAs(testUser.email, testUser.password);
        sessionPages.push(page);
        flashcardPagesList.push(flashcards);
      }
      
      // Start concurrent learning sessions
      const sessionPromises = flashcardPagesList.map(async (flashcards, index) => {
        await flashcards.navigateToFlashcards();
        await flashcards.startLearningSession();
        
        // Complete different numbers of reviews
        return flashcards.completeMultipleReviews(index + 2, 3 + index);
      });
      
      const sessionResults = await Promise.allSettled(sessionPromises);
      
      // Sessions should handle concurrency gracefully
      const completedSessions = sessionResults.filter(r => r.status === 'fulfilled').length;
      expect(completedSessions).toBeGreaterThan(0);
      
      // Verify data integrity
      const studySessions = dbHelper.getUserStudySessions(user.id);
      expect(studySessions.length).toBeGreaterThan(0);
      
      // Clean up
      for (const page of sessionPages) {
        await page.close();
      }
    });

    test('should maintain database performance under load', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      const user = dbHelper.getUser(testUser.email);
      
      // Create baseline performance measurement
      const baselineStart = Date.now();
      
      for (let i = 0; i < 10; i++) {
        dbHelper.createFlashcard(user.id, `Baseline ${i}`, `Base ${i}`);
      }
      
      const baselineTime = Date.now() - baselineStart;
      
      // Now create larger load
      const loadStart = Date.now();
      
      for (let i = 0; i < 100; i++) {
        dbHelper.createFlashcard(user.id, `Load ${i}`, `Carga ${i}`);
      }
      
      const loadTime = Date.now() - loadStart;
      
      console.log(`Baseline: 10 cards in ${baselineTime}ms, Load: 100 cards in ${loadTime}ms`);
      
      // Performance should scale reasonably
      const avgBaselineTime = baselineTime / 10;
      const avgLoadTime = loadTime / 100;
      
      // Average time per operation shouldn't degrade significantly
      expect(avgLoadTime).toBeLessThan(avgBaselineTime * 2);
      
      // Query performance test
      const queryStart = Date.now();
      const userFlashcards = dbHelper.getUserFlashcards(user.id);
      const queryTime = Date.now() - queryStart;
      
      console.log(`Retrieved ${userFlashcards.length} flashcards in ${queryTime}ms`);
      expect(queryTime).toBeLessThan(500); // Should query within 500ms
    });
  });

  test.describe('Memory Usage and Resource Monitoring', () => {
    test('should maintain reasonable memory usage', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      // Get initial memory usage
      let initialMemory = await flashcardPages.page.evaluate(() => {
        if ('memory' in performance) {
          return performance.memory.usedJSHeapSize;
        }
        return null;
      });
      
      await flashcardPages.navigateToFlashcards();
      
      // Create and interact with many flashcards
      for (let i = 0; i < 50; i++) {
        await flashcardPages.createFlashcard(`Memory Test ${i}`, `Prueba Memoria ${i}`);
        
        // Check memory every 10 iterations
        if (i % 10 === 9) {
          const currentMemory = await flashcardPages.page.evaluate(() => {
            if ('memory' in performance) {
              return performance.memory.usedJSHeapSize;
            }
            return null;
          });
          
          if (initialMemory && currentMemory) {
            const memoryIncrease = currentMemory - initialMemory;
            console.log(`Memory increase after ${i + 1} flashcards: ${memoryIncrease / 1024 / 1024}MB`);
            
            // Memory shouldn't grow excessively
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
          }
        }
      }
      
      // Force garbage collection if available
      await flashcardPages.page.evaluate(() => {
        if (window.gc) {
          window.gc();
        }
      });
      
      const finalMemory = await flashcardPages.page.evaluate(() => {
        if ('memory' in performance) {
          return performance.memory.usedJSHeapSize;
        }
        return null;
      });
      
      if (initialMemory && finalMemory) {
        const totalIncrease = finalMemory - initialMemory;
        console.log(`Total memory increase: ${totalIncrease / 1024 / 1024}MB`);
        expect(totalIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB total
      }
    });

    test('should handle memory pressure gracefully', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      // Create memory pressure
      await flashcardPages.page.evaluate(() => {
        window.memoryPressureTest = [];
        const interval = setInterval(() => {
          try {
            // Allocate memory in chunks
            window.memoryPressureTest.push(new Array(100000).fill('test-data'));
            
            // Stop when we have 100 arrays
            if (window.memoryPressureTest.length > 100) {
              clearInterval(interval);
            }
          } catch (e) {
            clearInterval(interval);
          }
        }, 50);
      });
      
      // Wait for memory pressure to build
      await flashcardPages.page.waitForTimeout(10000);
      
      // Application should still function
      try {
        await flashcardPages.createFlashcard('Pressure Test', 'Prueba Presión');
        await flashcardPages.verifyFlashcardCreated('Pressure Test', 'Prueba Presión');
      } catch (error) {
        // If creation fails due to memory pressure, at least navigation should work
        await flashcardPages.navigateToFlashcards();
        await expect(flashcardPages.page.locator('[data-testid="flashcard-list"]')).toBeVisible();
      }
      
      // Clean up memory
      await flashcardPages.page.evaluate(() => {
        window.memoryPressureTest = null;
      });
    });

    test('should optimize DOM node count', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      const user = dbHelper.getUser(testUser.email);
      
      // Create many flashcards in database
      dbHelper.createLargeDataset(user.id, 200);
      
      await flashcardPages.navigateToFlashcards();
      
      // Count DOM nodes
      const domNodeCount = await flashcardPages.page.evaluate(() => {
        return document.querySelectorAll('*').length;
      });
      
      console.log(`DOM nodes with 200 flashcards: ${domNodeCount}`);
      
      // Should use virtualization or pagination to keep DOM reasonable
      expect(domNodeCount).toBeLessThan(5000); // Reasonable DOM size
      
      // Visible flashcard items should be limited
      const visibleCards = await flashcardPages.page.locator('[data-testid="flashcard-item"]').count();
      expect(visibleCards).toBeLessThan(100); // Not all 200 rendered
      expect(visibleCards).toBeGreaterThan(0); // But some are visible
    });
  });

  test.describe('Network Performance and Optimization', () => {
    test('should minimize network requests', async () => {
      let requestCount = 0;
      const requests = [];
      
      // Monitor network requests
      flashcardPages.page.on('request', (request) => {
        requestCount++;
        requests.push({
          url: request.url(),
          method: request.method(),
          resourceType: request.resourceType()
        });
      });
      
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      await flashcardPages.navigateToFlashcards();
      
      console.log(`Total network requests: ${requestCount}`);
      console.log(`API requests: ${requests.filter(r => r.url.includes('/api/')).length}`);
      
      // Should batch API calls and minimize requests
      const apiRequests = requests.filter(r => r.url.includes('/api/'));
      expect(apiRequests.length).toBeLessThan(20); // Reasonable number of API calls
      
      // Should use appropriate HTTP methods
      const getRequests = apiRequests.filter(r => r.method === 'GET').length;
      const postRequests = apiRequests.filter(r => r.method === 'POST').length;
      
      expect(getRequests).toBeGreaterThan(0); // Should fetch data
      expect(getRequests + postRequests).toBe(apiRequests.length); // Should primarily use GET/POST
    });

    test('should optimize payload sizes', async () => {
      const payloadSizes = [];
      
      // Monitor response sizes
      flashcardPages.page.on('response', async (response) => {
        if (response.url().includes('/api/')) {
          const headers = response.headers();
          const contentLength = headers['content-length'];
          if (contentLength) {
            payloadSizes.push({
              url: response.url(),
              size: parseInt(contentLength),
              status: response.status()
            });
          }
        }
      });
      
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      const user = dbHelper.getUser(testUser.email);
      
      // Create reasonable number of flashcards
      for (let i = 0; i < 20; i++) {
        dbHelper.createFlashcard(user.id, `Payload Test ${i}`, `Prueba Carga ${i}`);
      }
      
      await flashcardPages.navigateToFlashcards();
      
      // Analyze payload sizes
      if (payloadSizes.length > 0) {
        const avgPayloadSize = payloadSizes.reduce((sum, p) => sum + p.size, 0) / payloadSizes.length;
        const maxPayloadSize = Math.max(...payloadSizes.map(p => p.size));
        
        console.log(`Average API payload: ${avgPayloadSize} bytes`);
        console.log(`Largest API payload: ${maxPayloadSize} bytes`);
        
        // Payloads should be reasonable
        expect(avgPayloadSize).toBeLessThan(50 * 1024); // Average < 50KB
        expect(maxPayloadSize).toBeLessThan(500 * 1024); // Max < 500KB
      }
    });

    test('should implement efficient caching strategies', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      const user = dbHelper.getUser(testUser.email);
      dbHelper.createFlashcard(user.id, 'Cache Test', 'Prueba Cache');
      
      // First load - measure time
      const firstLoadStart = Date.now();
      await flashcardPages.navigateToFlashcards();
      const firstLoadTime = Date.now() - firstLoadStart;
      
      // Navigate away and back
      await authPages.navigateToHome();
      
      // Second load - should be faster due to caching
      const secondLoadStart = Date.now();
      await flashcardPages.navigateToFlashcards();
      const secondLoadTime = Date.now() - secondLoadStart;
      
      console.log(`First load: ${firstLoadTime}ms, Second load: ${secondLoadTime}ms`);
      
      // Second load should benefit from caching
      expect(secondLoadTime).toBeLessThan(firstLoadTime * 0.8);
      
      // Test data caching by checking if identical API call is avoided
      let apiCallCount = 0;
      
      flashcardPages.page.on('request', (request) => {
        if (request.url().includes('/api/flashcards') && request.method() === 'GET') {
          apiCallCount++;
        }
      });
      
      // Third load
      await authPages.navigateToHome();
      await flashcardPages.navigateToFlashcards();
      
      // Should minimize redundant API calls
      expect(apiCallCount).toBeLessThanOrEqual(1);
    });

    test('should handle slow network conditions gracefully', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      // Simulate slow network (3G-like conditions)
      await flashcardPages.page.route('**/api/**', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
        route.continue();
      });
      
      const slowLoadStart = Date.now();
      await flashcardPages.navigateToFlashcards();
      const slowLoadTime = Date.now() - slowLoadStart;
      
      console.log(`Load time with slow network: ${slowLoadTime}ms`);
      
      // Should still complete in reasonable time
      expect(slowLoadTime).toBeLessThan(15000); // Within 15 seconds
      
      // Should show loading states
      const hasLoadingIndicators = await flashcardPages.page.evaluate(() => {
        return document.querySelectorAll('[data-testid*="loading"], .loading, .spinner').length > 0;
      });
      
      // Loading indicators help user experience
      expect(hasLoadingIndicators || slowLoadTime < 2000).toBe(true);
    });
  });

  test.describe('Mobile Device Performance', () => {
    test('should perform well on mobile viewport', async () => {
      // Set mobile viewport
      await flashcardPages.page.setViewportSize({ width: 375, height: 667 });
      
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      
      const mobileLoadStart = Date.now();
      await authPages.loginAs(testUser.email, testUser.password);
      const mobileLoadTime = Date.now() - mobileLoadStart;
      
      console.log(`Mobile login time: ${mobileLoadTime}ms`);
      expect(mobileLoadTime).toBeLessThan(5000);
      
      // Test mobile flashcard interaction performance
      const flashcardStart = Date.now();
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('Mobile Test', 'Prueba Móvil');
      const flashcardTime = Date.now() - flashcardStart;
      
      console.log(`Mobile flashcard creation: ${flashcardTime}ms`);
      expect(flashcardTime).toBeLessThan(8000);
      
      // Check touch interactions
      const touchStart = Date.now();
      await flashcardPages.page.locator('[data-testid="flashcard-item"]').first().tap();
      const touchTime = Date.now() - touchStart;
      
      expect(touchTime).toBeLessThan(1000); // Touch should be responsive
    });

    test('should optimize for limited mobile resources', async () => {
      await flashcardPages.page.setViewportSize({ width: 375, height: 667 });
      
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      const user = dbHelper.getUser(testUser.email);
      
      // Create reasonable dataset for mobile
      for (let i = 0; i < 50; i++) {
        dbHelper.createFlashcard(user.id, `Mobile ${i}`, `Móvil ${i}`);
      }
      
      await flashcardPages.navigateToFlashcards();
      
      // Check that mobile optimizations are in place
      const mobileOptimizations = await flashcardPages.page.evaluate(() => {
        const visibleCards = document.querySelectorAll('[data-testid="flashcard-item"]').length;
        const totalImages = document.querySelectorAll('img').length;
        const lazyImages = document.querySelectorAll('img[loading="lazy"]').length;
        
        return {
          visibleCards,
          totalImages,
          lazyImages
        };
      });
      
      console.log('Mobile optimizations:', mobileOptimizations);
      
      // Should limit visible items on mobile
      expect(mobileOptimizations.visibleCards).toBeLessThan(25);
      
      // Should use lazy loading for images if present
      if (mobileOptimizations.totalImages > 0) {
        expect(mobileOptimizations.lazyImages).toBeGreaterThan(0);
      }
    });

    test('should maintain performance during device orientation changes', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      // Start in portrait
      await flashcardPages.page.setViewportSize({ width: 375, height: 667 });
      await flashcardPages.navigateToFlashcards();
      await flashcardPages.createFlashcard('Orientation Test', 'Prueba Orientación');
      
      // Rotate to landscape
      const rotationStart = Date.now();
      await flashcardPages.page.setViewportSize({ width: 667, height: 375 });
      
      // Wait for layout adjustment
      await flashcardPages.page.waitForTimeout(1000);
      const rotationTime = Date.now() - rotationStart;
      
      console.log(`Orientation change handled in: ${rotationTime}ms`);
      expect(rotationTime).toBeLessThan(2000);
      
      // Interface should remain functional
      await expect(flashcardPages.page.locator('[data-testid="flashcard-list"]')).toBeVisible();
      await expect(flashcardPages.page.locator('[data-testid="flashcard-item"]')).toHaveCount(1);
      
      // Rotate back to portrait
      await flashcardPages.page.setViewportSize({ width: 375, height: 667 });
      await flashcardPages.page.waitForTimeout(1000);
      
      // Should still work correctly
      await flashcardPages.createFlashcard('Post Rotation', 'Después Rotación');
      const finalCount = await flashcardPages.verifyFlashcardsList();
      expect(finalCount).toBe(2);
    });
  });

  test.describe('Database Query Performance', () => {
    test('should optimize complex queries', async () => {
      await authPages.registerUser(testUser.email, testUser.password);
      await authPages.verifyRegistrationSuccess();
      await authPages.loginAs(testUser.email, testUser.password);
      
      const user = dbHelper.getUser(testUser.email);
      
      // Create data with various difficulties and review patterns
      for (let i = 0; i < 100; i++) {
        const flashcardId = dbHelper.createFlashcard(user.id, `Query Test ${i}`, `Prueba Consulta ${i}`, (i % 5) + 1);
        
        // Create study sessions with different patterns
        for (let j = 0; j < Math.floor(Math.random() * 5) + 1; j++) {
          dbHelper.createStudySession(user.id, flashcardId, Math.floor(Math.random() * 5) + 1);
        }
      }
      
      // Test complex queries through the application
      await flashcardPages.navigateToFlashcards();
      
      // Filter by difficulty
      const filterStart = Date.now();
      await flashcardPages.filterByDifficulty(3);
      const filterTime = Date.now() - filterStart;
      
      console.log(`Difficulty filter query: ${filterTime}ms`);
      expect(filterTime).toBeLessThan(2000);
      
      // Search within filtered results
      const searchStart = Date.now();
      await flashcardPages.searchFlashcards('Test 5');
      const searchTime = Date.now() - searchStart;
      
      console.log(`Search within filter: ${searchTime}ms`);
      expect(searchTime).toBeLessThan(1500);
      
      // Test statistics query performance
      const statsStart = Date.now();
      const stats = dbHelper.getUserStats(user.id);
      const statsTime = Date.now() - statsStart;
      
      console.log(`User statistics query: ${statsTime}ms`);
      console.log(`Stats result:`, stats);
      expect(statsTime).toBeLessThan(500);
      expect(stats.totalFlashcards).toBe(100);
      expect(stats.totalReviews).toBeGreaterThan(100);
    });

    test('should handle concurrent database operations', async ({ context }) => {
      const numberOfUsers = 3;
      const users = [];
      
      // Create multiple users
      for (let i = 0; i < numberOfUsers; i++) {
        const email = generateTestEmail(`db-perf-${i}`);
        const password = generateTestPassword();
        const userId = await dbHelper.createTestUser(email, password, 'user');
        users.push({ id: userId, email, password });
      }
      
      // Perform concurrent database operations
      const dbOperations = users.map(async (user, index) => {
        const operationStart = Date.now();
        
        // Create flashcards
        for (let i = 0; i < 20; i++) {
          dbHelper.createFlashcard(user.id, `Concurrent ${index}-${i}`, `Concurrente ${index}-${i}`);
        }
        
        // Create study sessions
        const flashcards = dbHelper.getUserFlashcards(user.id);
        for (const flashcard of flashcards.slice(0, 10)) {
          dbHelper.createStudySession(user.id, flashcard.id, Math.floor(Math.random() * 5) + 1);
        }
        
        // Query statistics
        const stats = dbHelper.getUserStats(user.id);
        
        const operationTime = Date.now() - operationStart;
        return { user: index, time: operationTime, stats };
      });
      
      const results = await Promise.all(dbOperations);
      
      // All operations should complete reasonably quickly
      const maxTime = Math.max(...results.map(r => r.time));
      const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
      
      console.log(`Concurrent DB operations - Max: ${maxTime}ms, Avg: ${avgTime}ms`);
      expect(maxTime).toBeLessThan(10000);
      expect(avgTime).toBeLessThan(5000);
      
      // Verify data integrity
      for (const result of results) {
        expect(result.stats.totalFlashcards).toBe(20);
        expect(result.stats.totalReviews).toBeGreaterThanOrEqual(10);
      }
      
      // Clean up
      for (const user of users) {
        dbHelper.cleanupTestUser(user.email);
      }
    });
  });
});