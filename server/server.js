const express = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const multer = require('multer')
const path = require('path')

const app = express()
const httpServer = createServer(app)

// Configure CORS
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
  credentials: true
}))

app.use(express.json())
app.use(express.static('uploads'))

// Socket.io setup with CORS
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  }
})

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/')
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type'), false)
    }
  }
})

// In-memory storage for rooms and documents
const rooms = new Map()
const documents = new Map()
const userSessions = new Map()

// REST API endpoints
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Server is running', 
    timestamp: new Date().toISOString(),
    port: PORT,
    activeRooms: rooms.size,
    activeSessions: userSessions.size
  })
})

app.get('/api/debug/rooms', (req, res) => {
  const roomsData = Array.from(rooms.entries()).map(([id, room]) => ({
    id,
    userCount: room.users.size,
    documentCount: room.documents.size,
    createdAt: room.createdAt
  }))
  
  res.json({
    rooms: roomsData,
    totalRooms: rooms.size,
    totalSessions: userSessions.size
  })
})

app.get('/api/rooms', (req, res) => {
  const availableRooms = Array.from(rooms.entries()).map(([id, room]) => ({
    id,
    name: id,
    leaderName: room.leaderName,
    userCount: room.users.size,
    createdAt: room.createdAt,
    users: Array.from(room.users.values()).map(u => u.name)
  }))
  
  res.json({
    rooms: availableRooms
  })
})
app.get('/api/rooms/:roomId/exists', (req, res) => {
  const { roomId } = req.params
  const roomExists = rooms.has(roomId) && rooms.get(roomId).users.size > 0
  
  res.json({
    exists: roomExists,
    userCount: roomExists ? rooms.get(roomId).users.size : 0,
    leader: roomExists ? rooms.get(roomId).leaderName : null
  })
})

app.post('/api/upload', upload.single('document'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }
    
    const documentData = {
      id: Date.now().toString(),
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      uploadedAt: new Date().toISOString()
    }
    
    documents.set(documentData.id, documentData)
    
    res.json({
      success: true,
      document: documentData
    })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: 'Upload failed' })
  }
})


// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`)
  
  // Store user session
  userSessions.set(socket.id, {
    id: socket.id,
    connectedAt: new Date().toISOString()
  })

  // Broadcast updated user count to all connected clients
  io.emit('global-user-count', { totalUsers: userSessions.size })

  // Handle joining a room
  socket.on('join-room', ({ roomId, userData, isCreating = false }) => {
    try {
      console.log(`User ${userData.name} ${isCreating ? 'creating' : 'joining'} room ${roomId}`)
      
      // If not creating a new room, check if room exists
      if (!isCreating) {
        if (!rooms.has(roomId) || rooms.get(roomId).users.size === 0) {
          console.log(`❌ Room ${roomId} does not exist`)
          socket.emit('room-join-error', { 
            error: `Room "${roomId}" does not exist. Please check the room name or create a new room.` 
          })
          return
        }
        console.log(`✅ Room ${roomId} exists, allowing user to join`)
      }
      
      // Leave any previous rooms
      Array.from(socket.rooms).forEach(room => {
        if (room !== socket.id) {
          socket.leave(room)
        }
      })
      
      // Join the new room
      socket.join(roomId)
      
      // Initialize room if it doesn't exist (only when creating)
      if (!rooms.has(roomId)) {
        if (!isCreating) {
          socket.emit('room-join-error', { error: 'Room creation failed' })
          return
        }
        rooms.set(roomId, {
          id: roomId,
          users: new Map(),
          documents: new Map(),
          messages: [],
          createdAt: new Date().toISOString(),
          leaderId: socket.id, // First user becomes room leader
          leaderName: userData.name
        })
        console.log(`🏆 Room ${roomId} created with leader: ${userData.name}`)
      
      // Initialize the room with messages array
      rooms.set(roomId, {
        id: roomId,
        users: new Map(),
        documents: new Map(),
        messages: [], // Add this line to store chat history
        createdAt: new Date().toISOString(),
        leaderId: socket.id,
        leaderName: userData.name
      })
      }
      
      const room = rooms.get(roomId)
      
      // Add user to room
      const userInfo = {
        ...userData,
        socketId: socket.id,
        joinedAt: new Date().toISOString(),
        isOnline: true,
        isRoomLeader: socket.id === room.leaderId // Mark if this user is the room leader
      }
      
      room.users.set(socket.id, userInfo)
      console.log(`Added user ${userInfo.name} to room ${roomId}. Room now has:`, Array.from(room.users.values()).map(u => u.name))
      
      // Update user session with room info
      const session = userSessions.get(socket.id)
      if (session) {
        session.currentRoom = roomId
        session.userData = userInfo
      }
      
      // Notify other users in the room
      socket.to(roomId).emit('user-joined', userInfo)
      
      // Send current room state to the joining user
      const roomUsers = Array.from(room.users.values())
      console.log(`Sending room-users to ${socket.id}:`, roomUsers.map(u => u.name))
      socket.emit('room-users', roomUsers)
      
      // Send current documents in the room
      const roomDocuments = Array.from(room.documents.values())
      if (roomDocuments.length > 0) {
        socket.emit('room-documents', roomDocuments)
      }
      if (room.messages && room.messages.length > 0) {
        socket.emit('chat-history', room.messages);
      }
      console.log(`Room ${roomId} now has ${room.users.size} users`)
      
    } catch (error) {
      console.error('Error joining room:', error)
      socket.emit('error', { message: 'Failed to join room' })
    }
  })
  // Handle writing updates
  socket.on('writing-update', (msg) => {
    socket.to(msg.roomId).emit('writing-update', msg);
  });


  // Handle leaving a room
  socket.on('leave-room', ({ roomId, userId }) => {
    try {
      console.log(`User leaving room ${roomId}`)
      
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId)
        const user = room.users.get(socket.id)
        
        if (user) {
          // Remove user from room
          room.users.delete(socket.id)
          
          // If the leaving user was the room leader, promote next user
          if (socket.id === room.leaderId && room.users.size > 0) {
            const nextLeader = room.users.values().next().value
            room.leaderId = nextLeader.socketId
            room.leaderName = nextLeader.name
            console.log(`🏆 New room leader for ${roomId}: ${nextLeader.name}`)
            
            // Update all users in room about new leader
            nextLeader.isRoomLeader = true
            socket.to(roomId).emit('room-leader-changed', {
              newLeaderId: nextLeader.socketId,
              newLeaderName: nextLeader.name
            })
          }
          
          // Notify other users
          socket.to(roomId).emit('user-left', user)
          
          // Clean up empty rooms
          if (room.users.size === 0) {
            rooms.delete(roomId)
            console.log(`Room ${roomId} deleted (empty)`)
          }
        }
      }
      
      socket.leave(roomId)
      
      // Update user session
      const session = userSessions.get(socket.id)
      if (session) {
        session.currentRoom = null
        session.userData = null
      }
      
    } catch (error) {
      console.error('Error leaving room:', error)
    }
  })

  // Handle document updates
  socket.on('document-update', (data) => {
    try {
      const { roomId, documentId, content, userId, timestamp } = data
      
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId)
        
        // Update document in room
        if (room.documents.has(documentId)) {
          const document = room.documents.get(documentId)
          document.content = content
          document.lastModified = timestamp
          document.lastModifiedBy = userId
        }
        
        // Broadcast to other users in the room
        socket.to(roomId).emit('document-updated', {
          documentId,
          content,
          userId,
          timestamp
        })
        
        console.log(`Document ${documentId} updated in room ${roomId}`)
      }
      
    } catch (error) {
      console.error('Error updating document:', error)
    }
  })

  // Handle cursor updates
  socket.on('cursor-update', (data) => {
    try {
      const { roomId, userId, cursorPosition, userName, color } = data
      
      // Broadcast cursor position to other users in the room
      socket.to(roomId).emit('cursor-moved', {
        userId,
        userName,
        color,
        cursorPosition,
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      console.error('Error updating cursor:', error)
    }
  })

  // Handle document sharing
  socket.on('share-document', (data) => {
    try {
      const { roomId, documentData, userId } = data
      
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId)
        
        // Add document to room
        const sharedDocument = {
          ...documentData,
          sharedAt: new Date().toISOString(),
          sharedBy: userId
        }
        
        room.documents.set(documentData.id, sharedDocument)
        
        // Broadcast to all users in the room
        socket.to(roomId).emit('document-shared', sharedDocument)
        
        console.log(`Document ${documentData.id} shared in room ${roomId}`)
      }
      
    } catch (error) {
      console.error('Error sharing document:', error)
    }
  })
  socket.on('chat-message', (data) => {
  try {
    const { roomId, message } = data;
    
    if (!roomId || !message) {
      console.log('Invalid chat message data received');
      return;
    }
    
    // Get the room
    if (!rooms.has(roomId)) {
      console.log(`Chat message for non-existent room ${roomId}`);
      return;
    }
    
    const room = rooms.get(roomId);
    
    // Store the message in room history (optional, for message persistence)
    if (!room.messages) {
      room.messages = [];
    }
    
    // Check for duplicate message IDs before adding to history
    const isDuplicate = room.messages.some(m => m.id === message.id);
    if (isDuplicate) {
      console.log(`Skipping duplicate message with ID ${message.id}`);
      return;
    }
    
    // Limit history to last 100 messages
    if (room.messages.length > 100) {
      room.messages.shift();
    }
    
    // Add message to room history
    room.messages.push(message);
    
    console.log(`Chat message in room ${roomId} from ${message.sender.name}: ${message.text} (ID: ${message.id})`);
    
    // Broadcast to all users in the room except sender
    socket.to(roomId).emit('chat-message', message);
    
  } catch (error) {
    console.error('Error handling chat message:', error);
  }
  });
  
  // Handle custom messages for video player synchronization
  socket.on('custom-message', (data) => {
    try {
      const { roomId, message } = data;
      
      if (!roomId || !message) {
        console.log('Invalid custom message data received');
        return;
      }
      
      // Get the room
      if (!rooms.has(roomId)) {
        console.log(`Custom message for non-existent room ${roomId}`);
        return;
      }
      
      console.log(`Custom message in room ${roomId}:`, message);
      
      // Broadcast to all users in the room except sender
      socket.to(roomId).emit('custom-message', message);
      
    } catch (error) {
      console.error('Error handling custom message:', error);
    }
  });


  // Handle typing indicators
  socket.on('typing-start', (data) => {
    const { roomId, userId, userName } = data
    socket.to(roomId).emit('user-typing', { userId, userName, isTyping: true })
  })

  socket.on('typing-stop', (data) => {
    const { roomId, userId } = data
    socket.to(roomId).emit('user-typing', { userId, isTyping: false })
  })

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`)
    
    try {
      const session = userSessions.get(socket.id)
      
      if (session && session.currentRoom) {
        const roomId = session.currentRoom
        
        if (rooms.has(roomId)) {
          const room = rooms.get(roomId)
          const user = room.users.get(socket.id)
          
          if (user) {
            // Remove user from room
            room.users.delete(socket.id)
            
            // Notify other users
            socket.to(roomId).emit('user-left', user)
            
            // Clean up empty rooms
            if (room.users.size === 0) {
              rooms.delete(roomId)
              console.log(`Room ${roomId} deleted (empty)`)
            }
          }
        }
      }
      
      // Clean up user session
      userSessions.delete(socket.id)
      
      // Broadcast updated user count to remaining clients
      io.emit('global-user-count', { totalUsers: userSessions.size })
      
    } catch (error) {
      console.error('Error handling disconnect:', error)
    }
  })

  // Send initial connection confirmation
  socket.emit('connection-confirmed', {
    socketId: socket.id,
    timestamp: new Date().toISOString(),
    totalConnectedUsers: userSessions.size
  })
})

// Error handling
app.use((error, req, res, next) => {
  console.error('Server error:', error)
  res.status(500).json({ error: 'Internal server error' })
})

const PORT = process.env.PORT || 3002

// Try to find an available port
const findAvailablePort = (startPort, callback) => {
  const net = require('net')
  const server = net.createServer()
  
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️ Port ${startPort} is busy, trying ${startPort + 1}...`)
      findAvailablePort(startPort + 1, callback)
    } else {
      console.error('Port checking error:', err)
    }
  })
  
  server.once('listening', () => {
    server.close(() => {
      callback(startPort)
    })
  })
  
  server.listen(startPort)
}

// Start the server on an available port
const startServer = (port) => {
  console.log(`🚀 Starting CoopEditor server on port ${port}`)
  
  httpServer.listen(port, () => {
    console.log(`🚀 CoopEditor server running on port ${port}`)
    console.log(`📡 Socket.io server ready for connections`)
    console.log(`🌐 CORS enabled for localhost:5173, localhost:5174, localhost:3000`)
    console.log(`📁 File uploads available at /api/upload`)
  })
}

// Find an available port and start the server
findAvailablePort(PORT, (availablePort) => {
  startServer(availablePort)
  
  // Update socket.js in the frontend with the correct port
  console.log(`💡 Frontend should connect to: http://localhost:${availablePort}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  httpServer.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})
