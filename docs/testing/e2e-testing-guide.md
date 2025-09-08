# End-to-End Testing Guide

## Overview

This guide provides comprehensive documentation for the E2E testing infrastructure implemented for the Flash Cards application. The testing suite uses Playwright with Jest for comprehensive browser automation testing.

## Architecture

### Testing Framework Stack
- **Test Runner**: Jest (unified across backend, frontend, and E2E)
- **Browser Automation**: Playwright (Chromium, Firefox, WebKit)
- **Test Pattern**: Test-Driven Development (TDD) with contract-first approach
- **Data Management**: SQLite with transaction isolation
- **CI/CD Integration**: GitHub Actions with multi-browser matrix testing

### Directory Structure
```
tests/
├── setup/                    # Test infrastructure
│   ├── database-setup.js     # Database isolation and transactions
│   ├── data-manager.js       # Comprehensive data lifecycle management
│   ├── cleanup-automation.js # Automated cleanup and maintenance
│   └── test-lifecycle.js     # Complete test environment lifecycle
├── fixtures/                 # Test data
│   └── test-data.js          # User, flashcard, and session fixtures
├── e2e/                      # End-to-end tests
│   ├── contracts/            # TDD contract tests (420+ failing tests)
│   ├── pages/                # Page Object Model implementations
│   ├── utils/                # Test utilities and helpers
│   ├── journeys/             # User journey tests
│   ├── edge-cases/           # Edge case and error handling
│   ├── performance/          # Performance and load testing
│   └── accessibility/        # A11y compliance testing
└── scripts/                  # Test execution and monitoring
    ├── test-runner.js        # Comprehensive test execution
    ├── test-monitor.js       # Real-time test monitoring dashboard
    └── data-cleanup.js       # CLI tool for data management
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Git

### Installation
```bash
# Install dependencies (from project root)
npm install

# Install Playwright browsers
npx playwright install

# Verify installation
npm run test:e2e -- --help
```

### Environment Setup
```bash
# Copy environment template
cp .env.example .env.test

# Required test environment variables
JWT_SECRET=your-test-jwt-secret-64-chars-minimum
JWT_REFRESH_SECRET=your-test-refresh-secret-64-chars-minimum
GEMINI_API_KEY=your-gemini-api-key
```

## Test Categories

### 1. Contract Tests (`tests/e2e/contracts/`)
**Purpose**: TDD-first tests that define API contracts and expected behaviors.
**Status**: 420+ tests designed to fail initially (red phase of TDD)

- `auth.contract.test.js` - 105 authentication contract tests
- `flashcards.contract.test.js` - 140 CRUD operation contracts
- `admin.contract.test.js` - 98 admin dashboard contracts
- `audio.contract.test.js` - 77 TTS integration contracts

**Usage**:
```bash
# Run all contract tests
npm run test:contracts

# Run specific contract suite
npm run test:contracts -- auth.contract.test.js
```

### 2. Journey Tests (`tests/e2e/journeys/`)
**Purpose**: End-to-end user workflows and integration testing.

- `user-auth.journey.test.js` - Complete authentication flows
- `flashcard-crud.journey.test.js` - CRUD operations with UI
- `learning-session.journey.test.js` - Spaced repetition learning
- `admin-dashboard.journey.test.js` - Admin management workflows
- `tts-audio.journey.test.js` - Text-to-speech integration
- `data-isolation.journey.test.js` - Security and data separation

**Usage**:
```bash
# Run all journey tests
npm run test:journeys

