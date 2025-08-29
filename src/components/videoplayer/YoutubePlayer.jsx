import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import collaborationManager from '../../utils/collaborationManager';
import './YoutubePlayer.css';

function YoutubePlayer() {
    const [inputUrl, setInputUrl] = useState('');
    const [currentVideoId, setCurrentVideoId] = useState('');
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    
    // Create direct YouTube embed URL
    const createEmbedUrl = (videoId) => {
        // Most reliable direct embed format - no API, just iframe
        return `https://www.youtube.com/embed/${videoId}`;
    };
    
    // Handle URL form submission
    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!inputUrl.trim()) {
            setError('Please enter a YouTube URL');
            return;
        }
        
        const videoId = extractVideoId(inputUrl);
        
        if (videoId) {
            setCurrentVideoId(videoId);
            setInputUrl('');
            setError(null);
            
            // Show success message
            setSuccessMessage('Video loaded successfully!');
            setTimeout(() => setSuccessMessage(null), 3000);
            
            // Broadcast to other users
            broadcastVideoUpdate(videoId);
        } else {
            setError('Invalid YouTube URL. Please enter a valid link.');
        }
    };
    
    // Extract video ID from different YouTube URL formats
    const extractVideoId = (url) => {
        const patterns = [
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/i,
            /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?]+)/i,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/i
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        
        return null;
    };
    
    // Broadcast video update to all users
    const broadcastVideoUpdate = (videoId) => {
        try {
            console.log("Broadcasting video update:", videoId);
            collaborationManager.sendMessage({
                type: 'youtube-video-update',
                videoId: videoId,
                timestamp: Date.now(),
                senderId: collaborationManager.currentUser?.id || 'unknown'
            });
        } catch (error) {
            console.error('Error broadcasting video update:', error);
        }
    };
    
    // Listen for incoming video updates
    React.useEffect(() => {
        const handleMessage = (message) => {
            // Ignore our own messages
            if (message.senderId === collaborationManager.currentUser?.id) {
                return;
            }
            
            // Handle video updates from other users
            if (message.type === 'youtube-video-update' && message.videoId) {
                setCurrentVideoId(message.videoId);
                setError(null);
                setSuccessMessage('New video shared by another user!');
                setTimeout(() => setSuccessMessage(null), 3000);
            }
        };
        
        // Subscribe to messages
        try {
            collaborationManager.on('custom-message', handleMessage);
        } catch (e) {
            console.error('Error subscribing to messages:', e);
        }
        
        // Cleanup
        return () => {
            try {
                collaborationManager.off('custom-message', handleMessage);
            } catch (e) {
                console.error('Error unsubscribing from messages:', e);
            }
        };
    }, []);
    
    return (
        <div className="video-player-container">
            <h2>YouTube Video Player</h2>
            
            <form onSubmit={handleSubmit} className="video-url-form">
                <input
                    type="url"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="Paste YouTube video URL here"
                    className="video-url-input"
                />
                <button 
                    type="submit" 
                    className="video-submit-btn"
                >
                    <Plus size={16} />
                    Load Video
                </button>
            </form>
            
            {error && (
                <p className="video-error">{error}</p>
            )}
            
            {successMessage && (
                <p className="video-success">{successMessage}</p>
            )}
            
            <div className="video-player">
                <div className="video-responsive">
                    {currentVideoId ? (
                        <iframe 
                            src={createEmbedUrl(currentVideoId)}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                            allowFullScreen
                        ></iframe>
                    ) : (
                        <div className="player-instructions-overlay">
                            <p>Enter a YouTube URL above to load a video</p>
                            <p className="instructions-subtext">Videos shared by others will appear here automatically</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default YoutubePlayer;
