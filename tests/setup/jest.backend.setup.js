// Backend-specific Jest setup
// This file runs after the test framework has been set up

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-backend-tests';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-backend-tests';

// Extend Jest timeout for integration tests
jest.setTimeout(10000);

// Global test setup for backend
beforeAll(async () => {
  // Any global backend test setup can go here
});

afterAll(async () => {
  // Any global backend test cleanup can go here
});

// Console override for cleaner test output (optional)
if (!process.env.DEBUG) {
  console.warn = jest.fn();
  console.error = jest.fn();
}