'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { saveFileAs } from '@/tools-logic/saveFile';
import './watermark.css';

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

const FONTS = {
  helveticaBold: { id: 'helveticaBold', label: 'Helvetica (Bold)', value: StandardFonts.HelveticaBold, previewFont: 'sans-serif', previewWeight: 'bold' },
  helvetica: { id: 'helvetica', label: 'Helvetica (Regular)', value: StandardFonts.Helvetica, previewFont: 'sans-serif', previewWeight: 'normal' },
  timesRomanBold: { id: 'timesRomanBold', label: 'Times Roman (Bold)', value: StandardFonts.TimesRomanBold, previewFont: 'serif', previewWeight: 'bold' },
  timesRoman: { id: 'timesRoman', label: 'Times Roman (Regular)', value: StandardFonts.TimesRoman, previewFont: 'serif', previewWeight: 'normal' },
  courierBold: { id: 'courierBold', label: 'Courier (Bold)', value: StandardFonts.CourierBold, previewFont: 'monospace', previewWeight: 'bold' },
  courier: { id: 'courier', label: 'Courier (Regular)', value: StandardFonts.Courier, previewFont: 'monospace', previewWeight: 'normal' },
};

export default function WatermarkPdf() {
  const [file, setFile] = useState(null);
  const [watermarkType, setWatermarkType] = useState('text'); // 'text' | 'image'
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [watermarkImage, setWatermarkImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [fontId, setFontId] = useState('helveticaBold');
  const [pdfPagePreviewUrl, setPdfPagePreviewUrl] = useState(null);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  
  // Options
  const [position, setPosition] = useState('center');
  const [opacity, setOpacity] = useState(0.3);
  const [scale, setScale] = useState(0.5); // Font scale (0.1 to 2.0) or Image scale (0.1 to 1.0)
  const [rotation, setRotation] = useState(45); // Degrees (-90 to 90 or -180 to 180)
  const [textColor, setTextColor] = useState('#f44336'); // Hex color

  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Cleanup object URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    if (selected && selected.type === 'application/pdf') {
      setFile(selected);
      setError(null);
      setPdfPagePreviewUrl(null);
      
      try {
        const arrayBuffer = await selected.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        // Dynamically load pdfjs
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
        pdfjs.GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
          
        const pdfDocObj = await pdfjs.getDocument({ data: bytes }).promise;
        const page = await pdfDocObj.getPage(1);
        
        const scaleVal = 280 / page.getViewport({ scale: 1 }).width;
        const viewport = page.getViewport({ scale: scaleVal });
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/png');
        setPdfPagePreviewUrl(dataUrl);
        try { pdfDocObj.destroy(); } catch {}
      } catch (err) {
        console.error('Failed to generate PDF page preview:', err);
      }
    } else {
      setError('Please select a valid PDF file.');
    }
  };

  const handleImageChange = (e) => {
    const selected = e.target.files[0];
    if (selected && (selected.type === 'image/png' || selected.type === 'image/jpeg' || selected.type === 'image/jpg')) {
      setWatermarkImage(selected);
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      const url = URL.createObjectURL(selected);
      setImagePreviewUrl(url);
      setError(null);
    } else {
      setError('Please select a valid PNG or JPEG image.');
    }
  };

  const handleTypeChange = (type) => {
    setWatermarkType(type);
    if (type === 'image') {
      setRotation(0);
      setScale(0.3); // Default scale for image (30% of page width)
    } else {
      setRotation(45);
      setScale(0.5); // Default scale for text (50% of base font sizing)
    }
  };

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : { r: 0.95, g: 0.1, b: 0.1 };
  };

  const getTransform = () => {
    let t = '';
    if (position === 'center' || position === 'topCenter' || position === 'bottomCenter') {
      t += 'translate(-50%, -50%) ';
    }
    // Scale preview indicator proportionally
    const scaleFactor = watermarkType === 'text' ? scale * 0.8 + 0.6 : scale * 1.5;
    t += `rotate(${rotation}deg) scale(${scaleFactor})`;
    return t;
  };

  const getTransformExpanded = () => {
    let t = '';
    if (position === 'center' || position === 'topCenter' || position === 'bottomCenter') {
      t += 'translate(-50%, -50%) ';
    }
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 480;
    const zoomMultiplier = isMobile ? 1.0 : 1.6;
    const scaleFactor = (watermarkType === 'text' ? scale * 0.8 + 0.6 : scale * 1.5) * zoomMultiplier;
    t += `rotate(${rotation}deg) scale(${scaleFactor})`;
    return t;
  };

  const applyWatermark = async () => {
    if (!file) return;
    if (watermarkType === 'text' && !watermarkText.trim()) return;
    if (watermarkType === 'image' && !watermarkImage) {
      setError('Please select an image file first.');
      return;
    }
    
    setIsProcessing(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();

      // Embed assets depending on type
      let activeFont;
      let embeddedImg;
      let imgAspectRatio = 1;

      if (watermarkType === 'text') {
        const fontConfig = FONTS[fontId] || FONTS.helveticaBold;
        activeFont = await pdfDoc.embedFont(fontConfig.value);
      } else {
        const imgArrayBuffer = await watermarkImage.arrayBuffer();
        if (watermarkImage.type === 'image/png') {
          embeddedImg = await pdfDoc.embedPng(imgArrayBuffer);
        } else {
          embeddedImg = await pdfDoc.embedJpg(imgArrayBuffer);
        }
        imgAspectRatio = embeddedImg.width / embeddedImg.height;
      }
      
      const { r, g, b } = hexToRgb(textColor);

      pages.forEach((page) => {
        const { width: pageWidth, height: pageHeight } = page.getSize();
        
        let watermarkWidth = 0;
        let watermarkHeight = 0;
        let fontSize = 40;

        if (watermarkType === 'text') {
          // Calculate font size relative to page width and scale
          fontSize = 80 * scale;
          watermarkWidth = activeFont.widthOfTextAtSize(watermarkText, fontSize);
          watermarkHeight = activeFont.heightAtSize(fontSize);
        } else {
          // Image width scaled relative to page width
          watermarkWidth = pageWidth * scale;
          watermarkHeight = watermarkWidth / imgAspectRatio;
        }

        // Coordinates logic based on alignment position
        let x = 0;
        let y = 0;
        const margin = 20;

        const calculateCoords = (alignPos, w, h) => {
          let cx = 0;
          let cy = 0;
          if (alignPos === 'center') {
            cx = (pageWidth - w) / 2;
            cy = (pageHeight - h) / 2;
          } else if (alignPos === 'topLeft') {
            cx = margin;
            cy = pageHeight - margin - h;
          } else if (alignPos === 'topRight') {
            cx = pageWidth - margin - w;
            cy = pageHeight - margin - h;
          } else if (alignPos === 'bottomLeft') {
            cx = margin;
            cy = margin;
          } else if (alignPos === 'bottomRight') {
            cx = pageWidth - margin - w;
            cy = margin;
          } else if (alignPos === 'topCenter') {
            cx = (pageWidth - w) / 2;
            cy = pageHeight - margin - h;
          } else if (alignPos === 'bottomCenter') {
            cx = (pageWidth - w) / 2;
            cy = margin;
          }
          return { cx, cy };
        };

        if (position === 'tile') {
          const cols = 3;
          const rows = 4;
          for (let col = 0; col < cols; col++) {
            for (let row = 0; row < rows; row++) {
              const tx = (pageWidth / cols) * col + (pageWidth / cols - watermarkWidth) / 2;
              const ty = (pageHeight / rows) * row + (pageHeight / rows - watermarkHeight) / 2;
              
              if (watermarkType === 'text') {
                page.drawText(watermarkText, {
                  x: tx,
                  y: ty,
                  size: fontSize,
                  font: activeFont,
                  color: rgb(r, g, b),
                  opacity: opacity,
                  rotate: degrees(rotation),
                });
              } else {
                page.drawImage(embeddedImg, {
                  x: tx,
                  y: ty,
                  width: watermarkWidth,
                  height: watermarkHeight,
                  opacity: opacity,
                  rotate: degrees(rotation),
                });
              }
            }
          }
        } else {
          const { cx, cy } = calculateCoords(position, watermarkWidth, watermarkHeight);
          
          if (watermarkType === 'text') {
            page.drawText(watermarkText, {
              x: cx,
              y: cy,
              size: fontSize,
              font: activeFont,
              color: rgb(r, g, b),
              opacity: opacity,
              rotate: degrees(rotation),
            });
          } else {
            page.drawImage(embeddedImg, {
              x: cx,
              y: cy,
              width: watermarkWidth,
              height: watermarkHeight,
              opacity: opacity,
              rotate: degrees(rotation),
            });
          }
        }
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      
      const saved = await saveFileAs(blob, `Watermarked_${file.name}`, {
        description: 'PDF Document',
        mimeType: 'application/pdf',
        extensions: ['.pdf'],
      });
      
      if (saved) setIsComplete(true);
    } catch (err) {
      console.error(err);
      setError('Failed to apply watermark. The PDF might be corrupted or protected.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetTool = () => {
    setFile(null);
    setWatermarkImage(null);
    setPdfPagePreviewUrl(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    setIsComplete(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  return (
    <div className="tool-page">
      <Link href="/tools/pdf" className="tool-page-back">← Back to PDF Toolkit</Link>
      <div className="tool-page-header">
        <h1>©️ Watermark PDF</h1>
        <p>Stamp custom text or image watermarks across your PDF document instantly.</p>
      </div>

      {isComplete ? (
        <div className="result-container watermark-card success-card">
          <FairyLights />
          <div style={{ fontSize: '5rem', marginBottom: '20px' }}>🎉</div>
          <h2 className="success-card-title success" style={{ fontFamily: 'var(--font-pixel)', fontSize: '2rem', marginBottom: '20px' }}>
            TASK DONE!
          </h2>
          <p style={{ marginBottom: '40px', fontSize: '1.1rem' }}>
            Your watermarked PDF has been downloaded successfully.
          </p>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={resetTool} style={{ padding: '12px 24px', fontSize: '1rem' }}>
              Watermark Another PDF
            </button>
          </div>
        </div>
      ) : (
        <div className="result-container watermark-card">
          {error && <div className="error-message">⚠️ {error}</div>}
          
          {!file ? (
            <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
              <div className="upload-zone-icon">📁</div>
              <div className="upload-zone-text">Click or drag a PDF here to watermark</div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" style={{ display: 'none' }} />
            </div>
          ) : (
            <div className="watermark-layout">
              {/* Settings Panel */}
              <div className="settings-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', color: 'var(--pixel-cyan)', marginBottom: '10px' }}>
                  <span>📄</span> <strong style={{ wordBreak: 'break-all' }}>{file.name}</strong>
                </div>

                {/* Type Tab Selector */}
                <div className="setting-group">
                  <label>WATERMARK TYPE</label>
                  <div className="type-tabs">
                    <div 
                      role="button"
                      tabIndex={0}
                      className={`type-tab-btn ${watermarkType === 'text' ? 'active' : ''}`}
                      onClick={() => handleTypeChange('text')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleTypeChange('text');
                        }
                      }}
                    >
                      TEXT
                    </div>
                    <div 
                      role="button"
                      tabIndex={0}
                      className={`type-tab-btn ${watermarkType === 'image' ? 'active' : ''}`}
                      onClick={() => handleTypeChange('image')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleTypeChange('image');
                        }
                      }}
                    >
                      IMAGE
                    </div>
                  </div>
                </div>

                {/* Text configuration */}
                {watermarkType === 'text' && (
                  <>
                    <div className="setting-group">
                      <label>WATERMARK TEXT</label>
                      <input 
                        type="text" 
                        value={watermarkText}
                        onChange={(e) => setWatermarkText(e.target.value)}
                        placeholder="CONFIDENTIAL"
                        className="watermark-input"
                      />
                    </div>

                    <div className="setting-group">
                      <label>TEXT COLOR</label>
                      <div className="color-picker-wrapper">
                        <input 
                          type="color" 
                          value={textColor}
                          onChange={(e) => setTextColor(e.target.value)}
                          className="color-input"
                        />
                        <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 600 }}>
                          {textColor}
                        </span>
                      </div>
                    </div>

                    <div className="setting-group">
                      <label>SELECT FONT</label>
                      <select 
                        value={fontId} 
                        onChange={(e) => setFontId(e.target.value)}
                        className="watermark-select"
                        style={{ fontFamily: FONTS[fontId]?.previewFont, fontWeight: FONTS[fontId]?.previewWeight }}
                      >
                        {Object.values(FONTS).map((f) => (
                          <option key={f.id} value={f.id} style={{ fontFamily: f.previewFont, fontWeight: f.previewWeight }}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Image configuration */}
                {watermarkType === 'image' && (
                  <div className="setting-group">
                    <label>SELECT IMAGE</label>
                    <div className="image-selector-zone" onClick={() => imageInputRef.current?.click()}>
                      <div className="image-selector-text">
                        {watermarkImage ? `🖼️ ${watermarkImage.name}` : 'Click to choose image'}
                      </div>
                      <div className="image-selector-hint">Supports PNG, JPG, JPEG</div>
                      <input 
                        type="file" 
                        ref={imageInputRef} 
                        onChange={handleImageChange} 
                        accept="image/png, image/jpeg, image/jpg" 
                        style={{ display: 'none' }} 
                      />
                    </div>
                  </div>
                )}

                {/* Placement selector */}
                <div className="setting-group">
                  <label>ALIGN POSITION</label>
                  <select 
                    value={position} 
                    onChange={(e) => setPosition(e.target.value)}
                    className="watermark-select"
                  >
                    <option value="center">Center</option>
                    <option value="tile">Tile Grid (Repeated)</option>
                    <option value="topLeft">Top Left</option>
                    <option value="topRight">Top Right</option>
                    <option value="bottomLeft">Bottom Left</option>
                    <option value="bottomRight">Bottom Right</option>
                    <option value="topCenter">Top Center</option>
                    <option value="bottomCenter">Bottom Center</option>
                  </select>
                </div>

                {/* Scale slider */}
                <div className="setting-group">
                  <label>{watermarkType === 'text' ? 'FONT SIZE SCALE' : 'IMAGE SIZE SCALE'}</label>
                  <div className="slider-container">
                    <input 
                      type="range" 
                      min={watermarkType === 'text' ? '0.1' : '0.05'} 
                      max={watermarkType === 'text' ? '2.5' : '1.0'} 
                      step="0.05"
                      value={scale} 
                      onChange={(e) => setScale(parseFloat(e.target.value))}
                    />
                    <span className="slider-val">{Math.round(scale * 100)}%</span>
                  </div>
                </div>

                {/* Opacity slider */}
                <div className="setting-group">
                  <label>TRANSPARENCY (OPACITY)</label>
                  <div className="slider-container">
                    <input 
                      type="range" 
                      min="0.05" 
                      max="1.0" 
                      step="0.05"
                      value={opacity} 
                      onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    />
                    <span className="slider-val">{Math.round(opacity * 100)}%</span>
                  </div>
                </div>

                {/* Rotation slider */}
                <div className="setting-group">
                  <label>ROTATION ANGLE</label>
                  <div className="slider-container">
                    <input 
                      type="range" 
                      min="-180" 
                      max="180" 
                      step="5"
                      value={rotation} 
                      onChange={(e) => setRotation(parseInt(e.target.value))}
                    />
                    <span className="slider-val">{rotation}°</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button className="btn btn-ghost" onClick={resetTool} disabled={isProcessing}>Change PDF</button>
                  <button 
                    className="btn btn-primary" 
                    onClick={applyWatermark} 
                    disabled={isProcessing || (watermarkType === 'text' && !watermarkText.trim()) || (watermarkType === 'image' && !watermarkImage)}
                  >
                    {isProcessing ? 'Processing...' : 'Apply Watermark'}
                  </button>
                </div>
              </div>

              {/* Layout Preview Column */}
              <div className="preview-panel">
                <div className="preview-title">LAYOUT PREVIEW</div>
                <div className="mockup-page" style={{ '--watermark-color': textColor }}>
                  {pdfPagePreviewUrl && (
                    <img 
                      src={pdfPagePreviewUrl} 
                      alt="PDF Page Preview" 
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        pointerEvents: 'none',
                        zIndex: 1
                      }}
                    />
                  )}
                  {position === 'tile' ? (
                    <div className="pos-tile" style={{ zIndex: 2 }}>
                      {Array.from({ length: 12 }).map((_, idx) => (
                        <div 
                          key={idx} 
                          className="tile-indicator" 
                          style={{
                            color: watermarkType === 'text' ? textColor : '#aaa',
                            transform: `rotate(${rotation}deg)`,
                            fontFamily: watermarkType === 'text' ? FONTS[fontId]?.previewFont : 'inherit',
                            fontWeight: watermarkType === 'text' ? FONTS[fontId]?.previewWeight : 'normal',
                          }}
                        >
                          {watermarkType === 'text' ? (
                            watermarkText.substring(0, 10) || 'TXT'
                          ) : imagePreviewUrl ? (
                            <img 
                              src={imagePreviewUrl} 
                              alt="Tile" 
                              style={{ maxWidth: '24px', maxHeight: '24px', objectFit: 'contain', opacity: opacity }} 
                            />
                          ) : (
                            'IMG'
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div 
                      className={`mockup-watermark-overlay ${watermarkType}-type pos-${position}`}
                      style={{
                        color: watermarkType === 'text' ? textColor : 'transparent',
                        fontFamily: watermarkType === 'text' ? FONTS[fontId]?.previewFont : 'inherit',
                        fontWeight: watermarkType === 'text' ? FONTS[fontId]?.previewWeight : 'normal',
                        transform: getTransform(),
                        opacity: opacity,
                        zIndex: 2,
                      }}
                    >
                      {watermarkType === 'text' ? (
                        watermarkText || 'WATERMARK'
                      ) : imagePreviewUrl ? (
                        <img 
                          src={imagePreviewUrl} 
                          alt="Watermark Preview" 
                          style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'contain' }} 
                        />
                      ) : (
                        '🎨 IMAGE'
                      )}
                    </div>
                  )}
                </div>
                <button 
                  type="button" 
                  onClick={() => setIsPreviewExpanded(true)}
                  className="btn btn-ghost" 
                  style={{ padding: '8px 16px', fontSize: '0.75rem', marginTop: '12px', width: '100%', maxWidth: '280px' }}
                >
                  🔍 EXPAND PREVIEW
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expanded Preview Modal */}
      {isPreviewExpanded && (
        <div className="preview-modal-overlay" onClick={() => setIsPreviewExpanded(false)}>
          <div className="preview-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="preview-modal-close" onClick={() => setIsPreviewExpanded(false)}>×</button>
            <div className="preview-modal-title">PDF Page Preview</div>
            
            <div className="mockup-page expanded" style={{ '--watermark-color': textColor }}>
              {pdfPagePreviewUrl && (
                <img 
                  src={pdfPagePreviewUrl} 
                  alt="PDF Page Preview" 
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    pointerEvents: 'none',
                    zIndex: 1
                  }}
                />
              )}

              {position === 'tile' ? (
                <div className="pos-tile" style={{ zIndex: 2 }}>
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <div 
                      key={idx} 
                      className="tile-indicator" 
                      style={{
                        color: watermarkType === 'text' ? textColor : '#aaa',
                        transform: `rotate(${rotation}deg)`,
                        fontFamily: watermarkType === 'text' ? FONTS[fontId]?.previewFont : 'inherit',
                        fontWeight: watermarkType === 'text' ? FONTS[fontId]?.previewWeight : 'normal',
                      }}
                    >
                      {watermarkType === 'text' ? (
                        watermarkText.substring(0, 15) || 'TXT'
                      ) : imagePreviewUrl ? (
                        <img 
                          src={imagePreviewUrl} 
                          alt="Tile" 
                          style={{ maxWidth: '40px', maxHeight: '40px', objectFit: 'contain', opacity: opacity }} 
                        />
                      ) : (
                        'IMG'
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div 
                  className={`mockup-watermark-overlay ${watermarkType}-type pos-${position}`}
                  style={{
                    color: watermarkType === 'text' ? textColor : 'transparent',
                    fontFamily: watermarkType === 'text' ? FONTS[fontId]?.previewFont : 'inherit',
                    fontWeight: watermarkType === 'text' ? FONTS[fontId]?.previewWeight : 'normal',
                    transform: getTransformExpanded(),
                    opacity: opacity,
                    zIndex: 2,
                  }}
                >
                  {watermarkType === 'text' ? (
                    watermarkText || 'WATERMARK'
                  ) : imagePreviewUrl ? (
                    <img 
                      src={imagePreviewUrl} 
                      alt="Watermark Preview" 
                      style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'contain' }} 
                    />
                  ) : (
                    '🎨 IMAGE'
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
