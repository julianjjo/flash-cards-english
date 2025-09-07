import { 
  generateAudio, 
  convertToMp3, 
  parseAudioMimeType, 
  convertToWav 
} from './gemini-tts.js';

describe('Gemini TTS Service - Unit Tests', () => {
  
  beforeAll(() => {
    // Set up environment for testing
    process.env.GEMINI_API_KEY = 'test-api-key-123';
  });

  // T007: Unit test Gemini TTS service
  describe('generateAudio function', () => {
    test('should generate audio for English text', async () => {
      const result = await generateAudio('Hello world', 'en');
      
      // This WILL FAIL initially - that's expected for TDD
      expect(result.success).toBe(true);
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
      expect(result.audioBuffer.length).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    test('should generate audio for Spanish text', async () => {
      const result = await generateAudio('Hola mundo', 'es');
      
      // This WILL FAIL initially - that's expected for TDD  
      expect(result.success).toBe(true);
      expect(result.audioBuffer).toBeInstanceOf(Buffer);
      expect(result.error).toBeUndefined();
    });

    test('should use default voice when not specified', async () => {
      const result = await generateAudio('Test text', 'en');
      
      // This WILL FAIL initially - service not implemented yet
      expect(result.success).toBe(true);
      expect(result.audioBuffer).toBeDefined();
    });

    test('should accept custom voice parameter', async () => {
      const result = await generateAudio('Test text', 'en', 'CustomVoice');
      
      // This WILL FAIL initially - service not implemented yet
      expect(result.success).toBe(true);
      expect(result.audioBuffer).toBeDefined();
    });
  });

  // T008: Unit test audio conversion to MP3
  describe('convertToMp3 function', () => {
    test('should convert audio chunks to MP3 format', async () => {
      const mockAudioChunks = [
        Buffer.from('mock audio data 1'),
        Buffer.from('mock audio data 2')
      ];
      const mockMimeType = 'audio/L16;rate=24000';

      // This WILL FAIL initially - conversion not implemented
      const result = await convertToMp3(mockAudioChunks, mockMimeType);
      
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle different audio formats', async () => {
      const mockChunks = [Buffer.from('test audio')];
      const mimeType = 'audio/L16;rate=16000';

      // This WILL FAIL initially - conversion not implemented
      const result = await convertToMp3(mockChunks, mimeType);
      
      expect(result).toBeInstanceOf(Buffer);
    });

    test('should preserve audio quality during conversion', async () => {
      const mockChunks = [Buffer.from('high quality audio data')];
      const mimeType = 'audio/L16;rate=44100';

      // This WILL FAIL initially - conversion not implemented
      const result = await convertToMp3(mockChunks, mimeType);
      
      expect(result.length).toBeGreaterThan(mockChunks[0].length);
    });
  });

  // T009: Unit test error handling
  describe('Error handling', () => {
    test('generateAudio should handle missing API key', async () => {
      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const result = await generateAudio('Test text', 'en');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('GEMINI_API_KEY');
      expect(result.audioBuffer).toBeUndefined();

      // Restore API key
      process.env.GEMINI_API_KEY = originalKey;
    });

    test('generateAudio should handle invalid text input', async () => {
      const result = await generateAudio('', 'en');

      // This test will initially pass because error handling works
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('generateAudio should handle network errors', async () => {
      // Mock a network failure scenario
      const result = await generateAudio('Test network error', 'en');

      // This WILL FAIL initially - but error handling should be consistent
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toBe('Error generando audio');
    });

    test('convertToMp3 should handle invalid audio data', async () => {
      const invalidChunks = [Buffer.from('')];
      const mimeType = 'invalid/mime-type';

      // This should throw an error
      await expect(convertToMp3(invalidChunks, mimeType)).rejects.toThrow();
    });

    test('convertToMp3 should handle malformed MIME types', async () => {
      const chunks = [Buffer.from('audio data')];
      const badMimeType = 'not-a-mime-type';

      // This should throw an error
      await expect(convertToMp3(chunks, badMimeType)).rejects.toThrow();
    });
  });

  describe('parseAudioMimeType function', () => {
    test('should parse rate from MIME type', () => {
      const mimeType = 'audio/L16;rate=24000';
      const result = parseAudioMimeType(mimeType);
      
      expect(result.rate).toBe(24000);
      expect(result.bitsPerSample).toBe(16);
    });

    test('should parse bits per sample from MIME type', () => {
      const mimeType = 'audio/L24;rate=48000';
      const result = parseAudioMimeType(mimeType);
      
      expect(result.bitsPerSample).toBe(24);
      expect(result.rate).toBe(48000);
    });

    test('should use defaults for invalid MIME type', () => {
      const mimeType = 'audio/invalid';
      const result = parseAudioMimeType(mimeType);
      
      expect(result.rate).toBe(24000);
      expect(result.bitsPerSample).toBe(16);
    });
  });

  describe('convertToWav function', () => {
    test('should create WAV header with correct format', () => {
      const audioData = Buffer.from('test audio data');
      const mimeType = 'audio/L16;rate=24000';
      
      const result = convertToWav(audioData, mimeType);
      
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(44 + audioData.length); // 44 bytes header + data
      
      // Check WAV header
      expect(result.subarray(0, 4).toString()).toBe('RIFF');
      expect(result.subarray(8, 12).toString()).toBe('WAVE');
      expect(result.subarray(12, 16).toString()).toBe('fmt ');
      expect(result.subarray(36, 40).toString()).toBe('data');
    });

    test('should handle different sample rates', () => {
      const audioData = Buffer.from('test audio');
      const mimeType = 'audio/L16;rate=44100';
      
      const result = convertToWav(audioData, mimeType);
      
      expect(result.length).toBe(44 + audioData.length);
      
      // Check sample rate in header (offset 24, 4 bytes little-endian)
      const sampleRate = result.readUInt32LE(24);
      expect(sampleRate).toBe(44100);
    });
  });
});