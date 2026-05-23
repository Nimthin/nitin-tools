'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { PDFDocument } from 'pdf-lib';
import './compress.css';

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

        <div className="result-container compress-card success-card">
          <FairyLights />
          <div style={{ fontSize: '5rem', marginBottom: '20px' }}>
            {result.biggerThanOriginal ? '🤔' : '🎉'}
          </div>
          <h2 className={`success-card-title ${result.biggerThanOriginal ? 'no-savings' : 'success'}`}>
            {result.biggerThanOriginal ? 'NO SAVINGS THIS TIME' : 'COMPRESSION DONE!'}
          </h2>

          {result.biggerThanOriginal && (
            <div className="success-notice no-savings">
              Your PDF is already well-optimized. Try a stronger preset, or keep the original.
            </div>
          )}


          <div className="size-comparison-container">
            <div className="size-box original-size">
              <div className="size-box-title">ORIGINAL</div>
              <div className="size-box-value" style={{ textDecoration: result.biggerThanOriginal ? 'none' : 'line-through' }}>
                {formatFileSize(originalSize)}
              </div>
            </div>
            
            <div className="size-arrow">↓</div>
            
            <div className={`size-box new-size ${result.biggerThanOriginal ? 'larger' : ''}`}>
              <div className="size-box-title">NEW SIZE</div>
              <div className="size-box-value">
                {formatFileSize(newSize)}
              </div>
              {savedPct > 0 && (
                <div className="savings-label">
                  SAVED {savedPct.toFixed(1)}%
                </div>
              )}
              {savedPct < 0 && (
                <div className="savings-label larger">
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
              style={{ padding: '12px 24px', fontSize: '1rem' }}
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

      <div className="result-container compress-card">
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
            
            <div className="compress-file-details">
              <span className="file-icon">📄</span>
              <div className="file-meta">
                <span className="file-name">{file.name}</span>
                <span className="file-size">({formatFileSize(file.size)})</span>
              </div>
            </div>

            {/* Preset cards */}
            <div className="preset-grid">
              {Object.values(PRESETS).map((p) => {
                const active = presetId === p.id;
                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => !isProcessing && setPresetId(p.id)}
                    onKeyDown={(e) => {
                      if (!isProcessing && (e.key === 'Enter' || e.key === ' ')) {
                        setPresetId(p.id);
                      }
                    }}
                    className={`preset-card ${active ? 'active' : ''} ${isProcessing ? 'disabled' : ''}`}
                  >
                    <div className="preset-label">
                      {p.label}
                    </div>
                    <div className="preset-blurb">
                      {p.blurb}
                    </div>
                    <div className="preset-savings">
                      ~{p.savings} smaller
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Grayscale toggle (rasterize only) */}
            {preset.rasterize && (
              <label className="grayscale-toggle-label">
                <input
                  type="checkbox"
                  checked={grayscale}
                  disabled={isProcessing}
                  onChange={(e) => setGrayscale(e.target.checked)}
                  className="grayscale-checkbox"
                />
                <span className="grayscale-text-label">
                  GRAYSCALE
                </span>
                <span className="grayscale-hint">
                  Extra 20–40% savings on color documents
                </span>
              </label>
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
    <div className="compress-progress-container">
      <div className="progress-label">
        {phaseLabel} {phase === 'render' && total > 1 ? `(${pct}%)` : ''}
      </div>
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
