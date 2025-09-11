import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';

// __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
const server = createServer(app);

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Track connected users and rooms
const users = {};
const rooms = {};

// Set up Socket.IO event handlers
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle user joining a room
  socket.on('join-room', (data) => {
    const { roomId, userData } = data;
    if (!roomId || !userData) return;

    // Add user to room
    socket.join(roomId);
    users[socket.id] = { ...userData, socketId: socket.id };
    
    // Create room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = {
        id: roomId,
        users: [userData.name],
        leader: userData.name
      };
      console.log(`🏆 Room ${roomId} created with leader: ${userData.name}`);
    } else {
      rooms[roomId].users.push(userData.name);
    }

    // Notify room of new user
    io.to(roomId).emit('room-users', rooms[roomId].users);
    console.log(`Added user ${userData.name} to room ${roomId}. Room now has: [${rooms[roomId].users}]`);
    
    // Emit user-joined event to everyone in the room
    io.to(roomId).emit('user-joined', userData);
  });

  // Handle user leaving a room
  socket.on('leave-room', (data) => {
    const { roomId } = data;
    if (!roomId) return;

    handleUserLeaveRoom(socket, roomId);
  });

  // Handle custom messages (for document/drawing collaboration)
  socket.on('custom-message', (message) => {
    if (!message || !message.roomId) return;
    
    console.log(`Custom message in room ${message.roomId}:`, message.type);
    
    // Broadcast message to everyone in the room except sender
    socket.to(message.roomId).emit('custom-message', message);
  });

  // Handle user disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Clean up user from rooms
    const user = users[socket.id];
    if (user) {
      Object.keys(rooms).forEach(roomId => {
        handleUserLeaveRoom(socket, roomId);
      });
      
      // Remove user from users object
      delete users[socket.id];
    }
  });
});

// Helper function to handle a user leaving a room
function handleUserLeaveRoom(socket, roomId) {
  const user = users[socket.id];
  if (!user || !rooms[roomId]) return;

  const room = rooms[roomId];
  if (room.users.includes(user.name)) {
    // Remove user from room
    room.users = room.users.filter(u => u !== user.name);
    
    // Delete empty rooms
    if (room.users.length === 0) {
      console.log(`Room ${roomId} deleted (empty)`);
      delete rooms[roomId];
    } else {
      // Update room leader if needed
      if (room.leader === user.name) {
        room.leader = room.users[0];
        console.log(`New leader of room ${roomId}: ${room.leader}`);
      }
      
      // Notify remaining users
      io.to(roomId).emit('room-users', room.users);
      io.to(roomId).emit('user-left', user);
    }
  }
  
  // Leave the Socket.IO room
  socket.leave(roomId);
}

// Serve static files from the React build directory
app.use(express.static(path.join(__dirname, 'dist')));

// The "catchall" handler: send back React's index.html file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Get port from environment variable
const PORT = process.env.PORT || 8080;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
