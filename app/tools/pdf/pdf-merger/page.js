'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { PDFDocument } from 'pdf-lib';
import './pdf-merger.css';

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

export default function PdfMerger() {
  const [pdfs, setPdfs] = useState([]); // array of { id, file, name, size }
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  
  const fileInputRef = useRef(null);
  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processNewFiles(Array.from(e.target.files));
    }
  };

  const processNewFiles = (files) => {
    const validPdfs = files.filter(file => file.type === 'application/pdf');
    
    if (validPdfs.length !== files.length) {
      setError('Some files were skipped. Please upload only PDF files.');
    } else {
      setError(null);
    }

    const newPdfs = validPdfs.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: formatFileSize(file.size)
    }));

    setPdfs(prev => [...prev, ...newPdfs]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const removePdf = (id) => {
    setPdfs(prev => prev.filter(pdf => pdf.id !== id));
  };

  const clearAll = () => {
    setPdfs([]);
    setError(null);
  };

  // Drag and Drop reordering logic
  const onDragStart = (index) => setDraggedIndex(index);
  
  const onDragEnter = (index) => {
    if (draggedIndex === null || draggedIndex === index) return;
    
    setPdfs(prev => {
      const newPdfs = [...prev];
      const draggedItem = newPdfs[draggedIndex];
      newPdfs.splice(draggedIndex, 1);
      newPdfs.splice(index, 0, draggedItem);
      setDraggedIndex(index);
      return newPdfs;
    });
  };

  const onDragEnd = () => setDraggedIndex(null);

  const mergePDFs = async () => {
    if (pdfs.length < 2) {
      setError('Please add at least 2 PDF files to merge.');
      return;
    }
    
    setIsProcessing(true);
    setError(null);

    try {
      const mergedPdf = await PDFDocument.create();

      for (const pdfObj of pdfs) {
        const pdfBytes = await pdfObj.file.arrayBuffer();
        const currentPdf = await PDFDocument.load(pdfBytes);
        
        const copiedPages = await mergedPdf.copyPages(currentPdf, currentPdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `Merged_Document_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      
      // Auto-clear after download
      setPdfs([]);
      setIsComplete(true);

    } catch (err) {
      console.error(err);
      setError('Failed to merge PDFs. One of the files might be corrupted or password-protected.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="tool-page">
      <Link href="/tools/pdf" className="tool-page-back">
        ← Back to PDF Toolkit
      </Link>

      <div className="tool-page-header">
        <h1>🔗 PDF Merger</h1>
        <p>Drag, drop, and merge multiple PDFs into one.</p>
      </div>

      <div className="pdf-merger-container">
        {error && <div className="error-message">⚠️ {error}</div>}

        <div className="pdf-merger-actions">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            accept="application/pdf"
            style={{ display: 'none' }}
          />
          <button className="btn btn-primary" onClick={() => fileInputRef.current.click()}>
            + Add PDF Files
          </button>
          
          {pdfs.length > 0 && (
            <button className="btn btn-ghost" onClick={clearAll}>
              Clear All
            </button>
          )}
        </div>

        {isComplete && (
          <div className="result-container" style={{ position: 'relative', textAlign: 'center', padding: '60px 20px', background: '#2d1b4e', border: '4px solid #ff007f', boxShadow: '0 0 30px rgba(255, 0, 127, 0.4), inset 0 0 20px rgba(0,0,0,0.5)', marginTop: '20px' }}>
            <FairyLights />
            <div style={{ fontSize: '5rem', marginBottom: '20px', filter: 'drop-shadow(4px 4px 0px #000)' }}>🎉</div>
            <h2 style={{ fontFamily: 'var(--font-pixel)', color: '#ffcc00', marginBottom: '20px', fontSize: '2rem', textShadow: '4px 4px 0px #000' }}>TASK DONE!</h2>
            <p style={{ marginBottom: '40px', fontSize: '1.1rem', color: '#ffffff' }}>Your merged PDF has been downloaded successfully.</p>
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => { setIsComplete(false); clearAll(); }} style={{ padding: '12px 24px', fontSize: '1rem' }}>
                Process New PDFs
              </button>
            </div>
          </div>
        )}

        {pdfs.length === 0 && !isComplete ? (
          <div className="upload-zone" onClick={() => fileInputRef.current.click()}>
            <div className="upload-zone-icon">📁</div>
            <div className="upload-zone-text">Click or drag PDF files here to start</div>
          </div>
        ) : (
          <>
            <div className="pdf-merger-list">
              {pdfs.map((pdf, index) => (
                <div 
                  key={pdf.id} 
                  className={`pdf-list-item ${draggedIndex === index ? 'dragging' : ''}`}
                  draggable
                  onDragStart={() => onDragStart(index)}
                  onDragEnter={() => onDragEnter(index)}
                  onDragEnd={onDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <div className="pdf-list-item-drag-handle">≡</div>
                  <div className="pdf-list-item-number">{index + 1}</div>
                  <div className="pdf-list-item-icon">📄</div>
                  <div className="pdf-list-item-details">
                    <div className="pdf-list-item-name">{pdf.name}</div>
                    <div className="pdf-list-item-size">{pdf.size}</div>
                  </div>
                  <button className="pdf-list-item-remove" onClick={() => removePdf(pdf.id)}>✕</button>
                </div>
              ))}
            </div>

            <div className="pdf-merger-footer">
              <button 
                className="btn btn-primary generate-btn" 
                onClick={mergePDFs}
                disabled={isProcessing || pdfs.length < 2}
              >
                {isProcessing ? (
                  <>
                    <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, marginRight: 8, display: 'inline-block', verticalAlign: 'middle' }}></span>
                    Merging PDFs...
                  </>
                ) : (
                  `Merge ${pdfs.length} PDFs`
                )}
              </button>
              {pdfs.length === 1 && (
                <p style={{ marginTop: '1rem', color: '#ffffff', fontSize: '0.9rem', textShadow: '1px 1px 0px #000' }}>
                  Add at least one more PDF to merge.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
