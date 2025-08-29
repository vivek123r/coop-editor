import React, { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import './YoutubePlayer.css';

function YoutubePlayer() {
    const [inputUrl, setInputUrl] = useState('');
    const [currentVideoId, setCurrentVideoId] = useState('');
    const [error, setError] = useState(null);
    const playerContainerRef = useRef(null);
    const playerInstanceRef = useRef(null);

    // Load YouTube API
    useEffect(() => {
        // Create script tag for YouTube API
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        
        // Insert script tag before the first script element
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        
        // Define global callback that YouTube API will call
        window.onYouTubeIframeAPIReady = () => {
            console.log('YouTube API Ready');
            if (currentVideoId) {
                initPlayer(currentVideoId);
            }
        };
        
        return () => {
            if (playerInstanceRef.current) {
                try {
                    playerInstanceRef.current.destroy();
                } catch (err) {
                    console.error('Error destroying player:', err);
                }
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
            initPlayer(videoId);
            setInputUrl('');
            setError(null);
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
    
    // Initialize YouTube player
    const initPlayer = (videoId) => {
        if (!window.YT || !window.YT.Player) {
            console.log('YouTube API not yet loaded, will try again when ready');
            return;
        }
        
        // Clean up existing player if any
        if (playerInstanceRef.current) {
            try {
                playerInstanceRef.current.destroy();
            } catch (err) {
                console.error('Error destroying previous player:', err);
            }
        }
        
        try {
            // Create a new div for the player
            const playerElement = document.createElement('div');
            playerElement.id = 'youtube-player';
            
            // Clear the container and append the new element
            if (playerContainerRef.current) {
                playerContainerRef.current.innerHTML = '';
                playerContainerRef.current.appendChild(playerElement);
                
                // Create the player
                playerInstanceRef.current = new window.YT.Player('youtube-player', {
                    height: '100%',
                    width: '100%',
                    videoId: videoId,
                    playerVars: {
                        'autoplay': 1,
                        'controls': 1,
                        'rel': 0,
                        'modestbranding': 1
                    },
                    events: {
                        'onError': (e) => {
                            console.error('YouTube Player Error:', e.data);
                            setError(`YouTube player error (code: ${e.data}). Please try another video.`);
                        }
                    }
                });
                
                console.log('Player initialized with video ID:', videoId);
            }
        } catch (err) {
            console.error('Error initializing player:', err);
            setError('Failed to initialize player. Please refresh and try again.');
        }
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
            
            <div className="video-player">
                <div className="video-responsive" ref={playerContainerRef}>
                    {!currentVideoId && (
                        <div className="player-instructions-overlay">
                            <p>Enter a YouTube URL above to load a video</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default YoutubePlayer;
