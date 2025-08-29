import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, Plus, Trash2, ExternalLink } from 'lucide-react';
import collaborationManager from '../../utils/collaborationManager';
import './videoplayer.css';

function VideoPlayer() {
    const [videoUrl, setVideoUrl] = useState('');
    const [inputUrl, setInputUrl] = useState('');
    const [videoQueue, setVideoQueue] = useState([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState(null);
    const videoRef = useRef(null);
    const seekBarRef = useRef(null);

    // Extract YouTube video ID from various YouTube URL formats
    const getYouTubeVideoId = (url) => {
        if (!url) return null;
        
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        
        return (match && match[2].length === 11) ? match[2] : null;
    };

    // Process URL and return YouTube embed URL if valid
    const processVideoUrl = (url) => {
        const videoId = getYouTubeVideoId(url);
        if (videoId) {
            return `https://www.youtube.com/embed/${videoId}?enablejsapi=1`;
        }
        return null;
    };

    // Handle form submission for adding videos
    const handleSubmit = (e) => {
        e.preventDefault();
        const processedUrl = processVideoUrl(inputUrl);
        
        if (processedUrl) {
            const videoTitle = `YouTube Video ${videoQueue.length + 1}`;
            const newVideo = {
                id: Date.now().toString(),
                title: videoTitle,
                url: processedUrl,
                originalUrl: inputUrl
            };

            // If queue is empty, play this video immediately
            if (videoQueue.length === 0) {
                setVideoUrl(processedUrl);
            }

            // Add to queue
            const updatedQueue = [...videoQueue, newVideo];
            setVideoQueue(updatedQueue);
            setInputUrl('');
            setError(null);

            // Broadcast to other users
            broadcastVideoQueueUpdate(updatedQueue);
        } else {
            setError('Invalid YouTube URL. Please enter a valid YouTube link.');
        }
    };

    // Flag to track if state change was initiated by our controls
    const [stateChangeByUs, setStateChangeByUs] = useState(false);
    
    // Play/pause toggle
    const togglePlayPause = () => {
        const newState = !isPlaying;
        console.log("Toggle play/pause to:", newState ? "PLAY" : "PAUSE");
        
        // Mark that we initiated this state change
        setStateChangeByUs(true);
        setIsPlaying(newState);
        
        if (videoRef.current) {
            try {
                if (newState) {
                    videoRef.current.contentWindow.postMessage(JSON.stringify({
                        event: 'command',
                        func: 'playVideo',
                        args: ''
                    }), '*');
                } else {
                    videoRef.current.contentWindow.postMessage(JSON.stringify({
                        event: 'command',
                        func: 'pauseVideo',
                        args: ''
                    }), '*');
                }
            } catch (error) {
                console.error('Error controlling YouTube player:', error);
            }
        }
        
        // Broadcast play/pause state
        broadcastPlaybackState(newState, currentTime);
        
        // Reset the flag after a short delay
        setTimeout(() => setStateChangeByUs(false), 500);
    };

    // Skip to next video in queue
    const playNextVideo = () => {
        if (videoQueue.length <= 1) return;
        
        const updatedQueue = [...videoQueue.slice(1)];
        setVideoQueue(updatedQueue);
        
        if (updatedQueue.length > 0) {
            setVideoUrl(updatedQueue[0].url);
            setIsPlaying(true);
            setCurrentTime(0);
        } else {
            setVideoUrl('');
        }
        
        // Broadcast updated queue to other users
        broadcastVideoQueueUpdate(updatedQueue);
    };

    // Remove video from queue
    const removeFromQueue = (index) => {
        const updatedQueue = [...videoQueue];
        updatedQueue.splice(index, 1);
        
        setVideoQueue(updatedQueue);
        
        // If we removed the current video
        if (index === 0 && updatedQueue.length > 0) {
            setVideoUrl(updatedQueue[0].url);
            setCurrentTime(0);
        } else if (updatedQueue.length === 0) {
            setVideoUrl('');
        }
        
        // Broadcast updated queue
        broadcastVideoQueueUpdate(updatedQueue);
    };

    // Select a specific video from the queue
    const selectVideo = (index) => {
        if (index === 0) return; // Already playing this video
        
        const selectedVideo = videoQueue[index];
        const updatedQueue = [
            selectedVideo,
            ...videoQueue.slice(0, index),
            ...videoQueue.slice(index + 1)
        ];
        
        setVideoQueue(updatedQueue);
        setVideoUrl(selectedVideo.url);
        setCurrentTime(0);
        setIsPlaying(true);
        
        // Broadcast updated queue
        broadcastVideoQueueUpdate(updatedQueue);
    };

    // Update seek bar progress
    const updateSeekBar = (time) => {
        if (seekBarRef.current && duration) {
            const percent = (time / duration) * 100;
            seekBarRef.current.value = percent;
        }
    };

    // Seek to a specific position when user drags the seek bar
    const handleSeek = (e) => {
        const percent = e.target.value;
        const newTime = (duration * percent) / 100;
        
        setCurrentTime(newTime);
        updateSeekBar(newTime);
        
        if (videoRef.current) {
            try {
                videoRef.current.contentWindow.postMessage(JSON.stringify({
                    event: 'command',
                    func: 'seekTo',
                    args: [newTime, true]
                }), '*');
            } catch (error) {
                console.error('Error seeking YouTube player:', error);
            }
        }
        
        // Broadcast seek position
        broadcastPlaybackState(isPlaying, newTime);
    };

    // Broadcast functions to update other users
    const broadcastVideoQueueUpdate = (queue) => {
        try {
            console.log("Broadcasting queue update:", queue);
            const message = {
                type: 'video-queue-update',
                queue: queue,
                currentUrl: queue.length > 0 ? queue[0].url : '',
                currentTime: currentTime,
                isPlaying: isPlaying
            };
            
            const success = collaborationManager.sendMessage(message);
            console.log("Queue broadcast success:", success);
        } catch (error) {
            console.error("Error broadcasting video queue update:", error);
        }
    };

    const broadcastPlaybackState = (playing, time) => {
        try {
            console.log("Broadcasting playback state:", playing ? "PLAY" : "PAUSE", "at time", time);
            const message = {
                type: 'video-playback-update',
                isPlaying: playing,
                currentTime: time
            };
            
            const success = collaborationManager.sendMessage(message);
            console.log("Playback broadcast success:", success);
        } catch (error) {
            console.error("Error broadcasting playback state:", error);
        }
    };

    // Set up message listeners for collaborative features
    useEffect(() => {
        const handleCollaborationMessage = (message) => {
            console.log("Received message:", message);
            
            // Safety check to make sure message is an object
            if (!message || typeof message !== 'object') return;
            
            if (message.type === 'video-queue-update') {
                console.log("Processing queue update:", message.queue);
                setVideoQueue(message.queue || []);
                
                if (message.currentUrl && message.currentUrl !== videoUrl) {
                    console.log("Updating video URL to:", message.currentUrl);
                    setVideoUrl(message.currentUrl);
                }
                
                // Update playback state
                setIsPlaying(!!message.isPlaying);
                setCurrentTime(message.currentTime || 0);
            }
            else if (message.type === 'video-playback-update') {
                console.log("Processing playback update:", message.isPlaying ? "PLAY" : "PAUSE", "at time", message.currentTime);
                setIsPlaying(!!message.isPlaying);
                setCurrentTime(message.currentTime || 0);
                
                if (videoRef.current) {
                    try {
                        // Apply remote playback commands
                        if (message.isPlaying) {
                            videoRef.current.contentWindow.postMessage(JSON.stringify({
                                event: 'command',
                                func: 'playVideo',
                                args: ''
                            }), '*');
                        } else {
                            videoRef.current.contentWindow.postMessage(JSON.stringify({
                                event: 'command',
                                func: 'pauseVideo',
                                args: ''
                            }), '*');
                        }
                        
                        // Seek to the synchronized timestamp
                        videoRef.current.contentWindow.postMessage(JSON.stringify({
                            event: 'command',
                            func: 'seekTo',
                            args: [message.currentTime || 0, true]
                        }), '*');
                    } catch (error) {
                        console.error("Error controlling remote YouTube player:", error);
                    }
                }
            }
        };

        console.log("Setting up video sync listeners");
        
        // Set up direct event handlers for custom messages
        const setupListeners = () => {
            try {
                // Remove any existing listeners to avoid duplicates
                collaborationManager.off('custom-message', handleCollaborationMessage);
                
                // Add new listener
                collaborationManager.on('custom-message', handleCollaborationMessage);
                console.log("Successfully subscribed to custom-message events");
            } catch (error) {
                console.error('Error subscribing to collaboration events:', error);
            }
        };
        
        // Initial setup
        setupListeners();
        
        // Set up a periodic check to ensure listeners are active
        const intervalId = setInterval(() => {
            if (collaborationManager.socket && collaborationManager.socket.connected) {
                setupListeners();
            }
        }, 5000); // Check every 5 seconds
        
        return () => {
            clearInterval(intervalId);
            try {
                // Clean up event listener
                collaborationManager.off('custom-message', handleCollaborationMessage);
                console.log("Unsubscribed from custom-message events");
            } catch (error) {
                console.error('Error unsubscribing from collaboration events:', error);
            }
        };
    }, [videoUrl, videoRef, currentTime, isPlaying]);

    // Handle window message events from YouTube iframe API
    useEffect(() => {
        // Use the state variable for tracking who initiated the change
        
        const handleYouTubeMessages = (event) => {
            // Only process messages from our video iframe
            if (!videoRef.current || event.source !== videoRef.current.contentWindow) return;
            
            try {
                // Handle both string and object formats of messages
                let data;
                if (typeof event.data === 'string') {
                    try {
                        data = JSON.parse(event.data);
                    } catch (e) {
                        return; // Not JSON, ignore
                    }
                } else {
                    data = event.data;
                }
                
                // Log to help debug
                console.log("YouTube event:", data);
                
                if (data.event === 'onStateChange') {
                    console.log("YouTube state change to:", data.info);
                    
                    // Update playing state based on YouTube events
                    // 1 = playing, 2 = paused, 0 = ended
                    if (data.info === 1) {
                        setIsPlaying(true);
                        
                        // Only broadcast if this wasn't initiated by our code
                        if (!stateChangeByUs) {
                            console.log("Play initiated by user directly in YouTube player, broadcasting");
                            broadcastPlaybackState(true, currentTime);
                        }
                    } else if (data.info === 2) {
                        setIsPlaying(false);
                        
                        // Only broadcast if this wasn't initiated by our code
                        if (!stateChangeByUs) {
                            console.log("Pause initiated by user directly in YouTube player, broadcasting");
                            broadcastPlaybackState(false, currentTime);
                        }
                    } else if (data.info === 0) {
                        console.log("Video ended, playing next video");
                        playNextVideo();
                    }
                } 
                else if (data.event === 'infoDelivery') {
                    // Update current time and duration if provided
                    if (data.info && data.info.currentTime !== undefined) {
                        setCurrentTime(data.info.currentTime);
                        updateSeekBar(data.info.currentTime);
                    }
                    
                    if (data.info && data.info.duration !== undefined) {
                        setDuration(data.info.duration);
                    }
                }
            } catch (error) {
                console.error("Error handling YouTube message:", error);
            }
        };
        
        window.addEventListener('message', handleYouTubeMessages);
        
        return () => {
            window.removeEventListener('message', handleYouTubeMessages);
        };
    }, [videoRef.current, duration, videoQueue, currentTime, stateChangeByUs]);

    // Format time in MM:SS format
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="video-player-container">
            <h2>Collaborative Video Player</h2>
            
            <form onSubmit={handleSubmit} className="video-url-form">
                <input
                    type="text"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="Paste YouTube video URL here"
                    className="video-url-input"
                />
                <button type="submit" className="video-submit-btn">
                    <Plus size={16} />
                    Add to Queue
                </button>
            </form>
            
            {error && <p className="video-error">{error}</p>}
            
            {videoUrl ? (
                <div className="video-player">
                    <div className="video-responsive">
                        <iframe
                            ref={videoRef}
                            src={videoUrl}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title="Embedded YouTube Video"
                        />
                    </div>
                    
                    <div className="video-controls">
                        <button 
                            onClick={togglePlayPause}
                            className="control-btn"
                        >
                            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                        </button>
                        
                        <div className="seek-container">
                            <span className="time-display">{formatTime(currentTime)}</span>
                            <input
                                ref={seekBarRef}
                                type="range"
                                min="0"
                                max="100"
                                defaultValue="0"
                                className="seek-bar"
                                onChange={handleSeek}
                            />
                            <span className="time-display">{formatTime(duration)}</span>
                        </div>
                        
                        <button 
                            onClick={playNextVideo}
                            disabled={videoQueue.length <= 1}
                            className={`control-btn ${videoQueue.length <= 1 ? 'disabled' : ''}`}
                        >
                            <SkipForward size={18} />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="video-placeholder">
                    <p>Add YouTube videos to the queue to start watching</p>
                </div>
            )}
            
            <div className="video-queue">
                <h3>Queue ({videoQueue.length} videos)</h3>
                {videoQueue.length > 0 ? (
                    <ul className="queue-list">
                        {videoQueue.map((video, index) => (
                            <li 
                                key={video.id} 
                                className={`queue-item ${index === 0 ? 'current-video' : ''}`}
                            >
                                <div className="queue-item-info">
                                    <span className="queue-number">{index + 1}</span>
                                    <span className="queue-title">
                                        {video.title}
                                        <a href={video.originalUrl} target="_blank" rel="noopener noreferrer" className="external-link">
                                            <ExternalLink size={14} />
                                        </a>
                                    </span>
                                </div>
                                <div className="queue-item-actions">
                                    {index !== 0 && (
                                        <button 
                                            onClick={() => selectVideo(index)}
                                            className="queue-action play-now"
                                        >
                                            Play Now
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => removeFromQueue(index)}
                                        className="queue-action remove"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="empty-queue">No videos in queue</p>
                )}
            </div>
        </div>
    );
}

export default VideoPlayer;