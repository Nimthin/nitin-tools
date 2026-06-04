'use client';
import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { marked } from 'marked';

/* ==========================================================================
   Chat with PDF — Ask AI anything about your document
   ========================================================================== */

const FULL_CONTEXT_CHAR_LIMIT = 100000; // ~100K chars ≈ 80 pages
const MAX_RETRIEVAL_PAGES = 15;
const STOP_WORDS = new Set([
  'a','an','the','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','shall','can',
  'to','of','in','for','on','with','at','by','from','as','into','through','during',
  'before','after','above','below','between','out','off','over','under','again',
  'further','then','once','here','there','when','where','why','how','all','both',
  'each','few','more','most','other','some','such','no','nor','not','only','own',
  'same','so','than','too','very','and','but','or','if','this','that','what','which',
  'who','whom','these','those','it','its','i','me','my','we','our','you','your',
  'he','him','his','she','her','they','them','their','about','up','also',
]);

/* ── Extract text from a single pdfjs page ── */
const extractPageText = (textContent) => {
  const items = textContent.items;
  if (!items?.length) return '';
  let out = '';
  let lastY = null;
  let lastEndX = null;
  let lastFontHeight = 10;

  for (const it of items) {
    const tx = it.transform;
    if (!tx) { out += it.str + ' '; continue; }
    const x = tx[4], y = tx[5];
    const fontHeight = Math.abs(tx[3]) || lastFontHeight;
    const w = it.width || 0;

    if (lastY !== null) {
      const lineGap = Math.abs(y - lastY);
      if (lineGap > fontHeight * 0.6) {
        out += '\n';
        if (lineGap > fontHeight * 1.5) out += '\n';
      } else if (lastEndX !== null && x - lastEndX > fontHeight * 0.3) {
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

/* ── Keyword-score pages for retrieval mode ── */
function scorePages(pages, question) {
  const words = question.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  if (!words.length) return pages.slice(0, MAX_RETRIEVAL_PAGES);

  const scored = pages.map((page) => {
    const text = page.text.toLowerCase();
    let score = 0;
    for (const kw of words) {
      const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = text.match(regex);
      score += matches ? matches.length : 0;
    }
    return { ...page, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const relevant = scored.filter(p => p.score > 0).slice(0, MAX_RETRIEVAL_PAGES);

  // If not enough relevant pages found, add first and last pages
  if (relevant.length < 3) {
    const fallback = [pages[0], pages[Math.min(1, pages.length - 1)], pages[pages.length - 1]]
      .filter(Boolean)
      .filter(p => !relevant.find(r => r.pageNum === p.pageNum));
    return [...relevant, ...fallback].slice(0, MAX_RETRIEVAL_PAGES);
  }

  return relevant;
}

/* ── Build the context string for the API ── */
function buildContext(pages, question, isFullContext) {
  if (isFullContext) {
    return pages.map(p => `[Page ${p.pageNum}]\n${p.text}`).join('\n\n');
  }
  const relevant = scorePages(pages, question);
  return relevant.map(p => `[Page ${p.pageNum}]\n${p.text}`).join('\n\n');
}

/* ── Render markdown to HTML ── */
function renderMarkdown(text) {
  try {
    marked.setOptions({ breaks: true, gfm: true });
    return marked.parse(text);
  } catch {
    return text.replace(/\n/g, '<br/>');
  }
}

/* ── Typing indicator dots ── */
function TypingIndicator() {
  return (
    <div className="pdfchat-typing">
      <span className="pdfchat-dot" style={{ animationDelay: '0ms' }} />
      <span className="pdfchat-dot" style={{ animationDelay: '200ms' }} />
      <span className="pdfchat-dot" style={{ animationDelay: '400ms' }} />
    </div>
  );
}

/* ==========================================================================
   MAIN COMPONENT
   ========================================================================== */
export default function ChatWithPdf() {
  // ── State ──
  const [phase, setPhase] = useState('idle'); // 'idle' | 'extracting' | 'ocr' | 'ready' | 'error'
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]); // { pageNum, text }[]
  const [isFullContext, setIsFullContext] = useState(true);
  const [isScanned, setIsScanned] = useState(false);
  const [extractProgress, setExtractProgress] = useState({ current: 0, total: 0 });
  const [ocrProgress, setOcrProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState(null);

  // Chat state
  const [messages, setMessages] = useState([]); // { role: 'user'|'assistant', content }[]
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [suggestionsVisible, setSuggestionsVisible] = useState(true);

  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Focus input when ready
  useEffect(() => {
    if (phase === 'ready') inputRef.current?.focus();
  }, [phase]);

  /* ── Render page to canvas for OCR ── */
  const renderPageToImage = async (pdf, pageNum, scale = 2) => {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/png');
    canvas.width = 0;
    canvas.height = 0;
    return dataUrl;
  };

  /* ── Handle PDF upload ── */
  const handleFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') {
      setError('Please select a valid PDF file.');
      return;
    }
    setFile(f);
    setError(null);
    setMessages([]);
    setIsScanned(false);
    setSuggestionsVisible(true);
    setPhase('extracting');

    try {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      const arrayBuffer = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      const n = pdf.numPages;
      setExtractProgress({ current: 0, total: n });

      const extractedPages = [];
      for (let i = 1; i <= n; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        extractedPages.push({ pageNum: i, text: extractPageText(tc) });
        setExtractProgress({ current: i, total: n });
      }

      const totalText = extractedPages.map(p => p.text).join(' ').trim();

      if (!totalText) {
        // OCR fallback
        setIsScanned(true);
        setPhase('ocr');
        setOcrProgress({ current: 0, total: n });

        const Tesseract = await import('tesseract.js');
        const worker = await Tesseract.createWorker('eng', 1, { logger: () => {} });

        const ocrPages = [];
        for (let i = 1; i <= n; i++) {
          setOcrProgress({ current: i, total: n });
          const pageImage = await renderPageToImage(pdf, i, 2.5);
          const { data: { text } } = await worker.recognize(pageImage);
          ocrPages.push({ pageNum: i, text: text?.trim() || '' });
        }
        await worker.terminate();
        try { pdf.destroy?.(); } catch {}

        const ocrTotal = ocrPages.map(p => p.text).join(' ').trim();
        if (!ocrTotal) {
          setPhase('error');
          setError('Could not extract any text from this PDF, even with OCR.');
          return;
        }

        const totalLen = ocrPages.reduce((s, p) => s + p.text.length, 0);
        setIsFullContext(totalLen <= FULL_CONTEXT_CHAR_LIMIT);
        setPages(ocrPages);
        setPhase('ready');
        return;
      }

      try { pdf.destroy?.(); } catch {}

      const totalLen = extractedPages.reduce((s, p) => s + p.text.length, 0);
      setIsFullContext(totalLen <= FULL_CONTEXT_CHAR_LIMIT);
      setPages(extractedPages);
      setPhase('ready');
    } catch (err) {
      console.error(err);
      setError('Failed to process PDF: ' + (err?.message || 'unknown error'));
      setPhase('error');
    }
  };

  /* ── Send a message ── */
  const sendMessage = useCallback(async (customMsg) => {
    const text = (customMsg || input).trim();
    if (!text || isThinking) return;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    setIsThinking(true);
    setSuggestionsVisible(false);

    try {
      const context = buildContext(pages, text, isFullContext);

      // Build conversation history (last 6 messages for context)
      const recentHistory = [...messages.slice(-6), userMsg];

      const apiMessages = [
        {
          role: 'system',
          content: `You are an expert document analyst. The user has uploaded a PDF document. Answer their questions based ONLY on the document content provided below. If the answer is not found in the document, say so clearly.

When referencing information, mention the page number (e.g., "According to Page 5...").
Use markdown formatting: bold for key terms, bullet points for lists, headers for sections.
Be concise but thorough.

--- DOCUMENT CONTENT ---
${context}
--- END OF DOCUMENT ---`
        },
        ...recentHistory.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        }))
      ];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          selectedModel: 'meta-llama/llama-4-scout-17b-16e-instruct'
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to get response.');

      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Error: ${err?.message || 'Something went wrong. Please try again.'}`
      }]);
    } finally {
      setIsThinking(false);
    }
  }, [input, isThinking, messages, pages, isFullContext]);

  /* ── Handle Textarea Height Change ── */
  const handleInputChange = (e) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  /* ── Handle Enter key ── */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ── Reset ── */
  const resetTool = () => {
    setFile(null);
    setPages([]);
    setMessages([]);
    setInput('');
    setError(null);
    setPhase('idle');
    setIsScanned(false);
    setIsFullContext(true);
    setSuggestionsVisible(true);
    setExtractProgress({ current: 0, total: 0 });
    setOcrProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ── Export Chat Transcript ── */
  const exportChat = () => {
    if (messages.length === 0) return;
    const header = `=== CHAT TRANSCRIPT FOR: ${file?.name} ===\nGenerated on: ${new Date().toLocaleString()}\n\n`;
    const body = messages.map(m => `[${m.role.toUpperCase()}] ${m.content}`).join('\n\n');
    const blob = new Blob([header + body], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_transcript_${file?.name.replace(/\.pdf$/i, '')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Suggested questions ── */
  const suggestions = [
    'What is this document about?',
    'Summarize the key points',
    'List the main conclusions',
    'What are the important dates mentioned?',
  ];

  const totalChars = pages.reduce((s, p) => s + p.text.length, 0);

  /* ==========================================================================
     RENDER
     ========================================================================== */
  return (
    <div className="pdfchat-page-wrapper">
      {/* ─── HEADER BAR ─── */}
      <div className="pdfchat-header-bar">
        <div className="pdfchat-header-left">
          <Link href="/tools/pdf" className="pdfchat-back-link">
            ← Back to PDF Toolkit
          </Link>
        </div>
        <div className="pdfchat-header-title">
          <span>💬</span> Chat with PDF
        </div>
        <div className="pdfchat-header-right"></div>
      </div>

      <div className="pdfchat-main-container">
        {error && <div className="error-message">⚠️ {error}</div>}

        {/* ─── UPLOAD PHASE ─── */}
        {phase === 'idle' && (
          <div className="pdfchat-centering-container">
            <div
              className="pdfchat-upload-zone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
              onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
              onDrop={e => {
                e.preventDefault();
                e.currentTarget.classList.remove('drag-over');
                const f = e.dataTransfer.files?.[0];
                if (f && f.type === 'application/pdf') {
                  const dt = new DataTransfer();
                  dt.items.add(f);
                  fileInputRef.current.files = dt.files;
                  fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }}
            >
              <div className="pdfchat-upload-icon">
                <span className="pdfchat-icon-chat">💬</span>
                <span className="pdfchat-icon-pdf">📄</span>
              </div>
              <div className="pdfchat-upload-title">Drop your PDF here or click to upload</div>
              <div className="pdfchat-upload-subtitle">Ask AI anything about your document</div>
              <div className="pdfchat-upload-divider">
                <span>SPECIFICATIONS</span>
              </div>
              <div className="pdfchat-upload-features">
                <span>📖 Unlimited File Size</span>
                <span>🔍 OCR Scanned Fallback</span>
                <span>🤖 Powered by Llama 4 AI</span>
              </div>
              <input
                type="file" ref={fileInputRef} onChange={handleFileChange}
                accept="application/pdf" style={{ display: 'none' }}
              />
            </div>
          </div>
        )}

        {/* ─── EXTRACTING PHASE ─── */}
        {phase === 'extracting' && (
          <div className="pdfchat-centering-container">
            <div className="pdfchat-progress-container">
              <div className="pdfchat-progress-icon">📖</div>
              <div className="pdfchat-progress-label">
                EXTRACTING TEXT · PAGE {extractProgress.current} OF {extractProgress.total}
              </div>
              <div className="pdfchat-progress-bar-track">
                <div
                  className="pdfchat-progress-bar-fill"
                  style={{ width: `${extractProgress.total ? (extractProgress.current / extractProgress.total) * 100 : 0}%` }}
                />
              </div>
              <div className="pdfchat-progress-hint">Reading document structure... Please stand by.</div>
            </div>
          </div>
        )}

        {/* ─── OCR PHASE ─── */}
        {phase === 'ocr' && (
          <div className="pdfchat-centering-container">
            <div className="pdfchat-progress-container border-yellow">
              <div className="pdfchat-progress-icon animate-spin-pulse">🔍</div>
              <div className="pdfchat-progress-label font-yellow">
                ⚠️ SCANNED IMAGE PDF DETECTED
              </div>
              <div className="pdfchat-progress-label">
                RUNNING OCR SCAN · PAGE {ocrProgress.current} OF {ocrProgress.total}
              </div>
              <div className="pdfchat-progress-bar-track border-yellow">
                <div
                  className="pdfchat-progress-bar-fill pdfchat-progress-bar-fill--ocr"
                  style={{ width: `${ocrProgress.total ? (ocrProgress.current / ocrProgress.total) * 100 : 0}%` }}
                />
              </div>
              <div className="pdfchat-progress-hint font-yellow-dim">Invoking Tesseract OCR Engine to extract text...</div>
            </div>
          </div>
        )}

        {/* ─── CHAT PHASE ─── */}
        {phase === 'ready' && (
          <div className="pdfchat-dashboard">
            
            {/* LEFT SIDEBAR: Document details & status */}
            <div className="pdfchat-sidebar">
              <div className="pdfchat-sidebar-section">
                <div className="pdfchat-sidebar-title">DOCUMENT INFO</div>
                <div className="pdfchat-doc-card">
                  <div className="pdfchat-doc-icon">📄</div>
                  <div className="pdfchat-doc-details">
                    <span className="pdfchat-doc-name" title={file?.name}>{file?.name}</span>
                    <span className="pdfchat-doc-size">
                      {file?.size ? (file.size / (1024 * 1024)).toFixed(2) : 0} MB
                    </span>
                  </div>
                </div>
              </div>

              <div className="pdfchat-sidebar-section">
                <div className="pdfchat-sidebar-title">ANALYSIS METRICS</div>
                <div className="pdfchat-metrics-list">
                  <div className="pdfchat-metric-item">
                    <span className="pdfchat-metric-label">Total Pages</span>
                    <span className="pdfchat-metric-value">{pages.length}</span>
                  </div>
                  <div className="pdfchat-metric-item">
                    <span className="pdfchat-metric-label">Character Count</span>
                    <span className="pdfchat-metric-value">{Math.round(totalChars / 1000)}K</span>
                  </div>
                  <div className="pdfchat-metric-item">
                    <span className="pdfchat-metric-label">Document Scan</span>
                    <span className={`pdfchat-metric-value ${isScanned ? 'font-yellow' : 'font-green'}`}>
                      {isScanned ? 'Scanned (OCR)' : 'Digital Text'}
                    </span>
                  </div>
                  <div className="pdfchat-metric-item">
                    <span className="pdfchat-metric-label">Context Mode</span>
                    <span className={`pdfchat-metric-value ${isFullContext ? 'font-green' : 'font-blue'}`}>
                      {isFullContext ? 'Full Context' : 'Smart Retrieval'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pdfchat-sidebar-section">
                <div className="pdfchat-sidebar-title">CONTEXT GAUGE</div>
                <div className="pdfchat-capacity-gauge">
                  <div className="pdfchat-capacity-bar-track">
                    <div 
                      className={`pdfchat-capacity-bar-fill ${totalChars > FULL_CONTEXT_CHAR_LIMIT ? 'fill-blue' : 'fill-green'}`} 
                      style={{ width: `${Math.min(100, (totalChars / FULL_CONTEXT_CHAR_LIMIT) * 100)}%` }}
                    />
                  </div>
                  <div className="pdfchat-capacity-text">
                    {Math.round(Math.min(100, (totalChars / FULL_CONTEXT_CHAR_LIMIT) * 100))}% of prompt buffer used
                  </div>
                </div>
              </div>

              <div className="pdfchat-sidebar-spacer"></div>

              <div className="pdfchat-sidebar-actions">
                {messages.length > 0 && (
                  <button className="btn btn-primary btn-full" onClick={exportChat}>
                    ⬇ Export Chat (.md)
                  </button>
                )}
                <button className="btn btn-danger btn-full" onClick={resetTool}>
                  📁 Change PDF
                </button>
              </div>
            </div>

            {/* RIGHT MAIN CHAT AREA */}
            <div className="pdfchat-chat-area">
              <div className="pdfchat-messages-container">
                {/* Welcome message */}
                <div className="pdfchat-msg pdfchat-msg--assistant">
                  <div className="pdfchat-msg-avatar">🤖</div>
                  <div className="pdfchat-msg-bubble">
                    <div className="pdfchat-msg-content">
                      Hi! I've loaded <strong>{file?.name}</strong> ({pages.length} pages). What would you like to know or analyze about this document?
                    </div>
                  </div>
                </div>

                {/* Suggested questions */}
                {suggestionsVisible && messages.length === 0 && (
                  <div className="pdfchat-suggestions">
                    <div className="pdfchat-suggestions-label">► RECOMMENDED ANALYTIC INQUIRIES:</div>
                    <div className="pdfchat-suggestions-grid">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          className="pdfchat-suggestion-btn"
                          onClick={() => sendMessage(s)}
                        >
                          <span className="pdfchat-suggestion-bullet">►</span> {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chat messages */}
                {messages.map((msg, i) => (
                  <div key={i} className={`pdfchat-msg pdfchat-msg--${msg.role}`}>
                    <div className="pdfchat-msg-avatar">
                      {msg.role === 'user' ? '👤' : '🤖'}
                    </div>
                    <div className="pdfchat-msg-bubble">
                      {msg.role === 'assistant' ? (
                        <div
                          className="pdfchat-msg-content pdfchat-markdown"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                        />
                      ) : (
                        <div className="pdfchat-msg-content">{msg.content}</div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Thinking indicator */}
                {isThinking && (
                  <div className="pdfchat-msg pdfchat-msg--assistant">
                    <div className="pdfchat-msg-avatar">🤖</div>
                    <div className="pdfchat-msg-bubble">
                      <TypingIndicator />
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Input bar */}
              <div className="pdfchat-input-bar">
                <textarea
                  ref={inputRef}
                  className="pdfchat-input"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about this PDF..."
                  rows={1}
                  disabled={isThinking}
                />
                <button
                  className="pdfchat-send-btn"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isThinking}
                  title="Send message"
                >
                  {isThinking ? (
                    <span className="pdfchat-send-spinner" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ─── ERROR WITH RETRY ─── */}
      {phase === 'error' && (
        <div className="pdfchat-centering-container">
          <div className="pdfchat-progress-container border-red">
            <div className="pdfchat-progress-icon">⚠️</div>
            <div className="pdfchat-progress-label font-red">EXTRACTION ERROR DETECTED</div>
            <div className="pdfchat-progress-hint" style={{ marginBottom: 24 }}>{error}</div>
            <button className="btn btn-primary" onClick={resetTool}>
              Try Another PDF
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        /* ==========================================================================
           Chat with PDF — Premium Retro Console Light Theme
           ========================================================================== */

        :root {
          --pdfchat-border: #2d3748;
          --pdfchat-border-light: #cbd5e0;
          --pdfchat-bg-sidebar: #f0f7f8;
          --pdfchat-bg-chat: #ffffff;
          --pdfchat-bg-header: #e6f4f5;
          --pdfchat-text-main: #2d3748;
          --pdfchat-text-muted: #718096;
          --pdfchat-accent-cyan: #00bcd4;
          --pdfchat-accent-blue: #007bff;
          --pdfchat-accent-green: #4caf50;
          --pdfchat-accent-yellow: #fbc02d;
          --pdfchat-accent-orange: #ff9800;
          --pdfchat-accent-red: #e53e3e;
          --pdfchat-shadow: 4px 4px 0px #2d3748;
          --pdfchat-shadow-sm: 2px 2px 0px #2d3748;
        }

        /* Helper colors */
        .font-yellow { color: var(--pdfchat-accent-orange) !important; }
        .font-yellow-dim { color: rgba(255, 152, 0, 0.7) !important; }
        .font-green { color: var(--pdfchat-accent-green) !important; }
        .font-blue { color: var(--pdfchat-accent-blue) !important; }
        .font-red { color: var(--pdfchat-accent-red) !important; }
        .border-yellow { border-color: var(--pdfchat-accent-orange) !important; }
        .border-red { border-color: var(--pdfchat-accent-red) !important; }

        /* ── Full UI Wrapper ── */
        .pdfchat-page-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          z-index: 1000;
          color: var(--pdfchat-text-main);
          font-family: var(--font-body);
        }

        /* ── Header Bar ── */
        .pdfchat-header-bar {
          height: 56px;
          background: var(--pdfchat-bg-header);
          border-bottom: 3px solid var(--pdfchat-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          flex-shrink: 0;
        }
        .pdfchat-header-left {
          display: flex;
          align-items: center;
        }
        .pdfchat-back-link {
          font-family: var(--font-pixel);
          font-size: 0.6rem;
          color: var(--pdfchat-border);
          text-decoration: none;
          padding: 6px 12px;
          background: #ffffff;
          border: 2px solid var(--pdfchat-border);
          box-shadow: var(--pdfchat-shadow-sm);
          transition: all 0.1s ease;
        }
        .pdfchat-back-link:hover {
          background: var(--pdfchat-bg-header);
          transform: translate(-1px, -1px);
          box-shadow: 3px 3px 0px var(--pdfchat-border);
        }
        .pdfchat-back-link:active {
          transform: translate(1px, 1px);
          box-shadow: 1px 1px 0px var(--pdfchat-border);
        }
        .pdfchat-header-title {
          font-family: var(--font-pixel);
          font-size: 0.8rem;
          color: var(--pdfchat-border);
          text-shadow: 1px 1px 0px rgba(0,0,0,0.1);
        }
        .pdfchat-header-right {
          width: 120px; /* Balance left back button */
        }

        .pdfchat-main-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #ffffff;
        }

        .pdfchat-centering-container {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          background: var(--pdfchat-bg-sidebar);
          padding: 20px;
        }

        /* ── Upload Zone ── */
        .pdfchat-upload-zone {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          padding: 60px 40px;
          border: 3px solid var(--pdfchat-border);
          background: #ffffff;
          cursor: pointer;
          transition: all 0.2s ease-out;
          text-align: center;
          box-shadow: var(--pdfchat-shadow);
          max-width: 540px;
          width: 100%;
        }

        .pdfchat-upload-zone:hover {
          border-color: var(--pdfchat-accent-cyan);
          transform: translateY(-3px);
          box-shadow: 6px 6px 0px var(--pdfchat-border);
        }

        .pdfchat-upload-icon {
          position: relative;
          width: 90px;
          height: 70px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pdfchat-icon-chat {
          font-size: 3.5rem;
          animation: floatChat 3s ease-in-out infinite;
        }
        .pdfchat-icon-pdf {
          font-size: 2.2rem;
          position: absolute;
          bottom: -8px;
          right: -8px;
          animation: floatPdf 3s ease-in-out infinite alternate;
          filter: drop-shadow(2px 2px 0px #ffffff);
        }

        @keyframes floatChat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes floatPdf {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(4px) scale(1.05); }
        }

        .pdfchat-upload-title {
          font-family: var(--font-pixel);
          font-size: 0.75rem;
          color: var(--pdfchat-border);
          line-height: 1.5;
        }
        .pdfchat-upload-subtitle {
          color: var(--pdfchat-text-muted);
          font-size: 0.95rem;
        }
        .pdfchat-upload-divider {
          display: flex;
          align-items: center;
          width: 80%;
          margin: 10px 0;
        }
        .pdfchat-upload-divider::before,
        .pdfchat-upload-divider::after {
          content: '';
          flex: 1;
          height: 2px;
          background: var(--pdfchat-border-light);
        }
        .pdfchat-upload-divider span {
          padding: 0 10px;
          font-family: var(--font-pixel);
          font-size: 0.5rem;
          color: var(--pdfchat-text-muted);
        }
        .pdfchat-upload-features {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .pdfchat-upload-features span {
          font-size: 0.75rem;
          color: var(--pdfchat-text-main);
          padding: 6px 12px;
          border: 2px solid var(--pdfchat-border);
          background: var(--pdfchat-bg-sidebar);
          box-shadow: 2px 2px 0px var(--pdfchat-border);
          font-weight: 500;
        }

        /* ── Progress Loader ── */
        .pdfchat-progress-container {
          text-align: center;
          padding: 50px 30px;
          background: #ffffff;
          border: 3px solid var(--pdfchat-border);
          box-shadow: var(--pdfchat-shadow);
          max-width: 480px;
          width: 100%;
        }
        .pdfchat-progress-icon {
          font-size: 3rem;
          margin-bottom: 16px;
          animation: bounceLoader 1s ease-in-out infinite;
          display: inline-block;
        }
        @keyframes bounceLoader {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .pdfchat-progress-label {
          font-family: var(--font-pixel);
          color: var(--pdfchat-border);
          font-size: 0.7rem;
          margin-bottom: 16px;
          letter-spacing: 0.05em;
        }
        .pdfchat-progress-bar-track {
          width: 90%;
          margin: 0 auto 16px;
          height: 18px;
          background: #edf2f7;
          border: 2px solid var(--pdfchat-border);
          padding: 2px;
        }
        .pdfchat-progress-bar-fill {
          height: 100%;
          background: var(--pdfchat-accent-cyan);
          transition: width 0.15s ease-out;
        }
        .pdfchat-progress-bar-fill--ocr {
          background: var(--pdfchat-accent-orange);
        }
        .pdfchat-progress-hint {
          color: var(--pdfchat-text-muted);
          font-size: 0.8rem;
          font-weight: 500;
        }

        /* ── Dashboard Layout ── */
        .pdfchat-dashboard {
          display: grid;
          grid-template-columns: 320px 1fr;
          height: 100%;
          width: 100%;
        }

        /* ── Sidebar ── */
        .pdfchat-sidebar {
          background: var(--pdfchat-bg-sidebar);
          border-right: 3px solid var(--pdfchat-border);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 22px;
          overflow-y: auto;
        }
        .pdfchat-sidebar-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pdfchat-sidebar-title {
          font-family: var(--font-pixel);
          font-size: 0.55rem;
          color: var(--pdfchat-text-muted);
          letter-spacing: 0.1em;
          padding-bottom: 4px;
          border-bottom: 2px solid var(--pdfchat-border-light);
        }

        .pdfchat-doc-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          background: #ffffff;
          border: 2px solid var(--pdfchat-border);
          box-shadow: 2px 2px 0px var(--pdfchat-border);
        }
        .pdfchat-doc-icon {
          font-size: 1.8rem;
          flex-shrink: 0;
        }
        .pdfchat-doc-details {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .pdfchat-doc-name {
          color: var(--pdfchat-border);
          font-size: 0.85rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pdfchat-doc-size {
          color: var(--pdfchat-text-muted);
          font-size: 0.75rem;
          font-family: var(--font-pixel);
          margin-top: 2px;
        }

        .pdfchat-metrics-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pdfchat-metric-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8rem;
        }
        .pdfchat-metric-label {
          color: var(--pdfchat-text-muted);
        }
        .pdfchat-metric-value {
          font-weight: 600;
          font-family: var(--font-pixel);
          font-size: 0.55rem;
          color: var(--pdfchat-text-main);
        }

        .pdfchat-capacity-gauge {
          background: #ffffff;
          border: 2px solid var(--pdfchat-border);
          padding: 10px;
          box-shadow: 2px 2px 0px var(--pdfchat-border);
        }
        .pdfchat-capacity-bar-track {
          height: 10px;
          background: #edf2f7;
          border: 1px solid var(--pdfchat-border);
          overflow: hidden;
          margin-bottom: 6px;
        }
        .pdfchat-capacity-bar-fill {
          height: 100%;
          transition: width 0.3s ease;
        }
        .fill-green { background: var(--pdfchat-accent-green); }
        .fill-blue { background: var(--pdfchat-accent-blue); }

        .pdfchat-capacity-text {
          font-size: 0.7rem;
          color: var(--pdfchat-text-muted);
          text-align: center;
        }
        .pdfchat-sidebar-spacer {
          flex: 1;
        }
        .pdfchat-sidebar-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .btn-full {
          width: 100%;
          text-align: center;
        }

        /* Custom primary/danger buttons overrides for light retro */
        .btn-primary {
          background: var(--pdfchat-accent-cyan) !important;
          border-color: var(--pdfchat-border) !important;
          color: #ffffff !important;
          text-shadow: none !important;
          box-shadow: 3px 3px 0px var(--pdfchat-border) !important;
        }
        .btn-primary:hover {
          background: #26c6da !important;
        }
        .btn-danger {
          background: var(--pdfchat-accent-red) !important;
          border-color: var(--pdfchat-border) !important;
          color: #ffffff !important;
          text-shadow: none !important;
          box-shadow: 3px 3px 0px var(--pdfchat-border) !important;
        }
        .btn-danger:hover {
          background: #ef5350 !important;
        }

        /* ── Main Chat Area ── */
        .pdfchat-chat-area {
          display: flex;
          flex-direction: column;
          background: #ffffff;
          overflow: hidden;
          height: 100%;
        }

        .pdfchat-messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* ── Message Bubbles ── */
        .pdfchat-msg {
          display: flex;
          gap: 12px;
          max-width: 85%;
          animation: slideInUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pdfchat-msg--user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }
        .pdfchat-msg--assistant {
          align-self: flex-start;
        }

        .pdfchat-msg-avatar {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          border: 2px solid var(--pdfchat-border);
          background: var(--pdfchat-bg-sidebar);
          flex-shrink: 0;
          box-shadow: var(--pdfchat-shadow-sm);
        }
        .pdfchat-msg--assistant .pdfchat-msg-avatar {
          position: relative;
        }
        .pdfchat-msg--assistant .pdfchat-msg-avatar::after {
          content: '';
          position: absolute;
          top: -2px; right: -2px;
          width: 8px; height: 8px;
          background: var(--pdfchat-accent-green);
          border: 2px solid var(--pdfchat-border);
          border-radius: 50%;
        }

        .pdfchat-msg-bubble {
          padding: 12px 18px;
          border: 2px solid var(--pdfchat-border);
          box-shadow: var(--pdfchat-shadow-sm);
          line-height: 1.6;
          font-size: 0.92rem;
        }

        .pdfchat-msg--user .pdfchat-msg-bubble {
          background: #e1f5fe;
          color: #0d47a1;
          border-right: 5px solid var(--pdfchat-accent-cyan);
        }
        .pdfchat-msg--assistant .pdfchat-msg-bubble {
          background: #f8fafc;
          color: var(--pdfchat-text-main);
          border-left: 5px solid var(--pdfchat-accent-cyan);
        }
        .pdfchat-msg-content {
          word-break: break-word;
        }
        .pdfchat-msg-content strong {
          color: #000000;
          font-weight: 700;
        }

        /* ── Suggestions Pills ── */
        .pdfchat-suggestions {
          background: var(--pdfchat-bg-sidebar);
          border: 2px solid var(--pdfchat-border);
          padding: 18px;
          margin-bottom: 8px;
        }
        .pdfchat-suggestions-label {
          font-family: var(--font-pixel);
          font-size: 0.55rem;
          color: var(--pdfchat-border);
          margin-bottom: 12px;
          letter-spacing: 0.05em;
        }
        .pdfchat-suggestions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 10px;
        }
        .pdfchat-suggestion-btn {
          padding: 10px 14px;
          background: #ffffff;
          border: 2px solid var(--pdfchat-border);
          color: var(--pdfchat-text-main);
          font-size: 0.85rem;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: var(--font-body) !important;
          text-transform: none !important;
          box-shadow: var(--pdfchat-shadow-sm);
          display: flex;
          gap: 8px;
        }
        .pdfchat-suggestion-bullet {
          color: var(--pdfchat-accent-cyan);
          font-size: 0.6rem;
          margin-top: 3px;
        }
        .pdfchat-suggestion-btn:hover {
          background: #e0f7fa;
          border-color: var(--pdfchat-accent-cyan);
          color: #006064;
          transform: translate(-1px, -1px);
          box-shadow: 3px 3px 0px var(--pdfchat-border);
        }
        .pdfchat-suggestion-btn:active {
          transform: translate(1px, 1px);
          box-shadow: 1px 1px 0px var(--pdfchat-border);
        }

        /* ── Markdown inside Assistant Bubble ── */
        .pdfchat-markdown h1,
        .pdfchat-markdown h2,
        .pdfchat-markdown h3,
        .pdfchat-markdown h4 {
          font-family: var(--font-pixel);
          color: var(--pdfchat-border);
          margin: 1.2em 0 0.5em;
          font-size: 0.7rem;
        }
        .pdfchat-markdown h1 { font-size: 0.8rem; }
        .pdfchat-markdown p { margin: 0.6em 0; }
        .pdfchat-markdown ul,
        .pdfchat-markdown ol { padding-left: 1.5em; margin: 0.6em 0; }
        .pdfchat-markdown li { margin: 0.3em 0; }
        .pdfchat-markdown strong {
          color: #000000;
          font-weight: 700;
        }

        .pdfchat-markdown table {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0;
          font-size: 0.85rem;
        }
        .pdfchat-markdown th,
        .pdfchat-markdown td {
          border: 2px solid var(--pdfchat-border);
          padding: 8px 10px;
          text-align: left;
        }
        .pdfchat-markdown th {
          background: var(--pdfchat-bg-header);
          font-family: var(--font-pixel);
          font-size: 0.55rem;
          color: var(--pdfchat-border);
        }
        .pdfchat-markdown td {
          background: #ffffff;
        }

        .pdfchat-markdown code {
          background: #f7fafc;
          color: var(--pdfchat-accent-red);
          padding: 2px 6px;
          border: 1px solid #e2e8f0;
          font-size: 0.85em;
          font-family: monospace;
        }
        .pdfchat-markdown pre {
          background: #f7fafc;
          padding: 12px 16px;
          overflow-x: auto;
          border: 2px solid var(--pdfchat-border);
          margin: 10px 0;
          box-shadow: inset 1px 1px 2px rgba(0,0,0,0.05);
        }
        .pdfchat-markdown pre code {
          background: transparent;
          border: none;
          padding: 0;
          color: inherit;
        }
        .pdfchat-markdown blockquote {
          border-left: 4px solid var(--pdfchat-accent-cyan);
          padding-left: 14px;
          color: var(--pdfchat-text-muted);
          margin: 12px 0;
          font-style: italic;
        }

        /* ── Typing Dots ── */
        .pdfchat-typing {
          display: flex;
          gap: 6px;
          padding: 6px 4px;
          align-items: center;
        }
        .pdfchat-dot {
          width: 8px;
          height: 8px;
          background: var(--pdfchat-accent-cyan);
          border: 1px solid var(--pdfchat-border);
          border-radius: 50%;
          animation: dotBounce 1.2s ease-in-out infinite;
        }
        @keyframes dotBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-6px); opacity: 1; }
        }

        /* ── Input Bar ── */
        .pdfchat-input-bar {
          display: flex;
          align-items: flex-end;
          gap: 12px;
          padding: 16px 24px;
          background: var(--pdfchat-bg-sidebar);
          border-top: 3px solid var(--pdfchat-border);
        }
        .pdfchat-input {
          flex: 1;
          resize: none;
          padding: 12px 16px;
          background: #ffffff;
          border: 2px solid var(--pdfchat-border);
          color: var(--pdfchat-text-main);
          font-size: 0.95rem;
          font-family: var(--font-body);
          outline: none;
          transition: border-color 0.2s ease;
          min-height: 44px;
          max-height: 120px;
          box-shadow: inset 1px 1px 2px rgba(0,0,0,0.05);
        }
        .pdfchat-input::placeholder {
          color: #999;
        }
        .pdfchat-input:focus {
          border-color: var(--pdfchat-accent-cyan);
        }
        .pdfchat-send-btn {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--pdfchat-accent-cyan);
          border: 2px solid var(--pdfchat-border);
          color: #ffffff;
          cursor: pointer;
          box-shadow: var(--pdfchat-shadow-sm);
          transition: all 0.15s ease;
          flex-shrink: 0;
        }
        .pdfchat-send-btn:hover:not(:disabled) {
          background: #26c6da;
          transform: translate(-1px, -1px);
          box-shadow: 3px 3px 0px var(--pdfchat-border);
        }
        .pdfchat-send-btn:active:not(:disabled) {
          transform: translate(1px, 1px);
          box-shadow: 1px 1px 0px var(--pdfchat-border);
        }
        .pdfchat-send-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          box-shadow: var(--pdfchat-shadow-sm);
          transform: none;
        }
        .pdfchat-send-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid #ffffff;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .pdfchat-dashboard {
            grid-template-columns: 1fr;
            height: auto;
          }
          .pdfchat-sidebar {
            border-right: none;
            border-bottom: 3px solid var(--pdfchat-border);
            max-height: 240px;
          }
          .pdfchat-sidebar-spacer {
            display: none;
          }
          .pdfchat-sidebar-actions {
            flex-direction: row;
          }
          .pdfchat-msg {
            max-width: 90%;
          }
          .pdfchat-suggestions-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
