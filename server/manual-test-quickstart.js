#!/usr/bin/env node

/**
 * T030: Manual Test Quickstart Scenarios
 * 
 * This script provides step-by-step manual testing scenarios
 * to verify the Gemini TTS integration is working correctly.
 * 
 * Run with: node server/manual-test-quickstart.js
 */

import { generateAudio } from './services/gemini-tts.js';

console.log('🧪 Manual Test Quickstart for Gemini TTS Integration');
console.log('='.repeat(60));

console.log(`
📋 MANUAL TESTING CHECKLIST

Pre-requisites:
□ Environment variables set:
  - GEMINI_API_KEY (for TTS functionality)
  - R2_* variables (for audio storage)
  - ADMIN_USER, ADMIN_PASS (for admin access)

□ Server running: npm run server (http://localhost:4000)
□ Frontend running: npm run client (http://localhost:5173)

🎯 SCENARIO 1: Basic TTS Functionality
Steps:
1. Open admin panel: http://localhost:5173/admin
2. Login with admin credentials
3. Create a new flashcard:
   - English: "Hello world"
   - Spanish: "Hola mundo"
4. Click "Add Card"
5. Verify audio icon appears next to the card
6. Click the audio icon to play TTS audio

Expected Results:
□ Card created successfully
□ Audio generation completes within 3 seconds
□ Audio plays clear pronunciation
□ No errors in browser console

🎯 SCENARIO 2: Multi-language Support
Steps:
1. Create cards with various text:
   - English: "The quick brown fox jumps over the lazy dog"
   - Spanish: "El perro marrón salta sobre el gato perezoso"
2. Generate audio for each
3. Play and verify pronunciation quality

Expected Results:
□ Both English and Spanish audio generate successfully
□ Clear pronunciation for both languages
□ Natural-sounding voice quality

🎯 SCENARIO 3: Audio Regeneration
Steps:
1. Find an existing card with audio
2. Click "Regenerate Audio" button
3. Wait for completion
4. Play the new audio

Expected Results:
□ Audio regenerates successfully
□ New audio file replaces old one
□ Quality remains consistent

🎯 SCENARIO 4: Error Handling
Steps:
1. Temporarily disable GEMINI_API_KEY (comment out in .env)
2. Restart server
3. Try creating a new card
4. Check error handling

Expected Results:
□ Graceful error message displayed
□ Card created without audio (audio_url: null)
□ No application crash
□ Clear error indication in UI

🎯 SCENARIO 5: Performance Testing
Steps:
1. Create 5 cards quickly in succession
2. Monitor response times
3. Check server logs for performance metrics

Expected Results:
□ Each TTS generation completes within 3 seconds
□ No degradation in concurrent requests
□ Structured logging shows performance metrics
□ Audio quality remains consistent

🎯 SCENARIO 6: Frontend Integration
Steps:
1. Go to home page (flashcard review)
2. Review cards with audio
3. Play audio during card review
4. Verify audio controls work properly

Expected Results:
□ Audio plays smoothly during review
□ Controls respond correctly
□ No audio playback issues
□ Seamless user experience

🔧 TROUBLESHOOTING GUIDE

If TTS fails:
1. Check GEMINI_API_KEY is set correctly
2. Verify API key has TTS permissions
3. Check server logs for detailed error messages
4. Ensure internet connectivity for Gemini API

If audio doesn't play:
1. Check browser console for errors
2. Verify R2 storage configuration
3. Test audio URL accessibility
4. Check audio file format (should be WAV)

If performance is slow:
1. Check network connection to Gemini API
2. Monitor server resource usage
3. Review TTS request sizes (large text = slower)
4. Check concurrent request handling

📊 SUCCESS CRITERIA SUMMARY

□ All 6 scenarios pass without critical issues
□ TTS generation consistently under 3 seconds
□ Clear audio quality for both languages
□ Graceful error handling when API unavailable
□ No breaking changes to existing functionality
□ Seamless user experience maintained

🎉 COMPLETION

After completing all scenarios:
□ Document any issues found
□ Verify all functionality works as expected
□ Confirm performance meets requirements (<3s)
□ Test rollback procedure if needed
□ Mark Gemini TTS integration as production-ready

`);

async function runAutomatedQuickTest() {
  console.log('\n🤖 Running Automated Quick Test...\n');

  // Test basic functionality
  console.log('Testing basic TTS generation...');
  try {
    const result = await generateAudio('Hello world test', 'en');
    if (result.success) {
      console.log('✅ TTS generation successful');
      console.log(`   Audio buffer size: ${result.audioBuffer?.length || 0} bytes`);
    } else {
      console.log('❌ TTS generation failed:', result.error);
      console.log('   This is expected in test environment without real API key');
    }
  } catch (error) {
    console.log('❌ TTS test error:', error.message);
    console.log('   This is expected in test environment without real API key');
  }

  console.log('\n📋 Please complete the manual testing scenarios above');
  console.log('   For full testing, ensure GEMINI_API_KEY is configured');
}

// Run automated test if called directly
if (process.argv[1] && process.argv[1].includes('manual-test-quickstart.js')) {
  runAutomatedQuickTest().catch(console.error);
}

export { runAutomatedQuickTest };