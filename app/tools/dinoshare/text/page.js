'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import '../dinoshare.css';

export default function ClipboardShare() {
  const [activeTab, setActiveTab] = useState('send'); // 'send' or 'receive'
  const [isDirectLink, setIsDirectLink] = useState(false);
  
  // Text share states
  const [clipboardText, setClipboardText] = useState('');
  const [isSavingText, setIsSavingText] = useState(false);
  
  // Share result states
  const [shareCode, setShareCode] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  
  // Retrieve / Clipboard states
  const [codeDigits, setCodeDigits] = useState(['', '', '', '']);
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [retrievedItem, setRetrievedItem] = useState(null); // { type, text, fileName }
  const [copiedRetrievedText, setCopiedRetrievedText] = useState(false);
  const [copiedDirectly, setCopiedDirectly] = useState(false);
  
  // Global message states
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isDemoWarning, setIsDemoWarning] = useState(false);

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

  const handleTextSave = async () => {
    if (!clipboardText.trim()) return;
    setIsSavingText(true);
    setErrorMessage('');
    setIsDemoWarning(false);

    try {
      const response = await fetch('/api/dinoshare/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clipboardText }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 503 && data.isDemo) {
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

  const setupSuccessResult = async (code) => {
    const origin = window.location.origin;
    const link = `${origin}/d/${code}`;
    
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

  const copyRetrievedText = () => {
    if (!retrievedItem || !retrievedItem.text) return;
    navigator.clipboard.writeText(retrievedItem.text);
    setCopiedRetrievedText(true);
    setTimeout(() => setCopiedRetrievedText(false), 2000);
  };

  const handleCopyDirectly = () => {
    if (!clipboardText) return;
    navigator.clipboard.writeText(clipboardText);
    setCopiedDirectly(true);
    setSuccessMessage('Clipboard text copied directly!');
    setTimeout(() => setCopiedDirectly(false), 2000);
  };

  const resetShare = () => {
    setClipboardText('');
    setShareCode('');
    setShareLink('');
    setQrCodeUrl('');
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

      if (data.type === 'file') {
        setErrorMessage(
          <span>
            This code is for a shared File. Please{' '}
            <Link 
              href={`/tools/dinoshare/file?code=${targetCode}`}
              style={{ color: 'var(--pixel-yellow)', textDecoration: 'underline', fontWeight: 'bold' }}
            >
              click here to view/download it in the File Share tool!
            </Link>
          </span>
        );
        return;
      }

      setRetrievedItem(data);
      setSuccessMessage('Clipboard loaded successfully!');
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'Invalid code or the clipboard has expired.');
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
        <h1>✏️ Text Clipboard</h1>
        <p>Instantly share text clipboards across any of your devices.</p>
      </div>

      <div className="share-wrapper">
        {isDirectLink ? (
          <div className="share-card">
            {isRetrieving && (
              <div className="loading-container">
                <div className="spinner"></div>
                <div className="loading-text">Retrieving shared clipboard...</div>
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
              <div style={{ margin: '10px 0' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  marginBottom: '14px',
                  paddingBottom: '10px',
                  borderBottom: '1px dashed #333'
                }}>
                  <span style={{ fontSize: '1rem' }}>📋</span>
                  <span style={{ 
                    fontFamily: 'var(--font-pixel)', 
                    fontSize: '0.6rem', 
                    letterSpacing: '1px', 
                    color: 'var(--pixel-cyan, #00bcd4)'
                  }}>
                    TEXT SHARED WITH YOU
                  </span>
                </div>

                <div className="clipboard-result-box">
                  {retrievedItem.text}
                </div>

                <button 
                  className="btn btn-primary" 
                  onClick={copyRetrievedText}
                  style={{ 
                    padding: '12px', 
                    background: copiedRetrievedText ? 'var(--pixel-green, #4caf50)' : 'var(--pixel-cyan, #00bcd4)', 
                    color: '#000', 
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-pixel)',
                    width: '100%',
                    marginTop: '14px',
                    border: '3px solid #000',
                    boxShadow: copiedRetrievedText ? '3px 3px 0px #1b5e20' : '3px 3px 0px #00768b',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {copiedRetrievedText ? '✓ COPIED TO CLIPBOARD' : '📋 COPY TO CLIPBOARD'}
                </button>
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
                  📝 SHARE NEW TEXT
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
                📤 SHARE CLIPBOARD
              </button>
              <button 
                className={`share-tab-btn ${activeTab === 'receive' ? 'active' : ''}`}
                onClick={() => { setActiveTab('receive'); setErrorMessage(''); setSuccessMessage(''); }}
              >
                📥 RECEIVE CLIPBOARD
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
                        {isSavingText ? 'SAVING...' : '📋 SHARE CLIPBOARD'}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div className="ticket-card" style={{ width: '100%', maxWidth: 450 }}>
                        <div className="ticket-title">DINOCLIP TICKET</div>
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
                    <div style={{ marginTop: '14px' }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        marginBottom: '14px',
                        paddingBottom: '10px',
                        borderBottom: '1px dashed #333'
                      }}>
                        <span style={{ fontSize: '1rem' }}>📋</span>
                        <span style={{ 
                          fontFamily: 'var(--font-pixel)', 
                          fontSize: '0.6rem', 
                          letterSpacing: '1px', 
                          color: 'var(--pixel-cyan, #00bcd4)'
                        }}>
                          RETRIEVED TEXT CLIPBOARD
                        </span>
                      </div>

                      <div className="clipboard-result-box">
                        {retrievedItem.text}
                      </div>

                      <button 
                        className="btn btn-primary" 
                        onClick={copyRetrievedText}
                        style={{ 
                          padding: '12px', 
                          background: copiedRetrievedText ? 'var(--pixel-green, #4caf50)' : 'var(--pixel-cyan, #00bcd4)', 
                          color: '#000', 
                          fontSize: '0.7rem',
                          fontFamily: 'var(--font-pixel)',
                          width: '100%',
                          marginTop: '14px',
                          border: '3px solid #000',
                          boxShadow: copiedRetrievedText ? '3px 3px 0px #1b5e20' : '3px 3px 0px #00768b',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {copiedRetrievedText ? '✓ COPIED TO CLIPBOARD' : '📋 COPY TO CLIPBOARD'}
                      </button>
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
