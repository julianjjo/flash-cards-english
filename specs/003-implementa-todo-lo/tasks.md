# Tasks: Visual User Management Interface Implementation

**Input**: Design documents from `/specs/003-implementa-todo-lo/`
**Prerequisites**: plan.md (✅), research.md (✅), data-model.md (✅), contracts/auth-api.yaml (✅), quickstart.md (✅)

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Frontend**: `client/src/` (React components, hooks, services)
- **Backend**: `server/` (Express endpoints, middleware)
- **Tests**: `client/src/` for component tests, `server/` for API tests

## Phase 3.1: Setup
- [ ] T001 Configure authentication dependencies in client/package.json (axios, react-hook-form)
- [ ] T002 [P] Setup backend authentication middleware in server/middleware/auth.js
- [ ] T003 [P] Configure JWT token handling service in client/src/services/authService.js

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Backend Contract Tests
- [ ] T004 [P] Contract test POST /api/auth/register in server/tests/contract/auth-register.test.js
- [ ] T005 [P] Contract test POST /api/auth/login in server/tests/contract/auth-login.test.js
- [ ] T006 [P] Contract test GET /api/auth/profile in server/tests/contract/auth-profile.test.js
- [ ] T007 [P] Contract test PUT /api/auth/profile in server/tests/contract/auth-profile-update.test.js
- [ ] T008 [P] Contract test GET /api/admin/users in server/tests/contract/admin-users.test.js
- [ ] T009 [P] Contract test PUT /api/admin/users/{id} in server/tests/contract/admin-users-update.test.js
- [ ] T010 [P] Contract test DELETE /api/admin/users/{id} in server/tests/contract/admin-users-delete.test.js

### Frontend Component Tests
- [ ] T011 [P] Component test AuthProvider context in client/src/components/auth/AuthProvider.test.jsx
- [ ] T012 [P] Component test LoginForm in client/src/components/auth/LoginForm.test.jsx
- [ ] T013 [P] Component test RegisterForm in client/src/components/auth/RegisterForm.test.jsx
- [ ] T014 [P] Component test ProtectedRoute in client/src/components/auth/ProtectedRoute.test.jsx
- [ ] T015 [P] Component test UserProfile in client/src/components/auth/UserProfile.test.jsx
- [ ] T016 [P] Component test AdminUserList in client/src/components/admin/AdminUserList.test.jsx

### Integration Tests
- [ ] T017 [P] Integration test user registration flow in server/tests/integration/user-registration.test.js
- [ ] T018 [P] Integration test authentication flow in server/tests/integration/user-authentication.test.js
- [ ] T019 [P] Integration test admin user management in server/tests/integration/admin-user-management.test.js

## Phase 3.3: Backend Implementation (ONLY after tests are failing)
- [ ] T020 User registration endpoint POST /api/auth/register in server/index.js
- [ ] T021 User login endpoint POST /api/auth/login in server/index.js
- [ ] T022 User profile endpoints GET/PUT /api/auth/profile in server/index.js
- [ ] T023 Admin user list endpoint GET /api/admin/users in server/index.js
- [ ] T024 Admin user management endpoints PUT/DELETE /api/admin/users/{id} in server/index.js
- [ ] T025 [P] Password hashing utilities in server/utils/passwordUtils.js
- [ ] T026 [P] JWT token utilities in server/utils/jwtUtils.js
- [ ] T027 Authentication middleware implementation in server/middleware/auth.js
- [ ] T028 Admin authorization middleware in server/middleware/adminAuth.js

## Phase 3.4: Frontend Core Implementation
- [ ] T029 Authentication context and provider in client/src/components/auth/AuthProvider.jsx
- [ ] T030 useAuth custom hook in client/src/hooks/useAuth.js
- [ ] T031 Authentication service layer in client/src/services/authService.js
- [ ] T032 [P] Login form component in client/src/components/auth/LoginForm.jsx
- [ ] T033 [P] Registration form component in client/src/components/auth/RegisterForm.jsx
- [ ] T034 [P] User profile component in client/src/components/auth/UserProfile.jsx
- [ ] T035 [P] Protected route component in client/src/components/auth/ProtectedRoute.jsx
- [ ] T036 [P] Admin user list component in client/src/components/admin/AdminUserList.jsx
- [ ] T037 [P] Admin user form component in client/src/components/admin/AdminUserForm.jsx
- [ ] T038 [P] Error boundary component in client/src/components/common/ErrorBoundary.jsx
- [ ] T039 [P] Loading spinner component in client/src/components/common/LoadingSpinner.jsx

## Phase 3.5: Routing and Pages
- [ ] T040 Login page in client/src/pages/Login.jsx
- [ ] T041 Registration page in client/src/pages/Register.jsx  
- [ ] T042 User profile page in client/src/pages/Profile.jsx
- [ ] T043 Admin dashboard page in client/src/pages/AdminDashboard.jsx
- [ ] T044 Admin users page in client/src/pages/AdminUsers.jsx
- [ ] T045 Update main App.jsx with authentication routes in client/src/App.jsx
- [ ] T046 Update existing Home component for authenticated users in client/src/pages/Home.jsx
- [ ] T047 Update existing Admin component with user management in client/src/pages/Admin.jsx

