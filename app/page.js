'use client';

import { useState, useRef, useEffect } from 'react';
import ToolCard from '@/components/ToolCard';
import Chatbot from '@/components/Chatbot';
import DarkModeToggle from '@/components/DarkModeToggle';
import PixelIcon from '@/components/PixelIcon';

/* ==========================================================================
   Tool data (unchanged)
   ========================================================================== */

const allTools = [
  { title: 'Image Toolkit',  description: 'Remove backgrounds and extract text with local AI.', icon: <PixelIcon type="image"   size={32} />, href: '/tools/image' },
  { title: 'PDF Toolkit',    description: 'Convert images to PDF and manage your pages securely.', icon: <PixelIcon type="pdf"    size={32} />, href: '/tools/pdf' },
  { title: 'YouTube to MP3', description: 'Download high-quality audio from any YouTube video.',   icon: <PixelIcon type="youtube" size={32} />, href: '/tools/youtube-audio' },
  { title: 'File converter', description: 'Convert files, documents, and media formats instantly.', icon: <PixelIcon type="convert" size={32} />, href: '/tools/file-converter' },
  { title: 'NitinMusic',     description: 'Ad-free music streaming and trending charts.',           icon: <PixelIcon type="music"   size={32} />, href: '/tools/music-player' },
  { title: 'AI Chatbot',     description: 'Chat with an intelligent AI assistant.',                 icon: <PixelIcon type="bot"     size={32} />, href: '/tools/chatbot' },
];

const subTools = [
  { title: 'Background Remover',  description: 'Instantly strip image backgrounds using local AI.', icon: <PixelIcon type="magic"    size={32} />, href: '/tools/image/background-remover' },
  { title: 'Image to Text (OCR)', description: 'Extract text from any image instantly.',            icon: <PixelIcon type="notes"    size={32} />, href: '/tools/image/image-to-text' },
  { title: 'Image to PDF',        description: 'Convert and compile multiple images into a PDF.',   icon: <PixelIcon type="photos"   size={32} />, href: '/tools/pdf/image-to-pdf' },
  { title: 'PDF Page Remover',    description: 'Visually select and delete PDF pages.',             icon: <PixelIcon type="scissors" size={32} />, href: '/tools/pdf/page-remover' },
  { title: 'PDF Merger',          description: 'Combine multiple PDF files into one.',              icon: <PixelIcon type="link"     size={32} />, href: '/tools/pdf/pdf-merger' },
];

