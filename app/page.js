'use client';

import { useState } from 'react';
import ToolCard from '@/components/ToolCard';
import Chatbot from '@/components/Chatbot';
import DarkModeToggle from '@/components/DarkModeToggle';
import Image from 'next/image';
import React from 'react';
import PixelIcon from '@/components/PixelIcon';

const allTools = [
  {
    title: 'Image Toolkit',
    description: 'Remove backgrounds and extract text with local AI.',
    icon: <PixelIcon type="image" size={32} />,
    href: '/tools/image',
  },
  {
    title: 'PDF Toolkit',
    description: 'Convert images to PDF and manage your pages securely.',
    icon: <PixelIcon type="pdf" size={32} />,
    href: '/tools/pdf',
  },
  {
    title: 'YouTube to MP3',
    description: 'Download high-quality audio from any YouTube video.',
    icon: <PixelIcon type="youtube" size={32} />,
    href: '/tools/youtube-audio',
  },
  {
    title: 'File converter',
    description: 'Convert files, documents, and media formats instantly.',
    icon: <PixelIcon type="convert" size={32} />,
    href: '/tools/file-converter',
  },
  {
    title: 'NitinMusic',
    description: 'Ad-free music streaming and trending charts.',
    icon: <PixelIcon type="music" size={32} />,
    href: '/tools/music-player',
  },
  {
    title: 'AI Chatbot',
    description: 'Chat with an intelligent AI assistant.',
    icon: <PixelIcon type="bot" size={32} />,
    href: '/tools/chatbot',
  },
];

