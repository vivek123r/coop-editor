import { useState, useEffect } from 'react'
import { Users, Wifi, WifiOff, MessageSquare } from 'lucide-react'
import { useCollaboration } from './hooks/useCollaboration'
import UserList from './components/UserList'
import RoomSelector from './components/RoomSelector'
import './App.css'

const getRandomColor = () => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA']
  return colors[Math.floor(Math.random() * colors.length)]
}

function App() {
  const [roomId, setRoomId] = useState('')
  const [userName, setUserName] = useState('')
  const [isAutoJoining, setIsAutoJoining] = useState(false)
  
  const {
    isConnected,
    users,
    currentRoom,
    currentUser,
    joinRoom,
    leaveRoom
  } = useCollaboration()

  useEffect(() => {
    // Generate default values
    if (!roomId) {
      setRoomId('room-' + Math.random().toString(36).substr(2, 9))
    }
    if (!userName) {
      setUserName('User-' + Math.random().toString(36).substr(2, 5))
    }
  }, [])

  // Auto-rejoin feature disabled as requested
  useEffect(() => {
    // Clean up any existing saved room data to prevent auto-joining
    localStorage.removeItem('coopEditor_roomId')
    localStorage.removeItem('coopEditor_userData')
    localStorage.removeItem('coopEditor_isRoomLeader')
  }, [])

  const handleCreateRoom = async (roomId, roomName, isCreating = true) => {
    const userData = {
      id: Date.now().toString(),
      name: userName,
      avatar: userName.charAt(0).toUpperCase(),
      color: getRandomColor(),
      joinedAt: new Date().toISOString()
    }
    
    return await joinRoom(roomId, userData, isCreating)
  }

  const handleJoinExistingRoom = async (roomId, isCreating = false) => {
    const userData = {
      id: Date.now().toString(),
      name: userName,
      avatar: userName.charAt(0).toUpperCase(),
      color: getRandomColor(),
      joinedAt: new Date().toISOString()
    }
    
    return await joinRoom(roomId, userData, isCreating)
  }

  const handleJoinRoom = () => {
    if (roomId && userName) {
      const userData = {
        id: Date.now().toString(),
        name: userName,
        avatar: userName.charAt(0).toUpperCase(),
        color: getRandomColor(),
        joinedAt: new Date().toISOString()
      }
      
      joinRoom(roomId, userData)
    }
  }

  const handleLeaveRoom = () => {
    leaveRoom()
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <MessageSquare size={32} />
          <h1>CoopChat</h1>
          <span className="subtitle">Simple Real-time Room Chat</span>
        </div>
        <div className="header-right">
          {currentRoom ? (
            <>
              <div className="connection-status">
                {isConnected ? (
                  <Wifi size={16} className="connected" />
                ) : (
                  <WifiOff size={16} className="disconnected" />
                )}
                <span className={isConnected ? 'connected' : 'disconnected'}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {currentRoom && (
                <div className="room-info">
                  <Users size={16} />
                  <span>Room: {currentRoom}</span>
                  <span>•</span>
                  <span>{users.length} users in room</span>
                </div>
              )}
              {currentRoom && (
                <button onClick={handleLeaveRoom} className="leave-btn">
                  Leave Room
                </button>
              )}
            </>
          ) : null}
        </div>
      </header>

      <main className="app-main">
        {!currentRoom ? (
          <div className="welcome-screen">
            <div className="welcome-content">
              <MessageSquare size={64} className="welcome-icon" />
              <h1>Welcome to CoopChat</h1>
              <p>Join a room to chat with others in real-time</p>
              
              {isAutoJoining ? (
                <div className="auto-joining">
                  <div className="loading-spinner"></div>
                  <p>Rejoining your previous session...</p>
                </div>
              ) : (
                <>
                  <div className="user-setup">
                    <div className="input-group">
                      <label>Your Name:</label>
                      <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="Enter your name"
                      />
                    </div>
                  </div>
                </>
              )}
              
              {!isAutoJoining && userName && (
                <RoomSelector 
                  onCreateRoom={handleCreateRoom}
                  onJoinRoom={handleJoinExistingRoom}
                  userName={userName}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="workspace">
            <aside className="sidebar">
              <UserList users={users} currentUser={currentUser} />
              <div className="room-details">
                <h3>Room: {currentRoom}</h3>
                <p>You are connected with {users.length} users</p>
              </div>
            </aside>
            
            <div className="chat-area">
              <div className="chat-content">
                <h2>Welcome to the Room</h2>
                <p>You are now connected with other users in this room.</p>
                <p>This is a simplified version with only room management and user presence.</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
