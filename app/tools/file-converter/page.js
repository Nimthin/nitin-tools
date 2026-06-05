'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { detectInputKind, getConversionTargets } from '@/tools-logic/fileConverter';
import './file-converter.css';

async function saveFile(blob, filename, mimeType, ext) {
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const options = {
        suggestedName: filename,
        types: [{
          description: `${ext.toUpperCase()} File`,
          accept: {
            [mimeType || 'application/octet-stream']: [`.${ext}`]
          }
        }]
      };
      const handle = await window.showSaveFilePicker(options);
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Save cancelled by user.');
      }
      console.warn('showSaveFilePicker failed, falling back to direct download:', err);
    }
  }

  // Fallback to direct download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return false;
}

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
};

const getCategoryIcon = (category) => {
  switch (category) {
    case 'pdf': return '📄';
    case 'docx':
    case 'doc':
    case 'odt': return '📝';
    case 'txt': return '🔤';
    case 'html':
    case 'md': return '🌐';
    case 'raster':
    case 'heic':
    case 'gif': return '🖼️';
    case 'audio': return '🎵';
    case 'video': return '🎥';
    case 'csv':
    case 'tsv':
    case 'xlsx':
    case 'xls': return '📊';
    case 'json':
    case 'xml': return '💻';
    default: return '📁';
  }
};

const getTargetExt = (targetId, category) => {
  if (!targetId) return '';
  if (targetId.startsWith('audio_')) return targetId.replace('audio_', '');
  if (targetId.startsWith('video_')) {
    if (targetId === 'video_audio_mp3') return 'mp3';
    if (targetId === 'video_gif') return 'gif';
    if (targetId === 'video_frames_zip') return 'zip';
    return targetId.replace('video_', '');
  }
  if (targetId === 'jpg_zip' || targetId === 'png_zip') return 'zip';
  if (targetId === 'tiff') return 'tif';
  return targetId;
};

