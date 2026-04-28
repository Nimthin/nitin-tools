'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { PDFDocument } from 'pdf-lib';
import './image-to-pdf.css';

export default function ImageToPdf() {
  const [images, setImages] = useState([]);
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
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const newImages = files
      .filter(file => validImageTypes.includes(file.type))
      .map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        url: URL.createObjectURL(file),
        name: file.name
      }));

    if (newImages.length !== files.length) {
      setError('Some files were skipped. Please upload only JPG, PNG, or WebP images.');
    } else {
      setError(null);
    }

    setImages(prev => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (id) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      // Revoke object URL to prevent memory leaks
      const removed = prev.find(img => img.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return filtered;
    });
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.url));
    setImages([]);
    setError(null);
  };

  // Drag and Drop reordering logic
  const onDragStart = (index) => setDraggedIndex(index);
  
  const onDragEnter = (index) => {
    if (draggedIndex === null || draggedIndex === index) return;
    
    setImages(prev => {
      const newImages = [...prev];
      const draggedItem = newImages[draggedIndex];
      newImages.splice(draggedIndex, 1);
      newImages.splice(index, 0, draggedItem);
      setDraggedIndex(index);
      return newImages;
    });
  };

  const onDragEnd = () => setDraggedIndex(null);

  const generatePDF = async () => {
    if (images.length === 0) return;
    
    setIsProcessing(true);
    setError(null);

    try {
      const pdfDoc = await PDFDocument.create();

      for (const imgObj of images) {
        const imageBytes = await imgObj.file.arrayBuffer();
        let pdfImage;
        
        if (imgObj.file.type === 'image/jpeg') {
          pdfImage = await pdfDoc.embedJpg(imageBytes);
        } else if (imgObj.file.type === 'image/png') {
          pdfImage = await pdfDoc.embedPng(imageBytes);
        } else {
          // pdf-lib doesn't support webp natively yet, so if webp, we need to draw it to canvas and export to jpeg
          // But for now, we filtered to jpeg and png in the input accept attribute, though processNewFiles allowed webp.
          // Let's handle webp fallback just in case:
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          img.src = imgObj.url;
          await new Promise(resolve => { img.onload = resolve; });
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const jpegBytes = await fetch(canvas.toDataURL('image/jpeg')).then(res => res.arrayBuffer());
          pdfImage = await pdfDoc.embedJpg(jpegBytes);
        }

        const { width, height } = pdfImage.scale(1);
        const page = pdfDoc.addPage([width, height]);
        
        page.drawImage(pdfImage, {
          x: 0,
          y: 0,
          width,
          height,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `Images_${images.length}_merged.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      
      // Auto-clear the state after successful download
      clearAll();

    } catch (err) {
      console.error(err);
      setError('Failed to generate PDF. Make sure your images are valid JPGs or PNGs.');
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
        <h1>🖼️ Image to PDF</h1>
        <p>Convert your images into a single PDF document. Drag and drop to rearrange order.</p>
      </div>

      <div className="img2pdf-container">
        {error && <div className="error-message">⚠️ {error}</div>}

        <div className="img2pdf-actions">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            accept="image/jpeg, image/png, image/webp"
            style={{ display: 'none' }}
          />
          <button className="btn btn-primary" onClick={() => fileInputRef.current.click()}>
            + Add Images
          </button>
          
          {images.length > 0 && (
            <button className="btn btn-ghost" onClick={clearAll}>
              Clear All
            </button>
          )}
        </div>

        {images.length === 0 ? (
          <div 
            className="img2pdf-empty-state"
            onClick={() => fileInputRef.current.click()}
          >
            <div className="empty-icon">📂</div>
            <p>Click or drag images here to start</p>
          </div>
        ) : (
          <>
            <div className="img2pdf-grid">
              {images.map((img, index) => (
                <div 
                  key={img.id} 
                  className={`img-card ${draggedIndex === index ? 'dragging' : ''}`}
                  draggable
                  onDragStart={() => onDragStart(index)}
                  onDragEnter={() => onDragEnter(index)}
                  onDragEnd={onDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <div className="img-card-number">{index + 1}</div>
                  <button className="img-remove-btn" onClick={() => removeImage(img.id)}>✕</button>
                  <div className="img-preview" style={{ backgroundImage: `url(${img.url})` }}></div>
                  <div className="img-name">{img.name}</div>
                </div>
              ))}
            </div>

            <div className="img2pdf-footer">
              <button 
                className="btn btn-primary generate-btn" 
                onClick={generatePDF}
                disabled={isProcessing}
              >
                {isProcessing ? 'Generating PDF...' : `Download PDF (${images.length} pages)`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
