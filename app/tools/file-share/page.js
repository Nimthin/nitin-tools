'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import './file-share.css';

export default function FileShare() {
  const [activeTab, setActiveTab] = useState('send'); // 'send' or 'receive'
  const [sendType, setSendType] = useState('file'); // 'file' or 'text'
  
  // File upload states
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Text share states
  const [clipboardText, setClipboardText] = useState('');
  const [isSavingText, setIsSavingText] = useState(false);
  
  // Share result states
  const [shareCode, setShareCode] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  
  // Retrieve / Download states
  const [codeDigits, setCodeDigits] = useState(['', '', '', '']);
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [retrievedItem, setRetrievedItem] = useState(null); // { type, text, downloadUrl, fileName, fileSize }
  const [copiedRetrievedText, setCopiedRetrievedText] = useState(false);
  
  // Global message states
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isDemoWarning, setIsDemoWarning] = useState(false);

  const fileInputRef = useRef(null);
  const digitInputRefs = useRef([]);

  // Check URL parameters for direct share codes (e.g. ?code=1234)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryCode = params.get('code');
    if (queryCode && queryCode.match(/^\d{4}$/)) {
      setActiveTab('receive');
      setCodeDigits(queryCode.split(''));
      handleRetrieve(queryCode);
    }
  }, []);

  // Format bytes helper
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Drag and drop handlers
  const [dragOver, setDragOver] = useState(false);
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => {
    setDragOver(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setErrorMessage('');
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorMessage('');
    }
  };

  // Upload file flow
  const handleFileUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadProgress(0);
    setErrorMessage('');
    setIsDemoWarning(false);

    try {
      // 1. Get presigned PUT URL from API route
      const response = await fetch('/api/file-share/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFile.name,
          contentType: selectedFile.type || 'application/octet-stream',
          fileSize: selectedFile.size,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 503 && data.isDemo) {
          // R2 not configured demo fallback
          setupDemoResult(data.code);
          return;
        }
        throw new Error(data.error || 'Failed to initialize upload');
      }

      const { code, uploadUrl } = data;

      // 2. Perform direct PUT upload to R2 with progress monitoring
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', selectedFile.type || 'application/octet-stream');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percentComplete);
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200) {
          await setupSuccessResult(code);
        } else {
          setErrorMessage('Failed to upload file to storage bucket.');
          setIsUploading(false);
        }
      };

      xhr.onerror = () => {
        setErrorMessage('Network error during file upload.');
        setIsUploading(false);
      };

      xhr.send(selectedFile);
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'An error occurred during upload.');
      setIsUploading(false);
    }
  };

  // Save text flow
  const handleTextSave = async () => {
    if (!clipboardText.trim()) return;
    setIsSavingText(true);
    setErrorMessage('');
    setIsDemoWarning(false);

    try {
      const response = await fetch('/api/file-share/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clipboardText }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 503 && data.isDemo) {
          // Demo fallback
          setupDemoResult(data.code);
          return;
        }
        throw new Error(data.error || 'Failed to save text');
      }

      await setupSuccessResult(data.code);
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'An error occurred while saving text.');
    } finally {
      setIsSavingText(false);
    }
  };

  // Shared helper to generate code display, link, and QR code
  const setupSuccessResult = async (code) => {
    const origin = window.location.origin;
    const link = `${origin}/tools/file-share?code=${code}`;
    
    try {
      const qrDataUrl = await QRCode.toDataURL(link, {
        margin: 2,
        width: 200,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrCodeUrl(qrDataUrl);
    } catch (qrErr) {
      console.error('Failed to generate QR code', qrErr);
    }

    setShareCode(code);
    setShareLink(link);
    setIsUploading(false);
    setUploadProgress(100);
  };

  const setupDemoResult = async (code) => {
    setIsDemoWarning(true);
    await setupSuccessResult(code);
  };

  // Copy helpers
  const copyLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyCode = () => {
    if (!shareCode) return;
    navigator.clipboard.writeText(shareCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyRetrievedText = () => {
    if (!retrievedItem || !retrievedItem.text) return;
    navigator.clipboard.writeText(retrievedItem.text);
    setCopiedRetrievedText(true);
    setTimeout(() => setCopiedRetrievedText(false), 2000);
  };

  const resetShare = () => {
    setSelectedFile(null);
    setClipboardText('');
    setShareCode('');
    setShareLink('');
    setQrCodeUrl('');
    setUploadProgress(0);
    setIsUploading(false);
    setErrorMessage('');
    setIsDemoWarning(false);
  };

  // Retrieve flow
  const handleRetrieve = async (codeString) => {
    const targetCode = codeString || codeDigits.join('');
    if (targetCode.length !== 4) {
      setErrorMessage('Please enter a 4-digit code.');
      return;
    }

    setIsRetrieving(true);
    setErrorMessage('');
    setSuccessMessage('');
    setRetrievedItem(null);
    setIsDemoWarning(false);

    try {
      const response = await fetch('/api/file-share/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: targetCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to retrieve item.');
      }

      if (data.isDemo) {
        setIsDemoWarning(true);
      }

      setRetrievedItem(data);
      setSuccessMessage('Item loaded successfully!');
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'Invalid code or the share has expired.');
    } finally {
      setIsRetrieving(false);
    }
  };

  // Code input box helpers
  const handleDigitChange = (index, val) => {
    const cleanVal = val.replace(/[^0-9]/g, '').slice(-1);
    const newDigits = [...codeDigits];
    newDigits[index] = cleanVal;
    setCodeDigits(newDigits);

    // Auto focus next
    if (cleanVal && index < 3) {
      digitInputRefs.current[index + 1]?.focus();
    }

    // Auto submit if complete
    const fullCode = newDigits.join('');
    if (fullCode.length === 4) {
      handleRetrieve(fullCode);
    }
  };

  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
    }
  };

  const handleDigitPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim().replace(/[^0-9]/g, '');
    if (pasted.length >= 4) {
      const parsed = pasted.slice(0, 4).split('');
      setCodeDigits(parsed);
      handleRetrieve(parsed.join(''));
    }
  };

  const clearCodeInputs = () => {
    setCodeDigits(['', '', '', '']);
    setRetrievedItem(null);
    setErrorMessage('');
    setSuccessMessage('');
    setIsDemoWarning(false);
  };

  return (
    <div className="tool-page">
      <Link href="/" className="tool-page-back">← Back to Toolkit</Link>
      
      <div className="tool-page-header">
        <h1>🔗 DinoShare</h1>
        <p>Instantly upload and share files or text across any of your devices.</p>
      </div>

      <div className="share-wrapper">
        {/* Main Tab Switcher */}
        <div className="share-tabs">
          <button 
            className={`share-tab-btn ${activeTab === 'send' ? 'active' : ''}`}
            onClick={() => { setActiveTab('send'); setErrorMessage(''); setSuccessMessage(''); }}
          >
            📤 SEND
          </button>
          <button 
            className={`share-tab-btn ${activeTab === 'receive' ? 'active' : ''}`}
            onClick={() => { setActiveTab('receive'); setErrorMessage(''); setSuccessMessage(''); }}
          >
            📥 RECEIVE
          </button>
        </div>

        <div className="share-card">
          {/* Error & Warning Displays */}
          {errorMessage && (
            <div className="retro-alert" style={{ marginBottom: 16 }}>
              <span>⚠️</span>
              <div>{errorMessage}</div>
            </div>
          )}

          {isDemoWarning && (
            <div className="retro-alert" style={{ marginBottom: 16, background: '#2b271b', borderColor: 'var(--pixel-yellow)', color: 'var(--pixel-yellow)' }}>
              <span>💡</span>
              <div><strong>Demo Mode:</strong> Cloudflare R2 is not fully configured in your environment. Operations are using simulation defaults.</div>
            </div>
          )}

          {successMessage && (
            <div className="retro-success" style={{ marginBottom: 16 }}>
              <span>✓</span>
              <div>{successMessage}</div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* TAB: SEND                                                            */}
          {/* ==================================================================== */}
          {activeTab === 'send' && (
            <div className="share-panel">
              {!shareCode ? (
                <>
                  {/* Send Type Switcher */}
                  <div className="sub-tabs">
                    <button 
                      className={`sub-tab-btn ${sendType === 'file' ? 'active' : ''}`}
                      onClick={() => { setSendType('file'); setErrorMessage(''); }}
                    >
                      📁 FILE SHARE
                    </button>
                    <button 
                      className={`sub-tab-btn ${sendType === 'text' ? 'active' : ''}`}
                      onClick={() => { setSendType('text'); setErrorMessage(''); }}
                    >
                      ✏️ TEXT CLIPBOARD
                    </button>
                  </div>

                  {/* FILE UPLOAD PANEL */}
                  {sendType === 'file' && (
                    <div className="file-upload-container">
                      <div 
                        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        style={{ cursor: 'pointer', minHeight: 180 }}
                      >
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleFileChange} 
                          style={{ display: 'none' }}
                        />
                        <div className="upload-zone-icon">☁️</div>
                        <div className="upload-zone-text">
                          Drag & drop any file here, or click to browse
                        </div>
                      </div>

                      {selectedFile && (
                        <div className="upload-details">
                          <div className="upload-file-info">
                            <span>📄</span>
                            <div>
                              <div className="upload-file-name">{selectedFile.name}</div>
                              <div className="upload-file-size">{formatBytes(selectedFile.size)}</div>
                            </div>
                          </div>
                          <button 
                            className="btn btn-ghost" 
                            onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                            style={{ padding: '6px 10px', fontSize: '0.65rem' }}
                            disabled={isUploading}
                          >
                            Remove
                          </button>
                        </div>
                      )}

                      {isUploading && (
                        <div className="progress-container">
                          <div className="progress-header">
                            <span>Uploading file directly to R2...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }}></div>
                          </div>
                        </div>
                      )}

                      <button 
                        className="btn btn-primary"
                        onClick={handleFileUpload}
                        disabled={!selectedFile || isUploading}
                        style={{ padding: 12, background: 'var(--pixel-green, #4caf50)', color: '#fff', fontSize: '0.75rem' }}
                      >
                        {isUploading ? 'UPLOADING...' : '📤 UPLOAD & GET CODE'}
                      </button>
                    </div>
                  )}

                  {/* TEXT CLIPBOARD PANEL */}
                  {sendType === 'text' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div className="text-area-label">PASTE TEXT TO SHARE:</div>
                      <textarea
                        className="text-area-input"
                        placeholder="Type or paste any text/link here..."
                        value={clipboardText}
                        onChange={(e) => setClipboardText(e.target.value)}
                        disabled={isSavingText}
                      />
                      <button 
                        className="btn btn-primary"
                        onClick={handleTextSave}
                        disabled={!clipboardText.trim() || isSavingText}
                        style={{ padding: 12, background: 'var(--pixel-cyan, #00bcd4)', color: '#000', fontSize: '0.75rem' }}
                      >
                        {isSavingText ? 'SAVING...' : '📋 SHARE TEXT CLIPBOARD'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* SHARE DETAILS TICKET VIEW */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="ticket-card" style={{ width: '100%', maxWidth: 450 }}>
                    <div className="ticket-title">DINOSHARE TICKET</div>
                    <div className="ticket-code-label">YOUR 4-DIGIT ACCESS CODE</div>
                    <div className="ticket-code">{shareCode}</div>
                    
                    {qrCodeUrl && (
                      <div className="ticket-qr">
                        <img 
                          src={qrCodeUrl} 
                          alt="Access QR Code"
                          style={{ width: 140, height: 140, imageRendering: 'pixelated' }}
                        />
                      </div>
                    )}

                    <div className="ticket-meta">
                      Type code on receiving device or scan QR
                    </div>
                    <div className="ticket-expiry">
                      ⌛ Expires in 24 hours
                    </div>
                  </div>

                  <div style={{ width: '100%', maxWidth: 450, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="link-group">
                      <input 
                        type="text" 
                        className="link-input" 
                        value={shareLink} 
                        readOnly 
                        onClick={(e) => e.target.select()}
                      />
                      <button className="link-copy-btn" onClick={copyLink}>
                        {copiedLink ? 'COPIED!' : 'COPY'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        className="btn btn-ghost" 
                        onClick={copyCode}
                        style={{ flex: 1, padding: 10, fontSize: '0.7rem' }}
                      >
                        {copiedCode ? '✓ CODE COPIED' : '📋 COPY CODE'}
                      </button>
                      <button 
                        className="btn btn-primary" 
                        onClick={resetShare}
                        style={{ flex: 1, padding: 10, fontSize: '0.7rem', background: '#000', color: '#fff' }}
                      >
                        🔄 SHARE ANOTHER
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================================================================== */}
          {/* TAB: RECEIVE                                                         */}
          {/* ==================================================================== */}
          {activeTab === 'receive' && (
            <div className="share-panel">
              <div className="code-input-container">
                <div className="text-area-label">ENTER 4-DIGIT SHARE CODE:</div>
                <div className="digit-inputs">
                  {codeDigits.map((digit, i) => (
                    <input
                      key={i}
                      type="text"
                      ref={(el) => (digitInputRefs.current[i] = el)}
                      className="digit-input"
                      value={digit}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(i, e)}
                      onPaste={i === 0 ? handleDigitPaste : undefined}
                      disabled={isRetrieving}
                      placeholder="•"
                    />
                  ))}
                </div>
                
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleRetrieve()}
                    disabled={isRetrieving || codeDigits.join('').length !== 4}
                    style={{ padding: '8px 16px', fontSize: '0.7rem', background: 'var(--pixel-yellow, #ffeb3b)', color: '#000' }}
                  >
                    {isRetrieving ? 'RETRIEVING...' : '🔍 RETRIEVE'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={clearCodeInputs}
                    style={{ padding: '8px 16px', fontSize: '0.7rem' }}
                  >
                    CLEAR
                  </button>
                </div>
              </div>

              {/* RETRIEVED CONTENT PRESENTATION */}
              {retrievedItem && (
                <div className="download-result">
                  <div className="download-result-header">
                    {retrievedItem.type === 'file' ? '📂 FILE READY FOR DOWNLOAD' : '✏️ RETRIEVED TEXT CLIPBOARD'}
                  </div>

                  {retrievedItem.type === 'file' ? (
                    <div className="download-file-card">
                      <div className="download-file-icon">💾</div>
                      <div className="download-file-meta">
                        <div className="download-file-title">{retrievedItem.fileName}</div>
                        <div className="download-file-specs">
                          Size: {formatBytes(retrievedItem.fileSize)}
                        </div>
                      </div>
                      <a 
                        href={retrievedItem.downloadUrl}
                        download={retrievedItem.fileName}
                        className="btn btn-primary"
                        style={{ 
                          padding: '10px 14px', 
                          background: 'var(--pixel-green, #4caf50)', 
                          color: '#fff', 
                          fontSize: '0.7rem',
                          textDecoration: 'none',
                          display: 'inline-block'
                        }}
                      >
                        DOWNLOAD
                      </a>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div className="clipboard-result-box">
                        {retrievedItem.text}
                      </div>
                      <button 
                        className="btn btn-primary" 
                        onClick={copyRetrievedText}
                        style={{ padding: 10, background: 'var(--pixel-cyan, #00bcd4)', color: '#000', fontSize: '0.7rem' }}
                      >
                        {copiedRetrievedText ? '✓ COPIED TO CLIPBOARD' : '📋 COPY TO CLIPBOARD'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
