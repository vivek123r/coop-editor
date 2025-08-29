import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import './writing.css';

function Writing() {
  const [content, setContent] = useState('');
  const [documentTitle, setDocumentTitle] = useState('Untitled Document');
  const [lastSaved, setLastSaved] = useState(null);

  const handleTextChange = (e) => {
    setContent(e.target.value);
    setLastSaved(new Date());
  };

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
              <Clock size={16} />
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