# Run specific journey
npm run test:journeys -- user-auth.journey.test.js
```

### 3. Edge Cases (`tests/e2e/edge-cases/`)
**Purpose**: Boundary conditions, error handling, and resilience testing.

- `input-validation.edge.test.js` - Input validation and XSS protection
- `error-recovery.edge.test.js` - Error handling and recovery

### 4. Performance Tests (`tests/e2e/performance/`)
**Purpose**: Performance benchmarking and load testing.

- `load-testing.performance.test.js` - Load testing and performance metrics

### 5. Accessibility Tests (`tests/e2e/accessibility/`)
**Purpose**: WCAG 2.1 compliance and cross-browser compatibility.

- `a11y-compatibility.test.js` - Accessibility compliance testing

## Page Object Model

### Structure
Page Objects are organized by functional area:

```javascript
// tests/e2e/pages/AuthPages.js
class AuthPages {
  constructor(page) {
    this.page = page;
  }

  async login(email, password) {
    // Page interactions
  }

  async verifyLoginSuccess() {
    // Assertions
  }
}
```

### Usage
```javascript
const { AuthPages } = require('../pages/AuthPages');

test('user login flow', async ({ page }) => {
  const authPages = new AuthPages(page);
  await authPages.login('test@example.com', 'password');
  await authPages.verifyLoginSuccess();
});
```

## Data Management

### Test Data Isolation
Each test runs in isolation using database transactions:

```javascript
const { setupDatabase, cleanupDatabase } = require('../setup/database-setup');

beforeEach(async () => {
  await setupDatabase();
});

afterEach(async () => {
  await cleanupDatabase();
});
```

### Data Fixtures
Predefined test data is available through fixtures:

```javascript
const { TEST_USERS, TEST_FLASHCARDS } = require('../fixtures/test-data');

// Use in tests
const testUser = TEST_USERS[0];
```

### Data Manager
Comprehensive data lifecycle management:

```javascript
const TestDataManager = require('../setup/data-manager');

const dataManager = new TestDataManager();
await dataManager.initialize();

// Create test data
const user = await dataManager.createTestUser();
const flashcard = await dataManager.createTestFlashcard(null, user.id);

// Seed complete scenarios
const scenario = await dataManager.seedCompleteUserScenario();
```

## Test Execution

### Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- auth.contract.test.js

# Run tests with specific browser
npm run test:e2e -- --project=chromium

# Run tests in headed mode (visible browser)
npm run test:e2e -- --headed

# Run tests with debugging
npm run test:e2e -- --debug
```

### Test Runner
Advanced test execution with reporting:

```bash
# Run with custom test runner
node tests/scripts/test-runner.js --suite=contracts --browser=chromium --parallel=2

# Monitor tests in real-time
node tests/scripts/test-monitor.js --port=8080
```

### Browser Matrix
Tests run across multiple browsers:
- **Chromium** - Latest Chrome/Edge engine
- **Firefox** - Mozilla Firefox engine
- **WebKit** - Safari engine

## Data Management CLI

### Usage
```bash
# Show help
node tests/scripts/data-cleanup.js --help

# Clean all test data
node tests/scripts/data-cleanup.js clean-all

# Health check
node tests/scripts/data-cleanup.js health-check

# Validate data integrity
node tests/scripts/data-cleanup.js validate --autoRepair

# Generate report
node tests/scripts/data-cleanup.js report --format=json --save
```

### Available Commands
- `clean-all` - Complete cleanup (database + files)
- `clean-files` - File system cleanup only
- `clean-db` - Database cleanup only
- `health-check` - Environment health validation
- `force-cleanup` - Force complete cleanup
- `validate` - Data integrity validation
- `repair` - Repair data integrity issues
- `optimize` - Database optimization
- `report` - Generate cleanup reports
- `seed` - Seed test data

## CI/CD Integration

### GitHub Actions
Tests run automatically on:
- Pull requests
- Pushes to main branch
- Scheduled runs (daily)

### Pipeline Stages
1. **Setup** - Environment and dependencies
2. **Contracts** - TDD contract validation
3. **Journeys** - User workflow testing
4. **Specialized** - Performance, accessibility, edge cases
5. **Report** - Test result aggregation
6. **Deploy** - GitHub Pages report deployment

### Configuration
```yaml
# .github/workflows/e2e-tests.yml
strategy:
  matrix:
    browser: [chromium, firefox, webkit]
    shard: [1/4, 2/4, 3/4, 4/4]
```

