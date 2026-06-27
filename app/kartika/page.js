'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function KartikaInvitationPage() {
  const [mounted, setMounted] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [noBtnPos, setNoBtnPos] = useState({ top: 'auto', left: 'auto' });
  const [tooltipText, setTooltipText] = useState('Wait... 🧐');
  const [balloonList, setBalloonList] = useState([]);
  const containerRef = useRef(null);

  // Sound generator using Web Audio API
  const playSound = (type) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      if (type === 'pop') {
        // Dodging Pop Sound
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
        
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'success') {
        // Success Chime
        const now = ctx.currentTime;
        const playNote = (freq, delay, duration) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + delay);
          
          gain.gain.setValueAtTime(0.15, now + delay);
          gain.gain.exponentialRampToValueAtTime(0.01, now + delay + duration);
          
          osc.start(now + delay);
          osc.stop(now + delay + duration);
        };
        
        playNote(523.25, 0, 0.2); // C5
        playNote(659.25, 0.1, 0.2); // E5
        playNote(783.99, 0.2, 0.2); // G5
        playNote(1046.50, 0.3, 0.4); // C6
      }
    } catch (e) {
      console.warn("AudioContext block by browser auto-play policy:", e);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Make the No button run away
  const handleNoHover = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Generate safe coordinates inside the card boundaries
    const padding = 30;
    const btnWidth = 120;
    const btnHeight = 50;
    
    const newTop = Math.random() * (containerRect.height - btnHeight - padding * 2) + padding;
    const newLeft = Math.random() * (containerRect.width - btnWidth - padding * 2) + padding;

    setNoBtnPos({
      top: `${newTop}px`,
      left: `${newLeft}px`,
      position: 'absolute',
      zIndex: 99
    });

    // Tooltip jokes
    const jokes = [
      "Nice try! 😂",
      "Nope! 🙅‍♀️",
      "Not an option! 😉",
      "Error: Access Denied 🤖",
      "Try again! 😜",
      "Click YES instead! 👉",
      "Calculated dodge! ⚡",
      "Catch me if you can! 🏃‍♀️"
    ];
    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
    setTooltipText(randomJoke);
    playSound('pop');
  };

  // Launch balloons on click YES
  const handleYesClick = () => {
    setAccepted(true);
    playSound('success');
    
    // Generate 35 floating balloons
    const list = Array.from({ length: 35 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 4}s`,
      size: `${Math.random() * 30 + 30}px`,
      color: ['#FF9F43', '#FF4D6D', '#2ED573', '#1E90FF', '#FFA502'][Math.floor(Math.random() * 5)]
    }));
    setBalloonList(list);
  };

  if (!mounted) return null;

  return (
    <div className="kt-viewport">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,800;1,600&family=Space+Grotesk:wght@500;700&display=swap');

        .kt-viewport {
          min-height: 100vh;
          background: #FAF8F5; /* Warm light aesthetic */
          background-image: 
            radial-gradient(circle at 10% 20%, rgba(255, 159, 67, 0.08) 0%, transparent 40%),
            radial-gradient(circle at 90% 80%, rgba(30, 144, 255, 0.08) 0%, transparent 40%);
          color: #2D2722;
          font-family: 'Plus Jakarta Sans', sans-serif;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
        }

        .kt-card {
          max-width: 680px;
          width: 100%;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(12px);
          border: 3px solid #1A1A1A;
          box-shadow: 10px 10px 0px #1A1A1A;
          border-radius: 32px;
          padding: 50px 40px;
          text-align: center;
          position: relative;
          z-index: 5;
          box-sizing: border-box;
          animation: cardSlideUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .kt-serif-title {
          font-family: 'Playfair Display', serif;
          font-size: 2.8rem;
          font-weight: 800;
          color: #1A1A1A;
          margin: 0 0 12px 0;
          line-height: 1.25;
        }

        .kt-highlight {
          color: #FF9F43; /* Terracotta Orange */
          position: relative;
          display: inline-block;
        }

        .kt-highlight::after {
          content: '';
          position: absolute;
          bottom: 4px;
          left: 0;
          width: 100%;
          height: 8px;
          background: rgba(255, 159, 67, 0.15);
          z-index: -1;
          border-radius: 4px;
        }

        .kt-subtitle {
          font-size: 1.05rem;
          color: #5F594F;
          margin: 0 0 35px 0;
          line-height: 1.6;
          max-width: 500px;
          margin-left: auto;
          margin-right: auto;
        }

        /* 3-Column Plan Grid */
        .kt-plan-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 40px;
        }

        .kt-plan-card {
          background: #FFFFFF;
          border: 2.5px solid #1A1A1A;
          border-radius: 20px;
          padding: 20px 15px;
          box-shadow: 4px 4px 0px #1A1A1A;
          transition: all 0.25s cubic-bezier(0.19, 1, 0.22, 1);
          text-align: center;
        }

        .kt-plan-card:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: 6px 6px 0px #1A1A1A;
        }

        .kt-plan-card.delhi { border-color: #FF9F43; box-shadow: 4px 4px 0px #FF9F43; }
        .kt-plan-card.alpha { border-color: #1E90FF; box-shadow: 4px 4px 0px #1E90FF; }
        .kt-plan-card.ramen { border-color: #2ED573; box-shadow: 4px 4px 0px #2ED573; }

        .kt-plan-icon {
          font-size: 2.5rem;
          margin-bottom: 12px;
          display: block;
        }

        .kt-plan-title {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 1.05rem;
          font-weight: 700;
          margin: 0 0 6px 0;
          color: #1A1A1A;
        }

        .kt-plan-desc {
          font-size: 0.8rem;
          color: #6E6760;
          margin: 0;
          line-height: 1.4;
        }

        /* Action Buttons Area */
        .kt-action-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 15px;
          position: relative;
          min-height: 140px;
        }

        .kt-question-prompt {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 1.15rem;
          margin: 0 0 10px 0;
          color: #1A1A1A;
        }

        .kt-btn-container {
          display: flex;
          gap: 20px;
          position: relative;
          width: 100%;
          justify-content: center;
          min-height: 60px;
        }

        .kt-btn {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 1.05rem;
          padding: 14px 40px;
          border: 3px solid #1A1A1A;
          border-radius: 14px;
          cursor: pointer;
          transition: transform 0.1s, box-shadow 0.1s;
          outline: none;
        }

        .kt-btn-yes {
          background-color: #2ED573;
          color: #FFFFFF;
          box-shadow: 5px 5px 0px #1A1A1A;
        }

        .kt-btn-yes:hover {
          transform: translate(-2px, -2px);
          box-shadow: 7px 7px 0px #1A1A1A;
        }

        .kt-btn-yes:active {
          transform: translate(2px, 2px);
          box-shadow: none;
        }

        .kt-btn-no {
          background-color: #FAF8F5;
          color: #1A1A1A;
          box-shadow: 5px 5px 0px #1A1A1A;
          transition: all 0.25s cubic-bezier(0.19, 1, 0.22, 1);
        }

        /* Dodge tooltip text styling */
        .kt-tooltip {
          position: absolute;
          background: #1A1A1A;
          color: #FFFFFF;
          font-size: 0.75rem;
          padding: 6px 12px;
          border-radius: 8px;
          white-space: nowrap;
          pointer-events: none;
          transform: translate(-50%, -35px);
          box-shadow: 3px 3px 0px #FF9F43;
          animation: floatTooltip 0.2s ease-out;
        }

        .kt-tooltip::after {
          content: '';
          position: absolute;
          bottom: -5px;
          left: 50%;
          transform: translateX(-50%);
          border-width: 5px 5px 0;
          border-style: solid;
          border-color: #1A1A1A transparent;
          display: block;
          width: 0;
        }

        @keyframes floatTooltip {
          from { opacity: 0; transform: translate(-50%, -25px) scale(0.9); }
          to { opacity: 1; transform: translate(-50%, -35px) scale(1); }
        }

        /* Celebrating success page */
        .kt-success-badge {
          font-size: 5rem;
          margin-bottom: 20px;
          display: inline-block;
          animation: danceFloat 1.8s ease-in-out infinite;
        }

        /* Floating Balloon Animations */
        .kt-balloon {
          position: absolute;
          bottom: -80px;
          border-radius: 50% 50% 50% 50% / 40% 40% 60% 60%;
          animation: ascend 6s linear forwards;
          opacity: 0.85;
          z-index: 10;
        }

        .kt-balloon::after {
          content: '';
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-bottom: 8px solid inherit;
          border-bottom-color: inherit;
        }

        @keyframes ascend {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.85; }
          90% { opacity: 0.85; }
          100% { transform: translateY(-110vh) rotate(20deg); opacity: 0; }
        }

        @keyframes cardSlideUp {
          from { opacity: 0; transform: translateY(50px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes danceFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(6deg); }
        }

        /* Decorative Background Ornaments */
        .kt-ornament {
          position: absolute;
          font-size: 2.2rem;
          opacity: 0.12;
          pointer-events: none;
          z-index: 1;
        }

        .o-1 { top: 10%; left: 8%; animation: spinSlow 15s linear infinite; }
        .o-2 { top: 15%; right: 8%; animation: danceFloat 4s ease-in-out infinite; }
        .o-3 { bottom: 15%; left: 10%; animation: danceFloat 5s ease-in-out infinite; }
        .o-4 { bottom: 10%; right: 8%; animation: spinSlow 10s linear reverse infinite; }

        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Responsive scaling */
        @media (max-width: 640px) {
          .kt-serif-title { font-size: 2.2rem; }
          .kt-plan-grid { grid-template-columns: 1fr; gap: 14px; }
          .kt-card { padding: 35px 20px; }
          .kt-btn { padding: 12px 25px; font-size: 0.95rem; }
        }
      `}</style>

      {/* Aesthetic floaters in background */}
      <span className="kt-ornament o-1">🕌</span>
      <span className="kt-ornament o-2">🎬</span>
      <span className="kt-ornament o-3">🍜</span>
      <span className="kt-ornament o-4">🍃</span>

      {/* Floating balloons list on acceptance */}
      {balloonList.map(b => (
        <div
          key={b.id}
          className="kt-balloon"
          style={{
            left: b.left,
            animationDelay: b.delay,
            width: b.size,
            height: `calc(${b.size} * 1.2)`,
            background: b.color,
            borderBottomColor: b.color
          }}
        />
      ))}

      <div className="kt-card" ref={containerRef}>
        {!accepted ? (
          <div>
            <h1 className="kt-serif-title">
              Hey <span className="kt-highlight">Kartika Mehta</span>!
            </h1>
            <p className="kt-subtitle">
              Let&rsquo;s step out of the virtual world, explore the real city, and share a few laughs. What do you say to setting up a fun day in Delhi?
            </p>

            {/* Plan Options Grid */}
            <div className="kt-plan-grid">
              <div className="kt-plan-card delhi">
                <span className="kt-plan-icon">🕌</span>
                <h3 className="kt-plan-title">Delhi &lsquo;26</h3>
                <p className="kt-plan-desc">Monuments, heritage walks, and capturing golden hour sunsets.</p>
              </div>

              <div className="kt-plan-card alpha">
                <span className="kt-plan-icon">🎬</span>
                <h3 className="kt-plan-title">Movie: Alpha</h3>
                <p className="kt-plan-desc">Popcorn-slurping action drama, big screen cinematic experience.</p>
              </div>

              <div className="kt-plan-card ramen">
                <span className="kt-plan-icon">🍜</span>
                <h3 className="kt-plan-title">Ramen Date</h3>
                <p className="kt-plan-desc">Slurping warm, rich authentic noodles at a cozy, quiet cafe.</p>
              </div>
            </div>

            <div className="kt-action-area">
              <h3 className="kt-question-prompt">Are you up for this adventure? 🙌</h3>
              
              <div className="kt-btn-container">
                {/* YES button */}
                <button 
                  className="kt-btn kt-btn-yes" 
                  onClick={handleYesClick}
                >
                  Yes! Count Me In
                </button>

                {/* Dynamic NO button with Tooltip jokes */}
                <div style={{ position: noBtnPos.position || 'relative', top: noBtnPos.top, left: noBtnPos.left, zIndex: 10 }}>
                  {noBtnPos.top !== 'auto' && (
                    <div className="kt-tooltip" style={{ left: '50%' }}>
                      {tooltipText}
                    </div>
                  )}
                  <button 
                    className="kt-btn kt-btn-no"
                    onMouseEnter={handleNoHover}
                    onClick={handleNoHover}
                    onTouchStart={handleNoHover}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '25px 0' }}>
            <div className="kt-success-badge">🍜🎬🎉</div>
            <h1 className="kt-serif-title" style={{ color: '#2ED573' }}>
              Awesome, It&rsquo;s a Plan!
            </h1>
            <p style={{ fontSize: '1.15rem', color: '#4A433D', margin: '20px 0 35px 0', lineHeight: '1.7', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
              The ramen is waiting, the action movie ticket is set, and Delhi is ready. Let&rsquo;s catch up soon and decide on the details! 🕌📱✨
            </p>
            <div style={{ display: 'inline-block', background: '#F6F3EE', padding: '14px 28px', border: '3px solid #1A1A1A', borderRadius: '14px', fontWeight: 700, fontFamily: 'Space Grotesk', boxShadow: '4px 4px 0px #1A1A1A' }}>
              Let me know when you&rsquo;re free! 💬
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
