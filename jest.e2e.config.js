const config = {
  displayName: 'E2E Tests',
  testEnvironment: 'node',
  testMatch: ['**/tests/e2e/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.e2e.setup.js'],
  globalSetup: '<rootDir>/tests/setup/jest.global.setup.js',
  globalTeardown: '<rootDir>/tests/setup/jest.global.teardown.js',
  testTimeout: 30000,
  maxWorkers: process.env.CI ? 1 : '50%',
  verbose: true,
  collectCoverage: false, // Playwright handles coverage differently
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  moduleFileExtensions: ['js', 'json'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/client/node_modules/',
    '<rootDir>/tests/e2e/utils/',
    '<rootDir>/tests/e2e/pages/',
    '<rootDir>/tests/e2e/fixtures/',
  ],
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'jest-e2e-results.xml',
      suiteName: 'E2E Tests',
    }],
  ],
  // Environment variables for E2E testing
  testEnvironmentOptions: {
    NODE_ENV: 'test',
    DATABASE_PATH: './flashcards-e2e-test.db',
    JWT_SECRET: 'test-jwt-secret-for-e2e-only',
    JWT_REFRESH_SECRET: 'test-refresh-secret-for-e2e-only',
  },
};

export default config;