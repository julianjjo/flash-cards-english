# Implementation Plan: Replace ElevenLabs TTS with Gemini TTS

**Branch**: `001-implementa-tts-de` | **Date**: 2025-09-07 | **Spec**: [/specs/001-implementa-tts-de/spec.md]
**Input**: Feature specification from `/specs/001-implementa-tts-de/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✓
2. Fill Technical Context (scan for NEEDS CLARIFICATION) ✓
   → Project Type: web (Express backend + React frontend)
   → Structure Decision: Maintain existing structure (respecting current React code)
3. Evaluate Constitution Check section below ✓
   → No violations - simple TTS service replacement
   → Update Progress Tracking: Initial Constitution Check ✓
4. Execute Phase 0 → research.md ✓
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md ✓
6. Re-evaluate Constitution Check section ✓
   → Update Progress Tracking: Post-Design Constitution Check ✓
7. Plan Phase 2 → Describe task generation approach ✓
8. STOP - Ready for /tasks command ✓
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Replace the current ElevenLabs TTS integration with Google Gemini TTS while maintaining all existing functionality and user interfaces. The change should be transparent to users, only affecting the backend audio generation service. Respects existing React frontend - no frontend changes needed.

## Technical Context
**Language/Version**: Node.js with ES modules, React 19 (existing)  
**Primary Dependencies**: Express 4.18.2, @google/genai ^0.14.1 (existing), cors, multer (existing)  
**Storage**: Cloudflare R2 for audio files, SQLite with better-sqlite3 (existing)  
**Testing**: Jest with supertest for backend, Jest with React Testing Library for frontend (existing)  
**Target Platform**: Node.js server (Express), modern browsers  
**Project Type**: web - Express backend with React frontend  
**Performance Goals**: Maintain current TTS response times <3s, audio quality equivalent to ElevenLabs  
**Constraints**: Maintain existing API contracts, no frontend changes, same audio file formats (MP3)  
**Scale/Scope**: Individual flashcard audio generation, ~10-50 audio requests per user session  

**User Context**: Respeta el codigo actual esta hecho con react la idea es solo cambiar lo que ya existe

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (backend service modification only)
- Using framework directly? Yes - using @google/genai directly, no wrapper classes
- Single data model? Yes - existing flashcard model unchanged
- Avoiding patterns? Yes - direct service replacement, no new patterns

**Architecture**:
- EVERY feature as library? N/A - this is a service replacement in existing architecture
- Libraries listed: gemini-tts-service (purpose: TTS generation using Gemini)
- CLI per library: N/A - web service integration
- Library docs: Will update existing CLAUDE.md

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes - failing tests first
- Git commits show tests before implementation? Will ensure this
- Order: Contract→Integration→E2E→Unit strictly followed? Yes
- Real dependencies used? Yes - actual Gemini API in integration tests with fallbacks
- Integration tests for: TTS API contract changes, audio generation
- FORBIDDEN: Implementation before test, skipping RED phase

**Observability**:
- Structured logging included? Yes - existing console.error patterns maintained
- Frontend logs → backend? Not needed for TTS service
- Error context sufficient? Yes - API error handling maintained

**Versioning**:
- Version number assigned? N/A - part of existing app version
- BUILD increments on every change? Follows existing package.json versioning
- Breaking changes handled? No breaking changes - same API contracts

## Project Structure

### Documentation (this feature)
```
specs/001-implementa-tts-de/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Existing Web Application Structure (MAINTAINED)
server/
├── index.js             # Main server file (TTS calls modified here)
├── cloudflare-d1.js     # Database utilities (unchanged)
├── index.test.js        # Server tests (TTS tests updated)
└── flashcards.db        # SQLite database (unchanged)

client/
├── src/
│   ├── components/      # React components (unchanged)
│   ├── pages/          # Home.jsx, Admin.jsx (unchanged)
│   └── services/       # API calls (unchanged)
└── tests/              # Frontend tests (unchanged)

# New files for TTS service
server/services/         # New directory
└── gemini-tts.js       # New Gemini TTS service module
```

**Structure Decision**: Maintain existing web application structure, add new TTS service module only

## Phase 0: Outline & Research

### Research Tasks Completed:

1. **Gemini TTS API Integration**: 
   - Decision: Use @google/genai library with gemini-2.5-pro-preview-tts model
   - Rationale: Official Google library, streaming audio support, multilingual capabilities
   - Alternatives considered: Direct REST API calls (rejected - more complex implementation)

2. **Audio Format Compatibility**:
   - Decision: Convert Gemini audio output to MP3 format to maintain compatibility
   - Rationale: Existing system expects MP3, frontend audio players configured for MP3
   - Alternatives considered: Change entire pipeline to WAV (rejected - requires frontend changes)

3. **Voice Selection Strategy**:
   - Decision: Use "Zephyr" voice for English, research Spanish voice options
   - Rationale: Zephyr shown in provided code example, good English pronunciation
   - Alternatives considered: Multiple voice configuration (deferred - can be added later)

4. **Error Handling Patterns**:
   - Decision: Match existing ElevenLabs error handling patterns
   - Rationale: Maintain consistent API behavior and error responses
   - Alternatives considered: Enhanced error handling (can be added incrementally)

**Output**: research.md with all technical decisions documented

## Phase 1: Design & Contracts

### Data Model
No changes to existing data model - flashcards table remains the same:
- id, en, es, level, nextReview, audio_url, tips (unchanged)
- audio_url continues to point to R2 storage URLs

### API Contracts
Existing REST endpoints maintained without changes:
- POST /api/cards (creates card with TTS)
- PUT /api/cards/:id (updates card, regenerates TTS if text changes)  
- POST /api/cards/:id/regenerate-audio (forces TTS regeneration)
- GET /audio/:filename (serves audio files from R2)

Internal service contract (new):
- generateAudio(text, language) → audioBuffer
- convertToMp3(audioBuffer) → mp3Buffer

### Generated Artifacts:
- data-model.md: Documents unchanged data model
- contracts/: API contracts showing no external changes
- Contract tests: Verify TTS endpoints still work correctly
- quickstart.md: Updated testing procedures for new TTS service
- CLAUDE.md: Updated with Gemini TTS integration notes

**Output**: data-model.md, /contracts/*, failing contract tests, quickstart.md, CLAUDE.md updated

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks focusing on service replacement without breaking existing functionality
- Each endpoint that uses TTS → contract test task [P]
- TTS service module → unit test tasks [P]
- Integration tests for audio generation pipeline
- Implementation tasks following TDD principles

**Ordering Strategy**:
- TDD order: Failing tests before implementation
- Service isolation: TTS module tests before integration
- Dependency order: Service module → endpoint integration → E2E validation
- Mark [P] for parallel execution (independent test files)

**Estimated Output**: 15-20 numbered, ordered tasks focusing on service replacement

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following TDD principles)  
**Phase 5**: Validation (run tests, verify audio generation, performance testing)

## Complexity Tracking
*No constitutional violations identified*

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
- [x] Complexity deviations documented (none)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*