import React, { useState, useEffect, useRef } from 'react';
import { Upload, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Crown } from 'lucide-react';
import collaborationManager from '../../utils/collaborationManager';
import './videoplayer.css';
import './LocalVideoPlayer.css';

function LocalVideoPlayer({ roomId, currentUser }) {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [syncInterval, setSyncInterval] = useState(null);
  
  const videoRef = useRef(null);
  const seekBarRef = useRef(null);
  
  // Generate a unique key for local storage based on the room
  const getLocalStorageKey = (type) => `coopchat_video_${roomId}_${type}`;
  
  // Clear local storage for this room's video
  const clearLocalStorage = () => {
    localStorage.removeItem(getLocalStorageKey('videoUrl'));
    localStorage.removeItem(getLocalStorageKey('videoName'));
    localStorage.removeItem(getLocalStorageKey('host'));
    localStorage.removeItem(getLocalStorageKey('timestamp'));
    console.log("Cleared local storage for room video:", roomId);
  };
  
  // Check if user is the host
  useEffect(() => {
    if (!roomId || !currentUser) return;
    
    // Mark the first user who shared a video as the host
    const storedHost = localStorage.getItem(getLocalStorageKey('host'));
    
    if (storedHost) {
      setIsHost(storedHost === currentUser.id);
    }
    
    // Load video from localStorage if available
    const savedVideoUrl = localStorage.getItem(getLocalStorageKey('videoUrl'));
    const savedVideoName = localStorage.getItem(getLocalStorageKey('videoName'));
    
    if (savedVideoUrl) {
      console.log("Loading video from local storage");
      setVideoUrl(savedVideoUrl);
      if (savedVideoName) {
        setVideoFile({
          name: savedVideoName
        });
      }
    }
    
    // Request video info when joining
    collaborationManager.sendMessage({
      type: 'local-video-info-request',
      roomId,
      userId: currentUser.id,
      userName: currentUser.name,
      timestamp: new Date().toISOString()
    });
    
    // Listen for user left events
    const handleUserLeft = (userData) => {
      // If the host left, check if we're the oldest remaining user
      if (userData.id === storedHost) {
        console.log("Host left, need to elect new host");
        collaborationManager.sendMessage({
          type: 'local-video-host-election',
          roomId,
          userId: currentUser.id,
          userName: currentUser.name,
          joinTimestamp: currentUser.joinTimestamp,
          timestamp: new Date().toISOString()
        });
      }
    };
    
    collaborationManager.on('user-left', handleUserLeft);
    
    return () => {
      collaborationManager.off('user-left', handleUserLeft);
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [roomId, currentUser]);
  
  // Handle video file upload
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check if file is a video
    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    // Create form data
    const formData = new FormData();
    formData.append('video', file);
    
    // Upload to server
    fetch('http://localhost:3002/api/upload-video', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        const videoData = data.video;
        const fullVideoUrl = `http://localhost:3002${videoData.url}`;
        
        setVideoFile(file);
        setVideoUrl(fullVideoUrl);
        setIsHost(true);
        setIsLoading(false);
        
        // Store host info in localStorage
        localStorage.setItem(getLocalStorageKey('host'), currentUser.id);
        localStorage.setItem(getLocalStorageKey('videoUrl'), fullVideoUrl);
        localStorage.setItem(getLocalStorageKey('videoName'), file.name);
        
        // Broadcast to other users
        broadcastVideoInfo(fullVideoUrl, file.name);
      } else {
        setError(data.error || 'Failed to upload video');
        setIsLoading(false);
      }
    })
    .catch(err => {
      console.error('Upload error:', err);
      setError('Failed to upload video. Please try again.');
      setIsLoading(false);
    });
  };
  
  // Broadcast video info to other users
  const broadcastVideoInfo = (url, name) => {
    collaborationManager.sendMessage({
      type: 'local-video-info',
      roomId,
      userId: currentUser.id,
      userName: currentUser.name,
      videoUrl: url,
      videoName: name,
      timestamp: new Date().toISOString()
    });
  };
  
  // Toggle play/pause
  const togglePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    
    setIsPlaying(!isPlaying);
    
    // If host, broadcast play state
    if (isHost) {
      broadcastPlaybackState(!isPlaying, currentTime);
    }
  };
  
  // Broadcast playback state
  const broadcastPlaybackState = (playing, time) => {
    if (!isHost) return;
    
    collaborationManager.sendMessage({
      type: 'local-video-playback-state',
      roomId,
      userId: currentUser.id,
      userName: currentUser.name,
      isPlaying: playing,
      currentTime: time,
      timestamp: new Date().toISOString()
    });
  };
  
  // Handle seeking
  const handleSeek = (e) => {
    if (!videoRef.current || !seekBarRef.current) return;
    
    const percent = e.target.value;
    const newTime = (duration * percent) / 100;
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    
    // If host, broadcast seek position
    if (isHost) {
      broadcastPlaybackState(isPlaying, newTime);
    }
  };
  
  // Toggle mute
  const toggleMute = () => {
    if (!videoRef.current) return;
    
    if (isMuted) {
      videoRef.current.volume = volume;
    } else {
      videoRef.current.volume = 0;
    }
    
    setIsMuted(!isMuted);
  };
  
  // Handle volume change
  const handleVolumeChange = (e) => {
    if (!videoRef.current) return;
    
    const newVolume = e.target.value / 100;
    setVolume(newVolume);
    
    if (!isMuted) {
      videoRef.current.volume = newVolume;
    }
  };
  
  // Format time (seconds to mm:ss)
  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Update seek bar and time display
  const updateProgressBar = () => {
    if (!videoRef.current || !seekBarRef.current) return;
    
    const time = videoRef.current.currentTime;
    const dur = videoRef.current.duration;
    
    setCurrentTime(time);
    
    if (dur) {
      const percent = (time / dur) * 100;
      seekBarRef.current.value = percent;
    }
    
    // Send sync updates if host (at lower frequency)
    if (isHost && time % 5 < 0.5) {
      broadcastPlaybackState(isPlaying, time);
    }
  };
  
  // Listen for video events
  useEffect(() => {
    if (!videoRef.current) return;
    
    const videoElement = videoRef.current;
    
    const handleLoadedMetadata = () => {
      setDuration(videoElement.duration);
      console.log(`Video loaded: ${videoElement.duration}s`);
    };
    
    const handlePlay = () => {
      setIsPlaying(true);
      if (isHost) {
        broadcastPlaybackState(true, videoElement.currentTime);
      }
    };
    
    const handlePause = () => {
      setIsPlaying(false);
      if (isHost) {
        broadcastPlaybackState(false, videoElement.currentTime);
      }
    };
    
    const handleTimeUpdate = () => {
      updateProgressBar();
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      if (isHost) {
        broadcastPlaybackState(false, videoElement.duration);
      }
    };
    
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('ended', handleEnded);
    
    return () => {
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('ended', handleEnded);
    };
  }, [videoRef.current, isHost]);
  
  // Listen for messages from other users
  useEffect(() => {
    const handleMessage = (msg) => {
      if (msg.roomId !== roomId) return;
      
      // Another user shared a video
      if (msg.type === 'local-video-info') {
        console.log('Received video info:', msg);
        
        // Store video info locally
        localStorage.setItem(getLocalStorageKey('host'), msg.userId);
        localStorage.setItem(getLocalStorageKey('videoUrl'), msg.videoUrl);
        localStorage.setItem(getLocalStorageKey('videoName'), msg.videoName);
        
        setVideoUrl(msg.videoUrl);
        setIsHost(msg.userId === currentUser.id);
      }
      
      // Host is controlling playback
      else if (msg.type === 'local-video-playback-state' && msg.userId !== currentUser.id) {
        console.log('Received playback state:', msg);
        
        if (!videoRef.current) return;
        
        // Only non-host users should sync to host's state
        if (!isHost) {
          // Sync time if difference is significant (>0.5s)
          const timeDiff = Math.abs(msg.currentTime - videoRef.current.currentTime);
          if (timeDiff > 0.5) {
            videoRef.current.currentTime = msg.currentTime;
          }
          
          // Sync play state
          if (msg.isPlaying && videoRef.current.paused) {
            videoRef.current.play();
          } else if (!msg.isPlaying && !videoRef.current.paused) {
            videoRef.current.pause();
          }
        }
      }
      
      // New user requesting video info
      else if (msg.type === 'local-video-info-request' && msg.userId !== currentUser.id && isHost) {
        console.log('Received video info request from:', msg.userName);
        
        // If we're the host and have a video, send the info
        if (videoUrl) {
          broadcastVideoInfo(
            videoUrl,
            localStorage.getItem(getLocalStorageKey('videoName'))
          );
        }
      }
      
      // Host election message (when host leaves)
      else if (msg.type === 'local-video-host-election') {
        // Compare join timestamps to elect the oldest user as new host
        const ourTimestamp = currentUser.joinTimestamp || Date.now();
        const theirTimestamp = msg.joinTimestamp || Date.now();
        
        if (ourTimestamp < theirTimestamp) {
          console.log('I am becoming the new host');
          setIsHost(true);
          localStorage.setItem(getLocalStorageKey('host'), currentUser.id);
          
          // Broadcast that I'm the new host
          collaborationManager.sendMessage({
            type: 'local-video-new-host',
            roomId,
            userId: currentUser.id,
            userName: currentUser.name,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // New host announcement
      else if (msg.type === 'local-video-new-host') {
        console.log('New host announced:', msg.userName);
        localStorage.setItem(getLocalStorageKey('host'), msg.userId);
        setIsHost(msg.userId === currentUser.id);
      }
    };
    
    collaborationManager.addMessageListener(handleMessage);
    return () => collaborationManager.removeMessageListener(handleMessage);
  }, [roomId, currentUser, isHost, videoUrl]);
  
  // Load video from localStorage when component mounts
  useEffect(() => {
    if (roomId) {
      const storedUrl = localStorage.getItem(getLocalStorageKey('videoUrl'));
      const storedHost = localStorage.getItem(getLocalStorageKey('host'));
      
      if (storedUrl) {
        setVideoUrl(storedUrl);
        setIsHost(storedHost === currentUser?.id);
      }
    }
  }, [roomId, currentUser]);
  
  return (
    <div className="local-video-player">
      <div className="video-header">
        <h2>Share and Watch Videos Together</h2>
        {isHost && (
          <div className="host-badge"><Crown size={14} style={{marginRight: '6px'}} /> You are the host</div>
        )}
        <div className="upload-section">
          <label className="upload-button">
            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <Upload size={18} />
            <span>Share from your PC</span>
          </label>
          <p className="upload-info">Supported formats: MP4, WebM, OGG (max 50MB)</p>
        </div>
      </div>
      
      {isLoading ? (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Uploading and processing video...</p>
          <p className="loading-subtext">This may take a moment depending on the video size</p>
        </div>
      ) : error ? (
        <div className="error-message">
          <p>{error}</p>
        </div>
      ) : videoUrl ? (
        <div className="video-container">
          <video
            ref={videoRef}
            src={videoUrl}
            className="main-video"
            preload="metadata"
          />
          
          <div className="video-controls">
            <div className="playback-controls">
              <button
                className="control-button"
                onClick={togglePlayPause}
                disabled={!isHost && !videoRef.current}
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>
              
              <div className="time-display">
                <span>{formatTime(currentTime)}</span>
                <span> / </span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
            
            <div className="seek-container">
              <input
                ref={seekBarRef}
                type="range"
                className="seek-bar"
                min="0"
                max="100"
                step="0.1"
                defaultValue="0"
                onChange={handleSeek}
                disabled={!isHost}
              />
            </div>
            
            <div className="volume-controls">
              <button
                className="control-button"
                onClick={toggleMute}
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              
              <input
                type="range"
                className="volume-bar"
                min="0"
                max="100"
                step="1"
                defaultValue="100"
                onChange={handleVolumeChange}
              />
            </div>
          </div>
          
          {!isHost && (
            <div className="sync-message">
              <p>Playback is controlled by the host</p>
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <Upload size={48} className="upload-icon" />
          <h3>No video shared yet</h3>
          <p>Share videos from your PC and watch together with your friends in real-time</p>
          <p className="empty-state-tips">
            <strong>How it works:</strong>
            <br/>• Click "Share from your PC" to upload a video
            <br/>• The uploader becomes the host and controls playback
            <br/>• Everyone in the room watches the same video simultaneously
            <br/>• Video stays synchronized across all viewers
          </p>
          <label className="big-upload-button">
            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <Upload size={18} />
            <span>Share a video</span>
          </label>
        </div>
      )}
      
    </div>
  );
}

export default LocalVideoPlayer;
