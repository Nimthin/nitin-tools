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

export default function CompressPdf() {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);
  const [compressionLevel, setCompressionLevel] = useState('medium');
  const [originalSize, setOriginalSize] = useState(0);
  const [newSize, setNewSize] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const fileInputRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.type === 'application/pdf') {
      setFile(selected);
      setOriginalSize(selected.size);
      setError(null);
      setNewSize(0);
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        setDownloadUrl(null);
      }
      setIsComplete(false);
    } else {
      setError('Please select a valid PDF file.');
    }
  };

  const handleCompress = async () => {
    if (!file) return;
    
    setIsProcessing(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const newPdfDoc = await PDFDocument.create();
      
      // Basic non-destructive compression via object streams and metadata stripping
      if (compressionLevel === 'high') {
        newPdfDoc.setTitle('');
        newPdfDoc.setAuthor('');
        newPdfDoc.setSubject('');
        newPdfDoc.setKeywords([]);
        newPdfDoc.setProducer('');
        newPdfDoc.setCreator('');
      }

      const copiedPages = await newPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
      copiedPages.forEach((page) => newPdfDoc.addPage(page));
      
      let saveOptions = { useObjectStreams: true };
      
      if (compressionLevel === 'low') {
        saveOptions.useObjectStreams = false;
      }

      const pdfBytes = await newPdfDoc.save(saveOptions);
      const resultingSize = pdfBytes.byteLength;
      
      setNewSize(resultingSize);

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      
      setIsComplete(true);
    } catch (err) {
      console.error(err);
      setError('Failed to compress PDF. The file might be corrupted.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${compressionLevel}_compressed_${file.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetTool = () => {
    setFile(null);
    setIsComplete(false);
    setError(null);
    setNewSize(0);
    setOriginalSize(0);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="tool-page">
      <Link href="/tools/pdf" className="tool-page-back">← Back to PDF Toolkit</Link>
      <div className="tool-page-header">
        <h1>🗜️ Compress PDF</h1>
        <p>Optimize your PDFs by stripping unused data and structural bloat.</p>
      </div>

      {isComplete ? (
        <div className="result-container" style={{ position: 'relative', textAlign: 'center', padding: '60px 20px', background: '#2d1b4e', border: '4px solid #ff007f', boxShadow: '0 0 30px rgba(255, 0, 127, 0.4), inset 0 0 20px rgba(0,0,0,0.5)', marginTop: '20px' }}>
          <FairyLights />
          <div style={{ fontSize: '5rem', marginBottom: '20px', filter: 'drop-shadow(4px 4px 0px #000)' }}>🎉</div>
          <h2 style={{ fontFamily: 'var(--font-pixel)', color: '#ffcc00', marginBottom: '20px', fontSize: '2rem', textShadow: '4px 4px 0px #000' }}>COMPRESSION DONE!</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '30px' }}>
            <div style={{ background: '#2d1b4e', padding: '15px 30px', border: '2px dashed var(--pixel-cyan)' }}>
              <div style={{ color: '#fff', fontSize: '0.9rem', opacity: 0.8, marginBottom: '5px' }}>ORIGINAL SIZE</div>
              <div style={{ color: '#ff3b30', fontSize: '1.4rem', textDecoration: 'line-through' }}>{formatFileSize(originalSize)}</div>
            </div>
            <div style={{ color: '#ffcc00', fontSize: '1.5rem' }}>↓</div>
            <div style={{ background: '#2d1b4e', padding: '15px 30px', border: '3px solid var(--pixel-green)', boxShadow: '0 0 15px rgba(52,199,89,0.4)' }}>
              <div style={{ color: '#fff', fontSize: '0.9rem', opacity: 0.8, marginBottom: '5px' }}>NEW SIZE</div>
              <div style={{ color: 'var(--pixel-green)', fontSize: '1.8rem', fontWeight: 'bold' }}>{formatFileSize(newSize)}</div>
              {newSize < originalSize && (
                <div style={{ color: '#ffcc00', fontSize: '0.8rem', marginTop: '5px', fontFamily: 'var(--font-pixel)' }}>
                  SAVED {((originalSize - newSize) / originalSize * 100).toFixed(1)}%
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={resetTool} style={{ padding: '12px 24px', fontSize: '1rem' }}>
              Compress Another
            </button>
            <button className="btn btn-primary" onClick={handleDownload} style={{ padding: '12px 24px', fontSize: '1rem', background: 'var(--pixel-green)' }}>
              ⬇️ Download PDF
            </button>
          </div>
        </div>
      ) : (
        <div className="result-container" style={{ padding: '20px', background: 'var(--pixel-bg-card)', border: '3px solid var(--pixel-border)' }}>
          {error && <div className="error-message">⚠️ {error}</div>}
          
          {!file ? (
            <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
              <div className="upload-zone-icon">🗜️</div>
              <div className="upload-zone-text">Click or drag a PDF here to compress</div>
              <div className="upload-zone-hint">Optimizes document structure entirely in your browser.</div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" style={{ display: 'none' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', color: 'var(--pixel-cyan)' }}>
                <span>📄</span> <strong>{file.name} ({formatFileSize(file.size)})</strong>
              </div>
              
              <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#2d1b4e', padding: '20px', border: '2px solid var(--pixel-border)' }}>
                <label style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.8rem', color: '#fff', textAlign: 'center' }}>COMPRESSION LEVEL</label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button 
                    className={`btn ${compressionLevel === 'low' ? 'btn-selected' : 'btn-ghost'}`} 
                    onClick={() => setCompressionLevel('low')}
                    style={{ flex: 1, padding: '12px 8px', fontSize: '0.85rem' }}
                  >
                    Low
                  </button>
                  <button 
                    className={`btn ${compressionLevel === 'medium' ? 'btn-selected' : 'btn-ghost'}`} 
                    onClick={() => setCompressionLevel('medium')}
                    style={{ flex: 1, padding: '12px 8px', fontSize: '0.85rem' }}
                  >
                    Medium
                  </button>
                  <button 
                    className={`btn ${compressionLevel === 'high' ? 'btn-selected' : 'btn-ghost'}`} 
                    onClick={() => setCompressionLevel('high')}
                    style={{ flex: 1, padding: '12px 8px', fontSize: '0.85rem' }}
                  >
                    High
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button className="btn btn-ghost" onClick={resetTool} disabled={isProcessing}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCompress} disabled={isProcessing}>
                  {isProcessing ? 'Optimizing...' : 'Compress PDF'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
