'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  isValidYouTubeUrl,
  extractVideoId,
  getThumbnailUrl,
  getVideoInfo,
  downloadAudio,
  formatDuration,
  QUALITY_OPTIONS,
} from '@/tools-logic/youtubeAudioDownloader';
import { RANDOM_FACTS } from '@/tools-logic/facts';
import './youtube-tool.css';

export default function YouTubeAudioDownloader() {
  const [url, setUrl] = useState('');
  const [videoId, setVideoId] = useState(null);
  const [selectedQuality, setSelectedQuality] = useState('192');
  
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [videoInfo, setVideoInfo] = useState(null);
  const [error, setError] = useState(null);
  
  const [currentFact, setCurrentFact] = useState('');
  const inputRef = useRef(null);

  // Auto-detect URL and fetch info
  useEffect(() => {
    const fetchInfo = async () => {
      if (isValidYouTubeUrl(url)) {
        const id = extractVideoId(url);
        setVideoId(id);
        setError(null);
        setVideoInfo(null);
        setIsFetchingInfo(true);
        
        try {
          const info = await getVideoInfo(url);
          setVideoInfo(info);
        } catch (err) {
          // Ignore fetch errors if they happen because the connection was aborted or blocked by a concurrent download request
          if (err.message !== 'Failed to fetch' && !err.message.includes('aborted')) {
            setError(err.message || 'Failed to fetch video details.');
          }
        } finally {
          setIsFetchingInfo(false);
        }
      } else {
        setVideoId(null);
        setVideoInfo(null);
      }
    };

    // Debounce slightly to handle fast pasting
    const timeoutId = setTimeout(fetchInfo, 500);
    return () => clearTimeout(timeoutId);
  }, [url]);

  // Rotate facts while downloading
  useEffect(() => {
    let interval;
    if (isDownloading) {
      // Pick a random fact immediately
      setCurrentFact(RANDOM_FACTS[Math.floor(Math.random() * RANDOM_FACTS.length)]);
      
      // Rotate every 6 seconds
      interval = setInterval(() => {
        setCurrentFact(RANDOM_FACTS[Math.floor(Math.random() * RANDOM_FACTS.length)]);
      }, 6000);
    } else {
      setCurrentFact('');
    }
    
    return () => clearInterval(interval);
  }, [isDownloading]);

  const handleDownload = async () => {
    if (!videoInfo) return;
    
    setError(null);
    setIsDownloading(true);

    try {
      await downloadAudio(url, selectedQuality, videoInfo.title);
    } catch (err) {
      setError(err.message || 'Download failed. Our backend might be busy.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleReset = () => {
    setUrl('');
    setVideoId(null);
    setVideoInfo(null);
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

  return (
    <div className="tool-page">
      <Link href="/" className="tool-page-back">
        ← Back to tools
      </Link>

      <div className="tool-page-header">
        <h1>🎵 YouTube to MP3</h1>
        <p>
          Paste a YouTube link, pick your quality, and download directly as an MP3.
        </p>
      </div>

      {/* URL Input */}
      <div className="yt-input-section">
        <div className="yt-form">
          <div className="yt-input-wrapper">
            <div className="yt-input-icon">🔗</div>
            <input
              ref={inputRef}
              type="text"
              className="yt-input"
              placeholder="Paste YouTube URL here..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={isDownloading}
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
      {videoInfo && (
        <div className="yt-result">
          {/* Video info card */}
          <div className="yt-result-video">
            {videoInfo.thumbnail && (
              <div className="yt-result-thumb">
                <img src={videoInfo.thumbnail} alt={videoInfo.title} />
              </div>
            )}
            <div className="yt-result-detail" style={{ textAlign: 'left' }}>
              <div className="yt-result-title">{videoInfo.title}</div>
              <div className="yt-result-author">{videoInfo.author}</div>
              <div className="yt-result-duration">Duration: {formatDuration(videoInfo.duration)}</div>
            </div>
          </div>

          <div className="yt-options" style={{ marginTop: '2rem' }}>
            <div className="yt-option-group">
              <div className="yt-option-label" style={{ textAlign: 'left' }}>Audio Quality</div>
              <div className="yt-quality-grid">
                {QUALITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`yt-quality-btn ${selectedQuality === opt.value ? 'active' : ''}`}
                    onClick={() => setSelectedQuality(opt.value)}
                    type="button"
                    disabled={isDownloading}
                  >
                    <span className="yt-quality-value">{opt.label}</span>
                    <span className="yt-quality-desc">{opt.description}</span>
                    {opt.badge && <span className="yt-quality-badge">{opt.badge}</span>}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="yt-download-btn"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <>
                  <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}></span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.95rem' }}>Converting & Downloading...</span>
                  </span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '1.2rem' }}>⬇</span>
                  <span>Download MP3</span>
                </>
              )}
            </button>
            
            {/* Fact Display while downloading */}
            {isDownloading && (
              <div 
                className="yt-fact-box" 
              >
                <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>Did you know?</div>
                <div className="yt-fact-text" key={currentFact}>
                  {currentFact}
                </div>
              </div>
            )}
            
          </div>
        </div>
      )}
    </div>
  );
}
