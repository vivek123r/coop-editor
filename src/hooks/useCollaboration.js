import { useState, useEffect, useCallback } from 'react'
import collaborationManager from '../utils/collaborationManager'

export function useCollaboration() {
  const [isConnected, setIsConnected] = useState(false)
  const [users, setUsers] = useState([])
  const [globalUserCount, setGlobalUserCount] = useState(0)
  const [currentRoom, setCurrentRoom] = useState('')
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    // Set up event listeners FIRST, before connecting
    const handleConnectionStatus = ({ connected }) => {
      console.log('🔄 Connection status changed:', connected)
      setIsConnected(connected)
    }

    const handleUserJoined = (userData) => {
      console.log('User joined event:', userData)
      setUsers(prev => {
        const exists = prev.find(u => u.id === userData.id)
        if (exists) return prev
        return [...prev, { ...userData, isOnline: true }]
      })
    }

    const handleUserLeft = (userData) => {
      console.log('User left event:', userData)
      setUsers(prev => prev.filter(u => u.id !== userData.id))
      setCursors(prev => {
        const newCursors = new Map(prev)
        newCursors.delete(userData.id)
        return newCursors
      })
    }

    const handleRoomUsers = (roomUsers) => {
      console.log('🏠 Room users received:', roomUsers)
      console.log('🏠 Setting users state to:', roomUsers.map(user => ({ ...user, isOnline: true })))
      setUsers(roomUsers.map(user => ({ ...user, isOnline: true })))
    }

    const handleGlobalUserCount = (data) => {
      console.log('Global user count updated:', data)
      setGlobalUserCount(data.totalUsers)
    }

    const handleRoomJoinError = (data) => {
      console.error('Room join error received:', data)
      // This will be handled in the joinRoom function
    }

    // Register event listeners BEFORE connecting
    console.log('🎯 Registering event listeners with collaboration manager...')
    collaborationManager.on('connection-status', handleConnectionStatus)
    collaborationManager.on('user-joined', handleUserJoined)
    collaborationManager.on('user-left', handleUserLeft)
    collaborationManager.on('room-users', handleRoomUsers)
    collaborationManager.on('global-user-count', handleGlobalUserCount)
    collaborationManager.on('room-join-error', handleRoomJoinError)
    console.log('🎯 All event listeners registered!')

    // NOW connect to real Socket.io server
    console.log('🚀 Initializing collaboration manager...')
    collaborationManager.connect('http://localhost:3002')
    
    // Check initial connection status
    setTimeout(() => {
      console.log('📊 Initial connection check:', collaborationManager.isConnected)
      setIsConnected(collaborationManager.isConnected)
    }, 1000)

    return () => {
      // Cleanup event listeners
      collaborationManager.off('connection-status', handleConnectionStatus)
      collaborationManager.off('user-joined', handleUserJoined)
      collaborationManager.off('user-left', handleUserLeft)
      collaborationManager.off('room-users', handleRoomUsers)
      collaborationManager.off('global-user-count', handleGlobalUserCount)
      collaborationManager.off('room-join-error', handleRoomJoinError)
    }
  }, [])

  const joinRoom = useCallback(async (roomId, userData, isCreating = false) => {
    console.log('Attempting to join room:', roomId, 'with user data:', userData, 'Creating:', isCreating)
    
    // If we're creating a new room, we don't need to check if it exists
    if (!isCreating) {
      try {
        console.log(`Checking if room ${roomId} exists before joining...`)
        const roomInfo = await collaborationManager.checkRoomExists(roomId)
        if (!roomInfo.exists) {
          console.error(`❌ Room ${roomId} does not exist`)
          return { success: false, error: `Room "${roomId}" does not exist. Please check the room name or create a new room.` }
        }
        console.log(`✅ Room ${roomId} exists with ${roomInfo.userCount} users`)
      } catch (error) {
        console.error("Error checking if room exists:", error)
        // If we can't check, we'll attempt to join anyway
      }
    } else {
      console.log(`Creating new room: ${roomId}`)
    }
    
    const success = collaborationManager.joinRoom(roomId, userData, isCreating)
    if (success) {
      setCurrentRoom(roomId)
      setCurrentUser(userData)
      
      // No longer saving to localStorage as requested
      // Room state will be lost on page refresh
      
      console.log('Successfully joined room:', roomId)
      return { success: true }
    } else {
      console.error('Failed to join room:', roomId)
      return { success: false, error: 'Failed to connect to room. Please try again.' }
    }
  }, [])

  const leaveRoom = useCallback(() => {
    collaborationManager.leaveRoom()
    setCurrentRoom('')
    setCurrentUser(null)
    setUsers([])
    setCursors(new Map())
    setDocumentUpdates([])
    
    // Clear localStorage when leaving a room
    localStorage.removeItem('coopEditor_roomId')
    localStorage.removeItem('coopEditor_userData')
    localStorage.removeItem('coopEditor_isRoomLeader')
    console.log('Room data cleared from localStorage')
  }, [])

  const updateDocument = useCallback((documentData) => {
    collaborationManager.updateDocument(documentData)
  }, [])

  const updateCursor = useCallback((cursorPosition) => {
    collaborationManager.updateCursor(cursorPosition)
  }, [])

  const shareDocument = useCallback((documentData) => {
    collaborationManager.shareDocument(documentData)
  }, [])

  return {
    isConnected,
    users,
    globalUserCount,
    currentRoom,
    currentUser,
    joinRoom,
    leaveRoom
  }
}
