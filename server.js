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

// Add CORS middleware for API endpoints
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Add a health check endpoint for monitoring
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Add API endpoint to check if room exists
app.get('/api/rooms/:roomId/exists', (req, res) => {
  const { roomId } = req.params;
  const roomExists = rooms[roomId] !== undefined;
  
  res.json({
    exists: roomExists,
    userCount: roomExists ? rooms[roomId].users.length : 0,
    leader: roomExists ? rooms[roomId].leader : null
  });
});

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: "*", // Allow any origin in production
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000, // Longer ping timeout for Render.com
});

// Track connected users and rooms
const users = {};
const rooms = {};
const socketRooms = {}; // Maps socket.id to array of room IDs

// Set up Socket.IO event handlers
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle user joining a room
  socket.on('join-room', (data) => {
    const { roomId, userData, isCreating, isReconnecting } = data;
    if (!roomId || !userData) {
      console.error('Invalid room join request: missing roomId or userData');
      socket.emit('room-join-error', { 
        message: 'Invalid room join request', 
        code: 'INVALID_JOIN_REQUEST' 
      });
      return;
    }

    // Ensure userData has a valid name and ID
    if (!userData.name) {
      userData.name = 'Anonymous';
    }
    
    if (!userData.id) {
      userData.id = `user_${socket.id}_${Date.now()}`;
    }

    // Add user to room
    socket.join(roomId);
    
    // Store user data and map socket to room
    users[socket.id] = { 
      ...userData, 
      socketId: socket.id,
      joinedAt: Date.now()
    };
    
    // Store which socket is in which room
    if (!socketRooms[socket.id]) {
      socketRooms[socket.id] = [];
    }
    if (!socketRooms[socket.id].includes(roomId)) {
      socketRooms[socket.id].push(roomId);
    }
    
    // Create room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = {
        id: roomId,
        users: [userData],
        userIds: [userData.id],
        leader: userData.name,
        sockets: {[socket.id]: userData},
        createdAt: Date.now()
      };
      console.log(`🏆 Room ${roomId} created with leader: ${userData.name}`);
    } else {
      // Update or add user in the room
      const existingUserIndex = rooms[roomId].userIds.indexOf(userData.id);
      
      if (existingUserIndex === -1) {
        // New user joining
        rooms[roomId].users.push(userData);
        rooms[roomId].userIds.push(userData.id);
        rooms[roomId].sockets[socket.id] = userData;
        console.log(`👤 User ${userData.name} (${userData.id}) joined room ${roomId}`);
      } else {
        // Existing user reconnecting
        rooms[roomId].users[existingUserIndex] = userData;
        rooms[roomId].sockets[socket.id] = userData;
        console.log(`🔄 User ${userData.name} (${userData.id}) reconnected to room ${roomId}`);
      }
    }

    // Notify room of user list with full user objects
    io.to(roomId).emit('room-users', rooms[roomId].users);
    console.log(`Added user ${userData.name} to room ${roomId}. Room now has: [${rooms[roomId].users.map(u => u.name).join(', ')}]`);
    
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
    if (!message || !message.roomId) {
      console.error('Invalid message format: missing roomId');
      return;
    }
    
    const roomId = message.roomId;
    const messageType = message.type || 'unknown';
    const userId = message.userId || socket.id;
    const userName = message.userName || 'Anonymous';
    
    // Enhanced logging for debugging
    console.log(`Custom message in room ${roomId}:`, {
      type: messageType,
      userId: userId,
      userName: userName,
      timestamp: new Date().toISOString()
    });
    
    // Validate that the room exists
    if (!rooms[roomId]) {
      console.error(`Message sent to non-existent room: ${roomId}`);
      socket.emit('error', { 
        message: 'Room does not exist', 
        code: 'ROOM_NOT_FOUND' 
      });
      return;
    }
    
    try {
      // If the message has a specific target user, only send to that user
      if (message.targetUserId) {
        const targetSocketId = Object.keys(rooms[roomId].sockets).find(
          socketId => rooms[roomId].sockets[socketId]?.userId === message.targetUserId
        );
        
        if (targetSocketId) {
          io.to(targetSocketId).emit('custom-message', message);
          console.log(`Sent targeted message to user ${message.targetUserId}`);
        } else {
          console.log(`Target user ${message.targetUserId} not found in room`);
        }
      } else {
        // Broadcast message to everyone in the room except sender
        socket.to(roomId).emit('custom-message', message);
        console.log(`Broadcast message to all users in room ${roomId}`);
      }
    } catch (err) {
      console.error('Error broadcasting message:', err);
      socket.emit('error', { 
        message: 'Failed to broadcast message', 
        code: 'BROADCAST_ERROR' 
      });
    }
  });

  // Handle user disconnection
  socket.on('disconnect', (reason) => {
    console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
    
    // Clean up user from rooms
    const user = users[socket.id];
    if (user) {
      // Check if user was in any rooms
      if (socketRooms[socket.id]) {
        socketRooms[socket.id].forEach(roomId => {
          // Don't immediately remove the user from the room data
          // Just mark them as disconnected and remove socket association
          if (rooms[roomId]) {
            console.log(`User ${user.name} (${user.id}) disconnected from room ${roomId}`);
            
            // Keep user data but remove socket association
            if (rooms[roomId].sockets && rooms[roomId].sockets[socket.id]) {
              delete rooms[roomId].sockets[socket.id];
            }
            
            // Notify room that user disconnected
            io.to(roomId).emit('user-left', {
              ...user,
              reason,
              temporary: reason !== 'client namespace disconnect' && reason !== 'io client disconnect'
            });
            
            // Send updated user list
            if (rooms[roomId].users && rooms[roomId].users.length > 0) {
              // Only update the active users (those with sockets)
              const activeUsers = Object.values(rooms[roomId].sockets || {});
              if (activeUsers.length > 0) {
                io.to(roomId).emit('room-users', activeUsers);
              }
            }
          }
        });
      }
      
      // Remove socket room associations but keep user data for potential reconnection
      delete socketRooms[socket.id];
    }
    
    // Keep users data for potential reconnection (will be cleaned up by garbage collection)
    console.log(`User disconnected: ${user?.name || 'Unknown'} (${socket.id})`);
  });
});

