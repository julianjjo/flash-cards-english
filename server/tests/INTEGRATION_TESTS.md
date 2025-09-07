# API Integration Tests

This directory contains comprehensive integration tests for validating all API endpoints and system functionality.

## Overview

The integration tests provide complete coverage of:

- **Authentication System**: Registration, login, JWT tokens, refresh tokens, session management
- **User Management**: Profile operations, password changes, account deletion, user isolation
- **Flashcard System**: CRUD operations, spaced repetition, review tracking, user isolation
- **Study System**: Study sessions, due cards, performance tracking, recommendations
- **Admin Operations**: User management, role changes, system monitoring, bulk operations
- **Statistics**: User stats, system stats, performance analytics, dashboard data
- **Error Handling**: Input validation, rate limiting, security boundaries, edge cases
- **Bulk Operations**: Import/export, bulk updates, bulk deletions

## Test Files

### Core API Tests
- `api-auth-endpoints.test.js` - Authentication and session management
- `api-user-flashcard-endpoints.test.js` - User and flashcard operations
- `api-admin-stats-endpoints.test.js` - Admin operations and statistics
- `api-error-handling.test.js` - Error conditions and security

### Legacy Integration Tests
- `user-registration-flow.test.js` - Complete user lifecycle testing
- `user-isolation.test.js` - User data isolation verification
- `admin-management.test.js` - Administrative function testing
- `jwt-session.test.js` - JWT token and session testing

## Running Tests

### Prerequisites
```bash
# Ensure Jest and dependencies are installed
npm install

# Set up test environment
export NODE_ENV=test
```

### Run All Integration Tests
```bash
# Using npm script (recommended)
npm run test:back

# Using Jest directly
npx jest tests/integration --runInBand --verbose

# Using the custom test runner
node scripts/run-integration-tests.js
```

### Run Specific Test Categories
```bash
# Authentication tests only
npx jest tests/integration/api-auth-endpoints.test.js --verbose

# User and flashcard tests
npx jest tests/integration/api-user-flashcard-endpoints.test.js --verbose

# Admin and statistics tests
npx jest tests/integration/api-admin-stats-endpoints.test.js --verbose

# Error handling tests
npx jest tests/integration/api-error-handling.test.js --verbose

# Using test runner with category filter
node scripts/run-integration-tests.js --category=auth
node scripts/run-integration-tests.js --category=admin
```

### Test Runner Options
```bash
# Verbose output
node scripts/run-integration-tests.js --verbose

# Stop on first failure
node scripts/run-integration-tests.js --bail

# Run specific category
node scripts/run-integration-tests.js --category=user

# Show help
node scripts/run-integration-tests.js --help
```

## Test Structure

Each test file follows this pattern:

```javascript
describe('API Endpoint Group', () => {
  beforeAll(async () => {
    // Set up app and server
  });

  afterAll(async () => {
    // Clean up server
  });

  beforeEach(async () => {
    // Clean database before each test
  });

  describe('Specific Endpoint', () => {
    test('should handle valid request', async () => {
      // Test successful operation
    });

    test('should reject invalid request', async () => {
      // Test error conditions
    });

    test('should enforce authentication', async () => {
      // Test security
    });
  });
});
```

## Key Testing Patterns

### Authentication Helper
```javascript
const createAuthenticatedUser = async (email, password = 'testpassword123') => {
  const registerResponse = await request(app)
    .post('/api/auth/register')
    .send({ email, password })
    .expect(201);

  return {
    user: registerResponse.body.user,
    accessToken: registerResponse.body.accessToken
  };
};
```

### User Isolation Testing
```javascript
test('should maintain user isolation', async () => {
  const { accessToken: token1 } = await createAuthenticatedUser('user1@test.com');
  const { accessToken: token2 } = await createAuthenticatedUser('user2@test.com');

  // User 1 creates data
  const createResponse = await request(app)
    .post('/api/flashcards')
    .set('Authorization', `Bearer ${token1}`)
    .send({ english: 'Test', spanish: 'Prueba' });

  // User 2 should not access User 1's data
  await request(app)
    .get(`/api/flashcards/${createResponse.body.id}`)
    .set('Authorization', `Bearer ${token2}`)
    .expect(404);
});
```

