'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';

export default function ToolCard({ title, description, icon, href, index = 0 }) {
  const cardRef = useRef(null);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setIsRevealed(true);
      return;
    }

    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsRevealed(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  const handleMouseMove = (e) => {
    if (typeof window === 'undefined') return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const el = cardRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const xc = rect.width / 2;
    const yc = rect.height / 2;

    const dx = x - xc;
    const dy = y - yc;

    // Subtle 3D tilt angles (max 8 degrees)
    const maxRotX = 8;
    const maxRotY = 8;

    const rotX = -(dy / yc) * maxRotX;
    const rotY = (dx / xc) * maxRotY;

    el.style.transition = 'none';
    el.style.transform = `perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.02)`;
  };

  const handleMouseLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    
    // Smoothly animate back to neutral position
    el.style.transition = 'transform 250ms ease, box-shadow 150ms ease';
    el.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)';
  };

  return (
    <Link 
      ref={cardRef}
      href={href} 
      className={`tool-card staggered-card-entry ${isRevealed ? 'revealed' : ''}`}
      style={{ animationDelay: `${0.1 + (index * 0.1)}s` }}
      target="_blank"
      rel="noopener noreferrer"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="tool-card-icon">{icon}</div>
      <div className="tool-card-content">
        <h3 className="tool-card-title">{title}</h3>
        <p className="tool-card-description">{description}</p>
      </div>
      <div className="tool-card-arrow">
        PLAY ▶
      </div>
    </Link>
  );
}


