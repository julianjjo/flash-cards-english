# Tasks: Independent User Management with Per-User Flashcards

**Input**: Design documents from `/specs/002-mejora-el-manejo/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

**Context Applied**: Implementing with D1 database, JWT authentication, user registration, admin dashboard using existing environment admin user

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✅ SUCCESS: Implementation plan loaded
   → Extract: Express.js + React, JWT auth, D1 database, admin dashboard
2. Load optional design documents:
   → data-model.md: Users and Flashcards entities → model tasks
   → contracts/: auth-api.json, admin-api.json, flashcards-api.json → contract tests
   → research.md: JWT + bcrypt, Context API → setup decisions
3. Generate tasks by category:
   → Setup: D1 migration, dependencies, JWT secrets
   → Tests: 9 contract tests, 4 integration tests (TDD enforced)
   → Core: User/Flashcard models, auth services, middleware
   → Integration: D1 connection, JWT middleware, user isolation
   → Polish: unit tests, admin UI, performance validation
4. Apply task rules:
   → Different files = [P] for parallel execution
   → Same file = sequential, tests before implementation
   → TDD enforced: All tests must fail before implementation
5. Number tasks sequentially T001-T042
6. Dependencies: Setup → Tests → Models → Services → Endpoints → UI → Polish
7. Parallel execution: Contract tests [P], model creation [P], UI components [P]
8. Validation: All 3 contracts have tests, 2 entities have models, TDD enforced
9. ✅ SUCCESS: 42 tasks ready for execution
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)  
- **File paths**: Adapted for existing React frontend + Express backend structure

## Phase 3.1: Setup & Infrastructure

- [ ] **T001** Create D1 database schema migration with users table and flashcards.user_id column in `server/migrations/001-add-users.sql`
- [ ] **T002** Install authentication dependencies: `cd server && npm install bcrypt jsonwebtoken cookie-parser`
- [ ] **T003** [P] Configure environment variables for JWT secrets in `server/.env.example`
- [ ] **T004** [P] Set up D1 database configuration in `server/config/database.js`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (Parallel Execution - Different Files)
- [ ] **T005** [P] Contract test POST /api/auth/register in `server/tests/contract/auth-register.test.js`
- [ ] **T006** [P] Contract test POST /api/auth/login in `server/tests/contract/auth-login.test.js`
- [ ] **T007** [P] Contract test POST /api/auth/logout in `server/tests/contract/auth-logout.test.js`
- [ ] **T008** [P] Contract test GET /api/users/me in `server/tests/contract/users-profile.test.js`
- [ ] **T009** [P] Contract test GET /api/admin/users in `server/tests/contract/admin-users.test.js`
- [ ] **T010** [P] Contract test DELETE /api/admin/users/:id in `server/tests/contract/admin-delete-user.test.js`
- [ ] **T011** [P] Contract test GET /api/flashcards with user isolation in `server/tests/contract/flashcards-isolation.test.js`
- [ ] **T012** [P] Contract test POST /api/flashcards with user ownership in `server/tests/contract/flashcards-create.test.js`
- [ ] **T013** [P] Contract test PUT /api/flashcards/:id with ownership validation in `server/tests/contract/flashcards-update.test.js`

### Integration Tests (Parallel Execution)
- [ ] **T014** [P] Integration test complete user registration → login → flashcard creation flow in `server/tests/integration/user-registration-flow.test.js`
- [ ] **T015** [P] Integration test user data isolation (different users can't access each other's flashcards) in `server/tests/integration/user-isolation.test.js`
- [ ] **T016** [P] Integration test admin dashboard user management workflow in `server/tests/integration/admin-management.test.js`
- [ ] **T017** [P] Integration test JWT token refresh and session management in `server/tests/integration/jwt-session.test.js`

## Phase 3.3: Core Backend Implementation (ONLY after tests are failing)

### Database Models (Parallel Execution)
- [ ] **T018** [P] User model with D1 queries in `server/models/User.js`
- [ ] **T019** [P] Enhanced Flashcard model with user_id foreign key in `server/models/Flashcard.js`

### Services Layer (Sequential - Dependency Chain)
- [ ] **T020** UserService with CRUD operations and bcrypt password hashing in `server/services/UserService.js`
- [ ] **T021** AuthService with JWT token generation/validation in `server/services/AuthService.js`
- [ ] **T022** FlashcardService enhanced with user isolation queries in `server/services/FlashcardService.js`

### Middleware (Parallel Execution)
- [ ] **T023** [P] JWT authentication middleware in `server/middleware/auth.js`
- [ ] **T024** [P] Admin role verification middleware in `server/middleware/admin.js`
- [ ] **T025** [P] User ownership validation middleware in `server/middleware/ownership.js`

### API Endpoints (Sequential - Shared server/index.js file)
- [ ] **T026** POST /api/auth/register endpoint with validation and user creation
- [ ] **T027** POST /api/auth/login endpoint with JWT token response and httpOnly cookies
- [ ] **T028** POST /api/auth/logout endpoint with token blacklisting
- [ ] **T029** GET /api/users/me endpoint for user profile
- [ ] **T030** GET /api/admin/users endpoint with pagination for admin dashboard
- [ ] **T031** DELETE /api/admin/users/:id endpoint with flashcard cascade deletion
- [ ] **T032** Enhance existing flashcard endpoints with user isolation (GET, POST, PUT, DELETE)

## Phase 3.4: Frontend Implementation

### Authentication Components (Parallel Execution)
- [ ] **T033** [P] Login component with form validation in `client/src/components/Auth/Login.jsx`
- [ ] **T034** [P] Registration component with email/password form in `client/src/components/Auth/Register.jsx`
- [ ] **T035** [P] AuthContext with JWT token management in `client/src/context/AuthContext.jsx`
- [ ] **T036** [P] useAuth custom hook for authentication state in `client/src/hooks/useAuth.js`

### Dashboard Components (Parallel Execution)
- [ ] **T037** [P] Admin dashboard with user list and management in `client/src/pages/AdminDashboard.jsx`
- [ ] **T038** [P] User profile component in `client/src/components/User/UserProfile.jsx`
- [ ] **T039** [P] Protected route wrapper component in `client/src/components/Auth/ProtectedRoute.jsx`

### Integration & Routing
- [ ] **T040** Update App.jsx with authentication routes and protected routes using React Router

## Phase 3.5: Polish & Validation

### Testing & Performance (Parallel Execution)
- [ ] **T041** [P] Unit tests for password validation and JWT utilities in `server/tests/unit/auth-utils.test.js`
- [ ] **T042** [P] Performance tests for authentication endpoints (<200ms response time) in `server/tests/performance/auth-performance.test.js`

## Dependencies

### Critical Dependency Chain
```
Setup (T001-T004) 
    ↓
