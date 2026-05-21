'use client';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { PDFDocument, rgb, StandardFonts, PDFName, PDFString, PDFArray } from 'pdf-lib';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(m[1], 16) / 255,
    g: parseInt(m[2], 16) / 255,
    b: parseInt(m[3], 16) / 255,
  };
};

const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// Decode a data URL straight to bytes — avoids fetch() round-trip.
const dataUrlToBytes = (dataUrl) => {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const isBase64 = /;base64/i.test(meta);
  const binary = isBase64 ? atob(body) : decodeURIComponent(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/* -------------------------------------------------------------------------- */
/*  Fairy Lights (visual flourish on success screen)                          */
/* -------------------------------------------------------------------------- */

const FairyLights = () => {
  const lights = useMemo(() => {
    const colors = ['#ff3b30', '#00bcd4', '#34c759', '#ffcc00', '#ff007f'];
    const arr = [];
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 18; i++) {
        const color = colors[(i + row * 2) % colors.length];
        const rotation = -15 + Math.random() * 30;
        arr.push({
          key: `${row}-${i}`,
          color,
          rotation: row === 0 ? rotation : rotation + 180,
          side: row === 0 ? 'top' : 'bottom',
          left: 4 + i * 5.4,
          delay: Math.random() * 2,
          duration: 0.8 + Math.random(),
        });
      }
    }
    return arr;
  }, []);

  return (
    <>
      <div className="fairy-wire top" />
      <div className="fairy-wire bottom" />
      {lights.map((l) => (
        <div
          key={l.key}
          className="fairy-light"
          style={{
            backgroundColor: l.color,
            [l.side]: '18px',
            left: `${l.left}%`,
            transform: l.side === 'top'
              ? `rotate(${l.rotation}deg)`
              : `rotate(${l.rotation}deg) rotateX(180deg)`,
            animationDelay: `${l.delay}s`,
            animationDuration: `${l.duration}s`,
            boxShadow: `0 0 12px ${l.color}, 0 0 4px ${l.color}`,
          }}
        />
      ))}
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  Main editor                                                               */
/* -------------------------------------------------------------------------- */

export default function EditPdf() {
  const [file, setFile] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);

  // Visual editor state
  const [pdfjsLib, setPdfjsLib] = useState(null);
  const [pdfRenderDoc, setPdfRenderDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [annotations, setAnnotations] = useState([]);
  const [activeTool, setActiveTool] = useState('text');
  const [selectedColor, setSelectedColor] = useState('#ff0000');
  const [selectedFontSize, setSelectedFontSize] = useState(24);
  const [selectedFontFamily, setSelectedFontFamily] = useState('Helvetica');
  const [selectedId, setSelectedId] = useState(null);

  // Drag state held in a ref to avoid re-renders during pointer movement
  const dragRef = useRef({ id: null, offsetX: 0, offsetY: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const renderTaskRef = useRef(null);
  const downloadUrlRef = useRef(null);

  /* ------------------------------------------------------------------ */
  /*  Load pdfjs once, client-side                                       */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
        // Use https: explicitly — protocol-relative URLs break under some CSPs
        pdfjs.GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
        if (!cancelled) setPdfjsLib(pdfjs);
      } catch (err) {
        console.error('Failed to load pdfjs', err);
        if (!cancelled) setError('Failed to load the PDF viewer library.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Open the loaded PDF for rendering whenever data or pdfjs changes   */
  /*  (fixes race: user can upload before pdfjs finishes loading)        */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!pdfData || !pdfjsLib) return;
    let cancelled = false;
    let docRef = null;
    (async () => {
      try {
        // Clone bytes — pdf-lib will mutate the buffer on save otherwise.
        const bytes = new Uint8Array(pdfData.slice(0));
        const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (cancelled) {
          doc.destroy?.();
          return;
        }
        docRef = doc;
        setPdfRenderDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage((p) => clamp(p, 1, doc.numPages));
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Failed to load PDF for visual editing.');
      }
    })();
    return () => {
      cancelled = true;
      docRef?.destroy?.();
    };
  }, [pdfData, pdfjsLib]);

  /* ------------------------------------------------------------------ */
  /*  Render current page, cancelling any in-flight render               */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!pdfRenderDoc || !canvasRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        // Cancel any prior render so quick page changes don't race
        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel(); } catch {}
        }
        const page = await pdfRenderDoc.getPage(currentPage);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Render error', err);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [pdfRenderDoc, currentPage, scale]);

  /* ------------------------------------------------------------------ */
  /*  Revoke object URL on unmount / when replaced                       */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    return () => {
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Keyboard shortcuts                                                 */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const onKey = (e) => {
      if (!selectedId) return;
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setAnnotations((prev) => prev.filter((a) => a.id !== selectedId));
        setSelectedId(null);
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  /* ------------------------------------------------------------------ */
  /*  File loading                                                       */
  /* ------------------------------------------------------------------ */
  const handleFileChange = async (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.type !== 'application/pdf') {
      setError('Please select a valid PDF file.');
      return;
    }

    setFile(selected);
    setError(null);
    setIsComplete(false);
    setAnnotations([]);
    setSelectedId(null);
    setCurrentPage(1);
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = null;
      setDownloadUrl(null);
    }

    try {
      const arrayBuffer = await selected.arrayBuffer();
      setPdfData(arrayBuffer);
    } catch (err) {
      console.error(err);
      setError('Failed to read the PDF file.');
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Annotation CRUD (all functional updates — no stale closures)       */
  /* ------------------------------------------------------------------ */
  const addAnnotation = useCallback((ann) => {
    setAnnotations((prev) => [...prev, ann]);
    setSelectedId(ann.id);
  }, []);

  const updateAnnotationText = useCallback((id, newText) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, text: newText } : a))
    );
  }, []);

  const updateAnnotationSize = useCallback((id, width, height) => {
    setAnnotations((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              width: Math.max(8, toNum(width, a.width)),
              height: Math.max(8, toNum(height, a.height)),
            }
          : a
      )
    );
  }, []);

  const updateImageSizeKeepRatio = useCallback((id, newWidth) => {
    setAnnotations((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const w = Math.max(8, toNum(newWidth, a.width));
        const ratio = a.width > 0 ? a.height / a.width : 1;
        return { ...a, width: w, height: Math.max(8, w * ratio) };
      })
    );
  }, []);

  const deleteAnnotation = useCallback((id) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    setSelectedId((s) => (s === id ? null : s));
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Click on canvas overlay to create a new annotation                 */
  /* ------------------------------------------------------------------ */
  const handleOverlayClick = (e) => {
    if (e.target !== e.currentTarget) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = newId();
    const base = { id, pageIndex: currentPage, x, y };

    if (activeTool === 'text') {
      addAnnotation({
        ...base,
        type: 'text',
        text: '',
        color: selectedColor,
        fontSize: selectedFontSize,
        fontFamily: selectedFontFamily,
      });
    } else if (activeTool === 'link') {
      const url = window.prompt('Enter URL:', 'https://');
      if (!url) return;
      addAnnotation({ ...base, type: 'link', url, width: 120, height: 30 });
    } else if (activeTool === 'image') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png, image/jpeg';
      input.onchange = (event) => {
        const f = event.target.files?.[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = (re) => {
          addAnnotation({
            ...base,
            type: 'image',
            dataUrl: re.target.result,
            width: 150,
            height: 100,
          });
        };
        reader.onerror = () => setError('Failed to read image file.');
        reader.readAsDataURL(f);
      };
      input.click();
    } else if (activeTool === 'sign') {
      const name = window.prompt('Type your signature:', 'Your Name');
      if (!name) return;
      addAnnotation({
        ...base,
        type: 'text',
        text: name,
        color: '#09090b',
        fontSize: 32,
        fontFamily: 'TimesRoman',
      });
    } else if (activeTool === 'whiteout') {
      addAnnotation({ ...base, type: 'whiteout', width: 120, height: 30 });
    } else if (activeTool === 'shape') {
      addAnnotation({ ...base, type: 'shape', width: 120, height: 80, color: selectedColor });
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Drag                                                               */
  /* ------------------------------------------------------------------ */
  const handleDragStart = (id, e) => {
    if (['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    e.preventDefault();
    const ann = annotations.find((a) => a.id === id);
    if (!ann) return;
    const rect = canvasRef.current.getBoundingClientRect();
    dragRef.current = {
      id,
      offsetX: e.clientX - rect.left - ann.x,
      offsetY: e.clientY - rect.top - ann.y,
    };
    setIsDragging(true);
    setSelectedId(id);
  };

  const handleMouseMove = (e) => {
    const { id, offsetX, offsetY } = dragRef.current;
    if (!id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rawX = e.clientX - rect.left - offsetX;
    const rawY = e.clientY - rect.top - offsetY;

    setAnnotations((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const w = a.width || 0;
        const h = a.height || 0;
        return {
          ...a,
          x: clamp(rawX, 0, Math.max(0, rect.width - (w ? 0 : 0))),
          y: clamp(rawY, h, rect.height), // text/anns use translateY(-100%); keep within view
        };
      })
    );
  };

  const handleMouseUp = () => {
    if (dragRef.current.id) {
      dragRef.current = { id: null, offsetX: 0, offsetY: 0 };
      setIsDragging(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Save: stamp annotations onto a fresh PDFDocument                   */
  /* ------------------------------------------------------------------ */
  const handleSavePdf = async () => {
    if (!pdfData) return;
    setIsProcessing(true);
    setError(null);

    try {
      // Clone the buffer so we don't disturb the one pdfjs is using
      const pdfDoc = await PDFDocument.load(pdfData.slice(0));
      const pages = pdfDoc.getPages();

      // Embed only the fonts we actually use
      const usedFonts = new Set(
        annotations.filter((a) => a.type === 'text').map((a) => a.fontFamily || 'Helvetica')
      );
      const fonts = {};
      for (const name of usedFonts) {
        const std = StandardFonts[name] || StandardFonts.Helvetica;
        fonts[name] = await pdfDoc.embedFont(std);
      }
      if (!fonts.Helvetica) {
        fonts.Helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }

      for (const ann of annotations) {
        if (ann.pageIndex < 1 || ann.pageIndex > pages.length) continue;
        const targetPage = pages[ann.pageIndex - 1];

        const pdfX = ann.x / scale;
        const pdfYCanvas = ann.y / scale;
        const pageHeight = targetPage.getHeight();
        const pdfY = pageHeight - pdfYCanvas;

        if (ann.type === 'text') {
          const { r, g, b } = hexToRgb(ann.color);
          const font = fonts[ann.fontFamily] || fonts.Helvetica;
          const size = ann.fontSize / scale;
          targetPage.drawText(ann.text || ' ', {
            x: pdfX,
            y: pdfY - size,
            size,
            color: rgb(r, g, b),
            font,
          });
        } else if (ann.type === 'link') {
          const w = ann.width / scale;
          const h = ann.height / scale;
          const linkAnnot = pdfDoc.context.register(
            pdfDoc.context.obj({
              Type: 'Annot',
              Subtype: 'Link',
              Rect: [pdfX, pdfY - h, pdfX + w, pdfY],
              Border: [0, 0, 0],
              A: {
                Type: 'Action',
                S: 'URI',
                URI: PDFString.of(ann.url),
              },
            })
          );

          // Robustly merge with existing /Annots whether it's an array or a ref
          const existingRaw = targetPage.node.get(PDFName.of('Annots'));
          let merged;
          if (existingRaw) {
            const resolved = pdfDoc.context.lookup(existingRaw);
            if (resolved instanceof PDFArray) {
              merged = pdfDoc.context.newArray([...resolved.asArray(), linkAnnot]);
            } else {
              merged = pdfDoc.context.newArray([linkAnnot]);
            }
          } else {
            merged = pdfDoc.context.newArray([linkAnnot]);
          }
          targetPage.node.set(PDFName.of('Annots'), merged);
        } else if (ann.type === 'image') {
          const w = ann.width / scale;
          const h = ann.height / scale;
          const bytes = dataUrlToBytes(ann.dataUrl);
          const isPng = /^data:image\/png/i.test(ann.dataUrl);
          const embedded = isPng
            ? await pdfDoc.embedPng(bytes)
            : await pdfDoc.embedJpg(bytes);

          targetPage.drawImage(embedded, {
            x: pdfX,
            y: pdfY - h,
            width: w,
            height: h,
          });
        } else if (ann.type === 'whiteout') {
          const w = ann.width / scale;
          const h = ann.height / scale;
          targetPage.drawRectangle({
            x: pdfX,
            y: pdfY - h,
            width: w,
            height: h,
            color: rgb(1, 1, 1),
          });
        } else if (ann.type === 'shape') {
          const w = ann.width / scale;
          const h = ann.height / scale;
          const { r, g, b } = hexToRgb(ann.color);
          targetPage.drawRectangle({
            x: pdfX,
            y: pdfY - h,
            width: w,
            height: h,
            color: rgb(r, g, b),
          });
        }
      }

      const savedBytes = await pdfDoc.save();
      const blob = new Blob([savedBytes], { type: 'application/pdf' });

      // Revoke any previous URL before replacing
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
      const url = URL.createObjectURL(blob);
      downloadUrlRef.current = url;
      setDownloadUrl(url);
      setIsComplete(true);
    } catch (err) {
      console.error(err);
      setError('Failed to generate final PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Render — annotations of the current page                           */
  /* ------------------------------------------------------------------ */
  const visibleAnnotations = useMemo(
    () => annotations.filter((a) => a.pageIndex === currentPage),
    [annotations, currentPage]
  );

  const fontFamilyCss = (f) =>
    f === 'TimesRoman' ? '"Times New Roman", Times, serif'
    : f === 'Courier' ? 'Courier, monospace'
    : 'Arial, Helvetica, sans-serif';

  /* ------------------------------------------------------------------ */
  /*  UI                                                                 */
  /* ------------------------------------------------------------------ */
  return (
    <div className="tool-page" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Link href="/tools/pdf" className="tool-page-back" style={{ margin: '10px 20px' }}>
        ← Back to PDF Toolkit
      </Link>

      {isComplete ? (
        <div
          className="result-container"
          style={{
            margin: 'auto',
            maxWidth: '800px',
            position: 'relative',
            textAlign: 'center',
            padding: '60px 20px',
            background: '#2d1b4e',
            border: '4px solid #ff007f',
            boxShadow: '0 0 30px rgba(255, 0, 127, 0.4), inset 0 0 20px rgba(0,0,0,0.5)',
          }}
        >
          <FairyLights />
          <div style={{ fontSize: '5rem', marginBottom: '20px', filter: 'drop-shadow(4px 4px 0px #000)' }}>🎉</div>
          <h2
            style={{
              fontFamily: 'var(--font-pixel)',
              color: '#ffcc00',
              marginBottom: '20px',
              fontSize: '2rem',
              textShadow: '4px 4px 0px #000',
            }}
          >
            DOCUMENT SAVED!
          </h2>
          <div style={{ color: '#fff', marginBottom: '30px', fontSize: '1.2rem' }}>
            All visual annotations have been stamped successfully.
          </div>

          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-ghost"
              onClick={() => setIsComplete(false)}
              style={{ padding: '12px 24px', fontSize: '1rem' }}
            >
              Continue Editing
            </button>
            <a
              href={downloadUrl}
              download={`edited_${file?.name || 'document.pdf'}`}
              className="btn btn-primary"
              style={{
                padding: '12px 24px',
                fontSize: '1rem',
                background: 'var(--pixel-green)',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              ⬇️ Download PDF
            </a>
          </div>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--pixel-bg-card)',
            borderTop: '3px solid var(--pixel-border)',
          }}
        >
          {error && (
            <div
              style={{
                background: '#f44336',
                color: '#fff',
                padding: '10px',
                textAlign: 'center',
                fontFamily: 'var(--font-pixel)',
                fontSize: '0.8rem',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {!file ? (
            <div style={{ padding: '40px 20px', margin: 'auto' }}>
              <div
                className="upload-zone"
                onClick={() => fileInputRef.current?.click()}
                style={{ background: '#2d1b4e' }}
              >
                <div className="upload-zone-icon">🖍️</div>
                <div className="upload-zone-text">Click or drag a PDF here to visually edit</div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="application/pdf"
                  style={{ display: 'none' }}
                />
              </div>
              {!pdfjsLib && (
                <div
                  style={{
                    marginTop: '12px',
                    textAlign: 'center',
                    color: '#aaa',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-pixel)',
                  }}
                >
                  Loading PDF engine…
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Toolbar */}
              <div
                style={{
                  background: '#2d1b4e',
                  borderBottom: '3px solid var(--pixel-border)',
                  padding: '10px 20px',
                  display: 'flex',
                  gap: '15px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  zIndex: 10,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: '5px',
                    borderRight: '2px solid rgba(255,255,255,0.2)',
                    paddingRight: '15px',
                  }}
                >
                  {[
                    { id: 'text', label: '[T] Text', title: 'Add text to document' },
                    { id: 'link', label: '🔗 Links', title: 'Add clickable link' },
                    { id: 'image', label: '🖼️ Images', title: 'Stamp image' },
                    { id: 'sign', label: '✍️ Sign', title: 'Place signature' },
                    { id: 'whiteout', label: '⬜ Whiteout', title: 'Mask sections with white rectangle' },
                    { id: 'shape', label: '🔺 Shapes', title: 'Draw rectangular color shapes' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      className={`btn ${activeTool === t.id ? 'btn-selected' : 'btn-ghost'}`}
                      onClick={() => setActiveTool(t.id)}
                      style={{ padding: '8px 12px', fontSize: '0.8rem' }}
                      title={t.title}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    style={{ width: '30px', height: '30px', cursor: 'pointer', border: '2px solid var(--pixel-border)' }}
                    title="Text/Shape Color"
                  />

                  {activeTool === 'text' && (
                    <>
                      <select
                        value={selectedFontFamily}
                        onChange={(e) => setSelectedFontFamily(e.target.value)}
                        style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.7rem', padding: '5px' }}
                        title="Font Style"
                      >
                        <option value="Helvetica">Helvetica</option>
                        <option value="TimesRoman">Times Roman</option>
                        <option value="Courier">Courier (Mono)</option>
                      </select>

                      <select
                        value={selectedFontSize}
                        onChange={(e) => setSelectedFontSize(Number(e.target.value))}
                        style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.7rem', padding: '5px' }}
                        title="Font Size"
                      >
                        {[12, 16, 24, 32, 48, 72].map((s) => (
                          <option key={s} value={s}>{s}px</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>

                <div style={{ flex: 1 }} />

                <div
                  style={{
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center',
                    borderRight: '2px solid rgba(255,255,255,0.2)',
                    paddingRight: '15px',
                  }}
                >
                  <button
                    className="btn btn-ghost"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={{ padding: '5px 10px' }}
                  >
                    ◀
                  </button>
                  <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.7rem', color: '#fff' }}>
                    PAGE {currentPage} / {totalPages}
                  </span>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    style={{ padding: '5px 10px' }}
                  >
                    ▶
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center',
                    borderRight: '2px solid rgba(255,255,255,0.2)',
                    paddingRight: '15px',
                  }}
                >
                  <button
                    className="btn btn-ghost"
                    onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(2)))}
                    style={{ padding: '5px 10px' }}
                  >
                    -
                  </button>
                  <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.7rem', color: '#fff' }}>
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(2)))}
                    style={{ padding: '5px 10px' }}
                  >
                    +
                  </button>
                </div>

                <div style={{ marginLeft: '10px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleSavePdf}
                    disabled={isProcessing || !pdfData}
                    style={{ padding: '8px 16px', fontSize: '0.8rem', background: 'var(--pixel-green)' }}
                  >
                    {isProcessing ? 'SAVING...' : '💾 SAVE PDF'}
                  </button>
                </div>
              </div>

              {/* Canvas area */}
              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  background: '#111',
                  padding: '40px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ position: 'relative', boxShadow: '0 0 20px rgba(0,0,0,0.8)' }}>
                  <canvas ref={canvasRef} style={{ display: 'block', background: '#fff' }} />

                  <div
                    onClick={handleOverlayClick}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      cursor: activeTool === 'text' ? 'text' : 'crosshair',
                      zIndex: 5,
                    }}
                  >
                    {visibleAnnotations.map((ann) => {
                      const commonWrap = {
                        position: 'absolute',
                        left: `${ann.x}px`,
                        top: `${ann.y}px`,
                        transform: 'translateY(-100%)',
                        zIndex: 10,
                        cursor: 'move',
                      };
                      const isActive = selectedId === ann.id;

                      if (ann.type === 'text') {
                        return (
                          <div
                            key={ann.id}
                            onMouseDown={(e) => handleDragStart(ann.id, e)}
                            onClick={(e) => { e.stopPropagation(); setSelectedId(ann.id); }}
                            style={{
                              ...commonWrap,
                              display: 'flex',
                              alignItems: 'center',
                              background: isActive ? 'rgba(0,120,255,0.1)' : 'transparent',
                              border: isActive ? '1px dashed #0070f3' : 'none',
                            }}
                          >
                            <input
                              autoFocus
                              value={ann.text}
                              placeholder="Type text..."
                              onChange={(e) => updateAnnotationText(ann.id, e.target.value)}
                              onFocus={() => setSelectedId(ann.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                borderBottom: '1px dashed rgba(0,120,255,0.4)',
                                color: ann.color,
                                fontSize: `${ann.fontSize}px`,
                                fontFamily: fontFamilyCss(ann.fontFamily),
                                padding: 0,
                                outline: 'none',
                                minWidth: '60px',
                                width: `${Math.max(60, (ann.text || '').length * (ann.fontSize * 0.55))}px`,
                              }}
                            />
                            <button
                              onClick={() => deleteAnnotation(ann.id)}
                              title="Delete"
                              style={deleteBtnStyle}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      }

                      if (ann.type === 'link') {
                        return (
                          <div
                            key={ann.id}
                            onMouseDown={(e) => handleDragStart(ann.id, e)}
                            onClick={(e) => { e.stopPropagation(); setSelectedId(ann.id); }}
                            style={{
                              ...commonWrap,
                              width: `${ann.width}px`,
                              height: `${ann.height}px`,
                              background: 'rgba(0, 120, 255, 0.25)',
                              border: '2px dashed #0070f3',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '2px 5px',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '10px',
                                color: '#0070f3',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                maxWidth: '80%',
                              }}
                            >
                              🔗 {ann.url}
                            </span>
                            <div style={{ display: 'flex', gap: '3px' }}>
                              <input
                                type="number"
                                min={8}
                                value={ann.width}
                                onChange={(e) => updateAnnotationSize(ann.id, e.target.value, ann.height)}
                                style={smallNumInput}
                                title="Width"
                              />
                              <button onClick={() => deleteAnnotation(ann.id)} title="Delete" style={smallDeleteBtn}>
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (ann.type === 'image') {
                        return (
                          <div
                            key={ann.id}
                            onMouseDown={(e) => handleDragStart(ann.id, e)}
                            onClick={(e) => { e.stopPropagation(); setSelectedId(ann.id); }}
                            style={{
                              ...commonWrap,
                              width: `${ann.width}px`,
                              height: `${ann.height}px`,
                              border: '1px dashed #000',
                            }}
                          >
                            <img
                              src={ann.dataUrl}
                              alt=""
                              draggable={false}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                background: 'rgba(255,255,255,0.7)',
                                pointerEvents: 'none',
                              }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                top: '-25px',
                                right: 0,
                                display: 'flex',
                                gap: '3px',
                                background: '#fff',
                                padding: '2px',
                                border: '1px solid #ccc',
                                borderRadius: '3px',
                              }}
                            >
                              <input
                                type="number"
                                min={8}
                                value={ann.width}
                                onChange={(e) => updateImageSizeKeepRatio(ann.id, e.target.value)}
                                style={{ width: '40px', fontSize: '10px' }}
                                title="Scale Width (keeps aspect ratio)"
                              />
                              <button onClick={() => deleteAnnotation(ann.id)} title="Delete" style={smallDeleteBtn}>
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (ann.type === 'whiteout') {
                        return (
                          <div
                            key={ann.id}
                            onMouseDown={(e) => handleDragStart(ann.id, e)}
                            onClick={(e) => { e.stopPropagation(); setSelectedId(ann.id); }}
                            style={{
                              ...commonWrap,
                              width: `${ann.width}px`,
                              height: `${ann.height}px`,
                              background: '#ffffff',
                              border: '1px dashed #999',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              padding: '2px',
                            }}
                          >
                            <div style={{ display: 'flex', gap: '3px' }}>
                              <input
                                type="number"
                                min={8}
                                value={ann.width}
                                onChange={(e) => updateAnnotationSize(ann.id, e.target.value, ann.height)}
                                style={smallNumInput}
                              />
                              <input
                                type="number"
                                min={8}
                                value={ann.height}
                                onChange={(e) => updateAnnotationSize(ann.id, ann.width, e.target.value)}
                                style={smallNumInput}
                              />
                              <button onClick={() => deleteAnnotation(ann.id)} title="Delete" style={smallDeleteBtn}>
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (ann.type === 'shape') {
                        return (
                          <div
                            key={ann.id}
                            onMouseDown={(e) => handleDragStart(ann.id, e)}
                            onClick={(e) => { e.stopPropagation(); setSelectedId(ann.id); }}
                            style={{
                              ...commonWrap,
                              width: `${ann.width}px`,
                              height: `${ann.height}px`,
                              background: ann.color,
                              opacity: 0.65,
                              border: '1px dashed #000',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              padding: '2px',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                gap: '3px',
                                background: '#fff',
                                padding: '2px',
                                borderRadius: '3px',
                              }}
                            >
                              <input
                                type="number"
                                min={8}
                                value={ann.width}
                                onChange={(e) => updateAnnotationSize(ann.id, e.target.value, ann.height)}
                                style={smallNumInput}
                              />
                              <input
                                type="number"
                                min={8}
                                value={ann.height}
                                onChange={(e) => updateAnnotationSize(ann.id, ann.width, e.target.value)}
                                style={smallNumInput}
                              />
                              <button onClick={() => deleteAnnotation(ann.id)} title="Delete" style={smallDeleteBtn}>
                                ✕
                              </button>
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

/* -------------------------------------------------------------------------- */
/*  Small style helpers (kept inline so this remains a single-file drop-in)   */
/* -------------------------------------------------------------------------- */

const deleteBtnStyle = {
  background: 'rgba(255,0,0,0.1)',
  border: 'none',
  borderRadius: '50%',
  color: '#ff4444',
  width: '20px',
  height: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  marginLeft: '5px',
  fontSize: '12px',
};

const smallDeleteBtn = {
  background: 'red',
  border: 'none',
  color: '#fff',
  width: '15px',
  height: '15px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: '10px',
};

const smallNumInput = {
  width: '35px',
  fontSize: '9px',
  background: '#fff',
  border: '1px solid #ccc',
};
