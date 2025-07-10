#!/usr/bin/env node

const io = require('socket.io-client');
const readline = require('readline');

console.log('CyberMitra Voice Assistant - Demo Mode\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const socket = io('http://localhost:3000');

let isConnected = false;
let isSessionActive = false;

socket.on('connect', () => {
  isConnected = true;
  console.log('Connected to server');
  showMenu();
});

socket.on('disconnect', () => {
  isConnected = false;
  isSessionActive = false;
  console.log('Disconnected from server');
});

socket.on('sessionStarted', (data) => {
  isSessionActive = true;
  console.log('Voice session started');
  showSessionMenu();
});

socket.on('sessionStopped', (data) => {
  isSessionActive = false;
  console.log('Voice session stopped');
  showMenu();
});

socket.on('transcription', (data) => {
  console.log(`Transcribed: "${data.text}"`);
});

socket.on('responseChunk', (data) => {
  process.stdout.write(data.chunk);
});

socket.on('responseComplete', (data) => {
  console.log('\nResponse complete!');
  if (isSessionActive) {
    showSessionMenu();
  }
});

socket.on('error', (data) => {
  console.log(`Error: ${data.message}`);
});

function showMenu() {
  console.log('\nAvailable Commands:');
  console.log('1. Start voice session');
  console.log('2. Send text message');
  console.log('3. Check server status');
  console.log('4. Exit');
  
  rl.question('\nSelect an option (1-4): ', handleMenuChoice);
}

function showSessionMenu() {
  console.log('\nVoice Session Active:');
  console.log('1. Send simulated audio');
  console.log('2. Stop voice session');
  console.log('3. Send text message');
  console.log('4. Back to main menu');
  
  rl.question('\nSelect an option (1-4): ', handleSessionChoice);
}

function handleMenuChoice(choice) {
  switch (choice.trim()) {
    case '1':
      if (isConnected) {
        console.log('Starting voice session...');
        socket.emit('startVoiceStream');
      } else {
        console.log('Not connected to server');
        showMenu();
      }
      break;
    case '2':
      rl.question('Enter your message: ', (message) => {
        socket.emit('textMessage', { message });
        setTimeout(() => showMenu(), 1000);
      });
      break;
    case '3':
      checkServerStatus();
      break;
    case '4':
      console.log('Goodbye!');
      process.exit(0);
      break;
    default:
      console.log('Invalid option');
      showMenu();
  }
}

function handleSessionChoice(choice) {
  switch (choice.trim()) {
    case '1':
      simulateAudioData();
      break;
    case '2':
      console.log('Stopping voice session...');
      socket.emit('stopVoiceStream');
      break;
    case '3':
      rl.question('Enter your message: ', (message) => {
        socket.emit('textMessage', { message });
        setTimeout(() => showSessionMenu(), 1000);
      });
      break;
    case '4':
      showMenu();
      break;
    default:
      console.log('Invalid option');
      showSessionMenu();
  }
}

function simulateAudioData() {
  console.log('Simulating audio data...');
  
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const mockAudioData = Buffer.from(`mock_audio_chunk_${i}_${Date.now()}`).toString('base64');
      socket.emit('audioData', {
        audio: mockAudioData,
        timestamp: Date.now()
      });
      console.log(`Sent audio chunk ${i + 1}/5`);
    }, i * 1000);
  }
  
  setTimeout(() => {
    if (isSessionActive) {
      showSessionMenu();
    }
  }, 6000);
}

function checkServerStatus() {
  const http = require('http');
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/health',
    method: 'GET'
  };
  
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      try {
        const status = JSON.parse(data);
        console.log('Server Status:');
        console.log(`   Status: ${status.status}`);
        console.log(`   Active Connections: ${status.activeConnections}`);
        console.log(`   Timestamp: ${status.timestamp}`);
      } catch (error) {
        console.log('Error parsing server status');
      }
      setTimeout(() => showMenu(), 1000);
    });
  });
  
  req.on('error', (error) => {
    console.log('Server not responding');
    setTimeout(() => showMenu(), 1000);
  });
  
  req.end();
}

process.on('SIGINT', () => {
  console.log('\nGoodbye!');
  process.exit(0);
});

console.log('Starting demo...');
console.log('Make sure the server is running on http://localhost:3000');
console.log('You can also test the web interface at http://localhost:3000\n'); 