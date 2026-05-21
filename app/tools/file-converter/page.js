'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { detectInputKind, getConversionTargets } from '@/tools-logic/fileConverter';
import './file-converter.css';

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
      const { blob, filename } = await convertFile(file, selectedTarget, detected);
      triggerDownload(blob, filename);
      setStatus(`Download started: ${filename}`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Conversion failed.');
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="tool-page">
      <Link href="/" className="tool-page-back">
        ← Back to Home
      </Link>

      <div className="tool-page-header">
        <h1>🔄 File converter</h1>
        <p>Convert images, audio, video, and documents instantly.</p>
      </div>

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
        <div className="fc-dropzone-title">Drop a file here or click to browse</div>
        <div className="fc-dropzone-hint">
          Word, PDF, Excel, images, songs, videos, and more — pick a file to see what you can save it as.
        </div>
      </div>

      {error && <div className="fc-error">{error}</div>}
      {status && <div className="fc-success">{status}</div>}

      {file && detected && targets.length > 0 && (
        <>
          <div className="fc-file-row">
            <div className="fc-file-meta">
              <div className="fc-file-name">{file.name}</div>
              <div className="fc-file-kind">File type: {detected.label}</div>
            </div>
            <button type="button" className="fc-btn-ghost" onClick={resetFileState}>
              Clear
            </button>
          </div>

          <div className="fc-section-title">Convert to</div>
          <div className="fc-targets" role="radiogroup" aria-label="Output format">
            {targets.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`fc-target ${selectedTarget === t.id ? 'fc-target-selected' : ''}`}
                onClick={() => setSelectedTarget(t.id)}
              >
                <input
                  className="fc-radio"
                  type="radio"
                  name="fc-target"
                  checked={selectedTarget === t.id}
                  onChange={() => setSelectedTarget(t.id)}
                  aria-label={t.label}
                />
                <span>
                  <div className="fc-target-label">{t.label}</div>
                  {t.hint && <div className="fc-target-hint">{t.hint}</div>}
                </span>
              </button>
            ))}
          </div>

          <div className="fc-actions">
            <button
              type="button"
              className="fc-btn-primary"
              disabled={!selectedTarget || converting}
              onClick={handleConvert}
            >
              {converting ? 'Converting…' : 'Convert & download'}
            </button>
          </div>
        </>
      )}

      <div className="fc-note">
        You’ll only see formats that apply to the file you picked. Very large files or long videos may take a
        while or not finish on slower devices.
      </div>
    </div>
  );
}
