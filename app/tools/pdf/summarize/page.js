'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { marked } from 'marked';

/* ==========================================================================
   PDF Summarize — production version
   --------------------------------------------------------------------------
   Pipeline
     1. Extract text from PDF (pdfjs, per-page, item-spacing aware)
     2. Optional page-range filter
     3. POST extracted text to /api/summarize
     4. Stream markdown chunks into the result panel
     5. Render with marked.js, allow copy / download / re-summarize
   ========================================================================== */

const LENGTH_OPTS = [
  { id: 'short',  label: 'Short',  blurb: 'Brief, ~100 words / 4–6 bullets' },
  { id: 'medium', label: 'Medium', blurb: 'Comprehensive, 250–400 words' },
  { id: 'long',   label: 'Long',   blurb: 'Detailed, 500–800 words' },
];

const STYLE_OPTS = [
  { id: 'bullets',   label: 'Bullets',        blurb: 'Organized markdown bullets' },
  { id: 'paragraph', label: 'Paragraphs',     blurb: 'Flowing prose' },
  { id: 'keypoints', label: 'Key Takeaways',  blurb: 'Sections with headings' },
  { id: 'qa',        label: 'Q & A',          blurb: 'Question / answer pairs' },
];

const MODEL_OPTS = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', blurb: 'Fast, high quality (default)' },
  { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B',  blurb: 'Fastest, lighter quality' },
];

/* -------------------------------------------------------------------------- */
/*  PDF text extraction (item-spacing aware)                                  */
/* -------------------------------------------------------------------------- */

