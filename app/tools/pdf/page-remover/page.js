'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { loadPdf, removePages, downloadPdf, formatFileSize } from '@/tools-logic/pdfPageRemover';
import './pdf-tool.css';

// Component for rendering blinking fairy lights around a container
const FairyLights = () => {
  const colors = ['#ff3b30', '#00bcd4', '#34c759', '#ffcc00', '#ff007f'];
  const lights = [];
  
  // Top edge lights
  for (let i = 0; i < 18; i++) {
    const color = colors[i % colors.length];
    const rotation = -15 + Math.random() * 30; // Random tilt between -15 and 15 degrees
    lights.push(
      <div
        key={`top-${i}`}
        className="fairy-light"
        style={{
          backgroundColor: color,
          top: '18px', // Hangs just below the wire (wire is at 15px)
          left: `${4 + (i * 5.4)}%`,
          transform: `rotate(${rotation}deg)`,
          animationDelay: `${Math.random() * 2}s`,
          animationDuration: `${0.8 + Math.random()}s`,
          boxShadow: `0 0 12px ${color}, 0 0 4px ${color}`
        }}
      />
    );
  }
  
  // Bottom edge lights
  for (let i = 0; i < 18; i++) {
    const color = colors[(i + 2) % colors.length];
    const rotation = -15 + Math.random() * 30;
    lights.push(
      <div
        key={`bot-${i}`}
        className="fairy-light"
        style={{
          backgroundColor: color,
          bottom: '18px', // Hangs pointing up from the bottom wire (or we could flip it)
          left: `${4 + (i * 5.4)}%`,
          transform: `rotate(${rotation}deg) rotateX(180deg)`, // Flip upside down for bottom wire
          animationDelay: `${Math.random() * 2}s`,
          animationDuration: `${0.8 + Math.random()}s`,
          boxShadow: `0 0 12px ${color}, 0 0 4px ${color}`
        }}
      />
    );
  }
  
  return (
    <>
      <div className="fairy-wire top" />
      <div className="fairy-wire bottom" />
      {lights}
    </>
  );
};