## Phase 3.6: Styling and UX
- [ ] T048 [P] Authentication form styling with TailwindCSS in client/src/components/auth/
- [ ] T049 [P] Admin interface styling with TailwindCSS in client/src/components/admin/
- [ ] T050 [P] Responsive navigation component in client/src/components/layout/Navigation.jsx
- [ ] T051 [P] Mobile-friendly authentication modals in client/src/components/auth/AuthModal.jsx
- [ ] T052 [P] Toast notification system in client/src/components/common/Toast.jsx

## Phase 3.7: Database and Storage
- [ ] T053 User table migration in server/migrations/002-add-user-auth.sql
- [ ] T054 Update database initialization in server/config/database.js
- [ ] T055 [P] Secure token storage utilities in client/src/utils/storageUtils.js

## Phase 3.8: Integration and Polish
- [ ] T056 Connect authentication to existing flashcard features in client/src/pages/Home.jsx
- [ ] T057 Add user context to card operations in server/index.js (cards endpoints)
- [ ] T058 Error handling and user feedback across components
- [ ] T059 Performance optimization for large user lists in admin interface
- [ ] T060 [P] E2E test complete user journey in client/src/tests/e2e/user-journey.test.js
- [ ] T061 [P] Security audit of authentication implementation
- [ ] T062 Update documentation in README.md and CLAUDE.md

## Dependencies
- **Setup (T001-T003) before all other phases**
- **ALL Tests (T004-T019) before implementation (T020-T062)**
- **Backend (T020-T028) before Frontend (T029-T039)**
- **Core components (T029-T031) before UI components (T032-T039)**
- **Components before pages (T040-T047)**
- **Pages before styling (T048-T052)**
- **Database (T053-T055) can run parallel with frontend**
- **Integration (T056-T062) after all core implementation**

## Parallel Execution Examples

### Contract Tests (T004-T010)
```bash
# Launch all backend contract tests together:
Task: "Contract test POST /api/auth/register in server/tests/contract/auth-register.test.js"
Task: "Contract test POST /api/auth/login in server/tests/contract/auth-login.test.js" 
Task: "Contract test GET /api/auth/profile in server/tests/contract/auth-profile.test.js"
Task: "Contract test PUT /api/auth/profile in server/tests/contract/auth-profile-update.test.js"
Task: "Contract test GET /api/admin/users in server/tests/contract/admin-users.test.js"
Task: "Contract test PUT /api/admin/users/{id} in server/tests/contract/admin-users-update.test.js"
Task: "Contract test DELETE /api/admin/users/{id} in server/tests/contract/admin-users-delete.test.js"
```

### Component Tests (T011-T016)
```bash
# Launch all component tests together:
Task: "Component test AuthProvider context in client/src/components/auth/AuthProvider.test.jsx"
Task: "Component test LoginForm in client/src/components/auth/LoginForm.test.jsx"
Task: "Component test RegisterForm in client/src/components/auth/RegisterForm.test.jsx"
Task: "Component test ProtectedRoute in client/src/components/auth/ProtectedRoute.test.jsx"
Task: "Component test UserProfile in client/src/components/auth/UserProfile.test.jsx"
Task: "Component test AdminUserList in client/src/components/admin/AdminUserList.test.jsx"
```

### UI Components (T032-T039)
```bash
# Launch all UI components together (after context T029-T031):
Task: "Login form component in client/src/components/auth/LoginForm.jsx"
Task: "Registration form component in client/src/components/auth/RegisterForm.jsx"
Task: "User profile component in client/src/components/auth/UserProfile.jsx"
Task: "Protected route component in client/src/components/auth/ProtectedRoute.jsx"
Task: "Admin user list component in client/src/components/admin/AdminUserList.jsx"
Task: "Admin user form component in client/src/components/admin/AdminUserForm.jsx"
Task: "Error boundary component in client/src/components/common/ErrorBoundary.jsx"
Task: "Loading spinner component in client/src/components/common/LoadingSpinner.jsx"
```

## Validation Checklist
*GATE: Must verify before marking tasks complete*

- [x] All API endpoints from auth-api.yaml have contract tests (T004-T010)
- [x] All React components have component tests (T011-T016)
- [x] All user scenarios from quickstart.md have integration tests (T017-T019)
- [x] Tests are written before implementation (TDD enforced)
- [x] Parallel tasks use different files and have no dependencies
- [x] Each task specifies exact file path
- [x] Authentication context established before dependent components
- [x] Backend endpoints implemented before frontend services consume them

## Key User Experience Flow
1. **Registration/Login → Auth Context → Protected Routes → Main App**
2. **Admin Login → Admin Context → User Management → CRUD Operations**
3. **Profile Management → Update Context → Sync with Backend**
4. **Error Handling → User Feedback → Recovery Actions**

This task breakdown ensures a user-friendly, comprehensive authentication system that integrates seamlessly with the existing flashcard application while following TDD principles and constitutional requirements.