const extractPageText = (textContent) => {
  // pdfjs text items lack reliable spacing; reconstruct using positions.
  const items = textContent.items;
  if (!items?.length) return '';
  let out = '';
  let lastY = null;
  let lastEndX = null;
  let lastFontHeight = 10;

  for (const it of items) {
    const tx = it.transform; // [a, b, c, d, e, f] — e=x, f=y
    if (!tx) {
      out += it.str + ' ';
      continue;
    }
    const x = tx[4];
    const y = tx[5];
    const fontHeight = Math.abs(tx[3]) || lastFontHeight;
    const w = it.width || 0;

    if (lastY !== null) {
      const lineGap = Math.abs(y - lastY);
      if (lineGap > fontHeight * 0.6) {
        // new line
        out += '\n';
        if (lineGap > fontHeight * 1.5) out += '\n'; // paragraph
      } else if (lastEndX !== null && x - lastEndX > fontHeight * 0.3) {
        // horizontal gap → insert a space if missing
        if (!out.endsWith(' ') && !out.endsWith('\n')) out += ' ';
      }
    }
    out += it.str;
    lastY = y;
    lastEndX = x + w;
    lastFontHeight = fontHeight;
  }
  return out.trim();
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const parsePageRange = (str, total) => {
  if (!str || !str.trim()) return null; // null = all
  const set = new Set();
  for (const part of str.split(',')) {
    const t = part.trim();
    if (!t) continue;
    if (t.includes('-')) {
      const [a, b] = t.split('-').map((n) => parseInt(n, 10));
      if (!Number.isFinite(a) || !Number.isFinite(b)) return 'bad';
      const lo = Math.max(1, Math.min(a, b));
      const hi = Math.min(total, Math.max(a, b));
      for (let p = lo; p <= hi; p++) set.add(p);
    } else {
      const n = parseInt(t, 10);
      if (!Number.isFinite(n)) return 'bad';
      if (n >= 1 && n <= total) set.add(n);
    }
  }
  return set.size ? [...set].sort((a, b) => a - b) : 'bad';
};

const downloadBlob = (text, filename, type) => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

/* ==========================================================================
   Main component
   ========================================================================== */

export default function SummarizePdf() {
  const [file, setFile] = useState(null);
  const [pdfText, setPdfText] = useState('');
  const [totalPages, setTotalPages] = useState(0);

  // Options
  const [length, setLength] = useState('medium');
  const [style, setStyle]   = useState('bullets');
  const [model, setModel]   = useState(MODEL_OPTS[0].id);
  const [focus, setFocus]   = useState('');
  const [pageRange, setPageRange] = useState('');

  // Phases
  const [phase, setPhase] = useState('idle');
  // 'idle' | 'extracting' | 'ready' | 'summarizing' | 'done' | 'error'
  const [extractProgress, setExtractProgress] = useState({ current: 0, total: 0 });

  const [summary, setSummary] = useState('');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef(null);
  const abortRef = useRef(null);

  /* ====================================================================== */
  /*  Markdown render (sanitized via marked options)                         */
  /* ====================================================================== */
  const summaryHtml = useMemo(() => {
    if (!summary) return '';
    try {
      marked.setOptions({ breaks: true, gfm: true });
      return marked.parse(summary);
    } catch {
      return summary.replace(/\n/g, '<br/>');
    }
  }, [summary]);

  /* ====================================================================== */
  /*  Stats                                                                  */
  /* ====================================================================== */
  const stats = useMemo(() => ({
    chars: pdfText.length,
    words: pdfText.trim() ? pdfText.trim().split(/\s+/).length : 0,
    summaryWords: summary.trim() ? summary.trim().split(/\s+/).length : 0,
  }), [pdfText, summary]);

  /* ====================================================================== */
  /*  Extract text                                                           */
  /* ====================================================================== */
  const extractText = async (f) => {
    setPhase('extracting');
    setError(null);
    setSummary('');
    setExtractProgress({ current: 0, total: 0 });

    try {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      const arrayBuffer = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      const n = pdf.numPages;
      setTotalPages(n);
      setExtractProgress({ current: 0, total: n });

      const parts = new Array(n);
      for (let i = 1; i <= n; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        parts[i - 1] = extractPageText(tc);
        setExtractProgress({ current: i, total: n });
      }
      try { pdf.destroy?.(); } catch {}

      const text = parts.map((t, idx) => `\n--- PAGE ${idx + 1} ---\n${t}`).join('\n').trim();
      setPdfText(text);

      if (!text.replace(/--- PAGE \d+ ---/g, '').trim()) {
        setPhase('error');
        setError(
          'No selectable text found in this PDF. It looks like a scanned document. ' +
          'Run it through an OCR tool first, then summarize.'
        );
        return;
      }

      setPhase('ready');
    } catch (err) {
      console.error(err);
      setPhase('error');
      setError('Failed to read PDF: ' + (err?.message || 'unknown error'));
    }
  };

  /* ====================================================================== */
  /*  Build text to send (respects page range)                               */
  /* ====================================================================== */
  const buildPayloadText = () => {
    const range = parsePageRange(pageRange, totalPages);
    if (range === 'bad') {
      return { error: 'Invalid page range. Use formats like "1-5", "1,3,5", or leave blank for all.' };
    }
    if (!range) return { text: pdfText };

    // Filter the text by page markers
    const allParts = pdfText.split(/\n--- PAGE (\d+) ---\n/);
    // allParts: ['', '1', text1, '2', text2, ...]
    const map = new Map();
    for (let i = 1; i < allParts.length; i += 2) {
      map.set(parseInt(allParts[i], 10), allParts[i + 1] || '');
    }
    const filtered = range
      .map((p) => `--- PAGE ${p} ---\n${map.get(p) || ''}`)
      .join('\n\n');
    return { text: filtered };
  };

  /* ====================================================================== */
  /*  Summarize (streaming)                                                  */
  /* ====================================================================== */
  const handleSummarize = async () => {
    const payload = buildPayloadText();
    if (payload.error) { setError(payload.error); return; }

    setPhase('summarizing');
    setError(null);
    setSummary('');
    setCopied(false);

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: payload.text,
          style, length, focus, model,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || `Server error ${res.status}`);
      }
      if (!res.body) throw new Error('No response stream.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        acc += chunk;
        setSummary(acc);
      }

      setPhase('done');
    } catch (err) {
      if (err?.name === 'AbortError') {
        // user cancelled — go back to ready state, keep partial summary
        setPhase('ready');
      } else {
        console.error(err);
        setError('Summarization failed: ' + (err?.message || 'unknown error'));
        setPhase('error');
      }
    } finally {
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortRef.current) abortRef.current.abort();
  };

  /* ====================================================================== */
  /*  File picker                                                            */
  /* ====================================================================== */
  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') {
      setError('Please select a valid PDF file.');
      return;
    }
    setFile(f);
    setPdfText('');
    setSummary('');
    setError(null);
    setPageRange('');
    extractText(f);
  };

  const resetTool = () => {
    if (abortRef.current) abortRef.current.abort();
    setFile(null);
    setPdfText('');
    setSummary('');
    setError(null);
    setPhase('idle');
    setExtractProgress({ current: 0, total: 0 });
    setTotalPages(0);
    setPageRange('');
    setCopied(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  /* ====================================================================== */
  /*  Render                                                                 */
  /* ====================================================================== */
  return (
    <div className="tool-page">
      <Link href="/tools/pdf" className="tool-page-back">← Back to PDF Toolkit</Link>
      <div className="tool-page-header">
        <h1>🤖 Summarize PDF</h1>
        <p>AI-powered summaries with full control over length, style, and focus.</p>
      </div>

      <div
        className="result-container"
        style={{ padding: '20px', background: 'var(--pixel-bg-card)', border: '3px solid var(--pixel-border)' }}
      >
        {error && <div className="error-message" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

        {/* ─── Upload ─── */}
        {!file && (
          <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
            <div className="upload-zone-icon">🤖</div>
            <div className="upload-zone-text">Click or drag a PDF here to summarize</div>
            <div className="upload-zone-hint">Powered by Llama 3.3 70B. Your text is sent to the AI; the PDF stays in your browser.</div>
            <input
              type="file" ref={fileInputRef} onChange={handleFileChange}
              accept="application/pdf" style={{ display: 'none' }}
            />
          </div>
        )}

        {/* ─── Extracting progress ─── */}
        {phase === 'extracting' && (
          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 18 }}>📖</div>
            <div style={{ fontFamily: 'var(--font-pixel)', color: 'var(--pixel-cyan)', fontSize: '0.85rem', marginBottom: 16 }}>
              READING PAGE {extractProgress.current} / {extractProgress.total}
            </div>
            <div style={{
              width: '60%', maxWidth: 500, margin: '0 auto',
              height: 14, background: '#1a1a1a',
              border: '2px solid var(--pixel-border)', overflow: 'hidden',
            }}>
              <div style={{
                width: `${extractProgress.total ? (extractProgress.current / extractProgress.total) * 100 : 0}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--pixel-green) 0%, var(--pixel-cyan) 100%)',
                transition: 'width 0.2s ease',
              }} />
            </div>
          </div>
        )}

        {/* ─── Options + actions (ready / summarizing / done) ─── */}
        {file && phase !== 'extracting' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* File info */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '10px 14px', background: '#2d1b4e',
              border: '2px dashed var(--pixel-cyan)', flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: '1.3rem' }}>📄</span>
              <strong style={{ color: 'var(--pixel-cyan)' }}>{file.name}</strong>
              <span style={{ color: '#aaa', fontSize: '0.85rem' }}>
                · {totalPages} pages · {stats.words.toLocaleString()} words
              </span>
              <div style={{ flex: 1 }} />
              <button className="btn btn-ghost" onClick={resetTool}
                style={{ padding: '6px 12px', fontSize: '0.7rem' }}>
                Change PDF
              </button>
            </div>

            {/* Options */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 14,
            }}>
              <OptionCard title="Length" opts={LENGTH_OPTS} value={length} onChange={setLength} disabled={phase === 'summarizing'} />
              <OptionCard title="Style"  opts={STYLE_OPTS}  value={style}  onChange={setStyle}  disabled={phase === 'summarizing'} />
              <OptionCard title="Model"  opts={MODEL_OPTS}  value={model}  onChange={setModel}  disabled={phase === 'summarizing'} />
            </div>

            {/* Page range + focus */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14,
            }}>
              <div>
                <label style={labelStyle}>PAGE RANGE (optional)</label>
                <input
                  type="text"
                  value={pageRange}
                  disabled={phase === 'summarizing'}
                  onChange={(e) => setPageRange(e.target.value)}
                  placeholder="e.g. 1-5, 8, 12-15  (blank = all pages)"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>FOCUS (optional)</label>
                <input
                  type="text"
                  value={focus}
                  disabled={phase === 'summarizing'}
                  onChange={(e) => setFocus(e.target.value)}
                  placeholder='e.g. "financial details" or "action items"'
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {phase === 'summarizing' ? (
                <button className="btn btn-danger" onClick={handleCancel} style={{ padding: '12px 24px' }}>
                  Cancel
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={handleSummarize}
                  disabled={!pdfText}
                  style={{ padding: '12px 28px', background: 'var(--pixel-green)' }}
                >
                  {summary ? '↻ Re-summarize' : '✨ Summarize'}
                </button>
              )}
            </div>

            {/* Result */}
            {(phase === 'summarizing' || summary) && (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  marginBottom: 10, flexWrap: 'wrap',
                }}>
                  <h3 style={{
                    fontFamily: 'var(--font-pixel)', color: 'var(--pixel-cyan)',
                    fontSize: '1rem', textShadow: '2px 2px 0 #000', margin: 0,
                  }}>
                    SUMMARY
                  </h3>
                  {phase === 'summarizing' && (
                    <span style={{
                      fontSize: '0.7rem', color: 'var(--pixel-yellow)',
                      fontFamily: 'var(--font-pixel)',
                    }}>
                      ● STREAMING…
                    </span>
                  )}
                  {summary && (
                    <span style={{ fontSize: '0.75rem', color: '#aaa' }}>
                      {stats.summaryWords} words
                    </span>
                  )}
                  <div style={{ flex: 1 }} />
                  {summary && phase !== 'summarizing' && (
                    <>
                      <button className="btn btn-ghost" onClick={handleCopy}
                        style={{ padding: '6px 12px', fontSize: '0.7rem' }}>
                        {copied ? '✓ Copied' : '📋 Copy'}
                      </button>
                      <button className="btn btn-ghost"
                        onClick={() => downloadBlob(summary, `summary_${file.name.replace(/\.pdf$/i, '')}.md`, 'text/markdown')}
                        style={{ padding: '6px 12px', fontSize: '0.7rem' }}>
                        ⬇ .md
                      </button>
                      <button className="btn btn-ghost"
                        onClick={() => downloadBlob(summary, `summary_${file.name.replace(/\.pdf$/i, '')}.txt`, 'text/plain')}
                        style={{ padding: '6px 12px', fontSize: '0.7rem' }}>
                        ⬇ .txt
                      </button>
                    </>
                  )}
                </div>

                <div
                  style={{
                    background: '#2d1b4e', padding: '20px 24px',
                    border: '2px solid var(--pixel-border)', color: '#fff',
                    lineHeight: 1.7, maxHeight: '60vh', overflowY: 'auto',
                    fontSize: '0.95rem',
                  }}
                  dangerouslySetInnerHTML={{ __html: summaryHtml || '<em style="color:#aaa">Waiting for the model…</em>' }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Markdown look inside the summary box */}
      <style jsx global>{`
        .tool-page .result-container [dangerouslySetInnerHTML] { color: #fff; }
        .tool-page .result-container h1,
        .tool-page .result-container h2,
        .tool-page .result-container h3,
        .tool-page .result-container h4 {
          font-family: var(--font-pixel);
          color: var(--pixel-yellow);
          margin: 0.8em 0 0.4em;
        }
        .tool-page .result-container ul,
        .tool-page .result-container ol { padding-left: 1.4em; margin: 0.4em 0; }
        .tool-page .result-container li { margin: 0.25em 0; }
        .tool-page .result-container strong { color: var(--pixel-yellow); }
        .tool-page .result-container code {
          background: rgba(0,0,0,0.4); padding: 1px 5px;
          border-radius: 3px; font-size: 0.85em;
        }
        .tool-page .result-container pre {
          background: #0d0d0d; padding: 10px; overflow-x: auto;
          border: 1px solid #333;
        }
        .tool-page .result-container p { margin: 0.5em 0; }
        .tool-page .result-container hr { border-color: #444; }
      `}</style>
    </div>
  );
}

/* ========================================================================== */
/*  Small subcomponents                                                       */
/* ========================================================================== */

const labelStyle = {
  display: 'block',
  fontFamily: 'var(--font-pixel)', fontSize: '0.7rem',
  color: '#fff', marginBottom: 6, letterSpacing: '0.5px',
};

const inputStyle = {
  width: '100%', padding: '10px 12px',
  background: '#1a1a1a', color: '#fff',
  border: '2px solid var(--pixel-border)', fontSize: '0.9rem',
  outline: 'none',
};

function OptionCard({ title, opts, value, onChange, disabled }) {
  return (
    <div>
      <div style={labelStyle}>{title.toUpperCase()}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {opts.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(o.id)}
              className={`btn ${active ? 'btn-selected' : 'btn-ghost'}`}
              style={{
                padding: '10px 12px', textAlign: 'left',
                display: 'flex', flexDirection: 'column', gap: 3,
                alignItems: 'flex-start',
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.75rem' }}>
                {o.label}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#bbb' }}>{o.blurb}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
