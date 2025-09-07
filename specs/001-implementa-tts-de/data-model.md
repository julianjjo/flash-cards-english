# Phase 1: Data Model - Gemini TTS Integration

## Existing Data Model (Unchanged)

### Flashcards Table
The existing SQLite database schema remains completely unchanged:

```sql
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  en TEXT NOT NULL,
  es TEXT NOT NULL, 
  level INTEGER DEFAULT 0,
  nextReview TEXT,
  audio_url TEXT,
  tips TEXT
);
```

**Entity Fields**:
- `id`: Primary key, auto-incrementing integer
- `en`: English text for the flashcard
- `es`: Spanish text for the flashcard  
- `level`: Spaced repetition level (0-N)
- `nextReview`: ISO timestamp for next review
- `audio_url`: URL to audio file stored in Cloudflare R2
- `tips`: AI-generated study tips (from existing Gemini integration)

## Data Flow (Modified Only for TTS Generation)

### Current Flow
1. User creates/updates flashcard with English text
2. **ElevenLabs** generates audio for English text
3. Audio uploaded to Cloudflare R2  
4. R2 URL stored in `audio_url` field
5. Frontend plays audio from R2 URL

### New Flow (Internal Change Only)
1. User creates/updates flashcard with English text
2. **Gemini TTS** generates audio for English text  
3. Audio converted to MP3 format
4. Audio uploaded to Cloudflare R2
5. R2 URL stored in `audio_url` field  
6. Frontend plays audio from R2 URL (unchanged)

## Internal Service Data Model (New)

### Audio Generation Request
```javascript
{
  text: string,           // Text to convert to speech
  language: 'en' | 'es',  // Language code
  voice?: string          // Optional voice selection (default: "Zephyr")
}
```

### Audio Generation Response  
```javascript
{
  audioBuffer: Buffer,    // Raw audio data
  mimeType: string,       // Audio format from Gemini
  success: boolean,       // Generation success flag
  error?: string          // Error message if failed
}
```

### Audio Conversion Data
```javascript
{
  inputBuffer: Buffer,    // Raw audio from Gemini
  inputMimeType: string,  // Original format
  outputBuffer: Buffer,   // Converted MP3 data
  outputFormat: 'audio/mpeg'
}
```

## Validation Rules (Unchanged)

All existing validation rules remain in place:
- `en` and `es` fields required for card creation
- `level` defaults to 0, must be non-negative integer
- `nextReview` must be valid ISO timestamp
- `audio_url` nullable, must be valid URL when present
- `tips` nullable string

## State Transitions (Unchanged)

Flashcard state machine remains identical:
- New card: level=0, nextReview=now
- Successful review: level++, nextReview=spaced_interval  
- Failed review: level=0, nextReview=short_interval
- Audio regeneration: only `audio_url` field updated

## Relationships (Unchanged)

No relational changes:
- Flashcards are independent entities
- No foreign key relationships
- One-to-one relationship with audio files via URL reference

## Migration Requirements

**Database Migration**: None required - schema unchanged
**Data Migration**: None required - existing data compatible
**Audio Migration**: Existing audio files remain accessible via R2 URLs

## Backwards Compatibility

Complete backwards compatibility maintained:
- All existing API endpoints unchanged
- All existing database queries unchanged  
- All existing frontend code unchanged
- All existing audio files continue to work