export default function FileConverterPage() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [detected, setDetected] = useState(null);
  const [targets, setTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const resetFileState = useCallback(() => {
    setFile(null);
    setDetected(null);
    setTargets([]);
    setSelectedTarget(null);
    setError(null);
    setStatus(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const processFile = useCallback(async (f) => {
    if (!f) return;
    setError(null);
    setStatus(null);
    setSelectedTarget(null);

    // Limit files to 500MB to avoid browser OOM crash
    if (f.size > 500 * 1024 * 1024) {
      setError(`File is too large (${formatFileSize(f.size)}). In-browser conversions are limited to 500 MB.`);
      setFile(null);
      return;
    }

    setFile(f);

    const d = detectInputKind(f);
    if (d.error || !d.category) {
      setDetected(null);
      setTargets([]);
      setError(d.error || 'Could not detect file type.');
      return;
    }

    setDetected(d);
    const list = getConversionTargets(d);
    setTargets(list);
    if (list.length) setSelectedTarget(list[0].id);
  }, []);

  const onInputChange = (e) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const handleConvert = async () => {
    if (!file || !detected || !selectedTarget) return;
    setConverting(true);
    setError(null);
    setStatus(null);
    try {
      const { convertFile } = await import('@/tools-logic/fileConverter/engine');
      const { blob, filename: defaultFilename } = await convertFile(file, selectedTarget, detected);
      
      const ext = getTargetExt(selectedTarget, detected.category);
      const savedWithPicker = await saveFile(blob, defaultFilename, blob.type, ext);
      if (savedWithPicker) {
        setStatus(`Successfully saved: ${defaultFilename}`);
      } else {
        setStatus(`Success! Downloaded: ${defaultFilename}`);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Conversion failed.');
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="fc-fullscreen-page">
      {/* Fullscreen Workspace Area */}
      <div className="fc-workspace-container">
        <div className="fc-workspace-inner">
          <Link href="/" className="tool-page-back">
            ← Back to Home
          </Link>
          
          <div className="fc-window">
            {/* Retro Window Titlebar */}
            <div className="fc-window-titlebar">
              <div className="fc-window-dots">
                <span className="fc-dot dot-red" />
                <span className="fc-dot dot-yellow" />
                <span className="fc-dot dot-green" />
              </div>
              <div className="fc-window-title">Dino File Converter</div>
              <div className="fc-window-actions-right">
                {converting ? (
                  <span className="fc-status-tag tag-converting">PROCESSING</span>
                ) : file ? (
                  <span className="fc-status-tag tag-loaded">FILE LOADED</span>
                ) : (
                  <span className="fc-status-tag tag-ready">READY</span>
                )}
              </div>
            </div>

          {/* Window Content */}
          <div className="fc-window-content">
            {!file ? (
              <div
                className={`fc-dropzone ${dragOver ? 'fc-dragover' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <input
                  ref={inputRef}
                  type="file"
                  onChange={onInputChange}
                  aria-label="Choose a file to convert"
                />
                <div className="fc-dropzone-illustration">
                  <svg viewBox="0 0 64 64" className="fc-upload-svg">
                    <path d="M12 8h24l16 16v32H12z" className="svg-file-bg" />
                    <path d="M36 8v16h16" className="svg-file-fold" />
                    <path d="M22 36l10-10 10 10M32 26v20" className="svg-file-arrow" />
                  </svg>
                </div>
                <div className="fc-dropzone-title">DRAG & DROP FILE HERE</div>
                <div className="fc-dropzone-subtitle">or click to browse local files</div>
                <div className="fc-dropzone-hint">
                  Supports PDF, Word, Excel, Images (PNG, JPG, HEIC), Audio, Video, CSV, JSON, XML & more.
                </div>
              </div>
            ) : (
              <div className="fc-workspace">
                {/* Selected File Card */}
                <div className="fc-file-card">
                  <div className="fc-file-card-icon">{getCategoryIcon(detected?.category)}</div>
                  <div className="fc-file-card-details">
                    <div className="fc-file-card-name">{file.name}</div>
                    <div className="fc-file-card-meta">
                      <span className="fc-badge-type">{detected?.label || 'Unknown'}</span>
                      <span className="fc-file-size">{formatFileSize(file.size)}</span>
                    </div>
                  </div>
                  <button type="button" className="fc-btn-clear" onClick={resetFileState}>
                    ❌ Clear File
                  </button>
                </div>

                {/* Conversion targets section */}
                {targets.length > 0 && (
                  <div className="fc-target-section">
                    <h2 className="fc-section-heading">SELECT OUTPUT FORMAT</h2>
                    
                    <div className="fc-targets-grid" role="radiogroup" aria-label="Output format">
                      {targets.map((t) => {
                        const isSelected = selectedTarget === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            className={`fc-target-card ${isSelected ? 'fc-target-card-selected' : ''}`}
                            onClick={() => setSelectedTarget(t.id)}
                          >
                            <div className="fc-target-header">
                              <span className="fc-target-radio-circle">
                                {isSelected && <span className="fc-target-radio-inner" />}
                              </span>
                              <span className="fc-target-ext-label">{t.label}</span>
                            </div>
                            {t.hint && <p className="fc-target-hint">{t.hint}</p>}
                          </button>
                        );
                      })}
                    </div>

                    {/* Actions & Progress Area */}
                    <div className="fc-action-footer">
                      {converting ? (
                        <div className="fc-progress-container">
                          <div className="fc-progress-label">CONVERTING FILE... PLEASE DO NOT CLOSE THIS TAB</div>
                          <div className="fc-progress-bar-track">
                            <div className="fc-progress-bar-fill" />
                          </div>
                        </div>
                      ) : (
                        <div className="fc-actions">
                          <button
                            type="button"
                            className="fc-btn-primary-action"
                            disabled={!selectedTarget || converting}
                            onClick={handleConvert}
                          >
                            ⚡ CONVERT & DOWNLOAD
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Dynamic Toast Status Notifications */}
      <div className="fc-toasts">
        {error && (
          <div className="fc-toast fc-toast-error">
            <span className="fc-toast-icon">⚠️</span>
            <span className="fc-toast-msg">{error}</span>
          </div>
        )}
        {status && (
          <div className="fc-toast fc-toast-success">
            <span className="fc-toast-icon">✅</span>
            <span className="fc-toast-msg">{status}</span>
          </div>
        )}
      </div>
    </div>
  );
}
