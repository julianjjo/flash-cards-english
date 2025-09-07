# Tasks: Replace ElevenLabs TTS with Gemini TTS

**Input**: Design documents from `/specs/001-implementa-tts-de/`
**Prerequisites**: plan.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech stack: Node.js, Express, @google/genai, React frontend
   → Structure: Web app, maintain existing architecture
2. Load optional design documents ✓:
   → data-model.md: No entities to create (existing schema unchanged)
   → contracts/: API endpoints maintain same contracts
   → research.md: Gemini TTS decisions, MP3 conversion
3. Generate tasks by category ✓:
   → Setup: Gemini TTS service module creation
   → Tests: Contract tests for TTS endpoints, service unit tests
   → Core: TTS service implementation, endpoint modification
   → Integration: Error handling, logging consistency  
   → Polish: Performance validation, cleanup
4. Apply task rules ✓:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...) ✓
6. Generate dependency graph ✓
7. Create parallel execution examples ✓
8. Validate task completeness ✓:
   → All TTS endpoints have tests ✓
   → Service module has unit tests ✓
   → Integration scenarios covered ✓
9. Return: SUCCESS (tasks ready for execution) ✓
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
Web app structure (existing):
- **Backend**: `server/` (existing Express server)
- **Frontend**: `client/src/` (existing React app - NO CHANGES)
- **Tests**: `server/*.test.js` pattern (existing Jest setup)

## Phase 3.1: Setup
- [ ] T001 Create Gemini TTS service directory `server/services/`
- [ ] T002 Verify @google/genai dependency available (already in package.json)
- [ ] T003 [P] Create TTS service module structure `server/services/gemini-tts.js`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (Verify API endpoints maintain same behavior)
- [ ] T004 [P] Contract test POST /api/cards with TTS in `server/index.test.js` (new test cases)
- [ ] T005 [P] Contract test PUT /api/cards/:id with TTS regeneration in `server/index.test.js` (new test cases)  
- [ ] T006 [P] Contract test POST /api/cards/:id/regenerate-audio in `server/index.test.js` (new test cases)

### Service Unit Tests  
- [ ] T007 [P] Unit test Gemini TTS service in `server/services/gemini-tts.test.js`
- [ ] T008 [P] Unit test audio conversion to MP3 in `server/services/gemini-tts.test.js`
- [ ] T009 [P] Unit test error handling in `server/services/gemini-tts.test.js`

### Integration Tests
- [ ] T010 [P] Integration test complete card creation flow with Gemini TTS in `server/integration.test.js`
- [ ] T011 [P] Integration test audio regeneration flow in `server/integration.test.js`

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### TTS Service Module
- [ ] T012 Implement Gemini TTS client in `server/services/gemini-tts.js`
- [ ] T013 Implement audio streaming and buffer handling in `server/services/gemini-tts.js`  
- [ ] T014 Implement WAV to MP3 conversion in `server/services/gemini-tts.js`
- [ ] T015 Implement voice selection (Zephyr for English) in `server/services/gemini-tts.js`

### Endpoint Integration (Sequential - same file modifications)
- [ ] T016 Replace ElevenLabs calls in POST /api/cards endpoint (`server/index.js`)
- [ ] T017 Replace ElevenLabs calls in PUT /api/cards/:id endpoint (`server/index.js`)  
- [ ] T018 Replace ElevenLabs calls in POST /api/cards/:id/regenerate-audio endpoint (`server/index.js`)

### Error Handling
- [ ] T019 Implement consistent error messages matching ElevenLabs patterns (`server/index.js`)
- [ ] T020 Add Gemini TTS failure fallback handling (`server/index.js`)

## Phase 3.4: Integration
- [ ] T021 Update environment variable documentation (remove ELEVENLABS_* from README)
- [ ] T022 Add structured logging for Gemini TTS calls (`server/services/gemini-tts.js`)
- [ ] T023 Test R2 upload compatibility with Gemini-generated MP3s
- [ ] T024 Verify audio file accessibility via existing `/audio/:filename` endpoint

## Phase 3.5: Polish  
- [ ] T025 [P] Performance test TTS response times (<3s requirement) in `server/performance.test.js`
- [ ] T026 [P] Audio quality manual validation (English and Spanish)
- [ ] T027 [P] Update CLAUDE.md with Gemini TTS integration notes (already done)
- [ ] T028 Remove unused ElevenLabs code and imports from `server/index.js`
- [ ] T029 Run complete test suite and fix any regressions
- [ ] T030 Manual test quickstart scenarios from `specs/001-implementa-tts-de/quickstart.md`

## Dependencies
- Setup (T001-T003) before tests (T004-T011)
- Tests (T004-T011) before implementation (T012-T020)  
- T012-T015 (service module) before T016-T018 (endpoint integration)
- T016-T020 (core) before T021-T024 (integration)
- All implementation before polish (T025-T030)

## Parallel Example
```
# Launch T004-T006 together (contract tests):
Task: "Contract test POST /api/cards with TTS in server/index.test.js"
Task: "Contract test PUT /api/cards/:id with TTS in server/index.test.js"  
Task: "Contract test POST /api/cards/:id/regenerate-audio in server/index.test.js"

# Launch T007-T009 together (service unit tests):
Task: "Unit test Gemini TTS service in server/services/gemini-tts.test.js"
Task: "Unit test audio conversion to MP3 in server/services/gemini-tts.test.js"
Task: "Unit test error handling in server/services/gemini-tts.test.js"

# Launch T010-T011 together (integration tests):
Task: "Integration test complete card creation flow in server/integration.test.js"
Task: "Integration test audio regeneration flow in server/integration.test.js"
```

## Notes
- [P] tasks = different files, no dependencies between them
- Verify all tests fail before implementing (TDD red-green-refactor)
- Commit after each task completion
- NO changes to frontend React code required
- Maintain identical API contracts for backwards compatibility

## Task Generation Rules Applied
1. **From Contracts**: Each TTS endpoint → contract test + implementation  
2. **From Data Model**: No new entities (schema unchanged)
3. **From User Stories**: Card creation/editing flows → integration tests
4. **Ordering**: Setup → Tests → Service → Endpoints → Integration → Polish

## Validation Checklist ✓
- [x] All TTS endpoints have corresponding contract tests (T004-T006)
- [x] TTS service has comprehensive unit tests (T007-T009)  
- [x] All tests come before implementation (T004-T011 before T012-T020)
- [x] Parallel tasks are truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task (T016-T018 are sequential)

## Context Integration
**User Request**: "implement gemini tss remplace eleven labs"
- Replace ElevenLabs TTS with Gemini TTS service
- Maintain all existing functionality and API contracts  
- No frontend changes required (respecting existing React code)
- Focus on backend service replacement with identical user experience