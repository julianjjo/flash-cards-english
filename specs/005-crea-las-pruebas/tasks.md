# Tasks: End-to-End Testing Suite with Playwright

**Input**: Design documents from `/Users/julianmican/Documents/Personal/flash-cards/specs/005-crea-las-pruebas/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md
**Context**: Implement Playwright E2E testing with Jest and migrate existing tests to Jest framework

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Phase 3.1: Setup & Dependencies
- [ ] T001 Install Playwright and E2E testing dependencies: @playwright/test, playwright, jest-playwright-preset
- [ ] T002 [P] Configure Playwright configuration in `playwright.config.js` at repository root
- [ ] T003 [P] Create E2E test environment configuration in `jest.e2e.config.js`
- [ ] T004 [P] Set up test database isolation scripts in `tests/setup/database-setup.js`
- [ ] T005 [P] Create test data fixtures and utilities in `tests/fixtures/test-data.js`

## Phase 3.2: Test Migration (Existing Tests to Jest) ⚠️ PRIORITY
**CRITICAL: Migrate existing tests to Jest framework first**
- [ ] T006 [P] Audit existing test structure and create migration plan in `tests/migration-report.md`
- [ ] T007 [P] Migrate server integration tests to Jest format in `server/tests/integration/`
- [ ] T008 [P] Migrate server contract tests to Jest format in `server/tests/contract/`
- [ ] T009 [P] Migrate client component tests to Jest format in `client/src/tests/`
- [ ] T010 [P] Update package.json scripts for unified Jest test execution
- [ ] T011 [P] Verify all migrated tests pass with `npm run test` and `npm run test:back`

## Phase 3.3: E2E Contract Tests (TDD) ⚠️ MUST COMPLETE BEFORE 3.4
**CRITICAL: These tests MUST be written and MUST FAIL before ANY E2E implementation**
- [ ] T012 [P] Contract test for authentication endpoints in `tests/e2e/contracts/auth.contract.test.js`
- [ ] T013 [P] Contract test for flashcards CRUD endpoints in `tests/e2e/contracts/flashcards.contract.test.js`
- [ ] T014 [P] Contract test for admin dashboard endpoints in `tests/e2e/contracts/admin.contract.test.js`
- [ ] T015 [P] Contract test for TTS audio generation endpoints in `tests/e2e/contracts/audio.contract.test.js`

## Phase 3.4: E2E Page Objects and Utilities
- [ ] T016 [P] Create authentication page objects in `tests/e2e/pages/AuthPages.js`
- [ ] T017 [P] Create flashcard management page objects in `tests/e2e/pages/FlashcardPages.js`
- [ ] T018 [P] Create admin dashboard page objects in `tests/e2e/pages/AdminPages.js`
- [ ] T019 [P] Create common utilities and helpers in `tests/e2e/utils/testUtils.js`
- [ ] T020 [P] Create database helpers for test data management in `tests/e2e/utils/dbHelpers.js`

## Phase 3.5: E2E User Journey Tests (ONLY after contracts are failing)
- [ ] T021 [P] User registration and login flow in `tests/e2e/journeys/auth-flow.e2e.test.js`
- [ ] T022 [P] Flashcard CRUD operations with user isolation in `tests/e2e/journeys/flashcard-management.e2e.test.js`
- [ ] T023 [P] Spaced repetition learning algorithm in `tests/e2e/journeys/spaced-repetition.e2e.test.js`
- [ ] T024 [P] Text-to-speech functionality in `tests/e2e/journeys/tts-integration.e2e.test.js`
- [ ] T025 [P] Admin user management and statistics in `tests/e2e/journeys/admin-dashboard.e2e.test.js`
- [ ] T026 [P] Session management and token refresh in `tests/e2e/journeys/session-management.e2e.test.js`

## Phase 3.6: E2E Edge Cases and Error Handling
- [ ] T027 [P] Network failure and offline scenarios in `tests/e2e/edge-cases/network-failures.e2e.test.js`
- [ ] T028 [P] Invalid authentication and authorization in `tests/e2e/edge-cases/auth-failures.e2e.test.js`
- [ ] T029 [P] Large dataset handling and pagination in `tests/e2e/edge-cases/large-datasets.e2e.test.js`
- [ ] T030 [P] Concurrent user sessions in `tests/e2e/edge-cases/concurrent-sessions.e2e.test.js`

## Phase 3.7: Cross-Browser and Performance Testing
- [ ] T031 [P] Cross-browser compatibility tests (Chrome, Firefox, Safari) in `tests/e2e/cross-browser/`
- [ ] T032 [P] Mobile responsive design tests in `tests/e2e/responsive/mobile.e2e.test.js`
- [ ] T033 [P] Performance benchmarking and load testing in `tests/e2e/performance/load-tests.e2e.test.js`
- [ ] T034 [P] Accessibility compliance testing in `tests/e2e/accessibility/a11y.e2e.test.js`

## Phase 3.8: CI/CD Integration and Reporting
- [ ] T035 [P] Configure GitHub Actions workflow for E2E testing in `.github/workflows/e2e-tests.yml`
- [ ] T036 [P] Set up test reporting and screenshot capture in `tests/e2e/reporters/`
- [ ] T037 [P] Create test coverage reporting for E2E tests in `tests/e2e/coverage/`
- [ ] T038 [P] Configure parallel test execution for CI in `tests/e2e/config/ci.config.js`

## Phase 3.9: Documentation and Polish
- [ ] T039 [P] Update project README with E2E testing instructions
- [ ] T040 [P] Create troubleshooting guide in `docs/e2e-troubleshooting.md`
- [ ] T041 [P] Generate API documentation from contracts in `docs/api-contracts.md`
- [ ] T042 [P] Performance optimization and test suite cleanup
- [ ] T043 Run complete test suite validation using quickstart.md

## Dependencies
**Critical Path**:
- Setup (T001-T005) before Migration (T006-T011)
- Migration (T006-T011) before E2E Contract Tests (T012-T015)
- E2E Contract Tests (T012-T015) before Page Objects (T016-T020)
- Page Objects (T016-T020) before User Journey Tests (T021-T026)
- Core functionality before Edge Cases (T027-T030)
- All tests before CI/CD (T035-T038)

**Blocking Dependencies**:
- T004 blocks T020 (database setup before DB helpers)
- T010 blocks T011 (script updates before test verification)
- T012-T015 must fail before T021-T026 (TDD requirement)
- T016-T020 blocks T021-T030 (page objects before tests using them)

## Parallel Execution Examples

### Phase 3.2: Test Migration (can run in parallel)
```bash
# Launch T007-T009 together:
Task: "Migrate server integration tests to Jest format in server/tests/integration/"
Task: "Migrate server contract tests to Jest format in server/tests/contract/"
Task: "Migrate client component tests to Jest format in client/src/tests/"
```

### Phase 3.3: Contract Tests (can run in parallel)
```bash
# Launch T012-T015 together:
Task: "Contract test for authentication endpoints in tests/e2e/contracts/auth.contract.test.js"
Task: "Contract test for flashcards CRUD endpoints in tests/e2e/contracts/flashcards.contract.test.js"
Task: "Contract test for admin dashboard endpoints in tests/e2e/contracts/admin.contract.test.js"
Task: "Contract test for TTS audio endpoints in tests/e2e/contracts/audio.contract.test.js"
```

### Phase 3.5: User Journey Tests (can run in parallel after contracts fail)
```bash
# Launch T021-T026 together:
Task: "User registration and login flow in tests/e2e/journeys/auth-flow.e2e.test.js"
Task: "Flashcard CRUD operations with user isolation in tests/e2e/journeys/flashcard-management.e2e.test.js"
Task: "Spaced repetition learning algorithm in tests/e2e/journeys/spaced-repetition.e2e.test.js"
Task: "Text-to-speech functionality in tests/e2e/journeys/tts-integration.e2e.test.js"
Task: "Admin user management and statistics in tests/e2e/journeys/admin-dashboard.e2e.test.js"
Task: "Session management and token refresh in tests/e2e/journeys/session-management.e2e.test.js"
```

## Project Structure Created
```
tests/
├── e2e/
│   ├── contracts/           # T012-T015 output
│   │   ├── auth.contract.test.js
│   │   ├── flashcards.contract.test.js
│   │   ├── admin.contract.test.js
│   │   └── audio.contract.test.js
│   ├── pages/              # T016-T018 output
│   │   ├── AuthPages.js
│   │   ├── FlashcardPages.js
│   │   └── AdminPages.js
│   ├── journeys/           # T021-T026 output
│   │   ├── auth-flow.e2e.test.js
│   │   ├── flashcard-management.e2e.test.js
│   │   ├── spaced-repetition.e2e.test.js
│   │   ├── tts-integration.e2e.test.js
│   │   ├── admin-dashboard.e2e.test.js
│   │   └── session-management.e2e.test.js
│   ├── edge-cases/         # T027-T030 output
│   ├── cross-browser/      # T031 output
│   ├── responsive/         # T032 output
│   ├── performance/        # T033 output
│   ├── accessibility/      # T034 output
│   └── utils/              # T019-T020 output
│       ├── testUtils.js
│       └── dbHelpers.js
├── setup/                  # T004 output
│   └── database-setup.js
└── fixtures/               # T005 output
    └── test-data.js
```

## Notes
- [P] tasks = different files, no dependencies - can run in parallel
- TDD enforcement: E2E contract tests MUST fail before implementing user journeys
- Migration priority: Existing test migration before new E2E implementation
- Database isolation: Each E2E test uses isolated test database
- Performance targets: Full E2E suite <30s, individual tests <5s
- Browser support: Chrome (primary), Firefox, Safari for cross-browser testing

## Validation Checklist
*GATE: Checked before task completion*

- [x] All contracts (auth, flashcards, admin, audio) have corresponding tests
- [x] All user journey scenarios have E2E test tasks
- [x] Test migration tasks cover all existing test files
- [x] Tests come before implementation (TDD)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Dependencies properly documented and blocking relationships clear