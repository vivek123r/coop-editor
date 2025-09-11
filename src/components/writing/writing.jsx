import React, { useState, useEffect, useRef } from 'react';
import { Clock, Globe } from 'lucide-react';
import collaborationManager from '../../utils/collaborationManager';
import './writing.css';

function Writing({ roomId, currentUser }) {
  const [content, setContent] = useState('');
  const [documentTitle, setDocumentTitle] = useState('Untitled Document');
  const [lastSaved, setLastSaved] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const ignoreNextUpdate = useRef(false);
  
  // Local storage keys
  const getLocalStorageKey = (type) => `coopchat_${roomId}_${type}`;
  
  // Clear local storage for this room
  const clearLocalStorage = () => {
    localStorage.removeItem(getLocalStorageKey('content'));
    localStorage.removeItem(getLocalStorageKey('title'));
    localStorage.removeItem(getLocalStorageKey('timestamp'));
    console.log("Cleared local storage for room:", roomId);
  };

  // Load from local storage when component mounts
  useEffect(() => {
    if (roomId) {
      const savedContent = localStorage.getItem(getLocalStorageKey('content'));
      const savedTitle = localStorage.getItem(getLocalStorageKey('title'));
      const savedTimestamp = localStorage.getItem(getLocalStorageKey('timestamp'));
      
      if (savedContent !== null) {
        console.log("Loaded content from local storage");
        setContent(savedContent);
        if (savedTitle) setDocumentTitle(savedTitle);
        if (savedTimestamp) setLastSaved(new Date(savedTimestamp));
      }
    }
  }, [roomId]);

  // Save to local storage whenever content changes
  useEffect(() => {
    if (roomId && content !== '' && !isLoading) {
      localStorage.setItem(getLocalStorageKey('content'), content);
      localStorage.setItem(getLocalStorageKey('title'), documentTitle);
      localStorage.setItem(getLocalStorageKey('timestamp'), new Date().toISOString());
      console.log("Saved content to local storage");
    }
  }, [roomId, content, documentTitle, isLoading]);

  // Request latest content when component mounts or room changes
  useEffect(() => {
    if (!roomId || !currentUser) return;
    
    // Request the latest document content
    console.log("Requesting latest writing content for room:", roomId);
    collaborationManager.sendMessage({
      type: 'writing-content-request',
      roomId,
      userId: currentUser.id,
      timestamp: new Date().toISOString(),
    });
    
    setIsLoading(true);
    
    // Also announce our presence to make sure others know we're here
    collaborationManager.sendMessage({
      type: 'writing-user-joined',
      roomId,
      userId: currentUser.id,
      userName: currentUser.name,
      timestamp: new Date().toISOString(),
    });
    
    // Set a timeout in case we don't get a response
    const timeout = setTimeout(() => {
      setIsLoading(false);
      console.log("No content response received within timeout period, using local storage or empty document");
      
      // Check if we have content in localStorage (should already be loaded)
      const localContent = localStorage.getItem(getLocalStorageKey('content'));
      const localTitle = localStorage.getItem(getLocalStorageKey('title'));
      const localTimestamp = localStorage.getItem(getLocalStorageKey('timestamp'));
      
      if (localContent) {
        console.log("Using cached content from localStorage since no network content was received");
        // No need to set content/title again as they should already be loaded from localStorage
        // in the mount effect, but we'll update lastSaved
        if (localTimestamp) {
          setLastSaved(new Date(localTimestamp));
        }
      }
    }, 3000); // Longer timeout to ensure we get responses
    
    return () => clearTimeout(timeout);
  }, [roomId, currentUser]);

  // Broadcast changes to others
  const handleTextChange = (e) => {
    const newValue = e.target.value;
    const timestamp = new Date().toISOString();
    
    setContent(newValue);
    setLastSaved(new Date(timestamp));

    // Send to others
    if (!ignoreNextUpdate.current) {
      collaborationManager.sendMessage({
        type: 'writing-update',
        roomId,
        userId: currentUser?.id,
        userName: currentUser?.name,
        content: newValue,
        documentTitle,
        timestamp: timestamp,
      });
    }
    ignoreNextUpdate.current = false;
  };

  // Handle document title changes
  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    const timestamp = new Date().toISOString();
    
    setDocumentTitle(newTitle);
    setLastSaved(new Date(timestamp));
    
    collaborationManager.sendMessage({
      type: 'writing-update',
      roomId,
      userId: currentUser?.id,
      userName: currentUser?.name,
      documentTitle: newTitle,
      content, // Also send current content to ensure sync
      timestamp: timestamp,
    });
  };

  // Listen for new user joins to share content with them
  useEffect(() => {
    if (!roomId || !currentUser) return;
    
    const handleUserJoined = (userData) => {
      // When a new user joins, send them the current content (after a small delay to let them set up)
      if (userData.id !== currentUser.id && content) {
        console.log(`New user ${userData.name} joined - sending current writing content`);
        
        // Wait a bit to ensure the new user is ready to receive
        setTimeout(() => {
          collaborationManager.sendMessage({
            type: 'writing-content-broadcast',
            roomId,
            userId: currentUser.id,
            userName: currentUser.name,
            content,
            documentTitle,
            timestamp: new Date().toISOString(),
          });
        }, 2000);
      }
    };
    
    collaborationManager.on('user-joined', handleUserJoined);
    
    return () => {
      collaborationManager.off('user-joined', handleUserJoined);
    };
  }, [roomId, currentUser, content, documentTitle]);

  // Listen for updates from others
  useEffect(() => {
    const handleIncoming = (msg) => {
      // Handle content request response OR broadcast
      if ((msg.type === 'writing-content-response' || msg.type === 'writing-content-broadcast') && msg.roomId === roomId) {
        console.log("Received writing content:", msg.content?.substr(0, 50) + "...");
        
        // Check if received content is newer than local storage
        const localTimestamp = localStorage.getItem(getLocalStorageKey('timestamp'));
        const msgTimestamp = msg.timestamp ? new Date(msg.timestamp) : new Date();
        const shouldUpdate = !localTimestamp || 
          msgTimestamp > new Date(localTimestamp);
        
        if (shouldUpdate || !localTimestamp) {
          console.log("Using network content (newer than local storage)");
          ignoreNextUpdate.current = true;
          setContent(msg.content || '');
          setDocumentTitle(msg.documentTitle || 'Untitled Document');
          setLastSaved(msgTimestamp);
          setIsLoading(false);
          
          // Update localStorage with newer content
          if (msg.content !== undefined) {
            localStorage.setItem(getLocalStorageKey('content'), msg.content || '');
          }
          if (msg.documentTitle !== undefined) {
            localStorage.setItem(getLocalStorageKey('title'), msg.documentTitle || 'Untitled Document');
          }
          localStorage.setItem(getLocalStorageKey('timestamp'), msg.timestamp || new Date().toISOString());
        } else {
          console.log("Kept local content (newer than received content)");
          setIsLoading(false);
        }
      }
      // Handle content request from other users
      else if (msg.type === 'writing-content-request' && msg.roomId === roomId && msg.userId !== currentUser?.id) {
        console.log("Someone requested writing content, sending current state");
        
        // Add a small random delay to avoid multiple simultaneous responses
        setTimeout(() => {
          collaborationManager.sendMessage({
            type: 'writing-content-response',
            roomId,
            userId: currentUser?.id,
            userName: currentUser?.name,
            content,
            documentTitle,
            timestamp: new Date().toISOString(),
            requesterId: msg.userId
          });
        }, Math.random() * 500); // Random delay up to 500ms
      }
      // Handle new user announcement - respond with current content
      else if (msg.type === 'writing-user-joined' && msg.roomId === roomId && msg.userId !== currentUser?.id) {
        console.log(`User ${msg.userName} joined the writing area - will send content`);
        
        // Add a small delay to avoid multiple users responding at once
        setTimeout(() => {
          // Only send if we have content
          if (content || documentTitle !== 'Untitled Document') {
            console.log(`Sending content to new user ${msg.userName}`);
            collaborationManager.sendMessage({
              type: 'writing-content-broadcast',
              roomId,
              userId: currentUser?.id,
              userName: currentUser?.name,
              content,
              documentTitle,
              timestamp: new Date().toISOString(),
              targetUserId: msg.userId
            });
          }
        }, Math.random() * 1000); // Random delay up to 1 second
      }
      // Handle regular updates
      else if (msg.type === 'writing-update' && msg.roomId === roomId) {
        // Don't process own updates
        if (msg.userId !== currentUser?.id) {
          console.log("Received writing update from another user");
          ignoreNextUpdate.current = true;
          
          if (msg.content !== undefined) {
            setContent(msg.content);
          }
          if (msg.documentTitle) {
            setDocumentTitle(msg.documentTitle);
          }
          setLastSaved(new Date(msg.timestamp));
          
          // Always update localStorage with the latest content from other users
          if (msg.content !== undefined) {
            localStorage.setItem(getLocalStorageKey('content'), msg.content);
          }
          if (msg.documentTitle) {
            localStorage.setItem(getLocalStorageKey('title'), msg.documentTitle);
          }
          localStorage.setItem(getLocalStorageKey('timestamp'), msg.timestamp || new Date().toISOString());
        }
      }
    };

    if (collaborationManager && roomId) {
      collaborationManager.on('custom-message', handleIncoming);
    }
    
    return () => {
      if (collaborationManager) {
        collaborationManager.off('custom-message', handleIncoming);
      }
    };
  }, [roomId, currentUser, content, documentTitle]);

  return (
    <div className="writing-component">
      <div className="writing-header">
        <div className="writing-info">
          <input
            type="text"
            className="document-title-input"
            value={documentTitle}
            onChange={handleTitleChange}
            placeholder="Document Title"
          />
          {lastSaved && (
            <div className="last-saved">
              <Clock size={16} />
              <span>Last updated: {lastSaved.toLocaleTimeString()}</span>
              <span className="document-status">
                <Globe size={14} /> Shared document
              </span>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="writing-loading">
          <p>Loading document content...</p>
        </div>
      ) : (
        <>
          <div className="writing-editor">
            <textarea
              value={content}
              onChange={handleTextChange}
              placeholder="Start writing your document here..."
              className="writing-textarea"
              rows={20}
            />
          </div>

          <div className="writing-footer">
            <div className="character-count">
              {content.length} characters
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Writing;