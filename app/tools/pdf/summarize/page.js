'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export default function SummarizePdf() {
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [chromeAiAvailable, setChromeAiAvailable] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setChromeAiAvailable(!!(typeof window !== 'undefined' && window.ai));
  }, []);

  const extractText = async (file) => {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    
    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 10);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n\n';
    }
    return fullText;
  };

  const handleSummarize = async (selectedFile) => {
    setIsProcessing(true);
    setError(null);
    setSummary('');
    setUsingFallback(false);
    setFile(selectedFile);

    try {
      const text = await extractText(selectedFile);
      
      if (window.ai) {
        let session;
        try {
          session = await window.ai.assistant.create();
        } catch (e) {
          try {
            session = await window.ai.createTextSession(); 
          } catch (err) {
            throw new Error("Unable to create local AI session.");
          }
        }
        
        const prompt = `Please summarize the following document in a concise, bullet-point format:\n\n${text.substring(0, 10000)}`;
        const result = await session.prompt(prompt);
        
        setSummary(result);
        if (session.destroy) session.destroy();
      } else {
        // Fallback to Server AI
        setUsingFallback(true);
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: `Please summarize the following document in a concise, bullet-point format. Focus on core findings and render them beautifully:\n\n${text.substring(0, 15000)}`
              }
            ],
            selectedModel: 'gemini-2.5-flash'
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Server error while summarizing');
        }
        setSummary(data.message);
      }
      
    } catch (err) {
      console.error(err);
      setError('Failed to summarize: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="tool-page">
      <Link href="/tools/pdf" className="tool-page-back">← Back to PDF Toolkit</Link>
      <div className="tool-page-header">
        <h1>🤖 Summarize PDF</h1>
        <p>Uses local Chrome Built-in AI or Server fallback to instantly summarize your PDF documents.</p>
      </div>

      <div className="result-container" style={{ padding: '20px', background: 'var(--pixel-bg-card)', border: '3px solid var(--pixel-border)' }}>
        {error && <div className="error-message">⚠️ {error}</div>}
        
        {!file && !isProcessing && (
          <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
            <div className="upload-zone-icon">🤖</div>
            <div className="upload-zone-text">Click or drag a PDF here to summarize</div>
            <div className="upload-zone-hint">Runs locally via window.ai, or automatically falls back to Server AI</div>
            <input type="file" ref={fileInputRef} onChange={(e) => e.target.files[0] && handleSummarize(e.target.files[0])} accept="application/pdf" style={{ display: 'none' }} />
          </div>
        )}

        {isProcessing && (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <span className="spinner" style={{ width: 60, height: 60, borderWidth: 6, borderColor: 'var(--pixel-green)', borderTopColor: 'transparent' }}></span>
            <h3 style={{ marginTop: '24px', fontFamily: 'var(--font-pixel)', color: 'var(--pixel-green)', textShadow: '2px 2px 0 #000' }}>
              {usingFallback ? 'SERVER AI IS SUMMARIZING...' : 'LOCAL AI IS SUMMARIZING...'}
            </h3>
          </div>
        )}

        {summary && !isProcessing && (
          <div>
            <h3 style={{ fontFamily: 'var(--font-pixel)', color: 'var(--pixel-cyan)', marginBottom: '20px', textShadow: '2px 2px 0 #000' }}>
              SUMMARY {usingFallback && '(VIA SERVER AI)'}:
            </h3>
            <div style={{ background: '#2d1b4e', padding: '20px', border: '2px solid var(--pixel-border)', color: '#fff', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontSize: '1.05rem', maxHeight: '500px', overflowY: 'auto' }}>
              {summary}
            </div>
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button className="btn btn-primary" onClick={() => { setFile(null); setSummary(''); }} style={{ padding: '12px 24px' }}>
                Summarize Another PDF
              </button>
            </div>
          </div>
        )}

        {!file && !isProcessing && !chromeAiAvailable && (
          <div style={{
            marginTop: '25px',
            padding: '15px',
            background: 'rgba(255, 204, 0, 0.1)',
            border: '2px dashed #ffcc00',
            color: '#ffcc00',
            fontSize: '0.85rem',
            lineHeight: 1.5,
            textAlign: 'left'
          }}>
            <strong>ℹ️ Chrome Built-in AI is not enabled:</strong>
            <p style={{ margin: '5px 0' }}>The app will automatically fall back to using <strong>Server AI (Gemini 2.5 Flash)</strong>. However, if you want 100% private, on-device summaries, you can enable Chrome AI by following these steps:</p>
            <ol style={{ margin: '5px 0 0 20px', padding: 0 }}>
              <li>Open Chrome Canary or Dev version.</li>
              <li>Navigate to <code>chrome://flags/#optimization-guide-on-device-model</code> and set it to <strong>Enabled BypassPrefGesture</strong>.</li>
              <li>Navigate to <code>chrome://flags/#prompt-api-for-gemini-nano</code> and set it to <strong>Enabled</strong>.</li>
              <li>Relaunch Chrome, then go to <code>chrome://components</code> and check if <strong>Optimization Guide On Device Model</strong> is fully downloaded.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
