# Quickstart Guide: User Management System

## Overview
This guide walks through setting up and testing the new user management system with per-user flashcard isolation.

## Prerequisites
- Node.js 18+ installed
- Git repository cloned
- Environment variables configured

## Environment Setup

### Required Environment Variables
```bash
# Authentication
JWT_SECRET=your-long-random-jwt-secret-here
JWT_REFRESH_SECRET=your-long-random-refresh-secret-here

# Existing variables (preserved)
GEMINI_API_KEY=your-gemini-api-key
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET=your-r2-bucket-name
R2_ENDPOINT=your-r2-endpoint
R2_PUBLIC_URL=your-r2-public-url
```

### Generate JWT Secrets
```bash
# Generate secure random secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Installation

### 1. Install Dependencies
```bash
# Root dependencies (includes new auth packages)
npm install

# Backend dependencies
cd server && npm install bcrypt jsonwebtoken

# Frontend dependencies  
cd ../client && npm install
```

### 2. Database Migration
```bash
# Run migration script to add user management
npm run migrate

# Verify migration completed successfully
npm run db:status
```

### 3. Create Admin User
```bash
# Interactive admin user creation
npm run create-admin

# Or with environment variables
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secure123 npm run create-admin
```

## Development Workflow

### 1. Start Development Servers
```bash
# Start both frontend and backend
npm run dev

# Or start individually
npm run server    # Backend only (port 4000)
cd client && npm run dev  # Frontend only (port 5173)
```

### 2. Test Authentication Flow

#### User Registration
```bash
# Register new user
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Expected: 201 Created with user profile
```

#### User Login
```bash
# Login with credentials
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' \
  -c cookies.txt

# Expected: 200 OK with access token + httpOnly refresh cookie
```

#### Access Protected Resource
```bash
# Get user profile (replace TOKEN with actual token)
curl -X GET http://localhost:4000/api/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Expected: 200 OK with user profile
```

### 3. Test Flashcard Isolation

#### Create User Flashcard
```bash
# Create flashcard for authenticated user
curl -X POST http://localhost:4000/api/flashcards \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"english":"Hello","spanish":"Hola"}'

# Expected: 201 Created with flashcard including user_id
```

#### Verify Isolation
```bash
# Login as different user and try to access first user's flashcards
curl -X GET http://localhost:4000/api/flashcards \
  -H "Authorization: Bearer DIFFERENT_USER_TOKEN"

# Expected: 200 OK with empty array (no access to other user's cards)
```

### 4. Test Admin Dashboard

#### Admin Login
```bash
# Login with admin credentials
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your_admin_password"}'

# Expected: 200 OK with access token (role: "admin" in JWT)
```

#### View All Users
```bash
# Get user list (admin only)
curl -X GET http://localhost:4000/api/admin/users \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"

# Expected: 200 OK with paginated user list
```

#### View User's Flashcards
```bash
# Get specific user's flashcards (admin only)
curl -X GET http://localhost:4000/api/admin/users/2/flashcards \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"

# Expected: 200 OK with user's flashcard collection
```

## Frontend Testing

### 1. Manual UI Testing

Visit `http://localhost:5173` and test:

1. **Registration Flow**:
   - Navigate to `/register`
   - Fill form with email/password
   - Submit and verify success message
   - Verify redirect to login page

2. **Login Flow**:
   - Navigate to `/login`
   - Enter registered credentials
   - Submit and verify redirect to home
   - Verify user menu shows logged-in state

3. **Flashcard Management**:
   - Create new flashcard
   - Verify flashcard appears only in your collection
   - Test study mode functionality
   - Test edit/delete operations

4. **Admin Dashboard** (if admin):
   - Navigate to `/admin`
   - Verify user list displays
   - Test user detail view
   - Test user deletion functionality

### 2. Logout Testing
```bash
# Test logout endpoint
curl -X POST http://localhost:4000/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -b cookies.txt

# Expected: 200 OK, refresh token invalidated
```

## Running Tests

### Backend Tests
```bash
# Run all backend tests
npm run test:back

# Run specific test suites
npm test -- auth.test.js
npm test -- flashcards.test.js
npm test -- admin.test.js
```

### Frontend Tests
```bash
# Run frontend tests
cd client && npm test

# Run with coverage
cd client && npm run test:coverage
```

### Integration Tests
```bash
# Run full end-to-end test suite
npm run test:e2e

# Test authentication workflows
npm run test:auth-flow

# Test user isolation
npm run test:isolation
```

## Migration Verification

### Check Database Schema
```bash
# Verify tables exist with correct schema
npm run db:schema

# Expected output:
# - users table with email, password_hash, role columns
# - flashcards table with user_id foreign key
# - indexes on users.email and flashcards.user_id
```

### Verify Data Migration
```bash
# Check existing flashcards assigned to admin user
npm run db:verify-migration

# Expected: All existing flashcards have user_id = admin_user_id
```

## Troubleshooting

### Common Issues

#### JWT Secret Missing
```
Error: JWT_SECRET environment variable is required
```
**Solution**: Add JWT_SECRET to your `.env` file

#### Database Migration Failed
```
Error: Table already exists
```
**Solution**: Run `npm run db:reset` then `npm run migrate`

#### Admin User Creation Failed
```
Error: Admin user already exists
```
**Solution**: Use existing admin credentials or run `npm run reset-admin`

#### Token Refresh Issues
```
Error: Refresh token not found or invalid
```
**Solution**: Clear cookies and login again

### Debug Mode

Enable debug logging:
```bash
DEBUG=auth,users,flashcards npm run dev
```

### Health Check

Verify all systems working:
```bash
curl http://localhost:4000/api/health

# Expected: {"status":"ok","database":"connected","auth":"enabled"}
```

## Production Deployment

### Environment Preparation
```bash
# Set production environment variables
export NODE_ENV=production
export JWT_SECRET=$(openssl rand -hex 64)
export JWT_REFRESH_SECRET=$(openssl rand -hex 64)

# Run production migration
npm run migrate:prod
```

### Security Checklist
- [ ] JWT secrets are unique and secure (64+ characters)
- [ ] HTTPS enforced in production
- [ ] Admin user created with strong password
- [ ] Rate limiting enabled on auth endpoints
- [ ] Database backups configured
- [ ] Logs configured without sensitive data

### Deployment Verification
```bash
# Test production health
curl https://your-domain.com/api/health

# Test authentication flow
curl https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword"}'
```

## Next Steps

After successful setup:

1. **Customize Admin Dashboard**: Add user management features
2. **Implement Password Reset**: Add forgot password functionality  
3. **Add User Profiles**: Extend user data beyond email
4. **Analytics Integration**: Track user engagement metrics
5. **Backup Strategy**: Implement regular database backups

## Support

For issues or questions:
- Check logs: `npm run logs`
- Run diagnostics: `npm run diagnose`
- Reset database: `npm run db:reset` (development only)
- Contact admin: Reference your admin user email for support