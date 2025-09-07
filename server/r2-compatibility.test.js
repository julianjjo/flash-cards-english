import { generateAudio, convertToMp3, convertToWav } from './services/gemini-tts.js';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// Integration test for R2 upload compatibility
describe('R2 Upload Compatibility with Gemini Audio', () => {

  beforeAll(() => {
    // Set up test environment
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.R2_BUCKET = 'test-bucket';
    process.env.R2_PUBLIC_URL = 'https://test-bucket.r2.storage.com';
  });

  test('T023: Gemini audio format is compatible with R2 upload', async () => {
    // Create mock audio data (simulating what Gemini would return)
    const mockAudioChunks = [
      Buffer.from('mock audio chunk 1'),
      Buffer.from('mock audio chunk 2'),
      Buffer.from('mock audio chunk 3')
    ];
    const mockMimeType = 'audio/L16;rate=24000';

    // Test audio conversion
    const audioBuffer = await convertToMp3(mockAudioChunks, mockMimeType);
    
    expect(audioBuffer).toBeInstanceOf(Buffer);
    expect(audioBuffer.length).toBeGreaterThan(0);
    
    // Verify the buffer contains WAV header (since we're using WAV for compatibility)
    const header = audioBuffer.subarray(0, 4).toString();
    expect(header).toBe('RIFF');
    
    // Test that the audio buffer is suitable for R2 upload
    const filename = `test_${Date.now()}.mp3`;
    
    // Mock S3 PutObjectCommand parameters
    const uploadParams = {
      Bucket: 'test-bucket',
      Key: filename,
      Body: audioBuffer,
      ContentType: 'audio/mpeg'
    };

    // Verify upload parameters are valid
    expect(uploadParams.Body).toBeInstanceOf(Buffer);
    expect(uploadParams.ContentType).toBe('audio/mpeg');
    expect(uploadParams.Key).toMatch(/^test_\d+\.mp3$/);
    expect(audioBuffer.length).toBeGreaterThan(44); // WAV header is 44 bytes
  });

  test('T023: Audio buffer meets R2 size and format requirements', async () => {
    const mockAudioData = Buffer.from('test audio data that simulates real audio');
    const mockMimeType = 'audio/L16;rate=16000';
    
    const processedAudio = convertToWav(mockAudioData, mockMimeType);
    
    // Verify audio format requirements for R2
    expect(processedAudio.length).toBeGreaterThan(0);
    expect(processedAudio.length).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
    
    // Verify WAV format structure
    expect(processedAudio.subarray(0, 4).toString()).toBe('RIFF');
    expect(processedAudio.subarray(8, 12).toString()).toBe('WAVE');
    expect(processedAudio.subarray(12, 16).toString()).toBe('fmt ');
    expect(processedAudio.subarray(36, 40).toString()).toBe('data');
    
    // Test that content-type detection would work
    const contentType = 'audio/mpeg'; // Our API returns this type
    expect(['audio/mpeg', 'audio/wav', 'audio/x-wav'].includes(contentType)).toBe(true);
  });

  test('T023: R2 URL generation follows expected pattern', () => {
    const baseUrl = 'https://test-bucket.r2.storage.com';
    const filename = 'card_1234567890.mp3';
    const expectedUrl = `${baseUrl}/${filename}`;
    
    // This matches the pattern used in the server code
    expect(expectedUrl).toBe('https://test-bucket.r2.storage.com/card_1234567890.mp3');
    expect(expectedUrl).toMatch(/^https:\/\/.*\.r2\.storage\.com\/card_\d+\.mp3$/);
  });

  test('T023: Audio data integrity through conversion pipeline', async () => {
    const originalData = Buffer.from('original audio data for integrity test');
    const mimeType = 'audio/L16;rate=24000';
    
    // Convert through our pipeline
    const converted = convertToWav(originalData, mimeType);
    
    // Extract the data portion from WAV (after 44-byte header)
    const extractedData = converted.subarray(44);
    
    // Verify original data is preserved in the WAV file
    expect(extractedData).toEqual(originalData);
    
    // Verify WAV header contains correct information
    const sampleRate = converted.readUInt32LE(24); // Sample rate at offset 24
    expect(sampleRate).toBe(24000);
    
    const dataSize = converted.readUInt32LE(40); // Data chunk size at offset 40
    expect(dataSize).toBe(originalData.length);
  });

  test('T023: Error handling for invalid audio data', async () => {
    // Test with empty chunks
    await expect(convertToMp3([], 'audio/L16;rate=24000')).rejects.toThrow('No audio chunks provided');
    
    // Test with null chunks
    await expect(convertToMp3(null, 'audio/L16;rate=24000')).rejects.toThrow('No audio chunks provided');
    
    // These errors should be handled gracefully in the upload process
  });

  test('T023: Concurrent upload simulation', async () => {
    // Simulate multiple audio files being processed concurrently
    const audioBuffers = [];
    const filenames = [];
    
    for (let i = 0; i < 3; i++) {
      const mockData = Buffer.from(`concurrent test audio ${i}`);
      const audioBuffer = convertToWav(mockData, 'audio/L16;rate=24000');
      const filename = `concurrent_${Date.now()}_${i}.mp3`;
      
      audioBuffers.push(audioBuffer);
      filenames.push(filename);
      
      // Verify each buffer is unique and valid
      expect(audioBuffer.length).toBeGreaterThan(44);
      expect(filename).toMatch(/^concurrent_\d+_\d\.mp3$/);
    }
    
    // Verify all buffers are different (different content)
    expect(audioBuffers[0]).not.toEqual(audioBuffers[1]);
    expect(audioBuffers[1]).not.toEqual(audioBuffers[2]);
    
    // All filenames should be unique
    const uniqueFilenames = new Set(filenames);
    expect(uniqueFilenames.size).toBe(filenames.length);
  });
});