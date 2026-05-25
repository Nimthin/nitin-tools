'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { RANDOM_FACTS } from '@/tools-logic/facts';
import './social-downloader.css';

export default function SocialDownloader() {
  const [url, setUrl] = useState('');
  const [activeTab, setActiveTab] = useState('instagram'); // Default: Instagram
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [pickerMedia, setPickerMedia] = useState(null);
  const [currentFact, setCurrentFact] = useState('');
  
  const inputRef = useRef(null);

  // Rotate facts while processing the request
  useEffect(() => {
    let interval;
    if (isPending) {
      setCurrentFact(RANDOM_FACTS[Math.floor(Math.random() * RANDOM_FACTS.length)]);
      interval = setInterval(() => {
        setCurrentFact(RANDOM_FACTS[Math.floor(Math.random() * RANDOM_FACTS.length)]);
      }, 5000);
    } else {
      setCurrentFact('');
    }
    return () => clearInterval(interval);
  }, [isPending]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch (err) {
      console.warn('Clipboard paste failed:', err);
    }
  };

  const handleClear = () => {
    setUrl('');
    setError(null);
    setSuccessData(null);
    setPickerMedia(null);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsPending(true);
    setError(null);
    setSuccessData(null);
    setPickerMedia(null);

    // Validate Instagram URLs if the tab is set to Instagram
    if (activeTab === 'instagram' && !url.includes('instagram.com') && !url.includes('instagr.am')) {
      setError('Please enter a valid Instagram link.');
      setIsPending(false);
      return;
    }

    try {
      const res = await fetch('/api/download/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      });

      const json = await res.json();

      if (json.status !== 'success') {
        throw new Error(json.message || 'Failed to extract download URL.');
      }

      const { data } = json;

      if (data.status === 'picker') {
        // Multi-media carousel post
        setPickerMedia(data.picker);
      } else if (data.status === 'redirect' || data.status === 'tunnel') {
        // Single video/photo download link
        setSuccessData(data.url);
        
        // Auto-trigger download trigger
        const a = document.createElement('a');
        a.href = data.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.download = `downloader_${Date.now()}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        throw new Error('Unexpected download status returned from server.');
      }

    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during link extraction. Please try another link.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="tool-page">
      <Link href="/" className="tool-page-back">
        ← Back to tools
      </Link>

      <div className="tool-page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          📥 Social Media Downloader
        </h1>
        <p>Save media and Reels from Instagram directly to your device.</p>
      </div>

      <div className="social-layout">
        <div className="downloader-card">
          <div className="downloader-title-section">
            <h2>Download Reels & Videos</h2>
          </div>
          <p className="downloader-description">
            Paste any public social media link below to fetch the high-quality source video or photo files.
          </p>

          {/* Platform Tabs */}
          <div className="platform-tabs">
            <button 
              className={`platform-tab-btn ${activeTab === 'instagram' ? 'active' : ''}`}
              onClick={() => { setActiveTab('instagram'); handleClear(); }}
            >
              📷 Instagram
            </button>
            <button 
              className={`platform-tab-btn ${activeTab === 'tiktok' ? 'active' : ''}`}
              onClick={() => { setActiveTab('tiktok'); handleClear(); }}
              style={{ opacity: 0.7 }}
            >
              🎵 TikTok (Beta)
            </button>
            <button 
              className={`platform-tab-btn ${activeTab === 'youtube' ? 'active' : ''}`}
              onClick={() => { setActiveTab('youtube'); handleClear(); }}
              style={{ opacity: 0.7 }}
            >
              📺 YouTube (Beta)
            </button>
          </div>

          {/* URL Form */}
          <form onSubmit={handleSubmit}>
            <div className="url-input-wrapper">
              <label htmlFor="social-url">Enter {activeTab === 'instagram' ? 'Instagram Reel or Post' : activeTab === 'tiktok' ? 'TikTok' : 'YouTube'} Link:</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  ref={inputRef}
                  id="social-url"
                  type="text"
                  className="downloader-input"
                  placeholder={
                    activeTab === 'instagram'
                      ? 'https://www.instagram.com/reel/...'
                      : activeTab === 'tiktok'
                      ? 'https://www.tiktok.com/@user/video/...'
                      : 'https://www.youtube.com/watch?v=...'
                  }
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isPending}
                  required
                />
                
                {url && (
                  <button 
                    type="button" 
                    onClick={handleClear}
                    style={{
                      padding: '0 16px',
                      background: '#e2dfd5',
                      border: '3px solid #1a1a1a',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontFamily: 'var(--font-pixel)',
                      fontSize: '0.65rem'
                    }}
                  >
                    CLEAR
                  </button>
                )}

                <button 
                  type="button" 
                  onClick={handlePaste}
                  style={{
                    padding: '0 16px',
                    background: '#ffeb3b',
                    border: '3px solid #1a1a1a',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontFamily: 'var(--font-pixel)',
                    fontSize: '0.65rem',
                    boxShadow: '2px 2px 0px #1a1a1a'
                  }}
                >
                  PASTE
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="download-submit-btn"
              disabled={isPending || !url.trim()}
            >
              {isPending ? 'Processing Link...' : 'Fetch Media'}
            </button>
          </form>

          {/* Error Banner */}
          {error && (
            <div className="error-banner">
              ⚠️ {error}
            </div>
          )}

          {/* Pending Status Spinner */}
          {isPending && (
            <div className="status-container">
              <div className="status-message">
                <div className="pixel-spinner"></div>
                <span>Contacting downloader server... This may take up to 10 seconds.</span>
              </div>
              {currentFact && (
                <div className="fact-container">
                  <strong>Did you know?</strong> {currentFact}
                </div>
              )}
            </div>
          )}

          {/* Success Banner */}
          {successData && !isPending && (
            <div className="success-banner">
              🎉 Media link successfully extracted! The download should start automatically.
              <div style={{ marginTop: '12px' }}>
                <a
                  href={successData}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="download-submit-btn"
                  style={{ textDecoration: 'none', display: 'inline-flex', width: 'auto' }}
                >
                  Click here if download did not start
                </a>
              </div>
            </div>
          )}

          {/* Picker / Gallery Layout */}
          {pickerMedia && !isPending && (
            <div className="picker-container">
              <div className="picker-title">
                📚 Carousel Media Found ({pickerMedia.length} items)
              </div>
              <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '16px' }}>
                This post contains multiple items. Choose which ones you would like to download:
              </p>
              <div className="picker-grid">
                {pickerMedia.map((item, index) => (
                  <div key={index} className="picker-item-card">
                    <div className="picker-preview-placeholder">
                      <span className="badge-media-type">{item.type || 'Media'}</span>
                      {item.type === 'video' ? '📹 Video' : '🖼️ Image'}
                      <div style={{ fontSize: '0.5rem', marginTop: '4px', opacity: 0.6 }}>#{index + 1}</div>
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="picker-download-btn"
                    >
                      Download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
