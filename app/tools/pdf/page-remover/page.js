'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { loadPdf, removePages, downloadPdf, formatFileSize } from '@/tools-logic/pdfPageRemover';
import './pdf-tool.css';

export default function PdfPageRemover() {
  const [pdfData, setPdfData] = useState(null);       // { pdfBytes, pageCount, fileName, fileSize }
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [thumbnails, setThumbnails] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
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
      
      // Auto-clear the state after successful download
      handleReset();
    } catch (err) {
      console.error(err);
      setError('Failed to process the PDF. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset / upload new
  const handleReset = () => {
    setPdfData(null);
    setSelectedPages(new Set());
    setThumbnails([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="tool-page">
      <Link href="/tools/pdf" className="tool-page-back">
        ← Back to PDF Toolkit
      </Link>

      <div className="tool-page-header">
        <h1>📄 PDF Page Remover</h1>
        <p>
          Upload a PDF, click the pages you want to remove, then download your cleaned file. 
          Everything happens in your browser — your file is never uploaded anywhere.
        </p>
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
      {!pdfData && !isLoading && (
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

      {/* PDF Loaded — show file info + page grid */}
      {pdfData && !isLoading && (
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
          <div className="page-grid-header">
            <div>
              <div className="page-grid-title">
                Select pages to remove
              </div>
              <div className="page-grid-hint">
                Click on pages to mark them for removal
              </div>
            </div>
            <div className="select-buttons">
              <button className="btn btn-ghost btn-sm" onClick={selectAll}>
                Select all
              </button>
              <button className="btn btn-ghost btn-sm" onClick={deselectAll}>
                Deselect all
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
