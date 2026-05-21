'use client';

import { usePathname } from 'next/navigation';

export default function DynamicBackground() {
  const pathname = usePathname();

  let bgColor = '#55db64'; // Default Green (Home)

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
  } else if (pathname?.startsWith('/tools/Video')) {
    bgColor = '#e91e63'; // Pink
  } else if (pathname?.startsWith('/tools/qr-generator')) {
    bgColor = '#00bcd4'; // Cyan
  } else if (pathname?.startsWith('/tools/file-converter')) {
    bgColor = '#ff9800'; // Orange
  } else if (pathname?.startsWith('/tools/music-player')) {
    bgColor = '#2196f3'; // Blue
  } else if (pathname?.startsWith('/tools/chatbot')) {
    bgColor = '#e91e63'; // Pink
  }

  const isHome = pathname === '/';

  return (
    <>
      <div className="dynamic-retro-bg" style={{ '--dynamic-bg-color': bgColor }} />
      <style jsx global>{`
        .dynamic-retro-bg {
          position: fixed;
          inset: 0;
          background-color: var(--pixel-page-bg, var(--dynamic-bg-color));
          background-image: ${isHome ? 'conic-gradient(rgba(0, 0, 0, 0.04) 90deg, transparent 90deg 180deg, rgba(0, 0, 0, 0.04) 180deg 270deg, transparent 270deg)' : 'none'};
          background-size: 140px 140px;
          pointer-events: none;
          z-index: -1;
          transition: background-color 0.4s ease;
        }
      `}</style>
    </>
  );
}
