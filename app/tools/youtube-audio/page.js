'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  isValidYouTubeUrl,
  extractVideoId,
  getVideoInfo,
  downloadAudio,
  formatDuration,
} from '@/tools-logic/youtubeAudioDownloader';
import { RANDOM_FACTS } from '@/tools-logic/facts';
import './youtube-tool.css';

export default function YouTubeAudioDownloader() {
  const [url, setUrl] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [previewVideoId, setPreviewVideoId] = useState(null);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [videoInfo, setVideoInfo] = useState(null);
  const [error, setError] = useState(null);

  const [currentFact, setCurrentFact] = useState('');
  const [trendingSongs, setTrendingSongs] = useState([]);
  const [indiaTrendingSongs, setIndiaTrendingSongs] = useState([]);
  const [isTrendingLoading, setIsTrendingLoading] = useState(true);
  const [downloadingSongId, setDownloadingSongId] = useState(null);
  const [playingSongId, setPlayingSongId] = useState(null);
  const inputRef = useRef(null);
  const globalRowRef = useRef(null);
  const indiaRowRef = useRef(null);
  const audioRef = useRef(null);

  // Fetch Trending Music from iTunes RSS
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const [globalRes, indiaRes] = await Promise.all([
          fetch('https://itunes.apple.com/us/rss/topsongs/limit=20/json'),
          fetch('https://itunes.apple.com/in/rss/topsongs/limit=20/json')
        ]);

        const processData = async (res) => {
          const data = await res.json();
          return data.feed.entry.map(entry => {
            const links = Array.isArray(entry.link) ? entry.link : [entry.link];
            const previewLink = links.find(l => l.attributes && l.attributes.rel === 'enclosure');
            return {
              id: entry.id.attributes['im:id'],
              title: entry['im:name'].label,
              artist: entry['im:artist'].label,
              image: entry['im:image'][2].label,
              previewUrl: previewLink ? previewLink.attributes.href : null
            };
          });
        };

        const [globalSongs, indiaSongs] = await Promise.all([
          processData(globalRes),
          processData(indiaRes)
        ]);

        setTrendingSongs(globalSongs);
        setIndiaTrendingSongs(indiaSongs);
      } catch (err) {
        console.error('Failed to fetch trending songs:', err);
      } finally {
        setIsTrendingLoading(false);
      }
    };
    fetchTrending();
  }, []);

  // Auto-detect URL or auto-search
  useEffect(() => {
    const fetchInfo = async () => {
      const inputVal = url.trim();
      if (!inputVal) {
        setSearchResults(null);
        setPreviewVideoId(null);
        setError(null);
        return;
      }

      setError(null);
      setSearchResults(null);
      setPreviewVideoId(null);
      setIsFetchingInfo(true);

      try {
        if (isValidYouTubeUrl(inputVal)) {
          // Direct URL
          const id = extractVideoId(inputVal);
          const info = await getVideoInfo(inputVal);
          
          let previewUrl = null;
          let artwork = info.thumbnail;
          let trackName = info.title;
          let artistName = info.author;
          let albumName = '';
          let genreName = '';
          let releaseYear = '';

          // Try to get iTunes preview using video title
          try {
            const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(info.title)}&entity=song&limit=1`);
            const itunesData = await itunesRes.json();
            if (itunesData.results && itunesData.results.length > 0) {
              const track = itunesData.results[0];
              previewUrl = track.previewUrl;
              artwork = track.artworkUrl100.replace('100x100bb', '600x600bb');
              trackName = track.trackName;
              artistName = track.artistName;
              albumName = track.collectionName;
              genreName = track.primaryGenreName;
              releaseYear = track.releaseDate ? new Date(track.releaseDate).getFullYear() : '';
            }
          } catch (e) { console.error('iTunes fetch failed', e); }

          setSearchResults([{
            videoId: id,
            title: trackName,
            thumbnail: artwork,
            channel: artistName,
            album: albumName,
            genre: genreName,
            year: releaseYear,
            duration: formatDuration(info.duration),
            url: inputVal,
            previewUrl: previewUrl
          }]);
        } else {
          // Text Search via iTunes first
          let itunesTrack = null;
          try {
            const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(inputVal)}&entity=song&limit=1`);
            const itunesData = await itunesRes.json();
            if (itunesData.results && itunesData.results.length > 0) {
              itunesTrack = itunesData.results[0];
            }
          } catch (e) { console.error('iTunes text search failed', e); }

          if (!itunesTrack) throw new Error('No audio found for this search.');

          // Now find the YouTube video ID for downloading
          const ytSearchQuery = `${itunesTrack.trackName} ${itunesTrack.artistName}`;
          const searchRes = await fetch('/api/youtube-search', {
            method: 'POST',
            body: JSON.stringify({ query: ytSearchQuery }),
            headers: { 'Content-Type': 'application/json' }
          });
          const searchData = await searchRes.json();
          if (!searchData.results || searchData.results.length === 0) throw new Error('Could not find a downloadable version.');
          
          const topResult = searchData.results[0];
          
          const millis = itunesTrack.trackTimeMillis || 0;
          const mins = Math.floor(millis / 60000);
          const secs = ((millis % 60000) / 1000).toFixed(0);
          const durationStr = millis > 0 ? `${mins}:${secs.padStart(2, '0')}` : '';

          setSearchResults([{
            videoId: topResult.videoId,
            title: itunesTrack.trackName,
            thumbnail: itunesTrack.artworkUrl100.replace('100x100bb', '600x600bb'),
            channel: itunesTrack.artistName,
            album: itunesTrack.collectionName,
            genre: itunesTrack.primaryGenreName,
            year: itunesTrack.releaseDate ? new Date(itunesTrack.releaseDate).getFullYear() : '',
            duration: durationStr,
            url: `https://www.youtube.com/watch?v=${topResult.videoId}`,
            previewUrl: itunesTrack.previewUrl
          }]);
        }
      } catch (err) {
        if (err.message !== 'Failed to fetch' && !err.message.includes('aborted')) {
          setError(err.message || 'Failed to fetch details.');
        }
      } finally {
        setIsFetchingInfo(false);
      }
    };

    // Debounce 1000ms to avoid firing on every keystroke
    const timeoutId = setTimeout(fetchInfo, 1000);
    return () => clearTimeout(timeoutId);
  }, [url]);

  // Rotate facts while downloading
  useEffect(() => {
    let interval;
    if (isDownloading) {
      setCurrentFact(RANDOM_FACTS[Math.floor(Math.random() * RANDOM_FACTS.length)]);

      interval = setInterval(() => {
        setCurrentFact(RANDOM_FACTS[Math.floor(Math.random() * RANDOM_FACTS.length)]);
      }, 6000);
    } else {
      setCurrentFact('');
    }

    return () => clearInterval(interval);
  }, [isDownloading]);

  const handleResultDownload = async (resultUrl, title) => {
    setError(null);
    setIsDownloading(true);

    try {
      await downloadAudio(resultUrl, 'best', title);
    } catch (err) {
      setError(err.message || 'Download failed. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleReset = () => {
    setUrl('');
    setSearchResults(null);
    setPreviewVideoId(null);
    setError(null);
    setIsDownloading(false);
    inputRef.current?.focus();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch {
      // Clipboard API not available
    }
  };

  const handleSearchAndDownload = async (song) => {
    setDownloadingSongId(song.id);
    setError(null);
    try {
      const query = `${song.title} ${song.artist} official audio`;
      const searchRes = await fetch('/api/youtube-search', {
        method: 'POST',
        body: JSON.stringify({ query }),
        headers: { 'Content-Type': 'application/json' }
      });
      const searchData = await searchRes.json();
      if (!searchData.videoId) throw new Error(searchData.error || 'Song not found on YouTube');

      const ytUrl = `https://www.youtube.com/watch?v=${searchData.videoId}`;

      // Download directly without pasting into UI
      await downloadAudio(ytUrl, 'best', song.title);

    } catch (err) {
      setError(err.message || 'Failed to download the song.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setDownloadingSongId(null);
    }
  };

  const scrollRow = (ref, direction) => {
    if (ref.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      ref.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const togglePlay = (song) => {
    if (!song.previewUrl) return;

    if (playingSongId === song.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingSongId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(song.previewUrl);
      audio.volume = 0.5;
      audio.play();
      audio.onended = () => setPlayingSongId(null);
      audioRef.current = audio;
      setPlayingSongId(song.id);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Reusable Carousel Render Function
  const renderCarousel = (title, songs, ref) => {
    return (
      <section className="yt-trending-section">
        <h2 className="yt-trending-title">{title}</h2>

        {isTrendingLoading ? (
          <div className="loading-container" style={{ padding: '2rem' }}>
            <span className="spinner"></span>
            <span className="loading-text">Loading top charts...</span>
          </div>
        ) : (
          <div className="yt-trending-carousel-wrapper">
            <button onClick={() => scrollRow(ref, 'left')} className="yt-carousel-btn yt-carousel-left">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z" />
              </svg>
            </button>
            <div className="yt-trending-row" ref={ref}>
              {songs.map((song, idx) => (
                <div key={`${song.id}-${title}`} className="yt-trending-card">
                  <div className="yt-trending-thumb">
                    <img src={song.image} alt={song.title} className={playingSongId === song.id ? 'playing' : ''} />
                    <div className="yt-trending-rank-badge">{idx + 1}</div>

                    {/* Download Badge (Top Right) */}
                    <button
                      className="yt-trending-dl-badge"
                      onClick={() => handleSearchAndDownload(song)}
                      disabled={downloadingSongId === song.id}
                      title="Download Full Song"
                    >
                      {downloadingSongId === song.id ? (
                        <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                        </svg>
                      )}
                    </button>

                    {/* Play Overlay (Center) */}
                    {song.previewUrl && (
                      <button
                        className={`yt-trending-play-overlay ${playingSongId === song.id ? 'active' : ''}`}
                        onClick={() => togglePlay(song)}
                        title={playingSongId === song.id ? "Pause Preview" : "Play Preview"}
                      >
                        {playingSongId === song.id ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                  <div className="yt-trending-info">
                    <div className="yt-trending-name" title={song.title}>{song.title}</div>
                    <div className="yt-trending-artist" title={song.artist}>{song.artist}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => scrollRow(ref, 'right')} className="yt-carousel-btn yt-carousel-right">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
              </svg>
            </button>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="tool-page">
      <Link href="/" className="tool-page-back">
        ← Back to tools
      </Link>

      <div className="tool-page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="currentColor">
            <path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55a3.016 3.016 0 0 0-2.122 2.136C0 8.07 0 12 0 12s0 3.93.501 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.55 9.377.55 9.377.55s7.505 0 9.377-.55a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
            <path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
          YouTube Audio Downloader
        </h1>
        <p>Download high-quality audio from YouTube.</p>
      </div>

      {/* URL Input */}
      <div className="yt-input-section">
        <div className="yt-form">
          <div className="yt-input-wrapper">
            <div className="yt-input-icon">🔍</div>
            <input
              ref={inputRef}
              type="text"
              className="yt-input"
              placeholder="Paste YouTube URL or search for a song..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={isDownloading || isFetchingInfo}
            />

            {url && !isDownloading && (
              <button
                type="button"
                className="yt-input-clear"
                onClick={handleReset}
                aria-label="Clear"
              >
                ✕
              </button>
            )}
            {!isDownloading && (
              <button
                type="button"
                className="yt-paste-btn"
                onClick={handlePaste}
                title="Paste from clipboard"
              >
                📋
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading state for info */}
      {isFetchingInfo && (
        <div className="loading-container" style={{ padding: '2rem' }}>
          <span className="spinner"></span>
          <span className="loading-text">Loading video details...</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="error-message">⚠️ {error}</div>
      )}

      {/* Output options (once info is fetched) */}
      {searchResults && searchResults.length > 0 && (
        <div className="yt-premium-result-container">
          <div className="yt-premium-result-left">
            <div className="yt-trending-card" style={{ width: '220px' }}>
              <div className="yt-trending-thumb">
                <img src={searchResults[0].thumbnail} alt={searchResults[0].title} className={playingSongId === searchResults[0].videoId ? 'playing' : ''} />
                {searchResults[0].previewUrl && (
                  <button 
                    className={`yt-trending-play-overlay ${playingSongId === searchResults[0].videoId ? 'active' : ''}`}
                    onClick={() => togglePlay({ id: searchResults[0].videoId, previewUrl: searchResults[0].previewUrl })}
                  >
                    {playingSongId === searchResults[0].videoId ? (
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    )}
                  </button>
                )}
              </div>
              <div className="yt-trending-info" style={{ padding: '0 4px' }}>
                <div className="yt-trending-title" style={{ fontSize: '0.95rem' }}>{searchResults[0].title}</div>
                <div className="yt-trending-artist" style={{ fontSize: '0.85rem' }}>{searchResults[0].channel}</div>
              </div>
            </div>
          </div>

          <div className="yt-premium-result-right">
            <div className="yt-premium-metadata">
              <h2 className="yt-premium-title">{searchResults[0].title}</h2>
              <p className="yt-premium-artist">{searchResults[0].channel}</p>
              
              <div className="yt-premium-details" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {searchResults[0].album && (
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--text-tertiary)', marginRight: '8px' }}>Album:</span>
                    <span style={{ fontWeight: '500' }}>{searchResults[0].album}</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '16px' }}>
                  {searchResults[0].genre && (
                    <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--text-tertiary)', marginRight: '8px' }}>Genre:</span>
                      <span style={{ fontWeight: '500' }}>{searchResults[0].genre}</span>
                    </div>
                  )}
                  {searchResults[0].year && (
                    <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--text-tertiary)', marginRight: '8px' }}>Year:</span>
                      <span style={{ fontWeight: '500' }}>{searchResults[0].year}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="yt-premium-stats" style={{ marginTop: '16px' }}>
                {searchResults[0].duration && (
                  <div className="yt-premium-stat-item">
                    <span>⏱</span>
                    <span>{searchResults[0].duration}</span>
                  </div>
                )}
                <div className="yt-premium-stat-item">
                  <span>🎵</span>
                  <span>High Quality Audio</span>
                </div>
              </div>
            </div>

            <button
              className="yt-premium-dl-btn"
              onClick={() => handleResultDownload(searchResults[0].url, searchResults[0].title)}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <>
                  <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}></span>
                  Downloading...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                  </svg>
                  Download Audio
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Fact Display while downloading */}
      {isDownloading && (
        <div className="yt-fact-box" style={{ marginTop: '1rem', marginBottom: '2rem' }}>
          <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>Did you know?</div>
          <div className="yt-fact-text" key={currentFact}>
            {currentFact}
          </div>
        </div>
      )}

      {/* Trending Charts */}
      {renderCarousel('Global Top 20 Trending', trendingSongs, globalRowRef)}
      {renderCarousel('India Top 20 Trending', indiaTrendingSongs, indiaRowRef)}
    </div>
  );
}
