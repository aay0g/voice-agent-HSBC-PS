const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const VoiceAssistant = require('./services/VoiceAssistant');
const GeminiService = require('./services/GeminiService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const geminiService = new GeminiService();
const voiceAssistant = new VoiceAssistant(geminiService);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('startVoiceStream', async (data) => {
    try {
      console.log('Starting voice stream for client:', socket.id);
      await voiceAssistant.startSession(socket.id, socket);
    } catch (error) {
      console.error('Error starting voice stream:', error);
      socket.emit('error', { message: 'Failed to start voice stream' });
    }
  });

  socket.on('audioData', async (data) => {
    try {
      await voiceAssistant.processAudioData(socket.id, data);
    } catch (error) {
      console.error('Error processing audio data:', error);
      socket.emit('error', { message: 'Failed to process audio data' });
    }
  });

  socket.on('stopVoiceStream', async () => {
    try {
      console.log('Stopping voice stream for client:', socket.id);
      await voiceAssistant.stopSession(socket.id);
    } catch (error) {
      console.error('Error stopping voice stream:', error);
      socket.emit('error', { message: 'Failed to stop voice stream' });
    }
  });

  socket.on('textMessage', async (data) => {
    try {
      console.log('📝 Received text message:', data.message);
      const response = await geminiService.generateResponse(data.message, true);
      socket.emit('textResponse', { message: response });
      console.log('🤖 Sent response:', response);
    } catch (error) {
      console.error('Error processing text message:', error);
      socket.emit('error', { message: 'Failed to process text message' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    voiceAssistant.stopSession(socket.id);
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    activeConnections: io.engine.clientsCount
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    connections: io.engine.clientsCount,
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Voice Assistant Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
  console.log(`🌐 Health check available at http://localhost:${PORT}/health`);
}); 