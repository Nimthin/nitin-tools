'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getFfmpeg } from '@/tools-logic/fileConverter/ffmpeg-helper';

/* ==========================================================================
   Video to GIF
   --------------------------------------------------------------------------
   • Drop a video (mp4, webm, mov, mkv, etc.)
   • Trim with start/end sliders or "capture from player" buttons
   • Choose FPS, output width, quality (single-pass vs palette two-pass)
   • Generates GIF entirely in-browser via FFmpeg WASM
   • Reuses existing /tools-logic/fileConverter/ffmpeg-helper.js
   ========================================================================== */

const FPS_OPTS = [5, 10, 15, 20, 24, 30];

const WIDTH_PRESETS = [
  { id: 240,  label: '240px (tiny)' },
  { id: 360,  label: '360px (small)' },
  { id: 480,  label: '480px (medium)' },
  { id: 720,  label: '720px (HD)' },
  { id: 0,    label: 'Original' },
];

const QUALITY_OPTS = [
  { id: 'fast', label: 'Fast',     blurb: 'Single pass — quickest, decent colors' },
  { id: 'high', label: 'High',     blurb: 'Two-pass palette — better colors, slower' },
];

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

const formatTime = (s) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${String(sec).padStart(2, '0')}.${ms}`;
};

const fileToUint8 = async (file) =>
  new Uint8Array(await file.arrayBuffer());

/* ==========================================================================
   Component
   ========================================================================== */

export default function VideoToGif() {
  const [file, setFile] = useState(null);
  const [videoURL, setVideoURL] = useState(null);
  const [duration, setDuration] = useState(0);

  // Trim
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime]     = useState(0);

  // Options
  const [fps, setFps]         = useState(12);
  const [width, setWidth]     = useState(480);
  const [quality, setQuality] = useState('high');
  const [loop, setLoop]       = useState(true);

  // Processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress]         = useState(0);   // 0..1
  const [logLine, setLogLine]           = useState('');
  const [phaseLabel, setPhaseLabel]     = useState('');
  const [error, setError]               = useState(null);
  const [ffmpegStatus, setFfmpegStatus] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'

  // Result
  const [gifBlob, setGifBlob] = useState(null);
  const [gifURL, setGifURL]   = useState(null);

  // Refs
  const videoRef    = useRef(null);
  const fileInputRef = useRef(null);
  const cancelRef   = useRef(false);
  const ffmpegRef   = useRef(null);
  const videoURLRef = useRef(null);
  const gifURLRef   = useRef(null);

  /* ====================================================================== */
  /*  Cleanup on unmount                                                     */
  /* ====================================================================== */
  useEffect(() => () => {
    if (videoURLRef.current) URL.revokeObjectURL(videoURLRef.current);
    if (gifURLRef.current)   URL.revokeObjectURL(gifURLRef.current);
  }, []);

  /* ====================================================================== */
  /*  File pick                                                              */
  /* ====================================================================== */
  const handleFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith('video/')) {
      setError('Please choose a video file.');
      return;
    }
    setError(null);
    setFile(f);
    setGifBlob(null);
    setGifURL(null);

    if (videoURLRef.current) URL.revokeObjectURL(videoURLRef.current);
    if (gifURLRef.current)   { URL.revokeObjectURL(gifURLRef.current); gifURLRef.current = null; }

    const url = URL.createObjectURL(f);
    videoURLRef.current = url;
    setVideoURL(url);

    setStartTime(0);
    setEndTime(0);
    setDuration(0);
  };

  const handleFileChange = (e) => handleFile(e.target.files?.[0]);
  const onDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    handleFile(e.dataTransfer.files?.[0]);
  };

  /* ====================================================================== */
  /*  Video load                                                             */
  /* ====================================================================== */
  const onLoadedMetadata = (e) => {
    const d = e.currentTarget.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    const max = Math.min(d, 30); // default trim cap
    setDuration(d);
    setStartTime(0);
    setEndTime(max);
  };

  /* ====================================================================== */
  /*  Trim controls                                                          */
  /* ====================================================================== */
  const setStartFromPlayer = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setStartTime(Math.min(t, endTime - 0.1));
  };
  const setEndFromPlayer = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setEndTime(Math.max(t, startTime + 0.1));
  };

  const seek = (t) => {
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  /* ====================================================================== */
  /*  FFmpeg load (lazy on first user gesture)                               */
  /* ====================================================================== */
  const ensureFfmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current;
    setFfmpegStatus('loading');
    setPhaseLabel('Loading video engine (~30 MB, one time)…');
    try {
      const ff = await getFfmpeg();
      ffmpegRef.current = ff;
      // Attach progress + log listeners
      ff.on('progress', (e) => {
        if (typeof e.progress === 'number') setProgress(Math.max(0, Math.min(1, e.progress)));
      });
      ff.on('log', (e) => {
        if (e?.message) setLogLine(e.message);
      });
      setFfmpegStatus('ready');
      return ff;
    } catch (err) {
      console.error(err);
      setFfmpegStatus('error');
      throw new Error('Failed to load video engine.');
    }
  };

  /* ====================================================================== */
  /*  Convert                                                                */
  /* ====================================================================== */
  const handleConvert = async () => {
    if (!file) return;
    if (endTime <= startTime) { setError('End time must be after start time.'); return; }

    setError(null);
    setIsProcessing(true);
    setProgress(0);
    setLogLine('');
    cancelRef.current = false;

    try {
      const ff = await ensureFfmpeg();
      if (cancelRef.current) throw new Error('cancelled');

      const inputName = 'input.dat';
      const paletteName = 'palette.png';
      const outputName = 'output.gif';
      const startStr = startTime.toFixed(3);
      const durStr = (endTime - startTime).toFixed(3);

      const scaleFilter = width > 0 ? `scale=${width}:-1:flags=lanczos` : 'scale=iw:-1:flags=lanczos';
      const loopFlag = loop ? '0' : '-1';

      setPhaseLabel('Reading file…');
      await ff.writeFile(inputName, await fileToUint8(file));
      if (cancelRef.current) throw new Error('cancelled');

      if (quality === 'high') {
        // PASS 1 — palette
        setPhaseLabel('Building optimal color palette (pass 1/2)…');
        setProgress(0);
        await ff.exec([
          '-ss', startStr, '-t', durStr,
          '-i', inputName,
          '-vf', `fps=${fps},${scaleFilter},palettegen=stats_mode=diff`,
          '-y', paletteName,
        ]);
        if (cancelRef.current) throw new Error('cancelled');

        // PASS 2 — use palette
        setPhaseLabel('Encoding GIF with palette (pass 2/2)…');
        setProgress(0);
        await ff.exec([
          '-ss', startStr, '-t', durStr,
          '-i', inputName,
          '-i', paletteName,
          '-filter_complex',
            `[0:v]fps=${fps},${scaleFilter}[v];[v][1:v]paletteuse=dither=bayer:bayer_scale=5`,
          '-loop', loopFlag,
          '-y', outputName,
        ]);
      } else {
        setPhaseLabel('Encoding GIF…');
        setProgress(0);
        await ff.exec([
          '-ss', startStr, '-t', durStr,
          '-i', inputName,
          '-vf', `fps=${fps},${scaleFilter}`,
          '-loop', loopFlag,
          '-y', outputName,
        ]);
      }

      if (cancelRef.current) throw new Error('cancelled');

      setPhaseLabel('Finalizing…');
      const data = await ff.readFile(outputName);
      const blob = new Blob([data.buffer], { type: 'image/gif' });
      const url = URL.createObjectURL(blob);
      if (gifURLRef.current) URL.revokeObjectURL(gifURLRef.current);
      gifURLRef.current = url;
      setGifBlob(blob);
      setGifURL(url);

      // Best-effort cleanup of WASM FS
      try { await ff.deleteFile(inputName);   } catch {}
      try { await ff.deleteFile(paletteName); } catch {}
      try { await ff.deleteFile(outputName);  } catch {}
    } catch (err) {
      if (err?.message === 'cancelled') {
        // user-initiated
      } else {
        console.error(err);
        setError(err?.message || 'GIF conversion failed.');
      }
    } finally {
      setIsProcessing(false);
      setPhaseLabel('');
      cancelRef.current = false;
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
    // Note: ffmpeg.exec() doesn't expose a clean abort; cancellation
    // takes effect after the current exec call completes.
  };

  /* ====================================================================== */
  /*  Reset                                                                  */
  /* ====================================================================== */
  const resetTool = () => {
    if (videoURLRef.current) URL.revokeObjectURL(videoURLRef.current);
    if (gifURLRef.current)   URL.revokeObjectURL(gifURLRef.current);
    videoURLRef.current = null;
    gifURLRef.current = null;
    setFile(null);
    setVideoURL(null);
    setGifBlob(null);
    setGifURL(null);
    setStartTime(0);
    setEndTime(0);
    setDuration(0);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ====================================================================== */
  /*  Computed                                                               */
  /* ====================================================================== */
  const clipDuration = Math.max(0, endTime - startTime);
  const estimatedFrames = Math.round(clipDuration * fps);
  const tooLong = clipDuration > 30;

  const downloadName = file
    ? `${file.name.replace(/\.[^.]+$/, '')}.gif`
    : 'output.gif';

  /* ====================================================================== */
  /*  Render                                                                 */
  /* ====================================================================== */
  return (
    <div className="tool-page">
      <Link href="/" className="tool-page-back">← Back to Toolkit</Link>
      <div className="tool-page-header">
        <h1>🎞️ Video → GIF</h1>
        <p>Trim a clip from any video and export as an animated GIF — all in your browser.</p>
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
            <div className="upload-zone-icon">🎞️</div>
            <div className="upload-zone-text">Click or drag a video here</div>
            <div className="upload-zone-hint">MP4 · WebM · MOV · MKV — runs in your browser via FFmpeg WASM</div>
            <input
              type="file" ref={fileInputRef} onChange={handleFileChange}
              accept="video/*" style={{ display: 'none' }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={fileHeaderStyle}>
              <span style={{ fontSize: '1.3rem' }}>📹</span>
              <strong style={{ color: 'var(--pixel-cyan)' }}>{file.name}</strong>
              <span style={{ color: '#aaa', fontSize: '0.85rem' }}>
                · {formatFileSize(file.size)}
                {duration > 0 ? ` · ${formatTime(duration)}` : ''}
              </span>
              <div style={{ flex: 1 }} />
              <button className="btn btn-ghost" onClick={resetTool}
                style={{ padding: '6px 12px', fontSize: '0.7rem' }}>
                Change Video
              </button>
            </div>

            {/* Two-column: preview / output */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 16,
            }}>
              <Panel title="SOURCE">
                <video
                  ref={videoRef}
                  src={videoURL}
                  controls
                  onLoadedMetadata={onLoadedMetadata}
                  style={{
                    width: '100%', maxHeight: 280, background: '#000',
                    border: '2px solid var(--pixel-border)',
                  }}
                />
                {duration > 0 && (
                  <>
                    <RangeTrim
                      duration={duration}
                      start={startTime}
                      end={endTime}
                      onStart={(v) => { setStartTime(v); seek(v); }}
                      onEnd={(v) => { setEndTime(v); seek(v); }}
                    />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn-ghost" onClick={setStartFromPlayer}
                        style={{ flex: 1, padding: '8px', fontSize: '0.7rem' }}>
                        ⤓ Set start from player
                      </button>
                      <button className="btn btn-ghost" onClick={setEndFromPlayer}
                        style={{ flex: 1, padding: '8px', fontSize: '0.7rem' }}>
                        ⤒ Set end from player
                      </button>
                    </div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontFamily: 'var(--font-pixel)', fontSize: '0.7rem',
                      color: '#bbb',
                    }}>
                      <span>Start: {formatTime(startTime)}</span>
                      <span>{formatTime(clipDuration)} clip</span>
                      <span>End: {formatTime(endTime)}</span>
                    </div>
                    {tooLong && (
                      <div style={warningStyle}>
                        Clip is {formatTime(clipDuration)} — long clips produce huge GIFs
                        and may run out of memory. Try ≤ 30s.
                      </div>
                    )}
                  </>
                )}
              </Panel>

              <Panel title="RESULT">
                <div style={{
                  background:
                    'repeating-conic-gradient(#1a1a1a 0% 25%, #222 0% 50%) 50% / 16px 16px',
                  padding: 14, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  minHeight: 240,
                }}>
                  {gifURL ? (
                    <img src={gifURL} alt="Result"
                      style={{
                        maxWidth: '100%', maxHeight: 240,
                        boxShadow: '4px 4px 0 #000',
                        border: '2px solid var(--pixel-border)',
                      }} />
                  ) : (
                    <span style={{
                      color: '#666', fontFamily: 'var(--font-pixel)',
                      fontSize: '0.75rem', textAlign: 'center',
                    }}>
                      {isProcessing ? 'PROCESSING…' : 'GIF appears here'}
                    </span>
                  )}
                </div>

                {gifBlob && (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontFamily: 'var(--font-pixel)', fontSize: '0.7rem',
                    color: '#bbb', marginTop: 6,
                  }}>
                    <span>{formatFileSize(gifBlob.size)}</span>
                    <a
                      href={gifURL}
                      download={downloadName}
                      className="btn btn-primary"
                      style={{
                        padding: '8px 16px', fontSize: '0.7rem',
                        background: 'var(--pixel-green)', textDecoration: 'none',
                      }}
                    >
                      ⬇ Download GIF
                    </a>
                  </div>
                )}
              </Panel>
            </div>

            {/* Settings */}
            <Panel title="SETTINGS">
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 12,
              }}>
                <div>
                  <label style={labelStyle}>FPS</label>
                  <select
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    disabled={isProcessing}
                    style={selectStyle}
                  >
                    {FPS_OPTS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>WIDTH</label>
                  <select
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    disabled={isProcessing}
                    style={selectStyle}
                  >
                    {WIDTH_PRESETS.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>QUALITY</label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    disabled={isProcessing}
                    style={selectStyle}
                  >
                    {QUALITY_OPTS.map((q) =>
                      <option key={q.id} value={q.id}>{q.label} — {q.blurb}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>LOOP</label>
                  <button
                    className={`btn ${loop ? 'btn-selected' : 'btn-ghost'}`}
                    onClick={() => setLoop((v) => !v)}
                    disabled={isProcessing}
                    style={{ width: '100%', padding: '10px', fontSize: '0.75rem' }}
                  >
                    {loop ? '↻ Infinite' : '▶ Play once'}
                  </button>
                </div>
              </div>

              <div style={{
                fontFamily: 'var(--font-pixel)', fontSize: '0.65rem',
                color: '#888', marginTop: 6, letterSpacing: '0.5px',
              }}>
                ~{estimatedFrames} frames will be encoded.
              </div>
            </Panel>

            {/* Progress */}
            {isProcessing && (
              <div>
                <div style={{
                  fontFamily: 'var(--font-pixel)', fontSize: '0.7rem',
                  color: '#fff', marginBottom: 6, textAlign: 'center',
                }}>
                  {phaseLabel} {Math.round(progress * 100)}%
                </div>
                <div style={{
                  width: '100%', height: 14, background: '#1a1a1a',
                  border: '2px solid var(--pixel-border)', overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.round(progress * 100)}%`, height: '100%',
                    background: 'linear-gradient(90deg, var(--pixel-green) 0%, var(--pixel-cyan) 100%)',
                    transition: 'width 0.2s ease',
                  }} />
                </div>
                {logLine && (
                  <div style={{
                    marginTop: 6, fontSize: '0.7rem', color: '#666',
                    fontFamily: 'monospace', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {logLine}
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {isProcessing ? (
                <button className="btn btn-danger" onClick={handleCancel}
                  style={{ padding: '12px 24px' }}>
                  Cancel
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={handleConvert}
                  disabled={duration === 0 || clipDuration <= 0}
                  style={{
                    padding: '14px 28px', fontSize: '0.9rem',
                    background: 'var(--pixel-green)',
                  }}
                >
                  {gifBlob ? '↻ Re-convert' : '✨ Convert to GIF'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================================== */
/*  Subcomponents                                                              */
/* ========================================================================== */

const fileHeaderStyle = {
  display: 'flex', alignItems: 'center', gap: 14,
  padding: '10px 14px', background: '#2d1b4e',
  border: '2px dashed var(--pixel-cyan)', flexWrap: 'wrap',
};

const labelStyle = {
  fontFamily: 'var(--font-pixel)', fontSize: '0.65rem',
  color: '#aaa', marginBottom: 6, letterSpacing: '0.5px',
  display: 'block',
};

const selectStyle = {
  width: '100%', padding: '10px', background: '#0d0d0d',
  color: '#fff', border: '2px solid var(--pixel-border)',
  fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
};

const warningStyle = {
  padding: '8px 10px', background: 'rgba(255,152,0,0.12)',
  border: '2px dashed #ff9800', color: '#ffcc80',
  fontSize: '0.75rem', marginTop: 4,
};

function Panel({ title, children }) {
  return (
    <div style={{
      background: '#1a1a1a', border: '2px solid var(--pixel-border)',
      padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
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

function RangeTrim({ duration, start, end, onStart, onEnd }) {
  return (
    <div style={{ position: 'relative', padding: '4px 0' }}>
      <div style={{
        position: 'relative', height: 8, background: '#333',
        border: '2px solid var(--pixel-border)',
      }}>
        <div style={{
          position: 'absolute',
          left: `${(start / duration) * 100}%`,
          right: `${100 - (end / duration) * 100}%`,
          top: 0, bottom: 0,
          background: 'var(--pixel-yellow)',
        }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
        <div>
          <div style={labelStyle}>START · {formatTime(start)}</div>
          <input
            type="range" min={0} max={duration} step={0.05} value={start}
            onChange={(e) => onStart(Math.min(end - 0.05, Number(e.target.value)))}
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <div style={labelStyle}>END · {formatTime(end)}</div>
          <input
            type="range" min={0} max={duration} step={0.05} value={end}
            onChange={(e) => onEnd(Math.max(start + 0.05, Number(e.target.value)))}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
