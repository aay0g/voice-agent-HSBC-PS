const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const SpeechService = require('./SpeechService');

class VoiceAssistant {
  constructor(geminiService) {
    this.geminiService = geminiService;
    this.speechService = new SpeechService();
    this.activeSessions = new Map();
    this.audioBuffers = new Map();
    this.isProcessing = new Map();
    this.processingIntervals = new Map();
    this.silenceTimers = new Map();
  }

  async startSession(sessionId, socket) {
    try {
      console.log(`🎤 Starting voice session for ${sessionId}`);
      
      this.activeSessions.set(sessionId, {
        socket,
        startTime: Date.now(),
        isActive: true,
        lastActivity: Date.now()
      });

      this.audioBuffers.set(sessionId, []);
      this.isProcessing.set(sessionId, false);

      socket.emit('sessionStarted', {
        sessionId,
        timestamp: Date.now()
      });

      console.log(`✅ Voice session started for ${sessionId}`);
    } catch (error) {
      console.error('Error starting voice session:', error);
      throw error;
    }
  }

  async processAudioData(sessionId, data) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session || !session.isActive) {
        return;
      }

      session.lastActivity = Date.now();

      const audioBuffer = this.audioBuffers.get(sessionId) || [];
      audioBuffer.push(data.audio);
      this.audioBuffers.set(sessionId, audioBuffer);

    } catch (error) {
      console.error('Error processing audio data:', error);
      throw error;
    }
  }

  async processAudioBuffer(sessionId) {
    try {
      if (this.isProcessing.get(sessionId)) {
        return;
      }

      const session = this.activeSessions.get(sessionId);
      const audioBuffer = this.audioBuffers.get(sessionId);

      if (!session || !audioBuffer || audioBuffer.length === 0) {
        return;
      }

      if (audioBuffer.length < 1) {
        return;
      }

      this.isProcessing.set(sessionId, true);

      const combinedAudio = audioBuffer.join('');
      
      const transcribedText = await this.speechService.transcribeAudio(combinedAudio);

      if (transcribedText && transcribedText.trim() && transcribedText !== "Hello, how can I help you today?") {
        console.log(`🎤 Transcribed for ${sessionId}:`, transcribedText);

        session.socket.emit('transcription', {
          text: transcribedText,
          timestamp: Date.now()
        });

        await this.generateStreamingResponse(sessionId, transcribedText);
      }

      this.audioBuffers.set(sessionId, []);
      this.isProcessing.set(sessionId, false);

    } catch (error) {
      console.error('Error processing audio buffer:', error);
      this.isProcessing.set(sessionId, false);
    }
  }

  async generateStreamingResponse(sessionId, userMessage) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) return;

      let fullResponse = '';
      let responseChunks = [];

      try {
        await this.geminiService.generateStreamingResponse(
          userMessage,
          (chunk) => {
            fullResponse += chunk;
            responseChunks.push(chunk);
            
            session.socket.emit('responseChunk', {
              chunk,
              timestamp: Date.now()
            });
          }
        );

        session.socket.emit('responseComplete', {
          text: fullResponse,
          timestamp: Date.now()
        });

        await this.textToSpeech(fullResponse, session.socket);
      } catch (geminiError) {
        console.error('Gemini API error:', geminiError);
        
        const fallbackResponse = `I heard you say: "${userMessage}". I'm here to help you!`;
        
        session.socket.emit('responseChunk', {
          chunk: fallbackResponse,
          timestamp: Date.now()
        });
        
        session.socket.emit('responseComplete', {
          text: fallbackResponse,
          timestamp: Date.now()
        });
        
        await this.textToSpeech(fallbackResponse, session.socket);
      }

    } catch (error) {
      console.error('Error generating streaming response:', error);
      if (session && session.socket) {
        session.socket.emit('error', { message: 'Failed to generate response' });
      }
    }
  }

  async textToSpeech(text, socket) {
    try {
      const audioData = await this.speechService.textToSpeech(text);
      
      socket.emit('audioResponse', {
        audio: audioData,
        text: text,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Error converting text to speech:', error);
    }
  }

  async stopSession(sessionId) {
    try {
      console.log(`🛑 Stopping voice session for ${sessionId}`);
      
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.isActive = false;
        
        await this.processAudioBuffer(sessionId);
        
        session.socket.emit('sessionStopped', {
          sessionId,
          timestamp: Date.now()
        });
      }

      if (this.processingIntervals.has(sessionId)) {
        clearInterval(this.processingIntervals.get(sessionId));
        this.processingIntervals.delete(sessionId);
      }

      if (this.silenceTimers.has(sessionId)) {
        clearTimeout(this.silenceTimers.get(sessionId));
        this.silenceTimers.delete(sessionId);
      }

      this.activeSessions.delete(sessionId);
      this.audioBuffers.delete(sessionId);
      this.isProcessing.delete(sessionId);

      console.log(`✅ Voice session stopped for ${sessionId}`);
    } catch (error) {
      console.error('Error stopping voice session:', error);
      throw error;
    }
  }

  getActiveSessions() {
    return Array.from(this.activeSessions.keys());
  }

  getSessionInfo(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    return {
      sessionId,
      startTime: session.startTime,
      duration: Date.now() - session.startTime,
      isActive: session.isActive,
      bufferSize: this.audioBuffers.get(sessionId)?.length || 0,
      lastActivity: session.lastActivity
    };
  }
}

module.exports = VoiceAssistant; 