const subTools = [
  {
    title: 'Background Remover',
    description: 'Instantly strip image backgrounds using local AI.',
    icon: <PixelIcon type="magic" size={32} />,
    href: '/tools/image/background-remover',
  },
  {
    title: 'Image to Text (OCR)',
    description: 'Extract text from any image instantly.',
    icon: <PixelIcon type="notes" size={32} />,
    href: '/tools/image/image-to-text',
  },
  {
    title: 'Image to PDF',
    description: 'Convert and compile multiple images into a PDF.',
    icon: <PixelIcon type="photos" size={32} />,
    href: '/tools/pdf/image-to-pdf',
  },
  {
    title: 'PDF Page Remover',
    description: 'Visually select and delete PDF pages.',
    icon: <PixelIcon type="scissors" size={32} />,
    href: '/tools/pdf/page-remover',
  },
  {
    title: 'PDF Merger',
    description: 'Combine multiple PDF files into one.',
    icon: <PixelIcon type="link" size={32} />,
    href: '/tools/pdf/pdf-merger',
  }
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');

  const itemsToSearch = searchQuery.trim() === '' ? allTools : [...allTools, ...subTools];

  const filteredTools = itemsToSearch.filter(tool =>
    tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="home-bg">

      {/* Floating pixel stickers — decorative */}
      <div className="pixel-stickers" aria-hidden="true">
        <span className="sticker sticker-1">⭐</span>
        <span className="sticker sticker-2">🔧</span>
        <span className="sticker sticker-3">💎</span>
        <span className="sticker sticker-4">🎮</span>
        <span className="sticker sticker-5">⚡</span>
        <span className="sticker sticker-6">🌟</span>
      </div>

      <section className="hero">
        <h1 className="hero-animated-title" style={{ lineHeight: '1.2', margin: 0 }}>
          <span className="hero-title-line">Your Personal</span>
          <br />
          <span className="hero-gradient-text">Toolkit</span>
        </h1>


        <div style={{ maxWidth: '500px', margin: '24px auto 0', position: 'relative' }}>
          <input
            type="text"
            placeholder="Search for a tool..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="hero-search-input"
          />
          <span style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--pixel-text-muted)',
            fontSize: '1.1rem'
          }}>
            🔍
          </span>
        </div>
      </section>

      <section className="tools-section">
        <h2 className="tools-section-title">
          {filteredTools.length > 0 ? '▶ Available Tools' : '✕ No tools found'}
        </h2>
        <div className="tools-grid">
          {filteredTools.map((tool, index) => (
            <ToolCard key={tool.href} {...tool} index={index} />
          ))}
        </div>
      </section>

      <footer className="retro-footer">
        <div className="retro-footer-grid">
          <div className="footer-brand">
            <h3>DinoTools</h3>
            <p>Fast, private utility tools. No ads, no BS.</p>
          </div>

          <div className="footer-links">
            <h3>Utilities</h3>
            <a href="/tools/image">Image Toolkit</a>
            <a href="/tools/pdf">PDF Toolkit</a>
            <a href="/tools/youtube-audio">YouTube MP3</a>
          </div>

          <div className="footer-download">
            <h3>Get The App</h3>
            <p>Run DinoTools natively on your Android device.</p>
            <a
              href="https://github.com/Nimthin/nitin-tools/releases/latest/download/app-debug.apk"
              download
              className="footer-apk-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z" fill="currentColor" />
              </svg>
              DOWNLOAD APK
            </a>
          </div>
        </div>

        <div className="retro-footer-bottom">
          Built with ❤️ by Nitin
        </div>
      </footer>

      <Chatbot />
      <DarkModeToggle />

      {/* Inline styles for homepage background + stickers */}
      <style jsx>{`
        /* Pixel text outlines for readability */
        .hero-title-line {
          color: #ffffff;
          text-shadow: 
            -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000,
            -3px 0 0 #000, 3px 0 0 #000, 0 -3px 0 #000, 0 3px 0 #000,
            6px 6px 0px rgba(0,0,0,0.5);
        }
        
        .hero-gradient-text {
          color: var(--pixel-yellow);
          text-shadow: 
            -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000,
            -3px 0 0 #000, 3px 0 0 #000, 0 -3px 0 #000, 0 3px 0 #000,
            6px 6px 0px rgba(0,0,0,0.5);
          display: inline-block;
          animation: pixelGlow 2s ease-in-out infinite alternate;
        }
        
        .hero-subtitle {
          font-size: 1rem;
          color: #ffffff;
          text-shadow: 
            -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000,
            -2px 0 0 #000, 2px 0 0 #000, 0 -2px 0 #000, 0 2px 0 #000;
          margin-top: 12px;
          line-height: 1.6;
          font-weight: bold;
        }
        
        /* Outline for section titles too */
        :global(.tools-section-title) {
          color: var(--pixel-cyan) !important;
          text-shadow: 
            -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000,
            -2px 0 0 #000, 2px 0 0 #000, 0 -2px 0 #000, 0 2px 0 #000,
            4px 4px 0px rgba(0,0,0,0.5) !important;
        }
        
        .pixel-stickers {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }
        .sticker {
          position: absolute;
          font-size: 1.5rem;
          opacity: 0.12;
          animation: float 6s ease-in-out infinite;
          filter: blur(0.5px);
        }
        .sticker-1 { top: 8%; left: 5%; animation-delay: 0s; }
        .sticker-2 { top: 15%; right: 8%; animation-delay: 1s; font-size: 1.2rem; }
        .sticker-3 { top: 45%; left: 3%; animation-delay: 2s; }
        .sticker-4 { top: 60%; right: 5%; animation-delay: 0.5s; font-size: 1.8rem; }
        .sticker-5 { top: 80%; left: 10%; animation-delay: 3s; }
        .sticker-6 { top: 30%; right: 3%; animation-delay: 1.5s; font-size: 1.3rem; }
        
        /* Vibrant Retro Card Overrides */
        :global(.tools-grid .tool-card) {
          color: #ffffff !important;
        }
        :global(.tools-grid .tool-card .tool-card-title),
        :global(.tools-grid .tool-card .tool-card-arrow) {
          color: #ffffff !important;
          text-shadow: 2px 2px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000, 1px 1px 0px #000 !important;
        }
        :global(.tools-grid .tool-card .tool-card-description) {
          color: #ffffff !important;
          font-weight: 500;
          font-size: 0.75rem !important;
          line-height: 1.4 !important;
          text-shadow: 1px 1px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000 !important;
        }
        
        /* 11 Unique Distinct Colors */
        :global(.tools-grid .tool-card:nth-child(1)) { background-color: #f44336 !important; }
        :global(.tools-grid .tool-card:nth-child(1):hover) { background-color: #e53935 !important; }
        
        :global(.tools-grid .tool-card:nth-child(2)) { background-color: #00bcd4 !important; }
        :global(.tools-grid .tool-card:nth-child(2):hover) { background-color: #00acc1 !important; }
        
        :global(.tools-grid .tool-card:nth-child(3)) { background-color: #9c27b0 !important; }
        :global(.tools-grid .tool-card:nth-child(3):hover) { background-color: #8e24aa !important; }
        
        :global(.tools-grid .tool-card:nth-child(4)) { background-color: #ff9800 !important; }
        :global(.tools-grid .tool-card:nth-child(4):hover) { background-color: #fb8c00 !important; }
        
        :global(.tools-grid .tool-card:nth-child(5)) { background-color: #2196f3 !important; }
        :global(.tools-grid .tool-card:nth-child(5):hover) { background-color: #1e88e5 !important; }
        
        :global(.tools-grid .tool-card:nth-child(6)) { background-color: #e91e63 !important; }
        :global(.tools-grid .tool-card:nth-child(6):hover) { background-color: #d81b60 !important; }
        
        :global(.tools-grid .tool-card:nth-child(7)) { background-color: #cddc39 !important; }
        :global(.tools-grid .tool-card:nth-child(7):hover) { background-color: #c0ca33 !important; }
        
        :global(.tools-grid .tool-card:nth-child(8)) { background-color: #ff5722 !important; }
        :global(.tools-grid .tool-card:nth-child(8):hover) { background-color: #f4511e !important; }
        
        :global(.tools-grid .tool-card:nth-child(9)) { background-color: #3f51b5 !important; }
        :global(.tools-grid .tool-card:nth-child(9):hover) { background-color: #3949ab !important; }
        
        :global(.tools-grid .tool-card:nth-child(10)) { background-color: #009688 !important; }
        :global(.tools-grid .tool-card:nth-child(10):hover) { background-color: #00897b !important; }
        
        :global(.tools-grid .tool-card:nth-child(11)) { background-color: #ffc107 !important; }
        :global(.tools-grid .tool-card:nth-child(11):hover) { background-color: #ffb300 !important; }
      `}</style>
    </div>
  );
}
