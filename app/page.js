'use client';

import { useState, useRef, useEffect } from 'react';
import ToolCard from '@/components/ToolCard';
import Chatbot from '@/components/Chatbot';
import PixelIcon from '@/components/PixelIcon';
import { useUser, SignInButton, SignUpButton, SignOutButton } from '@clerk/nextjs';

/* ==========================================================================
   Tool data (unchanged)
   ========================================================================== */

const allTools = [
  { title: 'Image Toolkit',  description: 'Remove backgrounds and extract text with local AI.', icon: <PixelIcon type="image"   size={32} />, href: '/tools/image' },
  { title: 'PDF Toolkit',    description: 'Convert images to PDF and manage your pages securely.', icon: <PixelIcon type="pdf"    size={32} />, href: '/tools/pdf' },
  { title: 'YouTube to MP3', description: 'Download high-quality audio from any YouTube video.',   icon: <PixelIcon type="youtube" size={32} />, href: '/tools/youtube-audio' },
  { title: 'Video Toolkit',  description: 'Trim, edit, and export video clips client-side.',        icon: <PixelIcon type="video"   size={32} />, href: '/tools/video' },
  { title: 'QR Generator',   description: 'Generate customizable QR codes client-side.',            icon: <PixelIcon type="qr"      size={32} />, href: '/tools/qr-generator' },
  { title: 'File converter', description: 'Convert files, documents, and media formats instantly.', icon: <PixelIcon type="convert" size={32} />, href: '/tools/file-converter' },
  { title: 'AI Chatbot',     description: 'Chat with an intelligent AI assistant.',                 icon: <PixelIcon type="bot"     size={32} />, href: '/tools/chatbot' },
  { title: 'DinoShare',      description: 'Upload & share files across devices instantly.',         icon: <PixelIcon type="share"   size={32} />, href: '/tools/dinoshare' },
];

const subTools = [
  { title: 'Background Remover',  description: 'Instantly strip image backgrounds using local AI.', icon: <PixelIcon type="magic"    size={32} />, href: '/tools/image/background-remover' },
  { title: 'Image to Text (OCR)', description: 'Extract text from any image instantly.',            icon: <PixelIcon type="notes"    size={32} />, href: '/tools/image/image-to-text' },
  { title: 'Compress & Resize',   description: 'Compress, resize, and convert images locally.',     icon: <PixelIcon type="magic"    size={32} />, href: '/tools/image/optimize' },
  { title: 'Image to PDF',        description: 'Convert and compile multiple images into a PDF.',   icon: <PixelIcon type="photos"   size={32} />, href: '/tools/pdf/image-to-pdf' },
  { title: 'PDF Page Remover',    description: 'Visually select and delete PDF pages.',             icon: <PixelIcon type="scissors" size={32} />, href: '/tools/pdf/page-remover' },
  { title: 'PDF Merger',          description: 'Combine multiple PDF files into one.',              icon: <PixelIcon type="link"     size={32} />, href: '/tools/pdf/pdf-merger' },
  { title: 'File Share',          description: 'Upload and share files across devices instantly.',   icon: <PixelIcon type="share"    size={32} />, href: '/tools/dinoshare/file' },
  { title: 'Text Clipboard',      description: 'Instantly share text clipboards across devices.',   icon: <PixelIcon type="notes"    size={32} />, href: '/tools/dinoshare/text' },
];



/* ==========================================================================
   Component
   ========================================================================== */

