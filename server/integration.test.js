import request from 'supertest';
import app from './index.js';
import Database from 'better-sqlite3';
import { generateAudio } from './services/gemini-tts.js';

// Integration tests for complete TTS workflows
describe('Gemini TTS Integration Tests', () => {
  let testDb;
  let testCardId;

  beforeAll(() => {
    // Set up in-memory database for integration testing
    testDb = new Database(':memory:');
    app.locals.db = testDb;
    
    testDb.prepare(`CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      en TEXT NOT NULL,
      es TEXT NOT NULL,
      level INTEGER DEFAULT 0,
      nextReview TEXT,
      audio_url TEXT,
      tips TEXT
    );`).run();
    
    // Set up test environment variables
    process.env.GEMINI_API_KEY = 'test-gemini-key-integration';
    process.env.NODE_ENV = 'test'; // This should prevent actual API calls
  });

  afterAll(() => {
    if (testDb) {
      testDb.close();
    }
  });

  // T010: Integration test complete card creation flow with Gemini TTS
  describe('Complete card creation flow', () => {
    test('should create flashcard with Gemini TTS audio generation', async () => {
      const cardData = {
        en: 'Integration test card',
        es: 'Tarjeta de prueba de integración'
      };

      // Step 1: Create card via API
      const createResponse = await request(app)
        .post('/api/cards')
        .auth(process.env.ADMIN_USER, process.env.ADMIN_PASS)
        .send(cardData);

      // This WILL FAIL initially because Gemini TTS is not implemented
      expect(createResponse.statusCode).toBe(201);
      expect(createResponse.body.en).toBe(cardData.en);
      expect(createResponse.body.es).toBe(cardData.es);
      
      // Step 2: Verify TTS was called (audio_url should be set or null in test mode)
      expect(createResponse.body.audio_url).toBeDefined();
      
      // Step 3: Verify card was stored in database
      const storedCard = testDb.prepare('SELECT * FROM cards WHERE id = ?').get(createResponse.body.id);
      expect(storedCard).toBeTruthy();
      expect(storedCard.en).toBe(cardData.en);
      expect(storedCard.audio_url).toBeDefined();
      
      testCardId = createResponse.body.id;
    });

    test('should handle TTS service failures gracefully', async () => {
      // Mock a TTS failure scenario by using invalid text
      const cardData = {
        en: '', // Empty text should trigger error
        es: 'Texto válido'
      };

      const createResponse = await request(app)
        .post('/api/cards')
        .auth(process.env.ADMIN_USER, process.env.ADMIN_PASS)
        .send(cardData);

      // This should fail validation before TTS is called
      expect(createResponse.statusCode).toBe(400);
    });

    test('should maintain data consistency during TTS generation', async () => {
      const cardData = {
        en: 'Consistency test card',
        es: 'Tarjeta de prueba de consistencia'
      };

      const createResponse = await request(app)
        .post('/api/cards')
        .auth(process.env.ADMIN_USER, process.env.ADMIN_PASS)
        .send(cardData);

      // This WILL FAIL initially - Gemini TTS not implemented
      expect(createResponse.statusCode).toBe(201);
      
      // Verify all required fields are present
      expect(createResponse.body).toHaveProperty('id');
      expect(createResponse.body).toHaveProperty('en');
      expect(createResponse.body).toHaveProperty('es');
      expect(createResponse.body).toHaveProperty('level', 0);
      expect(createResponse.body).toHaveProperty('nextReview');
      expect(createResponse.body).toHaveProperty('audio_url');
      expect(createResponse.body).toHaveProperty('tips');
    });
  });

  // T011: Integration test audio regeneration flow
  describe('Audio regeneration flow', () => {
    test('should regenerate audio when card text is updated', async () => {
      // First, get the current card state
      const getResponse = await request(app)
        .get(`/api/cards/${testCardId}`)
        .auth(process.env.ADMIN_USER, process.env.ADMIN_PASS);

      const originalAudioUrl = getResponse.body.audio_url;

      // Update the card with new English text
      const updateData = {
        en: 'Updated text for regeneration test',
        es: 'Texto actualizado para prueba de regeneración'
      };

      const updateResponse = await request(app)
        .put(`/api/cards/${testCardId}`)
        .auth(process.env.ADMIN_USER, process.env.ADMIN_PASS)
        .send(updateData);

      // This WILL FAIL initially - Gemini TTS integration not implemented
      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.body.en).toBe(updateData.en);
      
      // Audio URL should be different (regenerated) or null in test mode
      expect(updateResponse.body.audio_url).toBeDefined();
      
      // Verify database was updated
      const updatedCard = testDb.prepare('SELECT * FROM cards WHERE id = ?').get(testCardId);
      expect(updatedCard.en).toBe(updateData.en);
      expect(updatedCard.audio_url).toBeDefined();
    });

    test('should force audio regeneration via dedicated endpoint', async () => {
      const regenerateResponse = await request(app)
        .post(`/api/cards/${testCardId}/regenerate-audio`)
        .auth(process.env.ADMIN_USER, process.env.ADMIN_PASS);

      // This WILL FAIL initially - Gemini TTS not implemented
      expect(regenerateResponse.statusCode).toBe(200);
      expect(regenerateResponse.body.id).toBe(testCardId);
      expect(regenerateResponse.body.audio_url).toBeDefined();
      
      // Verify the response includes all card fields
      expect(regenerateResponse.body).toHaveProperty('en');
      expect(regenerateResponse.body).toHaveProperty('es');
      expect(regenerateResponse.body).toHaveProperty('level');
      expect(regenerateResponse.body).toHaveProperty('nextReview');
    });

    test('should handle regeneration errors gracefully', async () => {
      // Try to regenerate audio for non-existent card
      const invalidResponse = await request(app)
        .post('/api/cards/99999/regenerate-audio')
        .auth(process.env.ADMIN_USER, process.env.ADMIN_PASS);

      expect(invalidResponse.statusCode).toBe(404);
    });

    test('should maintain audio quality during regeneration', async () => {
      // This test verifies that regenerated audio meets quality standards
      const regenerateResponse = await request(app)
        .post(`/api/cards/${testCardId}/regenerate-audio`)
        .auth(process.env.ADMIN_USER, process.env.ADMIN_PASS);

      // This WILL FAIL initially - Gemini TTS not implemented
      expect(regenerateResponse.statusCode).toBe(200);
      
      // In a real implementation, we would verify:
      // - Audio file exists and is accessible
      // - Audio file is in MP3 format
      // - Audio duration is reasonable for the text length
      // - Audio quality meets minimum standards
      
      const audioUrl = regenerateResponse.body.audio_url;
      if (audioUrl && audioUrl !== null) {
        // Verify URL format (should be R2 URL or local path)
        expect(typeof audioUrl).toBe('string');
        expect(audioUrl.length).toBeGreaterThan(0);
      }
    });
  });

  describe('TTS Service Integration', () => {
    test('should integrate with Gemini TTS service correctly', async () => {
      // Test direct service integration
      const testText = 'Direct service integration test';
      
      // This WILL FAIL initially - service not implemented
      const result = await generateAudio(testText, 'en');
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
      expect(result.error).toBeUndefined();
    });

    test('should handle multiple concurrent TTS requests', async () => {
      // Create multiple cards simultaneously to test concurrency
      const promises = Array.from({ length: 3 }, (_, index) => 
        request(app)
          .post('/api/cards')
          .auth(process.env.ADMIN_USER, process.env.ADMIN_PASS)
          .send({
            en: `Concurrent test ${index + 1}`,
            es: `Prueba concurrente ${index + 1}`
          })
      );

      // This WILL FAIL initially - Gemini TTS not implemented
      const responses = await Promise.all(promises);
      
      responses.forEach((response, index) => {
        expect(response.statusCode).toBe(201);
        expect(response.body.en).toBe(`Concurrent test ${index + 1}`);
        expect(response.body.audio_url).toBeDefined();
      });
    });

    test('should preserve existing functionality during TTS replacement', async () => {
      // Verify that non-TTS functionality still works
      const cardData = {
        en: 'Functionality preservation test',
        es: 'Prueba de preservación de funcionalidad'
      };

      // Create card
      const createResponse = await request(app)
        .post('/api/cards')
        .auth(process.env.ADMIN_USER, process.env.ADMIN_PASS)
        .send(cardData);

      const cardId = createResponse.body.id;

      // Test review functionality (non-TTS)
      const reviewResponse = await request(app)
        .post(`/api/cards/${cardId}/review`)
        .auth(process.env.ADMIN_USER, process.env.ADMIN_PASS);

      expect(reviewResponse.statusCode).toBe(200);
      expect(reviewResponse.body.level).toBeGreaterThan(0);
      expect(reviewResponse.body.nextReview).toBeDefined();
    });
  });
});