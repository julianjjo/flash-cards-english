# API Contracts - Gemini TTS Integration

## Contract Guarantee
All existing API endpoints maintain **identical** external behavior. The only change is the internal TTS service provider.

## Existing Endpoints (Unchanged Contracts)

### POST /api/cards
**Purpose**: Create new flashcard with audio generation

**Request**:
```javascript
Content-Type: multipart/form-data
Authorization: Basic [credentials]

Body:
{
  en: string,      // Required: English text
  es: string,      // Required: Spanish text  
  audio?: File     // Optional: Custom audio file
}
```

**Response Success (201)**:
```javascript
{
  id: number,
  en: string,
  es: string, 
  level: 0,
  nextReview: string,     // ISO timestamp
  audio_url: string|null, // R2 URL or null in test mode
  tips: string|null       // AI-generated tips
}
```

**Response Error (400/500)**:
```javascript
{
  error: string  // Error message
}
```

**Contract Changes**: None - internally uses Gemini instead of ElevenLabs

### PUT /api/cards/:id  
**Purpose**: Update existing flashcard, regenerate audio if text changes

**Request**:
```javascript
Content-Type: multipart/form-data
Authorization: Basic [credentials]

Body:
{
  en?: string,     // Optional: New English text
  es?: string,     // Optional: New Spanish text
  level?: number,  // Optional: Update difficulty level
  nextReview?: string, // Optional: Next review timestamp
  audio?: File     // Optional: Custom audio file
}
```

**Response Success (200)**:
```javascript
{
  id: number,
  en: string,
  es: string,
  level: number, 
  nextReview: string,
  audio_url: string|null,
  tips: string|null
}
```

**Response Error (404/500)**:
```javascript
{
  error: string
}
```

**Contract Changes**: None - internally uses Gemini for audio regeneration

### POST /api/cards/:id/regenerate-audio
**Purpose**: Force regeneration of audio for existing flashcard

**Request**:
```javascript
Authorization: Basic [credentials]
```

**Response Success (200)**:
```javascript
{
  id: number,
  en: string,
  es: string,
  level: number,
  nextReview: string, 
  audio_url: string|null, // Updated with new audio
  tips: string|null
}
```

**Response Error (404/502)**:
- 404: Card not found
- 502: Audio generation failed

**Contract Changes**: None - internally uses Gemini TTS

### GET /audio/:filename
**Purpose**: Serve audio files from Cloudflare R2 storage

**Request**:
```javascript
// No authorization required - public audio access
```

**Response Success (200)**:
```javascript
Content-Type: audio/mpeg
Cache-Control: no-store
// Binary MP3 data stream
```

**Response Error (404)**:
```javascript
// File not found in R2 storage
```

**Contract Changes**: None - serves same MP3 files

## Internal Service Contract (New)

### Gemini TTS Service
**Module**: `server/services/gemini-tts.js`

**Method**: `generateAudio(text, language)`
```javascript
// Input
text: string        // Text to convert to speech  
language: 'en'|'es' // Language for TTS

// Output  
Promise<{
  success: boolean,
  audioBuffer?: Buffer,  // MP3 format
  error?: string
}>
```

**Method**: `convertToMp3(audioChunks, mimeType)`
```javascript
// Input
audioChunks: Buffer[] // Raw audio chunks from Gemini
mimeType: string      // Audio MIME type

// Output
Promise<Buffer>       // MP3 formatted audio
```

## Error Handling Contract

All error responses maintain existing patterns:

**ElevenLabs Error (Current)**:
```javascript
{
  status: 500,
  body: { error: 'Error generando audio' }
}
```

**Gemini Error (New - Same Format)**:
```javascript
{
  status: 500, 
  body: { error: 'Error generando audio' }
}
```

## Testing Contract Requirements

### Contract Tests Must Verify:
1. POST /api/cards creates card with audio_url
2. PUT /api/cards/:id updates audio when text changes  
3. POST /api/cards/:id/regenerate-audio forces new audio
4. All endpoints return same response format
5. Error responses match existing patterns
6. Audio files are accessible via R2 URLs
7. Generated MP3 files are valid audio format

### Test Environment Behavior:
- In test mode (NODE_ENV=test): audio_url = null
- In development/production: audio_url = R2 URL
- Error handling identical across environments

## Backwards Compatibility Guarantee

1. **API Responses**: Identical JSON structure and field types
2. **HTTP Status Codes**: Same success/error status codes  
3. **Authentication**: Same Basic Auth requirements
4. **Content Types**: Same request/response content types
5. **Audio Format**: MP3 files with same audio/mpeg MIME type
6. **Error Messages**: Identical error message format