## Monitoring and Reporting

### Real-time Monitoring
```bash
# Start monitoring dashboard
node tests/scripts/test-monitor.js --port=8080

# Access dashboard
open http://localhost:8080
```

### Test Reports
Generated reports include:
- Test execution summary
- Performance metrics
- Coverage analysis
- Error details
- Browser compatibility matrix

### Health Monitoring
```bash
# Check test environment health
node tests/scripts/data-cleanup.js health-check --includeAutomation
```

## Configuration

### Jest Configuration
```javascript
// jest.workspace.config.js
module.exports = {
  projects: [
    './jest.config.backend.js',    // Backend tests
    './jest.config.frontend.js',   // Frontend tests
    './jest.config.e2e.js'         // E2E tests
  ]
};
```

### Playwright Configuration
```javascript
// playwright.config.js
module.exports = {
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ],
  webServer: [
    { command: 'npm run dev:client', port: 5173 },
    { command: 'npm run dev:server', port: 4000 }
  ]
};
```

## Best Practices

### Test Organization
1. **Follow TDD**: Write failing tests first
2. **Use Page Objects**: Maintain reusable page interactions
3. **Isolate Tests**: Each test should be independent
4. **Clean Data**: Always cleanup test data

### Performance
1. **Parallel Execution**: Run tests in parallel when possible
2. **Browser Optimization**: Use --headed=false for CI
3. **Data Seeding**: Use bulk operations for test data
4. **Resource Management**: Monitor memory usage

### Debugging
1. **Screenshots**: Automatic screenshots on failure
2. **Video Recording**: Available for debugging
3. **Console Logs**: Captured in test reports
4. **Network Logs**: HTTP request/response logging

### Maintenance
1. **Regular Cleanup**: Use automated cleanup
2. **Health Checks**: Monitor test environment
3. **Data Validation**: Check integrity regularly
4. **Performance Monitoring**: Track test execution times

## Troubleshooting

### Common Issues

**Tests failing with database errors**
```bash
# Clean and reset database
node tests/scripts/data-cleanup.js clean-db --vacuum --resetCounters
```

**Memory issues during test execution**
```bash
# Check memory usage
node tests/scripts/data-cleanup.js health-check

# Force cleanup
node tests/scripts/data-cleanup.js force-cleanup
```

**Browser installation issues**
```bash
# Reinstall browsers
npx playwright install --force
```

**Port conflicts**
```bash
# Kill processes using test ports
lsof -ti:4000,5173 | xargs kill -9
```

### Debug Mode
```bash
# Run single test in debug mode
npm run test:e2e -- auth.contract.test.js --headed --debug

# Enable verbose logging
DEBUG=pw:api npm run test:e2e
```

## Coverage Reports

### Generating Coverage
```bash
# Run tests with coverage
npm run test:e2e:coverage

# Generate HTML report
npm run test:coverage:report
```

### Coverage Targets
- **Statements**: 90%+
- **Branches**: 85%+
- **Functions**: 90%+
- **Lines**: 90%+

## Contributing

### Adding New Tests
1. Identify test category (contract, journey, edge-case, etc.)
2. Create test file in appropriate directory
3. Follow naming convention: `feature.category.test.js`
4. Use Page Object Model for UI interactions
5. Ensure proper cleanup and isolation

### Test Data
1. Add fixtures to `tests/fixtures/test-data.js`
2. Use data manager for complex scenarios
3. Clean up created data in afterEach hooks

### Documentation
1. Document new test categories
2. Update this guide with new features
3. Include usage examples

## Support

### Resources
- [Playwright Documentation](https://playwright.dev/)
- [Jest Documentation](https://jestjs.io/)
- [Project GitHub Issues](https://github.com/username/flash-cards/issues)

### Getting Help
1. Check troubleshooting section
2. Review test logs and reports
3. Run health checks
4. Create GitHub issue with details