// Helper function to handle a user leaving a room
function handleUserLeaveRoom(socket, roomId) {
  const user = users[socket.id];
  if (!user || !rooms[roomId]) return;

  const room = rooms[roomId];
  
  // Remove user from socket association
  if (room.sockets && room.sockets[socket.id]) {
    delete room.sockets[socket.id];
  }
  
  // Check if this was the user's last connection to this room
  const userHasOtherConnections = Object.values(room.sockets || {})
    .some(userData => userData.id === user.id);
  
  // Only fully remove the user if they have no other connections
  if (!userHasOtherConnections) {
    const userIndex = room.userIds ? room.userIds.indexOf(user.id) : -1;
    if (userIndex !== -1) {
      // Remove user from room
      room.users.splice(userIndex, 1);
      room.userIds.splice(userIndex, 1);
    }
    
    // Delete empty rooms
    if (room.users.length === 0) {
      console.log(`Room ${roomId} deleted (empty)`);
      delete rooms[roomId];
    } else {
      // Update room leader if needed
      if (room.leader === user.name) {
        room.leader = room.users[0].name || 'Anonymous';
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

// Use a middleware approach for the catchall handler instead of a route pattern
// This will handle all routes and send back the React index.html for client-side routing
app.use((req, res, next) => {
  // Skip API routes or other routes that shouldn't be handled by the SPA
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  
  // Send the index.html for all other routes
  res.sendFile(path.join(__dirname, 'dist', 'index.html'), (err) => {
    if (err) {
      console.error('Error sending file:', err);
      res.status(500).send('Error loading application');
    }
  });
});

// Get port from environment variable
const PORT = process.env.PORT || 8080;

// Error handling for uncaught exceptions - log but don't crash in production
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // In production, we may want to continue running rather than exit
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
  console.error('Server error:', err);
});
