# Quickstart Guide - Gemini TTS Integration Testing

## Prerequisites

1. **Environment Setup**:
   ```bash
   # Ensure Gemini API key exists
   grep GEMINI_API_KEY .env
   
   # Install dependencies (already existing)
   npm install
   ```

2. **Verify Current Functionality**:
   ```bash
   # Run existing tests to establish baseline
   npm test
   
   # Start development server
   npm run dev
   ```

## Testing Strategy

### Phase 1: Contract Tests (Must Fail First)
Create failing tests before implementation:

```bash
# Create TTS service tests (should fail)
touch server/services/gemini-tts.test.js

# Run tests - should fail
npm run test:back
```

### Phase 2: Integration Tests  
Test API endpoints with new TTS service:

```bash
# Test card creation with audio
curl -X POST http://localhost:4000/api/cards \
  -H "Authorization: Basic $(echo -n 'admin:admin' | base64)" \
  -F "en=Hello world" \
  -F "es=Hola mundo"

# Verify audio_url in response
# Verify audio file accessible at R2 URL
```

### Phase 3: Manual Verification
1. **Frontend Testing**:
   - Open http://localhost:3000/admin
   - Create new flashcard with English text
   - Verify audio plays correctly
   - Test audio regeneration feature

2. **Audio Quality Check**:
   - Compare Gemini TTS audio to previous ElevenLabs audio  
   - Verify English pronunciation clarity
   - Test Spanish text pronunciation  

## Test Scenarios

### Scenario 1: Basic TTS Generation
```javascript
// Test: Create card with TTS
const response = await request(app)
  .post('/api/cards')
  .set('Authorization', 'Basic ' + Buffer.from('admin:admin').toString('base64'))
  .send({ en: 'Hello', es: 'Hola' });

expect(response.status).toBe(201);
expect(response.body.audio_url).toMatch(/^https:\/\/.+\.mp3$/);
```

### Scenario 2: Audio Regeneration
```javascript
// Test: Regenerate audio for existing card
const response = await request(app)
  .post(`/api/cards/${cardId}/regenerate-audio`)
  .set('Authorization', 'Basic ' + Buffer.from('admin:admin').toString('base64'));

expect(response.status).toBe(200);  
expect(response.body.audio_url).toBeTruthy();
```

### Scenario 3: Error Handling
```javascript
// Test: Handle TTS service failure gracefully
// Mock Gemini API to return error
const response = await request(app)
  .post('/api/cards')
  .set('Authorization', 'Basic ' + Buffer.from('admin:admin').toString('base64'))
  .send({ en: 'Test', es: 'Prueba' });

expect(response.status).toBe(500);
expect(response.body.error).toBe('Error generando audio');
```

## Validation Checklist

### ✅ Functional Requirements
- [ ] Gemini TTS generates audio for English text
- [ ] Gemini TTS generates audio for Spanish text  
- [ ] Audio files uploaded to Cloudflare R2 successfully
- [ ] Audio URLs accessible from frontend
- [ ] Error handling maintains existing behavior
- [ ] Performance comparable to ElevenLabs (<3s response time)

### ✅ Technical Requirements
- [ ] No changes to existing API contracts
- [ ] No changes to frontend code required
- [ ] No changes to database schema
- [ ] MP3 format maintained for compatibility
- [ ] Same authentication and authorization  

### ✅ Quality Requirements
- [ ] All existing tests pass
- [ ] New contract tests pass
- [ ] Integration tests pass
- [ ] Manual audio quality verification
- [ ] Error scenarios handled gracefully

## Development Workflow

### 1. TDD Implementation Order
```bash
# Step 1: Write failing contract tests
npm run test:back  # Should show new failures

# Step 2: Write failing integration tests  
npm run test:back  # Should show integration failures

# Step 3: Implement Gemini TTS service
# (Make tests pass one by one)

# Step 4: Update server endpoints
# (Make integration tests pass)

# Step 5: Run full test suite
npm test  # All tests should pass
```

### 2. Manual Testing Flow
```bash
# Terminal 1: Start server with new TTS
npm run server

# Terminal 2: Start frontend  
cd client && npm run dev

# Browser: Test complete user flow
# 1. Create flashcard → verify audio plays
# 2. Edit flashcard text → verify audio regenerates  
# 3. Use regenerate audio button → verify new audio
```

## Rollback Plan

If issues discovered during testing:

1. **Quick Rollback**: Revert TTS service calls to ElevenLabs
2. **Gradual Rollback**: Feature flag to switch between services
3. **Data Integrity**: No data loss - all existing audio_urls remain valid

## Performance Benchmarks

Maintain existing performance targets:
- **Audio Generation**: <3 seconds per request
- **File Upload to R2**: <1 second  
- **Total Card Creation**: <5 seconds
- **Audio File Size**: <1MB for typical flashcard text

## Monitoring

Track key metrics during rollout:
- TTS generation success rate
- Average response times
- Error rates and types  
- Audio file accessibility
- User experience feedback