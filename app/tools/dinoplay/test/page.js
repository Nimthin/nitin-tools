'use client';

import { useState, useRef } from 'react';
import { scanTracks } from '../trackScanner';

export default function TestPage() {
  const [file, setFile] = useState(null);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const logsRef = useRef([]);

  const addLog = (msg) => {
    const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
    logsRef.current = [...logsRef.current, line];
    setLogs([...logsRef.current]);
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const runMediaInfoDiagnostic = async () => {
    if (!file) return;
    setRunning(true);
    logsRef.current = [];
    setLogs([]);

    try {
      addLog(`File: ${file.name} (${Math.round(file.size / 1024 / 1024)}MB)`);
      addLog('--- RUNNING MEDIAINFO.JS DIAGNOSTIC ---');
      addLog('Step 1: Calling scanTracks(file)...');
      
      const result = await scanTracks(file, (stage, details) => {
        addLog(`  [Progress] Stage: ${stage || 'Done'} | ${details || ''}`);
      });

      addLog('Step 2: Processing Scan Results...');
      if (result.error) {
        addLog(`❌ Error returned from scanTracks: ${result.error}`);
      } else {
        addLog(`✅ Successfully scanned tracks!`);
        addLog(`   Audio Tracks found: ${result.audioTracks.length}`);
        result.audioTracks.forEach((t) => {
          addLog(`     🔊 Index: ${t.index} | Codec: ${t.codec} | Lang: ${t.language} | Channels: ${t.channels} | Label: "${t.label}"`);
        });

        addLog(`   Subtitle Tracks found: ${result.subtitleTracks.length}`);
        result.subtitleTracks.forEach((t) => {
          addLog(`     📝 Index: ${t.index} | Codec: ${t.codec} | Lang: ${t.language} | Label: "${t.label}"`);
        });
      }
    } catch (err) {
      addLog(`❌ MediaInfo Diagnostic Error: ${String(err)}`);
    } finally {
      setRunning(false);
    }
  };

  const runFFmpegDiagnostic = async () => {
    if (!file) return;
    setRunning(true);
    logsRef.current = [];
    setLogs([]);

    try {
      addLog(`File: ${file.name} (${Math.round(file.size / 1024 / 1024)}MB)`);
      addLog('--- RUNNING FFMPEG.WASM LOAD DIAGNOSTIC ---');

      // Step 0: Check browser capabilities
      addLog('Step 0: Checking browser capabilities...');
      addLog(`  SharedArrayBuffer available: ${typeof SharedArrayBuffer !== 'undefined'}`);
      addLog(`  crossOriginIsolated: ${typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : 'N/A'}`);
      addLog(`  Worker available: ${typeof Worker !== 'undefined'}`);

      // Step 1: Import FFmpeg
      addLog('Step 1: Importing @ffmpeg/ffmpeg...');
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      addLog('  ✅ FFmpeg class imported');

      addLog('Step 2: Importing @ffmpeg/util...');
      const { toBlobURL } = await import('@ffmpeg/util');
      addLog('  ✅ toBlobURL imported');

      // Step 3: Create instance
      addLog('Step 3: Creating FFmpeg instance...');
      const ff = new FFmpeg();
      addLog(`  ✅ Instance created. ff.loaded = ${ff.loaded}`);

      // Step 4: Register log listener
      addLog('Step 4: Registering log listener...');
      ff.on('log', (event) => {
        const msg = typeof event === 'string' ? event : (event?.message ?? JSON.stringify(event));
        addLog(`  [FFmpeg LOG] ${msg}`);
      });
      addLog('  ✅ Listeners registered');

      // Step 5: Load WASM
      addLog('Step 5: Loading WASM core (Loading from local server, please wait...)');
      
      const coreURL = '/ffmpeg/ffmpeg-core-umd.js';
      const wasmURL = '/ffmpeg/ffmpeg-core-umd.wasm';
      
      addLog('  5c: Calling ff.load()...');
      await ff.load({ coreURL, wasmURL });
      addLog(`  ✅ FFmpeg loaded successfully! ff.loaded = ${ff.loaded}`);
      
      // Terminate
      try { ff.terminate(); } catch (e) {}
    } catch (err) {
      addLog(`❌ FFmpeg Diagnostic Error: ${String(err)}`);
      addLog(`  Message: ${err?.message}`);
      addLog(`  Stack: ${err?.stack}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto', fontFamily: 'monospace', color: '#fff', backgroundColor: '#111', minHeight: '100vh' }}>
      <h1 style={{ color: '#00bcd4' }}>🦖 DinoPlay Metadata Diagnostic</h1>
      <p style={{ color: '#aaa' }}>Choose a diagnostic run below to verify MediaInfo.js scanner and/or FFmpeg.wasm loading.</p>
      
      <div style={{ margin: '20px 0', padding: '20px', border: '2px dashed #00bcd4', background: '#1c1537', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <input type="file" onChange={handleFileChange} style={{ fontSize: '1rem', color: '#fff' }} />
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={runMediaInfoDiagnostic} 
            disabled={!file || running}
            style={{ 
              padding: '10px 24px', 
              background: running ? '#555' : '#4caf50', 
              color: '#fff', 
              border: 'none', 
              cursor: running ? 'wait' : 'pointer', 
              fontWeight: 'bold', 
              fontFamily: 'monospace' 
            }}
          >
            {running ? '⏳ Processing...' : '▶ Run MediaInfo.js Scan'}
          </button>
          
          <button 
            onClick={runFFmpegDiagnostic} 
            disabled={!file || running}
            style={{ 
              padding: '10px 24px', 
              background: running ? '#555' : '#00bcd4', 
              color: '#000', 
              border: 'none', 
              cursor: running ? 'wait' : 'pointer', 
              fontWeight: 'bold', 
              fontFamily: 'monospace' 
            }}
          >
            {running ? '⏳ Processing...' : '▶ Test FFmpeg.wasm Load'}
          </button>
        </div>
      </div>

      {file && (
        <div style={{ margin: '10px 0', color: '#ffeb3b' }}>
          Selected: {file.name} ({Math.round(file.size / 1024 / 1024)}MB)
        </div>
      )}

      <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '5px', color: '#00bcd4' }}>Diagnostic Output ({logs.length} lines)</h3>
      <div style={{ height: '500px', overflowY: 'auto', background: '#000', border: '1px solid #333', padding: '12px', fontSize: '0.75rem', color: '#00ff00', lineHeight: 1.5 }}>
        {logs.map((log, idx) => (
          <div key={idx} style={{ 
            marginBottom: '2px', 
            color: log.includes('❌') ? '#f44336' : log.includes('✅') ? '#4caf50' : log.includes('[Progress]') ? '#e91e63' : log.includes('🔊') || log.includes('📝') ? '#ff9800' : '#00ff00'
          }}>{log}</div>
        ))}
        {logs.length === 0 && <span style={{ color: '#555' }}>Select a file and choose a diagnostic tool to run.</span>}
      </div>
    </div>
  );
}
