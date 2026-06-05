'use client';

export default function Loading() {
  return (
    <div className="dino-load">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Inter:wght@400;600;700&display=swap');

        .dino-load {
          position: fixed; inset: 0;
          background: #1a1a2e;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          z-index: 9999; overflow: hidden;
          font-family: 'Inter', sans-serif;
        }

        /* Subtle ambient color glows */
        .dino-load::before {
          content: "";
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse at 20% 50%, rgba(76, 175, 80, 0.12) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 50%, rgba(255, 152, 0, 0.1) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 80%, rgba(0, 188, 212, 0.08) 0%, transparent 50%);
          animation: dl-glow 4s ease-in-out infinite alternate;
          pointer-events: none;
        }
        @keyframes dl-glow { from { opacity: .6 } to { opacity: 1 } }

        /* Tiny floating particles */
        .dl-p {
          position: absolute;
          width: 5px; height: 5px;
          pointer-events: none;
          opacity: 0.35;
          animation: dl-drift 5s ease-in-out infinite;
        }
        .dl-p:nth-child(1)  { background:#ff9800; top:12%; left:10%;  animation-duration:5s;   animation-delay:0s; }
        .dl-p:nth-child(2)  { background:#00bcd4; top:22%; right:14%; animation-duration:6s;   animation-delay:.5s; }
        .dl-p:nth-child(3)  { background:#ffeb3b; bottom:18%; left:18%; animation-duration:4.5s; animation-delay:1s; }
        .dl-p:nth-child(4)  { background:#e91e63; bottom:28%; right:16%; animation-duration:5.5s; animation-delay:1.5s; }
        .dl-p:nth-child(5)  { background:#4caf50; top:42%; left:7%;  animation-duration:7s;   animation-delay:.8s; }
        .dl-p:nth-child(6)  { background:#ab47bc; top:55%; right:9%; animation-duration:5s;   animation-delay:2s; }
        .dl-p:nth-child(7)  { background:#ff5722; top:68%; left:28%; animation-duration:6.5s; animation-delay:.3s; width:4px; height:4px; }
        .dl-p:nth-child(8)  { background:#03a9f4; top:8%;  right:32%; animation-duration:4s;  animation-delay:1.2s; width:4px; height:4px; }

        @keyframes dl-drift {
          0%,100% { transform: translateY(0) translateX(0); opacity:.25; }
          25%     { transform: translateY(-14px) translateX(6px); opacity:.5; }
          50%     { transform: translateY(-4px) translateX(-4px); opacity:.35; }
          75%     { transform: translateY(-18px) translateX(8px); opacity:.45; }
        }

        .dino-load-inner {
          display: flex; flex-direction: column;
          align-items: center;
          position: relative; z-index: 2;
          animation: dl-fadeUp .5s ease both;
        }
        @keyframes dl-fadeUp {
          from { opacity:0; transform:translateY(20px) scale(.95); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }

        /* Dino SVG container */
        .dino-load-char {
          width: 160px; height: 160px;
          margin-bottom: 28px;
          animation: dl-bounce 2s ease-in-out infinite;
          filter: drop-shadow(0 6px 20px rgba(76,175,80,0.3));
        }
        @keyframes dl-bounce {
          0%,100% { transform: translateY(0) rotate(0deg); }
          30%     { transform: translateY(-12px) rotate(-2deg); }
          60%     { transform: translateY(-4px) rotate(1deg); }
        }

        /* Title */
        .dino-load-title {
          font-family: 'Press Start 2P', monospace;
          font-size: clamp(.7rem, 2.5vw, .95rem);
          color: #fff;
          letter-spacing: 3px;
          margin-bottom: 10px;
          display: flex; align-items: center; gap: 4px;
          text-shadow: 2px 2px 0px rgba(0,0,0,.5);
        }
        .dl-dots {
          display: inline-block;
          animation: dl-pulse 1.4s infinite;
        }
        .dl-dots:nth-child(2) { animation-delay:.2s; }
        .dl-dots:nth-child(3) { animation-delay:.4s; }
        @keyframes dl-pulse { 0%,100%{opacity:.15} 50%{opacity:1} }

        /* Subtitle */
        .dino-load-sub {
          font-size: .85rem;
          color: rgba(255,255,255,.4);
          margin-bottom: 28px;
          font-weight: 500;
        }

        /* Progress bar */
        .dino-load-bar {
          width: 260px; height: 14px;
          background: rgba(255,255,255,.08);
          border: 2px solid rgba(255,255,255,.12);
          overflow: hidden;
          box-shadow: 3px 3px 0px rgba(0,0,0,.3);
        }
        .dino-load-bar-fill {
          height: 100%;
          background: repeating-linear-gradient(90deg, #ff9800, #ff9800 12px, #ffb74d 12px, #ffb74d 16px);
          width: 100%;
          animation: dl-slide 2s linear infinite;
        }
        @keyframes dl-slide { from{transform:translateX(-100%)} to{transform:translateX(0)} }
      ` }} />

      {/* Particles */}
      <div className="dl-p"/><div className="dl-p"/><div className="dl-p"/><div className="dl-p"/>
      <div className="dl-p"/><div className="dl-p"/><div className="dl-p"/><div className="dl-p"/>

      <div className="dino-load-inner">
        {/* ── SVG Dino Character (pure code, no images) ── */}
        <svg className="dino-load-char" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Orange back spikes */}
          <path d="M22 12 L26 4 L30 12Z" fill="#ff9800"/>
          <path d="M28 10 L31 3 L34 10Z" fill="#ff9800"/>
          <path d="M34 10 L36 5 L38 11Z" fill="#e68900"/>

          {/* Tail */}
          <path d="M14 38 Q8 36 4 30 Q6 28 10 30 Q12 32 16 34Z" fill="#4caf50" stroke="#2e7d32" strokeWidth="1"/>

          {/* Body */}
          <ellipse cx="30" cy="36" rx="14" ry="16" fill="#66bb6a"/>
          {/* Belly */}
          <ellipse cx="32" cy="40" rx="9" ry="10" fill="#a5d6a7"/>

          {/* Head */}
          <ellipse cx="40" cy="18" rx="14" ry="12" fill="#66bb6a"/>
          {/* Snout/jaw */}
          <ellipse cx="50" cy="20" rx="8" ry="6" fill="#81c784"/>

          {/* Eye white */}
          <circle cx="44" cy="15" r="5" fill="white"/>
          {/* Eye pupil */}
          <circle cx="45.5" cy="14.5" r="2.8" fill="#1a1a2e"/>
          {/* Eye highlight */}
          <circle cx="46.5" cy="13.5" r="1" fill="white"/>

          {/* Nostril */}
          <circle cx="54" cy="18" r="1" fill="#2e7d32"/>

          {/* Mouth line */}
          <path d="M48 23 Q52 25 56 23" stroke="#2e7d32" strokeWidth="1.2" fill="none" strokeLinecap="round"/>

          {/* Teeth */}
          <rect x="50" y="22" width="2" height="2.5" rx=".5" fill="white"/>
          <rect x="53" y="22" width="2" height="2" rx=".5" fill="white"/>

          {/* Cheek blush */}
          <ellipse cx="48" cy="24" rx="2.5" ry="1.5" fill="#ef9a9a" opacity=".5"/>

          {/* Arms */}
          <path d="M38 30 Q42 32 44 35 Q43 36 40 34 Q37 32 36 30Z" fill="#4caf50" stroke="#2e7d32" strokeWidth=".8"/>
          <path d="M22 32 Q18 34 16 37 Q17 38 20 36 Q23 34 24 32Z" fill="#4caf50" stroke="#2e7d32" strokeWidth=".8"/>

          {/* Right leg (forward) */}
          <path d="M34 48 L36 56 L40 56 L38 48Z" fill="#4caf50" stroke="#2e7d32" strokeWidth=".8"/>
          <rect x="35" y="55" width="6" height="3" rx="1" fill="#4caf50" stroke="#2e7d32" strokeWidth=".8"/>

          {/* Left leg (back) */}
          <path d="M22 46 L18 54 L22 55 L26 47Z" fill="#4caf50" stroke="#2e7d32" strokeWidth=".8"/>
          <rect x="16" y="53" width="7" height="3" rx="1" fill="#4caf50" stroke="#2e7d32" strokeWidth=".8"/>

          {/* Body outline (subtle) */}
          <ellipse cx="30" cy="36" rx="14" ry="16" fill="none" stroke="#2e7d32" strokeWidth="1.2"/>
          <ellipse cx="40" cy="18" rx="14" ry="12" fill="none" stroke="#2e7d32" strokeWidth="1.2"/>
          <ellipse cx="50" cy="20" rx="8" ry="6" fill="none" stroke="#2e7d32" strokeWidth="1"/>
        </svg>

        {/* Title */}
        <div className="dino-load-title">
          <span>LOADING</span>
          <span className="dl-dots">.</span>
          <span className="dl-dots">.</span>
          <span className="dl-dots">.</span>
        </div>

        <div className="dino-load-sub">Preparing your toolkit</div>

        {/* Progress bar */}
        <div className="dino-load-bar">
          <div className="dino-load-bar-fill" />
        </div>
      </div>
    </div>
  );
}
