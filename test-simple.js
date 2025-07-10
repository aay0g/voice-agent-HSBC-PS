#!/usr/bin/env node

console.log('🧪 Testing Voice Assistant Components...\n');

async function testGemini() {
  console.log('1. Testing Gemini Service...');
  try {
    const GeminiService = require('./services/GeminiService');
    const gemini = new GeminiService();
    
    const response = await gemini.generateResponse('Hello, how are you?');
    console.log('✅ Gemini Response:', response);
    
    return true;
  } catch (error) {
    console.log('❌ Gemini Error:', error.message);
    return false;
  }
}

async function testSpeech() {
  console.log('\n2. Testing Speech Service...');
  try {
    const SpeechService = require('./services/SpeechService');
    const speech = new SpeechService();
    
    const transcription = await speech.transcribeAudio('mock_audio');
    console.log('✅ Transcription:', transcription);
    
    const audio = await speech.textToSpeech('Hello world');
    console.log('✅ TTS Audio length:', audio.length);
    
    return true;
  } catch (error) {
    console.log('❌ Speech Error:', error.message);
    return false;
  }
}

async function testVoiceAssistant() {
  console.log('\n3. Testing Voice Assistant...');
  try {
    const GeminiService = require('./services/GeminiService');
    const VoiceAssistant = require('./services/VoiceAssistant');
    
    const gemini = new GeminiService();
    const voice = new VoiceAssistant(gemini);
    
    console.log('✅ Voice Assistant initialized');
    console.log('✅ Active sessions:', voice.getActiveSessions());
    
    return true;
  } catch (error) {
    console.log('❌ Voice Assistant Error:', error.message);
    return false;
  }
}

async function runAllTests() {
  const results = [];
  
  results.push(await testGemini());
  results.push(await testSpeech());
  results.push(await testVoiceAssistant());
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${results.filter(r => r).length}/3`);
  console.log(`❌ Failed: ${results.filter(r => !r).length}/3`);
  
  if (results.every(r => r)) {
    console.log('\n🎉 All tests passed! Voice assistant should work.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
  }
}

runAllTests().catch(console.error); 