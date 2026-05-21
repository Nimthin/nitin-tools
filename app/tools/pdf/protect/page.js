'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { PDFDocument } from 'pdf-lib';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite';

// FairyLights Component for the Success Screen
const FairyLights = () => {
  const colors = ['#ff3b30', '#00bcd4', '#34c759', '#ffcc00', '#ff007f'];
  const lights = [];
  
  for (let i = 0; i < 18; i++) {
    const color = colors[i % colors.length];
    const rotation = -15 + Math.random() * 30;
    lights.push(
      <div key={`top-${i}`} className="fairy-light" style={{ backgroundColor: color, top: '18px', left: `${4 + (i * 5.4)}%`, transform: `rotate(${rotation}deg)`, animationDelay: `${Math.random() * 2}s`, animationDuration: `${0.8 + Math.random()}s`, boxShadow: `0 0 12px ${color}, 0 0 4px ${color}` }} />
    );
  }
  
  for (let i = 0; i < 18; i++) {
    const color = colors[(i + 2) % colors.length];
    const rotation = -15 + Math.random() * 30;
    lights.push(
      <div key={`bot-${i}`} className="fairy-light" style={{ backgroundColor: color, bottom: '18px', left: `${4 + (i * 5.4)}%`, transform: `rotate(${rotation}deg) rotateX(180deg)`, animationDelay: `${Math.random() * 2}s`, animationDuration: `${0.8 + Math.random()}s`, boxShadow: `0 0 12px ${color}, 0 0 4px ${color}` }} />
    );
  }
  
  return <><div className="fairy-wire top" /><div className="fairy-wire bottom" />{lights}</>;
};

