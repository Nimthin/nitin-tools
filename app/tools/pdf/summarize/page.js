'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';

export default function SummarizePdf() {
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

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
    setFile(selectedFile);

    try {
      const text = await extractText(selectedFile);
      
      if (!window.ai) {
        throw new Error('Chrome Built-in AI is not available. Please enable Chrome AI features.');
      }

      let session;
      try {
        session = await window.ai.assistant.create();
      } catch (e) {
        try {
          session = await window.ai.createTextSession(); 
        } catch (err) {
          throw new Error("Unable to create AI session.");
        }
      }
      
      const prompt = `Please summarize the following document in a concise, bullet-point format:\n\n${text.substring(0, 10000)}`;
      const result = await session.prompt(prompt);
      
      setSummary(result);
      if (session.destroy) session.destroy();
      
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
        <p>Uses on-device AI to instantly summarize your PDF documents locally.</p>
      </div>

      <div className="result-container" style={{ padding: '20px', background: 'var(--pixel-bg-card)', border: '3px solid var(--pixel-border)' }}>
        {error && <div className="error-message">⚠️ {error}</div>}
        
        {!file && !isProcessing && (
          <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
            <div className="upload-zone-icon">🤖</div>
            <div className="upload-zone-text">Click or drag a PDF here to summarize</div>
            <div className="upload-zone-hint">Runs 100% locally in your browser via window.ai</div>
            <input type="file" ref={fileInputRef} onChange={(e) => e.target.files[0] && handleSummarize(e.target.files[0])} accept="application/pdf" style={{ display: 'none' }} />
          </div>
        )}

        {isProcessing && (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <span className="spinner" style={{ width: 60, height: 60, borderWidth: 6, borderColor: 'var(--pixel-green)', borderTopColor: 'transparent' }}></span>
            <h3 style={{ marginTop: '24px', fontFamily: 'var(--font-pixel)', color: 'var(--pixel-green)', textShadow: '2px 2px 0 #000' }}>AI IS READING...</h3>
          </div>
        )}

        {summary && !isProcessing && (
          <div>
            <h3 style={{ fontFamily: 'var(--font-pixel)', color: 'var(--pixel-cyan)', marginBottom: '20px', textShadow: '2px 2px 0 #000' }}>SUMMARY:</h3>
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
      </div>
    </div>
  );
}
