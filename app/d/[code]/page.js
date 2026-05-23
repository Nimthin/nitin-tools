'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import '../../tools/dinoshare/dinoshare.css';

export default function StandaloneSharePage({ params }) {
  const code = params?.code || '';
  const [isRetrieving, setIsRetrieving] = useState(true);
  const [retrievedItem, setRetrievedItem] = useState(null); // { type, text, downloadUrl, fileName, fileSize }
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isDemoWarning, setIsDemoWarning] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    if (code && code.match(/^\d{4}$/)) {
      handleRetrieve(code);
    } else {
      setErrorMessage('Invalid access code format. Please provide a 4-digit code.');
      setIsRetrieving(false);
    }
  }, [code]);

  const handleRetrieve = async (targetCode) => {
    setIsRetrieving(true);
    setErrorMessage('');
    setSuccessMessage('');
    setRetrievedItem(null);
    setIsDemoWarning(false);

    try {
      const response = await fetch('/api/dinoshare/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: targetCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to retrieve shared item.');
      }

      if (data.isDemo) {
        setIsDemoWarning(true);
      }

      setRetrievedItem(data);
      setSuccessMessage(data.type === 'file' ? 'File retrieved successfully!' : 'Clipboard text retrieved successfully!');
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'Invalid code or the shared item has expired.');
    } finally {
      setIsRetrieving(false);
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const copyText = () => {
    if (!retrievedItem || !retrievedItem.text) return;
    navigator.clipboard.writeText(retrievedItem.text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="isolated-share-container">
      <div className="isolated-logo">
        🦖 DinoShare
      </div>

      <div className="share-wrapper" style={{ padding: '10px', width: '100%', maxWidth: '500px' }}>
        <div className="share-card" style={{ marginTop: 0 }}>
          {isRetrieving && (
            <div className="loading-container" style={{ padding: '40px 0' }}>
              <div className="spinner"></div>
              <div className="loading-text">
                RETRIEVING SHARED ITEM...
              </div>
            </div>
          )}

          {errorMessage && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div className="retro-alert" style={{ marginBottom: 20, justifyContent: 'center' }}>
                <span>⚠️ {errorMessage}</span>
              </div>
              <p style={{ color: '#888', fontSize: '0.8rem', fontFamily: 'monospace', lineHeight: '1.4' }}>
                Double-check the link or code. Sharing codes expire after 24 hours.
              </p>
            </div>
          )}

          {!isRetrieving && retrievedItem && (
            <div className="retrieved-content">
              {isDemoWarning && (
                <div className="retro-alert" style={{ marginBottom: 16, background: '#2b271b', borderColor: 'var(--pixel-yellow)', color: 'var(--pixel-yellow)' }}>
                  <span>💡</span>
                  <div><strong>Demo Mode:</strong> Live storage is not configured. Running in local simulation mode.</div>
                </div>
              )}

              {retrievedItem.type === 'file' ? (
                <div className="download-result" style={{ display: 'block', margin: 0, background: 'transparent', border: 'none', padding: 0 }}>
                  <div className="download-result-header" style={{ fontSize: '0.6rem', letterSpacing: '1px', marginBottom: '16px' }}>
                    📁 FILE READY FOR DOWNLOAD
                  </div>

                  <div className="download-file-card" style={{ flexDirection: 'column', gap: '20px', padding: '24px', background: '#0e0e0e' }}>
                    <div className="download-file-icon" style={{ fontSize: '3rem' }}>💾</div>
                    
                    <div className="download-file-meta" style={{ width: '100%', textAlign: 'center', margin: 0 }}>
                      <div className="download-file-title" style={{ fontSize: '1.05rem', color: '#fff', fontWeight: 'bold' }}>
                        {retrievedItem.fileName}
                      </div>
                      <div className="download-file-specs" style={{ fontSize: '0.8rem', color: '#888', marginTop: '6px' }}>
                        Size: {formatBytes(retrievedItem.fileSize)}
                      </div>
                    </div>

                    <a 
                      href={retrievedItem.downloadUrl}
                      download={retrievedItem.fileName}
                      className="btn btn-primary"
                      style={{ 
                        width: '100%',
                        padding: '14px', 
                        background: 'var(--pixel-green, #4caf50)', 
                        color: '#fff', 
                        fontSize: '0.8rem',
                        fontFamily: 'var(--font-pixel)',
                        textAlign: 'center',
                        textDecoration: 'none',
                        display: 'block',
                        boxShadow: '4px 4px 0px #1b5e20',
                        border: '3px solid #000',
                        cursor: 'pointer'
                      }}
                    >
                      DOWNLOAD FILE
                    </a>
                  </div>
                </div>
              ) : (
                <div style={{ margin: 0 }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    marginBottom: '16px',
                    paddingBottom: '12px',
                    borderBottom: '1px dashed #333'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>📋</span>
                    <span style={{ 
                      fontFamily: 'var(--font-pixel)', 
                      fontSize: '0.6rem', 
                      letterSpacing: '1px', 
                      color: 'var(--pixel-cyan, #00bcd4)',
                      textTransform: 'uppercase'
                    }}>
                      Shared Clipboard Text
                    </span>
                  </div>

                  <div className="clipboard-result-box">
                    {retrievedItem.text}
                  </div>

                  <button 
                    className="btn btn-primary" 
                    onClick={copyText}
                    style={{ 
                      padding: '14px', 
                      background: copiedText ? 'var(--pixel-green, #4caf50)' : 'var(--pixel-cyan, #00bcd4)', 
                      color: '#000', 
                      fontSize: '0.8rem',
                      fontFamily: 'var(--font-pixel)',
                      boxShadow: copiedText ? '4px 4px 0px #1b5e20' : '4px 4px 0px #00768b',
                      border: '3px solid #000',
                      width: '100%',
                      cursor: 'pointer',
                      marginTop: '16px',
                      transition: 'all 0.15s ease',
                      letterSpacing: '0.5px'
                    }}
                  >
                    {copiedText ? '✓ COPIED TO CLIPBOARD!' : '📋 COPY TO CLIPBOARD'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="isolated-footer">
        Powered by DinoTools 🦖
      </div>
    </div>
  );
}