export default function ProtectUnlockPdf() {
  const [activeTab, setActiveTab] = useState('protect'); // 'protect' | 'unlock'
  const [file, setFile] = useState(null);
  
  // Protect state
  const [protectPassword, setProtectPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Unlock state
  const [unlockPassword, setUnlockPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    if (selected && selected.type === 'application/pdf') {
      setFile(selected);
      setError(null);
      setNeedsPassword(false);
      setUnlockPassword('');
      setProtectPassword('');
      setConfirmPassword('');
      
      if (activeTab === 'unlock') {
        // Test if it is encrypted
        try {
          const arrayBuffer = await selected.arrayBuffer();
          await PDFDocument.load(arrayBuffer);
          setError("This PDF is not password-protected. No unlock is needed.");
        } catch (err) {
          if (err.message.includes('encrypted') || err.name === 'EncryptedPDFError') {
            setNeedsPassword(true);
            setError(null);
          } else {
            setError("Failed to read PDF. It might be corrupted.");
          }
        }
      }
    } else {
      setError('Please select a valid PDF file.');
    }
  };

  const handleProtect = async () => {
    if (!file || !protectPassword) return;
    if (protectPassword !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      // Use `@pdfsmaller/pdf-encrypt-lite` to encrypt PDF
      const encryptedBytes = await encryptPDF(
        new Uint8Array(arrayBuffer),
        protectPassword,
        protectPassword // use same owner password
      );

      const blob = new Blob([encryptedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `Protected_${file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setIsComplete(true);
    } catch (err) {
      console.error(err);
      setError("Failed to password protect PDF: " + (err.message || 'unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnlock = async () => {
    if (!file || !unlockPassword) return;
    
    setIsProcessing(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { password: unlockPassword });
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `Unlocked_${file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setIsComplete(true);
    } catch (err) {
      console.error(err);
      if (err.message.includes('password') || err.message.includes('encrypted')) {
        setError('Incorrect password. Please try again.');
      } else {
        setError('Failed to unlock PDF. The file might be corrupted.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    resetTool();
  };

  const resetTool = () => {
    setFile(null);
    setIsComplete(false);
    setError(null);
    setNeedsPassword(false);
    setUnlockPassword('');
    setProtectPassword('');
    setConfirmPassword('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="tool-page">
      <Link href="/tools/pdf" className="tool-page-back">← Back to PDF Toolkit</Link>
      <div className="tool-page-header">
        <h1>🔒 Protect & Unlock PDF</h1>
        <p>Add password protection to secure your PDF, or strip passwords from encrypted files.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={() => handleTabChange('protect')}
          className={`btn ${activeTab === 'protect' ? 'btn-selected' : 'btn-ghost'}`}
          style={{ padding: '12px 24px', fontFamily: 'var(--font-pixel)', fontSize: '0.85rem' }}
        >
          🔒 Protect PDF
        </button>
        <button 
          onClick={() => handleTabChange('unlock')}
          className={`btn ${activeTab === 'unlock' ? 'btn-selected' : 'btn-ghost'}`}
          style={{ padding: '12px 24px', fontFamily: 'var(--font-pixel)', fontSize: '0.85rem' }}
        >
          🔓 Unlock PDF
        </button>
      </div>

      {isComplete ? (
        <div className="result-container" style={{ position: 'relative', textAlign: 'center', padding: '60px 20px', background: '#2d1b4e', border: '4px solid #ff007f', boxShadow: '0 0 30px rgba(255, 0, 127, 0.4), inset 0 0 20px rgba(0,0,0,0.5)', marginTop: '20px' }}>
          <FairyLights />
          <div style={{ fontSize: '5rem', marginBottom: '20px', filter: 'drop-shadow(4px 4px 0px #000)' }}>🎉</div>
          <h2 style={{ fontFamily: 'var(--font-pixel)', color: '#ffcc00', marginBottom: '20px', fontSize: '2rem', textShadow: '4px 4px 0px #000' }}>TASK DONE!</h2>
          <p style={{ marginBottom: '40px', fontSize: '1.1rem', color: '#ffffff' }}>
            {activeTab === 'protect' ? 'Your protected PDF has been downloaded successfully.' : 'Your unlocked PDF has been downloaded successfully.'}
          </p>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={resetTool} style={{ padding: '12px 24px', fontSize: '1rem' }}>
              {activeTab === 'protect' ? 'Protect Another PDF' : 'Unlock Another PDF'}
            </button>
          </div>
        </div>
      ) : (
        <div className="result-container" style={{ padding: '20px', background: 'var(--pixel-bg-card)', border: '3px solid var(--pixel-border)' }}>
          {error && <div className="error-message">⚠️ {error}</div>}
          
          {!file ? (
            <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
              <div className="upload-zone-icon">{activeTab === 'protect' ? '🔓' : '🔒'}</div>
              <div className="upload-zone-text">
                {activeTab === 'protect' ? 'Click or drag a PDF here to encrypt' : 'Click or drag a protected PDF here to decrypt'}
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" style={{ display: 'none' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', color: 'var(--pixel-cyan)' }}>
                <span>📄</span> <strong>{file.name}</strong>
              </div>
              
              {activeTab === 'protect' && (
                <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.8rem', color: '#fff' }}>CHOOSE PASSWORD:</label>
                    <input 
                      type="password" 
                      value={protectPassword}
                      onChange={(e) => setProtectPassword(e.target.value)}
                      placeholder="Secret Password..."
                      style={{ padding: '12px', fontSize: '1rem', border: '3px solid var(--pixel-border)', background: '#fff', color: '#000' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.8rem', color: '#fff' }}>CONFIRM PASSWORD:</label>
                    <input 
                      type="password" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm Password..."
                      style={{ padding: '12px', fontSize: '1rem', border: '3px solid var(--pixel-border)', background: '#fff', color: '#000' }}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'unlock' && needsPassword && (
                <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.8rem', color: '#fff' }}>ENTER CURRENT PASSWORD:</label>
                  <input 
                    type="password" 
                    value={unlockPassword}
                    onChange={(e) => setUnlockPassword(e.target.value)}
                    placeholder="Secret Password..."
                    style={{ padding: '12px', fontSize: '1rem', border: '3px solid var(--pixel-border)', background: '#fff', color: '#000' }}
                  />
                  <small style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: '10px' }}>
                    Note: Unlocking happens entirely in your browser. Your password is never uploaded.
                  </small>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button className="btn btn-ghost" onClick={resetTool} disabled={isProcessing}>Cancel</button>
                {activeTab === 'protect' && (
                  <button className="btn btn-primary" onClick={handleProtect} disabled={isProcessing || !protectPassword || !confirmPassword}>
                    {isProcessing ? 'Protecting...' : 'Protect & Download'}
                  </button>
                )}
                {activeTab === 'unlock' && needsPassword && (
                  <button className="btn btn-primary" onClick={handleUnlock} disabled={isProcessing || !unlockPassword}>
                    {isProcessing ? 'Unlocking...' : 'Unlock & Download'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
