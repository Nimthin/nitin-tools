'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { PDFDocument } from 'pdf-lib';

/* ==========================================================================
   PDF Compress — production version
   --------------------------------------------------------------------------
   Strategies
     • Lossless: pdf-lib re-save with object streams + metadata strip.
                 Text and links preserved. Savings: 0–20% (often 0).
     • Rasterize (High/Balanced/Maximum):
                 Render each page with pdfjs at a target DPI to an offscreen
                 canvas → JPEG-encode → rebuild a new PDF with those JPEGs
                 filling each page at the original page dimensions.
                 Text/links are NOT preserved. Savings: 40–95%.
     • Grayscale toggle (rasterize modes only): drops chrominance before
                 JPEG-encoding. Extra 20–40% on color documents.
   ========================================================================== */

const PRESETS = {
  lossless: {
    id: 'lossless', label: 'Lossless',
    blurb: 'Strips bloat. Keeps text, links, and form fields.',
    savings: '0–20%',
    rasterize: false,
  },
  high: {
    id: 'high', label: 'High Quality',
    blurb: '200 DPI / JPEG 85%. Visually identical, big savings.',
    savings: '40–70%',
    rasterize: true, dpi: 200, quality: 0.85,
  },
  balanced: {
    id: 'balanced', label: 'Balanced',
    blurb: '150 DPI / JPEG 70%. Best default for most documents.',
    savings: '70–85%',
    rasterize: true, dpi: 150, quality: 0.70,
  },
  maximum: {
    id: 'maximum', label: 'Maximum',
    blurb: '100 DPI / JPEG 50%. Smallest file. Good for email.',
    savings: '85–95%',
    rasterize: true, dpi: 100, quality: 0.50,
  },
};

const PDF_DPI = 72; // PDF native unit is 1/72 inch

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
};

// Convert canvas pixels to luminance grayscale in-place
const desaturateCanvas = (ctx, w, h) => {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    // Rec. 601 luma
    const y = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
    d[i] = d[i + 1] = d[i + 2] = y;
  }
  ctx.putImageData(img, 0, 0);
};

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))),
      type, quality
    );
  });

/* -------------------------------------------------------------------------- */
/*  FairyLights — success flourish                                            */
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
          key: `${row}-${i}`, color,
          side: row === 0 ? 'top' : 'bottom',
          rotation: row === 0 ? rotation : rotation + 180,
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
        <div key={l.key} className="fairy-light" style={{
          backgroundColor: l.color,
          [l.side]: '18px',
          left: `${l.left}%`,
          transform: l.side === 'top'
            ? `rotate(${l.rotation}deg)`
            : `rotate(${l.rotation}deg) rotateX(180deg)`,
          animationDelay: `${l.delay}s`,
          animationDuration: `${l.duration}s`,
          boxShadow: `0 0 12px ${l.color}, 0 0 4px ${l.color}`,
        }} />
      ))}
    </>
  );
};

/* ==========================================================================
   Main component
   ========================================================================== */

