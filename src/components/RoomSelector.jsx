import { useState } from 'react'
import { Plus, Users } from 'lucide-react'
import './RoomSelector.css'

function RoomSelector({ onCreateRoom, onJoinRoom, userName }) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showJoinForm, setShowJoinForm] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [joinRoomName, setJoinRoomName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      setErrorMessage('Please enter a room name to create')
      return
    }
    
    setIsCreating(true)
    setErrorMessage('')
    try {
      // Create a unique room ID based on the name and timestamp
      const roomId = `room-${newRoomName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`
      console.log("Creating new room with ID:", roomId)
      
      // Call the parent's onCreateRoom function with isCreating=true
      const result = await onCreateRoom(roomId, newRoomName.trim(), true) 
      
      if (!result || !result.success) {
        setErrorMessage((result && result.error) || 'Failed to create room. Please try again.')
      } else {
        setNewRoomName('')
        setShowCreateForm(false)
      }
    } catch (error) {
      setErrorMessage('Error creating room. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinRoom = async () => {
    if (!joinRoomName.trim()) {
      setErrorMessage('Please enter a room name to join')
      return
    }
    
    setIsJoining(true)
    setErrorMessage('')
    try {
      console.log("Attempting to join room:", joinRoomName.trim())
      // Use the exact room ID provided by the user
      const result = await onJoinRoom(joinRoomName.trim(), false) // false = not creating
      
      if (!result || !result.success) {
        setErrorMessage((result && result.error) || 'Failed to join room. Please check the room name and try again.')
      } else {
        setJoinRoomName('')
        setShowJoinForm(false)
      }
    } catch (error) {
      setErrorMessage('Error joining room. Please try again.')
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div className="room-selector">
      <div className="room-selector-header">
        <h2>Choose an Option</h2>
      </div>

      <div className="room-actions">
        <button 
          className="create-room-btn"
          onClick={() => {
            setShowCreateForm(!showCreateForm)
            setShowJoinForm(false)
            setErrorMessage('')
          }}
        >
          <Plus size={16} />
          Create New Room
        </button>

        <button 
          className="join-room-btn"
          onClick={() => {
            setShowJoinForm(!showJoinForm)
            setShowCreateForm(false)
            setErrorMessage('')
          }}
        >
          <Users size={16} />
          Join Existing Room
        </button>
      </div>

      {errorMessage && (
        <div className="error-message">
          {errorMessage}
        </div>
      )}

      {showCreateForm && (
        <div className="create-room-form">
          <h3>Create New Room</h3>
          <input
            type="text"
            placeholder="Enter room name..."
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateRoom()}
            autoFocus
          />
          <div className="form-actions">
            <button onClick={handleCreateRoom} disabled={!newRoomName.trim() || isCreating}>
              {isCreating ? 'Creating...' : 'Create & Join'}
            </button>
            <button onClick={() => setShowCreateForm(false)} disabled={isCreating}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {showJoinForm && (
        <div className="join-room-form">
          <h3>Join Existing Room</h3>
          <input
            type="text"
            placeholder="Enter room name to join..."
            value={joinRoomName}
            onChange={(e) => setJoinRoomName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
            autoFocus
          />
          <div className="form-actions">
            <button onClick={handleJoinRoom} disabled={!joinRoomName.trim() || isJoining}>
              {isJoining ? 'Joining...' : 'Join Room'}
            </button>
            <button onClick={() => setShowJoinForm(false)} disabled={isJoining}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default RoomSelector
