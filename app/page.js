'use client';

import { useState } from 'react';
import ToolCard from '@/components/ToolCard';
import Chatbot from '@/components/Chatbot';
import DownloadAppButton from '@/components/DownloadAppButton';
import PastelGradientBg from '@/components/PastelGradientBg';

const allTools = [
  {
    title: 'Image Toolkit',
    description: 'A collection of image utilities: Remove backgrounds with AI, or extract text from any picture. Processed entirely and privately in your browser.',
    icon: '🖼️',
    href: '/tools/image',
  },
  {
    title: 'PDF Toolkit',
    description: 'A collection of PDF utilities: Remove pages, or convert multiple images into a single PDF document. All processed securely in your browser.',
    icon: '📄',
    href: '/tools/pdf',
  },
  {
    title: 'YouTube to MP3',
    description: 'Download audio from any YouTube video directly as an MP3. Choose your quality — up to 320 kbps.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
        <path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55a3.016 3.016 0 0 0-2.122 2.136C0 8.07 0 12 0 12s0 3.93.501 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.55 9.377.55 9.377.55s7.505 0 9.377-.55a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
        <path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
    href: '/tools/youtube-audio',
  },
  {
    title: 'File converter',
    description:
      'Change a file into another format — reports, spreadsheets, photos, music, or video. Everything happens privately on your computer.',
    icon: '🔄',
    href: '/tools/file-converter',
  },
  {
    title: 'NitinMusic',
    description: 'Your personal ad-free music player. Search any song, stream it instantly in full quality, and enjoy trending charts — all without a single ad.',
    icon: '🎵',
    href: '/tools/music-player',
  },
  {
    title: 'AI Chatbot',
    description: 'Chat with an intelligent AI assistant. Get answers, brainstorm ideas, write code, and solve problems — all in a beautiful interface.',
    icon: '🤖',
    href: '/tools/chatbot',
  },
];

const subTools = [
  {
    title: 'Background Remover',
    description: 'Instantly strip the background from any image using local in-browser AI processing.',
    icon: '✨',
    href: '/tools/image/background-remover',
  },
  {
    title: 'Image to Text (OCR)',
    description: 'Upload an image and instantly extract all text from it using advanced optical character recognition.',
    icon: '📝',
    href: '/tools/image/image-to-text',
  },
  {
    title: 'Image to PDF',
    description: 'Drag and drop multiple images, reorder them, and compile them into a single PDF document.',
    icon: '📸',
    href: '/tools/pdf/image-to-pdf',
  },
  {
    title: 'PDF Page Remover',
    description: 'Visually see all the pages of a PDF and instantly delete the ones you do not want.',
    icon: '✂️',
    href: '/tools/pdf/page-remover',
  },
  {
    title: 'PDF Merger',
    description: 'Combine multiple separate PDF files into one continuous document privately in your browser.',
    icon: '🔗',
    href: '/tools/pdf/pdf-merger',
  }
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');

  // If search is empty, show only main categories. If typing, search everything!
  const itemsToSearch = searchQuery.trim() === '' ? allTools : [...allTools, ...subTools];
  
  const filteredTools = itemsToSearch.filter(tool => 
    tool.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    tool.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PastelGradientBg style={{ minHeight: '100vh' }}>
      <section className="hero">
        <h1 className="hero-animated-title" style={{ lineHeight: '0.85' }}>
          <span className="hero-title-line">Your Personal</span>
          <br />
          <span className="hero-gradient-text" style={{ marginTop: '5px' }}>Toolkit</span>
        </h1>
        
        <div style={{ maxWidth: '500px', margin: '40px auto 0', position: 'relative' }}>
          <input 
            type="text" 
            placeholder="Search for a tool..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="hero-search-input"
          />
          <span style={{ 
            position: 'absolute', 
            left: '20px', 
            top: '50%', 
            transform: 'translateY(-50%)',
            color: 'var(--text-secondary)'
          }}>
            🔍
          </span>
        </div>
      </section>

      <section className="tools-section">
        <h2 className="tools-section-title">
          {filteredTools.length > 0 ? 'Available Tools' : 'No tools found'}
        </h2>
        <div className="tools-grid">
          {filteredTools.map((tool, index) => (
            <ToolCard key={tool.href} {...tool} index={index} />
          ))}
        </div>
      </section>

      <Chatbot />
      <DownloadAppButton />
    </PastelGradientBg>
  );
}
