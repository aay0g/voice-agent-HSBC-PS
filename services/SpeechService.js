const axios = require('axios');
const fs = require('fs');
const path = require('path');

class SpeechService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.geminiApiKey = process.env.GEMINI_API_KEY;
  }

  async transcribeAudio(audioData) {
    try {
      if (!this.openaiApiKey) {
        console.log('No OpenAI API key provided, using mock transcription');
        return this.mockTranscription();
      }

      const audioBuffer = Buffer.from(audioData, 'base64');
      
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });
      form.append('model', 'whisper-1');

      const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          ...form.getHeaders()
        }
      });

      return response.data.text;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      return this.mockTranscription();
    }
  }

  async textToSpeech(text) {
    try {
      if (!this.openaiApiKey) {
        console.log('No OpenAI API key provided, using mock TTS');
        return this.mockTextToSpeech(text);
      }

      const response = await axios.post('https://api.openai.com/v1/audio/speech', {
        model: 'tts-1',
        input: text,
        voice: 'alloy',
        response_format: 'mp3',
        speed: 1.2
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data).toString('base64');
    } catch (error) {
      console.error('Error converting text to speech:', error);
      return this.mockTextToSpeech(text);
    }
  }

  mockTranscription() {
    const responses = [
      "Hello, how can I help you today?",
      "What would you like to know?",
      "I'm here to assist you.",
      "Tell me what you need help with.",
      "How may I be of service?",
      "What can I do for you?",
      "I'm ready to help.",
      "Please tell me what you need.",
      "How can I assist you?",
      "What would you like to ask?"
    ];
    
    const random = Math.random();
    if (random < 0.3) {
      return null;
    }
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  mockTextToSpeech(text) {
    return Buffer.from('mock_audio_data_for_' + text.substring(0, 10)).toString('base64');
  }
}

module.exports = SpeechService;