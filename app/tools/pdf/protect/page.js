'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { PDFDocument } from 'pdf-lib';

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

export default function UnlockPdf() {
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('');
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
      setPassword('');
      
      // Let's quickly test if it's encrypted
      try {
        const arrayBuffer = await selected.arrayBuffer();
        await PDFDocument.load(arrayBuffer);
        // If it succeeds without a password, it's not encrypted!
        setError("This PDF is already unlocked. No password protection was detected.");
      } catch (err) {
        if (err.message.includes('encrypted') || err.name === 'EncryptedPDFError') {
          setNeedsPassword(true);
          setError(null);
        } else {
          setError("Failed to read PDF. It might be corrupted.");
        }
      }
    } else {
      setError('Please select a valid PDF file.');
    }
  };

  const handleUnlock = async () => {
    if (!file || !password) return;
    
    setIsProcessing(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      // Try to load with the provided password
      const pdfDoc = await PDFDocument.load(arrayBuffer, { password });
      
      // Saving it will naturally strip the encryption because pdf-lib does not write encrypted PDFs
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

  const resetTool = () => {
    setFile(null);
    setIsComplete(false);
    setError(null);
    setNeedsPassword(false);
    setPassword('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="tool-page">
      <Link href="/tools/pdf" className="tool-page-back">← Back to PDF Toolkit</Link>
      <div className="tool-page-header">
        <h1>🔓 Unlock PDF</h1>
        <p>Remove password protection from your PDF files permanently.</p>
      </div>

      {isComplete ? (
        <div className="result-container" style={{ position: 'relative', textAlign: 'center', padding: '60px 20px', background: '#2d1b4e', border: '4px solid #ff007f', boxShadow: '0 0 30px rgba(255, 0, 127, 0.4), inset 0 0 20px rgba(0,0,0,0.5)', marginTop: '20px' }}>
          <FairyLights />
          <div style={{ fontSize: '5rem', marginBottom: '20px', filter: 'drop-shadow(4px 4px 0px #000)' }}>🎉</div>
          <h2 style={{ fontFamily: 'var(--font-pixel)', color: '#ffcc00', marginBottom: '20px', fontSize: '2rem', textShadow: '4px 4px 0px #000' }}>TASK DONE!</h2>
          <p style={{ marginBottom: '40px', fontSize: '1.1rem', color: '#ffffff' }}>Your unlocked PDF has been downloaded successfully.</p>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={resetTool} style={{ padding: '12px 24px', fontSize: '1rem' }}>
              Unlock Another PDF
            </button>
          </div>
        </div>
      ) : (
        <div className="result-container" style={{ padding: '20px', background: 'var(--pixel-bg-card)', border: '3px solid var(--pixel-border)' }}>
          {error && <div className="error-message">⚠️ {error}</div>}
          
          {!file ? (
            <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
              <div className="upload-zone-icon">🔒</div>
              <div className="upload-zone-text">Click or drag a protected PDF here</div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" style={{ display: 'none' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', color: 'var(--pixel-cyan)' }}>
                <span>📄</span> <strong>{file.name}</strong>
              </div>
              
              {needsPassword && (
                <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.8rem', color: '#fff' }}>ENTER CURRENT PASSWORD:</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Secret Password..."
                    style={{ padding: '12px', fontSize: '1rem', border: '3px solid var(--pixel-border)', background: '#fff', color: '#000' }}
                  />
                  <small style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: '10px' }}>
                    Note: We don't save or upload your password. Unlocking happens entirely in your browser.
                  </small>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button className="btn btn-ghost" onClick={resetTool} disabled={isProcessing}>Cancel</button>
                {needsPassword && (
                  <button className="btn btn-primary" onClick={handleUnlock} disabled={isProcessing || !password}>
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
