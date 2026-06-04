'use client';

import { usePathname } from 'next/navigation';

export default function DynamicBackground() {
  const pathname = usePathname();

  let bgColor = '#55db64'; // Default Green (Home)
  let bgImage = 'none';

  if (pathname === '/tools/image/background-remover') {
    bgColor = '#cddc39'; // Yellow-Green
  } else if (pathname === '/tools/image/image-to-text') {
    bgColor = '#ff5722'; // Deep Orange
  } else if (pathname === '/tools/image/optimize') {
    bgColor = '#ff9800'; // Orange
  } else if (pathname === '/tools/pdf/image-to-pdf') {
    bgColor = '#3f51b5'; // Indigo
  } else if (pathname === '/tools/pdf/page-remover') {
    bgColor = '#009688'; // Teal
  } else if (pathname === '/tools/pdf/pdf-merger') {
    bgColor = '#ffc107'; // Amber
  } else if (pathname?.startsWith('/tools/image')) {
    bgColor = '#f44336'; // Red
  } else if (pathname?.startsWith('/tools/pdf')) {
    bgColor = '#00bcd4'; // Cyan
  } else if (pathname?.startsWith('/tools/youtube')) {
    bgColor = '#9c27b0'; // Purple
  } else if (pathname?.startsWith('/tools/video')) {
    bgColor = '#e91e63'; // Pink
  } else if (pathname?.startsWith('/tools/qr-generator')) {
    bgColor = '#b2e5e0';
    bgImage = 'radial-gradient(circle at 50% 30%, var(--qr-bg-grad-start, #e6f7f6) 0%, var(--qr-bg-grad-end, #b2e5e0) 100%)';
  } else if (pathname?.startsWith('/tools/file-converter')) {
    bgColor = '#ff9800'; // Orange
  } else if (pathname?.startsWith('/tools/chatbot')) {
    bgColor = '#f4efe2'; // Retro beige/putty
  } else if (pathname?.startsWith('/tools/notes')) {
    bgColor = '#f0f7f6'; // Soft pastel mint for notes
  } else if (pathname === '/tools/dinoshare') {
    bgColor = '#673ab7'; // Deep Purple (Hub)
  } else if (pathname === '/tools/dinoshare/file') {
    bgColor = '#5c6bc0'; // Indigo/Slate Blue (File share)
  } else if (pathname === '/tools/dinoshare/text') {
    bgColor = '#009688'; // Teal (Text Clipboard)
  }

  const hasGrid = pathname === '/';

  return (
    <>
      <div className="dynamic-retro-bg" style={{ '--dynamic-bg-color': bgColor }} />
      <style jsx global>{`
        .dynamic-retro-bg {
          position: fixed;
          inset: 0;
          background-color: var(--pixel-page-bg, var(--dynamic-bg-color));
          background-image: ${bgImage !== 'none' ? bgImage : (hasGrid ? 'conic-gradient(rgba(0, 0, 0, 0.04) 90deg, transparent 90deg 180deg, rgba(0, 0, 0, 0.04) 180deg 270deg, transparent 270deg)' : 'none')};
          background-size: ${bgImage !== 'none' ? 'auto' : '140px 140px'};
          pointer-events: none;
          z-index: -1;
          transition: background-color 0.4s ease, background-image 0.4s ease;
        }
      `}</style>
    </>
  );
}