export default function PdfPageRemover() {
  const [pdfData, setPdfData] = useState(null);       // { pdfBytes, pageCount, fileName, fileSize }
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [thumbnails, setThumbnails] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [rangeInput, setRangeInput] = useState('');
  const fileInputRef = useRef(null);
  const canvasRefs = useRef({});

  // Render thumbnails using pdfjs-dist
  const renderThumbnails = useCallback(async (pdfBytes) => {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) });
    const pdf = await loadingTask.promise;
    const thumbs = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 0.5 });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      await page.render({ canvasContext: ctx, viewport }).promise;
      thumbs.push(canvas.toDataURL('image/jpeg', 0.7));
    }

    setThumbnails(thumbs);
  }, []);

  // Handle file upload
  const handleFile = useCallback(async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.');
      return;
    }

    setError(null);
    setIsLoading(true);
    setSelectedPages(new Set());
    setThumbnails([]);

    try {
      const data = await loadPdf(file);
      setPdfData(data);
      await renderThumbnails(data.pdfBytes);
      setIsComplete(false);
    } catch (err) {
      console.error(err);
      setError('Failed to load PDF. The file may be corrupted or password-protected.');
    } finally {
      setIsLoading(false);
    }
  }, [renderThumbnails]);

  // Handle file input change
  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  // Drag & Drop handlers
  const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // Toggle page selection
  const togglePage = (pageIndex) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageIndex)) {
        next.delete(pageIndex);
      } else {
        next.add(pageIndex);
      }
      return next;
    });
  };

  // Select / Deselect all
  const selectAll = () => {
    if (!pdfData) return;
    const all = new Set();
    for (let i = 0; i < pdfData.pageCount; i++) all.add(i);
    setSelectedPages(all);
  };

  const deselectAll = () => {
    setSelectedPages(new Set());
  };

  // Parse page range input (e.g., "1, 3-5, 8")
  const applyRange = () => {
    if (!pdfData || !rangeInput.trim()) return;

    const parts = rangeInput.split(',').map(s => s.trim()).filter(Boolean);
    const newSelection = new Set(selectedPages);
    let addedAny = false;

    parts.forEach(part => {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.min(start, end);
          const max = Math.max(start, end);
          for (let i = min; i <= max; i++) {
            if (i >= 1 && i <= pdfData.pageCount) {
              newSelection.add(i - 1); // Internal state is 0-indexed
              addedAny = true;
            }
          }
        }
      } else {
        const pageNum = parseInt(part, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= pdfData.pageCount) {
          newSelection.add(pageNum - 1);
          addedAny = true;
        }
      }
    });

    if (addedAny) {
      setSelectedPages(newSelection);
      setRangeInput(''); // Clear after success
      setError(null);
    } else {
      setError("Invalid page range format. Use numbers and hyphens (e.g., 2, 4-10).");
      setTimeout(() => setError(null), 4000);
    }
  };

  // Process and download
  const handleRemoveAndDownload = async () => {
    if (!pdfData || selectedPages.size === 0) return;

    if (selectedPages.size === pdfData.pageCount) {
      setError("You can't remove all pages. At least one page must remain.");
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      const modifiedPdf = await removePages(pdfData.pdfBytes, selectedPages);
      await downloadPdf(modifiedPdf, pdfData.fileName);
      
      setIsComplete(true);
    } catch (err) {
      console.error(err);
      setError('Failed to process the PDF. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContinueEditing = () => {
    setIsComplete(false);
    setSelectedPages(new Set()); // Clear selection so they don't accidentally remove them again
  };

  // Reset / upload new
  const handleReset = () => {
    setPdfData(null);
    setSelectedPages(new Set());
    setThumbnails([]);
    setError(null);
    setIsComplete(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="tool-page">
      <Link href="/tools/pdf" className="tool-page-back">
        ← Back to PDF Toolkit
      </Link>

      <div className="tool-page-header">
        <h1>✂️ PDF Page Remover</h1>
        <p>Click pages to delete them. Runs 100% locally.</p>
      </div>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        accept=".pdf,application/pdf"
        ref={fileInputRef}
        onChange={onFileChange}
        style={{ display: 'none' }}
        id="pdf-file-input"
      />

      {/* Upload Zone — shown when no PDF is loaded */}
      {!pdfData && !isLoading && !isComplete && (
        <div
          className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          id="upload-zone"
        >
          <div className="upload-zone-icon">📁</div>
          <div className="upload-zone-text">
            Drop your PDF here or{' '}
            <span className="upload-zone-browse">browse</span>
          </div>
          <div className="upload-zone-hint">Supports PDF files up to 100 MB</div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="loading-container">
          <div className="spinner"></div>
          <div className="loading-text">Loading PDF pages...</div>
        </div>
      )}

      {/* Success Screen */}
      {isComplete && (
        <div className="result-container" style={{ position: 'relative', textAlign: 'center', padding: '60px 20px', background: '#2d1b4e', border: '4px solid #ff007f', boxShadow: '0 0 30px rgba(255, 0, 127, 0.4), inset 0 0 20px rgba(0,0,0,0.5)', marginTop: '20px' }}>
          
          <FairyLights />
          
          <div style={{ fontSize: '5rem', marginBottom: '20px', filter: 'drop-shadow(4px 4px 0px #000)' }}>🎉</div>
          <h2 style={{ fontFamily: 'var(--font-pixel)', color: '#ffcc00', marginBottom: '20px', fontSize: '2rem', textShadow: '4px 4px 0px #000' }}>
            TASK DONE!
          </h2>
          <p style={{ marginBottom: '40px', fontSize: '1.1rem', color: '#ffffff' }}>Your cleaned PDF has been downloaded successfully.</p>
          
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={handleContinueEditing} style={{ padding: '12px 24px', fontSize: '1rem' }}>
              Continue Editing
            </button>
            <button className="btn btn-primary" onClick={handleReset} style={{ padding: '12px 24px', fontSize: '1rem' }}>
              Process New PDF
            </button>
          </div>
        </div>
      )}

      {/* PDF Loaded — show file info + page grid */}
      {pdfData && !isLoading && !isComplete && (
        <>
          {/* File info bar */}
          <div className="file-info">
            <div className="file-info-left">
              <div className="file-info-icon">📄</div>
              <div>
                <div className="file-info-name">{pdfData.fileName}</div>
                <div className="file-info-meta">
                  {pdfData.pageCount} pages · {formatFileSize(pdfData.fileSize)}
                </div>
              </div>
            </div>
            <div className="file-info-actions">
              <button className="btn btn-ghost btn-sm" onClick={handleReset}>
                Upload different file
              </button>
            </div>
          </div>

          {/* Page grid header */}
          <div className="page-grid-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div className="page-grid-title">Select pages to remove</div>
                <div className="page-grid-hint">Click on pages to mark them for removal</div>
              </div>
              <div className="select-buttons">
                <button className="btn btn-ghost btn-sm" onClick={selectAll}>Select all</button>
                <button className="btn btn-ghost btn-sm" onClick={deselectAll}>Deselect all</button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', background: 'rgba(0,0,0,0.2)', padding: '12px', border: '3px solid var(--pixel-border)' }}>
              <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Custom Range:</span>
              <input 
                type="text" 
                placeholder="e.g. 2, 4-10, 14" 
                value={rangeInput}
                onChange={(e) => setRangeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyRange(); }}
                style={{ flex: 1, minWidth: '150px', padding: '6px 12px' }}
              />
              <button className="btn btn-ghost btn-sm" onClick={applyRange} style={{ padding: '6px 16px' }}>
                Apply
              </button>
            </div>
          </div>

          {/* Thumbnail grid */}
          <div className="page-grid">
            {thumbnails.map((thumb, index) => (
              <div
                key={index}
                className={`page-thumb ${selectedPages.has(index) ? 'selected' : ''}`}
                onClick={() => togglePage(index)}
                id={`page-thumb-${index}`}
              >
                <img
                  src={thumb}
                  alt={`Page ${index + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
                <div className="page-thumb-overlay">
                  <div className="page-thumb-x">✕</div>
                </div>
                <div className="page-thumb-number">
                  {selectedPages.has(index) ? `Remove page ${index + 1}` : `Page ${index + 1}`}
                </div>
              </div>
            ))}

            {/* Placeholder while thumbnails still rendering */}
            {thumbnails.length === 0 && pdfData && (
              Array.from({ length: pdfData.pageCount }, (_, i) => (
                <div key={i} className="page-thumb" style={{ opacity: 0.3 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                  }}>
                    Loading...
                  </div>
                  <div className="page-thumb-number">Page {i + 1}</div>
                </div>
              ))
            )}
          </div>

          {/* Action bar — shown when pages are selected */}
          {selectedPages.size > 0 && (
            <div className="action-bar">
              <div className="action-bar-info">
                <strong>{selectedPages.size}</strong> of {pdfData.pageCount} pages selected for removal 
                · {pdfData.pageCount - selectedPages.size} pages will remain
              </div>
              <div className="action-bar-buttons">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={deselectAll}
                >
                  Clear selection
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleRemoveAndDownload}
                  disabled={isProcessing || selectedPages.size === pdfData.pageCount}
                  id="remove-download-btn"
                >
                  {isProcessing ? (
                    <>
                      <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span>
                      Processing...
                    </>
                  ) : (
                    <>Remove & Download</>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
