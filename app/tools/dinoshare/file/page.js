'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import '../dinoshare.css';

export default function FileShare() {
  const [activeTab, setActiveTab] = useState('send'); // 'send' or 'receive'
  const [isDirectLink, setIsDirectLink] = useState(false);
  
  // File upload states
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
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
  
  // Global message states
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isDemoWarning, setIsDemoWarning] = useState(false);

  const fileInputRef = useRef(null);
  const digitInputRefs = useRef([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryCode = params.get('code');
    if (queryCode && queryCode.match(/^\d{4}$/)) {
      setIsDirectLink(true);
      setActiveTab('receive');
      setCodeDigits(queryCode.split(''));
      handleRetrieve(queryCode);
    }
  }, []);

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

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

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadProgress(0);
    setErrorMessage('');
    setIsDemoWarning(false);

    try {
      const response = await fetch('/api/dinoshare/upload', {
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
          setupDemoResult(data.code);
          return;
        }
        throw new Error(data.error || 'Failed to initialize upload');
      }

      const { code, uploadUrl } = data;

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

  const setupSuccessResult = async (code) => {
    const origin = window.location.origin;
    const link = `${origin}/tools/dinoshare/file?code=${code}`;
    
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

  const resetShare = () => {
    setSelectedFile(null);
    setShareCode('');
    setShareLink('');
    setQrCodeUrl('');
    setUploadProgress(0);
    setIsUploading(false);
    setErrorMessage('');
    setIsDemoWarning(false);
  };

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
      const response = await fetch('/api/dinoshare/download', {
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

      if (data.type === 'text') {
        setErrorMessage(
          <span>
            This code is for a Text Clipboard. Please{' '}
            <Link 
              href={`/tools/dinoshare/text?code=${targetCode}`}
              style={{ color: 'var(--pixel-yellow)', textDecoration: 'underline', fontWeight: 'bold' }}
            >
              click here to view it in the Text Clipboard tool!
            </Link>
          </span>
        );
        return;
      }

      setRetrievedItem(data);
      setSuccessMessage('File loaded successfully!');
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'Invalid code or the file has expired.');
    } finally {
      setIsRetrieving(false);
    }
  };

  const handleDownloadDirectly = async () => {
    if (!shareCode) return;
    
    // In demo warning or if Supabase is not configured, download the uploaded local file directly from the browser
    if (isDemoWarning) {
      if (selectedFile) {
        const url = URL.createObjectURL(selectedFile);
        const a = document.createElement('a');
        a.href = url;
        a.download = selectedFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSuccessMessage('File downloaded successfully (Demo)!');
      } else {
        setErrorMessage("Demo mode: No local file uploaded to download.");
      }
      return;
    }

    setIsRetrieving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/dinoshare/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: shareCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to retrieve download link.');
      }

      if (data.downloadUrl) {
        const a = document.createElement('a');
        a.href = data.downloadUrl;
        a.download = data.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setSuccessMessage('File downloaded successfully!');
      } else {
        throw new Error("No download URL returned from the server.");
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to download the file.');
    } finally {
      setIsRetrieving(false);
    }
  };

  const handleDigitChange = (index, val) => {
    const cleanVal = val.replace(/[^0-9]/g, '').slice(-1);
    const newDigits = [...codeDigits];
    newDigits[index] = cleanVal;
    setCodeDigits(newDigits);

    if (cleanVal && index < 3) {
      digitInputRefs.current[index + 1]?.focus();
    }

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
      <Link href="/tools/dinoshare" className="tool-page-back">← Back to DinoShare</Link>
      
      <div className="tool-page-header">
        <h1>📁 File Share</h1>
        <p>Instantly upload and share files across any of your devices.</p>
      </div>

      <div className="share-wrapper">
        {isDirectLink ? (
          <div className="share-card">
            {isRetrieving && (
              <div className="loading-container">
                <div className="spinner"></div>
                <div className="loading-text">Retrieving shared file...</div>
              </div>
            )}

            {errorMessage && (
              <div className="retro-alert" style={{ marginBottom: 16 }}>
                <span>{errorMessage}</span>
              </div>
            )}

            {isDemoWarning && (
              <div className="retro-alert" style={{ marginBottom: 16, background: '#2b271b', borderColor: 'var(--pixel-yellow)', color: 'var(--pixel-yellow)' }}>
                <span>💡</span>
                <div><strong>Demo Mode:</strong> Live storage is not configured. Running in local simulation mode.</div>
              </div>
            )}

            {successMessage && (
              <div className="retro-success" style={{ marginBottom: 16 }}>
                <span>✓</span>
                <div>{successMessage}</div>
              </div>
            )}

            {retrievedItem && (
              <div className="download-result" style={{ display: 'block', margin: '10px 0' }}>
                <div className="download-result-header">
                  📂 FILE SHARED WITH YOU
                </div>

                <div className="download-file-card" style={{ marginTop: 12 }}>
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
              </div>
            )}

            {!isRetrieving && (
              <div style={{ marginTop: 24, textAlign: 'center', display: 'flex', gap: 10, justifyContent: 'center' }}>
                <Link href="/tools/dinoshare" className="btn btn-ghost" style={{ fontSize: '0.7rem' }}>
                  🦖 DINOSHARE HUB
                </Link>
                <button 
                  className="btn btn-primary" 
                  onClick={() => setIsDirectLink(false)}
                  style={{ fontSize: '0.7rem', background: '#000', color: '#fff' }}
                >
                  📤 UPLOAD A FILE
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="share-tabs">
              <button 
                className={`share-tab-btn ${activeTab === 'send' ? 'active' : ''}`}
                onClick={() => { setActiveTab('send'); setErrorMessage(''); setSuccessMessage(''); }}
              >
                📤 SEND FILE
              </button>
              <button 
                className={`share-tab-btn ${activeTab === 'receive' ? 'active' : ''}`}
                onClick={() => { setActiveTab('receive'); setErrorMessage(''); setSuccessMessage(''); }}
              >
                📥 RECEIVE FILE
              </button>
            </div>

            <div className="share-card">
              {errorMessage && (
                <div className="retro-alert" style={{ marginBottom: 16 }}>
                  <span>⚠️</span>
                  <div>{errorMessage}</div>
                </div>
              )}

              {isDemoWarning && (
                <div className="retro-alert" style={{ marginBottom: 16, background: '#2b271b', borderColor: 'var(--pixel-yellow)', color: 'var(--pixel-yellow)' }}>
                  <span>💡</span>
                  <div><strong>Demo Mode:</strong> Live storage is not configured. Running in local simulation mode. (Enter code '9999' in the RECEIVE tab to test).</div>
                </div>
              )}

              {successMessage && (
                <div className="retro-success" style={{ marginBottom: 16 }}>
                  <span>✓</span>
                  <div>{successMessage}</div>
                </div>
              )}

              {activeTab === 'send' && (
                <div className="share-panel">
                  {!shareCode ? (
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
                            <span>Uploading file to storage...</span>
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
                        {isUploading ? 'UPLOADING...' : '📤 UPLOAD'}
                      </button>
                    </div>
                  ) : (
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

                  {retrievedItem && (
                    <div className="download-result">
                      <div className="download-result-header">
                        📂 FILE READY FOR DOWNLOAD
                      </div>

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
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
