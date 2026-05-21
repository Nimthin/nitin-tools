'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { PDFDocument } from 'pdf-lib';
import './image-to-pdf.css';

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

export default function ImageToPdf() {
  const [images, setImages] = useState([]);
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
      
      // Show success screen
      setImages([]);
      setIsComplete(true);

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
        <p>Turn multiple images into a single PDF instantly.</p>
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

        {isComplete && (
          <div className="result-container" style={{ position: 'relative', textAlign: 'center', padding: '60px 20px', background: '#2d1b4e', border: '4px solid #ff007f', boxShadow: '0 0 30px rgba(255, 0, 127, 0.4), inset 0 0 20px rgba(0,0,0,0.5)', marginTop: '20px' }}>
            <FairyLights />
            <div style={{ fontSize: '5rem', marginBottom: '20px', filter: 'drop-shadow(4px 4px 0px #000)' }}>🎉</div>
            <h2 style={{ fontFamily: 'var(--font-pixel)', color: '#ffcc00', marginBottom: '20px', fontSize: '2rem', textShadow: '4px 4px 0px #000' }}>TASK DONE!</h2>
            <p style={{ marginBottom: '40px', fontSize: '1.1rem', color: '#ffffff' }}>Your new PDF has been downloaded successfully.</p>
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => { setIsComplete(false); clearAll(); }} style={{ padding: '12px 24px', fontSize: '1rem' }}>
                Process New Images
              </button>
            </div>
          </div>
        )}

        {images.length === 0 && !isComplete ? (
          <div className="upload-zone" onClick={() => fileInputRef.current.click()}>
            <div className="upload-zone-icon">🖼️</div>
            <div className="upload-zone-text">Click or drag images here to start</div>
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
