import React, { useState, useEffect, useRef } from 'react';
import collaborationManager from '../../utils/collaborationManager';
import './Writing.css';

function Writing() {
  const [content, setContent] = useState('');
  const [documentTitle, setDocumentTitle] = useState('Untitled Document');
  const [lastSaved, setLastSaved] = useState(null);
  const ignoreNextUpdate = useRef(false);

  // Broadcast changes to others
  const handleTextChange = (e) => {
    const newValue = e.target.value;
    setContent(newValue);
    setLastSaved(new Date());

    // Send to others
    collaborationManager.sendMessage({
      type: 'writing-update',
      content: newValue,
      documentTitle,
      timestamp: new Date().toISOString(),
    });
  };

  // Listen for updates from others
  useEffect(() => {
    const handleIncoming = (msg) => {
      if (msg.type === 'writing-update') {
        ignoreNextUpdate.current = true;
        setContent(msg.content);
        setLastSaved(new Date(msg.timestamp));
        if (msg.documentTitle) setDocumentTitle(msg.documentTitle);
      }
    };
    collaborationManager.on('custom-message', handleIncoming);
    return () => collaborationManager.off('custom-message', handleIncoming);
  }, []);

  return (
    <div className="writing-component">
      <div className="writing-header">
        <div className="writing-info">
          <input
            type="text"
            className="document-title-input"
            value={documentTitle}
            onChange={(e) => setDocumentTitle(e.target.value)}
            placeholder="Document Title"
          />
          {lastSaved && (
            <div className="last-saved">
              <span>Last updated: {lastSaved.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </div>
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
    </div>
  );
}

export default Writing;