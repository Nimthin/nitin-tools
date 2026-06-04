'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PixelIcon from '@/components/PixelIcon';
import './dinoplay.css';

// Helper to extract YouTube video ID from various URL formats
function extractYoutubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : url.trim();
}

// Helper to format seconds into MM:SS
function formatTime(secs) {
  if (isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Helper to convert SRT file format to WebVTT format client-side
function convertSrtToVtt(srtText) {
  let vtt = srtText.trim();
  // Convert commas to periods in timestamps
  vtt = vtt.replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2');
  return 'WEBVTT\n\n' + vtt;
}

function DinoPlayComponent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomQuery = searchParams.get('room');

  // User Identifiers (persisted in localStorage)
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [lobbyError, setLobbyError] = useState('');

  // Local state copy of current room info
  const [members, setMembers] = useState({});
  const [messages, setMessages] = useState([]);
  const [activeVideoName, setActiveVideoName] = useState('');
  const [activeVideoSource, setActiveVideoSource] = useState('');
  const [activeSourceType, setActiveSourceType] = useState('none'); // 'none' | 'file' | 'url' | 'youtube'

  // Input states for Media Loader
  const [mediaTab, setMediaTab] = useState('file'); // 'file' | 'url' | 'youtube'
  const [directUrl, setDirectUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedLocalFile, setSelectedLocalFile] = useState(null);
  const [localBlobUrl, setLocalBlobUrl] = useState('');
  const [filePromptName, setFilePromptName] = useState('');

  // Live Chat input state
  const [chatText, setChatText] = useState('');

  // Synchronisation indicators
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'buffering' | 'disconnected'
  const [isCopied, setIsCopied] = useState(false);

  // References for Player Sync Engine
  const videoRef = useRef(null); // HTML5 <video> element
  const ytPlayerRef = useRef(null); // YouTube API player instance
  const [ytApiReady, setYtApiReady] = useState(false);

  // Sync locks & logs
  const isSyncingRef = useRef(false);
  const lastSyncedVersion = useRef(0);
  const pendingActionRef = useRef(null);
  const authoritativeTimeRef = useRef(0);
  const authoritativePlayingRef = useRef(false);
  const lastReportedTime = useRef(0);
  const pollIntervalRef = useRef(null);
  const chatEndRef = useRef(null);
  const wrapperRef = useRef(null);
  const externalAudioRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Refs that mirror state to prevent stale closures in syncRoom
  const activeVideoSourceRef = useRef(activeVideoSource);
  const activeSourceTypeRef = useRef(activeSourceType);
  const activeVideoNameRef = useRef(activeVideoName);
  const localBlobUrlRef = useRef(localBlobUrl);
  const latestFetchId = useRef(0);
  const prevVolumeRef = useRef(1.0);

  // Keep refs in sync with state
  useEffect(() => { activeVideoSourceRef.current = activeVideoSource; }, [activeVideoSource]);
  useEffect(() => { activeSourceTypeRef.current = activeSourceType; }, [activeSourceType]);
  useEffect(() => { activeVideoNameRef.current = activeVideoName; }, [activeVideoName]);
  useEffect(() => { localBlobUrlRef.current = localBlobUrl; }, [localBlobUrl]);

  // Subtitle, custom audio track and volume states
  const [subtitleUrl, setSubtitleUrl] = useState('');
  const [subtitleName, setSubtitleName] = useState('');
  const [externalAudioUrl, setExternalAudioUrl] = useState('');
  const [externalAudioName, setExternalAudioName] = useState('');
  const [volume, setVolume] = useState(1.0);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);

  // FFmpeg scan & extract states
  const [detectedAudioTracks, setDetectedAudioTracks] = useState([]);
  const [detectedSubtitleTracks, setDetectedSubtitleTracks] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState('');
  const [activeAudioTrackIndex, setActiveAudioTrackIndex] = useState(-1);
  const [activeSubtitleTrackIndex, setActiveSubtitleTrackIndex] = useState(-1);
  const [ffmpegLogs, setFfmpegLogs] = useState([]);

  // Initialize client settings
  useEffect(() => {
    // Retrieve or generate unique client-side userId
    let savedUserId = localStorage.getItem('dinoplay-user-id');
    if (!savedUserId) {
      savedUserId = `dino-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('dinoplay-user-id', savedUserId);
    }
    setUserId(savedUserId);

    // Retrieve previous username
    const savedName = localStorage.getItem('dinoplay-username');
    if (savedName) {
      setUsername(savedName);
    }

    // Pre-fill room code from URL query parameter
    if (roomQuery) {
      setRoomCode(roomQuery.toUpperCase());
    }
  }, [roomQuery]);

  // Load YouTube Player API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYtApiReady(true);
      return;
    }

    // Register globally accessible callback
    window.onYouTubeIframeAPIReady = () => {
      setYtApiReady(true);
    };

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  }, []);

  // Handle native browser fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Close custom context menu on any click outside
  useEffect(() => {
    const closeMenu = () => setContextMenu(prev => prev.visible ? { ...prev, visible: false } : prev);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const toggleFullscreen = () => {
    if (!wrapperRef.current) return;
    
    if (!document.fullscreenElement && 
        !document.webkitFullscreenElement && 
        !document.mozFullScreenElement && 
        !document.msFullscreenElement) {
      const req = wrapperRef.current.requestFullscreen || 
                  wrapperRef.current.webkitRequestFullscreen || 
                  wrapperRef.current.mozRequestFullScreen || 
                  wrapperRef.current.msRequestFullscreen;
      if (req) {
        req.call(wrapperRef.current).catch(err => {
          console.error("Failed to enter fullscreen:", err);
        });
      }
    } else {
      const exit = document.exitFullscreen || 
                   document.webkitExitFullscreen || 
                   document.mozCancelFullScreen || 
                   document.msExitFullscreen;
      if (exit) {
        exit.call(document).catch(err => {
          console.error("Failed to exit fullscreen:", err);
        });
      }
    }
  };

  // Scroll to bottom of chat when new events come in
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Active synchronization heartbeat loop
  // Uses refs for video state to prevent stale closure bugs
  const syncRoom = useCallback(async (action = null, extraState = {}, optionalMessage = null) => {
    if (!roomCode || !userId) return;

    if (action) {
      pendingActionRef.current = action;
    }

    // Read latest values from refs (never stale)
    const curSource = activeVideoSourceRef.current;
    const curType = activeSourceTypeRef.current;
    const curName = activeVideoNameRef.current;
    const curBlobUrl = localBlobUrlRef.current;

    let localTime = 0;
    let isPlaying = false;
    let localSpeed = 1.0;

    // Fetch current coordinates from active player
    if (curType === 'youtube' && ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
      try {
        localTime = ytPlayerRef.current.getCurrentTime();
        isPlaying = ytPlayerRef.current.getPlayerState() === window.YT.PlayerState.PLAYING;
        localSpeed = ytPlayerRef.current.getPlaybackRate() || 1.0;
      } catch (e) {}
    } else if (videoRef.current) {
      localTime = videoRef.current.currentTime;
      isPlaying = !videoRef.current.paused;
      localSpeed = videoRef.current.playbackRate || 1.0;
    }

    const fetchId = ++latestFetchId.current;

    try {
      const response = await fetch('/api/dinoplay/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: roomCode,
          userId,
          username: username || 'Guest',
          playerState: {
            currentTime: action ? (extraState.currentTime ?? localTime) : localTime,
            playing: action ? (extraState.playing ?? isPlaying) : isPlaying,
            playbackRate: action ? (extraState.playbackRate ?? localSpeed) : localSpeed,
            videoSource: action === 'loadVideo' ? extraState.videoSource : curSource,
            sourceType: action === 'loadVideo' ? extraState.sourceType : curType,
            videoName: action === 'loadVideo' ? extraState.videoName : curName,
          },
          action,
          message: optionalMessage
        })
      });

      if (fetchId !== latestFetchId.current) {
        return; // Ignore stale request
      }

      if (!response.ok) {
        throw new Error('Sync endpoint error');
      }

      const data = await response.json();
      
      if (fetchId !== latestFetchId.current) {
        return; // Ignore stale request
      }

      if (action === pendingActionRef.current) {
        pendingActionRef.current = null;
      }

      // Update room metadata and messages
      setMembers(data.members || {});
      setMessages(data.messages || []);
      setSyncStatus(data.isDemo ? 'buffering' : 'synced');

      const serverState = data.playerState;
      if (!serverState) return;

      // Re-read refs for freshest comparison values
      const latestSource = activeVideoSourceRef.current;
      const latestType = activeSourceTypeRef.current;

      // Ignore stale responses to prevent race conditions
      if (serverState.version < lastSyncedVersion.current) {
        return;
      }

      // Ignore incoming updates from heartbeat/other actions while loading media locally
      if (pendingActionRef.current === 'loadVideo' && action !== 'loadVideo') {
        return;
      }

      // Handle video source changes loaded by other peers
      if (serverState.videoSource !== latestSource || serverState.sourceType !== latestType) {
        setActiveVideoSource(serverState.videoSource);
        setActiveSourceType(serverState.sourceType);
        setActiveVideoName(serverState.videoName);
        
        // Reset file prompts
        if (serverState.sourceType === 'file') {
          if (serverState.senderId !== userId || !curBlobUrl) {
            setFilePromptName(serverState.videoName);
            setSelectedLocalFile(null);
            setLocalBlobUrl('');
          } else {
            setFilePromptName('');
          }
        } else {
          setFilePromptName('');
        }
        
        // Reset sync indicators
        lastSyncedVersion.current = serverState.version;
        return;
      }

      // Authoritative synchronization triggers
      authoritativeTimeRef.current = serverState.currentTime;
      authoritativePlayingRef.current = serverState.playing;

      // Case A: Higher version detected (active user command: seek, play, pause)
      if (serverState.version > lastSyncedVersion.current) {
        lastSyncedVersion.current = serverState.version;
        applyRemoteState(serverState);
      } 
      // Case B: Passive sync checks (drift corrector)
      else if (serverState.version === lastSyncedVersion.current && serverState.senderId !== userId) {
        if (!pendingActionRef.current) {
          checkDrift(serverState);
        }
      }
    } catch (err) {
      if (fetchId !== latestFetchId.current) {
        return; // Ignore stale request
      }
      console.error('Error synchronizing room state:', err);
      if (action === pendingActionRef.current) {
        pendingActionRef.current = null;
      }
      setSyncStatus('disconnected');
    }
  }, [roomCode, userId, username]);

  // Apply server instructions directly to the DOM players
  const applyRemoteState = (serverState) => {
    isSyncingRef.current = true;
    const now = Date.now();
    const elapsed = serverState.playing ? (now - serverState.updatedAt) / 1000 : 0;
    const targetTime = serverState.currentTime + elapsed;

    if (serverState.sourceType === 'youtube' && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.seekTo(targetTime, true);
        if (serverState.playing) {
          ytPlayerRef.current.playVideo();
        } else {
          ytPlayerRef.current.pauseVideo();
        }
        if (typeof ytPlayerRef.current.setPlaybackRate === 'function') {
          ytPlayerRef.current.setPlaybackRate(serverState.playbackRate);
        }
      } catch (e) {}
    } else if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
      if (serverState.playing) {
        videoRef.current.volume = volume;
        videoRef.current.muted = externalAudioUrl ? true : (volume === 0);
        videoRef.current.play().catch(() => {
          // Fallback if browser blocks autoplay (requires interaction)
          setSyncStatus('buffering');
        });
        if (externalAudioRef.current) {
          externalAudioRef.current.currentTime = targetTime;
          externalAudioRef.current.volume = volume;
          externalAudioRef.current.muted = volume === 0;
          externalAudioRef.current.play().catch(() => {});
        }
      } else {
        videoRef.current.pause();
        if (externalAudioRef.current) {
          externalAudioRef.current.pause();
        }
      }
      videoRef.current.playbackRate = serverState.playbackRate;
      if (externalAudioRef.current) {
        externalAudioRef.current.playbackRate = serverState.playbackRate;
      }
    }

    // Release synchronization lock shortly after player adjusts
    setTimeout(() => {
      isSyncingRef.current = false;
    }, 200);
  };

  // Inspect client time vs authoritative time, correction seeks if > 1.5s drift
  const checkDrift = (serverState) => {
    if (isSyncingRef.current) return;

    const now = Date.now();
    const elapsed = serverState.playing ? (now - serverState.updatedAt) / 1000 : 0;
    const authoritativeTime = serverState.currentTime + elapsed;

    let clientTime = 0;
    let clientPlaying = false;

    if (serverState.sourceType === 'youtube' && ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
      try {
        clientTime = ytPlayerRef.current.getCurrentTime();
        clientPlaying = ytPlayerRef.current.getPlayerState() === window.YT.PlayerState.PLAYING;
      } catch (e) {}
    } else if (videoRef.current) {
      clientTime = videoRef.current.currentTime;
      clientPlaying = !videoRef.current.paused;
    }

    // Force matching playback state
    if (clientPlaying !== serverState.playing) {
      isSyncingRef.current = true;
      if (serverState.sourceType === 'youtube' && ytPlayerRef.current) {
        try {
          if (serverState.playing) ytPlayerRef.current.playVideo();
          else ytPlayerRef.current.pauseVideo();
        } catch (e) {}
      } else if (videoRef.current) {
        if (serverState.playing) {
          videoRef.current.volume = volume;
          videoRef.current.muted = externalAudioUrl ? true : (volume === 0);
          videoRef.current.play().catch(() => {});
          if (externalAudioRef.current) {
            externalAudioRef.current.volume = volume;
            externalAudioRef.current.muted = volume === 0;
            externalAudioRef.current.play().catch(() => {});
          }
        } else {
          videoRef.current.pause();
          if (externalAudioRef.current) {
            externalAudioRef.current.pause();
          }
        }
      }
      setTimeout(() => { isSyncingRef.current = false; }, 200);
    }

    // Seek to adjust timestamp if drift exceeds threshold
    const drift = Math.abs(clientTime - authoritativeTime);
    if (drift > 1.5) {
      isSyncingRef.current = true;
      if (serverState.sourceType === 'youtube' && ytPlayerRef.current) {
        try {
          ytPlayerRef.current.seekTo(authoritativeTime, true);
        } catch (e) {}
      } else if (videoRef.current) {
        videoRef.current.currentTime = authoritativeTime;
        if (externalAudioRef.current) externalAudioRef.current.currentTime = authoritativeTime;
      }
      setTimeout(() => { isSyncingRef.current = false; }, 200);
    }
  };

  // Broadcast user actions (play/pause/seek) to server
  const sendPlayerAction = useCallback((action, time, rate = 1.0) => {
    if (isSyncingRef.current) return;
    
    let isPlaying = false;
    if (action === 'play') isPlaying = true;
    else if (action === 'pause') isPlaying = false;
    else {
      // Seek / Rate matches current player states
      if (activeSourceTypeRef.current === 'youtube' && ytPlayerRef.current) {
        isPlaying = ytPlayerRef.current.getPlayerState() === window.YT.PlayerState.PLAYING;
      } else if (videoRef.current) {
        isPlaying = !videoRef.current.paused;
      }
    }

    syncRoom(action, {
      currentTime: time,
      playing: isPlaying,
      playbackRate: rate
    });
  }, [syncRoom]);

  // Hook local player HTML5 events
  const handleHtml5Play = () => {
    if (externalAudioRef.current) {
      externalAudioRef.current.currentTime = videoRef.current.currentTime;
      externalAudioRef.current.play().catch(() => {});
    }
    if (isSyncingRef.current) return;
    sendPlayerAction('play', videoRef.current.currentTime);
  };

  const handleHtml5Pause = () => {
    if (externalAudioRef.current) {
      externalAudioRef.current.pause();
    }
    if (isSyncingRef.current) return;
    if (videoRef.current.seeking) return; // Prevent double action on seeking
    sendPlayerAction('pause', videoRef.current.currentTime);
  };

  const handleHtml5Seeked = () => {
    if (externalAudioRef.current) {
      externalAudioRef.current.currentTime = videoRef.current.currentTime;
    }
    if (isSyncingRef.current) return;
    sendPlayerAction('seek', videoRef.current.currentTime);
  };

  const handleHtml5RateChange = () => {
    if (externalAudioRef.current) {
      externalAudioRef.current.playbackRate = videoRef.current.playbackRate;
    }
    if (isSyncingRef.current) return;
    sendPlayerAction('rate', videoRef.current.currentTime, videoRef.current.playbackRate);
  };

  // Hook YouTube player state triggers
  const handleYoutubeStateChange = (event) => {
    if (isSyncingRef.current) return;
    const state = event.data;
    const time = event.target.getCurrentTime();

    if (state === window.YT.PlayerState.PLAYING) {
      sendPlayerAction('play', time);
    } else if (state === window.YT.PlayerState.PAUSED) {
      sendPlayerAction('pause', time);
    }
  };

  // YouTube seek monitor (polls time differences to catch seekbar drags)
  useEffect(() => {
    let checkInterval;
    if (activeSourceType === 'youtube' && ytPlayerRef.current) {
      let lastTime = 0;
      checkInterval = setInterval(() => {
        if (isSyncingRef.current) return;
        try {
          const currentTime = ytPlayerRef.current.getCurrentTime();
          const state = ytPlayerRef.current.getPlayerState();
          
          // If time jumps by more than 1.5s while playing/paused, user manually seeked
          if (Math.abs(currentTime - lastTime) > 1.5 && (state === 1 || state === 2)) {
            sendPlayerAction('seek', currentTime);
          }
          lastTime = currentTime;
        } catch (e) {}
      }, 500);
    }
    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [activeSourceType, sendPlayerAction]);

  // Instantiate or update YouTube player iframe
  useEffect(() => {
    if (!ytApiReady || activeSourceType !== 'youtube' || !activeVideoSource) {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
        try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
      }
      return;
    }

    if (ytPlayerRef.current) {
      try {
        ytPlayerRef.current.loadVideoById(activeVideoSource);
        try {
          if (typeof ytPlayerRef.current.setVolume === 'function') {
            ytPlayerRef.current.setVolume(volume * 100);
          }
          if (typeof ytPlayerRef.current.unMute === 'function' && typeof ytPlayerRef.current.mute === 'function') {
            if (volume === 0) ytPlayerRef.current.mute();
            else ytPlayerRef.current.unMute();
          }
        } catch (vErr) {}
        isSyncingRef.current = true;
        ytPlayerRef.current.seekTo(authoritativeTimeRef.current, true);
        if (authoritativePlayingRef.current) {
          ytPlayerRef.current.playVideo();
        } else {
          ytPlayerRef.current.pauseVideo();
        }
        setTimeout(() => { isSyncingRef.current = false; }, 300);
      } catch (e) {
        console.error('Existing YT player loading error, will re-instantiate:', e);
      }
    } else {
      try {
        ytPlayerRef.current = new window.YT.Player('yt-player', {
          videoId: activeVideoSource,
          playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            origin: window.location.origin
          },
          events: {
            onReady: (event) => {
              isSyncingRef.current = true;
              try {
                event.target.setVolume(volume * 100);
                if (volume === 0) {
                  event.target.mute();
                } else {
                  event.target.unMute();
                }
              } catch (vErr) {}
              event.target.seekTo(authoritativeTimeRef.current, true);
              if (authoritativePlayingRef.current) {
                event.target.playVideo();
              } else {
                event.target.pauseVideo();
              }
              setTimeout(() => { isSyncingRef.current = false; }, 300);
            },
            onStateChange: handleYoutubeStateChange
          }
        });
      } catch (err) {
        console.error('Failed to mount new YT Player:', err);
      }
    }
  }, [ytApiReady, activeSourceType, activeVideoSource]);

  // Handle active polling intervals
  useEffect(() => {
    if (inRoom) {
      // Run immediately on join
      syncRoom();
      
      // Set recurring heartbeat checks
      pollIntervalRef.current = setInterval(() => {
        syncRoom();
      }, 1500);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [inRoom, syncRoom]);

  // Synchronize volume and mute states across all active players
  useEffect(() => {
    // 1. Sync HTML5 Video Player
    if (videoRef.current) {
      videoRef.current.volume = volume;
      if (externalAudioUrl) {
        videoRef.current.muted = true; // Must be muted when playing external audio
      } else {
        videoRef.current.muted = volume === 0;
      }
    }

    // 2. Sync HTML5 Audio Player
    if (externalAudioRef.current) {
      externalAudioRef.current.volume = volume;
      externalAudioRef.current.muted = volume === 0;
    }

    // 3. Sync YouTube Player
    if (activeSourceType === 'youtube' && ytPlayerRef.current) {
      try {
        if (typeof ytPlayerRef.current.setVolume === 'function') {
          ytPlayerRef.current.setVolume(volume * 100);
        }
        if (typeof ytPlayerRef.current.unMute === 'function' && typeof ytPlayerRef.current.mute === 'function') {
          if (volume === 0) {
            ytPlayerRef.current.mute();
          } else {
            ytPlayerRef.current.unMute();
          }
        }
      } catch (err) {}
    }
  }, [volume, activeSourceType, activeVideoSource, externalAudioUrl, localBlobUrl]);

  // Join Room workflow
  const handleJoinRoom = (e) => {
    e.preventDefault();
    setLobbyError('');

    if (!username.trim()) {
      setLobbyError('Please choose a username.');
      return;
    }
    if (!roomCode.trim() || roomCode.length < 4) {
      setLobbyError('Enter a valid 4-digit room code.');
      return;
    }

    const uppercaseCode = roomCode.trim().toUpperCase();
    localStorage.setItem('dinoplay-username', username.trim());
    setRoomCode(uppercaseCode);
    setInRoom(true);

    // Update query parameters in address bar
    router.push(`/tools/dinoplay?room=${uppercaseCode}`);
  };

  // Host Room workflow
  const handleHostRoom = (e) => {
    e.preventDefault();
    setLobbyError('');

    if (!username.trim()) {
      setLobbyError('Please choose a username.');
      return;
    }

    // Generate random 4-digit numeric code
    const generatedCode = Math.floor(1000 + Math.random() * 9000).toString();
    localStorage.setItem('dinoplay-username', username.trim());
    setRoomCode(generatedCode);
    setInRoom(true);

    router.push(`/tools/dinoplay?room=${generatedCode}`);
  };

  const closeOrRedirectHome = () => {
    try {
      window.close();
    } catch (e) {}
    setTimeout(() => {
      router.push('/');
    }, 150);
  };

  // Exit Room workflow
  const handleExitRoom = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    // Revoke object urls to clear cache
    if (localBlobUrl) URL.revokeObjectURL(localBlobUrl);
    if (subtitleUrl) URL.revokeObjectURL(subtitleUrl);
    if (externalAudioUrl) URL.revokeObjectURL(externalAudioUrl);

    // Destroy YT Player reference
    ytPlayerRef.current = null;
    
    closeOrRedirectHome();
  };

  const handleContextMenu = (e) => {
    if (activeSourceType === 'youtube' || activeSourceType === 'none') return;
    
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Position menu relative to container
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    
    // Boundary check (prevent overflow, menu is approx 220px wide and 320px tall)
    if (x + 220 > rect.width) x = rect.width - 220;
    if (y + 320 > rect.height) y = rect.height - 320;
    if (x < 0) x = 0;
    if (y < 0) y = 0;

    setContextMenu({
      visible: true,
      x,
      y
    });
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
  };

  const handleSubtitleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        let content = event.target.result;
        if (file.name.endsWith('.srt')) {
          content = convertSrtToVtt(content);
        }
        if (subtitleUrl) {
          URL.revokeObjectURL(subtitleUrl);
        }
        const blob = new Blob([content], { type: 'text/vtt' });
        const url = URL.createObjectURL(blob);
        setSubtitleUrl(url);
        setSubtitleName(file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleExternalAudioChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (externalAudioUrl) {
        URL.revokeObjectURL(externalAudioUrl);
      }
      const url = URL.createObjectURL(file);
      setExternalAudioUrl(url);
      setExternalAudioName(file.name);
      
      if (videoRef.current) {
        videoRef.current.muted = true;
      }
    }
  };

  // Load a video source globally in the room
  const handleLoadMedia = (e) => {
    e.preventDefault();
    
    let source = '';
    let name = '';

    if (mediaTab === 'file') {
      if (!selectedLocalFile) return;
      source = 'local-file'; // Local files are resolved client-side via name mapping
      name = selectedLocalFile.name;
    } else if (mediaTab === 'url') {
      if (!directUrl.trim()) return;
      source = directUrl.trim();
      name = source.split('/').pop().split('?')[0] || 'Direct Stream Video';
    } else if (mediaTab === 'youtube') {
      if (!youtubeUrl.trim()) return;
      const ytId = extractYoutubeId(youtubeUrl);
      if (!ytId) {
        alert('Invalid YouTube URL or Video ID');
        return;
      }
      source = ytId;
      name = `YouTube ID: ${ytId}`;
    }

    // Update local state immediately for instant feedback and to bypass reset prompts
    setActiveVideoSource(source);
    setActiveSourceType(mediaTab);
    setActiveVideoName(name);
    setFilePromptName('');

    // Update refs immediately to prevent heartbeat races using stale values
    activeVideoSourceRef.current = source;
    activeSourceTypeRef.current = mediaTab;
    activeVideoNameRef.current = name;

    syncRoom('loadVideo', {
      videoSource: source,
      sourceType: mediaTab,
      videoName: name,
      playing: false,
      currentTime: 0
    });

    // Clear loaders
    setDirectUrl('');
    setYoutubeUrl('');
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  };

  const stopVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      sendPlayerAction('pause', 0);
    }
  };

  const toggleMute = () => {
    if (volume > 0) {
      prevVolumeRef.current = volume;
      setVolume(0);
    } else {
      setVolume(prevVolumeRef.current || 1.0);
    }
  };

  // Handle local file selection for syncing local files
  const handleLocalFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedLocalFile(file);
      const blobUrl = URL.createObjectURL(file);
      setLocalBlobUrl(blobUrl);
      localBlobUrlRef.current = blobUrl; // Update ref immediately
      
      // If we are satisfying a sync prompt
      if (filePromptName === file.name) {
        setFilePromptName('');
      }
    }
  };

  // Clear all scanned tracks when resetting or loading new media
  const clearDetectedTracks = () => {
    setDetectedAudioTracks([]);
    setDetectedSubtitleTracks([]);
    setActiveAudioTrackIndex(-1);
    setActiveSubtitleTrackIndex(-1);
    setIsScanning(false);
    setScanProgress('');
    setIsExtracting(false);
    setExtractionProgress('');
    setFfmpegLogs([]);
  };

  // Perform automatic scan of local files when they are selected
  useEffect(() => {
    if (!selectedLocalFile) {
      clearDetectedTracks();
      return;
    }

    const performScan = async () => {
      setIsScanning(true);
      setScanProgress('Initializing MediaInfo scanner...');
      setFfmpegLogs([]);
      try {
        const { scanTracks } = await import('./trackScanner');
        const result = await scanTracks(selectedLocalFile, (progress, logMsg) => {
          setScanProgress(progress || '');
          if (logMsg) {
            setFfmpegLogs((prev) => [...prev.slice(-15), logMsg]);
          }
        });
        if (result.error) {
          console.error('Scan error:', result.error);
          alert(`MediaInfo scanning failed: ${result.error}`);
        } else if (result.skipped) {
          console.log('Scan skipped: file too large or unsupported');
        } else {
          setDetectedAudioTracks(result.audioTracks || []);
          setDetectedSubtitleTracks(result.subtitleTracks || []);
        }
      } catch (err) {
        console.error('Failed scanning tracks:', err);
        alert(`MediaInfo load failed: ${err.message}`);
      } finally {
        setIsScanning(false);
        setScanProgress('');
      }
    };

    performScan();
  }, [selectedLocalFile]);

  // Extract and apply alternate embedded audio tracks
  const handleSelectEmbeddedAudio = async (track) => {
    setIsExtracting(true);
    setExtractionProgress(`Extracting audio: ${track.label}...`);
    setFfmpegLogs([]);
    
    let wasPlaying = false;
    if (videoRef.current) {
      wasPlaying = !videoRef.current.paused;
      videoRef.current.pause();
    }
    if (externalAudioRef.current) {
      externalAudioRef.current.pause();
    }

    try {
      const { extractAudio } = await import('./trackScanner');
      const url = await extractAudio(selectedLocalFile, track.index, (progress, logMsg) => {
        setExtractionProgress(progress || '');
        if (logMsg) {
          setFfmpegLogs((prev) => [...prev.slice(-15), logMsg]);
        }
      });
      if (url) {
        if (externalAudioUrl) URL.revokeObjectURL(externalAudioUrl);
        setExternalAudioUrl(url);
        setExternalAudioName(track.label);
        setActiveAudioTrackIndex(track.index);
        
        if (videoRef.current) {
          videoRef.current.muted = true;
          setTimeout(() => {
            if (externalAudioRef.current && videoRef.current) {
              externalAudioRef.current.currentTime = videoRef.current.currentTime;
              externalAudioRef.current.playbackRate = videoRef.current.playbackRate;
              if (wasPlaying) {
                externalAudioRef.current.play().catch(() => {});
                videoRef.current.play().catch(() => {});
              }
            }
          }, 100);
        }
      } else {
        alert('Failed to extract audio track. Check developer console/logs.');
        if (wasPlaying && videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
      }
    } catch (err) {
      console.error('Failed audio extraction:', err);
      alert(`Audio extraction failed: ${err.message}`);
      if (wasPlaying && videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
    } finally {
      setIsExtracting(false);
      setExtractionProgress('');
    }
  };

  // Restore default audio track
  const handleSelectDefaultAudio = () => {
    if (externalAudioUrl) {
      URL.revokeObjectURL(externalAudioUrl);
      setExternalAudioUrl('');
      setExternalAudioName('');
    }
    setActiveAudioTrackIndex(-1);
    if (videoRef.current) {
      videoRef.current.muted = volume === 0;
      videoRef.current.volume = volume;
      if (externalAudioRef.current) {
        externalAudioRef.current.pause();
      }
    }
  };

  // Extract and apply alternate embedded subtitle tracks
  const handleSelectEmbeddedSubtitle = async (track) => {
    setIsExtracting(true);
    setExtractionProgress(`Extracting subtitle: ${track.label}...`);
    setFfmpegLogs([]);
    try {
      const { extractSubtitle } = await import('./trackScanner');
      const url = await extractSubtitle(selectedLocalFile, track.index, (progress, logMsg) => {
        setExtractionProgress(progress || '');
        if (logMsg) {
          setFfmpegLogs((prev) => [...prev.slice(-15), logMsg]);
        }
      });
      if (url) {
        if (subtitleUrl) URL.revokeObjectURL(subtitleUrl);
        setSubtitleUrl(url);
        setSubtitleName(track.label);
        setSubtitlesEnabled(true);
        setActiveSubtitleTrackIndex(track.index);
      } else {
        alert('Failed to extract subtitle track. Check developer console/logs.');
      }
    } catch (err) {
      console.error('Failed subtitle extraction:', err);
      alert(`Subtitle extraction failed: ${err.message}`);
    } finally {
      setIsExtracting(false);
      setExtractionProgress('');
    }
  };

  // Disable subtitles selection
  const handleDisableSubtitles = () => {
    setSubtitlesEnabled(false);
    setActiveSubtitleTrackIndex(-1);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const isVideo = file.type.startsWith('video/') || ['mkv', 'mp4', 'webm', 'avi', 'mov'].includes(ext);
      if (isVideo) {
        setSelectedLocalFile(file);
        const blobUrl = URL.createObjectURL(file);
        setLocalBlobUrl(blobUrl);
        localBlobUrlRef.current = blobUrl; // Update ref immediately
        if (filePromptName === file.name) {
          setFilePromptName('');
        }
      }
    }
  };

  // Submit chat messages
  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatText.trim()) return;

    syncRoom(null, {}, { text: chatText.trim() });
    setChatText('');
  };

  // Copy share invite link
  const copyInviteLink = () => {
    const url = `${window.location.origin}/tools/dinoplay?room=${roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  // Unload current active media
  const handleUnloadMedia = () => {
    if (subtitleUrl) {
      URL.revokeObjectURL(subtitleUrl);
      setSubtitleUrl('');
      setSubtitleName('');
    }
    if (externalAudioUrl) {
      URL.revokeObjectURL(externalAudioUrl);
      setExternalAudioUrl('');
      setExternalAudioName('');
    }

    // Clear local file states
    setSelectedLocalFile(null);
    setLocalBlobUrl('');
    localBlobUrlRef.current = '';
    
    // Clear detected tracks and scanners
    clearDetectedTracks();

    // Clear state and refs immediately
    setActiveVideoSource('');
    setActiveSourceType('none');
    setActiveVideoName('');
    activeVideoSourceRef.current = '';
    activeSourceTypeRef.current = 'none';
    activeVideoNameRef.current = '';

    syncRoom('loadVideo', {
      videoSource: '',
      sourceType: 'none',
      videoName: '',
      playing: false,
      currentTime: 0
    });
  };

  /* ==========================================================================
     Lobby View Renderer
     ========================================================================== */
  if (!inRoom) {
    return (
      <div className="tool-page dinoplay-page lobby">
        <button 
          onClick={closeOrRedirectHome} 
          className="tool-page-back"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none' }}
        >
          ✕ EXIT DINOPLAY
        </button>

        <div className="lobby-container dinoplay-card">
          <div className="lobby-header">
            <div className="lobby-logo">🦖</div>
            <h1 className="lobby-title">DinoPlay Theater</h1>
            <p className="lobby-subtitle">Synchronize video playback and chat in real-time with friends.</p>
          </div>

          {lobbyError && (
            <div className="retro-alert" style={{ marginBottom: '16px' }}>
              ❌ {lobbyError}
            </div>
          )}

          <div className="lobby-form-group">
            <label className="lobby-label">1. CHOOSE YOUR ALIAS</label>
            <input
              type="text"
              placeholder="Enter your nickname..."
              className="lobby-input"
              value={username}
              onChange={(e) => setUsername(e.target.value.slice(0, 15))}
              maxLength={15}
            />
          </div>

          <div className="lobby-actions">
            <button className="btn btn-primary" onClick={handleHostRoom}>
              Host watch session
            </button>

            <div className="lobby-divider">OR JOIN EXISTING</div>

            <div className="lobby-join-row">
              <input
                type="text"
                placeholder="ROOM CODE"
                className="lobby-input lobby-join-input"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                maxLength={4}
              />
              <button className="btn btn-success" onClick={handleJoinRoom} style={{ padding: '0 24px' }}>
                Join
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ==========================================================================
     Theater Room View Renderer
     ========================================================================== */
  return (
    <div className="tool-page dinoplay-page room">
      <div className="dinoplay-wrapper" ref={wrapperRef}>
        
        {/* Top Control Bar */}
        <div className="theater-header-panel">
          <div className="theater-header-info">
            <button className="btn btn-danger btn-sm" onClick={handleExitRoom}>
              ← EXIT THEATER
            </button>
            <div className="theater-room-badge">
              <span>ROOM: {roomCode}</span>
            </div>
            <button className="btn btn-primary btn-sm invite-btn" onClick={copyInviteLink}>
              {isCopied ? '✅ COPIED!' : '🔗 COPY INVITE LINK'}
            </button>
            <button 
              className="btn btn-primary btn-sm" 
              onClick={toggleFullscreen} 
              style={{ backgroundColor: '#ab47bc', borderColor: '#8e24aa' }}
            >
              {isFullscreen ? '📺 WINDOWED' : '🖥️ FULLSCREEN'}
            </button>
          </div>
          <div>
            <div className={`sync-status-badge ${syncStatus}`}>
              <span>{syncStatus === 'synced' ? '🟢 SYNCED' : syncStatus === 'buffering' ? '🟡 DEMO MODE' : '🔴 RECONNECTING'}</span>
            </div>
          </div>
        </div>

        {/* Workspace Columns */}
        <div className="theater-grid">
          
          {/* LEFT: Video Player and Loaders */}
          <div className="player-outer-container" style={{ position: 'relative' }}>
            
            {/* Scanner/Extraction Overlay */}
            {(isScanning || isExtracting) && (
              <div className="player-overlay-loading">
                <div className="player-overlay-spinner">
                  <div className="spinner-glow"></div>
                  <span className="spinner-icon">🦖</span>
                </div>
                <div className="player-overlay-title">
                  {isScanning ? 'SCANNING MEDIA TRACKS' : 'EXTRACTING TRACK'}
                </div>
                <div className="player-overlay-subtitle">
                  {isScanning ? scanProgress : extractionProgress}
                </div>
                
                {/* Retro Terminal Log Viewer */}
                {ffmpegLogs.length > 0 && (
                  <div className="player-overlay-logs">
                    {ffmpegLogs.map((log, idx) => (
                      <div key={idx} className="log-line">{log}</div>
                    ))}
                  </div>
                )}
                
                <div className="player-overlay-progress-bar">
                  <div className="player-overlay-progress-fill"></div>
                </div>
              </div>
            )}

            {activeSourceType === 'none' ? (
              <div className="media-loader-container dinoplay-card">
                <h2 className="media-loader-title">🎞️ Select Theater Media</h2>
                
                {/* Media Loader Navigation */}
                <div className="media-tabs">
                  <button 
                    className={`btn media-tab-btn ${mediaTab === 'file' ? 'active' : ''}`}
                    onClick={() => setMediaTab('file')}
                  >
                    📁 Local File
                  </button>
                  <button 
                    className={`btn media-tab-btn ${mediaTab === 'url' ? 'active' : ''}`}
                    onClick={() => setMediaTab('url')}
                  >
                    🔗 Direct URL
                  </button>
                  <button 
                    className={`btn media-tab-btn ${mediaTab === 'youtube' ? 'active' : ''}`}
                    onClick={() => setMediaTab('youtube')}
                  >
                    📺 YouTube
                  </button>
                </div>

                {/* Media Loader Forms */}
                <form onSubmit={handleLoadMedia} className="media-tab-content">
                  {mediaTab === 'file' && (
                    <div 
                      className="dropzone-box"
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById('theater-file-picker').click()}
                    >
                      <input 
                        type="file" 
                        id="theater-file-picker" 
                        accept="video/*" 
                        style={{ display: 'none' }}
                        onChange={handleLocalFileChange}
                      />
                      <span className="dropzone-icon">📁</span>
                      <span className="dropzone-text">Drag & drop video file or click to browse</span>
                      <span className="dropzone-hint">HTML5 formats (MP4, WebM, OGG). Runs locally for full privacy.</span>
                    </div>
                  )}

                  {mediaTab === 'url' && (
                    <div className="lobby-form-group">
                      <input 
                        type="text" 
                        placeholder="Paste direct MP4/WebM stream URL..." 
                        className="lobby-input"
                        value={directUrl}
                        onChange={(e) => setDirectUrl(e.target.value)}
                      />
                    </div>
                  )}

                  {mediaTab === 'youtube' && (
                    <div className="lobby-form-group">
                      <input 
                        type="text" 
                        placeholder="Paste YouTube Video URL or 11-digit ID..." 
                        className="lobby-input"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                      />
                    </div>
                  )}

                  {/* Selected Local File Card */}
                  {mediaTab === 'file' && selectedLocalFile && (
                    <div className="selected-file-details" style={{ marginTop: '16px' }}>
                      <span>📄 {selectedLocalFile.name} ({Math.round(selectedLocalFile.size / 1024 / 1024)}MB)</span>
                      <button type="button" className="file-remove-btn" onClick={() => setSelectedLocalFile(null)}>✕</button>
                    </div>
                  )}

                  {/* Loader Action Button */}
                  <button 
                    type="submit" 
                    className="btn btn-success" 
                    style={{ width: '100%', marginTop: '16px' }}
                    disabled={mediaTab === 'file' && !selectedLocalFile}
                  >
                    🚀 LOAD VIDEO FOR THEATER
                  </button>
                </form>
              </div>
            ) : (
              // Video Player screen
              <div 
                className="video-player-aspect"
                onContextMenu={handleContextMenu}
              >
                
                {/* HTML5 video element */}
                <div style={{ display: activeSourceType !== 'youtube' ? 'block' : 'none', width: '100%', height: '100%' }}>
                  {filePromptName ? (
                    // Prompt when a local file was loaded by someone else
                    <div className="media-loader-container" style={{ border: 'none', height: '100%', minHeight: 'auto', background: 'transparent' }}>
                      <span className="dropzone-icon">⚠️</span>
                      <h3 style={{ fontSize: '0.8rem', color: '#ffeb3b', margin: '8px 0 14px' }}>Peer Loaded Local Video</h3>
                      <p style={{ fontSize: '0.75rem', color: '#ccc', maxWidth: '400px', marginBottom: '16px', lineHeight: 1.5 }}>
                        To synchronize playback, please select the file: <br/><strong>{filePromptName}</strong>
                      </p>
                      <button className="btn btn-primary btn-sm" onClick={() => document.getElementById('sync-file-picker').click()}>
                        📁 SELECT FILE
                      </button>
                      <input 
                        type="file" 
                        id="sync-file-picker" 
                        accept="video/*" 
                        style={{ display: 'none' }}
                        onChange={handleLocalFileChange}
                      />
                    </div>
                  ) : (
                    <video
                      ref={videoRef}
                      className="video-element"
                      src={activeSourceType === 'file' ? localBlobUrl : activeVideoSource}
                      controls
                      onPlay={(e) => {
                        handleHtml5Play(e);
                        if (videoRef.current) {
                          videoRef.current.volume = volume;
                          videoRef.current.muted = externalAudioUrl ? true : (volume === 0);
                        }
                      }}
                      onPause={handleHtml5Pause}
                      onSeeked={handleHtml5Seeked}
                      onRateChange={handleHtml5RateChange}
                      onLoadedMetadata={() => {
                        if (videoRef.current) {
                          // Defer to next tick to ensure browser has finished initializing audio
                          setTimeout(() => {
                            if (videoRef.current) {
                              videoRef.current.volume = volume;
                              videoRef.current.muted = externalAudioUrl ? true : (volume === 0);
                            }
                          }, 50);
                        }
                      }}
                      onPlaying={() => {
                        if (videoRef.current) {
                          videoRef.current.volume = volume;
                          videoRef.current.muted = externalAudioUrl ? true : (volume === 0);
                        }
                      }}
                      onVolumeChange={() => {
                        if (isSyncingRef.current) return;
                        if (videoRef.current) {
                          const nativeVolume = videoRef.current.volume;
                          const nativeMuted = videoRef.current.muted;
                          
                          if (externalAudioUrl && nativeMuted) {
                            return;
                          }
                          
                          // Prevent browser autoplay policies and transient load states from muting React state:
                          // only synchronize when player is unmuted and the volume is actually adjusted.
                          if (!nativeMuted && nativeVolume !== volume) {
                            setVolume(nativeVolume);
                          }
                        }
                      }}
                    >
                      {subtitleUrl && subtitlesEnabled && (
                        <track
                          kind="subtitles"
                          src={subtitleUrl}
                          srcLang="en"
                          label="Custom Subtitles"
                          default
                        />
                      )}
                    </video>
                  )}
                </div>

                {/* Hidden HTML5 Audio Tag for custom audio track syncing */}
                {externalAudioUrl && (
                  <audio
                    ref={externalAudioRef}
                    src={externalAudioUrl}
                    style={{ display: 'none' }}
                  />
                )}

                {/* YouTube iframe container */}
                <div style={{ display: activeSourceType === 'youtube' ? 'block' : 'none', width: '100%', height: '100%' }}>
                  <div id="yt-player-container" style={{ width: '100%', height: '100%' }}>
                    <div id="yt-player" className="yt-iframe-placeholder"></div>
                  </div>
                </div>

                {/* Custom VLC Context Menu */}
                {contextMenu.visible && (
                  <div 
                    className="vlc-context-menu"
                    style={{ 
                      position: 'absolute', 
                      left: `${contextMenu.x}px`, 
                      top: `${contextMenu.y}px`, 
                      zIndex: 9999,
                      padding: '2px 0',
                      minWidth: '180px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ul className="vlc-menu-list">
                      {/* Play / Pause */}
                      <li 
                        className="vlc-menu-item-li" 
                        onClick={() => {
                          togglePlayPause();
                          setContextMenu(prev => ({ ...prev, visible: false }));
                        }}
                      >
                        <span className="vlc-menu-icon">
                          {videoRef.current && !videoRef.current.paused ? '⏸' : '▶'}
                        </span>
                        <span className="vlc-menu-text">
                          {videoRef.current && !videoRef.current.paused ? 'Pause' : 'Play'}
                        </span>
                      </li>
                      
                      {/* Stop */}
                      <li 
                        className="vlc-menu-item-li" 
                        onClick={() => {
                          stopVideo();
                          setContextMenu(prev => ({ ...prev, visible: false }));
                        }}
                      >
                        <span className="vlc-menu-icon">⏹</span>
                        <span className="vlc-menu-text">Stop</span>
                      </li>

                      <div className="vlc-menu-hr" />

                      {/* Audio Submenu */}
                      <li className="vlc-menu-item-li">
                        <span className="vlc-menu-icon">🔊</span>
                        <span className="vlc-menu-text">Audio</span>
                        <span className="vlc-menu-arrow">▶</span>
                        
                        <ul className="vlc-submenu">
                          {/* Audio Track Submenu (Level 2) */}
                          <li className="vlc-menu-item-li">
                            <span className="vlc-menu-text">Audio Track</span>
                            <span className="vlc-menu-arrow">▶</span>
                            
                            <ul className="vlc-submenu" style={{ top: '-4px' }}>
                              <li 
                                className="vlc-menu-item-li" 
                                onClick={() => {
                                  handleSelectDefaultAudio();
                                  setContextMenu(prev => ({ ...prev, visible: false }));
                                }}
                              >
                                {!externalAudioUrl && <span className="vlc-menu-check">•</span>}
                                <span className="vlc-menu-text">Default Video Audio</span>
                              </li>
                              
                              {/* Embedded Audio Tracks */}
                              {detectedAudioTracks.map((track) => (
                                <li 
                                  key={`emb-audio-${track.index}`}
                                  className="vlc-menu-item-li"
                                  onClick={() => {
                                    handleSelectEmbeddedAudio(track);
                                    setContextMenu(prev => ({ ...prev, visible: false }));
                                  }}
                                >
                                  {externalAudioUrl && activeAudioTrackIndex === track.index && (
                                    <span className="vlc-menu-check">•</span>
                                  )}
                                  <span className="vlc-menu-text" title={track.label}>
                                    {track.label}
                                  </span>
                                </li>
                              ))}

                              {/* Custom Loaded External Audio Track */}
                              {externalAudioUrl && activeAudioTrackIndex === -1 && (
                                <li className="vlc-menu-item-li">
                                  <span className="vlc-menu-check">•</span>
                                  <span className="vlc-menu-text" title={externalAudioName}>
                                    {externalAudioName}
                                  </span>
                                </li>
                              )}
                              
                              <li 
                                className="vlc-menu-item-li" 
                                onClick={() => {
                                  document.getElementById('audio-file-picker')?.click();
                                  setContextMenu(prev => ({ ...prev, visible: false }));
                                }}
                              >
                                <span className="vlc-menu-text" style={{ fontStyle: 'italic', color: '#666' }}>
                                  📁 Load External Audio...
                                </span>
                              </li>
                            </ul>
                          </li>
                          
                          <div className="vlc-menu-hr" />
                          
                          {/* Mute */}
                          <li 
                            className="vlc-menu-item-li" 
                            onClick={() => {
                              toggleMute();
                              setContextMenu(prev => ({ ...prev, visible: false }));
                            }}
                          >
                            <span className="vlc-menu-icon">{volume === 0 ? '🔊' : '🔇'}</span>
                            <span className="vlc-menu-text">{volume === 0 ? 'Unmute' : 'Mute'}</span>
                          </li>
                        </ul>
                      </li>

                      {/* Video Submenu */}
                      <li className="vlc-menu-item-li">
                        <span className="vlc-menu-icon">🎬</span>
                        <span className="vlc-menu-text">Video</span>
                        <span className="vlc-menu-arrow">▶</span>
                        
                        <ul className="vlc-submenu">
                          <li 
                            className="vlc-menu-item-li" 
                            onClick={() => {
                              toggleFullscreen();
                              setContextMenu(prev => ({ ...prev, visible: false }));
                            }}
                          >
                            <span className="vlc-menu-text">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                          </li>
                        </ul>
                      </li>

                      {/* Subtitle Submenu */}
                      <li className="vlc-menu-item-li">
                        <span className="vlc-menu-icon">💬</span>
                        <span className="vlc-menu-text">Subtitle</span>
                        <span className="vlc-menu-arrow">▶</span>
                        
                        <ul className="vlc-submenu">
                          <li 
                            className="vlc-menu-item-li" 
                            onClick={() => {
                              handleDisableSubtitles();
                              setContextMenu(prev => ({ ...prev, visible: false }));
                            }}
                          >
                            {(!subtitleUrl || !subtitlesEnabled) && <span className="vlc-menu-check">•</span>}
                            <span className="vlc-menu-text">Disable</span>
                          </li>

                          {/* Embedded Subtitle Tracks */}
                          {detectedSubtitleTracks.map((track) => (
                            <li 
                              key={`emb-sub-${track.index}`}
                              className="vlc-menu-item-li"
                              onClick={() => {
                                handleSelectEmbeddedSubtitle(track);
                                  setContextMenu(prev => ({ ...prev, visible: false }));
                              }}
                            >
                              {subtitlesEnabled && activeSubtitleTrackIndex === track.index && (
                                <span className="vlc-menu-check">•</span>
                              )}
                              <span className="vlc-menu-text" title={track.label}>
                                {track.label}
                              </span>
                            </li>
                          ))}

                          {/* Custom Loaded External Subtitle Track */}
                          {subtitleUrl && activeSubtitleTrackIndex === -1 && (
                            <li 
                              className="vlc-menu-item-li" 
                              onClick={() => {
                                  setSubtitlesEnabled(true);
                                  setContextMenu(prev => ({ ...prev, visible: false }));
                              }}
                            >
                              {subtitlesEnabled && <span className="vlc-menu-check">•</span>}
                              <span className="vlc-menu-text" title={subtitleName}>
                                {subtitleName}
                              </span>
                            </li>
                          )}
                          
                          <li 
                            className="vlc-menu-item-li" 
                            onClick={() => {
                              document.getElementById('sub-file-picker')?.click();
                              setContextMenu(prev => ({ ...prev, visible: false }));
                            }}
                          >
                            <span className="vlc-menu-text" style={{ fontStyle: 'italic', color: '#666' }}>
                              📁 Load Custom Subtitle...
                            </span>
                          </li>
                        </ul>
                      </li>

                      {/* Playback Submenu */}
                      <li className="vlc-menu-item-li">
                        <span className="vlc-menu-icon">⏱</span>
                        <span className="vlc-menu-text">Playback Speed</span>
                        <span className="vlc-menu-arrow">▶</span>
                        
                        <ul className="vlc-submenu">
                          {[0.5, 1.0, 1.25, 1.5, 2.0].map((speed) => {
                            const isCurrentSpeed = videoRef.current ? videoRef.current.playbackRate === speed : speed === 1.0;
                            return (
                              <li 
                                key={speed} 
                                className="vlc-menu-item-li" 
                                onClick={() => {
                                  if (videoRef.current) {
                                    videoRef.current.playbackRate = speed;
                                    sendPlayerAction('rate', videoRef.current.currentTime, speed);
                                  }
                                  setContextMenu(prev => ({ ...prev, visible: false }));
                                }}
                              >
                                {isCurrentSpeed && <span className="vlc-menu-check">•</span>}
                                <span className="vlc-menu-text">{speed.toFixed(2)}x</span>
                              </li>
                            );
                          })}
                        </ul>
                      </li>

                      <div className="vlc-menu-hr" />

                      {/* Exit */}
                      <li 
                        className="vlc-menu-item-li" 
                        onClick={() => {
                          handleExitRoom();
                          setContextMenu(prev => ({ ...prev, visible: false }));
                        }}
                      >
                        <span className="vlc-menu-icon">🚪</span>
                        <span className="vlc-menu-text">Exit Theater</span>
                      </li>
                    </ul>
                  </div>
                )}

              </div>
            )}

            {/* Under-Player dashboard settings */}
            {activeSourceType !== 'none' && (
              <div className="player-dashboard">
                <div className="player-dashboard-meta">
                  <div className="player-current-video-name">
                    🎥 {activeVideoName || 'Active Stream Video'}
                  </div>
                  <div className="player-current-source-type">
                    TYPE: {activeSourceType.toUpperCase()} {activeSourceType === 'file' && localBlobUrl ? '· RESOLVED LOCALLY' : ''}
                  </div>
                  
                  {/* Subtitle and Audio status row */}
                  <div className="player-tracks-status">
                    {subtitleName && <span className="track-badge">💬 SUB: {subtitleName}</span>}
                    {externalAudioName && <span className="track-badge">🎵 AUDIO: {externalAudioName}</span>}
                  </div>
                </div>

                <div className="player-dashboard-controls">
                  {/* Custom Volume control slider */}
                  <div className="player-volume-control">
                    <button 
                      onClick={() => {
                        if (volume > 0) {
                          prevVolumeRef.current = volume;
                          setVolume(0);
                        } else {
                          setVolume(prevVolumeRef.current || 1.0);
                        }
                      }} 
                      className="volume-mute-btn" 
                      style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', fontSize: '0.85rem' }}
                      title={volume === 0 ? "Unmute" : "Mute"}
                    >
                      {volume === 0 ? '🔇' : volume < 0.3 ? '🔈' : volume < 0.7 ? '🔉' : '🔊'}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="volume-slider"
                    />
                    <span className="volume-value">{Math.round(volume * 100)}%</span>
                  </div>

                  <div className="player-action-btn-group">
                  {activeSourceType === 'file' && (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => document.getElementById('sub-file-picker').click()}>
                        💬 SUBTITLES
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={() => document.getElementById('audio-file-picker').click()}>
                        🎵 AUDIO TRACK
                      </button>
                      <input
                        type="file"
                        id="sub-file-picker"
                        accept=".srt,.vtt"
                        style={{ display: 'none' }}
                        onChange={handleSubtitleChange}
                      />
                      <input
                        type="file"
                        id="audio-file-picker"
                        accept="audio/*"
                        style={{ display: 'none' }}
                        onChange={handleExternalAudioChange}
                      />
                    </>
                  )}
                  {activeSourceType === 'file' && !localBlobUrl && !filePromptName && (
                    <button className="btn btn-success btn-sm" onClick={() => setFilePromptName(activeVideoName)}>
                      📁 RE-LINK
                    </button>
                  )}
                  <button className="btn btn-danger btn-sm" onClick={handleUnloadMedia}>
                    🛑 CHANGE MEDIA
                  </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Presence List & Chat Board */}
          <div className="sidebar-container">
            
            {/* Active Peers panel */}
            <div className="sidebar-panel">
              <div className="sidebar-header">🦖 PEERS ONLINE</div>
              <div className="peers-list">
                {Object.entries(members).map(([mId, member]) => {
                  const isUserHost = mId === userId; // Highlight local user
                  return (
                    <div key={mId} className="peer-item">
                      <div className="peer-user-info">
                        <span className="peer-avatar">👾</span>
                        <span className="peer-name" title={member.username}>
                          {member.username} {isUserHost ? '(You)' : ''}
                        </span>
                      </div>
                      <span className={`peer-badge ${isUserHost ? 'host' : 'synced'}`}>
                        {isUserHost ? 'HOST' : 'PEER'}
                      </span>
                    </div>
                  );
                })}
                {Object.keys(members).length === 0 && (
                  <div style={{ fontSize: '0.7rem', color: '#555', textAlign: 'center', padding: '10px 0' }}>
                    No other users active
                  </div>
                )}
              </div>
            </div>

            {/* Live Chat Board */}
            <div className="sidebar-panel chat-panel">
              <div className="sidebar-header">💬 THEATER CHAT</div>
              <div className="chat-messages-container">
                {messages.map((msg) => {
                  if (msg.sender === 'system') {
                    return (
                      <div key={msg.id} className="chat-message-system">
                        📢 {msg.text}
                      </div>
                    );
                  }
                  const isSelf = msg.userId === userId;
                  return (
                    <div key={msg.id} className={`chat-message ${isSelf ? 'self' : ''}`}>
                      <span className="chat-message-sender">{msg.sender}</span>
                      <div className="chat-message-bubble">{msg.text}</div>
                      <span className="chat-message-time">{formatTime(new Date(msg.timestamp).getSeconds() + new Date(msg.timestamp).getMinutes() * 60)}</span>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Input messaging row */}
              <form onSubmit={handleSendChat} className="chat-input-form">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="chat-input"
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  maxLength={100}
                />
                <button type="submit" className="chat-send-btn">
                  SEND
                </button>
              </form>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

export default function DinoPlayPage() {
  return (
    <Suspense fallback={
      <div className="loading-container">
        <div className="spinner"></div>
        <div className="loading-text">BOOTING DINOPLAY THEATER...</div>
      </div>
    }>
      <DinoPlayComponent />
    </Suspense>
  );
}
