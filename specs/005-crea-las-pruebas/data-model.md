# Data Model: E2E Testing Suite

## Test Entities

### TestUser
**Purpose**: Represents test user accounts for authentication and authorization testing
**Fields**:
- id: integer (auto-increment)
- email: string (unique, valid email format)
- password: string (plaintext for test setup, hashed in database)
- role: enum ('user', 'admin')
- created_at: timestamp
- updated_at: timestamp

**Validation Rules**:
- Email must be valid format and unique
- Password minimum 6 characters
- Role must be 'user' or 'admin'

**State Transitions**:
- Created → Active (after successful registration)
- Active → Authenticated (after login)
- Authenticated → Expired (token expiration)

### TestFlashcard
**Purpose**: Represents flashcard test data for CRUD and learning algorithm testing
**Fields**:
- id: integer (auto-increment)
- english: string (required, max 500 characters)
- spanish: string (required, max 500 characters)
- user_id: integer (foreign key to TestUser)
- difficulty: integer (1-5, default 1)
- last_reviewed: timestamp (nullable)
- review_count: integer (default 0)

**Validation Rules**:
- English and Spanish text required and non-empty
- Difficulty must be between 1-5
- User_id must reference existing user
- Review_count cannot be negative

**Relationships**:
- Belongs to TestUser (many-to-one)
- User data isolation enforced

### TestSession
**Purpose**: Represents study session data for spaced repetition testing
**Fields**:
- id: integer (auto-increment)
- user_id: integer (foreign key to TestUser)
- flashcard_id: integer (foreign key to TestFlashcard)
- response_quality: integer (1-5, user's self-assessment)
- response_time: integer (milliseconds)
- created_at: timestamp

**Validation Rules**:
- Response quality must be 1-5
- Response time must be positive integer
- Must reference existing user and flashcard

**Relationships**:
- Belongs to TestUser (many-to-one)
- Belongs to TestFlashcard (many-to-one)

### TestAudioFile
**Purpose**: Represents TTS audio files for audio functionality testing
**Fields**:
- id: integer (auto-increment)
- flashcard_id: integer (foreign key to TestFlashcard)
- language: enum ('english', 'spanish')
- audio_url: string (R2/S3 URL)
- file_size: integer (bytes)
- duration: integer (milliseconds)
- created_at: timestamp

**Validation Rules**:
- Language must be 'english' or 'spanish'
- Audio URL must be valid HTTPS URL
- File size and duration must be positive

**Relationships**:
- Belongs to TestFlashcard (many-to-one)

## Test Data Isolation Strategy

### Database Isolation
- Separate test database: `flashcards-test.db`
- Clean slate before each test suite
- Transaction rollback for individual tests
- Parallel test execution with unique identifiers

### User Data Segregation
- Test users with predictable IDs (1000+)
- Isolated flashcard collections per test user
- No cross-user data contamination
- Admin vs regular user role separation

### External Service Mocking
- TTS API responses mocked for speed
- R2/S3 storage mocked with local files
- JWT tokens with test-specific secrets
- Network call interception for reliability

## Performance Considerations

### Data Volume Limits
- Maximum 100 flashcards per test user
- Maximum 10 test users per test suite
- Audio files limited to 1MB each
- Session history limited to 50 entries

### Cleanup Strategies
- Automatic cleanup after test completion
- Cascade delete for user removal
- Temporary file cleanup for audio tests
- Database vacuum after test suites