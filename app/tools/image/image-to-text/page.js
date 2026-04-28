'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import './image-to-text.css';

export default function ImageToText() {
  const [image, setImage] = useState(null); // { file, url }
  const [extractedText, setExtractedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStatus, setProgressStatus] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEngineLoaded, setIsEngineLoaded] = useState(false);
  
  const fileInputRef = useRef(null);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPG, PNG, WebP).');
      return;
    }
    
    if (image) URL.revokeObjectURL(image.url);
    
    setImage({ file, url: URL.createObjectURL(file) });
    setExtractedText('');
    setError(null);
    setProgressStatus('');
    setProgressPct(0);
    setCopied(false);
  };

  const onFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const extractText = async () => {
    if (!image) return;
    if (!window.Tesseract) {
      setError("OCR Engine is still loading, please wait a moment.");
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setExtractedText('');
    setCopied(false);

    try {
      const result = await window.Tesseract.recognize(
        image.file,
        'eng',
        { 
          logger: m => {
            if (m.status === 'recognizing text') {
              setProgressStatus('Extracting Text');
              setProgressPct(Math.round(m.progress * 100));
            } else {
              setProgressStatus('Loading Engine');
              setProgressPct(0);
            }
          }
        }
      );
      
      setExtractedText(result.data.text);
    } catch (err) {
      console.error("OCR error:", err);
      setError('Failed to extract text. Make sure the image is clear and legible.');
    } finally {
      setIsProcessing(false);
      setProgressStatus('');
    }
  };

  const copyToClipboard = () => {
    if (!extractedText) return;
    navigator.clipboard.writeText(extractedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReset = () => {
    if (image) URL.revokeObjectURL(image.url);
    setImage(null);
    setExtractedText('');
    setError(null);
    setProgressStatus('');
    setProgressPct(0);
    setCopied(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="tool-page">
      <Script 
        src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js" 
        strategy="lazyOnload" 
        onLoad={() => setIsEngineLoaded(true)}
      />
      <Link href="/tools/image" className="tool-page-back">
        ← Back to Image Toolkit
      </Link>

      <div className="tool-page-header">
        <h1>📝 Image to Text (OCR)</h1>
        <p>Extract text from screenshots, documents, or photos instantly. Processed completely offline in your browser for total privacy.</p>
      </div>

      <div className="ocr-container">
        {error && <div className="error-message">⚠️ {error}</div>}

        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileChange}
          accept="image/*"
          style={{ display: 'none' }}
        />

        {!image ? (
          <div 
            className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <div className="upload-zone-icon">📝</div>
            <div className="upload-zone-text">
              Drop an image here or <span className="upload-zone-browse">browse</span>
            </div>
          </div>
        ) : (
          <div className="ocr-workspace">
            <div className="ocr-preview-panel">
              <div className="ocr-preview-header">
                <h3>Original Image</h3>
                <button className="btn btn-ghost btn-sm" onClick={handleReset} disabled={isProcessing}>
                  Change
                </button>
              </div>
              <div className="ocr-image-wrapper">
                <img src={image.url} alt="To extract" className="ocr-preview-image" />
                {isProcessing && (
                  <div className="scanner-overlay">
                    <div className="scanner-line"></div>
                  </div>
                )}
              </div>
              
              {!extractedText && (
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={extractText} 
                    disabled={isProcessing}
                    style={{ width: '100%' }}
                  >
                    {isProcessing ? (
                      <>
                        <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, marginRight: 8, display: 'inline-block', verticalAlign: 'middle' }}></span>
                        {progressStatus} {progressPct > 0 ? `${progressPct}%` : '...'}
                      </>
                    ) : (
                      'Extract Text'
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="ocr-result-panel">
              <div className="ocr-preview-header">
                <h3>Extracted Text</h3>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={copyToClipboard}
                  disabled={!extractedText || isProcessing}
                >
                  {copied ? '✅ Copied!' : '📋 Copy Text'}
                </button>
              </div>
              
              <div className={`ocr-text-area ${!extractedText ? 'empty' : ''}`}>
                {isProcessing ? (
                  <div className="ocr-processing-text">
                    <span className="spinner" style={{ width: 24, height: 24, borderColor: 'var(--text-secondary)', borderTopColor: 'var(--accent)' }}></span>
                    <p>Analyzing text... this may take a few seconds.</p>
                  </div>
                ) : extractedText ? (
                  <textarea 
                    value={extractedText}
                    onChange={(e) => setExtractedText(e.target.value)}
                    className="ocr-textarea"
                    placeholder="Extracted text will appear here..."
                  />
                ) : (
                  <div className="ocr-empty-text">
                    <p>Click "Extract Text" to analyze the image.</p>
                  </div>
                )}
              </div>
              
              {extractedText && (
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <button className="btn btn-ghost" onClick={handleReset} style={{ width: '100%' }}>
                    Process Another Image
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
