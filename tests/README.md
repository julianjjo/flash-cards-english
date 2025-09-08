# E2E Testing Suite

This directory contains the end-to-end testing infrastructure for the Flash Cards application using Playwright and Jest.

## Structure

```
tests/
├── setup/                  # Test setup and configuration
│   ├── database-setup.js   # Database isolation and management
│   ├── global-setup.js     # Playwright global setup
│   ├── global-teardown.js  # Playwright global teardown
│   ├── jest.*.js          # Jest-specific setup files
│   └── validate-setup.test.js # Setup validation tests
├── fixtures/              # Test data and fixtures
│   └── test-data.js       # Predefined test data sets
└── e2e/                  # E2E test files (to be created in next phases)
    ├── contracts/        # Contract tests (TDD)
    ├── pages/           # Page object models
    ├── journeys/        # User journey tests
    ├── edge-cases/      # Edge case scenarios
    ├── cross-browser/   # Cross-browser tests
    ├── responsive/      # Responsive design tests
    ├── performance/     # Performance tests
    ├── accessibility/   # A11y tests
    └── utils/          # Test utilities and helpers
```

## Configuration Files

- `playwright.config.js` - Playwright configuration for browser testing
- `jest.e2e.config.js` - Jest configuration for E2E tests

## Available Scripts

```bash
# Playwright E2E tests
npm run test:e2e          # Run all E2E tests
npm run test:e2e:headed   # Run with browser visible
npm run test:e2e:debug    # Debug mode

# Jest E2E tests  
npm run test:e2e:jest     # Run Jest-based E2E tests

# Combined testing
npm run test:all          # Run all tests (unit + integration + E2E)
```

## Test Database Isolation

The E2E tests use a separate SQLite database (`flashcards-e2e-test.db`) with:
- Complete isolation from production data
- Automatic setup and teardown
- Transaction-based test isolation
- Predefined test fixtures

## Test Data Fixtures

The `test-data.js` file provides:
- **TEST_USERS**: Pre-configured user accounts (regular, admin, secondary)
- **TEST_FLASHCARDS**: Various flashcard sets for different scenarios
- **TEST_STUDY_SESSIONS**: Study session data for algorithm testing
- **TEST_SCENARIOS**: Common test scenarios and edge cases

## Next Steps

The setup phase (T001-T005) is complete. The next phases will implement:
1. Test migration (T006-T011): Migrate existing tests to Jest
2. Contract tests (T012-T015): TDD-based API contract validation
3. Page objects (T016-T020): Reusable UI interaction components
4. User journeys (T021-T026): Complete E2E user flow testing

## Validation

Run the setup validation test to ensure everything is working:

```bash
npx playwright test tests/setup/validate-setup.test.js
```

This will verify:
- Database initialization
- Test data creation
- Cleanup functionality
- Table structure integrity