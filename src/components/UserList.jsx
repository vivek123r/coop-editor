import { Users, Circle, Crown } from 'lucide-react'
import './UserList.css'

function UserList({ users, currentUser }) {
  return (
    <div className="user-list">
      <h3>
        <Users size={20} />
        Online Users ({users.length})
      </h3>
      <div className="users">
        {users.map(user => (
          <div key={user.id} className="user-item">
            <div 
              className="user-avatar"
              style={{ backgroundColor: user.color || '#007aff' }}
            >
              {user.avatar || user.name.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <span className="user-name">
                {user.name}
                {user.id === currentUser?.id && ' (You)'}
              </span>
              <span className="user-status">
                {user.isOnline ? 'Active' : 'Away'}
              </span>
            </div>
            <div className="user-indicators">
              {user.isRoomLeader && (
                <Crown size={12} className="owner-indicator" title="Room Leader" />
              )}
              <Circle 
                size={8} 
                className={`status-indicator ${user.isOnline ? 'online' : 'offline'}`}
                fill="currentColor"
              />
            </div>
          </div>
        ))}
      </div>
      
      {users.length > 0 && (
        <div className="collaboration-status">
          <div className="status-item">
            <Circle size={8} className="status-dot active" fill="currentColor" />
            <span>Real-time collaboration active</span>
          </div>
          <div className="status-item">
            <span className="cursor-demo">👆</span>
            <span>Live cursor tracking</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserList
