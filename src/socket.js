import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3002';

// Create a single socket instance
const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 5000
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
