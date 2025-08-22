import { useState, useRef, useEffect } from 'react'
import { Send, MessageCircle, X } from 'lucide-react'
import './ChatBox.css'

function ChatBox({ users, currentUser, collaborationManager }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [isExpanded, setIsExpanded] = useState(true)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    // Track existing message IDs for deduplication
    const existingMessageIds = new Set(messages.map(msg => msg.id));
    
    // Listen for incoming messages only from OTHER users
    const handleMessage = (message) => {
      // Deduplicate messages by ID
      if (!existingMessageIds.has(message.id) && message.sender.id !== currentUser?.id) {
        console.log('Adding new message from other user:', message.id);
        setMessages(prev => [...prev, message]);
        existingMessageIds.add(message.id);
      } else {
        console.log('Skipped duplicate message:', message.id);
      }
    }

    // Listen for chat history when joining room
    const handleChatHistory = (messages) => {
      if (messages && messages.length > 0) {
        // Deduplicate chat history
        const uniqueMessages = [];
        const historyIds = new Set();
        
        for (const msg of messages) {
          if (!historyIds.has(msg.id)) {
            uniqueMessages.push(msg);
            historyIds.add(msg.id);
          }
        }
        
        console.log(`Setting ${uniqueMessages.length} unique history messages`);
        setMessages(uniqueMessages);
        
        // Update our tracking set
        uniqueMessages.forEach(msg => existingMessageIds.add(msg.id));
      } else {
        setMessages([]);
      }
    }

    collaborationManager.on('chat-message', handleMessage);
    collaborationManager.on('chat-history', handleChatHistory);

    return () => {
      collaborationManager.off('chat-message', handleMessage);
      collaborationManager.off('chat-history', handleChatHistory);
    };
  }, [collaborationManager, currentUser, messages])

  useEffect(() => {
    // Scroll to bottom when messages change
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    // Create a truly unique message ID with timestamp and random string
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    const message = {
      id: uniqueId,
      text: newMessage.trim(),
      sender: currentUser,
      timestamp: new Date().toISOString(),
      // Mark as own message to help with deduplication
      isOwnMessage: true
    }

    console.log('Sending new message with ID:', uniqueId);
    
    // Send message to server first
    collaborationManager.sendChatMessage(message)
    
    // Then add our message locally (with a slight delay to prevent race conditions)
    // This helps prevent duplicates when messages come back too quickly
    setTimeout(() => {
      setMessages(prev => {
        // Check if somehow our message already got added (very unlikely)
        if (prev.some(m => m.id === uniqueId)) {
          return prev;
        }
        return [...prev, message];
      });
    }, 10);
    
    setNewMessage('')
    
    // Focus back on input
    inputRef.current?.focus()
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const toggleChat = () => {
    setIsExpanded(prev => !prev)
  }

  return (
    <div className={`chat-box ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="chat-header" onClick={toggleChat}>
        <div className="chat-title">
          <MessageCircle size={18} />
          <span>Room Chat {!isExpanded && messages.length > 0 && `(${messages.length})`}</span>
        </div>
        {isExpanded && <X size={18} className="close-icon" />}
      </div>
      
      {isExpanded && (
        <>
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="no-messages">
                <p>No messages yet</p>
                <p className="hint">Be the first to say hello!</p>
              </div>
            ) : (
              messages.map(message => (
                <div 
                  key={message.id} 
                  className={`message ${message.sender.id === currentUser.id ? 'own-message' : ''}`}
                >
                  <div className="message-avatar" style={{ backgroundColor: message.sender.color }}>
                    {message.sender.avatar || message.sender.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="message-content">
                    <div className="message-header">
                      <span className="sender-name">
                        {message.sender.id === currentUser.id ? 'You' : message.sender.name}
                      </span>
                      <span className="message-time">{formatTime(message.timestamp)}</span>
                    </div>
                    <div className="message-text">{message.text}</div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <form className="message-form" onSubmit={handleSubmit}>
            <input
              type="text"
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="message-input"
            />
            <button 
              type="submit" 
              className="send-button"
              disabled={!newMessage.trim()}
            >
              <Send size={18} />
            </button>
          </form>
        </>
      )}
    </div>
  )
}

export default ChatBox