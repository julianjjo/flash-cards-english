export default {
  projects: [
    // Backend/Server Tests (Node.js environment)
    {
      displayName: 'Backend Tests',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/server/**/*.test.js',
        '<rootDir>/server/tests/**/*.test.js'
      ],
      extensionsToTreatAsEsm: ['.js'],
      globals: {
        'ts-jest': {
          useESM: true
        }
      },
      transform: {
        '^.+\\.js$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }],
      },
      transformIgnorePatterns: [
        'node_modules/(?!(.*\\.mjs$))'
      ],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
      setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.backend.setup.js'],
      collectCoverageFrom: [
        'server/**/*.js',
        '!server/node_modules/**',
        '!server/**/*.test.js',
      ],
      coverageDirectory: '<rootDir>/coverage/backend',
    },
    
    // Frontend/Client Tests (jsdom environment)
    {
      displayName: 'Frontend Tests', 
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/client/src/**/*.test.jsx',
        '<rootDir>/client/src/**/*.test.js'
      ],
      transform: {
        '^.+\\.[jt]sx?$': 'babel-jest',
      },
      extensionsToTreatAsEsm: ['.jsx'],
      moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      },
      setupFilesAfterEnv: [
        '<rootDir>/client/src/setupTests.js',
        '<rootDir>/tests/setup/jest.frontend.setup.js'
      ],
      transformIgnorePatterns: [
        'node_modules/(?!(.*\\.mjs$))'
      ],
      collectCoverageFrom: [
        'client/src/**/*.{js,jsx}',
        '!client/src/**/*.test.{js,jsx}',
        '!client/src/index.js',
      ],
      coverageDirectory: '<rootDir>/coverage/frontend',
    },

    // E2E Tests (Playwright + Jest hybrid)
    {
      displayName: 'E2E Tests',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/tests/e2e/**/*.test.js'
      ],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.e2e.setup.js'],
      globalSetup: '<rootDir>/tests/setup/jest.global.setup.js',
      globalTeardown: '<rootDir>/tests/setup/jest.global.teardown.js',
      transform: {
        '^.+\\.js$': 'babel-jest',
      },
      maxWorkers: process.env.CI ? 1 : '50%',
    },
  ],

  // Global workspace configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  verbose: true,
  
  // Global reporters for unified output
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'jest-results.xml',
      suiteName: 'Jest Tests',
      classNameTemplate: '{displayname} - {classname}',
      titleTemplate: '{title}',
    }],
  ],

  // Global test file patterns to ignore
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/client/node_modules/',
    '<rootDir>/coverage/',
    '<rootDir>/dist/',
    '<rootDir>/build/',
  ],

  // Watch mode configuration (simplified for compatibility)
  watchman: false,
};