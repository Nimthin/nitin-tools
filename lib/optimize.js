'use client';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';

/* ==========================================================================
   Image Optimize — Compress + Resize in one tool
   --------------------------------------------------------------------------
   • Resize via exact pixels, percent, or social-media presets
   • Aspect-ratio lock
   • Re-encode to JPG / PNG / WebP with quality slider
   • Live preview with debounced re-render
   • Before/after comparison
   • Fully client-side (Canvas API)
   ========================================================================== */

const SOCIAL_PRESETS = [
  { id: 'ig-post',     label: 'Instagram Post',      w: 1080, h: 1080 },
  { id: 'ig-portrait', label: 'Instagram Portrait',  w: 1080, h: 1350 },
  { id: 'ig-story',    label: 'Instagram Story',     w: 1080, h: 1920 },
  { id: 'yt-thumb',    label: 'YouTube Thumbnail',   w: 1280, h: 720 },
  { id: 'yt-banner',   label: 'YouTube Banner',      w: 2560, h: 1440 },
  { id: 'tw-header',   label: 'Twitter Header',      w: 1500, h: 500 },
  { id: 'tw-post',     label: 'Twitter Post',        w: 1200, h: 675 },
  { id: 'fb-cover',    label: 'Facebook Cover',      w: 851,  h: 315 },
  { id: 'li-banner',   label: 'LinkedIn Banner',     w: 1584, h: 396 },
  { id: 'wa-status',   label: 'WhatsApp Status',     w: 1080, h: 1920 },
];

const FORMATS = [
  { id: 'image/jpeg', label: 'JPG',  ext: 'jpg',  hasQuality: true,  hasAlpha: false },
  { id: 'image/png',  label: 'PNG',  ext: 'png',  hasQuality: false, hasAlpha: true  },
  { id: 'image/webp', label: 'WebP', ext: 'webp', hasQuality: true,  hasAlpha: true  },
];

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
};

/* ==========================================================================
   Component
   ========================================================================== */

