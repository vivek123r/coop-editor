import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import collaborationManager from '../../utils/collaborationManager';
import './YoutubePlayer.css';

function YoutubePlayer() {
    const [inputUrl, setInputUrl] = useState('');
    const [currentVideoId, setCurrentVideoId] = useState('');
    const [error, setError] = useState(null);
    const [isUserAction, setIsUserAction] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const iframeRef = useRef(null);
    
    // Create YouTube embed URL with enablejsapi=1 to allow control
    const createEmbedUrl = (videoId) => {
        return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&rel=0&modestbranding=1`;
    };
    
    // Clear user action state after a delay
    useEffect(() => {
        if (isUserAction) {
            const timer = setTimeout(() => {
                setIsUserAction(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [isUserAction]);
    
    // Listen for messages from the YouTube iframe
    useEffect(() => {
        if (!currentVideoId) return;
        
        const handleIframeMessage = (event) => {
            // Make sure message is from YouTube
            if (event.origin !== 'https://www.youtube.com') return;
            
            try {
                let data;
                if (typeof event.data === 'string') {
                    try {
                        data = JSON.parse(event.data);
                    } catch (e) {
                        // Not JSON, ignore
                        return;
                    }
                } else {
                    data = event.data;
                }
                
                // Handle various YouTube events
                if (data.event === 'onStateChange') {
                    // -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
                    console.log('Player state changed:', data.info);
                    
                    switch (data.info) {
                        case 1: // playing
                            if (!isPlaying && !isUserAction) {
                                setIsPlaying(true);
                                broadcastPlaybackState(true);
                            }
                            break;
                        case 2: // paused
                            if (isPlaying && !isUserAction) {
                                setIsPlaying(false);
                                broadcastPlaybackState(false);
                            }
                            break;
                        case 0: // ended
                            setIsPlaying(false);
                            break;
                    }
                    
                    setIsUserAction(false);
                }
            } catch (error) {
                console.error('Error processing iframe message:', error);
            }
        };
        
        window.addEventListener('message', handleIframeMessage);
        return () => window.removeEventListener('message', handleIframeMessage);
    }, [currentVideoId, isPlaying, isUserAction]);
    
    // Listen for collaboration events from other users
    useEffect(() => {
        const handleCollaborationMessage = (message) => {
            console.log("Received collaboration message:", message);
            
            // Ignore messages from self
            if (message.senderId === collaborationManager.currentUser?.id) {
                return;
            }
            
            // Handle video update message
            if (message.type === 'youtube-video-update' && message.videoId) {
                console.log("Remote video update:", message.videoId);
                setCurrentVideoId(message.videoId);
                setError(null);
                if (message.isPlaying !== undefined) {
                    setIsPlaying(message.isPlaying);
                }
            }
            
            // Handle playback state update
            else if (message.type === 'youtube-playback-update' && message.videoId === currentVideoId) {
                console.log("Remote playback update:", message.isPlaying ? "PLAY" : "PAUSE");
                
                // Apply the playback state from the remote user
                setTimeout(() => {
                    if (iframeRef.current) {
                        if (message.isPlaying) {
                            iframeRef.current.contentWindow.postMessage(JSON.stringify({
                                event: 'command',
                                func: 'playVideo',
                                args: []
                            }), '*');
                            setIsPlaying(true);
                        } else {
                            iframeRef.current.contentWindow.postMessage(JSON.stringify({
                                event: 'command',
                                func: 'pauseVideo',
                                args: []
                            }), '*');
                            setIsPlaying(false);
                        }
                    }
                }, 500); // Small delay to ensure iframe is ready
            }
        };
        
        // Subscribe to collaboration messages
        try {
            collaborationManager.on('custom-message', handleCollaborationMessage);
        } catch (error) {
            console.error('Error subscribing to collaboration events:', error);
        }
        
        // Cleanup on unmount
        return () => {
            try {
                collaborationManager.off('custom-message', handleCollaborationMessage);
            } catch (error) {
                console.error('Error unsubscribing from collaboration events:', error);
            }
        };
    }, []);
    
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
            setIsUserAction(true);
            
            // Broadcast video update to other users
            broadcastVideoUpdate(videoId);
        } else {
            setError('Invalid YouTube URL. Please enter a valid link.');
        }
    };
    
    // Broadcast video update to all users
    const broadcastVideoUpdate = (videoId) => {
        try {
            console.log("Broadcasting video update:", videoId);
            collaborationManager.sendMessage({
                type: 'youtube-video-update',
                videoId: videoId,
                isPlaying: true, // New videos start playing
                currentTime: 0,
                timestamp: Date.now(),
                senderId: collaborationManager.currentUser?.id || 'unknown'
            });
        } catch (error) {
            console.error('Error broadcasting video update:', error);
            setError('Failed to share video with other users.');
            setTimeout(() => setError(null), 3000);
        }
    };
    
    // Send play/pause state to all users
    const broadcastPlaybackState = (playing) => {
        try {
            console.log("Broadcasting playback state:", playing ? "PLAY" : "PAUSE");
            collaborationManager.sendMessage({
                type: 'youtube-playback-update',
                videoId: currentVideoId,
                isPlaying: playing,
                currentTime: currentTime,
                timestamp: Date.now(),
                senderId: collaborationManager.currentUser?.id || 'unknown'
            });
        } catch (error) {
            console.error('Error broadcasting playback state:', error);
        }
    };
    
    // Control functions for the YouTube iframe
    const playVideo = () => {
        if (!iframeRef.current) return;
        
        try {
            iframeRef.current.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: 'playVideo',
                args: []
            }), '*');
            
            setIsPlaying(true);
            setIsUserAction(true);
            broadcastPlaybackState(true);
        } catch (error) {
            console.error('Error playing video:', error);
        }
    };
    
    const pauseVideo = () => {
        if (!iframeRef.current) return;
        
        try {
            iframeRef.current.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: 'pauseVideo',
                args: []
            }), '*');
            
            setIsPlaying(false);
            setIsUserAction(true);
            broadcastPlaybackState(false);
        } catch (error) {
            console.error('Error pausing video:', error);
        }
    };
    
    // Toggle play/pause
    const togglePlayPause = () => {
        if (isPlaying) {
            pauseVideo();
        } else {
            playVideo();
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
            
            {isUserAction && (
                <p className="video-success">Video shared with all users in this room!</p>
            )}
            
            <div className="video-player">
                <div className="video-responsive">
                    {currentVideoId ? (
                        <>
                            <iframe 
                                ref={iframeRef}
                                src={createEmbedUrl(currentVideoId)}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                                allowFullScreen
                                className="youtube-iframe"
                            ></iframe>
                            <div className="video-controls">
                                <button onClick={togglePlayPause} className="control-button">
                                    {isPlaying ? 'Pause' : 'Play'}
                                </button>
                                <span className="control-status">
                                    {isPlaying ? 'Playing' : 'Paused'}
                                </span>
                            </div>
                            <div className="video-info">
                                <p>Currently watching: <span className="video-id">{currentVideoId}</span></p>
                            </div>
                        </>
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