export default function Home() {
  const { isSignedIn, user, isLoaded } = useUser();
  const [isAuthSidebarOpen, setIsAuthSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrollProgress, setScrollProgress] = useState(0); // 0-1 of hero

  const heroRef = useRef(null);
  const wordRefs = useRef([]);
  const subtitleRef = useRef(null);
  const searchWrapRef = useRef(null);

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
    let lastScroll = window.scrollY;

    const apply = () => {
      const y = window.scrollY;
      const p = Math.max(0, Math.min(1, y / 250)); // 0 → 1 across 250px of scroll
      setScrollProgress(p);

      // Words: "Your Personal" flies left, "Toolkit" flies right
      const w0 = wordRefs.current[0];
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
      if (w2) {
        const tx = p * 55;
        const ty = -p * 12;
        const rot = p * 28;
        const scale = 1 - p * 0.35;
        w2.style.transform =
          `translate(${tx}vw, ${ty}vh) rotate(${rot}deg) scale(${scale})`;
        w2.style.opacity = `${Math.max(0, 1 - p * 1.4)}`;
      }


      if (searchWrapRef.current) {
        searchWrapRef.current.style.transform = `translateY(${-p * 40}px)`;
        searchWrapRef.current.style.opacity = `${Math.max(0, 1 - p * 1.8)}`;
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


      {/* Hero */}
      <section
        ref={heroRef}
        className="hero hero-scroll"
        style={{ '--p': scrollProgress }}
      >
        <h1 className="hero-animated-title" style={{ lineHeight: 1.2, margin: 0 }}>
          <span
            ref={(el) => (wordRefs.current[0] = el)}
            className="hero-word hero-title-line"
          >
            Your Personal
          </span>
          <span
            ref={(el) => (wordRefs.current[2] = el)}
            className="hero-word hero-gradient-text"
          >
            Toolkit
          </span>
        </h1>



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

      </section>



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

      {/* Floating Auth Trigger Button */}
      {isLoaded && (
        <button 
          className="auth-sidebar-trigger" 
          onClick={() => setIsAuthSidebarOpen(true)}
          title="Account Settings"
          aria-label="Account Settings"
        >
          {isSignedIn && user ? (
            <img src={user.imageUrl} alt="Profile" className="trigger-avatar-full" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
        </button>
      )}

      {/* Sidebar Drawer Overlay */}
      <div 
        className={`auth-sidebar-overlay ${isAuthSidebarOpen ? 'open' : ''}`}
        onClick={() => setIsAuthSidebarOpen(false)}
      />

      {/* Retro Auth Sidebar Drawer */}
      <div className={`auth-sidebar-drawer ${isAuthSidebarOpen ? 'open' : ''}`}>
        <div className="auth-sidebar-header">
          <h2>🦕 Account Settings</h2>
          <button className="auth-sidebar-close" onClick={() => setIsAuthSidebarOpen(false)}>✕</button>
        </div>
        
        <div className="auth-sidebar-body">
          {!isSignedIn ? (
            <div className="auth-logged-out">
              <p className="auth-welcome-text">Sign in to sync your chats and save preferences across devices!</p>
              
              <div className="auth-actions">
                <SignInButton mode="modal">
                  <button className="retro-btn auth-signin-btn" onClick={() => setIsAuthSidebarOpen(false)}>
                    🔑 Sign In
                  </button>
                </SignInButton>
                
                <SignUpButton mode="modal">
                  <button className="retro-btn auth-signup-btn" onClick={() => setIsAuthSidebarOpen(false)}>
                    📝 Sign Up
                  </button>
                </SignUpButton>
              </div>
            </div>
          ) : (
            <div className="auth-logged-in">
              <div>
                <div className="user-profile-card">
                  <img src={user.imageUrl} alt="Avatar" className="user-profile-avatar" />
                  <div className="user-profile-info">
                    <div className="user-profile-name">{user.fullName || user.username || 'User'}</div>
                    <div className="user-profile-email">{user.primaryEmailAddress?.emailAddress}</div>
                  </div>
                </div>
                <p className="auth-welcome-text" style={{ fontSize: '0.8rem', color: '#666666' }}>
                  You are signed in! Your progress is automatically saved to your account.
                </p>
              </div>
              
              <div className="auth-actions">
                <SignOutButton>
                  <button className="retro-btn auth-logout-btn" onClick={() => setIsAuthSidebarOpen(false)}>
                    🚪 Log Out
                  </button>
                </SignOutButton>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================== */
      /*  Page-scoped styles (scroll-driven hero + marquee + card reveal)    */
      /* ================================================================== */}
      <style jsx>{`
        .hero-scroll {
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: center;
          gap: 24px;
          position: relative;
          padding: 8vh 20px 20px;
          overflow: visible;
        }

        :global(.hero-animated-title) {
          display: flex !important;
          flex-direction: column !important;
          align-items: center;
          gap: 12px;
          will-change: transform;
          font-size: clamp(2rem, 5.5vw, 4.5rem) !important;
          line-height: 1.15 !important;
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

        :global(.hero-gradient-text) {
          color: var(--pixel-yellow) !important;
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
