// Socket.io connection manager for real-time collaboration
import socket from '../socket'

class CollaborationManager {
  constructor() {
    this.socket = socket
    this.isConnected = socket.connected
    this.currentRoom = null
    this.currentUser = null
    this.eventListeners = new Map()
    this.instanceId = Math.random().toString(36).substr(2, 9)
    console.log(`🏗️ CollaborationManager instance created: ${this.instanceId}`)
  }

  connect(serverUrl = 'http://localhost:3002') {
    // Socket is already created in socket.js
    console.log('Using pre-initialized socket connection')
    
    if (!this.socket.connected) {
      console.log('Socket not connected, reconnecting...')
      this.socket.connect()
    }

    // Use the existing socket instance from socket.js

    this.setupEventHandlers()
  }

  setupEventHandlers() {
    this.socket.on('connect', () => {
      this.isConnected = true
      console.log('✅ Connected to collaboration server - Socket ID:', this.socket.id)
      this.emit('connection-status', { connected: true })
    })

    this.socket.on('disconnect', () => {
      this.isConnected = false
      console.log('Disconnected from collaboration server')
      this.emit('connection-status', { connected: false })
    })

    this.socket.on('connection-confirmed', (data) => {
      console.log('✅ Connection confirmed by server:', data)
      this.isConnected = true
      this.emit('connection-status', { connected: true })
    })

    this.socket.on('user-joined', (userData) => {
      console.log('User joined:', userData)
      this.emit('user-joined', userData)
    })

    this.socket.on('user-left', (userData) => {
      console.log('User left:', userData)
      this.emit('user-left', userData)
    })

    this.socket.on('document-updated', (documentData) => {
      console.log('Document updated:', documentData)
      this.emit('document-updated', documentData)
    })

    this.socket.on('cursor-moved', (cursorData) => {
      this.emit('cursor-moved', cursorData)
    })

    this.socket.on('room-users', (users) => {
      console.log('🔄 Room users received in manager:', users)
      console.log('🔄 Emitting room-users event to hook')
      this.emit('room-users', users)
    })

    this.socket.on('global-user-count', (data) => {
      console.log('Global user count received:', data)
      this.emit('global-user-count', data)
    })

    this.socket.on('document-shared', (documentData) => {
      console.log('Document shared:', documentData)
      this.emit('document-shared', documentData)
    })

    this.socket.on('error', (error) => {
      console.error('Socket error:', error)
      this.emit('error', error)
    })

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error)
      this.isConnected = false
      this.emit('connection-status', { connected: false })
    })

    this.socket.on('room-join-error', (data) => {
      console.error('Room join error:', data)
      this.emit('room-join-error', data)
    })
  }

  async checkRoomExists(roomId) {
    try {
      const response = await fetch(`http://localhost:3002/api/rooms/${roomId}/exists`)
      const data = await response.json()
      console.log(`🔍 Room ${roomId} exists:`, data.exists, `(${data.userCount} users)`)
      return data
    } catch (error) {
      console.error('Error checking room existence:', error)
      // If the server fails to respond, we'll assume the room doesn't exist
      return { exists: false, userCount: 0, leader: null }
    }
  }

  joinRoom(roomId, userData, isCreating = false) {
    if (!this.isConnected) {
      console.warn('Socket not connected')
      return false
    }

    this.currentRoom = roomId
    this.currentUser = userData
    this.socket.emit('join-room', { roomId, userData, isCreating })
    return true
  }

  leaveRoom() {
    if (this.currentRoom && this.isConnected) {
      this.socket.emit('leave-room', { 
        roomId: this.currentRoom,
        userId: this.currentUser?.id 
      })
    }
    this.currentRoom = null
    this.currentUser = null
  }

  updateDocument(documentData) {
    if (this.currentRoom && this.isConnected) {
      this.socket.emit('document-update', {
        roomId: this.currentRoom,
        userId: this.currentUser?.id,
        documentData
      })
    }
  }

  updateCursor(cursorPosition) {
    if (this.currentRoom && this.isConnected) {
      this.socket.emit('cursor-update', {
        roomId: this.currentRoom,
        userId: this.currentUser?.id,
        cursorPosition
      })
    }
  }

  shareDocument(documentData) {
    if (this.currentRoom && this.isConnected) {
      this.socket.emit('share-document', {
        roomId: this.currentRoom,
        userId: this.currentUser?.id,
        documentData
      })
    }
  }

  // Event listener management
  on(event, callback) {
    console.log(`🎯 [${this.instanceId}] Registering listener for event: ${event}`)
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event).add(callback)
    console.log(`🎯 [${this.instanceId}] Total listeners for ${event}: ${this.eventListeners.get(event).size}`)
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(callback)
    }
  }

  emit(event, data) {
    console.log(`🔥 [${this.instanceId}] Emitting event: ${event}`, data)
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event)
      console.log(`🔥 [${this.instanceId}] Found ${listeners.size} listeners for ${event}`)
      listeners.forEach(callback => callback(data))
    } else {
      console.log(`🔥 [${this.instanceId}] No listeners found for event: ${event}`)
    }
  }

  disconnect(clearListeners = true) {
    this.leaveRoom()
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.isConnected = false
    if (clearListeners) {
      console.log(`🧹 [${this.instanceId}] Clearing event listeners`)
      this.eventListeners.clear()
    } else {
      console.log(`🔒 [${this.instanceId}] Preserving event listeners`)
    }
  }

  // Mock mode for development without a real server
  enableMockMode() {
    this.isConnected = true
    console.log('Mock collaboration mode enabled - simulating real-time features')
    
    // Simulate connection
    setTimeout(() => {
      this.emit('connection-status', { connected: true })
    }, 500)
  }
}

// Create a singleton instance
const collaborationManager = new CollaborationManager()

export default collaborationManager