export default function ImageOptimize() {
  const [file, setFile] = useState(null);
  const [origURL, setOrigURL] = useState(null);
  const [origDims, setOrigDims] = useState({ w: 0, h: 0 });
  const [error, setError] = useState(null);

  // Image bitmap kept in a ref to avoid re-renders
  const imgRef = useRef(null);

  // Resize mode
  const [resizeMode, setResizeMode] = useState('percent');   // 'percent' | 'pixels' | 'preset' | 'maxside'
  const [percent, setPercent]       = useState(80);
  const [pxW, setPxW]               = useState(0);
  const [pxH, setPxH]               = useState(0);
  const [maxSide, setMaxSide]       = useState(1920);
  const [aspectLock, setAspectLock] = useState(true);
  const [presetId, setPresetId]     = useState('ig-post');
  const [presetFit, setPresetFit]   = useState('cover');     // 'cover' | 'contain'

  // Output options
  const [format, setFormat]   = useState('image/jpeg');
  const [quality, setQuality] = useState(0.85);

  // Output state
  const [outBlob, setOutBlob] = useState(null);
  const [outURL, setOutURL]   = useState(null);
  const [outDims, setOutDims] = useState({ w: 0, h: 0 });
  const [processing, setProcessing] = useState(false);

  const fileInputRef = useRef(null);
  const debounceRef  = useRef(null);
  const outURLRef    = useRef(null);

  const formatMeta = FORMATS.find((f) => f.id === format) || FORMATS[0];

  /* ====================================================================== */
  /*  Load file                                                              */
  /* ====================================================================== */
  const handleFile = async (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setError(null);
    setFile(f);

    // Free previous URLs
    if (origURL) URL.revokeObjectURL(origURL);
    if (outURLRef.current) { URL.revokeObjectURL(outURLRef.current); outURLRef.current = null; }
    setOutURL(null);
    setOutBlob(null);

    const url = URL.createObjectURL(f);
    setOrigURL(url);

    // Decode to ImageBitmap for fast canvas drawing
    try {
      let bitmap;
      if ('createImageBitmap' in window) {
        bitmap = await createImageBitmap(f);
      } else {
        // Fallback
        bitmap = await new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = url;
        });
      }
      imgRef.current = bitmap;
      const w = bitmap.width;
      const h = bitmap.height;
      setOrigDims({ w, h });
      setPxW(w);
      setPxH(h);
    } catch (err) {
      setError('Failed to decode image.');
      console.error(err);
    }
  };

  const handleFileChange = (e) => handleFile(e.target.files?.[0]);

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleFile(e.dataTransfer.files?.[0]);
  };

  /* ====================================================================== */
  /*  Compute target dimensions                                              */
  /* ====================================================================== */
  const targetDims = useMemo(() => {
    if (!origDims.w || !origDims.h) return { w: 0, h: 0 };
    const ratio = origDims.w / origDims.h;

    if (resizeMode === 'percent') {
      const p = Math.max(1, Math.min(400, percent)) / 100;
      return { w: Math.round(origDims.w * p), h: Math.round(origDims.h * p) };
    }
    if (resizeMode === 'pixels') {
      return { w: Math.max(1, pxW), h: Math.max(1, pxH) };
    }
    if (resizeMode === 'maxside') {
      const limit = Math.max(16, maxSide);
      if (origDims.w <= limit && origDims.h <= limit) return { w: origDims.w, h: origDims.h };
      if (origDims.w >= origDims.h) {
        return { w: limit, h: Math.round(limit / ratio) };
      }
      return { w: Math.round(limit * ratio), h: limit };
    }
    if (resizeMode === 'preset') {
      const p = SOCIAL_PRESETS.find((x) => x.id === presetId) || SOCIAL_PRESETS[0];
      return { w: p.w, h: p.h };
    }
    return origDims;
  }, [resizeMode, percent, pxW, pxH, maxSide, presetId, origDims]);

  /* ====================================================================== */
  /*  Render                                                                 */
  /* ====================================================================== */
  const render = useCallback(async () => {
    const img = imgRef.current;
    if (!img || !targetDims.w || !targetDims.h) return;
    setProcessing(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = targetDims.w;
      canvas.height = targetDims.h;
      const ctx = canvas.getContext('2d', { alpha: formatMeta.hasAlpha });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // For JPEG, paint background white so transparent pixels become white
      if (!formatMeta.hasAlpha) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      if (resizeMode === 'preset') {
        // Fit image into preset box using cover/contain
        const srcRatio = img.width / img.height;
        const dstRatio = canvas.width / canvas.height;
        let dw, dh, dx, dy;
        if (presetFit === 'cover') {
          if (srcRatio > dstRatio) {
            dh = canvas.height; dw = dh * srcRatio;
          } else {
            dw = canvas.width;  dh = dw / srcRatio;
          }
          dx = (canvas.width - dw) / 2;
          dy = (canvas.height - dh) / 2;
        } else { // contain
          if (srcRatio > dstRatio) {
            dw = canvas.width;  dh = dw / srcRatio;
          } else {
            dh = canvas.height; dw = dh * srcRatio;
          }
          dx = (canvas.width - dw) / 2;
          dy = (canvas.height - dh) / 2;
        }
        ctx.drawImage(img, dx, dy, dw, dh);
      } else {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      const blob = await new Promise((res, rej) =>
        canvas.toBlob(
          (b) => (b ? res(b) : rej(new Error('encode failed'))),
          format,
          formatMeta.hasQuality ? quality : undefined
        )
      );

      if (outURLRef.current) URL.revokeObjectURL(outURLRef.current);
      const url = URL.createObjectURL(blob);
      outURLRef.current = url;
      setOutBlob(blob);
      setOutURL(url);
      setOutDims({ w: canvas.width, h: canvas.height });

      // Release canvas memory
      canvas.width = 0; canvas.height = 0;
    } catch (err) {
      console.error(err);
      setError('Failed to encode image.');
    } finally {
      setProcessing(false);
    }
  }, [targetDims, format, quality, formatMeta.hasAlpha, formatMeta.hasQuality, resizeMode, presetFit]);

  // Debounce render when any control changes
  useEffect(() => {
    if (!imgRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(render, 120);
    return () => clearTimeout(debounceRef.current);
  }, [render]);

  // Cleanup URLs on unmount
  useEffect(() => () => {
    if (origURL) URL.revokeObjectURL(origURL);
    if (outURLRef.current) URL.revokeObjectURL(outURLRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ====================================================================== */
  /*  Pixels mode — aspect-ratio enforcement                                 */
  /* ====================================================================== */
  const setPxWidthLinked = (v) => {
    const w = Math.max(1, Math.round(v));
    setPxW(w);
    if (aspectLock && origDims.w) {
      setPxH(Math.max(1, Math.round((w / origDims.w) * origDims.h)));
    }
  };
  const setPxHeightLinked = (v) => {
    const h = Math.max(1, Math.round(v));
    setPxH(h);
    if (aspectLock && origDims.h) {
      setPxW(Math.max(1, Math.round((h / origDims.h) * origDims.w)));
    }
  };

  /* ====================================================================== */
  /*  Reset                                                                  */
  /* ====================================================================== */
  const resetTool = () => {
    if (origURL) URL.revokeObjectURL(origURL);
    if (outURLRef.current) URL.revokeObjectURL(outURLRef.current);
    outURLRef.current = null;
    imgRef.current = null;
    setFile(null);
    setOrigURL(null);
    setOutURL(null);
    setOutBlob(null);
    setError(null);
    setOrigDims({ w: 0, h: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ====================================================================== */
  /*  Derived                                                                */
  /* ====================================================================== */
  const savedBytes = file && outBlob ? file.size - outBlob.size : 0;
  const savedPct = file && outBlob ? Math.round((1 - outBlob.size / file.size) * 1000) / 10 : 0;
  const downloadName = file
    ? `${file.name.replace(/\.[^.]+$/, '')}_optimized.${formatMeta.ext}`
    : `image_optimized.${formatMeta.ext}`;

  /* ====================================================================== */
  /*  Render                                                                 */
  /* ====================================================================== */
  return (
    <div className="tool-page">
      <Link href="/tools/image" className="tool-page-back">← Back to Image Toolkit</Link>
      <div className="tool-page-header">
        <h1>🪄 Compress & Resize</h1>
        <p>Shrink, resize, and convert images in your browser. Nothing uploaded.</p>
      </div>

      <div className="result-container" style={{ padding: 20, background: 'var(--pixel-bg-card)', border: '3px solid var(--pixel-border)' }}>
        {error && <div className="error-message" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

        {!file ? (
          <div
            className="upload-zone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            <div className="upload-zone-icon">🪄</div>
            <div className="upload-zone-text">Click or drag an image here</div>
            <div className="upload-zone-hint">JPG · PNG · WebP · GIF · BMP — runs in your browser</div>
            <input
              type="file" ref={fileInputRef} onChange={handleFileChange}
              accept="image/*" style={{ display: 'none' }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* File header */}
            <div style={fileHeaderStyle}>
              <span style={{ fontSize: '1.3rem' }}>🖼️</span>
              <strong style={{ color: 'var(--pixel-cyan)' }}>{file.name}</strong>
              <span style={{ color: '#aaa', fontSize: '0.85rem' }}>
                · {origDims.w}×{origDims.h} · {formatFileSize(file.size)}
              </span>
              <div style={{ flex: 1 }} />
              <button className="btn btn-ghost" onClick={resetTool}
                style={{ padding: '6px 12px', fontSize: '0.7rem' }}>
                Change Image
              </button>
            </div>

            {/* Comparison */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
            }}>
              <PreviewBox
                label="Original"
                url={origURL}
                size={file.size}
                dims={origDims}
                color="#ff3b30"
              />
              <PreviewBox
                label="Optimized"
                url={outURL}
                size={outBlob?.size || 0}
                dims={outDims}
                color="var(--pixel-green)"
                badge={
                  outBlob ? (
                    savedPct > 0
                      ? <span style={{ color: 'var(--pixel-green)' }}>
                          ↓ {savedPct.toFixed(1)}% ({formatFileSize(Math.abs(savedBytes))})
                        </span>
                      : savedPct < 0
                      ? <span style={{ color: '#ff9800' }}>↑ {Math.abs(savedPct).toFixed(1)}% larger</span>
                      : <span style={{ color: '#bbb' }}>same size</span>
                  ) : null
                }
                processing={processing}
              />
            </div>

            {/* Controls */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
            }}>
              {/* Resize panel */}
              <Panel title="RESIZE">
                <ModeTabs
                  value={resizeMode}
                  onChange={setResizeMode}
                  options={[
                    { id: 'percent',  label: 'Scale %' },
                    { id: 'pixels',   label: 'Pixels' },
                    { id: 'maxside',  label: 'Max Side' },
                    { id: 'preset',   label: 'Preset' },
                  ]}
                />

                {resizeMode === 'percent' && (
                  <div>
                    <Slider
                      label={`${percent}%`}
                      min={1} max={200} step={1} value={percent}
                      onChange={(v) => setPercent(v)}
                    />
                    <div style={hintStyle}>→ {targetDims.w} × {targetDims.h}</div>
                  </div>
                )}

                {resizeMode === 'pixels' && (
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Field label="W"
                        value={pxW}
                        onChange={(v) => setPxWidthLinked(v)}
                        suffix="px"
                      />
                      <button
                        onClick={() => setAspectLock(!aspectLock)}
                        title={aspectLock ? 'Aspect locked' : 'Aspect unlocked'}
                        style={{
                          background: aspectLock ? 'var(--pixel-yellow)' : '#333',
                          color: aspectLock ? '#000' : '#999',
                          border: '2px solid #000', cursor: 'pointer',
                          padding: '6px 8px', fontSize: '0.7rem',
                          fontFamily: 'var(--font-pixel)',
                        }}
                      >
                        {aspectLock ? '🔒' : '🔓'}
                      </button>
                      <Field label="H"
                        value={pxH}
                        onChange={(v) => setPxHeightLinked(v)}
                        suffix="px"
                      />
                    </div>
                  </div>
                )}

                {resizeMode === 'maxside' && (
                  <div>
                    <Slider
                      label={`${maxSide}px`}
                      min={64} max={4096} step={16} value={maxSide}
                      onChange={(v) => setMaxSide(v)}
                    />
                    <div style={hintStyle}>→ {targetDims.w} × {targetDims.h}</div>
                  </div>
                )}

                {resizeMode === 'preset' && (
                  <div>
                    <select
                      value={presetId}
                      onChange={(e) => setPresetId(e.target.value)}
                      style={selectStyle}
                    >
                      {SOCIAL_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label} · {p.w}×{p.h}
                        </option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        className={`btn ${presetFit === 'cover' ? 'btn-selected' : 'btn-ghost'}`}
                        onClick={() => setPresetFit('cover')}
                        style={{ flex: 1, padding: '8px', fontSize: '0.7rem' }}
                      >Cover (crop)</button>
                      <button
                        className={`btn ${presetFit === 'contain' ? 'btn-selected' : 'btn-ghost'}`}
                        onClick={() => setPresetFit('contain')}
                        style={{ flex: 1, padding: '8px', fontSize: '0.7rem' }}
                      >Contain (fit)</button>
                    </div>
                  </div>
                )}
              </Panel>

              {/* Output panel */}
              <Panel title="OUTPUT">
                <div style={labelStyle}>FORMAT</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {FORMATS.map((f) => (
                    <button
                      key={f.id}
                      className={`btn ${format === f.id ? 'btn-selected' : 'btn-ghost'}`}
                      onClick={() => setFormat(f.id)}
                      style={{ flex: 1, padding: '8px', fontSize: '0.75rem' }}
                    >{f.label}</button>
                  ))}
                </div>

                {formatMeta.hasQuality ? (
                  <div style={{ marginTop: 12 }}>
                    <Slider
                      label={`Quality ${Math.round(quality * 100)}%`}
                      min={1} max={100} step={1}
                      value={Math.round(quality * 100)}
                      onChange={(v) => setQuality(v / 100)}
                    />
                  </div>
                ) : (
                  <div style={{ ...hintStyle, marginTop: 12 }}>
                    PNG is lossless — quality is determined by dimensions.
                  </div>
                )}
              </Panel>
            </div>

            {/* Download */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
              <a
                href={outURL || '#'}
                download={downloadName}
                aria-disabled={!outBlob || processing}
                onClick={(e) => { if (!outBlob || processing) e.preventDefault(); }}
                className="btn btn-primary"
                style={{
                  padding: '14px 28px', fontSize: '0.9rem',
                  background: 'var(--pixel-green)', textDecoration: 'none',
                  opacity: outBlob && !processing ? 1 : 0.5,
                  pointerEvents: outBlob && !processing ? 'auto' : 'none',
                }}
              >
                {processing ? 'Processing…' : `⬇ Download ${formatMeta.label}`}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================================== */
/*  Subcomponents + shared styles                                              */
/* ========================================================================== */

const fileHeaderStyle = {
  display: 'flex', alignItems: 'center', gap: 14,
  padding: '10px 14px', background: '#2d1b4e',
  border: '2px dashed var(--pixel-cyan)', flexWrap: 'wrap',
};

const labelStyle = {
  fontFamily: 'var(--font-pixel)', fontSize: '0.65rem',
  color: '#aaa', marginBottom: 6, letterSpacing: '0.5px',
};

const hintStyle = {
  fontFamily: 'var(--font-pixel)', fontSize: '0.65rem',
  color: 'var(--pixel-cyan)', marginTop: 8, letterSpacing: '0.5px',
};

const selectStyle = {
  width: '100%', padding: '10px 12px',
  background: '#1a1a1a', color: '#fff',
  border: '2px solid var(--pixel-border)', fontSize: '0.85rem',
  outline: 'none',
};

function Panel({ title, children }) {
  return (
    <div style={{
      background: '#1a1a1a', border: '2px solid var(--pixel-border)',
      padding: 14, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{
        fontFamily: 'var(--font-pixel)', fontSize: '0.75rem',
        color: 'var(--pixel-yellow)', letterSpacing: '1px',
        paddingBottom: 8, borderBottom: '1px solid #333',
      }}>{title}</div>
      {children}
    </div>
  );
}

function ModeTabs({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
      {options.map((o) => (
        <button
          key={o.id}
          className={`btn ${value === o.id ? 'btn-selected' : 'btn-ghost'}`}
          onClick={() => onChange(o.id)}
          style={{ padding: '6px 10px', fontSize: '0.7rem', flex: 1 }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.7rem', color: '#fff', marginBottom: 6 }}>
        {label}
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  );
}

function Field({ label, value, onChange, suffix }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', background: '#1a1a1a', border: '2px solid var(--pixel-border)' }}>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, padding: '8px', background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '0.85rem' }}
        />
        {suffix && (
          <span style={{ padding: '0 8px', color: '#888', fontSize: '0.75rem' }}>{suffix}</span>
        )}
      </div>
    </div>
  );
}

function PreviewBox({ label, url, size, dims, color, badge, processing }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: '#0d0d0d', border: '3px solid var(--pixel-border)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 12px', background: color || '#333',
        fontFamily: 'var(--font-pixel)', fontSize: '0.75rem',
        color: '#fff', display: 'flex', alignItems: 'center',
        gap: 10, justifyContent: 'space-between',
        textShadow: '1px 1px 0 #000',
      }}>
        <span>{label}</span>
        {badge && <span style={{ fontSize: '0.65rem' }}>{badge}</span>}
      </div>
      <div style={{
        background:
          'repeating-conic-gradient(#1a1a1a 0% 25%, #222 0% 50%) 50% / 16px 16px',
        minHeight: 180, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 10, position: 'relative',
      }}>
        {url ? (
          <img
            src={url} alt={label}
            style={{
              maxWidth: '100%', maxHeight: 280, objectFit: 'contain',
              display: 'block', imageRendering: 'auto',
            }}
          />
        ) : (
          <span style={{ color: '#666', fontFamily: 'var(--font-pixel)', fontSize: '0.7rem' }}>
            {processing ? 'PROCESSING…' : 'WAITING…'}
          </span>
        )}
        {processing && url && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.4)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-pixel)', fontSize: '0.7rem', color: '#fff',
          }}>
            PROCESSING…
          </div>
        )}
      </div>
      <div style={{
        padding: '8px 12px', display: 'flex', justifyContent: 'space-between',
        fontFamily: 'var(--font-pixel)', fontSize: '0.65rem',
        background: '#1a1a1a', color: '#bbb',
      }}>
        <span>{dims.w} × {dims.h}</span>
        <span>{formatFileSize(size)}</span>
      </div>
    </div>
  );
}
