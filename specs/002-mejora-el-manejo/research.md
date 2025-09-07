# Research Phase: User Management Authentication & Architecture

## Overview
Research findings for implementing independent user management with email/password authentication, self-service registration, and admin oversight capabilities.

## Authentication Patterns

### Decision: JWT with httpOnly Cookies + Local Storage Hybrid
**Rationale**: 
- JWT tokens provide stateless authentication suitable for API endpoints
- httpOnly cookies prevent XSS attacks on refresh tokens
- Local storage for access tokens enables easy frontend state management
- Refresh token rotation provides additional security

**Implementation Approach**:
- Access tokens: Short-lived (15 minutes) in localStorage
- Refresh tokens: Long-lived (7 days) in httpOnly cookies
- Automatic refresh token rotation on each use
- Token blacklisting for logout functionality

**Alternatives Considered**:
- **Session-based authentication**: Rejected due to stateful nature and scaling complexity
- **OAuth providers**: Rejected per user requirement for email/password only
- **JWT in httpOnly cookies only**: Rejected due to frontend complexity for API calls

## Password Security

### Decision: bcrypt with salt rounds 12
**Rationale**:
- Industry standard for password hashing
- Built-in salt generation prevents rainbow table attacks  
- Salt rounds 12 provides good security/performance balance
- Well-supported in Node.js ecosystem

**Implementation Details**:
- Password minimum length: 8 characters
- Password complexity: Require letters + numbers
- Hash comparison using bcrypt.compare() for timing attack prevention

**Alternatives Considered**:
- **Argon2**: More secure but higher CPU usage, unnecessary complexity
- **PBKDF2**: Older standard, bcrypt preferred for new projects
- **Plain passwords**: Obviously rejected for security reasons

## Database Schema Migration

### Decision: Additive Migration Strategy
**Rationale**:
- Zero downtime deployment requirement
- Existing flashcards must remain accessible during migration
- Backward compatibility preserved until user assignment complete

**Migration Steps**:
1. Add users table with admin user creation
2. Add nullable user_id column to flashcards table
3. Create migration script to assign existing flashcards to admin user
4. Add NOT NULL constraint to user_id after migration
5. Add foreign key constraint flashcards.user_id → users.id

**Alternatives Considered**:
- **Destructive migration**: Rejected due to data loss risk
- **Parallel table approach**: Unnecessary complexity for this use case
- **Manual data assignment**: Automated approach reduces error risk

## React Authentication State Management

### Decision: Context API + Custom Hook
**Rationale**:
- Built into React, no additional dependencies
- Sufficient complexity for authentication state
- Easy testing and mocking capabilities
- Integrates well with existing React Router setup

**Implementation Approach**:
- AuthContext provides user state, login, logout, register functions
- useAuth hook encapsulates authentication logic
- AuthProvider wraps app and handles token refresh
- Protected route component for authenticated pages

**Alternatives Considered**:
- **Redux**: Overkill for authentication-only state management
- **Zustand**: Additional dependency, Context API sufficient
- **Local state only**: Rejected due to state sharing complexity

## Admin Dashboard Security

### Decision: Role-based Access Control (RBAC)
**Rationale**:
- Simple two-role system (admin, user) matches requirements
- Role stored in JWT claims for stateless verification
- Easy to extend to additional roles if needed
- Clear separation of admin-only endpoints

**Security Measures**:
- Admin role verification in middleware
- Separate admin API routes (/api/admin/*)
- Frontend admin routes protected by role checking
- Admin actions logged for audit trail

**Alternatives Considered**:
- **Permission-based system**: Unnecessary complexity for two-role system
- **Separate admin application**: Over-engineering for current scope
- **No role separation**: Rejected for security reasons

## API Design Patterns

### Decision: RESTful API with Resource-based URLs
**Rationale**:
- Consistent with existing flashcard API patterns
- Well-understood by frontend developers
- Easy to document and test
- Standard HTTP status codes for error handling

**Endpoint Structure**:
- Authentication: `/api/auth/*` (register, login, logout, refresh)
- User management: `/api/users/*` (profile, update)
- Admin operations: `/api/admin/*` (user list, user management)
- Flashcards: Enhanced existing endpoints with user isolation

**Alternatives Considered**:
- **GraphQL**: Unnecessary complexity for CRUD operations
- **RPC-style endpoints**: Less standard, harder to cache
- **Custom protocol**: Rejected for maintenance complexity

## Error Handling & Logging

### Decision: Structured JSON Logging with Request Tracing
**Rationale**:
- Consistent error format across authentication and flashcard endpoints
- Request IDs enable tracing user actions across components
- JSON format enables log aggregation and analysis
- Security-conscious logging (no password/token logging)

**Implementation**:
- Winston logger with JSON format
- Request middleware adds unique request ID
- Authentication events logged (login, logout, failed attempts)
- Admin actions logged for audit trail
- Error responses include request ID for debugging

**Alternatives Considered**:
- **Plain text logging**: Harder to parse and analyze
- **No request tracing**: Debugging complexity increases
- **Verbose logging**: Security risk with sensitive data

## Testing Strategy

### Decision: Test-Driven Development with Real Database
**Rationale**:
- TDD ensures authentication security requirements are met
- Real SQLite database prevents mocking-related bugs
- Integration tests verify authentication flow end-to-end
- Contract tests ensure API compatibility

**Test Structure**:
- Contract tests: API endpoint schema validation
- Integration tests: Full authentication workflows
- Unit tests: Individual service functions
- E2E tests: Frontend authentication flows

**Test Database Strategy**:
- Separate test database file (test.db)
- Fresh database per test suite
- Migration scripts tested in isolation
- Test data factories for user/flashcard creation

## Performance Considerations

### Decision: Connection Pooling + Token Caching
**Rationale**:
- SQLite better-sqlite3 provides synchronous performance
- JWT token validation is stateless (no database lookup)
- bcrypt operations are intentionally slow, acceptable for login frequency
- Admin dashboard limited to admin users (low traffic)

**Optimizations**:
- Database prepared statements for repeated queries
- JWT token caching in memory for validation
- Pagination for admin user lists
- Rate limiting on authentication endpoints

**Alternatives Considered**:
- **Redis for session storage**: Unnecessary complexity for JWT approach
- **Database connection pooling**: Single SQLite file doesn't require pooling
- **Background password hashing**: Unnecessary optimization for expected load

## Deployment & Security

### Decision: Environment-based Configuration
**Rationale**:
- JWT secrets must be environment-specific
- Database paths differ between development and production
- Admin user creation automated in production deployment
- Secret rotation capabilities built-in

**Security Measures**:
- JWT secrets generated uniquely per environment
- HTTPS enforcement in production
- Rate limiting on authentication endpoints
- SQL injection prevention with prepared statements
- Admin user password rotation capabilities

**Alternatives Considered**:
- **Hardcoded secrets**: Obviously rejected for security
- **Config files in repo**: Security risk, environment variables preferred
- **Manual admin setup**: Automation reduces deployment risk