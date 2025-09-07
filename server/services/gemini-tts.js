import { GoogleGenAI } from '@google/genai';

/**
 * Gemini Text-to-Speech Service
 * Replaces ElevenLabs TTS while maintaining identical API behavior
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TTS_MODEL = 'gemini-2.5-pro-preview-tts';
const DEFAULT_VOICE = 'Zephyr';

/**
 * Initialize Gemini client
 */
function createGeminiClient() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  
  return new GoogleGenAI({
    api_key: GEMINI_API_KEY,
  });
}

/**
 * Generate audio using Gemini TTS
 * @param {string} text - Text to convert to speech
 * @param {string} language - Language code ('en' or 'es')
 * @param {string} voice - Voice name (default: 'Zephyr')
 * @returns {Promise<{success: boolean, audioBuffer?: Buffer, error?: string}>}
 */
export async function generateAudio(text, language = 'en', voice = DEFAULT_VOICE) {
  const startTime = Date.now();
  const logContext = {
    service: 'gemini-tts',
    textLength: text?.length || 0,
    language,
    voice,
    timestamp: new Date().toISOString()
  };

  try {
    console.log('[Gemini TTS] Starting audio generation', logContext);
    
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for audio generation');
    }

    const client = createGeminiClient();
    
    // Create generation config for TTS
    const generateContentConfig = {
      temperature: 1,
      response_modalities: ['audio'],
      speech_config: {
        voice_config: {
          prebuilt_voice_config: {
            voice_name: voice
          }
        }
      }
    };

    // Create content request
    const contents = [{
      role: 'user',
      parts: [{
        text: text
      }]
    }];

    // Collect audio chunks from streaming response
    const audioChunks = [];
    let mimeType = 'audio/L16;rate=24000'; // Default MIME type
    let chunkCount = 0;

    console.log('[Gemini TTS] Starting streaming request', { ...logContext, model: TTS_MODEL });

    for await (const chunk of client.models.generate_content_stream(
      TTS_MODEL,
      contents,
      generateContentConfig
    )) {
      if (chunk.candidates && 
          chunk.candidates[0] && 
          chunk.candidates[0].content && 
          chunk.candidates[0].content.parts) {
        
        const part = chunk.candidates[0].content.parts[0];
        if (part.inline_data && part.inline_data.data) {
          chunkCount++;
          
          // Extract MIME type from the chunk
          if (part.inline_data.mime_type) {
            mimeType = part.inline_data.mime_type;
          }
          
          // Convert base64 data to buffer
          const chunkBuffer = Buffer.from(part.inline_data.data, 'base64');
          audioChunks.push(chunkBuffer);
          
          if (chunkCount % 5 === 0) {
            console.log('[Gemini TTS] Processed chunks', { 
              ...logContext, 
              chunkCount, 
              totalBytes: audioChunks.reduce((sum, chunk) => sum + chunk.length, 0),
              mimeType 
            });
          }
        }
      }
    }

    if (audioChunks.length === 0) {
      throw new Error('No audio data received from Gemini TTS');
    }

    console.log('[Gemini TTS] Converting audio format', { 
      ...logContext, 
      totalChunks: chunkCount,
      totalBytes: audioChunks.reduce((sum, chunk) => sum + chunk.length, 0),
      originalMimeType: mimeType
    });

    // Convert to MP3 format for compatibility
    const mp3Buffer = await convertToMp3(audioChunks, mimeType);

    const duration = Date.now() - startTime;
    console.log('[Gemini TTS] Audio generation completed', { 
      ...logContext, 
      duration: `${duration}ms`,
      finalSizeBytes: mp3Buffer.length,
      success: true
    });

    return {
      success: true,
      audioBuffer: mp3Buffer
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Gemini TTS ERROR] Audio generation failed', { 
      ...logContext, 
      duration: `${duration}ms`,
      error: error.message,
      success: false
    });
    
    return {
      success: false,
      error: error.message || 'Error generando audio'
    };
  }
}

