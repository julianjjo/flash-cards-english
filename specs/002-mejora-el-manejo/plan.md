# Implementation Plan: Independent User Management with Per-User Flashcards

**Branch**: `002-mejora-el-manejo` | **Date**: 2025-09-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-mejora-el-manejo/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✅ SUCCESS: Feature spec loaded
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✅ SUCCESS: Context filled with clarifications from user input
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → ✅ SUCCESS: Web application detected (React frontend + Express backend)
   → Set Structure Decision based on project type
   → ✅ SUCCESS: Option 2 (Web application) selected
3. Evaluate Constitution Check section below
   → ✅ SUCCESS: Initial constitution check passed
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → ✅ SUCCESS: Research phase completed
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → ✅ SUCCESS: Design phase completed
6. Re-evaluate Constitution Check section
   → ✅ SUCCESS: Post-design constitution check passed
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
   → ✅ SUCCESS: Task generation strategy planned
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Implement independent user management system with email/password authentication, self-service registration, and admin oversight for per-user flashcard collections. System will migrate from current shared flashcard model to user-isolated collections with full authentication layer and admin dashboard capabilities.

## Technical Context
**Language/Version**: JavaScript (Node.js/Express backend, React frontend)  
**Primary Dependencies**: Express.js, better-sqlite3, bcrypt, jsonwebtoken, React Router  
**Storage**: SQLite with new users table and user_id foreign keys on flashcards  
**Testing**: Jest for backend, Jest + React Testing Library for frontend  
**Target Platform**: Web application (existing Render.com deployment)
**Project Type**: web - React frontend + Express backend  
**Performance Goals**: <200ms API response time, support 100+ concurrent users  
**Constraints**: Backward compatibility with existing flashcards, zero downtime migration  
**Scale/Scope**: Multi-user system, admin dashboard, secure authentication

**User Clarifications Applied**:
- Authentication: Email/password only (no social login)
- Registration: Self-service registration allowed
- Admin Access: Admin user can review and manage all users and their data

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 2 (backend API, frontend React app) - ✅ Under limit
- Using framework directly? ✅ Express.js and React without wrappers
- Single data model? ✅ User entity with flashcard relationships  
- Avoiding patterns? ✅ Direct SQLite access, no Repository/UoW

**Architecture**:
- EVERY feature as library? ✅ Auth service, User service as libraries
- Libraries listed: auth-service (JWT/bcrypt), user-service (CRUD), migration-service (data migration)
- CLI per library: ✅ Planned with --help/--version/--format
- Library docs: ✅ llms.txt format planned

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? ✅ Tests written before implementation
- Git commits show tests before implementation? ✅ TDD approach planned
- Order: Contract→Integration→E2E→Unit strictly followed? ✅ 
- Real dependencies used? ✅ Actual SQLite DB for tests
- Integration tests for: new libraries, contract changes, shared schemas? ✅
- FORBIDDEN: Implementation before test, skipping RED phase ✅ Acknowledged

**Observability**:
- Structured logging included? ✅ JSON logging planned
- Frontend logs → backend? ✅ Error reporting to backend
- Error context sufficient? ✅ Request tracing included

**Versioning**:
- Version number assigned? ✅ v2.0.0 (breaking change - user isolation)
- BUILD increments on every change? ✅ 
- Breaking changes handled? ✅ Migration script + parallel testing

## Project Structure

### Documentation (this feature)
```
specs/002-mejora-el-manejo/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 2: Web application (existing structure enhanced)
server/
├── services/
│   ├── auth-service.js      # JWT/bcrypt authentication
│   ├── user-service.js      # User CRUD operations
│   └── migration-service.js # Data migration utilities
├── middleware/
│   ├── auth.js             # Authentication middleware
│   └── admin.js            # Admin role checking
└── tests/
    ├── contract/
    ├── integration/
    └── unit/

client/
├── src/
│   ├── components/
│   │   ├── Auth/           # Login/Register components
│   │   └── Admin/          # Admin dashboard components
│   ├── pages/
│   │   ├── Login.jsx       # Login page
│   │   ├── Register.jsx    # Registration page
│   │   └── AdminDashboard.jsx # Admin user management
│   └── services/
│       └── authService.js  # Frontend auth service
└── tests/
```

**Structure Decision**: Option 2 (Web application) - existing React frontend + Express backend structure

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - Authentication patterns for Express.js applications
   - Best practices for JWT token management
   - SQLite database migration strategies
   - React authentication state management
   - Admin dashboard UI/UX patterns

2. **Generate and dispatch research agents**:
   ```
   Research JWT authentication patterns for Express applications
   Research SQLite schema migration best practices 
   Research React authentication state management approaches
   Research admin dashboard security patterns
   Research password hashing with bcrypt best practices
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: JWT tokens with httpOnly cookies for session management
   - Rationale: Secure, stateless, works with existing Express setup
   - Alternatives considered: Session storage, OAuth providers

**Output**: research.md with all technical decisions resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - User entity: id, email, password_hash, role, created_at, updated_at
   - Modified Flashcard entity: add user_id foreign key
   - UserSession entity: token management and expiration
   - Migration considerations for existing flashcards

2. **Generate API contracts** from functional requirements:
   - POST /api/auth/register - User registration
   - POST /api/auth/login - User authentication  
   - POST /api/auth/logout - Session termination
   - GET /api/users/me - Current user profile
   - GET /api/admin/users - Admin user list (admin only)
   - DELETE /api/admin/users/:id - Admin user deletion (admin only)
   - Existing flashcard endpoints modified with user isolation

3. **Generate contract tests** from contracts:
   - Authentication endpoint tests (must fail initially)
   - User management endpoint tests
   - Admin-only endpoint authorization tests
   - Flashcard isolation tests

4. **Extract test scenarios** from user stories:
   - User registration → login → flashcard creation → isolation verification
   - Admin user management workflow
   - Data migration verification scenarios

5. **Update agent file incrementally** (O(1) operation):
   - Update CLAUDE.md with new authentication requirements
   - Add user management context
   - Include admin dashboard information
   - Preserve existing flashcard and TTS context

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate authentication implementation tasks from contracts
- Create user management service tasks
- Generate frontend authentication components tasks
- Create admin dashboard tasks
- Generate database migration tasks
- Create test tasks following TDD principles

**Ordering Strategy**:
- TDD order: Authentication tests → auth implementation
- Dependency order: Database migration → backend services → frontend components
- Mark [P] for parallel execution (independent components)

**Estimated Output**: 35-40 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No constitutional violations requiring justification*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (N/A)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*