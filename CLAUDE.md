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

**Backend (`/server`):**
- Express.js server on port 4000
- SQLite database (better-sqlite3) with cards and users tables
- RESTful API for CRUD operations on flashcards and user management
- JWT authentication system with bcrypt password hashing
- Role-based authorization (user/admin roles)
- Authentication APIs: /api/auth/login, /api/auth/register, /api/auth/profile
- Admin APIs: /api/admin/users (CRUD operations with role management)
- Integration with Google Gemini TTS for text-to-speech (replacing ElevenLabs)
- Google Gemini AI for generating study tips
- AWS S3/Cloudflare R2 for file storage

**Key Files:**
- `server/index.js` - Main Express server with all API endpoints
- `server/services/gemini-tts.js` - Gemini TTS service implementation
- `client/src/App.jsx` - Main React app with routing and authentication
- `client/src/pages/Home.jsx` - Flashcard review interface (protected)
- `client/src/pages/Admin.jsx` - Admin panel for card management (admin only)
- `client/src/components/auth/` - Authentication components (Login, Register, Profile)
- `client/src/components/admin/` - Admin user management components
- `client/src/hooks/useAuth.js` - Authentication context and hooks
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
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_PUBLIC_URL` - Cloudflare R2 storage

Deprecated (no longer needed):
- `ELEVENLABS_API_KEY` - Replaced by Gemini TTS
- `ELEVENLABS_VOICE_ID` - Replaced by Gemini voice configuration

## Testing

- Backend: Jest with supertest for API testing
- Frontend: Jest with React Testing Library  
- Tests are located alongside source files (*.test.js, *.test.jsx)
- Comprehensive test coverage for Gemini TTS integration:
  - Unit tests: `server/services/gemini-tts.test.js`
  - Integration tests: `server/integration.test.js`
  - Performance tests: `server/performance.test.js`
  - R2 compatibility: `server/r2-compatibility.test.js`
  - Audio endpoint: `server/audio-endpoint.test.js`

## Quality Validation

- Audio quality validation script: `server/audio-quality-validation.js`
- Run with: `node server/audio-quality-validation.js`
- Generates test audio files for manual validation
- Validates WAV format, sample rates, and multi-language support

## Deployment

Configured for Render.com deployment via `render.yaml`. The app automatically installs dependencies, builds the frontend, and serves both frontend and backend from the Express server in production.