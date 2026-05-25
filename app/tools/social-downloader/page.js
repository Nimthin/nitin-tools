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

    const trimmedUrl = url.trim();
    const lowerUrl = trimmedUrl.toLowerCase();

    // 1. Explicitly block TikTok URLs on frontend
    if (lowerUrl.includes('tiktok.com') || lowerUrl.includes('douyin.com') || lowerUrl.includes('tiktokv.com')) {
      setError('TikTok downloads are not supported by this tool.');
      setIsPending(false);
      return;
    }

    // 2. Validate URLs based on active tab
    if (activeTab === 'instagram' && !lowerUrl.includes('instagram.com') && !lowerUrl.includes('instagr.am')) {
      setError('Please enter a valid Instagram link.');
      setIsPending(false);
      return;
    }
    if (activeTab === 'youtube' && !lowerUrl.includes('youtube.com') && !lowerUrl.includes('youtu.be')) {
      setError('Please enter a valid YouTube link.');
      setIsPending(false);
      return;
    }
    if (activeTab === 'snapchat' && !lowerUrl.includes('snapchat.com')) {
      setError('Please enter a valid Snapchat link.');
      setIsPending(false);
      return;
    }
    if (activeTab === 'pinterest' && !lowerUrl.includes('pinterest.com') && !lowerUrl.includes('pin.it')) {
      setError('Please enter a valid Pinterest link.');
      setIsPending(false);
      return;
    }
    if (activeTab === 'facebook' && !lowerUrl.includes('facebook.com') && !lowerUrl.includes('fb.watch') && !lowerUrl.includes('fb.com')) {
      setError('Please enter a valid Facebook link.');
      setIsPending(false);
      return;
    }

    try {
      const res = await fetch('/api/download/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl })
      });

      const json = await res.json();

      if (json.status !== 'success') {
        throw new Error(json.message || 'Failed to extract download URL.');
      }

      const { data } = json;

      if (data.status === 'picker') {
        // Multi-media carousel post
        setPickerMedia(data.picker);
      } else if (data.status === 'redirect') {
        // Single video/photo download link
        setSuccessData(data.url);
        
        // Auto-trigger download
        const a = document.createElement('a');
        a.href = data.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.download = `social_download_${Date.now()}`;
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
        <p>Save media and Reels from Instagram, YouTube, Snapchat, Pinterest, and Facebook directly to your device.</p>
      </div>

      <div className="social-layout">
        <div className="downloader-card">
          <div className="downloader-title-section">
            <h2>Download Reels & Videos</h2>
          </div>
          <p className="downloader-description">
            Paste a public link from a supported platform below to fetch the high-quality source video or photo files.
          </p>

          {/* Platform Tabs */}
          <div className="platform-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', width: 'auto' }}>
            <button 
              className={`platform-tab-btn ${activeTab === 'instagram' ? 'active' : ''}`}
              onClick={() => { setActiveTab('instagram'); handleClear(); }}
            >
              📷 Instagram
            </button>
            <button 
              className={`platform-tab-btn ${activeTab === 'youtube' ? 'active' : ''}`}
              onClick={() => { setActiveTab('youtube'); handleClear(); }}
            >
              📺 YouTube
            </button>
            <button 
              className={`platform-tab-btn ${activeTab === 'snapchat' ? 'active' : ''}`}
              onClick={() => { setActiveTab('snapchat'); handleClear(); }}
            >
              👻 Snapchat
            </button>
            <button 
              className={`platform-tab-btn ${activeTab === 'pinterest' ? 'active' : ''}`}
              onClick={() => { setActiveTab('pinterest'); handleClear(); }}
            >
              📌 Pinterest
            </button>
            <button 
              className={`platform-tab-btn ${activeTab === 'facebook' ? 'active' : ''}`}
              onClick={() => { setActiveTab('facebook'); handleClear(); }}
            >
              📘 Facebook
            </button>
          </div>

          {/* URL Form */}
          <form onSubmit={handleSubmit}>
            <div className="url-input-wrapper">
              <label htmlFor="social-url">
                Enter {
                  activeTab === 'instagram' ? 'Instagram Reel or Post' : 
                  activeTab === 'youtube' ? 'YouTube Video or Short' : 
                  activeTab === 'snapchat' ? 'Snapchat Spotlight or Story' : 
                  activeTab === 'pinterest' ? 'Pinterest Video Pin' : 
                  'Facebook Video or Reel'
                } Link:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  ref={inputRef}
                  id="social-url"
                  type="text"
                  className="downloader-input"
                  placeholder={
                    activeTab === 'instagram'
                      ? 'https://www.instagram.com/reel/...'
                      : activeTab === 'youtube'
                      ? 'https://www.youtube.com/watch?v=... or https://youtu.be/...'
                      : activeTab === 'snapchat'
                      ? 'https://www.snapchat.com/spotlight/...'
                      : activeTab === 'pinterest'
                      ? 'https://www.pinterest.com/pin/... or https://pin.it/...'
                      : 'https://www.facebook.com/watch/?v=... or https://fb.watch/...'
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
                <span>Contacting downloader server... This may take up to 15 seconds.</span>
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
