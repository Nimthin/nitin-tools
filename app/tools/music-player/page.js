'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import './music-player.css';

export default function MusicPlayer() {
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Trending
  const [globalTrending, setGlobalTrending] = useState([]);
  const [indiaTrending, setIndiaTrending] = useState([]);
  const [isTrendingLoading, setIsTrendingLoading] = useState(true);

  // Player
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [lyrics, setLyrics] = useState(null);
  const [showLyrics, setShowLyrics] = useState(false);
  const [isLyricsLoading, setIsLyricsLoading] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState(null);
  const [showVideoBg, setShowVideoBg] = useState(true);

  const audioRef = useRef(null);
  const globalRowRef = useRef(null);
  const indiaRowRef = useRef(null);
  const lyricsContainerRef = useRef(null);
  const ytIframeRef = useRef(null);

  // ---- YT Iframe Sync ----
  const sendYtCommand = useCallback((command, args = []) => {
    if (ytIframeRef.current && ytIframeRef.current.contentWindow) {
      ytIframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: command, args: args }),
        '*'
      );
    }
  }, []);

  useEffect(() => {
    if (isPlaying) sendYtCommand('playVideo');
    else sendYtCommand('pauseVideo');
  }, [isPlaying, showVideoBg, currentVideoId, sendYtCommand]);

  useEffect(() => {
    sendYtCommand('setPlaybackRate', [playbackRate]);
  }, [playbackRate, showVideoBg, currentVideoId, sendYtCommand]);

  // ---- Fetch Trending ----
  useEffect(() => {
    const fetchChart = async (country) => {
      try {
        const res = await fetch(`https://itunes.apple.com/${country}/rss/topsongs/limit=20/json`);
        const data = await res.json();
        return data.feed.entry.map((item, i) => ({
          id: `${country}-${i}`,
          title: item['im:name']?.label || '',
          artist: item['im:artist']?.label || '',
          artwork: item['im:image']?.[2]?.label?.replace('170x170bb', '600x600bb') || '',
          previewUrl: item.link?.find(l => l.attributes?.type?.includes('audio'))?.attributes?.href || '',
          album: item['im:collection']?.['im:name']?.label || '',
          genre: item.category?.attributes?.label || '',
        }));
      } catch { return []; }
    };

    Promise.all([fetchChart('us'), fetchChart('in')]).then(([global, india]) => {
      setGlobalTrending(global);
      setIndiaTrending(india);
      setIsTrendingLoading(false);
    });
  }, []);

  // ---- Search with debounce ----
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) { setSearchResults([]); return; }

    setIsSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=20`);
        const data = await res.json();
        setSearchResults(data.results.map(t => ({
          id: `itunes-${t.trackId}`,
          title: t.trackName,
          artist: t.artistName,
          artwork: t.artworkUrl100.replace('100x100bb', '600x600bb'),
          album: t.collectionName,
          genre: t.primaryGenreName,
          duration: t.trackTimeMillis,
          previewUrl: t.previewUrl,
        })));
      } catch { setSearchResults([]); }
      setIsSearching(false);
    }, 600);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // ---- Audio event listeners ----
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onEnded = () => playNext();
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [queueIndex, queue]);

  // ---- Core: Play a track ----
  const playTrack = useCallback(async (track, trackList, trackIndex) => {
    setCurrentTrack(track);
    setQueue(trackList);
    setQueueIndex(trackIndex);
    setIsLoadingAudio(true);
    setIsPlaying(false);

    // Fetch Lyrics independently
    setIsLyricsLoading(true);
    setLyrics(null);
    fetch(`https://lrclib.net/api/get?track_name=${encodeURIComponent(track.title)}&artist_name=${encodeURIComponent(track.artist)}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.syncedLyrics) {
          const lines = data.syncedLyrics.split('\n');
          const parsed = lines.map(line => {
            const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
            if (match) {
              const minutes = parseInt(match[1], 10);
              const seconds = parseFloat(match[2]);
              return { time: minutes * 60 + seconds, text: match[3].trim() };
            }
            return null;
          }).filter(l => l && l.text);
          setLyrics({ type: 'synced', lines: parsed });
        } else if (data && data.plainLyrics) {
          setLyrics({ type: 'plain', text: data.plainLyrics });
        } else {
          setLyrics({ type: 'error', text: "No lyrics found." });
        }
      })
      .catch(() => setLyrics({ type: 'error', text: "No lyrics found." }))
      .finally(() => setIsLyricsLoading(false));

    try {
      // Step 1: Find YouTube video ID
      const searchRes = await fetch('/api/youtube-search', {
        method: 'POST',
        body: JSON.stringify({ query: `${track.title} ${track.artist}` }),
        headers: { 'Content-Type': 'application/json' }
      });
      const searchData = await searchRes.json();
      if (!searchData.results || searchData.results.length === 0) throw new Error('Not found');

      const videoId = searchData.results[0].videoId;
      setCurrentVideoId(videoId);

      // Step 2: Get MP3 streaming URL
      const streamRes = await fetch('/api/audio-stream', {
        method: 'POST',
        body: JSON.stringify({ videoId }),
        headers: { 'Content-Type': 'application/json' }
      });
      const streamData = await streamRes.json();
      if (!streamData.streamUrl) throw new Error('Stream failed');

      // Step 3: Play!
      const audio = audioRef.current;
      audio.src = streamData.streamUrl;
      audio.volume = volume;
      await audio.play();
    } catch (err) {
      console.error('Playback failed:', err);
      // Fallback: try iTunes preview if available
      if (track.previewUrl) {
        const audio = audioRef.current;
        audio.src = track.previewUrl;
        audio.volume = volume;
        await audio.play();
      }
    } finally {
      setIsLoadingAudio(false);
    }
  }, [volume]);

  // ---- Playback Controls ----
  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (isPlaying) audio.pause();
    else audio.play();
  };

  const playNext = useCallback(() => {
    if (queue.length === 0) return;
    const nextIdx = (queueIndex + 1) % queue.length;
    playTrack(queue[nextIdx], queue, nextIdx);
  }, [queue, queueIndex, playTrack]);

  const playPrev = () => {
    if (queue.length === 0) return;
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const prevIdx = (queueIndex - 1 + queue.length) % queue.length;
    playTrack(queue[prevIdx], queue, prevIdx);
  };

  const seekTo = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const newTime = pct * duration;
    audio.currentTime = newTime;
    sendYtCommand('seekTo', [newTime, true]);
  };

  const changeVolume = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  const skipBackward = () => {
    if (audioRef.current) {
      const newTime = Math.max(0, audioRef.current.currentTime - 10);
      audioRef.current.currentTime = newTime;
      sendYtCommand('seekTo', [newTime, true]);
    }
  };

  const skipForward = () => {
    if (audioRef.current) {
      const newTime = Math.min(duration, audioRef.current.currentTime + 10);
      audioRef.current.currentTime = newTime;
      sendYtCommand('seekTo', [newTime, true]);
    }
  };

  const changePlaybackRate = (rate) => {
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  };

  // ---- Auto-scroll Lyrics ----
  useEffect(() => {
    if (showLyrics && lyrics?.type === 'synced' && lyricsContainerRef.current) {
      const activeEl = lyricsContainerRef.current.querySelector('.lyric-line.active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentTime, showLyrics, lyrics]);

  // ---- Helpers ----
  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const fmtMs = (ms) => {
    if (!ms) return '';
    return fmt(ms / 1000);
  };

  const isCurrentlyPlaying = (track) =>
    currentTrack?.id === track.id && isPlaying;

  const isCurrentTrack = (track) =>
    currentTrack?.id === track.id;

  const scrollCarousel = (ref, dir) => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir * 400, behavior: 'smooth' });
  };

  // ---- Render a Song Card ----
  const renderCard = (track, trackList, trackIndex) => (
    <div key={track.id} className="music-card" onClick={() => playTrack(track, trackList, trackIndex)}>
      <div className="music-card-art">
        <img src={track.artwork} alt={track.title} loading="lazy" />
        {track.duration && <span className="music-card-duration">{fmtMs(track.duration)}</span>}

        {isCurrentTrack(track) && isLoadingAudio && (
          <div className="music-card-loading-overlay">
            <div className="music-spinner"></div>
          </div>
        )}

        <button
          className={`music-card-play ${isCurrentlyPlaying(track) ? 'is-playing' : ''}`}
          onClick={(e) => { e.stopPropagation(); isCurrentlyPlaying(track) ? togglePlayPause() : playTrack(track, trackList, trackIndex); }}
        >
          {isCurrentlyPlaying(track) ? (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
      </div>
      <div className="music-card-title" title={track.title}>{track.title}</div>
      <div className="music-card-artist" title={track.artist}>{track.artist}</div>
    </div>
  );

  // ---- Render a Carousel Section ----
  const renderCarousel = (title, tracks, rowRef) => (
    <div className="music-section">
      <div className="music-section-header">
        <h2 className="music-section-title">{title}</h2>
      </div>
      {isTrendingLoading ? (
        <div className="music-loading"><div className="music-spinner"></div><span>Loading charts...</span></div>
      ) : (
        <div className="music-carousel-wrapper">
          <button className="music-carousel-btn music-carousel-btn-left" onClick={() => scrollCarousel(rowRef, -1)}>‹</button>
          <div className="music-carousel-row" ref={rowRef}>
            {tracks.map((track, i) => renderCard(track, tracks, i))}
          </div>
          <button className="music-carousel-btn music-carousel-btn-right" onClick={() => scrollCarousel(rowRef, 1)}>›</button>
        </div>
      )}
    </div>
  );

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="music-app">
      <audio ref={audioRef} preload="none" />

      {/* Header */}
      <div className="music-header">
        <div className="music-logo">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
          <span>NitinMusic</span>
        </div>

        <div className="music-search-wrapper">
          <div className="music-search-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" /></svg>
          </div>
          <input
            type="text"
            className="music-search-input"
            placeholder="What do you want to listen to?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {searchQuery && (
            <button className="music-search-clear" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="music-content">

        {/* Search Results */}
        {searchQuery.trim() ? (
          <div className="music-section">
            <div className="music-section-header">
              <h2 className="music-section-title">
                {isSearching ? 'Searching...' : `Results for "${searchQuery}"`}
              </h2>
            </div>
            {isSearching ? (
              <div className="music-loading"><div className="music-spinner"></div></div>
            ) : searchResults.length > 0 ? (
              <div className="music-grid">
                {searchResults.map((track, i) => renderCard(track, searchResults, i))}
              </div>
            ) : (
              <div className="music-empty">
                <div className="music-empty-icon">🔍</div>
                <div className="music-empty-text">No results found. Try a different search.</div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Trending Charts */}
            {renderCarousel('Global Top 20', globalTrending, globalRowRef)}
            {renderCarousel('India Top 20', indiaTrending, indiaRowRef)}
          </>
        )}
      </div>

      {/* Now Playing Bar (Full) */}
      {currentTrack && !isMinimized && !isMaximized && (
        <div className="music-player-bar">
          {/* Left: Track Info */}
          <div className="mp-now-info">
            <div className={`mp-now-art ${isPlaying ? 'is-playing' : ''}`}>
              <img src={currentTrack.artwork} alt={currentTrack.title} />
            </div>
            <div className="mp-now-text">
              <div className="mp-now-title">{currentTrack.title}</div>
              <div className="mp-now-artist">{currentTrack.artist}</div>
            </div>
          </div>

          {/* Center: Controls */}
          <div className="mp-controls-center">
            <div className="mp-controls-buttons">
              <button className="mp-control-btn" onClick={playPrev} title="Previous">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
              </button>

              <button className="mp-play-btn" onClick={togglePlayPause} disabled={isLoadingAudio} title={isPlaying ? 'Pause' : 'Play'}>
                {isLoadingAudio ? (
                  <div className="music-spinner" style={{ width: 20, height: 20, borderWidth: 2, borderColor: '#333', borderTopColor: '#000' }}></div>
                ) : isPlaying ? (
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>

              <button className="mp-control-btn" onClick={playNext} title="Next">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
              </button>
            </div>

            <div className="mp-progress-wrapper">
              <span className="mp-time">{fmt(currentTime)}</span>
              <div className="mp-progress-bar" onClick={seekTo}>
                <div className="mp-progress-fill" style={{ width: `${progressPct}%` }}></div>
              </div>
              <span className="mp-time mp-time-right">{fmt(duration)}</span>
            </div>
          </div>

          {/* Right: Volume + Minimize */}
          <div className="mp-volume-section">
            <button className="mp-volume-icon" onClick={() => { const v = volume > 0 ? 0 : 0.8; setVolume(v); if (audioRef.current) audioRef.current.volume = v; }}>
              {volume === 0 ? (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
              )}
            </button>
            <input
              type="range"
              className="mp-volume-slider"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={changeVolume}
            />
            <button className="mp-expand-btn" onClick={() => setIsMinimized(true)} title="Minimize">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg>
            </button>
            <button className="mp-expand-btn" onClick={() => setIsMaximized(true)} title="Full Screen">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Minimized Floating Widget */}
      {currentTrack && isMinimized && (
        <div className="mp-mini-widget">
          <div className={`mp-mini-art ${isPlaying ? 'is-playing' : ''}`}>
            <img src={currentTrack.artwork} alt={currentTrack.title} />
          </div>
          <div className="mp-mini-info">
            <div className="mp-mini-title">{currentTrack.title}</div>
            <div className="mp-mini-artist">{currentTrack.artist}</div>
          </div>
          <div className="mp-mini-controls">
            <button className="mp-mini-btn" onClick={playPrev}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>
            <button className="mp-mini-btn" onClick={togglePlayPause}>
              {isPlaying ? (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
            <button className="mp-mini-btn" onClick={playNext}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
          </div>
          <button className="mp-mini-expand" onClick={() => setIsMinimized(false)} title="Expand">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg>
          </button>
        </div>
      )}

      {/* Maximized Full-Screen View */}
      {currentTrack && isMaximized && (
        <div className="mp-fullscreen">
          
          {/* Canvas Background Video */}
          {showVideoBg && currentVideoId && (
            <div className="mp-fs-video-bg">
              <iframe
                ref={ytIframeRef}
                src={`https://www.youtube.com/embed/${currentVideoId}?mute=1&controls=0&loop=1&playlist=${currentVideoId}&playsinline=1&enablejsapi=1`}
                allow="autoplay; encrypted-media"
                frameBorder="0"
              />
              <div className="mp-fs-video-overlay"></div>
            </div>
          )}

          <button className="mp-fs-close" onClick={() => setIsMaximized(false)} title="Close Full Screen">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
          
          <div className="mp-fs-top-toggles">
            <button className={`mp-fs-video-toggle ${showVideoBg ? 'active' : ''}`} onClick={() => setShowVideoBg(!showVideoBg)} title="Toggle Background Video">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M21 3H3c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.11-.9-2-2-2zm0 14H3V5h18v12zm-5-6l-7 4V7z"/></svg>
            </button>
            
            <button className={`mp-fs-lyrics-toggle ${showLyrics ? 'active' : ''}`} onClick={() => setShowLyrics(!showLyrics)} title="Toggle Lyrics">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"/></svg>
            </button>
          </div>

          <div className={`mp-fs-layout ${showLyrics ? 'with-lyrics' : ''}`}>
            <div className="mp-fs-main-side">
              <div className="mp-fs-center-content">
                <div className="mp-fs-art">
                  <img src={currentTrack.artwork} alt={currentTrack.title} />
                </div>
                
                <div className="mp-fs-info">
                  <div className="mp-fs-title">{currentTrack.title}</div>
                  <div className="mp-fs-meta">
                    <span>{currentTrack.artist}</span>
                    {currentTrack.album && (
                      <>
                        <span className="mp-fs-meta-dot">•</span>
                        <span>{currentTrack.album}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {showLyrics && (
              <div className="mp-fs-lyrics-side">
                <div className="mp-fs-lyrics" ref={lyricsContainerRef}>
                  {isLyricsLoading ? (
                    <div className="music-loading"><div className="music-spinner"></div><span>Loading lyrics...</span></div>
                  ) : lyrics?.type === 'synced' ? (
                    lyrics.lines.map((line, i) => {
                      const isActive = currentTime >= line.time && (i === lyrics.lines.length - 1 || currentTime < lyrics.lines[i + 1].time);
                      return (
                        <div key={i} className={`lyric-line ${isActive ? 'active' : ''}`}>
                          {line.text}
                        </div>
                      );
                    })
                  ) : lyrics?.type === 'plain' ? (
                    <div className="lyric-plain">{lyrics.text}</div>
                  ) : (
                    <div className="lyric-error">{lyrics?.text || "Lyrics not available."}</div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="mp-fs-controls">
            <div className="mp-fs-progress">
              <span className="mp-fs-time">{fmt(currentTime)}</span>
              <div className="mp-fs-progress-bar" onClick={seekTo}>
                <div className="mp-fs-progress-fill" style={{ width: `${progressPct}%` }}></div>
              </div>
              <span className="mp-fs-time">{fmt(duration)}</span>
            </div>
            
            <div className="mp-fs-buttons">
              <button className="mp-fs-btn" onClick={skipBackward} title="-10s">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12.5 3C17.15 3 21 6.85 21 11.5S17.15 20 12.5 20c-3.76 0-7-2.48-8.15-5.92l1.9-1.04C7.09 15.68 9.58 18 12.5 18c3.59 0 6.5-2.91 6.5-6.5S16.09 5 12.5 5 6 7.91 6 11.5H8L4.5 15 1 11.5h2C3 6.85 6.85 3 11.5 3zM10 8h2v6h-2V8zm4.5 0c-.83 0-1.5.67-1.5 1.5v3c0 .83.67 1.5 1.5 1.5h1.5c.83 0 1.5-.67 1.5-1.5v-3c0-.83-.67-1.5-1.5-1.5h-1.5zM14 9.5h1v3h-1v-3z"/></svg>
              </button>
              
              <button className="mp-fs-btn" onClick={playPrev} title="Previous">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
              </button>
              
              <button className="mp-fs-play" onClick={togglePlayPause} disabled={isLoadingAudio}>
                {isLoadingAudio ? (
                  <div className="music-spinner" style={{width:24,height:24,borderWidth:2,borderColor:'#aaa',borderTopColor:'#000'}}></div>
                ) : isPlaying ? (
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>
              
              <button className="mp-fs-btn" onClick={playNext} title="Next">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
              </button>
              
              <button className="mp-fs-btn" onClick={skipForward} title="+10s">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M11.5 3C6.85 3 3 6.85 3 11.5h2C5 7.91 7.91 5 11.5 5S18 7.91 18 11.5 15.09 18 11.5 18c-2.92 0-5.41-1.88-6.25-4.5l-1.9 1.04C4.5 18.25 7.74 20 11.5 20c4.65 0 8.5-3.85 8.5-8.5S16.15 3 11.5 3zm1.5 5h-2v6h2V8zm-4.5 0c-.83 0-1.5.67-1.5 1.5v3c0 .83.67 1.5 1.5 1.5h1.5c.83 0 1.5-.67 1.5-1.5v-3c0-.83-.67-1.5-1.5-1.5H8.5zM7 9.5h1v3H7v-3zm14 2L17.5 8v3H15v2h2.5v3L21 11.5z"/></svg>
              </button>
            </div>
            
            <div className="mp-fs-extra-controls">
              <div className="mp-fs-speed">
                <button className={`mp-fs-speed-btn ${playbackRate === 0.5 ? 'active' : ''}`} onClick={() => changePlaybackRate(0.5)}>0.5x</button>
                <button className={`mp-fs-speed-btn ${playbackRate === 1 ? 'active' : ''}`} onClick={() => changePlaybackRate(1)}>1x</button>
                <button className={`mp-fs-speed-btn ${playbackRate === 1.5 ? 'active' : ''}`} onClick={() => changePlaybackRate(1.5)}>1.5x</button>
                <button className={`mp-fs-speed-btn ${playbackRate === 2 ? 'active' : ''}`} onClick={() => changePlaybackRate(2)}>2x</button>
              </div>
              
              <div className="mp-fs-volume">
                <button className="mp-volume-icon" onClick={() => { const v = volume > 0 ? 0 : 0.8; setVolume(v); if (audioRef.current) audioRef.current.volume = v; }}>
                  {volume === 0 ? (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                  )}
                </button>
                <input
                  type="range"
                  className="mp-volume-slider"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={changeVolume}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
