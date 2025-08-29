import React, { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import './YoutubePlayer.css';

function YoutubePlayer() {
    const [inputUrl, setInputUrl] = useState('');
    const [currentVideoId, setCurrentVideoId] = useState('');
    const [error, setError] = useState(null);
    const [isReady, setIsReady] = useState(false);
    const playerRef = useRef(null);
    
    // Load YouTube IFrame API
    useEffect(() => {
        // Add YouTube API script if not already present
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        }
        
        // Define callback for when API is ready
        window.onYouTubeIframeAPIReady = initializePlayer;
        
        // If API is already loaded, initialize player directly
        if (window.YT && window.YT.Player) {
            initializePlayer();
        }
        
        return () => {
            // Cleanup player when component unmounts
            if (playerRef.current) {
                try {
                    playerRef.current.destroy();
                } catch (e) {
                    console.error('Error destroying player:', e);
                }
            }
        };
    }, []);
    
    // Initialize YouTube player
    function initializePlayer() {
        if (!window.YT || !window.YT.Player) {
            console.log('YouTube API not yet loaded, waiting...');
            setTimeout(initializePlayer, 1000);
            return;
        }
        
        if (!document.getElementById('youtube-player-container')) {
            console.log('Player container not found');
            setError('Player container not found');
            return;
        }
        
        try {
            console.log('Initializing YouTube player');
                    setTimeout(initializeYouTubePlayer, 100);
                }
                return true;
            }

            // If the script tag exists but the API isn't fully initialized yet
            if (document.querySelector('script[src*="youtube.com/iframe_api"]') && window.YT) {
                console.log('YouTube API script exists but not fully initialized');
                // Don't add another script, just wait
                return false;
            }

            // Clear any existing onYouTubeIframeAPIReady to avoid conflicts
            if (window.onYouTubeIframeAPIReady) {
                console.log('Overriding existing onYouTubeIframeAPIReady');
            }
            
            // Define the callback function that YouTube API will call when ready
            window.onYouTubeIframeAPIReady = function() {
                console.log('YouTube API Ready - Initializing player');
                // Small delay to ensure the API is fully initialized
                setTimeout(() => {
                    if (checkYouTubeAPIReady()) {
                        initializeYouTubePlayer();
                    } else {
                        console.error('YouTube API ready event fired, but API is not available');
                        setError('YouTube player failed to initialize. Please refresh the page.');
                    }
                }, 500);
            };
            
            // Remove any existing failed YouTube API script tags
            const existingScripts = document.querySelectorAll('script[src*="youtube.com/iframe_api"]');
            existingScripts.forEach(script => {
                if (!script.getAttribute('data-loading')) {
                    script.parentNode.removeChild(script);
                }
            });
            
            // Add the script tag with loading marker
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            tag.async = true;
            tag.crossOrigin = "anonymous"; // Try to avoid CORS issues
            tag.setAttribute('data-loading', 'true');
            tag.onerror = () => {
                console.error('Failed to load YouTube API script');
                tag.setAttribute('data-loading', 'false');
                setApiLoadingFailed(true);
                setError('Failed to load YouTube API. This might be due to network issues or content blockers.');
            };
            
            // Set a timeout to detect if script loading fails silently
            const scriptLoadTimeout = setTimeout(() => {
                if (!checkYouTubeAPIReady()) {
                    console.error('YouTube API script load timeout');
                    setApiLoadingFailed(true);
                    setError('YouTube API took too long to load. This might be due to network issues or content blockers.');
                }
            }, 8000);
            
            // Add success handler to clear timeout
            tag.onload = () => {
                clearTimeout(scriptLoadTimeout);
                console.log('YouTube API script loaded successfully');
                // The API itself will call onYouTubeIframeAPIReady when ready
            };
            
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            
            console.log('YouTube IFrame API script added');
            return false;
        };
        
        // Try to load YouTube API
        const initialLoadSuccessful = loadYouTubeAPI();
        
        // Set multiple fallbacks with increasing delays
        const fallbackTimers = [];
        
        if (!initialLoadSuccessful) {
            // First fallback after 3 seconds
            fallbackTimers.push(setTimeout(() => {
                if (!player && !isReady && !checkYouTubeAPIReady()) {
                    console.log('YouTube API not ready after 3s, trying again');
                    setLoadingAttempts(prev => prev + 1);
                    loadYouTubeAPI();
                }
            }, 3000));
            
            // Second fallback after 6 seconds
            fallbackTimers.push(setTimeout(() => {
                if (!player && !isReady && !checkYouTubeAPIReady()) {
                    console.log('YouTube API not ready after 6s, trying force init');
                    // Force initialization even if API appears not ready
                    setLoadingAttempts(prev => prev + 1);
                    initializeYouTubePlayer();
                }
            }, 6000));
            
            // Final check at 10 seconds - if still failing, mark as failed
            fallbackTimers.push(setTimeout(() => {
                if (!player && !isReady && !checkYouTubeAPIReady()) {
                    console.log('YouTube API still not available after 10s');
                    setApiLoadingFailed(true);
                    setError('YouTube player failed to initialize. This might be due to network issues or ad blockers.');
                }
            }, 10000));
        }
        
        // Clean up all timers on unmount
        return () => {
            fallbackTimers.forEach(clearTimeout);
        };
    }, [player, isReady, loadingAttempts]);

    // Extract YouTube video ID from various YouTube URL formats
    const getYouTubeVideoId = (url) => {
        if (!url) return null;
        
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        
        return (match && match[2].length === 11) ? match[2] : null;
    };

    // Handle form submission for adding videos
    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!inputUrl.trim()) {
            setError('Please enter a YouTube URL');
            return;
        }
        
        // Automatically prepend https:// if not present
        let processedUrl = inputUrl.trim();
        if (!processedUrl.startsWith('http')) {
            processedUrl = 'https://' + processedUrl;
        }
        
        // In direct embed mode, we don't need to check for player readiness
        if (!useDirectEmbed && (!isReady || !player)) {
            console.log('Player not ready on submit, initializing...');
            setError('YouTube player is initializing. Please wait a moment and try again.');
            
            // If API loading failed multiple times, suggest direct embed mode
            if (apiLoadingFailed) {
                setError('YouTube API failed to load. Please use the Basic Player option.');
                return;
            }
            
            // Try to initialize the player
            initializeYouTubePlayer();
            return;
        }
        
        // Extract the video ID
        const videoId = getYouTubeVideoId(processedUrl);
        
        if (videoId) {
            // Check if this video is already in the queue
            const existingVideo = videoQueue.find(v => v.videoId === videoId);
            if (existingVideo) {
                setError('This video is already in your queue!');
                setTimeout(() => setError(null), 3000);
                return;
            }
            
            const videoTitle = `YouTube Video ${videoQueue.length + 1}`;
            const newVideo = {
                id: Date.now().toString(),
                videoId: videoId,
                title: videoTitle,
                originalUrl: processedUrl
            };

            // Add to queue first so it's visible
            const updatedQueue = [...videoQueue, newVideo];
            setVideoQueue(updatedQueue);
            setInputUrl('');
            
            // If queue was empty, load this video immediately
            if (videoQueue.length === 0) {
                setError('Video added! Loading video...');
                loadVideo(videoId);
                setTimeout(() => {
                    setError('Video loaded! Click the play button to start.');
                    setTimeout(() => setError(null), 3000);
                }, 1000);
            } else {
                setError('Video added to queue!');
                setTimeout(() => setError(null), 3000);
            }

            // Broadcast to other users
            broadcastVideoQueueUpdate(updatedQueue);
        } else {
            // Special handling for common mistakes
            if (inputUrl.includes('youtu.be') || inputUrl.includes('youtube.com')) {
                setError('Unable to extract video ID from URL. Please check that it\'s a valid YouTube link.');
            } else {
                setError('Invalid YouTube URL. Please enter a valid YouTube link like: https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            }
        }
    };

    // Create YouTube player when container is ready
    const initializeYouTubePlayer = () => {
        // Safety check for YouTube API
        if (!window.YT || !window.YT.Player || typeof window.YT.Player !== 'function') {
            console.log('YouTube API not yet loaded or not properly initialized');
            setError('YouTube player is still initializing. Please wait...');
            
            // Increment attempt counter
            window.apiLoadAttempts = (window.apiLoadAttempts || 0) + 1;
            
            // After multiple failed attempts, mark as failed
            if (window.apiLoadAttempts >= 3) {
                console.log('Multiple API load attempts failed, marking as failed');
                setApiLoadingFailed(true);
                setError('YouTube API failed to load. This might be due to network issues or content blockers.');
                return;
            }
            
            // Try to reload the API if it seems missing
            if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
                console.log('YouTube API script missing, adding it');
                const tag = document.createElement('script');
                tag.src = 'https://www.youtube.com/iframe_api';
                tag.async = true;
                tag.crossOrigin = "anonymous"; // Try to avoid CORS issues
                const firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            }
            
            // Retry after a delay with exponential backoff
            const delay = Math.min(1000 * Math.pow(1.5, window.apiLoadAttempts), 5000);
            setTimeout(initializeYouTubePlayer, delay);
            return;
        }

        // Safety check for the container
        if (!playerContainerRef.current) {
            console.log('Player container not ready');
            setError('Video player container not ready. Please wait...');
            setTimeout(initializeYouTubePlayer, 500);
            return;
        }

        // Prevent multiple initializations
        if (player) {
            console.log('Player already initialized, skipping');
            return;
        }

        console.log('Initializing YouTube player now');
        
        try {
            // First, create a fresh container div to avoid initialization issues
            const oldContainer = playerContainerRef.current;
            const parent = oldContainer.parentNode;
            
            if (!parent) {
                console.error('Cannot find parent node of player container');
                setError('Player container error. Please refresh the page.');
                return;
            }
            
            // Create new container
            const newContainer = document.createElement('div');
            newContainer.id = 'youtube-player';
            
            // Replace old with new
            parent.replaceChild(newContainer, oldContainer);
            
            // Update our ref to point to the new container
            playerContainerRef.current = newContainer;
        } catch (error) {
            console.error('Error preparing player container:', error);
            setError('Error initializing player. Please refresh the page.');
            return;
        }
        
        try {
            // Pre-check that YouTube API is ready
            if (typeof window.YT?.Player !== 'function') {
                throw new Error('YouTube API is not properly initialized');
            }

            console.log('Creating new YouTube player instance');
            
            // Use a reliable test video ID for initialization
            // We use a short, widely-available video that's unlikely to be removed
            const testVideoId = 'dQw4w9WgXcQ'; // Never Gonna Give You Up
            
            // Create the player with proper configuration
            const newPlayer = new window.YT.Player(newContainer, {
                height: '100%',
                width: '100%',
                videoId: testVideoId,
                playerVars: {
                    'autoplay': 0,
                    'controls': 1,        // Enable player controls
                    'rel': 0,             // Don't show related videos
                    'fs': 1,              // Allow fullscreen
                    'modestbranding': 1,  // Minimal YouTube branding
                    'enablejsapi': 1,     // Enable JavaScript API
                    'origin': window.location.origin,
                    'playsinline': 1,     // Play inline on mobile
                    'iv_load_policy': 3   // Hide annotations
                },
                events: {
                    'onReady': onPlayerReady,
                    'onStateChange': onPlayerStateChange,
                    'onError': (event) => {
                        console.error('YouTube Player Error:', event.data);
                        
                        // Map error codes to user-friendly messages
                        const errorMessages = {
                            2: 'Invalid video URL or the video ID is incorrect',
                            5: 'The requested content cannot be played in an HTML5 player',
                            100: 'The video has been removed or marked as private',
                            101: 'The video owner does not allow embedded playback',
                            150: 'The video owner does not allow embedded playback'
                        };
                        
                        const errorMessage = errorMessages[event.data] || `YouTube player error (code: ${event.data})`;
                        setError(errorMessage);
                        
                        // Recover by clearing the video
                        setTimeout(() => {
                            try {
                                if (newPlayer && typeof newPlayer.cueVideoById === 'function') {
                                    // Clear the current video
                                    newPlayer.cueVideoById('');
                                }
                            } catch (e) {
                                console.error('Error recovering from YouTube error:', e);
                            }
                        }, 1000);
                    }
                }
            });
            
            // Store player reference in state
            setPlayer(newPlayer);
            console.log('YouTube player instance created successfully');
        } catch (error) {
            console.error('Error initializing YouTube player:', error);
            setError('Failed to initialize YouTube player. Please refresh the page and try again.');
        }
    };

    useEffect(() => {
        // Initialize player once when component mounts
        if (!player) {
            initializeYouTubePlayer();
        }
        
        // Clean up player on unmount
        return () => {
            if (player) {
                try {
                    player.destroy();
                } catch (e) {
                    console.error("Error destroying player:", e);
                }
            }
        };
    }, []);

    // When player is ready
    const onPlayerReady = (event) => {
        console.log('YouTube player ready event received');
        
        // Verify the player instance is valid
        if (!event || !event.target || typeof event.target.getPlayerState !== 'function') {
            console.error('Invalid player instance in onPlayerReady');
            // Try to reinitialize
            setTimeout(initializeYouTubePlayer, 1000);
            return;
        }
        
        // Update ready state
        setIsReady(true);
        
        // Additional safety check to make sure API is fully functional
        try {
            const playerState = event.target.getPlayerState();
            console.log('Initial player state:', playerState);
            
            // Stop the test video immediately to avoid autoplay
            event.target.stopVideo();
            
            // If we have a pending video from previous attempts, load it
            if (window.pendingVideoId) {
                console.log('Loading pending video:', window.pendingVideoId);
                const pendingId = window.pendingVideoId;
                window.pendingVideoId = null; // Clear pending ID first to avoid loops
                loadVideo(pendingId);
            }
            // If no pending video but we have videos in queue, load the first one
            else if (videoQueue.length > 0) {
                console.log('Loading queued video:', videoQueue[0].videoId);
                loadVideo(videoQueue[0].videoId);
            } 
            // If no video to load, clear the player to show instructions overlay
            else {
                console.log('No videos to load, showing instructions');
                event.target.cueVideoById('');
            }
            
            // Display success message
            setError('YouTube player ready! You can now add videos.');
            setTimeout(() => setError(null), 3000);
            
        } catch (error) {
            // If any error occurs during initialization, log and recover
            console.error('Error in player ready handler:', error);
            setError('Player encountered an error during initialization. Retrying...');
            
            // Try to reinitialize if a critical error occurs
            setTimeout(() => {
                if (player) {
                    try {
                        player.destroy();
                    } catch (e) {}
                    setPlayer(null);
                }
                setTimeout(initializeYouTubePlayer, 1000);
            }, 500);
        }
    };

    // Handle player state changes
    const onPlayerStateChange = (event) => {
        // YouTube states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
        console.log('Player state changed to:', event.data);
        
        if (event.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
            
            // Only broadcast if not triggered by another user
            if (isUserAction) {
                console.log('Broadcasting play state');
                broadcastPlaybackState(true, player.getCurrentTime());
                setIsUserAction(false);
            }
            
            // Start time tracking
            startTimeTracking();
        } 
        else if (event.data === window.YT.PlayerState.PAUSED) {
            setIsPlaying(false);
            
            // Only broadcast if not triggered by another user
            if (isUserAction) {
                console.log('Broadcasting pause state');
                broadcastPlaybackState(false, player.getCurrentTime());
                setIsUserAction(false);
            }
            
            // Stop time tracking
            stopTimeTracking();
        } 
        else if (event.data === window.YT.PlayerState.ENDED) {
            // Play next video
            setIsPlaying(false);
            stopTimeTracking();
            playNextVideo();
        }
        else if (event.data === window.YT.PlayerState.CUED) {
            console.log('Video cued - ready to play');
            setCurrentTime(0);
            setIsPlaying(false);
        }
    };
    
    let timeTrackingInterval = null;
    
    // Track current playback time
    const startTimeTracking = () => {
        stopTimeTracking();
        timeTrackingInterval = setInterval(() => {
            if (player && player.getCurrentTime) {
                const time = player.getCurrentTime();
                setCurrentTime(time);
                
                if (player.getDuration) {
                    setDuration(player.getDuration());
                }
            }
        }, 1000);
    };
    
    const stopTimeTracking = () => {
        if (timeTrackingInterval) {
            clearInterval(timeTrackingInterval);
        }
    };

    // Load a video by ID
    const loadVideo = (videoId) => {
        if (!videoId) {
            console.error('Invalid video ID');
            setError('Invalid video ID. Please check the URL and try again.');
            return;
        }
        
        // Always update current video ID for direct embed mode
        setCurrentVideoId(videoId);
        
        // If using direct embed mode, we need to set up time tracking
        if (useDirectEmbed) {
            console.log('Using direct embed mode for video:', videoId);
            setError(null);
            setIsReady(true);
            
            // For direct embed, we need to manually track time
            stopTimeTracking(); // Clear any existing interval
            
            // Set up a polling interval to update the current time
            // This is necessary because we can't directly get time from the iframe
            timeTrackingInterval = setInterval(() => {
                setCurrentTime(prev => {
                    // If playing, advance time by 1 second
                    if (isPlaying) {
                        return Math.min(prev + 1, duration || 3600); // Cap at duration or 1 hour
                    }
                    return prev;
                });
            }, 1000);
            
            return;
        }
        
        // Check if player is properly initialized
        const isPlayerReady = player && 
                             isReady && 
                             typeof player.cueVideoById === 'function' && 
                             typeof player.getPlayerState === 'function';
        
        if (!isPlayerReady) {
            console.log('Player not ready to load video', videoId);
            
            // Store the videoId to load when player is ready
            window.pendingVideoId = videoId;
            
            // Update message to user
            setError('YouTube player is still initializing. Your video will load momentarily...');
            
            // Reset retry count if needed
            if (!window.playerInitRetries) {
                window.playerInitRetries = 0;
            }
            
            // Try again with increasing delays (exponential backoff)
            window.playerInitRetries++;
            const delay = Math.min(2000 * window.playerInitRetries, 10000);
            
            // After multiple retries, suggest using direct embed
            if (window.playerInitRetries >= 3 && !useDirectEmbed) {
                setApiLoadingFailed(true);
                return;
            }
            
            setTimeout(() => {
                // If player is still not ready, reinitialize
                if (!player || !isReady) {
                    console.log(`Player still not ready after ${delay}ms, reinitializing...`);
                    
                    // Attempt to fix by reinitializing
                    if (window.playerInitRetries >= 2) {
                        // On second retry, force a full reinitialization
                        if (player) {
                            try {
                                player.destroy();
                                setPlayer(null);
                            } catch (e) {
                                console.error("Error destroying player:", e);
                            }
                        }
                    }
                    
                    // Try to initialize
                    initializeYouTubePlayer();
                }
                
                // Try loading the video again
                setTimeout(() => loadVideo(videoId), Math.min(delay/2, 1000));
            }, delay);
            
            return;
        }
        
        // Reset retry counter on successful load attempt
        window.playerInitRetries = 0;
        
        console.log('Loading video ID:', videoId);
        
        try {
            // First pause any current playback
            try {
                if (player.pauseVideo) {
                    player.pauseVideo();
                }
            } catch (e) {
                console.error('Error pausing current video:', e);
            }
            
            // Then clear error state
            setError(null);
            
            // Use cueVideoById with explicit parameters
            player.cueVideoById({
                videoId: videoId,
                startSeconds: 0,
                suggestedQuality: 'default'
            });
            
            setCurrentTime(0);
            setDuration(0); // Reset duration until we get the new one
            
            // Verify that video loaded correctly
            setTimeout(() => {
                try {
                    const state = player.getPlayerState();
                    if (state === -1) { // Unstarted
                        const currentVideoId = player.getVideoData ? player.getVideoData().video_id : null;
                        if (currentVideoId !== videoId) {
                            console.error('Video failed to load properly');
                            setError('Video failed to load. Please try another URL.');
                        }
                    }
                } catch (e) {
                    console.error('Error checking video state:', e);
                }
            }, 2000);
            
            console.log('Video cued successfully');
        } catch (error) {
            console.error('Error loading video:', error);
            setError('Error loading video. Please try again with another URL.');
            
            // If there was an error, try reinitializing the player
            setTimeout(() => {
                if (player) {
                    try {
                        console.log('Reinitializing player after error');
                        player.destroy();
                    } catch (e) {}
                    setTimeout(() => {
                        initializeYouTubePlayer();
                        // Don't auto-reload to avoid infinite error loops
                    }, 2000);
                }
            }, 1000);
        }
    };

    // Play/pause toggle
    const togglePlayPause = () => {
        // For direct embed mode, we need to use the iframe's contentWindow.postMessage
        if (useDirectEmbed) {
            const iframe = document.querySelector('.direct-embed-iframe');
            if (iframe && iframe.contentWindow) {
                const command = isPlaying ? 'pauseVideo' : 'playVideo';
                iframe.contentWindow.postMessage(JSON.stringify({
                    event: 'command',
                    func: command,
                    args: []
                }), '*');
                
                // Update state locally since we don't get events from iframe
                setIsPlaying(!isPlaying);
                setIsUserAction(true);
                
                // Broadcast state to other users
                broadcastPlaybackState(!isPlaying, currentTime);
            }
            return;
        }
        
        // Regular YouTube API mode
        if (!player) return;
        
        setIsUserAction(true);
        
        if (isPlaying) {
            player.pauseVideo();
        } else {
            player.playVideo();
        }
    };

    // Skip to next video in queue
    const playNextVideo = () => {
        if (videoQueue.length <= 1) return;
        
        const updatedQueue = [...videoQueue.slice(1)];
        setVideoQueue(updatedQueue);
        
        if (updatedQueue.length > 0) {
            loadVideo(updatedQueue[0].videoId);
            setIsUserAction(true);
            
            // For direct embed mode, we need to handle play differently
            if (useDirectEmbed) {
                setIsPlaying(true);
                // Play will happen automatically when iframe reloads
            } else if (player) {
                setTimeout(() => player.playVideo(), 500);
            }
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
            loadVideo(updatedQueue[0].videoId);
        } else if (updatedQueue.length === 0) {
            // No more videos
            if (player) {
                player.stopVideo();
            }
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
        loadVideo(selectedVideo.videoId);
        setIsUserAction(true);
        
        // For direct embed mode, we need to handle play differently
        if (useDirectEmbed) {
            setIsPlaying(true);
            // Play will happen automatically when iframe reloads
        } else if (player) {
            setTimeout(() => player.playVideo(), 500);
        }
        
        // Broadcast updated queue
        broadcastVideoQueueUpdate(updatedQueue);
    };

    // Seek to a specific position
    const handleSeek = (e) => {
        if (!duration) return;
        
        const percent = parseFloat(e.target.value);
        const newTime = (duration * percent) / 100;
        
        setCurrentTime(newTime);
        setIsUserAction(true);
        
        // Handle seeking differently based on player mode
        if (useDirectEmbed) {
            // For direct embed, use postMessage API
            const iframe = document.querySelector('.direct-embed-iframe');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage(JSON.stringify({
                    event: 'command',
                    func: 'seekTo',
                    args: [newTime, true]
                }), '*');
            }
        } else if (player) {
            player.seekTo(newTime, true);
        }
        
        // Broadcast seek position
        broadcastPlaybackState(isPlaying, newTime);
    };

    // Broadcast functions to update other users
    const broadcastVideoQueueUpdate = (queue) => {
        try {
            console.log("Broadcasting queue update");
            
            // Check if we need to reinitialize the player
            if (queue.length > 0 && !player) {
                console.log("Queue has videos but no player, trying to initialize");
                initializeYouTubePlayer();
            }
            
            collaborationManager.sendMessage({
                type: 'video-queue-update',
                queue: queue,
                currentTime: currentTime,
                isPlaying: isPlaying,
                timestamp: Date.now(),
                senderId: collaborationManager.currentUser?.id || 'unknown'
            });
        } catch (error) {
            console.error('Error broadcasting queue update:', error);
        }
    };

    const broadcastPlaybackState = (playing, time) => {
        try {
            console.log("Broadcasting playback state:", playing ? "PLAY" : "PAUSE", "at time", time);
            collaborationManager.sendMessage({
                type: 'video-playback-update',
                isPlaying: playing,
                currentTime: time,
                videoId: videoQueue.length > 0 ? videoQueue[0].videoId : null,
                timestamp: Date.now(), // Add timestamp for ordering messages
                senderId: collaborationManager.currentUser?.id || 'unknown' // Add sender info
            });
        } catch (error) {
            console.error('Error broadcasting playback state:', error);
        }
    };

    // Listen for collaboration messages
    useEffect(() => {
        const handleCollaborationMessage = (message) => {
            console.log("Received collaboration message:", message);
            
            if (!message || typeof message !== 'object') return;
            
            // Check if this message is from ourselves
            const isOwnMessage = message.senderId === collaborationManager.currentUser?.id;
            if (isOwnMessage) {
                console.log("Ignoring own message");
                return;
            }
            
            if (message.type === 'video-queue-update') {
                console.log("Updating video queue from remote");
                setVideoQueue(message.queue || []);
                
                // If we got a new first video, load it
                if (message.queue && message.queue.length > 0 && player && isReady) {
                    const currentVideoId = player.getVideoData ? player.getVideoData().video_id : null;
                    const newVideoId = message.queue[0].videoId;
                    
                    if (currentVideoId !== newVideoId) {
                        loadVideo(newVideoId);
                    }
                }
            }
            else if (message.type === 'video-playback-update') {
                console.log("Updating playback state from remote:", message.isPlaying ? "PLAY" : "PAUSE", "at time", message.currentTime);
                
                // Handle differently for direct embed mode vs regular player
                if (useDirectEmbed) {
                    if (message.videoId && message.videoId !== currentVideoId) {
                        // Need to load a different video in direct embed mode
                        console.log(`Loading different video in direct embed: ${message.videoId}`);
                        setCurrentVideoId(message.videoId);
                        
                        // Set timeout to update state after video loads
                        setTimeout(() => {
                            setCurrentTime(message.currentTime || 0);
                            setIsPlaying(message.isPlaying);
                        }, 1000);
                    } else {
                        // Just update play state and seek position
                        const iframe = document.querySelector('.direct-embed-iframe');
                        if (iframe && iframe.contentWindow) {
                            // First seek to correct position
                            if (Math.abs(currentTime - message.currentTime) > 1) {
                                iframe.contentWindow.postMessage(JSON.stringify({
                                    event: 'command',
                                    func: 'seekTo',
                                    args: [message.currentTime || 0, true]
                                }), '*');
                                setCurrentTime(message.currentTime || 0);
                            }
                            
                            // Then update play/pause state
                            setTimeout(() => {
                                const command = message.isPlaying ? 'playVideo' : 'pauseVideo';
                                iframe.contentWindow.postMessage(JSON.stringify({
                                    event: 'command',
                                    func: command,
                                    args: []
                                }), '*');
                                setIsPlaying(message.isPlaying);
                            }, 100);
                        }
                    }
                    return;
                }
                
                // For regular YouTube API mode
                if (!player || !isReady) {
                    console.log("Player not ready, ignoring playback update");
                    return;
                }
                
                // Check if we need to load a different video
                if (message.videoId) {
                    const currentVideoId = player.getVideoData ? player.getVideoData().video_id : null;
                    
                    if (currentVideoId !== message.videoId) {
                        console.log(`Loading different video: ${message.videoId} (current: ${currentVideoId})`);
                        loadVideo(message.videoId);
                        
                        // Use a promise to handle the video loading sequence properly
                        const waitForCued = new Promise((resolve) => {
                            // Check player state every 100ms
                            const checkInterval = setInterval(() => {
                                try {
                                    const state = player.getPlayerState();
                                    if (state === window.YT.PlayerState.CUED) {
                                        clearInterval(checkInterval);
                                        resolve();
                                    }
                                } catch (err) {
                                    console.error("Error checking player state:", err);
                                }
                            }, 100);
                            
                            // Timeout after 5 seconds
                            setTimeout(() => {
                                clearInterval(checkInterval);
                                resolve();
                            }, 5000);
                        });
                        
                        waitForCued.then(() => {
                            console.log("Video cued, now applying remote playback state");
                            player.seekTo(message.currentTime || 0, true);
                            
                            if (message.isPlaying) {
                                player.playVideo();
                            }
                        });
                        
                        return;
                    }
                }
                
                // Apply playback state
                try {
                    console.log(`Syncing playback - Remote: ${message.isPlaying ? "playing" : "paused"}, Local: ${isPlaying ? "playing" : "paused"}`);
                    
                    // Seek to position if time difference is significant
                    const currentPlayerTime = player.getCurrentTime ? player.getCurrentTime() : 0;
                    if (Math.abs(currentPlayerTime - message.currentTime) > 1) {
                        console.log(`Seeking from ${currentPlayerTime} to ${message.currentTime}`);
                        player.seekTo(message.currentTime || 0, true);
                    }
                    
                    // Apply play/pause state AFTER seeking
                    setTimeout(() => {
                        if (message.isPlaying && !isPlaying) {
                            console.log("Remote says PLAY, playing video");
                            player.playVideo();
                        } else if (!message.isPlaying && isPlaying) {
                            console.log("Remote says PAUSE, pausing video");
                            player.pauseVideo();
                        }
                    }, 100);
                    
                } catch (error) {
                    console.error('Error applying remote playback state:', error);
                }
            }
        };

        // Subscribe to custom messages
        try {
            console.log("Subscribing to collaboration messages");
            collaborationManager.on('custom-message', handleCollaborationMessage);
        } catch (error) {
            console.error('Error subscribing to collaboration events:', error);
        }

        return () => {
            try {
                console.log("Unsubscribing from collaboration messages");
                collaborationManager.off('custom-message', handleCollaborationMessage);
            } catch (error) {
                console.error('Error unsubscribing from collaboration events:', error);
            }
        };
    }, [player, isReady]);
    
    // Handle direct embed iframe communication
    useEffect(() => {
        if (!useDirectEmbed) return;
        
        // Handle messages from the iframe
        const handleIframeMessage = (event) => {
            // Verify message origin for security
            if (!event.origin.includes('youtube.com')) return;
            
            // Parse the message data
            try {
                let data;
                if (typeof event.data === 'string') {
                    try {
                        data = JSON.parse(event.data);
                    } catch (e) {
                        // YouTube sometimes sends non-JSON messages that we can ignore
                        return;
                    }
                } else {
                    data = event.data;
                }
                
                // Process player events
                if (data.event === 'onStateChange') {
                    // YouTube states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
                    console.log('Direct embed player state changed:', data.info);
                    
                    // Update play/pause state
                    if (data.info === 1) { // Playing
                        setIsPlaying(true);
                        if (isUserAction) {
                            broadcastPlaybackState(true, currentTime);
                            setIsUserAction(false);
                        }
                    } else if (data.info === 2) { // Paused
                        setIsPlaying(false);
                        if (isUserAction) {
                            broadcastPlaybackState(false, currentTime);
                            setIsUserAction(false);
                        }
                    } else if (data.info === 0) { // Ended
                        setIsPlaying(false);
                        playNextVideo();
                    }
                }
            } catch (error) {
                console.error('Error handling iframe message:', error);
            }
        };
        
        window.addEventListener('message', handleIframeMessage);
        
        // Clean up
        return () => {
            window.removeEventListener('message', handleIframeMessage);
        };
    }, [useDirectEmbed, isUserAction, currentTime]);

    // Format time in MM:SS format
    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return "00:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="video-player-container">
            <h2>Collaborative YouTube Player</h2>
            
            <form onSubmit={handleSubmit} className="video-url-form">
                <input
                    type="url"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="Paste YouTube video URL here (e.g., https://www.youtube.com/watch?v=...)"
                    className="video-url-input"
                />
                <button 
                    type="submit" 
                    className="video-submit-btn"
                >
                    <Plus size={16} />
                    Add to Queue
                </button>
            </form>
            
            {error && (
                <p className={`video-message ${error.includes('Invalid') || error.includes('Error') || error.includes('fail') ? 'video-error' : 'video-success'}`}>
                    {error}
                </p>
            )}
            
            <div className="video-player">
                <div className="video-responsive">
                    {!useDirectEmbed && <div ref={playerContainerRef} id="youtube-player"></div>}
                    
                    {/* Direct iframe embed fallback */}
                    {useDirectEmbed && videoQueue.length > 0 && currentVideoId && (
                        <iframe 
                            src={createEmbedUrl(currentVideoId)}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="direct-embed-iframe"
                            id="youtube-iframe-player"
                        ></iframe>
                    )}
                    
                    {!isReady && !apiLoadingFailed && (
                        <div className="player-loading-overlay">
                            <div className="loading-spinner"></div>
                            <p>Initializing YouTube player...</p>
                            <p className="loading-hint">Please wait while the player loads...</p>
                        </div>
                    )}
                    {!isReady && apiLoadingFailed && !useDirectEmbed && (
                        <div className="player-error-overlay">
                            <AlertTriangle size={48} color="#f44336" />
                            <h3>YouTube Player Failed to Load</h3>
                            <p>This could be caused by:</p>
                            <ul className="error-causes">
                                <li>Network connectivity issues</li>
                                <li>Ad blockers or content blockers</li>
                                <li>YouTube API restrictions</li>
                            </ul>
                            <div className="error-buttons">
                                <button 
                                    className="retry-button"
                                    onClick={() => {
                                        setApiLoadingFailed(false);
                                        setLoadingAttempts(0);
                                        window.apiLoadAttempts = 0;
                                        setError("Retrying YouTube player initialization...");
                                        setTimeout(() => initializeYouTubePlayer(), 500);
                                    }}
                                >
                                    <RefreshCw size={16} />
                                    Retry Loading Player
                                </button>
                                
                                <button 
                                    className="fallback-button"
                                    onClick={() => {
                                        setUseDirectEmbed(true);
                                        setIsReady(true);
                                        setError("Using direct YouTube embed mode. Some collaborative features may be limited.");
                                        setTimeout(() => setError(null), 5000);
                                    }}
                                >
                                    Use Basic Player
                                </button>
                            </div>
                        </div>
                    )}
                    {isReady && videoQueue.length === 0 && (
                        <div className="player-instructions-overlay">
                            <p>1. Paste a YouTube video URL above</p>
                            <p>2. Click "Add to Queue" button</p>
                            <p>3. Use the play button to start watching</p>
                        </div>
                    )}
                </div>
                
                <div className="playback-controls">
                    <button 
                        onClick={togglePlayPause}
                        className="round-button play-pause-button"
                        disabled={!isReady || videoQueue.length === 0}
                    >
                        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    
                    <div className="timeline-container">
                        <span className="time-display">{formatTime(currentTime)}</span>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={(duration && currentTime) ? (currentTime / duration) * 100 : 0}
                            className="timeline-slider"
                            onChange={handleSeek}
                            disabled={!isReady || videoQueue.length === 0}
                        />
                        <span className="time-display">{formatTime(duration)}</span>
                    </div>
                    
                    <button 
                        onClick={playNextVideo}
                        disabled={!isReady || videoQueue.length <= 1}
                        className="round-button next-button"
                    >
                        <SkipForward size={18} />
                    </button>
                </div>
            </div>
            
            <div className="video-queue-container">
                <h3 className="queue-title">Queue ({videoQueue.length} videos)</h3>
                {videoQueue.length > 0 ? (
                    <ul className="queue-list">
                        {videoQueue.map((video, index) => (
                            <li 
                                key={video.id} 
                                className={`queue-item ${index === 0 ? 'now-playing' : ''}`}
                            >
                                <div className="queue-item-info">
                                    <span className={`queue-item-number ${index === 0 ? 'current' : ''}`}>
                                        {index + 1}
                                    </span>
                                    <span className="queue-item-title">
                                        {video.title}
                                        <a href={video.originalUrl} target="_blank" rel="noopener noreferrer" 
                                           className="external-link">
                                            <ExternalLink size={14} />
                                        </a>
                                    </span>
                                </div>
                                <div className="queue-item-actions">
                                    {index !== 0 && (
                                        <button 
                                            onClick={() => selectVideo(index)}
                                            className="queue-action-button play-now-button"
                                        >
                                            Play Now
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => removeFromQueue(index)}
                                        className="queue-action-button remove-button"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="empty-queue-message">No videos in queue</p>
                )}
            </div>
        </div>
    );
}

export default YoutubePlayer;
