'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { PDFDocument } from 'pdf-lib';
import './pdf-merger.css';

export default function PdfMerger() {
  const [pdfs, setPdfs] = useState([]); // array of { id, file, name, size }
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  
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
      clearAll();

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
        <p>Combine multiple PDFs into a single file. Drag and drop the list below to rearrange their order before merging. 100% private and local.</p>
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

        {pdfs.length === 0 ? (
          <div 
            className="pdf-merger-empty-state"
            onClick={() => fileInputRef.current.click()}
          >
            <div className="empty-icon">📁</div>
            <p>Click or drag PDF files here to start</p>
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
                <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
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