### Error Condition Testing
```javascript
test('should handle malformed input', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ email: 'invalid-email', password: '123' })
    .expect(400);

  expect(response.body).toHaveProperty('error');
  expect(response.body.error).toMatch(/email|password/i);
});
```

## Test Data Management

### Database Cleanup
Each test cleans up its data using email patterns:
```javascript
beforeEach(async () => {
  const database = db.getDatabase();
  database.prepare('DELETE FROM flashcards WHERE user_id IN (SELECT id FROM users WHERE email LIKE ?)').run('%testapi%');
  database.prepare('DELETE FROM users WHERE email LIKE ?').run('%testapi%');
});
```

### Test User Naming Convention
- Authentication tests: `*@authapi.com`
- User/Flashcard tests: `*@userapi.com`
- Admin tests: `*@adminapi.com`
- Error tests: `*@errorapi.com`

## Coverage Areas

### Authentication (api-auth-endpoints.test.js)
- ✅ User registration with validation
- ✅ User login with credentials
- ✅ JWT token generation and validation
- ✅ Refresh token functionality
- ✅ Password change operations
- ✅ Session management
- ✅ Logout and token invalidation
- ✅ Rate limiting and security

### User Management (api-user-flashcard-endpoints.test.js)
- ✅ User profile CRUD operations
- ✅ Flashcard CRUD operations
- ✅ Spaced repetition algorithm
- ✅ Study session management
- ✅ Review tracking and statistics
- ✅ User data isolation
- ✅ Performance analytics
- ✅ Pagination and filtering

### Admin Operations (api-admin-stats-endpoints.test.js)
- ✅ Admin user management
- ✅ Role-based access control
- ✅ User promotion/demotion
- ✅ System health monitoring
- ✅ Statistics aggregation
- ✅ Bulk operations
- ✅ Admin audit trails

### Error Handling (api-error-handling.test.js)
- ✅ Input validation and sanitization
- ✅ Rate limiting enforcement
- ✅ SQL injection protection
- ✅ XSS prevention
- ✅ Authentication bypass attempts
- ✅ Database constraint handling
- ✅ Network timeout handling
- ✅ Error response consistency

## Continuous Integration

### GitHub Actions
```yaml
- name: Run Integration Tests
  run: |
    npm run test:back
    node scripts/run-integration-tests.js --bail
```

### Test Reports
The test runner generates:
- Console output with timing and results
- `integration-test-report.json` for CI/CD systems
- Coverage reports (when configured)

## Debugging Tests

### Verbose Output
```bash
# See detailed test execution
npx jest tests/integration --verbose --no-coverage

# Use test runner verbose mode
node scripts/run-integration-tests.js --verbose
```

### Database Inspection
```bash
# Check test database state
npm run db:status

# Manual database cleanup
node -e "import('./server/config/database.js').then(db => db.default.initialize().then(() => db.default.getDatabase().exec('DELETE FROM users WHERE email LIKE \"%test%\"')))"
```

### Single Test Debugging
```bash
# Run single test file
npx jest tests/integration/api-auth-endpoints.test.js --verbose --no-coverage

# Run single test case
npx jest tests/integration/api-auth-endpoints.test.js --verbose --testNamePattern="should register"
```

## Best Practices

1. **Test Isolation**: Each test should be independent and clean up after itself
2. **Realistic Data**: Use realistic test data that matches production patterns
3. **Error Testing**: Always test both success and failure scenarios
4. **Security Testing**: Verify authentication, authorization, and input validation
5. **Performance**: Monitor test execution time and database query efficiency
6. **Documentation**: Keep tests readable with clear descriptions and comments

## Troubleshooting

### Common Issues

**Database Connection Errors**
```bash
# Ensure database is initialized
npm run migrate

# Check database status
npm run db:status
```

**Port Conflicts**
```bash
# Kill processes using port 4000
lsof -ti:4000 | xargs kill -9
```

**Memory Issues**
```bash
# Run tests with increased memory
node --max-old-space-size=4096 scripts/run-integration-tests.js
```

**Test Timeouts**
```bash
# Increase Jest timeout
npx jest --testTimeout=30000
```

For more information, see the main project documentation and individual test files.