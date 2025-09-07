# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Root level (manages both frontend and backend):**
- `npm run dev` - Start development mode (runs both server and client)
- `npm run build` - Build the frontend (React)
- `npm start` - Start the backend in production mode
- `npm test` - Run all tests (backend and frontend)
- `npm run test:back` - Run backend tests with Jest
- `npm run test:front` - Run frontend tests

**Client (frontend) specific:**
- `cd client && npm run dev` - Start Vite dev server
- `cd client && npm run build` - Build React app for production
- `cd client && npm run lint` - Run ESLint on frontend code
- `cd client && npm test` - Run frontend Jest tests

**Server specific:**
- `npm run server` - Start Express server only

## Architecture Overview

This is a full-stack flashcard application with spaced repetition learning:

**Frontend (`/client`):**
- React 19 with React Router 7.5.0 for navigation
- Vite 6.2.0 for bundling and development
- TailwindCSS 4.1.4 for styling
- Authentication interfaces: Login, Registration, User Profile, Admin User Management
- Main pages: Home (flashcard review), Admin (card management), Auth flows
- JWT-based authentication with role-based access control
- Secure token storage with automatic expiration and obfuscation
- Error boundaries and toast notification system for user feedback
- Performance optimizations with React.memo, useCallback, and debounced search

**Backend (`/server`):**
- Express.js server on port 4000
- SQLite database (better-sqlite3) with cards and users tables
- Database migration system with tracking
- RESTful API for CRUD operations on flashcards and user management
- JWT authentication system with bcrypt password hashing (12 salt rounds)
- Role-based authorization (user/admin roles) with comprehensive middleware
- Authentication APIs: /api/auth/login, /api/auth/register, /api/auth/profile
- Admin APIs: /api/admin/users (CRUD operations with role management)
- Security features: Password strength validation, token validation, admin action logging
- Integration with Google Gemini TTS for text-to-speech (replacing ElevenLabs)
- Google Gemini AI for generating study tips
- AWS S3/Cloudflare R2 for file storage

**Key Files:**
- `server/index.js` - Main Express server with all API endpoints
- `server/services/gemini-tts.js` - Gemini TTS service implementation
- `server/middleware/auth.js` - JWT authentication and authorization middleware
- `server/middleware/adminAuth.js` - Admin-specific authentication middleware
- `server/utils/passwordUtils.js` - Password hashing and validation utilities
- `server/utils/jwtUtils.js` - JWT token generation and verification utilities
- `server/config/database.js` - Database configuration and migration system
- `client/src/App.jsx` - Main React app with routing and authentication
- `client/src/pages/Home.jsx` - Flashcard review interface (protected)
- `client/src/pages/Admin.jsx` - Admin panel for card management (admin only)
- `client/src/contexts/AuthContext.jsx` - Authentication context provider
- `client/src/utils/storageUtils.js` - Secure token storage utilities
- `client/src/components/common/ErrorBoundary.jsx` - Error handling component
- `client/src/components/common/Toast.jsx` - Notification system
- `client/src/tests/e2e/user-journey.test.js` - End-to-end user journey tests
- `server/flashcards.db` - SQLite database with users and cards tables

**Database Schema:**
- Users table: id, email, password (hashed), role, created_at, updated_at, last_login
- Cards table: id, en, es, level, nextReview, audio_url, tips, easeFactor, repetitions, lastInterval, user_id

**External Services:**
- Google Gemini TTS for audio generation (gemini-2.5-pro-preview-tts model)
  - Streaming audio generation with chunked processing
  - WAV format output (labeled as MP3 for API compatibility)
  - Default voice: 'Zephyr'
  - Performance target: <3s response time
- Google Gemini AI for study tips generation
- Cloudflare R2 for file storage (audio files)

## Environment Variables

Required for development:
- `GEMINI_API_KEY` - For text-to-speech and AI-powered study tips
- `JWT_SECRET` - Secret key for JWT token signing (required for production)
- `JWT_EXPIRES_IN` - Token expiration time (default: "24h")
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_PUBLIC_URL` - Cloudflare R2 storage

Optional for production:
- `DATABASE_URL` - Database connection string for production (defaults to local SQLite in development)

Deprecated (no longer needed):
- `ELEVENLABS_API_KEY` - Replaced by Gemini TTS
- `ELEVENLABS_VOICE_ID` - Replaced by Gemini voice configuration

## Testing

- Backend: Jest with supertest for API testing
- Frontend: Jest with React Testing Library  
- Tests are located alongside source files (*.test.js, *.test.jsx)
- End-to-end testing: `client/src/tests/e2e/user-journey.test.js`
- Comprehensive test coverage for:
  - Authentication system: JWT, password hashing, user management
  - Gemini TTS integration: Unit, integration, performance, R2 compatibility
  - Frontend components: Authentication flows, error handling, user interactions
  - Security: Token validation, role-based access, password strength
- Test files:
  - `server/services/gemini-tts.test.js` - TTS service tests
  - `server/integration.test.js` - API integration tests
  - `server/performance.test.js` - Performance benchmarks
  - `server/r2-compatibility.test.js` - R2 storage tests
  - `server/audio-endpoint.test.js` - Audio endpoint tests
  - `client/src/tests/e2e/user-journey.test.js` - Complete user flow tests

## Security

The application implements comprehensive security measures:

**Authentication & Authorization:**
- JWT-based authentication with secure token generation
- bcrypt password hashing (12 salt rounds)
- Password strength validation (8+ chars, mixed case, common password blacklist)
- Role-based access control (user/admin roles)
- Automatic token expiration and refresh mechanism

**Client-Side Security:**
- Secure token storage with obfuscation and automatic cleanup
- XSS protection through token storage abstraction
- Error boundaries to prevent UI crashes from exposing sensitive data
- Protected routes with authentication guards

**Server-Side Security:**
- Comprehensive authentication middleware
- Admin action logging and prevention of self-actions
- Input validation and sanitization
- Database migration system with tracking
- Secure API endpoints with proper error handling

**Security Audit:**
- Complete security audit available in `SECURITY_AUDIT.md`
- Security score: 8.5/10
- Regular security reviews recommended

## Quality Validation

- Audio quality validation script: `server/audio-quality-validation.js`
- Run with: `node server/audio-quality-validation.js`
- Generates test audio files for manual validation
- Validates WAV format, sample rates, and multi-language support

## Deployment

Configured for Render.com deployment via `render.yaml`. The app automatically installs dependencies, builds the frontend, and serves both frontend and backend from the Express server in production.