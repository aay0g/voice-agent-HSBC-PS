class VoiceRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.socket = null;
    this.stream = null;
  }

  async startRecording(socket) {
    try {
      this.socket = socket;
      
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 8000, // Reduced from 16000 for faster processing
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // Create MediaRecorder with better settings for lower latency
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 64000 // Reduced from 128000 for faster transmission
      });

      this.audioChunks = [];
      this.isRecording = true;

      // Handle data available event
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          this.sendAudioChunk(event.data);
        }
      };

      // Start recording with smaller chunks for real-time processing
      this.mediaRecorder.start(200); // Collect data every 200ms instead of 500ms
      
      console.log('🎤 Recording started');
      return true;
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      
      // Stop all tracks
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }
      
      console.log('🛑 Recording stopped');
    }
  }

  async sendAudioChunk(audioBlob) {
    if (!this.socket) return;

    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      // Send to server
      this.socket.emit('audioData', {
        audio: base64Audio,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error sending audio chunk:', error);
    }
  }

  isActive() {
    return this.isRecording;
  }
}

// Audio playback for responses
class AudioPlayer {
  constructor() {
    this.audioContext = null;
    this.audioQueue = [];
    this.isPlaying = false;
  }

  async init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('🔊 Audio context initialized');
    } catch (error) {
      console.error('Error initializing audio context:', error);
    }
  }

  async playAudio(base64Audio) {
    try {
      if (!this.audioContext) {
        await this.init();
      }

      // Decode base64 audio
      const audioData = atob(base64Audio);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i);
      }

      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Create source and play
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start(0);
      
      console.log('🔊 Playing audio response');
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }
}

// Voice Assistant Controller
class VoiceAssistantController {
  constructor() {
    this.recorder = new VoiceRecorder();
    this.player = new AudioPlayer();
    this.socket = null;
    this.isConnected = false;
    this.isVoiceActive = false;
  }

  async connect() {
    try {
      this.socket = io();
      
      this.socket.on('connect', () => {
        this.isConnected = true;
        this.updateUI('connected');
        console.log('✅ Connected to server');
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        this.isVoiceActive = false;
        this.updateUI('disconnected');
        this.recorder.stopRecording();
        console.log('❌ Disconnected from server');
      });

      this.socket.on('sessionStarted', (data) => {
        this.isVoiceActive = true;
        this.updateUI('voice-active');
        console.log('🎤 Voice session started');
      });

      this.socket.on('sessionStopped', (data) => {
        this.isVoiceActive = false;
        this.updateUI('voice-inactive');
        this.recorder.stopRecording();
        console.log('🛑 Voice session stopped');
      });

      this.socket.on('transcription', (data) => {
        this.displayTranscription(data.text);
      });

      this.socket.on('responseChunk', (data) => {
        this.displayStreamingResponse(data.chunk);
      });

      this.socket.on('responseComplete', (data) => {
        // Remove streaming cursor and convert to regular message
        const streamingMessage = document.getElementById('conversation').querySelector('.message.streaming');
        if (streamingMessage) {
          streamingMessage.classList.remove('streaming');
          const streamingText = streamingMessage.querySelector('.streaming-text');
          const cursor = streamingMessage.querySelector('.cursor');
          if (streamingText && cursor) {
            streamingText.textContent += cursor.textContent;
            cursor.remove();
          }
        }
        
        // Only display text, no audio playback
        console.log('🤖 Gemini Response:', data.text);
      });

      this.socket.on('audioResponse', (data) => {
        this.player.playAudio(data.audio);
      });

      this.socket.on('error', (data) => {
        this.showError(data.message);
      });

    } catch (error) {
      console.error('Error connecting:', error);
      this.showError('Failed to connect to server');
    }
  }

  async startVoice() {
    if (!this.isConnected) {
      this.showError('Not connected to server');
      return;
    }

    try {
      await this.recorder.startRecording(this.socket);
      this.socket.emit('startVoiceStream');
      this.updateUI('recording');
    } catch (error) {
      console.error('Error starting voice:', error);
      this.showError('Failed to start voice recording');
    }
  }

  stopVoice() {
    this.recorder.stopRecording();
    if (this.socket) {
      this.socket.emit('stopVoiceStream');
    }
    this.updateUI('voice-inactive');
  }

  updateUI(state) {
    const statusEl = document.getElementById('status');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');

    switch (state) {
      case 'connected':
        statusEl.textContent = 'Connected to server';
        statusEl.className = 'status connected';
        startBtn.disabled = false;
        break;
      case 'disconnected':
        statusEl.textContent = 'Disconnected from server';
        statusEl.className = 'status disconnected';
        startBtn.disabled = true;
        stopBtn.disabled = true;
        break;
      case 'voice-active':
        startBtn.disabled = true;
        stopBtn.disabled = false;
        break;
      case 'voice-inactive':
        startBtn.disabled = false;
        stopBtn.disabled = true;
        break;
      case 'recording':
        statusEl.textContent = 'Recording... Speak now!';
        break;
    }
  }

  displayTranscription(text) {
    const conversationEl = document.getElementById('conversation');
    const messageEl = document.createElement('div');
    messageEl.className = 'message transcription';
    messageEl.innerHTML = `
      <div>🎤 You said: ${text}</div>
      <div class="timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    conversationEl.appendChild(messageEl);
    conversationEl.scrollTop = conversationEl.scrollHeight;
  }

  displayResponse(text) {
    const conversationEl = document.getElementById('conversation');
    const messageEl = document.createElement('div');
    messageEl.className = 'message assistant';
    messageEl.innerHTML = `
      <div>🤖 ${text}</div>
      <div class="timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    conversationEl.appendChild(messageEl);
    conversationEl.scrollTop = conversationEl.scrollHeight;
  }

  displayStreamingResponse(chunk) {
    const conversationEl = document.getElementById('conversation');
    
    // Check if we already have a streaming message
    let streamingMessage = conversationEl.querySelector('.message.streaming');
    
    if (!streamingMessage) {
      // Create new streaming message
      streamingMessage = document.createElement('div');
      streamingMessage.className = 'message assistant streaming';
      streamingMessage.innerHTML = `
        <div class="streaming-content">🤖 <span class="streaming-text"></span><span class="cursor">|</span></div>
        <div class="timestamp">${new Date().toLocaleTimeString()}</div>
      `;
      conversationEl.appendChild(streamingMessage);
    }
    
    // Add chunk to streaming text
    const streamingText = streamingMessage.querySelector('.streaming-text');
    streamingText.textContent += chunk;
    
    conversationEl.scrollTop = conversationEl.scrollHeight;
  }

  showError(message) {
    const errorEl = document.getElementById('error');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    
    setTimeout(() => {
      errorEl.style.display = 'none';
    }, 5000);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const controller = new VoiceAssistantController();
  
  // Connect automatically
  controller.connect();
  
  // Set up button event listeners
  document.getElementById('startBtn').addEventListener('click', () => {
    controller.startVoice();
  });
  
  document.getElementById('stopBtn').addEventListener('click', () => {
    controller.stopVoice();
  });
  
  // Make controller globally available for debugging
  window.voiceController = controller;
}); 