/* ==========================================================================
   Component
   ========================================================================== */

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [scrollProgress, setScrollProgress] = useState(0); // 0-1 of hero

  const heroRef = useRef(null);
  const wordRefs = useRef([]);
  const subtitleRef = useRef(null);
  const searchWrapRef = useRef(null);
  const stickerRefs = useRef([]);
  const marqueeRef = useRef(null);

  const itemsToSearch = searchQuery.trim() === '' ? allTools : [...allTools, ...subTools];
  const filteredTools = itemsToSearch.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /* ====================================================================== */
  /*  Scroll-driven hero (rAF-throttled, GPU-only transforms)                */
  /* ====================================================================== */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    let rafId = null;
    let marqueeOffset = 0;
    let lastScroll = window.scrollY;

    const apply = () => {
      const y = window.scrollY;
      const vh = window.innerHeight || 1;
      const p = Math.max(0, Math.min(1, y / (vh * 0.85))); // 0 → 1 across ~85vh
      setScrollProgress(p);

      // Words: "Your" flies left, "Personal" lifts + spreads, "Toolkit" flies right
      const w0 = wordRefs.current[0];
      const w1 = wordRefs.current[1];
      const w2 = wordRefs.current[2];

      if (w0) {
        const tx = -p * 55;       // vw
        const ty = -p * 12;       // vh
        const rot = -p * 28;      // deg
        const scale = 1 - p * 0.35;
        w0.style.transform =
          `translate(${tx}vw, ${ty}vh) rotate(${rot}deg) scale(${scale})`;
        w0.style.opacity = `${Math.max(0, 1 - p * 1.4)}`;
      }
      if (w1) {
        const ty = -p * 18;
        const scale = 1 - p * 0.55;
        const spread = p * 24;    // px between letters
        w1.style.transform = `translateY(${ty}vh) scale(${scale})`;
        w1.style.letterSpacing = `${spread}px`;
        w1.style.opacity = `${Math.max(0.15, 1 - p * 1.1)}`;
      }
      if (w2) {
        const tx = p * 55;
        const ty = -p * 12;
        const rot = p * 28;
        const scale = 1 - p * 0.35;
        w2.style.transform =
          `translate(${tx}vw, ${ty}vh) rotate(${rot}deg) scale(${scale})`;
        w2.style.opacity = `${Math.max(0, 1 - p * 1.4)}`;
      }

      // Subtitle + search ride upward and fade
      if (subtitleRef.current) {
        subtitleRef.current.style.transform = `translateY(${-p * 25}px)`;
        subtitleRef.current.style.opacity = `${Math.max(0, 1 - p * 1.6)}`;
      }
      if (searchWrapRef.current) {
        searchWrapRef.current.style.transform = `translateY(${-p * 40}px)`;
        searchWrapRef.current.style.opacity = `${Math.max(0, 1 - p * 1.8)}`;
      }

      // Sticker parallax — varied speeds give depth
      stickerRefs.current.forEach((el, i) => {
        if (!el) return;
        const speed = 0.15 + (i % 4) * 0.18;
        const rot = (i % 2 === 0 ? 1 : -1) * y * 0.05;
        const scale = 1 + p * 0.6;
        el.style.transform =
          `translateY(${-y * speed}px) rotate(${rot}deg) scale(${scale})`;
        el.style.opacity = `${Math.max(0.05, 0.28 - p * 0.2)}`;
      });

      // Marquee: scroll velocity nudges the strip horizontally
      if (marqueeRef.current) {
        const delta = y - lastScroll;
        marqueeOffset -= delta * 0.6;
        marqueeRef.current.style.setProperty('--marquee-offset', `${marqueeOffset}px`);
      }

      lastScroll = y;
      rafId = null;
    };

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(apply);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    apply(); // initial paint

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  /* ====================================================================== */
  /*  Card reveal-on-scroll (IntersectionObserver)                           */
  /* ====================================================================== */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      document.querySelectorAll('.tools-grid .tool-card').forEach((el) => el.classList.add('revealed'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('revealed');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    document.querySelectorAll('.tools-grid .tool-card').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [filteredTools.length]);

  /* ====================================================================== */
  /*  Keyboard shortcut: / focuses search                                    */
  /* ====================================================================== */
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        document.getElementById('hero-search')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ====================================================================== */
  /*  Render                                                                 */
  /* ====================================================================== */
  return (
    <div className="home-bg">
      {/* Floating pixel stickers — true parallax now */}
      <div className="pixel-stickers" aria-hidden="true">
        {['⭐', '🔧', '💎', '🎮', '⚡', '🌟', '🕹️', '👾'].map((s, i) => (
          <span
            key={i}
            ref={(el) => (stickerRefs.current[i] = el)}
            className={`sticker sticker-${i + 1}`}
          >
            {s}
          </span>
        ))}
      </div>

      {/* Hero */}
      <section
        ref={heroRef}
        className="hero hero-scroll"
        style={{ '--p': scrollProgress }}
      >
        <h1 className="hero-animated-title" style={{ lineHeight: 1.2, margin: 0 }}>
          <span
            ref={(el) => (wordRefs.current[0] = el)}
            className="hero-word hero-word-1"
          >
            Your
          </span>{' '}
          <span
            ref={(el) => (wordRefs.current[1] = el)}
            className="hero-word hero-word-2 hero-gradient-text"
          >
            Personal
          </span>{' '}
          <span
            ref={(el) => (wordRefs.current[2] = el)}
            className="hero-word hero-word-3"
          >
            Toolkit
          </span>
        </h1>

        <div ref={subtitleRef} className="hero-subtitle">
          <span className="trust-pill">
            <span className="pulse-dot" /> 100% IN-BROWSER
          </span>
          <span className="trust-pill">11 TOOLS</span>
          <span className="trust-pill">ZERO ADS</span>
        </div>

        <div ref={searchWrapRef} className="hero-search-wrap">
          <input
            id="hero-search"
            type="text"
            placeholder="Search for a tool…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="hero-search-input"
          />
          <span className="hero-search-icon">🔍</span>
          <kbd className="hero-search-kbd">/</kbd>
        </div>

        <div className="scroll-cue" aria-hidden="true">
          <div className="scroll-cue-arrow">▼</div>
          <div className="scroll-cue-label">SCROLL TO EXPLODE</div>
        </div>
      </section>

      {/* Marquee strip */}
      <div className="marquee-strip" ref={marqueeRef} aria-hidden="true">
        <div className="marquee-track">
          {Array.from({ length: 2 }).map((_, n) => (
            <div className="marquee-group" key={n}>
              <span>★ IN-BROWSER POWER ★</span>
              <span>★ NO UPLOADS ★</span>
              <span>★ FREE FOREVER ★</span>
              <span>★ OPEN SOURCE ★</span>
              <span>★ PIXEL POWERED ★</span>
              <span>★ MADE BY NITIN ★</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tools grid */}
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

      {/* Footer */}
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
                <path
                  d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"
                  fill="currentColor"
                />
              </svg>
              DOWNLOAD APK
            </a>
          </div>
        </div>
        <div className="retro-footer-bottom">Built with ❤️ by Nitin</div>
      </footer>

      <Chatbot />
      <DarkModeToggle />

      {/* ================================================================== */
      /*  Page-scoped styles (scroll-driven hero + marquee + card reveal)    */
      /* ================================================================== */}
      <style jsx>{`
        .hero-scroll {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 24px;
          position: relative;
          padding: 80px 20px 40px;
          overflow: visible;
        }

        :global(.hero-animated-title) {
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: wrap;
          justify-content: center;
          gap: 14px;
          will-change: transform;
        }

        :global(.hero-word) {
          display: inline-block;
          will-change: transform, opacity;
          transition: text-shadow 0.4s ease;
          color: #fff;
          text-shadow:
            -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000,
            -3px 0 0 #000, 3px 0 0 #000, 0 -3px 0 #000, 0 3px 0 #000,
            6px 6px 0px rgba(0, 0, 0, 0.5);
        }

        :global(.hero-word-2.hero-gradient-text) {
          color: var(--pixel-yellow);
          animation: pixelGlow 2s ease-in-out infinite alternate;
        }

        .hero-subtitle {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
          will-change: transform, opacity;
          font-family: inherit;
        }

        :global(.trust-pill) {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-pixel);
          font-size: 0.65rem;
          letter-spacing: 1px;
          padding: 8px 14px;
          background: rgba(0, 0, 0, 0.55);
          color: var(--pixel-cyan);
          border: 2px solid var(--pixel-cyan);
          box-shadow: 3px 3px 0 #000;
        }
        :global(.trust-pill:nth-child(2)) {
          color: var(--pixel-yellow);
          border-color: var(--pixel-yellow);
        }
        :global(.trust-pill:nth-child(3)) {
          color: var(--pixel-green);
          border-color: var(--pixel-green);
        }

        :global(.pulse-dot) {
          width: 8px;
          height: 8px;
          background: var(--pixel-green);
          display: inline-block;
          animation: pulse 1.4s ease-in-out infinite;
          box-shadow: 0 0 8px var(--pixel-green);
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .hero-search-wrap {
          width: 100%;
          max-width: 520px;
          position: relative;
          will-change: transform, opacity;
        }

        :global(.hero-search-icon) {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--pixel-text-muted);
          font-size: 1.1rem;
          pointer-events: none;
        }

        :global(.hero-search-kbd) {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          font-family: var(--font-pixel);
          font-size: 0.65rem;
          padding: 4px 8px;
          background: #1a1a1a;
          color: var(--pixel-cyan);
          border: 2px solid #000;
          box-shadow: 2px 2px 0 #000;
          pointer-events: none;
        }

        .scroll-cue {
          position: absolute;
          bottom: 22px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          opacity: calc(1 - var(--p, 0) * 2);
          pointer-events: none;
        }
        .scroll-cue-arrow {
          font-size: 1.2rem;
          color: var(--pixel-yellow);
          animation: scrollBounce 1.6s ease-in-out infinite;
          text-shadow: 2px 2px 0 #000;
        }
        .scroll-cue-label {
          font-family: var(--font-pixel);
          font-size: 0.6rem;
          letter-spacing: 1px;
          color: #fff;
          text-shadow: 2px 2px 0 #000;
        }
        @keyframes scrollBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(8px); }
        }

        /* ---------- Marquee strip ---------- */
        .marquee-strip {
          position: relative;
          overflow: hidden;
          padding: 14px 0;
          background: var(--pixel-yellow);
          border-top: 4px solid #000;
          border-bottom: 4px solid #000;
          z-index: 2;
        }
        .marquee-track {
          display: flex;
          width: max-content;
          will-change: transform;
          animation: marqueeBase 25s linear infinite;
          transform: translateX(var(--marquee-offset, 0px));
        }
        .marquee-group {
          display: flex;
          gap: 50px;
          padding-right: 50px;
          font-family: var(--font-pixel);
          font-size: 0.85rem;
          color: #000;
          letter-spacing: 2px;
          white-space: nowrap;
        }
        .marquee-group span {
          display: inline-block;
        }
        @keyframes marqueeBase {
          from { transform: translateX(var(--marquee-offset, 0px)); }
          to   { transform: translateX(calc(-50% + var(--marquee-offset, 0px))); }
        }

        /* ---------- Pixel stickers ---------- */
        :global(.pixel-stickers) {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }
        :global(.sticker) {
          position: absolute;
          font-size: 1.8rem;
          opacity: 0.25;
          will-change: transform, opacity;
        }
        :global(.sticker-1) { top: 6%;  left: 4%;  font-size: 2.2rem; }
        :global(.sticker-2) { top: 12%; right: 7%; font-size: 1.6rem; }
        :global(.sticker-3) { top: 38%; left: 3%;  font-size: 2.0rem; }
        :global(.sticker-4) { top: 55%; right: 5%; font-size: 2.4rem; }
        :global(.sticker-5) { top: 75%; left: 8%;  font-size: 1.8rem; }
        :global(.sticker-6) { top: 28%; right: 4%; font-size: 1.6rem; }
        :global(.sticker-7) { top: 65%; left: 50%; font-size: 1.5rem; }
        :global(.sticker-8) { top: 18%; left: 40%; font-size: 1.4rem; }

        /* ---------- Tool card reveal ---------- */
        :global(.tools-grid .tool-card) {
          opacity: 0;
          transform: translateY(40px) rotate(-2deg);
          transition: transform 0.6s cubic-bezier(0.2, 1, 0.3, 1),
                      opacity 0.6s ease;
          animation: none !important; /* override the existing staggered fade */
        }
        :global(.tools-grid .tool-card.revealed) {
          opacity: 1;
          transform: translateY(0) rotate(0);
        }
        :global(.tools-grid .tool-card:hover) {
          transform: translateY(-6px) rotate(0) scale(1.02) !important;
        }

        /* ---------- 11 distinct card colors (same as before) ---------- */
        :global(.tools-grid .tool-card) {
          color: #ffffff !important;
        }
        :global(.tools-grid .tool-card .tool-card-title),
        :global(.tools-grid .tool-card .tool-card-arrow) {
          color: #ffffff !important;
          text-shadow:
            2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000,
            -1px 1px 0 #000, 1px 1px 0 #000 !important;
        }
        :global(.tools-grid .tool-card .tool-card-description) {
          color: #ffffff !important;
          font-weight: 500;
          font-size: 0.75rem !important;
          line-height: 1.4 !important;
          text-shadow:
            1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000,
            -1px 1px 0 #000 !important;
        }
        :global(.tools-grid .tool-card:nth-child(1)) { background-color: #f44336 !important; }
        :global(.tools-grid .tool-card:nth-child(2)) { background-color: #00bcd4 !important; }
        :global(.tools-grid .tool-card:nth-child(3)) { background-color: #9c27b0 !important; }
        :global(.tools-grid .tool-card:nth-child(4)) { background-color: #ff9800 !important; }
        :global(.tools-grid .tool-card:nth-child(5)) { background-color: #2196f3 !important; }
        :global(.tools-grid .tool-card:nth-child(6)) { background-color: #e91e63 !important; }
        :global(.tools-grid .tool-card:nth-child(7)) { background-color: #cddc39 !important; }
        :global(.tools-grid .tool-card:nth-child(8)) { background-color: #ff5722 !important; }
        :global(.tools-grid .tool-card:nth-child(9)) { background-color: #3f51b5 !important; }
        :global(.tools-grid .tool-card:nth-child(10)) { background-color: #009688 !important; }
        :global(.tools-grid .tool-card:nth-child(11)) { background-color: #ffc107 !important; }

        /* ---------- Reduced-motion fallback ---------- */
        @media (prefers-reduced-motion: reduce) {
          :global(.hero-word),
          .hero-subtitle,
          .hero-search-wrap,
          :global(.sticker) {
            transform: none !important;
            opacity: 1 !important;
            letter-spacing: normal !important;
          }
          .marquee-track {
            animation: none !important;
            transform: none !important;
          }
          .scroll-cue { display: none; }
        }
      `}</style>
    </div>
  );
}
