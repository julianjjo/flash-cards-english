#!/usr/bin/env node

import { generateAudio } from './services/gemini-tts.js';
import fs from 'fs';
import path from 'path';

/**
 * T026: Audio Quality Manual Validation Script
 * 
 * This script generates test audio files for manual quality validation.
 * Run with: node server/audio-quality-validation.js
 * 
 * Validates:
 * - Audio format (WAV with proper headers)
 * - Sample rate and bit depth
 * - File size reasonableness
 * - Multi-language support
 */

const TEST_PHRASES = [
  { text: 'Hello, this is a test of the Gemini text-to-speech system.', language: 'en', filename: 'test_en_hello.wav' },
  { text: 'The quick brown fox jumps over the lazy dog.', language: 'en', filename: 'test_en_pangram.wav' },
  { text: 'Hola, esta es una prueba del sistema de texto a voz de Gemini.', language: 'es', filename: 'test_es_hola.wav' },
  { text: 'El perro marrón salta sobre el gato perezoso.', language: 'es', filename: 'test_es_phrase.wav' },
  { text: 'Numbers: one, two, three, four, five.', language: 'en', filename: 'test_en_numbers.wav' },
  { text: 'Números: uno, dos, tres, cuatro, cinco.', language: 'es', filename: 'test_es_numeros.wav' }
];

async function validateAudioQuality() {
  console.log('🎵 Starting Audio Quality Validation for Gemini TTS');
  console.log('='.repeat(60));

  const outputDir = path.join(process.cwd(), 'temp_audio_validation');
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created output directory: ${outputDir}`);
  }

  const results = [];

  for (const testCase of TEST_PHRASES) {
    console.log(`\n🔊 Testing: "${testCase.text}" (${testCase.language})`);
    
    try {
      const startTime = Date.now();
      const result = await generateAudio(testCase.text, testCase.language);
      const duration = Date.now() - startTime;

      if (result.success && result.audioBuffer) {
        const filePath = path.join(outputDir, testCase.filename);
        fs.writeFileSync(filePath, result.audioBuffer);

        // Validate WAV format
        const validation = validateWavFormat(result.audioBuffer);
        
        const testResult = {
          text: testCase.text,
          language: testCase.language,
          filename: testCase.filename,
          success: true,
          duration: `${duration}ms`,
          fileSize: `${result.audioBuffer.length} bytes`,
          format: validation,
          filePath
        };

        results.push(testResult);

        console.log(`  ✅ Generated successfully`);
        console.log(`  ⏱️  Duration: ${duration}ms`);
        console.log(`  📦 File size: ${result.audioBuffer.length} bytes`);
        console.log(`  🎼 Format: ${validation.format} (${validation.sampleRate}Hz, ${validation.bitsPerSample}-bit)`);
        console.log(`  💾 Saved to: ${filePath}`);

      } else {
        const testResult = {
          text: testCase.text,
          language: testCase.language,
          filename: testCase.filename,
          success: false,
          error: result.error || 'Unknown error',
          duration: `${duration}ms`
        };

        results.push(testResult);

        console.log(`  ❌ Failed: ${result.error || 'Unknown error'}`);
        console.log(`  ⏱️  Duration: ${duration}ms`);
      }

    } catch (error) {
      console.log(`  💥 Error: ${error.message}`);
      
      results.push({
        text: testCase.text,
        language: testCase.language,
        filename: testCase.filename,
        success: false,
        error: error.message
      });
    }
  }

  // Generate validation report
  generateValidationReport(results, outputDir);

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Audio Quality Validation Complete');
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  if (successful > 0) {
    console.log(`✅ ${successful}/${total} tests generated audio successfully`);
    console.log(`📁 Audio files saved to: ${outputDir}`);
    console.log('🎧 Manual validation steps:');
    console.log('   1. Play each audio file to verify clarity');
    console.log('   2. Check pronunciation accuracy for both languages');
    console.log('   3. Verify consistent volume levels');
    console.log('   4. Ensure no distortion or artifacts');
  } else {
    console.log(`⚠️  No audio files generated (likely missing GEMINI_API_KEY)`);
    console.log('💡 To test with real API:');
    console.log('   export GEMINI_API_KEY=your-api-key');
    console.log('   node server/audio-quality-validation.js');
  }
}

function validateWavFormat(audioBuffer) {
  try {
    // Check WAV header
    const riff = audioBuffer.subarray(0, 4).toString();
    const wave = audioBuffer.subarray(8, 12).toString();
    const fmt = audioBuffer.subarray(12, 16).toString();
    
    if (riff !== 'RIFF' || wave !== 'WAVE' || fmt !== 'fmt ') {
      return { format: 'Invalid WAV format', valid: false };
    }

    // Extract audio parameters from WAV header
    const audioFormat = audioBuffer.readUInt16LE(20);
    const numChannels = audioBuffer.readUInt16LE(22);
    const sampleRate = audioBuffer.readUInt32LE(24);
    const bitsPerSample = audioBuffer.readUInt16LE(34);

    return {
      format: 'WAV',
      valid: true,
      audioFormat: audioFormat === 1 ? 'PCM' : `Format ${audioFormat}`,
      numChannels,
      sampleRate,
      bitsPerSample,
      fileSize: audioBuffer.length
    };

  } catch (error) {
    return { format: 'Format validation error', valid: false, error: error.message };
  }
}

function generateValidationReport(results, outputDir) {
  const reportPath = path.join(outputDir, 'validation_report.json');
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    },
    results
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📊 Validation report saved to: ${reportPath}`);
}

// Run validation if called directly
if (process.argv[1] && process.argv[1].includes('audio-quality-validation.js')) {
  validateAudioQuality().catch(console.error);
}

export { validateAudioQuality, validateWavFormat };