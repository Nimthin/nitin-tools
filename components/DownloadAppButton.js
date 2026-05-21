'use client';

import { useState } from 'react';

/**
 * Floating "Download App" button — retro pixel style.
 * Links to the GitHub Release APK.
 */
const GITHUB_APK_URL = 'https://github.com/Nimthin/nitin-tools/releases/latest/download/app-debug.apk';

export default function DownloadAppButton() {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9998,
      animation: 'slideUpFade 0.5s ease-out'
    }}>
      <a
        href={GITHUB_APK_URL}
        download
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 24px',
          borderRadius: '4px',
          background: 'var(--pixel-green)',
          color: '#fff',
          textDecoration: 'none',
          fontFamily: 'var(--font-pixel)',
          fontSize: '0.5rem',
          fontWeight: 400,
          border: '3px solid var(--pixel-green-dark)',
          boxShadow: '4px 4px 0px #000',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s ease',
          letterSpacing: '0.03em'
        }}
      >
        {/* Android icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z" fill="white"/>
        </svg>

        DOWNLOAD APP

        {/* Dismiss X */}
        <span
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsDismissed(true); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            borderRadius: '4px',
            background: 'rgba(0,0,0,0.2)',
            marginLeft: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            lineHeight: 1,
          }}
        >
          ✕
        </span>
      </a>
    </div>
  );
}
