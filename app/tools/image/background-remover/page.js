'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import './bg-remover.css';

export default function BackgroundRemover() {
  const [image, setImage] = useState(null); // { file, url }
  const [resultUrl, setResultUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  
  // Eraser Mode State
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [zoom, setZoom] = useState(1);
  
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load @imgly/background-removal from CDN to avoid Webpack bundling issues
  useEffect(() => {
    if (window.imglyRemoveBackground) return; // already loaded
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `
      import { removeBackground } from 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.3/dist/index.mjs';
      window.imglyRemoveBackground = removeBackground;
    `;
    document.head.appendChild(script);
  }, []);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPG, PNG, WebP).');
      return;
    }
    
    if (image) URL.revokeObjectURL(image.url);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    
    setImage({ file, url: URL.createObjectURL(file) });
    setResultUrl(null);
    setError(null);
    setProgress(0);
    setIsEraserMode(false);
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

  const removeBackground = async () => {
    if (!image) return;
    
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      // The library is loaded globally via Script tag in the component
      if (typeof window === 'undefined' || !window.imglyRemoveBackground) {
        throw new Error('Background removal library not loaded yet.');
      }

      const blob = await window.imglyRemoveBackground(image.file, {
        progress: (key, current, total) => {
          if (total) {
            const pct = Math.round((current / total) * 100);
            setProgress(pct);
          }
        }
      });
      
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
    } catch (err) {
      console.error("Background removal error:", err);
      setError(`Failed: ${err.message || 'Model loading error.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Eraser Canvas Logic ---
  
  useEffect(() => {
    if (isEraserMode && resultUrl && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        // Save initial state
        const initialData = canvas.toDataURL();
        setHistory([initialData]);
        setHistoryIndex(0);
        setZoom(1);
      };
      img.src = resultUrl;
    }
  }, [isEraserMode, resultUrl]);

  const saveHistoryState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const currentDataUrl = canvas.toDataURL();
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(currentDataUrl);
    
    // Keep max 20 history states to prevent memory issues
    if (newHistory.length > 20) newHistory.shift();
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      restoreFromDataUrl(history[newIndex]);
      setHistoryIndex(newIndex);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      restoreFromDataUrl(history[newIndex]);
      setHistoryIndex(newIndex);
    }
  };

  const restoreFromDataUrl = (dataUrl) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) ctx.beginPath();
      saveHistoryState();
    }
  };

  const draw = (e) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const rect = canvas.getBoundingClientRect();
    // Use actual rect vs canvas width to find the correct coordinate ignoring CSS scale
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
       clientX = e.touches[0].clientX;
       clientY = e.touches[0].clientY;
    } else {
       clientX = e.clientX;
       clientY = e.clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // Brush size should be absolute to canvas resolution
    // To make brush size consistent on screen, we multiply by scaleX
    ctx.lineWidth = brushSize * scaleX; 
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'destination-out';

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const saveEraser = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const newUrl = canvas.toDataURL('image/png');
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(newUrl);
    setIsEraserMode(false);
  };
  
  const cancelEraser = () => {
    setIsEraserMode(false);
  };

  // --- End Eraser Logic ---

  const downloadResult = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `nobg_${image.file.name.replace(/\.[^/.]+$/, '')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    handleReset();
  };

  const handleReset = () => {
    if (image) URL.revokeObjectURL(image.url);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setImage(null);
    setResultUrl(null);
    setError(null);
    setProgress(0);
    setIsEraserMode(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
    <div className="tool-page">
      <Link href="/tools/image" className="tool-page-back">
        ← Back to Image Toolkit
      </Link>

      <div className="tool-page-header">
        <h1>✨ Background Remover</h1>
        <p>Instantly strip the background from any image. Processing happens entirely in your browser to ensure absolute privacy.</p>
      </div>

      <div className="bg-remover-container">
        {error && <div className="error-message">⚠️ {error}</div>}

        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileChange}
          accept="image/*"
          style={{ display: 'none' }}
        />

        {!image && (
          <div 
            className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <div className="upload-zone-icon">🖼️</div>
            <div className="upload-zone-text">
              Drop an image here or <span className="upload-zone-browse">browse</span>
            </div>
          </div>
        )}

        {image && !resultUrl && (
          <div className="preview-container">
            <div className="preview-image-wrapper">
              <img src={image.url} alt="Original" className="preview-image" />
              {isProcessing && (
                <div className="scanner-overlay">
                  <div className="scanner-line"></div>
                </div>
              )}
            </div>
            
            <div className="action-bar-buttons" style={{ marginTop: '1.5rem', justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={handleReset} disabled={isProcessing}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={removeBackground} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span>
                    {progress > 0 ? `Processing ${progress}%...` : 'Loading Model...'}
                  </>
                ) : (
                  'Remove Background'
                )}
              </button>
            </div>
          </div>
        )}

        {resultUrl && !isEraserMode && (
          <div className="result-container">
            <div className="comparison-grid">
              <div className="comparison-box">
                <div className="comparison-label">Original</div>
                <img src={image.url} alt="Original" className="preview-image" />
              </div>
              <div className="comparison-box transparency-bg">
                <div className="comparison-label">Result</div>
                <img src={resultUrl} alt="No Background" className="preview-image" />
              </div>
            </div>

            <div className="action-bar-buttons" style={{ marginTop: '2rem', justifyContent: 'center', gap: '1rem' }}>
              <button className="btn btn-ghost" onClick={handleReset}>
                Process Another
              </button>
              <button className="btn btn-ghost" onClick={() => setIsEraserMode(true)}>
                ✏️ Erase Manually
              </button>
              <button className="btn btn-primary generate-btn" onClick={downloadResult}>
                Download PNG
              </button>
            </div>
          </div>
        )}

        {/* ERASER MODE UI */}
        {isEraserMode && (
          <div className="result-container">
            
            <div className="eraser-tools">
              <div className="eraser-tool-group">
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Brush Size</span>
                <input 
                  type="range" 
                  min="5" max="150" 
                  value={brushSize} 
                  onChange={(e) => setBrushSize(parseInt(e.target.value))} 
                />
              </div>

              <div className="eraser-tool-group" style={{ marginLeft: 'auto' }}>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={undo}
                  disabled={historyIndex <= 0}
                >
                  ↩️ Undo
                </button>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                >
                  ↪️ Redo
                </button>
              </div>

              <div className="eraser-tool-group">
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                >
                  ➖
                </button>
                <span style={{ fontSize: '0.8rem', minWidth: '40px', textAlign: 'center' }}>
                  {Math.round(zoom * 100)}%
                </span>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                >
                  ➕
                </button>
              </div>
            </div>
            
            <div className="eraser-canvas-container transparency-bg">
              <div 
                className="eraser-canvas-wrapper"
                style={{ transform: `scale(${zoom})` }}
              >
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  onTouchCancel={stopDrawing}
                />
              </div>
            </div>
            
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Click and drag to erase remaining artifacts.</p>

            <div className="action-bar-buttons" style={{ marginTop: '1.5rem', justifyContent: 'center', gap: '1rem' }}>
              <button className="btn btn-ghost" onClick={cancelEraser}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveEraser}>
                Save Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
