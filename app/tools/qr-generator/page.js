'use client';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import './qr-generator.css';

/* ==========================================================================
   QR Code Generator
   --------------------------------------------------------------------------
   • Types: URL, Text, WiFi, Email, SMS, Phone, vCard
   • Customise foreground / background color, size, error correction, margin
   • Export PNG or SVG
   • Saves recent QRs to localStorage
   ========================================================================== */

const QR_TYPES = [
  { id: 'url',   label: 'URL',   icon: '🔗' },
  { id: 'text',  label: 'Text',  icon: '✏️' },
  { id: 'wifi',  label: 'WiFi',  icon: '📶' },
  { id: 'email', label: 'Email', icon: '✉️' },
  { id: 'sms',   label: 'SMS',   icon: '💬' },
  { id: 'phone', label: 'Phone', icon: '📞' },
  { id: 'vcard', label: 'vCard', icon: '👤' },
];

const EC_LEVELS = [
  { id: 'L', label: 'L · ~7%',  blurb: 'Smallest QR, least resilient' },
  { id: 'M', label: 'M · ~15%', blurb: 'Balanced (default)' },
  { id: 'Q', label: 'Q · ~25%', blurb: 'High redundancy' },
  { id: 'H', label: 'H · ~30%', blurb: 'Best for logos / damage tolerance' },
];

const COLOR_PRESETS = [
  { fg: '#134b5c', bg: '#ffffff' }, // Deep Spruce on White
  { fg: '#0b7888', bg: '#e6f7f6' }, // Deep Cyan on Light Mint
  { fg: '#0d9488', bg: '#f2fbf9' }, // Teal Green on Pale Teal
  { fg: '#ea580c', bg: '#fff7ed' }, // Vibrant Orange on Soft Cream
  { fg: '#db2777', bg: '#fdf2f8' }, // Pink on Rose Water
  { fg: '#7c3aed', bg: '#f5f3ff' }, // Violet on Soft Lilac
  { fg: '#2563eb', bg: '#eff6ff' }, // Royal Blue on Soft Blue
  { fg: '#dc2626', bg: '#fef2f2' }, // Red on Soft Red
];

