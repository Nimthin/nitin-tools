'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';

/* ==========================================================================
   QR Code Generator
   --------------------------------------------------------------------------
   • Types: URL, Text, WiFi, Email, SMS, Phone, vCard
   • Customise foreground / background color, size, error correction, margin
   • Export PNG or SVG
   • Saves recent QRs to localStorage
   • Requires the `qrcode` npm package — already used here via:
       import QRCode from 'qrcode'
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
  { fg: '#000000', bg: '#ffffff' },
  { fg: '#ffffff', bg: '#000000' },
  { fg: '#1a1a1a', bg: '#ffeb3b' },
  { fg: '#ffffff', bg: '#ff007f' },
  { fg: '#ffffff', bg: '#00bcd4' },
  { fg: '#000000', bg: '#cddc39' },
  { fg: '#ffffff', bg: '#9c27b0' },
  { fg: '#ffffff', bg: '#3f51b5' },
];

const escapeWifi = (s) =>
  (s || '').replace(/([\\;,":])/g, '\\$1');

/* -------------------------------------------------------------------------- */
/*  Build the actual payload string for each type                             */
/* -------------------------------------------------------------------------- */
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

/* ==========================================================================
   Component
   ========================================================================== */

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
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');

  // Result
  const [error, setError] = useState(null);
  const [pngUrl, setPngUrl] = useState(null);
  const [svgString, setSvgString] = useState('');
  const [recent, setRecent] = useState([]);
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef(null);
  const pngUrlRef = useRef(null);

  /* ====================================================================== */
  /*  localStorage history                                                   */
  /* ====================================================================== */
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

  /* ====================================================================== */
  /*  Build payload                                                          */
  /* ====================================================================== */
  const payload = useMemo(() => buildPayload(type, fields), [type, fields]);

  /* ====================================================================== */
  /*  Render QR                                                              */
  /* ====================================================================== */
  useEffect(() => {
    if (!payload || !canvasRef.current) {
      setPngUrl(null);
      setSvgString('');
      return;
    }

    setError(null);
    const opts = {
      errorCorrectionLevel: ecLevel,
      margin,
      width: size,
      color: { dark: fgColor, light: bgColor },
    };

    QRCode.toCanvas(canvasRef.current, payload, opts)
      .then(() => {
        const url = canvasRef.current.toDataURL('image/png');
        if (pngUrlRef.current) URL.revokeObjectURL(pngUrlRef.current);
        pngUrlRef.current = url;
        setPngUrl(url);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || 'Failed to generate QR.');
      });

    QRCode.toString(payload, { ...opts, type: 'svg' })
      .then(setSvgString)
      .catch(() => {});
  }, [payload, size, margin, ecLevel, fgColor, bgColor]);

  /* ====================================================================== */
  /*  Download helpers                                                       */
  /* ====================================================================== */
  const downloadPng = () => {
    if (!pngUrl) return;
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `qr_${type}_${Date.now()}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    saveToRecent({ type, payload, at: Date.now() });
  };

  const downloadSvg = () => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `qr_${type}_${Date.now()}.svg`;
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

  /* ====================================================================== */
  /*  Render                                                                 */
  /* ====================================================================== */
  const fieldChange = (k, v) => setFields((p) => ({ ...p, [k]: v }));

  return (
    <div className="tool-page">
      <Link href="/" className="tool-page-back">← Back to Toolkit</Link>
      <div className="tool-page-header">
        <h1>▦ QR Code Generator</h1>
        <p>Make QR codes for URLs, WiFi, contacts and more — all client-side.</p>
      </div>

      <div className="result-container" style={{ padding: 20, background: 'var(--pixel-bg-card)', border: '3px solid var(--pixel-border)' }}>
        {error && <div className="error-message" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

        {/* Type tabs */}
        <div style={{
          display: 'flex', gap: 4, flexWrap: 'wrap',
          marginBottom: 16, padding: 6,
          background: '#0d0d0d', border: '2px solid var(--pixel-border)',
        }}>
          {QR_TYPES.map((t) => (
            <button
              key={t.id}
              className={`btn ${type === t.id ? 'btn-selected' : 'btn-ghost'}`}
              onClick={() => setType(t.id)}
              style={{ padding: '8px 12px', fontSize: '0.7rem', flex: '1 1 auto' }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {/* LEFT — input fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Panel title={`${QR_TYPES.find(x => x.id === type)?.label.toUpperCase()} CONTENT`}>
              {type === 'url' && (
                <TextInput
                  label="Destination URL"
                  value={fields.url}
                  onChange={(v) => fieldChange('url', v)}
                  placeholder="https://example.com"
                />
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
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ccc', fontSize: '0.85rem' }}>
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

            <Panel title="STYLE">
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <ColorField label="Foreground" value={fgColor} onChange={setFgColor} />
                <ColorField label="Background" value={bgColor} onChange={setBgColor} />
              </div>

              <div style={{ marginTop: 8 }}>
                <div style={labelStyle}>PRESETS</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {COLOR_PRESETS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => { setFgColor(p.fg); setBgColor(p.bg); }}
                      style={{
                        width: 30, height: 30, padding: 0,
                        background: p.bg, border: '2px solid #000',
                        cursor: 'pointer', position: 'relative',
                      }}
                      title={`${p.fg} on ${p.bg}`}
                      aria-label={`Preset ${i + 1}`}
                    >
                      <span style={{
                        position: 'absolute', inset: 4,
                        background: p.fg,
                      }} />
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
                <div style={labelStyle}>ERROR CORRECTION</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {EC_LEVELS.map((l) => (
                    <button
                      key={l.id} title={l.blurb}
                      className={`btn ${ecLevel === l.id ? 'btn-selected' : 'btn-ghost'}`}
                      onClick={() => setEcLevel(l.id)}
                      style={{ flex: 1, padding: '6px 8px', fontSize: '0.7rem' }}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </Panel>
          </div>

          {/* RIGHT — preview + download */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Panel title="PREVIEW">
              <div style={{
                background:
                  'repeating-conic-gradient(#1a1a1a 0% 25%, #222 0% 50%) 50% / 16px 16px',
                padding: 20, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                minHeight: 280,
              }}>
                {payload ? (
                  <canvas ref={canvasRef} style={{
                    maxWidth: '100%', maxHeight: 280,
                    imageRendering: 'pixelated',
                    boxShadow: '4px 4px 0 #000',
                  }} />
                ) : (
                  <div style={{
                    color: '#666', fontFamily: 'var(--font-pixel)',
                    fontSize: '0.75rem', textAlign: 'center',
                  }}>
                    Fill in the content to generate
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  onClick={downloadPng}
                  disabled={!payload}
                  style={{ flex: 1, padding: '10px', fontSize: '0.75rem', background: 'var(--pixel-green)' }}
                >⬇ PNG</button>
                <button
                  className="btn btn-primary"
                  onClick={downloadSvg}
                  disabled={!payload}
                  style={{ flex: 1, padding: '10px', fontSize: '0.75rem', background: 'var(--pixel-cyan)', color: '#000' }}
                >⬇ SVG</button>
                <button
                  className="btn btn-ghost"
                  onClick={copyPayload}
                  disabled={!payload}
                  style={{ padding: '10px', fontSize: '0.75rem' }}
                >
                  {copied ? '✓ Copied' : '📋 Copy data'}
                </button>
              </div>

              {payload && (
                <div style={{
                  marginTop: 10, padding: '8px 10px', background: '#0d0d0d',
                  border: '1px solid #333', fontSize: '0.75rem', color: '#aaa',
                  maxHeight: 80, overflow: 'auto', wordBreak: 'break-all',
                  fontFamily: 'monospace',
                }}>
                  {payload}
                </div>
              )}
            </Panel>

            {recent.length > 0 && (
              <Panel title="RECENT">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recent.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        // Restore as plain text content for simplicity
                        setType('text');
                        setFields((p) => ({ ...p, text: r.payload }));
                      }}
                      style={{
                        textAlign: 'left', padding: '8px 10px',
                        background: '#0d0d0d', color: '#ccc',
                        border: '1px solid #333', cursor: 'pointer',
                        fontSize: '0.75rem', fontFamily: 'monospace',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ color: 'var(--pixel-cyan)' }}>
                        {QR_TYPES.find((t) => t.id === r.type)?.icon}
                      </span>{' '}
                      {r.payload.slice(0, 60)}
                    </button>
                  ))}
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={clearRecent}
                  style={{ marginTop: 6, padding: '6px 8px', fontSize: '0.65rem' }}
                >
                  Clear history
                </button>
              </Panel>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/*  Subcomponents                                                              */
/* ========================================================================== */

const labelStyle = {
  fontFamily: 'var(--font-pixel)', fontSize: '0.65rem',
  color: '#aaa', marginBottom: 6, letterSpacing: '0.5px',
  display: 'block',
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

function TextInput({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label style={labelStyle}>{label.toUpperCase()}</label>
      <input
        type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px', background: '#0d0d0d',
          color: '#fff', border: '2px solid var(--pixel-border)',
          fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label style={labelStyle}>{label.toUpperCase()}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{
          width: '100%', padding: '10px', background: '#0d0d0d',
          color: '#fff', border: '2px solid var(--pixel-border)',
          fontSize: '0.85rem', outline: 'none', resize: 'vertical',
          fontFamily: 'inherit', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label style={labelStyle}>{label.toUpperCase()}</label>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px', background: '#0d0d0d',
          color: '#fff', border: '2px solid var(--pixel-border)',
          fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
        }}
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
    <div style={{ flex: 1, minWidth: 110 }}>
      <label style={labelStyle}>{label.toUpperCase()}</label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#0d0d0d', border: '2px solid var(--pixel-border)', padding: 4 }}>
        <input
          type="color" value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 36, height: 36, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
        />
        <input
          type="text" value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, padding: '4px', background: 'transparent', color: '#fff', border: 'none', fontSize: '0.8rem', fontFamily: 'monospace', outline: 'none' }}
        />
      </div>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.7rem', color: '#fff', marginBottom: 6 }}>
        {label}
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  );
}
