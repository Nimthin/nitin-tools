'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { PDFDocument, rgb, StandardFonts, PDFName, PDFString } from 'pdf-lib';

// FairyLights Component
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

export default function EditPdf() {
  const [file, setFile] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  
  // Visual Editor State
  const [pdfjsLib, setPdfjsLib] = useState(null);
  const [pdfRenderDoc, setPdfRenderDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [annotations, setAnnotations] = useState([]); 
  const [activeTool, setActiveTool] = useState('text'); // 'text', 'link', 'image', 'sign', 'whiteout', 'shape'
  const [selectedColor, setSelectedColor] = useState('#ff0000');
  const [selectedFontSize, setSelectedFontSize] = useState(24);
  const [selectedFontFamily, setSelectedFontFamily] = useState('Helvetica');
  
  // Dragging state
  const [dragId, setDragId] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Load pdfjs on mount
  useEffect(() => {
    const loadPdfJs = async () => {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
        pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
        setPdfjsLib(pdfjs);
      } catch (err) {
        console.error("Failed to load pdfjs", err);
      }
    };
    loadPdfJs();
  }, []);

  // Render current page to canvas
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfRenderDoc || !canvasRef.current || !pdfjsLib) return;
      
      try {
        const page = await pdfRenderDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        
        await page.render(renderContext).promise;
      } catch (err) {
        console.error("Render error", err);
      }
    };
    
    renderPage();
  }, [pdfRenderDoc, currentPage, scale, pdfjsLib]);

  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    if (selected && selected.type === 'application/pdf') {
      setFile(selected);
      setError(null);
      setIsComplete(false);
      setAnnotations([]);
      setCurrentPage(1);
      
      try {
        const arrayBuffer = await selected.arrayBuffer();
        setPdfData(arrayBuffer);
        
        if (pdfjsLib) {
          const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
          const doc = await loadingTask.promise;
          setPdfRenderDoc(doc);
          setTotalPages(doc.numPages);
        }
      } catch (err) {
        setError('Failed to load PDF for visual editing.');
      }
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target !== e.currentTarget) return; // ignore clicks on text boxes/inputs
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newId = Date.now().toString();
    
    if (activeTool === 'text') {
      setAnnotations([...annotations, {
        id: newId,
        type: 'text',
        pageIndex: currentPage,
        x,
        y,
        text: '',
        color: selectedColor,
        fontSize: selectedFontSize,
        fontFamily: selectedFontFamily
      }]);
    } else if (activeTool === 'link') {
      const url = prompt("Enter URL:", "https://");
      if (!url) return;
      setAnnotations([...annotations, {
        id: newId,
        type: 'link',
        pageIndex: currentPage,
        x,
        y,
        url,
        width: 120,
        height: 30
      }]);
    } else if (activeTool === 'image') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png, image/jpeg';
      input.onchange = async (event) => {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (re) => {
            setAnnotations([...annotations, {
              id: newId,
              type: 'image',
              pageIndex: currentPage,
              x,
              y,
              dataUrl: re.target.result,
              width: 150,
              height: 100
            }]);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else if (activeTool === 'sign') {
      const name = prompt("Type your signature:", "Your Name");
      if (!name) return;
      setAnnotations([...annotations, {
        id: newId,
        type: 'text',
        pageIndex: currentPage,
        x,
        y,
        text: name,
        color: '#09090b',
        fontSize: 32,
        fontFamily: 'TimesRoman'
      }]);
    } else if (activeTool === 'whiteout') {
      setAnnotations([...annotations, {
        id: newId,
        type: 'whiteout',
        pageIndex: currentPage,
        x,
        y,
        width: 120,
        height: 30
      }]);
    } else if (activeTool === 'shape') {
      setAnnotations([...annotations, {
        id: newId,
        type: 'shape',
        pageIndex: currentPage,
        x,
        y,
        width: 120,
        height: 80,
        color: selectedColor
      }]);
    }
  };

  const updateAnnotationText = (id, newText) => {
    setAnnotations(annotations.map(a => a.id === id ? { ...a, text: newText } : a));
  };
  
  const updateAnnotationSize = (id, width, height) => {
    setAnnotations(annotations.map(a => a.id === id ? { ...a, width: Number(width), height: Number(height) } : a));
  };

  const deleteAnnotation = (id) => {
    setAnnotations(annotations.filter(a => a.id !== id));
  };

  // Dragging handlers
  const handleDragStart = (id, e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    setDragId(id);
    const ann = annotations.find(a => a.id === id);
    const rect = canvasRef.current.getBoundingClientRect();
    setDragStart({
      x: e.clientX - rect.left - ann.x,
      y: e.clientY - rect.top - ann.y
    });
  };

  const handleMouseMove = (e) => {
    if (!dragId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - dragStart.x;
    const y = e.clientY - rect.top - dragStart.y;
    
    // Boundary checks (keep inside canvas)
    const boundedX = Math.max(0, Math.min(rect.width, x));
    const boundedY = Math.max(0, Math.min(rect.height, y));
    
    setAnnotations(annotations.map(a => a.id === dragId ? { ...a, x: boundedX, y: boundedY } : a));
  };

  const handleMouseUp = () => {
    setDragId(null);
  };

  const handleSavePdf = async () => {
    if (!pdfData) return;
    setIsProcessing(true);
    
    try {
      const pdfDoc = await PDFDocument.load(pdfData);
      const pages = pdfDoc.getPages();
      
      const fonts = {
        'Helvetica': await pdfDoc.embedFont(StandardFonts.Helvetica),
        'TimesRoman': await pdfDoc.embedFont(StandardFonts.TimesRoman),
        'Courier': await pdfDoc.embedFont(StandardFonts.Courier)
      };
      
      for (const ann of annotations) {
        if (ann.pageIndex > pages.length) continue;
        const targetPage = pages[ann.pageIndex - 1];
        
        const pdfX = ann.x / scale;
        const pdfYCanvas = ann.y / scale; 
        const pdfHeight = targetPage.getHeight();
        const pdfY = pdfHeight - pdfYCanvas;
        
        const hexToRgb = (hex) => {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
          } : { r: 0, g: 0, b: 0 };
        };

        if (ann.type === 'text') {
          const color = hexToRgb(ann.color);
          targetPage.drawText(ann.text || ' ', {
            x: pdfX,
            y: pdfY - (ann.fontSize / scale),
            size: ann.fontSize / scale,
            color: rgb(color.r, color.g, color.b),
            font: fonts[ann.fontFamily || 'Helvetica'],
          });
        } else if (ann.type === 'link') {
          const pdfWidth = ann.width / scale;
          const pdfHeightVal = ann.height / scale;
          
          const linkAnnot = pdfDoc.context.register(
            pdfDoc.context.obj({
              Type: 'Annot',
              Subtype: 'Link',
              Rect: [pdfX, pdfY - pdfHeightVal, pdfX + pdfWidth, pdfY],
              Border: [0, 0, 0],
              A: {
                Type: 'Action',
                S: 'URI',
                URI: PDFString.of(ann.url),
              },
            })
          );
          
          const existingAnnotsObj = targetPage.node.get(PDFName.of('Annots'));
          let existingAnnots = [];
          if (existingAnnotsObj) {
            existingAnnots = pdfDoc.context.lookup(existingAnnotsObj).array || [];
          }
          targetPage.node.set(
            PDFName.of('Annots'),
            pdfDoc.context.newArray([...existingAnnots, linkAnnot])
          );
        } else if (ann.type === 'image') {
          const pdfWidth = ann.width / scale;
          const pdfHeightVal = ann.height / scale;
          
          const response = await fetch(ann.dataUrl);
          const imageBytes = await response.arrayBuffer();
          let embeddedImage;
          if (ann.dataUrl.includes('image/png')) {
            embeddedImage = await pdfDoc.embedPng(imageBytes);
          } else {
            embeddedImage = await pdfDoc.embedJpg(imageBytes);
          }
          
          targetPage.drawImage(embeddedImage, {
            x: pdfX,
            y: pdfY - pdfHeightVal,
            width: pdfWidth,
            height: pdfHeightVal,
          });
        } else if (ann.type === 'whiteout') {
          const pdfWidth = ann.width / scale;
          const pdfHeightVal = ann.height / scale;
          targetPage.drawRectangle({
            x: pdfX,
            y: pdfY - pdfHeightVal,
            width: pdfWidth,
            height: pdfHeightVal,
            color: rgb(1, 1, 1),
          });
        } else if (ann.type === 'shape') {
          const pdfWidth = ann.width / scale;
          const pdfHeightVal = ann.height / scale;
          const color = hexToRgb(ann.color);
          targetPage.drawRectangle({
            x: pdfX,
            y: pdfY - pdfHeightVal,
            width: pdfWidth,
            height: pdfHeightVal,
            color: rgb(color.r, color.g, color.b),
          });
        }
      }
      
      const savedBytes = await pdfDoc.save();
      const blob = new Blob([savedBytes], { type: 'application/pdf' });
      setDownloadUrl(URL.createObjectURL(blob));
      setIsComplete(true);
    } catch (err) {
      console.error(err);
      setError('Failed to generate final PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="tool-page" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Link href="/tools/pdf" className="tool-page-back" style={{ margin: '10px 20px' }}>← Back to PDF Toolkit</Link>

      {isComplete ? (
        <div className="result-container" style={{ margin: 'auto', maxWidth: '800px', position: 'relative', textAlign: 'center', padding: '60px 20px', background: '#2d1b4e', border: '4px solid #ff007f', boxShadow: '0 0 30px rgba(255, 0, 127, 0.4), inset 0 0 20px rgba(0,0,0,0.5)' }}>
          <FairyLights />
          <div style={{ fontSize: '5rem', marginBottom: '20px', filter: 'drop-shadow(4px 4px 0px #000)' }}>🎉</div>
          <h2 style={{ fontFamily: 'var(--font-pixel)', color: '#ffcc00', marginBottom: '20px', fontSize: '2rem', textShadow: '4px 4px 0px #000' }}>DOCUMENT SAVED!</h2>
          <div style={{ color: '#fff', marginBottom: '30px', fontSize: '1.2rem' }}>All visual annotations have been stamped successfully.</div>
          
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => { setIsComplete(false); setDownloadUrl(null); }} style={{ padding: '12px 24px', fontSize: '1rem' }}>
              Continue Editing
            </button>
            <a href={downloadUrl} download={`edited_${file.name}`} className="btn btn-primary" style={{ padding: '12px 24px', fontSize: '1rem', background: 'var(--pixel-green)', textDecoration: 'none', display: 'inline-block' }}>
              ⬇️ Download PDF
            </a>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--pixel-bg-card)', borderTop: '3px solid var(--pixel-border)' }}>
          {error && <div style={{ background: '#f44336', color: '#fff', padding: '10px', textAlign: 'center', fontFamily: 'var(--font-pixel)', fontSize: '0.8rem' }}>⚠️ {error}</div>}
          
          {!file ? (
            <div style={{ padding: '40px 20px', margin: 'auto' }}>
              <div className="upload-zone" onClick={() => fileInputRef.current?.click()} style={{ background: '#2d1b4e' }}>
                <div className="upload-zone-icon">🖍️</div>
                <div className="upload-zone-text">Click or drag a PDF here to visually edit</div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" style={{ display: 'none' }} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              
              {/* WYSIWYG TOP TOOLBAR */}
              <div style={{ background: '#2d1b4e', borderBottom: '3px solid var(--pixel-border)', padding: '10px 20px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', zIndex: 10 }}>
                <div style={{ display: 'flex', gap: '5px', borderRight: '2px solid rgba(255,255,255,0.2)', paddingRight: '15px' }}>
                   <button className={`btn ${activeTool === 'text' ? 'btn-selected' : 'btn-ghost'}`} onClick={() => setActiveTool('text')} style={{ padding: '8px 12px', fontSize: '0.8rem' }} title="Add text to document">
                     [T] Text
                   </button>
                   <button className={`btn ${activeTool === 'link' ? 'btn-selected' : 'btn-ghost'}`} onClick={() => setActiveTool('link')} style={{ padding: '8px 12px', fontSize: '0.8rem' }} title="Add clickable link">
                     🔗 Links
                   </button>
                   <button className={`btn ${activeTool === 'image' ? 'btn-selected' : 'btn-ghost'}`} onClick={() => setActiveTool('image')} style={{ padding: '8px 12px', fontSize: '0.8rem' }} title="Stamp image">
                     🖼️ Images
                   </button>
                   <button className={`btn ${activeTool === 'sign' ? 'btn-selected' : 'btn-ghost'}`} onClick={() => setActiveTool('sign')} style={{ padding: '8px 12px', fontSize: '0.8rem' }} title="Place signature">
                     ✍️ Sign
                   </button>
                   <button className={`btn ${activeTool === 'whiteout' ? 'btn-selected' : 'btn-ghost'}`} onClick={() => setActiveTool('whiteout')} style={{ padding: '8px 12px', fontSize: '0.8rem' }} title="Mask sections with white rectangular whiteout">
                     ⬜ Whiteout
                   </button>
                   <button className={`btn ${activeTool === 'shape' ? 'btn-selected' : 'btn-ghost'}`} onClick={() => setActiveTool('shape')} style={{ padding: '8px 12px', fontSize: '0.8rem' }} title="Draw rectangular color shapes">
                     🔺 Shapes
                   </button>
                </div>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input type="color" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} style={{ width: '30px', height: '30px', cursor: 'pointer', border: '2px solid var(--pixel-border)' }} title="Text/Shape Color" />
                  
                  {activeTool === 'text' && (
                    <>
                      <select value={selectedFontFamily} onChange={(e) => setSelectedFontFamily(e.target.value)} style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.7rem', padding: '5px' }} title="Font Style">
                        <option value="Helvetica">Helvetica</option>
                        <option value="TimesRoman">Times Roman</option>
                        <option value="Courier">Courier (Mono)</option>
                      </select>

                      <select value={selectedFontSize} onChange={(e) => setSelectedFontSize(Number(e.target.value))} style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.7rem', padding: '5px' }} title="Font Size">
                        <option value={12}>12px</option>
                        <option value={16}>16px</option>
                        <option value={24}>24px</option>
                        <option value={32}>32px</option>
                        <option value={48}>48px</option>
                        <option value={72}>72px</option>
                      </select>
                    </>
                  )}
                </div>
                
                <div style={{ flex: 1 }} />
                
                {/* PAGE NAVIGATION */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', borderRight: '2px solid rgba(255,255,255,0.2)', paddingRight: '15px' }}>
                   <button className="btn btn-ghost" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '5px 10px' }}>◀</button>
                   <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.7rem', color: '#fff' }}>PAGE {currentPage} / {totalPages}</span>
                   <button className="btn btn-ghost" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '5px 10px' }}>▶</button>
                </div>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', borderRight: '2px solid rgba(255,255,255,0.2)', paddingRight: '15px' }}>
                   <button className="btn btn-ghost" onClick={() => setScale(s => Math.max(0.5, s - 0.2))} style={{ padding: '5px 10px' }}>-</button>
                   <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.7rem', color: '#fff' }}>{Math.round(scale * 100)}%</span>
                   <button className="btn btn-ghost" onClick={() => setScale(s => Math.min(3, s + 0.2))} style={{ padding: '5px 10px' }}>+</button>
                </div>

                <div style={{ marginLeft: '10px' }}>
                  <button className="btn btn-primary" onClick={handleSavePdf} disabled={isProcessing} style={{ padding: '8px 16px', fontSize: '0.8rem', background: 'var(--pixel-green)' }}>
                    {isProcessing ? 'SAVING...' : '💾 SAVE PDF'}
                  </button>
                </div>
              </div>
              
              {/* VISUAL CANVAS AREA */}
              <div 
                style={{ flex: 1, overflow: 'auto', background: '#111', padding: '40px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}
              >
                <div style={{ position: 'relative', boxShadow: '0 0 20px rgba(0,0,0,0.8)' }}>
                  
                  {/* The actual rendered PDF page */}
                  <canvas ref={canvasRef} style={{ display: 'block', background: '#fff' }} />
                  
                  {/* Overlay Interaction Layer (specifically matches PDF coordinate area) */}
                  <div 
                    onClick={handleOverlayClick}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, cursor: activeTool === 'text' ? 'text' : 'crosshair', zIndex: 5 }}
                  >
                    {annotations.filter(a => a.pageIndex === currentPage).map(ann => {
                      if (ann.type === 'text') {
                        return (
                          <div 
                            key={ann.id}
                            onMouseDown={(e) => handleDragStart(ann.id, e)}
                            onClick={(e) => e.stopPropagation()} 
                            style={{
                              position: 'absolute',
                              left: `${ann.x}px`,
                              top: `${ann.y}px`,
                              transform: 'translateY(-100%)', 
                              display: 'flex',
                              alignItems: 'center',
                              zIndex: 10,
                              cursor: 'move',
                              background: dragId === ann.id ? 'rgba(0,120,255,0.1)' : 'transparent',
                              border: dragId === ann.id ? '1px dashed #0070f3' : 'none'
                            }}
                          >
                             <input 
                               autoFocus
                               value={ann.text}
                               placeholder="Type text..."
                               onChange={(e) => updateAnnotationText(ann.id, e.target.value)}
                               style={{
                                 background: 'transparent',
                                 border: 'none',
                                 borderBottom: '1px dashed rgba(0,120,255,0.4)',
                                 color: ann.color,
                                 fontSize: `${ann.fontSize}px`,
                                 fontFamily: ann.fontFamily === 'TimesRoman' ? '"Times New Roman", Times, serif' : ann.fontFamily === 'Courier' ? 'Courier, monospace' : 'Arial, Helvetica, sans-serif',
                                 padding: '0px',
                                 outline: 'none',
                                 minWidth: '60px',
                                 width: `${Math.max(60, (ann.text || '').length * (ann.fontSize * 0.55))}px`
                               }}
                             />
                             <button onClick={() => deleteAnnotation(ann.id)} title="Delete" style={{ background: 'rgba(255,0,0,0.1)', border: 'none', borderRadius: '50%', color: '#ff4444', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: '5px', fontSize: '12px' }}>✕</button>
                          </div>
                        );
                      }
                      
                      if (ann.type === 'link') {
                        return (
                          <div 
                            key={ann.id}
                            onMouseDown={(e) => handleDragStart(ann.id, e)}
                            onClick={(e) => e.stopPropagation()} 
                            style={{
                              position: 'absolute',
                              left: `${ann.x}px`,
                              top: `${ann.y}px`,
                              width: `${ann.width}px`,
                              height: `${ann.height}px`,
                              transform: 'translateY(-100%)',
                              background: 'rgba(0, 120, 255, 0.25)',
                              border: '2px dashed #0070f3',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '2px 5px',
                              zIndex: 10,
                              cursor: 'move'
                            }}
                          >
                             <span style={{ fontSize: '10px', color: '#0070f3', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                               🔗 {ann.url}
                             </span>
                             <div style={{ display: 'flex', gap: '3px' }}>
                               <input 
                                 type="number" 
                                 value={ann.width} 
                                 onChange={(e) => updateAnnotationSize(ann.id, e.target.value, ann.height)}
                                 style={{ width: '35px', fontSize: '9px', background: '#fff', border: '1px solid #ccc' }} 
                                 title="Width"
                               />
                               <button onClick={() => deleteAnnotation(ann.id)} title="Delete" style={{ background: 'red', border: 'none', color: '#fff', width: '15px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px' }}>✕</button>
                             </div>
                          </div>
                        );
                      }

                      if (ann.type === 'image') {
                        return (
                          <div 
                            key={ann.id}
                            onMouseDown={(e) => handleDragStart(ann.id, e)}
                            onClick={(e) => e.stopPropagation()} 
                            style={{
                              position: 'absolute',
                              left: `${ann.x}px`,
                              top: `${ann.y}px`,
                              width: `${ann.width}px`,
                              height: `${ann.height}px`,
                              transform: 'translateY(-100%)',
                              zIndex: 10,
                              cursor: 'move',
                              border: '1px dashed #000'
                            }}
                          >
                             <img src={ann.dataUrl} style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'rgba(255,255,255,0.7)' }} />
                             <div style={{ position: 'absolute', top: '-25px', right: '0px', display: 'flex', gap: '3px', background: '#fff', padding: '2px', border: '1px solid #ccc', borderRadius: '3px' }}>
                               <input 
                                 type="number" 
                                 value={ann.width} 
                                 onChange={(e) => updateAnnotationSize(ann.id, e.target.value, (e.target.value * (ann.height / ann.width)))}
                                 style={{ width: '40px', fontSize: '10px' }} 
                                 title="Scale Width"
                               />
                               <button onClick={() => deleteAnnotation(ann.id)} title="Delete" style={{ background: 'red', border: 'none', color: '#fff', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px' }}>✕</button>
                             </div>
                          </div>
                        );
                      }

                      if (ann.type === 'whiteout') {
                        return (
                          <div 
                            key={ann.id}
                            onMouseDown={(e) => handleDragStart(ann.id, e)}
                            onClick={(e) => e.stopPropagation()} 
                            style={{
                              position: 'absolute',
                              left: `${ann.x}px`,
                              top: `${ann.y}px`,
                              width: `${ann.width}px`,
                              height: `${ann.height}px`,
                              transform: 'translateY(-100%)',
                              background: '#ffffff',
                              border: '1px dashed #999',
                              zIndex: 10,
                              cursor: 'move',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              padding: '2px'
                            }}
                          >
                             <div style={{ display: 'flex', gap: '3px' }}>
                               <input 
                                 type="number" 
                                 value={ann.width} 
                                 onChange={(e) => updateAnnotationSize(ann.id, e.target.value, ann.height)}
                                 style={{ width: '35px', fontSize: '9px' }} 
                               />
                               <input 
                                 type="number" 
                                 value={ann.height} 
                                 onChange={(e) => updateAnnotationSize(ann.id, ann.width, e.target.value)}
                                 style={{ width: '35px', fontSize: '9px' }} 
                               />
                               <button onClick={() => deleteAnnotation(ann.id)} title="Delete" style={{ background: 'red', border: 'none', color: '#fff', width: '15px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px' }}>✕</button>
                             </div>
                          </div>
                        );
                      }

                      if (ann.type === 'shape') {
                        return (
                          <div 
                            key={ann.id}
                            onMouseDown={(e) => handleDragStart(ann.id, e)}
                            onClick={(e) => e.stopPropagation()} 
                            style={{
                              position: 'absolute',
                              left: `${ann.x}px`,
                              top: `${ann.y}px`,
                              width: `${ann.width}px`,
                              height: `${ann.height}px`,
                              transform: 'translateY(-100%)',
                              background: ann.color,
                              opacity: 0.65,
                              border: '1px dashed #000',
                              zIndex: 10,
                              cursor: 'move',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              padding: '2px'
                            }}
                          >
                             <div style={{ display: 'flex', gap: '3px', background: '#fff', padding: '2px', borderRadius: '3px' }}>
                               <input 
                                 type="number" 
                                 value={ann.width} 
                                 onChange={(e) => updateAnnotationSize(ann.id, e.target.value, ann.height)}
                                 style={{ width: '35px', fontSize: '9px' }} 
                               />
                               <input 
                                 type="number" 
                                 value={ann.height} 
                                 onChange={(e) => updateAnnotationSize(ann.id, ann.width, e.target.value)}
                                 style={{ width: '35px', fontSize: '9px' }} 
                               />
                               <button onClick={() => deleteAnnotation(ann.id)} title="Delete" style={{ background: 'red', border: 'none', color: '#fff', width: '15px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px' }}>✕</button>
                             </div>
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                  
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