/**
 * Convert raw audio to MP3 format
 * @param {Buffer[]} audioChunks - Raw audio chunks from Gemini
 * @param {string} mimeType - Original audio MIME type
 * @returns {Promise<Buffer>} - MP3 formatted audio buffer
 */
export async function convertToMp3(audioChunks, mimeType) {
  try {
    if (!audioChunks || audioChunks.length === 0) {
      throw new Error('No audio chunks provided for conversion');
    }

    // Combine all audio chunks into a single buffer
    const combinedAudio = Buffer.concat(audioChunks);
    
    // For now, we'll create a WAV file which is more widely supported
    // In a production environment, you might want to use ffmpeg or a dedicated library
    // to convert to actual MP3, but WAV works for our TTS use case
    const wavBuffer = convertToWav(combinedAudio, mimeType);
    
    // Return the WAV buffer (browsers can play WAV files)
    // Note: We're calling this MP3 for API compatibility, but it's actually WAV
    return wavBuffer;
    
  } catch (error) {
    console.error('[Audio Conversion ERROR]', error);
    throw error;
  }
}

/**
 * Parse audio MIME type to extract format parameters
 * @param {string} mimeType - Audio MIME type string
 * @returns {object} - Parsed audio parameters
 */
export function parseAudioMimeType(mimeType) {
  // Default values
  let bitsPerSample = 16;
  let rate = 24000;

  // Extract rate from parameters
  const parts = mimeType.split(';');
  for (const param of parts) {
    const trimmed = param.trim();
    if (trimmed.toLowerCase().startsWith('rate=')) {
      try {
        const rateStr = trimmed.split('=', 2)[1];
        rate = parseInt(rateStr);
      } catch (error) {
        // Keep default rate if parsing fails
      }
    } else if (trimmed.startsWith('audio/L')) {
      try {
        bitsPerSample = parseInt(trimmed.split('L', 2)[1]);
      } catch (error) {
        // Keep default bits per sample if parsing fails
      }
    }
  }

  return { bitsPerSample, rate };
}

/**
 * Create WAV file header for audio data
 * @param {Buffer} audioData - Raw audio data
 * @param {string} mimeType - Audio MIME type
 * @returns {Buffer} - WAV formatted audio with header
 */
export function convertToWav(audioData, mimeType) {
  const parameters = parseAudioMimeType(mimeType);
  const bitsPerSample = parameters.bitsPerSample;
  const sampleRate = parameters.rate;
  const numChannels = 1;
  const dataSize = audioData.length;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const chunkSize = 36 + dataSize; // 36 bytes for header fields before data chunk size

  // Create WAV header using Buffer operations instead of struct
  const header = Buffer.alloc(44);
  let offset = 0;
  
  // RIFF header
  header.write('RIFF', offset); offset += 4;
  header.writeUInt32LE(chunkSize, offset); offset += 4;
  header.write('WAVE', offset); offset += 4;
  
  // fmt sub-chunk
  header.write('fmt ', offset); offset += 4;
  header.writeUInt32LE(16, offset); offset += 4; // Sub-chunk 1 size (16 for PCM)
  header.writeUInt16LE(1, offset); offset += 2; // Audio format (1 for PCM)
  header.writeUInt16LE(numChannels, offset); offset += 2;
  header.writeUInt32LE(sampleRate, offset); offset += 4;
  header.writeUInt32LE(byteRate, offset); offset += 4;
  header.writeUInt16LE(blockAlign, offset); offset += 2;
  header.writeUInt16LE(bitsPerSample, offset); offset += 2;
  
  // data sub-chunk
  header.write('data', offset); offset += 4;
  header.writeUInt32LE(dataSize, offset);
  
  return Buffer.concat([header, audioData]);
}

export default {
  generateAudio,
  convertToMp3,
  parseAudioMimeType,
  convertToWav
};