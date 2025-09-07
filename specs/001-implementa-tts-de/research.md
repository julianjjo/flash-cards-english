# Phase 0: Research - Gemini TTS Integration

## Technical Decisions Made

### 1. Gemini TTS API Integration
**Decision**: Use @google/genai library with gemini-2.5-pro-preview-tts model

**Rationale**:
- Official Google library already in project dependencies (@google/genai ^0.14.1)
- Streaming audio support matches provided code example
- Multilingual capabilities for English/Spanish
- Consistent with existing Gemini integration for tips generation

**Alternatives Considered**:
- Direct REST API calls to Gemini - Rejected: More complex implementation, manual streaming handling
- Use Google Cloud TTS API - Rejected: Different service, would require new dependency

### 2. Audio Format Compatibility  
**Decision**: Convert Gemini audio output to MP3 format maintaining compatibility

**Rationale**:
- Existing system expects MP3 format (Content-Type: 'audio/mpeg')
- Frontend audio elements configured for MP3
- Cloudflare R2 storage already set up for MP3 files
- Current ElevenLabs integration produces MP3

**Alternatives Considered**:
- Keep WAV format from Gemini - Rejected: Would require frontend changes
- Support multiple formats - Rejected: Adds complexity without user benefit

### 3. Voice Selection Strategy
**Decision**: Use "Zephyr" voice for English, test voice options for Spanish

**Rationale**:
- "Zephyr" voice shown in provided code example
- Good pronunciation quality for English text
- Need to test Spanish pronunciation quality
- Voice configuration can be language-specific

**Alternatives Considered**:
- Multiple voice configuration UI - Deferred: Can be added in future iteration
- Random voice selection - Rejected: Inconsistent user experience

### 4. Error Handling Patterns
**Decision**: Match existing ElevenLabs error handling patterns exactly

**Rationale**:
- Maintains consistent API behavior for frontend
- Same error response codes and messages
- Existing error handling already handles TTS failures gracefully
- Users won't notice service change

**Alternatives Considered**:
- Enhanced error handling with more detail - Deferred: Can be added incrementally
- Different error response format - Rejected: Would break frontend expectations

### 5. Audio File Conversion Implementation
**Decision**: Implement WAV to MP3 conversion using provided convert_to_wav function as reference

**Rationale**:
- Gemini TTS returns audio in streaming chunks with MIME type information
- Need to reconstruct WAV header from MIME type parameters
- Convert resulting WAV to MP3 for compatibility
- Code example provided shows exact implementation pattern

**Alternatives Considered**:
- Use external audio conversion library - Rejected: Adds dependency, complexity
- Store WAV files and convert on demand - Rejected: Storage and performance impact

## Environment Variables
No new environment variables needed:
- GEMINI_API_KEY already exists for tips generation
- All other environment variables remain unchanged

## Dependencies
No new dependencies required:
- @google/genai ^0.14.1 already in project
- Node.js built-in modules sufficient for audio conversion (Buffer, struct)

## Performance Considerations
- Gemini TTS streaming should be similar or better than ElevenLabs
- Audio conversion adds minimal processing time
- R2 upload process remains identical
- Caching behavior unchanged

## Testing Strategy
- Mock Gemini API responses in unit tests
- Use actual Gemini API in integration tests with fallbacks
- Maintain existing test structure and patterns
- Audio quality verification in manual testing

## Implementation Notes
- Service replacement can be done incrementally
- Fallback to error handling if Gemini fails
- Maintain all existing logging patterns
- No database schema changes required