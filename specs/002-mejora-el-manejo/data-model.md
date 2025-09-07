# Data Model: User Management & Flashcard Isolation

## Entity Overview
This document defines the data model for the independent user management system with per-user flashcard isolation.

## Core Entities

### User Entity
**Purpose**: Represents individual learners and admin users in the system

**Fields**:
- `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT): Unique user identifier
- `email` (TEXT, NOT NULL, UNIQUE): User's email address for login
- `password_hash` (TEXT, NOT NULL): bcrypt hashed password
- `role` (TEXT, NOT NULL, DEFAULT 'user'): User role ('user' or 'admin')  
- `created_at` (TEXT, NOT NULL): ISO timestamp of account creation
- `updated_at` (TEXT, NOT NULL): ISO timestamp of last profile update

**Validation Rules**:
- Email must be valid email format
- Password must be minimum 8 characters with letters and numbers
- Role must be either 'user' or 'admin'
- Email addresses are case-insensitive (stored lowercase)

**Indexes**:
- `UNIQUE INDEX idx_users_email ON users(email)`
- `INDEX idx_users_role ON users(role)` (for admin queries)

### Enhanced Flashcard Entity
**Purpose**: Individual flashcards now owned by specific users

**Modified Fields** (additions to existing schema):
- `user_id` (INTEGER, NOT NULL, FOREIGN KEY): References users.id
- Migration note: Existing flashcards will be assigned to admin user

**Existing Fields** (preserved):
- `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT): Unique flashcard identifier
- `english` (TEXT, NOT NULL): English text
- `spanish` (TEXT, NOT NULL): Spanish text  
- `difficulty` (INTEGER, DEFAULT 0): Spaced repetition difficulty
- `last_reviewed` (TEXT): ISO timestamp of last review
- `review_count` (INTEGER, DEFAULT 0): Number of times reviewed

**Validation Rules**:
- user_id must reference valid users.id
- All existing validation rules preserved
- Users can only access their own flashcards

**Foreign Keys**:
- `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`

**Indexes**:
- `INDEX idx_flashcards_user_id ON flashcards(user_id)` (user isolation)
- Existing indexes preserved

### UserSession Entity (Optional - for advanced token management)
**Purpose**: Track active user sessions and token management

**Fields**:
- `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT): Session identifier
- `user_id` (INTEGER, NOT NULL, FOREIGN KEY): References users.id
- `refresh_token_hash` (TEXT, NOT NULL): Hashed refresh token
- `expires_at` (TEXT, NOT NULL): ISO timestamp of token expiration
- `created_at` (TEXT, NOT NULL): ISO timestamp of session creation
- `last_used_at` (TEXT, NOT NULL): ISO timestamp of last token use

**Note**: This entity is optional for MVP. JWT stateless approach may not require session storage.

## Relationships

### User → Flashcard (One-to-Many)
- One user can have many flashcards
- Each flashcard belongs to exactly one user
- Cascade delete: Deleting user removes their flashcards
- Isolation: Users cannot access other users' flashcards

### User → UserSession (One-to-Many) [Optional]
- One user can have multiple active sessions (different devices)
- Session cleanup on user deletion
- Token rotation updates last_used_at

## Migration Strategy

### Phase 1: Add Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

### Phase 2: Add Admin User
```sql
-- Admin user created during deployment with environment-provided credentials
INSERT INTO users (email, password_hash, role, created_at, updated_at) 
VALUES (?, ?, 'admin', datetime('now'), datetime('now'));
```

### Phase 3: Modify Flashcards Table
```sql
-- Add user_id column (nullable initially for zero-downtime migration)
ALTER TABLE flashcards ADD COLUMN user_id INTEGER;

-- Assign all existing flashcards to admin user
UPDATE flashcards SET user_id = 1 WHERE user_id IS NULL;

-- Make user_id required after migration
-- Note: SQLite doesn't support ALTER COLUMN, requires table recreation
-- Migration script handles this safely
```

### Phase 4: Add Foreign Key Constraint
```sql
-- Requires table recreation in SQLite
-- Migration script handles schema modification with data preservation
```

## State Transitions

### User Registration Flow
1. **New** → Validate email uniqueness
2. **Validated** → Hash password with bcrypt
3. **Secured** → Store in database with 'user' role
4. **Created** → Return success (no auto-login)

### User Authentication Flow
1. **Anonymous** → Validate email/password
2. **Validated** → Generate JWT tokens (access + refresh)
3. **Authenticated** → Return tokens + user profile
4. **Active** → Access token authorizes API calls

### Flashcard Ownership
1. **Created** → Automatically assigned to authenticated user
2. **Owned** → Only accessible by owner or admin
3. **Isolated** → Cannot be accessed by other users
4. **Managed** → Admin can view/modify all flashcards

## Data Access Patterns

### User Queries
- Get user by email (login): `SELECT * FROM users WHERE email = ? COLLATE NOCASE`
- Get user by ID (profile): `SELECT id, email, role, created_at FROM users WHERE id = ?`
- List all users (admin): `SELECT id, email, role, created_at FROM users ORDER BY created_at DESC`

### Flashcard Queries (with user isolation)
- User's flashcards: `SELECT * FROM flashcards WHERE user_id = ? ORDER BY last_reviewed ASC`
- Admin view all: `SELECT f.*, u.email FROM flashcards f JOIN users u ON f.user_id = u.id`
- Create flashcard: `INSERT INTO flashcards (..., user_id) VALUES (..., ?)`

### Performance Considerations
- Index on flashcards.user_id enables fast user isolation
- Email index supports case-insensitive login lookup
- Role index optimizes admin user queries
- Prepared statements prevent SQL injection

## Data Validation

### Application-Level Validation
- Email format validation before database insert
- Password strength validation (length, complexity)
- Role validation (whitelist 'user'/'admin' only)
- User ownership verification on flashcard operations

### Database-Level Constraints
- UNIQUE constraint on email prevents duplicates
- NOT NULL constraints ensure required fields
- FOREIGN KEY constraints maintain referential integrity
- CHECK constraints could be added for role validation

## Security Considerations

### Password Security
- Passwords never stored in plain text
- bcrypt salt rounds 12 for hash generation
- Password comparison uses constant-time bcrypt.compare()
- Password reset requires email verification (future feature)

### Data Isolation
- All flashcard queries include user_id WHERE clause
- Admin role required for cross-user data access
- JWT tokens include user_id claim for authorization
- Database foreign key constraints prevent orphaned data

### Audit Trail
- created_at/updated_at timestamps on user records
- User actions logged with request ID correlation
- Admin actions logged for compliance
- No sensitive data (passwords/tokens) in logs