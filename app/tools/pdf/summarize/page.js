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
      
      // Call Server AI (using Llama model)
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
          selectedModel: 'meta-llama/llama-4-scout-17b-16e-instruct'
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Server error while summarizing');
      }
      setSummary(data.message);
      
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
        <p>Instantly summarize your PDF documents using Llama AI.</p>
      </div>

      <div className="result-container" style={{ padding: '20px', background: 'var(--pixel-bg-card)', border: '3px solid var(--pixel-border)' }}>
        {error && <div className="error-message">⚠️ {error}</div>}
        
        {!file && !isProcessing && (
          <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
            <div className="upload-zone-icon">🤖</div>
            <div className="upload-zone-text">Click or drag a PDF here to summarize</div>
            <div className="upload-zone-hint">
              Summarizes securely using Llama AI
            </div>
            <input type="file" ref={fileInputRef} onChange={(e) => e.target.files[0] && handleSummarize(e.target.files[0])} accept="application/pdf" style={{ display: 'none' }} />
          </div>
        )}

        {isProcessing && (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <span className="spinner" style={{ width: 60, height: 60, borderWidth: 6, borderColor: 'var(--pixel-green)', borderTopColor: 'transparent' }}></span>
            <h3 style={{ marginTop: '24px', fontFamily: 'var(--font-pixel)', color: 'var(--pixel-green)', textShadow: '2px 2px 0 #000' }}>
              LLAMA AI IS SUMMARIZING...
            </h3>
          </div>
        )}

        {summary && !isProcessing && (
          <div>
            <h3 style={{ fontFamily: 'var(--font-pixel)', color: 'var(--pixel-cyan)', marginBottom: '20px', textShadow: '2px 2px 0 #000' }}>
              SUMMARY (Llama AI):
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
      </div>
    </div>
  );
}
