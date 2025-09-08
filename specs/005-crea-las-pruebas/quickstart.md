# E2E Testing Quickstart Guide

## Prerequisites

Before running the E2E test suite, ensure you have:
- Node.js and npm installed
- The flashcard application running locally
- Test database initialized
- All required environment variables set

## Setup Instructions

### 1. Install Dependencies
```bash
# Install Playwright and Jest dependencies
npm install --save-dev @playwright/test playwright jest-playwright-preset
npm install --save-dev jest-environment-playwright

# Install Playwright browsers
npx playwright install
```

### 2. Environment Configuration
Create `.env.test` file:
```bash
JWT_SECRET="test-jwt-secret-key-for-e2e-testing-only"
JWT_REFRESH_SECRET="test-refresh-secret-key-for-e2e-testing-only"
GEMINI_API_KEY="your-gemini-api-key"
DATABASE_PATH="./flashcards-test.db"
NODE_ENV="test"
```

### 3. Database Setup
```bash
# Initialize test database
npm run test:setup-db
```

## Running E2E Tests

### Full Test Suite
```bash
# Run all E2E tests
npm run test:e2e

# Run with headed browser (for debugging)
npm run test:e2e -- --headed

# Run specific test file
npm run test:e2e -- auth.e2e.test.js
```

### Test Categories

#### Authentication Tests
```bash
npm run test:e2e -- --grep "authentication"
```
Tests: Login, Registration, Token refresh, Session expiry

#### Flashcard Management Tests
```bash
npm run test:e2e -- --grep "flashcards"
```
Tests: Create, Read, Update, Delete flashcards with user isolation

#### Learning Algorithm Tests
```bash
npm run test:e2e -- --grep "spaced-repetition"
```
Tests: Review quality tracking, difficulty adjustment, scheduling

#### Admin Dashboard Tests
```bash
npm run test:e2e -- --grep "admin"
```
Tests: User management, statistics, role-based access

## Test Data Management

### Test Users
The system creates these test users automatically:
- `testuser@example.com` / `password123` (regular user)
- `admin@example.com` / `adminpass` (admin user)
- `testuser2@example.com` / `password123` (isolation testing)

### Test Flashcards
Each test user gets pre-populated with:
- 5 basic flashcards for CRUD testing
- 10 flashcards with various difficulty levels for algorithm testing
- Audio-enabled flashcards for TTS testing

### Cleanup
Tests automatically clean up after themselves, but you can manually reset:
```bash
npm run test:cleanup-db
```

## Debugging Tests

### Visual Debugging
```bash
# Run with browser visible
npm run test:e2e -- --headed --slowMo=1000

# Generate trace files
npm run test:e2e -- --trace=on
```

### Test Screenshots
Failed tests automatically capture screenshots to `test-results/`

### Verbose Logging
```bash
DEBUG=pw:api npm run test:e2e
```

## Performance Benchmarks

Expected test execution times:
- Authentication flows: < 10 seconds
- Flashcard CRUD operations: < 15 seconds  
- Spaced repetition algorithm: < 20 seconds
- Admin dashboard: < 12 seconds
- Full test suite: < 30 seconds

## Continuous Integration

### GitHub Actions
Add to `.github/workflows/e2e.yml`:
```yaml
- name: Run E2E tests
  run: |
    npm run build
    npm run test:e2e
  env:
    CI: true
```

### Local CI Simulation
```bash
# Simulate CI environment
CI=true npm run test:e2e
```

## Troubleshooting

### Common Issues

1. **Browser launch fails**
   ```bash
   npx playwright install --force
   ```

2. **Database connection errors**
   ```bash
   rm flashcards-test.db
   npm run test:setup-db
   ```

3. **Port conflicts**
   - Ensure app runs on port 4000
   - Frontend on port 5173 (Vite dev server)

4. **Authentication failures**
   - Verify JWT secrets in .env.test
   - Check token expiration settings

### Debug Mode
```bash
# Run single test with full debugging
PWDEBUG=1 npm run test:e2e -- auth.e2e.test.js
```

## Coverage Reports

Generate test coverage:
```bash
npm run test:e2e -- --coverage
```

View coverage report at `coverage/index.html`

## Next Steps

After successful quickstart:
1. Review generated test reports in `test-results/`
2. Check coverage reports for completeness
3. Run performance benchmarks
4. Set up CI/CD integration
5. Configure monitoring and alerting