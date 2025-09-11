import { io } from 'socket.io-client';

// Use the current domain in production, localhost in development
const SOCKET_URL = import.meta.env.PROD 
  ? window.location.origin 
  : 'http://localhost:3002';

console.log('Socket connecting to:', SOCKET_URL);

// Create a single socket instance with more robust reconnection settings for Render.com
const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity, // Keep trying to reconnect
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000 // Longer timeout for Render's sleep/wake cycle
});

// Debug socket events
socket.on('connect', () => {
  console.log('✅ Connected to server with ID:', socket.id);
});

socket.on('connect_error', (err) => {
  console.error('Connection error:', err.message);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected from server:', reason);
});

export default socket;