const escapeWifi = (s) =>
  (s || '').replace(/([\\;,":])/g, '\\$1');

function buildPayload(type, f) {
  switch (type) {
    case 'url':
      return (f.url || '').trim();
    case 'text':
      return f.text || '';
    case 'wifi': {
      const enc = f.wifiEncryption || 'WPA';
      const s = escapeWifi(f.wifiSsid);
      const p = escapeWifi(f.wifiPassword);
      const h = f.wifiHidden ? 'true' : 'false';
      if (!s) return '';
      return `WIFI:T:${enc};S:${s};P:${p};H:${h};;`;
    }
    case 'email': {
      const to = encodeURIComponent(f.emailTo || '');
      const sub = encodeURIComponent(f.emailSubject || '');
      const body = encodeURIComponent(f.emailBody || '');
      const parts = [];
      if (sub)  parts.push(`subject=${sub}`);
      if (body) parts.push(`body=${body}`);
      return `mailto:${to}${parts.length ? '?' + parts.join('&') : ''}`;
    }
    case 'sms': {
      const num = encodeURIComponent(f.smsNumber || '');
      const body = encodeURIComponent(f.smsBody || '');
      return `SMSTO:${num}:${decodeURIComponent(body)}`;
    }
    case 'phone':
      return `tel:${(f.phoneNumber || '').replace(/\s+/g, '')}`;
    case 'vcard': {
      const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
      if (f.vcName)    lines.push(`N:${f.vcName}`);
      if (f.vcName)    lines.push(`FN:${f.vcName}`);
      if (f.vcOrg)     lines.push(`ORG:${f.vcOrg}`);
      if (f.vcTitle)   lines.push(`TITLE:${f.vcTitle}`);
      if (f.vcPhone)   lines.push(`TEL;TYPE=CELL:${f.vcPhone}`);
      if (f.vcEmail)   lines.push(`EMAIL:${f.vcEmail}`);
      if (f.vcUrl)     lines.push(`URL:${f.vcUrl}`);
      if (f.vcAddress) lines.push(`ADR;TYPE=HOME:;;${f.vcAddress};;;;`);
      lines.push('END:VCARD');
      return lines.join('\n');
    }
    default:
      return '';
  }
}

export default function QrGenerator() {
  const [type, setType] = useState('url');
  const [fields, setFields] = useState({
    url: 'https://nitin-tools.vercel.app',
    text: '',
    wifiSsid: '', wifiPassword: '', wifiEncryption: 'WPA', wifiHidden: false,
    emailTo: '', emailSubject: '', emailBody: '',
    smsNumber: '', smsBody: '',
    phoneNumber: '',
    vcName: '', vcOrg: '', vcTitle: '', vcPhone: '', vcEmail: '', vcUrl: '', vcAddress: '',
  });

  // Style
  const [size, setSize] = useState(512);
  const [margin, setMargin] = useState(2);
  const [ecLevel, setEcLevel] = useState('M');
  const [fgColor, setFgColor] = useState('#134b5c');
  const [bgColor, setBgColor] = useState('#ffffff');

  // Result
  const [error, setError] = useState(null);
  const [pngUrl, setPngUrl] = useState(null);
  const [svgString, setSvgString] = useState('');
  const [recent, setRecent] = useState([]);
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef(null);
  const pngUrlRef = useRef(null);

  // Scanner state
  const [mode, setMode] = useState('generate'); // 'generate' | 'scan'
  const [scanMethod, setScanMethod] = useState('camera'); // 'camera' | 'upload'
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [copiedScanResult, setCopiedScanResult] = useState(false);

  // Center logo states
  const [centerLogo, setCenterLogo] = useState('none'); // 'none' | 'auto' | 'custom'
  const [customLogoUrl, setCustomLogoUrl] = useState(null);
  
  // URL shortening states
  const [shortenUrl, setShortenUrl] = useState(false);
  const [shortenedUrl, setShortenedUrl] = useState('');
  const [isShortening, setIsShortening] = useState(false);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const canvasHelperRef = useRef(null);

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Start camera helper
  const startCamera = async () => {
    setScanError(null);
    setScanResult(null);
    try {
      stopCamera();
      const constraints = {
        video: selectedCameraId
          ? { deviceId: { exact: selectedCameraId } }
          : { facingMode: 'environment' },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error(err);
      setScanError('Failed to access camera. Please check permissions.');
      setIsCameraActive(false);
    }
  };

  // Enumerate cameras when scanner tab is opened
  useEffect(() => {
    if (mode === 'scan' && scanMethod === 'camera') {
      navigator.mediaDevices.enumerateDevices()
        .then((devices) => {
          const videoDevices = devices.filter((d) => d.kind === 'videoinput');
          const mapped = videoDevices.map((d, index) => ({
            id: d.deviceId,
            label: d.label || `Camera ${index + 1}`,
          }));
          setCameraDevices(mapped);
          if (mapped.length > 0 && !selectedCameraId) {
            setSelectedCameraId(mapped[0].id);
          }
        })
        .catch((err) => {
          console.error('Error listing camera devices:', err);
        });
    } else {
      stopCamera();
    }
  }, [mode, scanMethod, selectedCameraId, stopCamera]);

  // Restart camera when camera selection changes
  useEffect(() => {
    if (isCameraActive && selectedCameraId) {
      startCamera();
    }
  }, [selectedCameraId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Video scanning loop
  useEffect(() => {
    let frameId;
    const scanFrame = () => {
      if (!videoRef.current || !isCameraActive) return;
      const video = videoRef.current;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        if (!canvasHelperRef.current) {
          canvasHelperRef.current = document.createElement('canvas');
        }
        const canvas = canvasHelperRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code) {
          setScanResult(code.data);
        }
      }
      frameId = requestAnimationFrame(scanFrame);
    };

    if (isCameraActive) {
      frameId = requestAnimationFrame(scanFrame);
    }
    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isCameraActive]);

  // Image upload decoding
  const processUploadedFile = (file) => {
    setScanError(null);
    setScanResult(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      setUploadedImage(dataUrl);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          setScanResult(code.data);
        } else {
          setScanError('No valid QR code found in the image.');
        }
      };
      img.onerror = () => {
        setScanError('Failed to load image file.');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleImageDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const copyPayloadFromScan = async () => {
    if (!scanResult) return;
    try {
      await navigator.clipboard.writeText(scanResult);
      setCopiedScanResult(true);
      setTimeout(() => setCopiedScanResult(false), 1500);
    } catch {}
  };

  // Logo upload helper
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCustomLogoUrl(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // TinyURL shortener effect
  useEffect(() => {
    if (type === 'url' && shortenUrl && fields.url) {
      setIsShortening(true);
      const urlToShorten = fields.url.trim();
      if (!urlToShorten.startsWith('http')) {
        setIsShortening(false);
        setShortenedUrl('');
        return;
      }
      
      const timer = setTimeout(() => {
        fetch(`https://tinyurl.com/api-create?url=${encodeURIComponent(urlToShorten)}`)
          .then((res) => res.text())
          .then((short) => {
            if (short && short.startsWith('http')) {
              setShortenedUrl(short);
            } else {
              setShortenedUrl('');
            }
            setIsShortening(false);
          })
          .catch((err) => {
            console.error("Shortening failed:", err);
            setShortenedUrl('');
            setIsShortening(false);
          });
      }, 600); // Debounce typing
      
      return () => clearTimeout(timer);
    } else {
      setShortenedUrl('');
      setIsShortening(false);
    }
  }, [fields.url, shortenUrl, type]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('qr-recent');
      if (raw) setRecent(JSON.parse(raw));
    } catch {}
  }, []);

  const saveToRecent = (entry) => {
    setRecent((prev) => {
      const next = [entry, ...prev.filter((p) => p.payload !== entry.payload)].slice(0, 6);
      try { localStorage.setItem('qr-recent', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const deleteRecentItem = (e, indexToDelete) => {
    e.stopPropagation();
    setRecent((prev) => {
      const next = prev.filter((_, idx) => idx !== indexToDelete);
      try { localStorage.setItem('qr-recent', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const payload = useMemo(() => {
    if (type === 'url' && shortenUrl && shortenedUrl) {
      return shortenedUrl;
    }
    return buildPayload(type, fields);
  }, [type, fields, shortenUrl, shortenedUrl]);

  useEffect(() => {
    if (!payload || !canvasRef.current) {
      setPngUrl(null);
      setSvgString('');
      return;
    }

    setError(null);
    const opts = {
      errorCorrectionLevel: centerLogo !== 'none' ? 'Q' : ecLevel, // Force high redundancy if center logo is used
      margin,
      width: size,
      color: { dark: fgColor, light: bgColor },
    };

    QRCode.toCanvas(canvasRef.current, payload, opts)
      .then(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        const finalizeCanvas = () => {
          const url = canvas.toDataURL('image/png');
          if (pngUrlRef.current) URL.revokeObjectURL(pngUrlRef.current);
          pngUrlRef.current = url;
          setPngUrl(url);
        };

        if (centerLogo !== 'none') {
          const canvasSize = canvas.width;
          const logoSize = canvasSize * 0.22;
          const x = (canvasSize - logoSize) / 2;
          const y = (canvasSize - logoSize) / 2;

          // Draw circular mask container matching background color
          ctx.fillStyle = bgColor;
          ctx.beginPath();
          ctx.arc(canvasSize / 2, canvasSize / 2, logoSize / 2 + 5, 0, 2 * Math.PI);
          ctx.fill();

          if (centerLogo === 'custom' && customLogoUrl) {
            const img = new Image();
            img.onload = () => {
              ctx.save();
              ctx.beginPath();
              ctx.arc(canvasSize / 2, canvasSize / 2, logoSize / 2, 0, 2 * Math.PI);
              ctx.clip();
              ctx.drawImage(img, x, y, logoSize, logoSize);
              ctx.restore();
              finalizeCanvas();
            };
            img.onerror = () => {
              finalizeCanvas();
            };
            img.src = customLogoUrl;
          } else {
            // Draw auto-emojis
            const logoText = centerLogo === 'auto'
              ? (QR_TYPES.find((x) => x.id === type)?.icon || '🔗')
              : centerLogo;
            ctx.font = `bold ${logoSize * 0.72}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = fgColor;
            ctx.fillText(logoText, canvasSize / 2, canvasSize / 2);
            finalizeCanvas();
          }
        } else {
          finalizeCanvas();
        }
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || 'Failed to generate QR.');
      });

    QRCode.toString(payload, { ...opts, type: 'svg' })
      .then(setSvgString)
      .catch(() => {});
  }, [payload, size, margin, ecLevel, fgColor, bgColor, centerLogo, customLogoUrl, type]);

  const downloadPng = () => {
    if (!pngUrl) return;
    const defaultName = `qr_${type}_${Date.now()}`;
    const name = prompt("Enter a filename for the PNG image (without extension):", defaultName);
    if (name === null) return; // user cancelled
    const filename = (name.trim() || defaultName) + ".png";

    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    saveToRecent({ type, payload, at: Date.now() });
  };

  const downloadSvg = () => {
    if (!svgString) return;
    const defaultName = `qr_${type}_${Date.now()}`;
    const name = prompt("Enter a filename for the SVG image (without extension):", defaultName);
    if (name === null) return; // user cancelled
    const filename = (name.trim() || defaultName) + ".svg";

    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    saveToRecent({ type, payload, at: Date.now() });
  };

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const clearRecent = () => {
    setRecent([]);
    try { localStorage.removeItem('qr-recent'); } catch {}
  };

  const fieldChange = (k, v) => setFields((p) => ({ ...p, [k]: v }));

  return (
    <div className="qr-generator-page">
      {/* Header bar */}
      <div className="qr-header">
        <Link href="/" className="qr-back-btn">← Back to Toolkit</Link>
        <div className="qr-title-group">
          <h1>QR Code Generator</h1>
          <p>Make or scan QR codes — all client-side.</p>
        </div>
        <div className="qr-mode-toggle">
          <button 
            className={`qr-mode-btn ${mode === 'generate' ? 'active' : ''}`}
            onClick={() => setMode('generate')}
          >
            ➕ Generate
          </button>
          <button 
            className={`qr-mode-btn ${mode === 'scan' ? 'active' : ''}`}
            onClick={() => {
              setMode('scan');
              setScanResult(null);
              setScanError(null);
            }}
          >
            🔍 Scan QR
          </button>
        </div>
      </div>

      {error && mode === 'generate' && <div className="error-message" style={{ margin: '16px 24px 0 24px' }}>⚠️ {error}</div>}

      {mode === 'generate' ? (
        /* Main Workspace split into 3 scrollable panes */
        <div className="qr-workspace">
          {/* PANE 1 — Content Selection & Inputs */}
          <div className="qr-pane qr-pane-left">
            <div className="qr-tabs-container">
              <span className="qr-section-label">Select Content Type</span>
              <div className="qr-tabs">
                {QR_TYPES.map((t) => (
                  <button
                    key={t.id}
                    className={`qr-tab-btn ${type === t.id ? 'active' : ''}`}
                    onClick={() => setType(t.id)}
                  >
                    <span className="tab-icon">{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Panel title={`${QR_TYPES.find(x => x.id === type)?.label.toUpperCase()} CONTENT`}>
              {type === 'url' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <TextInput
                    label="Destination URL"
                    value={fields.url}
                    onChange={(v) => fieldChange('url', v)}
                    placeholder="https://example.com"
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <label className="qr-checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={shortenUrl}
                        onChange={(e) => setShortenUrl(e.target.checked)} 
                      />
                      ⚡ Shorten URL (simpler QR)
                    </label>
                    {isShortening && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--pixel-cyan)', fontWeight: 600 }}>
                        Shortening...
                      </span>
                    )}
                  </div>
                </div>
              )}
              {type === 'text' && (
                <TextArea
                  label="Text"
                  value={fields.text}
                  onChange={(v) => fieldChange('text', v)}
                  placeholder="Any text you want to encode"
                />
              )}
              {type === 'wifi' && (
                <>
                  <TextInput label="Network name (SSID)"
                    value={fields.wifiSsid} onChange={(v) => fieldChange('wifiSsid', v)}
                    placeholder="MyHomeWifi" />
                  <TextInput label="Password"
                    type="password"
                    value={fields.wifiPassword} onChange={(v) => fieldChange('wifiPassword', v)}
                    placeholder="••••••••" />
                  <Select
                    label="Encryption"
                    value={fields.wifiEncryption}
                    onChange={(v) => fieldChange('wifiEncryption', v)}
                    options={[
                      { id: 'WPA',  label: 'WPA / WPA2 / WPA3' },
                      { id: 'WEP',  label: 'WEP' },
                      { id: 'nopass', label: 'No password' },
                    ]}
                  />
                  <label className="qr-checkbox-label">
                    <input type="checkbox" checked={fields.wifiHidden}
                      onChange={(e) => fieldChange('wifiHidden', e.target.checked)} />
                    Hidden network
                  </label>
                </>
              )}
              {type === 'email' && (
                <>
                  <TextInput label="To" value={fields.emailTo} onChange={(v) => fieldChange('emailTo', v)} placeholder="someone@example.com" />
                  <TextInput label="Subject" value={fields.emailSubject} onChange={(v) => fieldChange('emailSubject', v)} placeholder="Hello" />
                  <TextArea label="Body" value={fields.emailBody} onChange={(v) => fieldChange('emailBody', v)} placeholder="Message…" />
                </>
              )}
              {type === 'sms' && (
                <>
                  <TextInput label="Phone number" value={fields.smsNumber} onChange={(v) => fieldChange('smsNumber', v)} placeholder="+1 555 0123" />
                  <TextArea label="Message" value={fields.smsBody} onChange={(v) => fieldChange('smsBody', v)} placeholder="Hi!" />
                </>
              )}
              {type === 'phone' && (
                <TextInput label="Phone number" value={fields.phoneNumber} onChange={(v) => fieldChange('phoneNumber', v)} placeholder="+1 555 0123" />
              )}
              {type === 'vcard' && (
                <>
                  <TextInput label="Full name"   value={fields.vcName}    onChange={(v) => fieldChange('vcName', v)}    placeholder="Nitin Kumar" />
                  <TextInput label="Organization" value={fields.vcOrg}    onChange={(v) => fieldChange('vcOrg', v)}     placeholder="EXL Service" />
                  <TextInput label="Title"        value={fields.vcTitle}  onChange={(v) => fieldChange('vcTitle', v)}   placeholder="Engineer" />
                  <TextInput label="Phone"        value={fields.vcPhone}  onChange={(v) => fieldChange('vcPhone', v)}   placeholder="+1 555 0123" />
                  <TextInput label="Email"        value={fields.vcEmail}  onChange={(v) => fieldChange('vcEmail', v)}   placeholder="hello@you.com" />
                  <TextInput label="Website"      value={fields.vcUrl}    onChange={(v) => fieldChange('vcUrl', v)}     placeholder="https://you.com" />
                  <TextInput label="Address"      value={fields.vcAddress} onChange={(v) => fieldChange('vcAddress', v)} placeholder="Street, City" />
                </>
              )}
            </Panel>
          </div>

          {/* PANE 2 — Styling & Settings */}
          <div className="qr-pane qr-pane-middle">
            <Panel title="QR DESIGN & COLORS">
              <div className="qr-color-row">
                <ColorField label="Foreground" value={fgColor} onChange={setFgColor} />
                <ColorField label="Background" value={bgColor} onChange={setBgColor} />
              </div>

              <div style={{ marginTop: 4 }}>
                <span className="qr-label" style={{ marginBottom: 6, display: 'block' }}>QUICK PRESETS</span>
                <div className="qr-presets-grid">
                  {COLOR_PRESETS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => { setFgColor(p.fg); setBgColor(p.bg); }}
                      className="qr-preset-btn"
                      style={{ background: p.bg }}
                      title={`${p.fg} on ${p.bg}`}
                      aria-label={`Preset ${i + 1}`}
                    >
                      <span className="qr-preset-inner" style={{ background: p.fg }} />
                    </button>
                  ))}
                </div>
              </div>

              <Slider label={`Size ${size}px`}
                min={128} max={1024} step={32}
                value={size} onChange={setSize} />

              <Slider label={`Margin ${margin}`}
                min={0} max={10} step={1}
                value={margin} onChange={setMargin} />

              <div>
                <span className="qr-label" style={{ marginBottom: 6, display: 'block' }}>ERROR CORRECTION</span>
                <div className="qr-ec-grid" style={{ marginBottom: 16 }}>
                  {EC_LEVELS.map((l) => (
                    <button
                      key={l.id} title={l.blurb}
                      className={`qr-ec-btn ${ecLevel === l.id ? 'active' : ''}`}
                      onClick={() => setEcLevel(l.id)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="qr-label" style={{ marginBottom: 6, display: 'block' }}>CENTER LOGO / ICON</span>
                <div className="qr-ec-grid" style={{ marginBottom: 12 }}>
                  {[
                    { id: 'none', label: 'None' },
                    { id: 'auto', label: 'Auto Icon' },
                    { id: 'custom', label: 'Custom Logo' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      className={`qr-ec-btn ${centerLogo === opt.id ? 'active' : ''}`}
                      onClick={() => {
                        setCenterLogo(opt.id);
                        if (opt.id === 'custom' && !customLogoUrl) {
                          // Trigger file upload helper automatically
                          setTimeout(() => document.getElementById('logo-file-picker')?.click(), 100);
                        }
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {centerLogo === 'custom' && (
                  <div className="qr-logo-upload-wrap">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      id="logo-file-picker"
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="logo-file-picker" className="qr-logo-upload-btn">
                      {customLogoUrl ? '🔄 Change Logo' : '📤 Upload Logo'}
                    </label>
                    {customLogoUrl && (
                      <div className="qr-logo-preview-badge">
                        <img src={customLogoUrl} alt="Logo preview" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Panel>
          </div>

          {/* PANE 3 — Preview, Download, and History */}
          <div className="qr-pane qr-pane-right">
            <Panel title="GENERATED PREVIEW">
              <div className="qr-preview-wrapper">
                {payload ? (
                  <canvas ref={canvasRef} className="qr-canvas" />
                ) : (
                  <div style={{
                    color: 'var(--pixel-text-dim)',
                    fontSize: '0.85rem', textAlign: 'center', lineHeight: '1.8'
                  }}>
                    Fill in the content<br />to generate
                  </div>
                )}
              </div>

              <div className="qr-action-row">
                <button
                  className="qr-action-btn qr-btn-green"
                  onClick={downloadPng}
                  disabled={!payload}
                >
                  ⬇ PNG
                </button>
                <button
                  className="qr-action-btn qr-btn-cyan"
                  onClick={downloadSvg}
                  disabled={!payload}
                >
                  ⬇ SVG
                </button>
                <button
                  className="qr-action-btn qr-btn-dark"
                  onClick={copyPayload}
                  disabled={!payload}
                >
                  {copied ? '✓ Copied' : '📋 Copy data'}
                </button>
              </div>

              {payload && (
                <div className="qr-payload-box">
                  {payload}
                </div>
              )}
            </Panel>

            {recent.length > 0 && (
              <Panel title="RECENT SCAN LOG">
                <div className="qr-history-list">
                  {recent.map((r, i) => (
                    <div key={i} className="qr-history-item">
                      <button
                        className="qr-history-click-area"
                        onClick={() => {
                          setType(r.type);
                          if (r.type === 'text') {
                            setFields((p) => ({ ...p, text: r.payload }));
                          } else if (r.type === 'url') {
                            setFields((p) => ({ ...p, url: r.payload }));
                          } else {
                            setFields((p) => ({ ...p, text: r.payload }));
                            setType('text'); // fallback
                          }
                        }}
                      >
                        <span style={{ color: 'var(--pixel-cyan)', marginRight: 6 }}>
                          {QR_TYPES.find((t) => t.id === r.type)?.icon}
                        </span>
                        {r.payload.slice(0, 60)}
                      </button>
                      <button 
                        className="qr-history-delete-btn"
                        onClick={(e) => deleteRecentItem(e, i)}
                        title="Delete entry"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="qr-action-btn qr-btn-dark"
                  onClick={clearRecent}
                  style={{ marginTop: 8, padding: '8px 14px', fontSize: '0.72rem', width: 'auto' }}
                >
                  Clear history
                </button>
              </Panel>
            )}
          </div>
        </div>
      ) : (
        /* Scan Workspace */
        <div className="qr-workspace">
          {/* PANE 1 — Scan Controls */}
          <div className="qr-pane qr-pane-left" style={{ flex: 1.2 }}>
            <Panel title="CHOOSE SCAN METHOD">
              <div className="qr-scan-methods">
                <button
                  className={`qr-ec-btn ${scanMethod === 'camera' ? 'active' : ''}`}
                  onClick={() => {
                    setScanMethod('camera');
                    setScanResult(null);
                    setScanError(null);
                  }}
                >
                  📷 Camera Scan
                </button>
                <button
                  className={`qr-ec-btn ${scanMethod === 'upload' ? 'active' : ''}`}
                  onClick={() => {
                    setScanMethod('upload');
                    setScanResult(null);
                    setScanError(null);
                    stopCamera();
                  }}
                >
                  📤 Upload Image
                </button>
              </div>
            </Panel>

            {scanMethod === 'camera' && (
              <Panel title="CAMERA SETTINGS">
                {cameraDevices.length > 0 ? (
                  <Select
                    label="Select Camera"
                    value={selectedCameraId}
                    onChange={setSelectedCameraId}
                    options={cameraDevices}
                  />
                ) : (
                  <div style={{ fontSize: '0.78rem', color: 'var(--pixel-text-dim)', marginBottom: 8 }}>
                    Searching for cameras...
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  {isCameraActive ? (
                    <button className="qr-action-btn qr-btn-dark" onClick={stopCamera} style={{ flex: 1 }}>
                      Stop Camera
                    </button>
                  ) : (
                    <button className="qr-action-btn qr-btn-cyan" onClick={startCamera} style={{ flex: 1 }}>
                      Start Camera
                    </button>
                  )}
                </div>
              </Panel>
            )}

            {scanMethod === 'upload' && (
              <Panel title="UPLOAD QR IMAGE">
                <div
                  className="qr-upload-area"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleImageDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span style={{ fontSize: '1.8rem' }}>📁</span>
                  <span>Drag & Drop or Click to Select QR Image</span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                </div>
              </Panel>
            )}
          </div>

          {/* PANE 2 — Scanner Preview & Result */}
          <div className="qr-pane qr-pane-right" style={{ flex: 1.8 }}>
            <Panel title="SCANNER PREVIEW">
              <div className="qr-scanner-preview-container">
                {scanMethod === 'camera' ? (
                  <div className="qr-camera-wrapper">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="qr-video-feed"
                      style={{ display: isCameraActive ? 'block' : 'none' }}
                    />
                    {!isCameraActive && (
                      <div className="qr-scanner-placeholder">
                        <span>Camera is inactive. Click "Start Camera" to scan.</span>
                      </div>
                    )}
                    {isCameraActive && (
                      <div className="qr-scanner-overlay-box">
                        <div className="qr-scanner-target-box"></div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="qr-upload-preview-wrapper" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {uploadedImage ? (
                      <img src={uploadedImage} alt="Uploaded QR code" className="qr-uploaded-img" />
                    ) : (
                      <div className="qr-scanner-placeholder">
                        <span>No image uploaded. Drag & drop or select an image file.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Panel>

            {scanResult && (
              <Panel title="DECODED RESULT">
                <div className="qr-scan-result-card">
                  <span className="qr-scan-result-label">Decoded Payload:</span>
                  <div className="qr-payload-box" style={{ maxHeight: 'none', margin: '4px 0' }}>
                    {scanResult}
                  </div>
                  <div className="qr-action-row" style={{ marginTop: 8 }}>
                    <button className="qr-action-btn qr-btn-cyan" onClick={copyPayloadFromScan}>
                      {copiedScanResult ? '✓ Copied' : '📋 Copy Data'}
                    </button>
                    {scanResult.startsWith('http') && (
                      <a
                        href={scanResult}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="qr-action-btn qr-btn-green"
                        style={{ textDecoration: 'none' }}
                      >
                        🔗 Open Link
                      </a>
                    )}
                    <button
                      className="qr-action-btn qr-btn-dark"
                      onClick={() => {
                        setMode('generate');
                        // Pre-populate payload in generator
                        if (scanResult.startsWith('http')) {
                          setType('url');
                          setFields((p) => ({ ...p, url: scanResult }));
                        } else {
                          setType('text');
                          setFields((p) => ({ ...p, text: scanResult }));
                        }
                      }}
                    >
                      ✏️ Load in Generator
                    </button>
                  </div>
                </div>
              </Panel>
            )}

            {scanError && (
              <div className="error-message" style={{ margin: '8px 0' }}>
                ⚠️ {scanError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/*  Subcomponents                                                              */
/* ========================================================================== */

function Panel({ title, children }) {
  return (
    <div className="qr-panel">
      <div className="qr-panel-title">{title}</div>
      {children}
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div className="qr-input-group">
      <label className="qr-label">{label.toUpperCase()}</label>
      <input
        type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="qr-input"
      />
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder }) {
  return (
    <div className="qr-input-group">
      <label className="qr-label">{label.toUpperCase()}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="qr-textarea"
      />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div className="qr-input-group">
      <label className="qr-label">{label.toUpperCase()}</label>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className="qr-select"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <div className="qr-color-field">
      <label className="qr-label">{label.toUpperCase()}</label>
      <div className="qr-color-input-wrapper">
        <input
          type="color" value={value}
          onChange={(e) => onChange(e.target.value)}
          className="qr-color-picker"
        />
        <input
          type="text" value={value}
          onChange={(e) => onChange(e.target.value)}
          className="qr-color-text"
        />
      </div>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange }) {
  const parts = label.split(' ');
  const title = parts[0];
  const val = parts.slice(1).join(' ');
  
  return (
    <div className="qr-slider-group">
      <div className="qr-slider-header">
        <label className="qr-label">{title.toUpperCase()}</label>
        <span className="qr-slider-val">{val}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="qr-slider"
      />
    </div>
  );
}