export default function CompressPdf() {
  const [file, setFile] = useState(null);
  const [originalSize, setOriginalSize] = useState(0);
  const [newSize, setNewSize] = useState(0);

  const [presetId, setPresetId] = useState('balanced');
  const [grayscale, setGrayscale] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);

  // Progress: { phase: 'load'|'render'|'save', current, total }
  const [progress, setProgress] = useState(null);

  // Result: { blob, url, size, biggerThanOriginal, lostFeatures }
  const [result, setResult] = useState(null);

  // pdfjs
  const [pdfjsLib, setPdfjsLib] = useState(null);

  const fileInputRef = useRef(null);
  const cancelRef = useRef(false);
  const renderTaskRef = useRef(null);
  const downloadUrlRef = useRef(null);

  const preset = PRESETS[presetId];

  /* ====================================================================== */
  /*  pdfjs load                                                             */
  /* ====================================================================== */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
        pdfjs.GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
        if (!cancelled) setPdfjsLib(pdfjs);
      } catch (err) {
        console.error('pdfjs load failed', err);
        if (!cancelled) setError('Failed to load PDF engine.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ====================================================================== */
  /*  Cleanup any object URL on unmount                                      */
  /* ====================================================================== */
  useEffect(() => () => {
    if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
  }, []);

  /* ====================================================================== */
  /*  File pick                                                              */
  /* ====================================================================== */
  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.type !== 'application/pdf') {
      setError('Please select a valid PDF file.');
      return;
    }
    setFile(selected);
    setOriginalSize(selected.size);
    setNewSize(0);
    setError(null);
    setIsComplete(false);
    setResult(null);
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = null;
    }
  };

  /* ====================================================================== */
  /*  Lossless path                                                          */
  /* ====================================================================== */
  const compressLossless = async (arrayBuffer) => {
    setProgress({ phase: 'save', current: 0, total: 1 });
    const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    // Strip metadata on the *source* doc — actually has effect
    try {
      srcDoc.setTitle('');
      srcDoc.setAuthor('');
      srcDoc.setSubject('');
      srcDoc.setKeywords([]);
      srcDoc.setProducer('');
      srcDoc.setCreator('');
    } catch {}
    const bytes = await srcDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });
    setProgress({ phase: 'save', current: 1, total: 1 });
    return { bytes, lostFeatures: false };
  };

  /* ====================================================================== */
  /*  Rasterize path                                                         */
  /* ====================================================================== */
  const compressRasterize = async (arrayBuffer, presetConf, useGrayscale) => {
    if (!pdfjsLib) throw new Error('PDF engine not ready');

    // pdf.js may detach the buffer; clone once.
    const bytes = new Uint8Array(arrayBuffer.slice(0));
    const srcDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
    const totalPages = srcDoc.numPages;

    // Build a fresh pdf-lib doc to receive rasterized pages
    const outDoc = await PDFDocument.create();
    outDoc.setTitle('');
    outDoc.setAuthor('');
    outDoc.setSubject('');
    outDoc.setKeywords([]);
    outDoc.setProducer('');
    outDoc.setCreator('');

    const scale = presetConf.dpi / PDF_DPI;

    for (let i = 1; i <= totalPages; i++) {
      if (cancelRef.current) throw new Error('cancelled');
      setProgress({ phase: 'render', current: i, total: totalPages });

      const page = await srcDoc.getPage(i);
      const baseVp = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale });

      // Render to offscreen canvas
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext('2d', { alpha: false });
      // White background — JPEG has no alpha
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const task = page.render({ canvasContext: ctx, viewport, background: 'white' });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch (err) {
        if (err?.name === 'RenderingCancelledException') throw new Error('cancelled');
        console.warn(`Failed to render page ${i}, using blank`, err);
      }

      if (useGrayscale) desaturateCanvas(ctx, canvas.width, canvas.height);

      const blob = await canvasToBlob(canvas, 'image/jpeg', presetConf.quality);
      const ab = await blob.arrayBuffer();
      const embedded = await outDoc.embedJpg(ab);

      const newPage = outDoc.addPage([baseVp.width, baseVp.height]);
      newPage.drawImage(embedded, {
        x: 0, y: 0, width: baseVp.width, height: baseVp.height,
      });

      // Free canvas
      canvas.width = 0; canvas.height = 0;
    }

    setProgress({ phase: 'save', current: 0, total: 1 });
    const outBytes = await outDoc.save({ useObjectStreams: true });
    setProgress({ phase: 'save', current: 1, total: 1 });

    try { srcDoc.destroy?.(); } catch {}
    return { bytes: outBytes, lostFeatures: true };
  };

  /* ====================================================================== */
  /*  Compress button                                                        */
  /* ====================================================================== */
  const handleCompress = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    cancelRef.current = false;
    setProgress({ phase: 'load', current: 0, total: 1 });

    try {
      const arrayBuffer = await file.arrayBuffer();
      if (cancelRef.current) throw new Error('cancelled');

      const { bytes, lostFeatures } = preset.rasterize
        ? await compressRasterize(arrayBuffer, preset, grayscale)
        : await compressLossless(arrayBuffer);

      if (cancelRef.current) throw new Error('cancelled');

      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = url;

      setNewSize(bytes.byteLength);
      setResult({
        url,
        size: bytes.byteLength,
        biggerThanOriginal: bytes.byteLength >= originalSize,
        lostFeatures,
      });
      setIsComplete(true);
    } catch (err) {
      if (err?.message === 'cancelled') {
        // user-initiated, no error toast
      } else {
        console.error(err);
        setError('Failed to compress PDF. The file may be corrupted or encrypted.');
      }
    } finally {
      setIsProcessing(false);
      setProgress(null);
      cancelRef.current = false;
    }
  };

  /* ====================================================================== */
  /*  Cancel                                                                 */
  /* ====================================================================== */
  const handleCancel = () => {
    cancelRef.current = true;
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
    }
  };

  /* ====================================================================== */
  /*  Reset                                                                  */
  /* ====================================================================== */
  const resetTool = () => {
    setFile(null);
    setIsComplete(false);
    setError(null);
    setNewSize(0);
    setOriginalSize(0);
    setResult(null);
    setProgress(null);
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = null;
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = () => {
    if (!result?.url || !file) return;
    const link = document.createElement('a');
    link.href = result.url;
    link.download = `${preset.id}_${file.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ====================================================================== */
  /*  Computed                                                               */
  /* ====================================================================== */
  const savedPct = originalSize > 0 && newSize > 0
    ? Math.round((1 - newSize / originalSize) * 1000) / 10
    : 0;

  /* ====================================================================== */
  /*  Render                                                                 */
  /* ====================================================================== */

  if (isComplete && result) {
    return (
      <div className="tool-page">
        <Link href="/tools/pdf" className="tool-page-back">← Back to PDF Toolkit</Link>
        <div className="tool-page-header">
          <h1>🗜️ Compress PDF</h1>
        </div>

        <div
          className="result-container"
          style={{
            position: 'relative', textAlign: 'center', padding: '60px 20px',
            background: '#2d1b4e', border: '4px solid #ff007f',
            boxShadow: '0 0 30px rgba(255, 0, 127, 0.4), inset 0 0 20px rgba(0,0,0,0.5)',
            marginTop: '20px',
          }}
        >
          <FairyLights />
          <div style={{ fontSize: '5rem', marginBottom: '20px', filter: 'drop-shadow(4px 4px 0px #000)' }}>
            {result.biggerThanOriginal ? '🤔' : '🎉'}
          </div>
          <h2 style={{
            fontFamily: 'var(--font-pixel)',
            color: result.biggerThanOriginal ? '#ff9800' : '#ffcc00',
            marginBottom: '20px', fontSize: '2rem', textShadow: '4px 4px 0px #000',
          }}>
            {result.biggerThanOriginal ? 'NO SAVINGS THIS TIME' : 'COMPRESSION DONE!'}
          </h2>

          {result.biggerThanOriginal && (
            <div style={{
              maxWidth: '500px', margin: '0 auto 20px',
              padding: '12px', background: 'rgba(255,152,0,0.15)',
              border: '2px dashed #ff9800', color: '#fff', fontSize: '0.9rem',
            }}>
              Your PDF is already well-optimized. Try a stronger preset, or keep the original.
            </div>
          )}

          {result.lostFeatures && !result.biggerThanOriginal && (
            <div style={{
              maxWidth: '500px', margin: '0 auto 20px',
              padding: '12px', background: 'rgba(0,188,212,0.12)',
              border: '2px dashed var(--pixel-cyan)', color: '#fff', fontSize: '0.85rem',
            }}>
              <strong>Heads up:</strong> rasterized pages lose selectable text, hyperlinks,
              and form fields. Use the <em>Lossless</em> preset if you need them preserved.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '30px' }}>
            <div style={{ background: '#2d1b4e', padding: '15px 30px', border: '2px dashed var(--pixel-cyan)' }}>
              <div style={{ color: '#fff', fontSize: '0.9rem', opacity: 0.8, marginBottom: '5px' }}>ORIGINAL</div>
              <div style={{
                color: '#ff3b30', fontSize: '1.4rem',
                textDecoration: result.biggerThanOriginal ? 'none' : 'line-through',
              }}>
                {formatFileSize(originalSize)}
              </div>
            </div>
            <div style={{ color: '#ffcc00', fontSize: '1.5rem' }}>↓</div>
            <div style={{
              background: '#2d1b4e', padding: '15px 30px',
              border: `3px solid ${result.biggerThanOriginal ? '#ff9800' : 'var(--pixel-green)'}`,
              boxShadow: `0 0 15px ${result.biggerThanOriginal ? 'rgba(255,152,0,0.4)' : 'rgba(52,199,89,0.4)'}`,
            }}>
              <div style={{ color: '#fff', fontSize: '0.9rem', opacity: 0.8, marginBottom: '5px' }}>NEW SIZE</div>
              <div style={{
                color: result.biggerThanOriginal ? '#ff9800' : 'var(--pixel-green)',
                fontSize: '1.8rem', fontWeight: 'bold',
              }}>
                {formatFileSize(newSize)}
              </div>
              {savedPct > 0 && (
                <div style={{
                  color: '#ffcc00', fontSize: '0.8rem', marginTop: '5px',
                  fontFamily: 'var(--font-pixel)',
                }}>
                  SAVED {savedPct.toFixed(1)}%
                </div>
              )}
              {savedPct < 0 && (
                <div style={{
                  color: '#ff9800', fontSize: '0.8rem', marginTop: '5px',
                  fontFamily: 'var(--font-pixel)',
                }}>
                  +{Math.abs(savedPct).toFixed(1)}% LARGER
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={resetTool} style={{ padding: '12px 24px', fontSize: '1rem' }}>
              Compress Another
            </button>
            <button
              className="btn btn-primary"
              onClick={handleDownload}
              style={{ padding: '12px 24px', fontSize: '1rem', background: 'var(--pixel-green)' }}
            >
              ⬇️ Download {result.biggerThanOriginal ? 'Anyway' : 'PDF'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tool-page">
      <Link href="/tools/pdf" className="tool-page-back">← Back to PDF Toolkit</Link>
      <div className="tool-page-header">
        <h1>🗜️ Compress PDF</h1>
        <p>Shrink your PDFs in the browser. Nothing leaves your computer.</p>
      </div>

      <div
        className="result-container"
        style={{ padding: '20px', background: 'var(--pixel-bg-card)', border: '3px solid var(--pixel-border)' }}
      >
        {error && <div className="error-message">⚠️ {error}</div>}

        {!file ? (
          <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
            <div className="upload-zone-icon">🗜️</div>
            <div className="upload-zone-text">Click or drag a PDF here to compress</div>
            <div className="upload-zone-hint">100% in-browser. Nothing is uploaded.</div>
            <input
              type="file" ref={fileInputRef} onChange={handleFileChange}
              accept="application/pdf" style={{ display: 'none' }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '20px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              fontSize: '1.1rem', color: 'var(--pixel-cyan)',
            }}>
              <span>📄</span>
              <strong>{file.name}</strong>
              <span style={{ color: '#aaa', fontSize: '0.9rem' }}>({formatFileSize(file.size)})</span>
            </div>

            {/* Preset cards */}
            <div style={{
              width: '100%', maxWidth: '700px',
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px',
            }}>
              {Object.values(PRESETS).map((p) => {
                const active = presetId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setPresetId(p.id)}
                    className={`btn ${active ? 'btn-selected' : 'btn-ghost'}`}
                    style={{
                      padding: '14px', textAlign: 'left', display: 'flex',
                      flexDirection: 'column', gap: '6px', alignItems: 'flex-start',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <div style={{
                      fontFamily: 'var(--font-pixel)', fontSize: '0.85rem',
                      color: active ? '#ffcc00' : '#fff',
                    }}>
                      {p.label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#bbb', lineHeight: 1.4 }}>
                      {p.blurb}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-pixel)', fontSize: '0.65rem',
                      color: 'var(--pixel-green)',
                    }}>
                      ~{p.savings} smaller
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Grayscale toggle (rasterize only) */}
            {preset.rasterize && (
              <label
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: '#2d1b4e', padding: '10px 18px',
                  border: '2px solid var(--pixel-border)', cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={grayscale}
                  disabled={isProcessing}
                  onChange={(e) => setGrayscale(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.75rem', color: '#fff' }}>
                  GRAYSCALE
                </span>
                <span style={{ fontSize: '0.75rem', color: '#bbb' }}>
                  Extra 20–40% savings on color documents
                </span>
              </label>
            )}

            {/* Trade-off notice for rasterize */}
            {preset.rasterize && (
              <div style={{
                maxWidth: '600px', textAlign: 'center', fontSize: '0.8rem',
                color: '#bbb', lineHeight: 1.5,
              }}>
                ⚠️ Rasterized presets render each page as an image. Selectable text,
                hyperlinks, and form fields will not be preserved. Pick <strong>Lossless</strong> to keep them.
              </div>
            )}

            {/* Progress */}
            {isProcessing && progress && (
              <ProgressBar progress={progress} />
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              {isProcessing ? (
                <button className="btn btn-danger" onClick={handleCancel}>
                  Cancel
                </button>
              ) : (
                <>
                  <button className="btn btn-ghost" onClick={resetTool}>
                    Change File
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleCompress}
                    disabled={!pdfjsLib && preset.rasterize}
                  >
                    {preset.rasterize && !pdfjsLib ? 'Loading engine…' : 'Compress PDF'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================================== */
/*  Progress bar                                                              */
/* ========================================================================== */

function ProgressBar({ progress }) {
  const { phase, current, total } = progress;
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const phaseLabel =
    phase === 'load'   ? 'Reading PDF…' :
    phase === 'render' ? `Compressing page ${current} / ${total}` :
    phase === 'save'   ? (current >= total ? 'Finalizing…' : 'Writing PDF…') :
    'Working…';

  return (
    <div style={{ width: '100%', maxWidth: '600px' }}>
      <div style={{
        fontFamily: 'var(--font-pixel)', fontSize: '0.7rem',
        color: '#fff', marginBottom: '6px', textAlign: 'center',
      }}>
        {phaseLabel} {phase === 'render' && total > 1 ? `(${pct}%)` : ''}
      </div>
      <div style={{
        width: '100%', height: '14px', background: '#1a1a1a',
        border: '2px solid var(--pixel-border)', overflow: 'hidden',
      }}>
        <div
          style={{
            width: `${pct}%`, height: '100%',
            background: 'linear-gradient(90deg, var(--pixel-green) 0%, var(--pixel-cyan) 100%)',
            transition: 'width 0.2s ease',
          }}
        />
      </div>
    </div>
  );
}