Tests (T005-T017) - MUST FAIL before implementation
    ↓
Models (T018-T019) [P]
    ↓
Services (T020-T022) - Sequential dependency
    ↓ 
Middleware (T023-T025) [P]
    ↓
Endpoints (T026-T032) - Sequential (same file)
    ↓
Frontend Auth (T033-T036) [P]
    ↓
Frontend UI (T037-T039) [P]
    ↓
Integration (T040)
    ↓
Polish (T041-T042) [P]
```

### Specific Blockers
- T020 (UserService) blocks T026-T029 (auth endpoints)
- T021 (AuthService) blocks T023 (auth middleware)
- T023 (auth middleware) blocks T026-T032 (all protected endpoints)
- T033-T036 (auth components) block T037-T039 (dashboard components)

## Parallel Execution Examples

### Launch Contract Tests Together (Phase 3.2)
```bash
# All contract tests can run in parallel (different files)
Task: "Contract test POST /api/auth/register in server/tests/contract/auth-register.test.js"
Task: "Contract test POST /api/auth/login in server/tests/contract/auth-login.test.js"
Task: "Contract test POST /api/auth/logout in server/tests/contract/auth-logout.test.js"
Task: "Contract test GET /api/users/me in server/tests/contract/users-profile.test.js"
Task: "Contract test GET /api/admin/users in server/tests/contract/admin-users.test.js"
```

### Launch Model Creation Together (Phase 3.3)
```bash
# Models can be created in parallel (different files)
Task: "User model with D1 queries in server/models/User.js"
Task: "Enhanced Flashcard model with user_id foreign key in server/models/Flashcard.js"
```

### Launch Frontend Components Together
```bash
# Authentication components (different files)
Task: "Login component with form validation in client/src/components/Auth/Login.jsx"
Task: "Registration component with email/password form in client/src/components/Auth/Register.jsx"
Task: "AuthContext with JWT token management in client/src/context/AuthContext.jsx"
```

## Critical Implementation Notes

### TDD Enforcement
- **Phase 3.2 tests MUST be written first and MUST FAIL**
- Do not proceed to Phase 3.3 until all tests are failing
- Each test should validate the exact API contract from design documents

### D1 Database Considerations
- Use D1 SQL syntax for database operations
- Implement proper migration with backward compatibility
- Existing flashcards must be assigned to admin user during migration

### JWT Security Implementation
- Use httpOnly cookies for refresh tokens
- Store access tokens in localStorage (15-minute expiry)
- Implement token rotation on refresh

### Admin User Integration
- Use existing environment variable for admin user credentials
- Admin user should own all existing flashcards after migration
- Implement admin dashboard with user deletion capabilities

### User Isolation Validation
- All flashcard operations must include user_id WHERE clause
- Admin role can bypass isolation for management purposes
- Test isolation thoroughly in integration tests

## Validation Checklist
*GATE: Checked before task execution*

- [x] All 3 contracts (auth-api.json, admin-api.json, flashcards-api.json) have corresponding tests
- [x] Both entities (User, Flashcard) have model creation tasks
- [x] All tests (T005-T017) come before implementation (T018+)
- [x] Parallel tasks [P] truly independent (different files)
- [x] Each task specifies exact file path for implementation
- [x] No [P] task modifies same file as another [P] task
- [x] TDD enforced: Tests must fail before implementation
- [x] Dependencies clearly mapped to prevent execution conflicts

---

**Total Tasks**: 42  
**Parallel Tasks**: 18 (can be executed simultaneously)  
**Critical Path**: Setup → Tests → Services → Endpoints → Integration  
**Estimated Completion**: 15-20 hours with parallel execution