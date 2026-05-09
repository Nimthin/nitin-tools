'use client';

/**
 * PastelGradientBg — Dreamy animated background with two
 * counter-rotating conic-gradient layers and heavy blur.
 *
 * Adapts automatically to the current theme (dark / light)
 * via CSS custom properties set in globals.css.
 *
 * Usage:
 *   <PastelGradientBg>
 *     <h1>Content on top</h1>
 *   </PastelGradientBg>
 */
export default function PastelGradientBg({ children, className = '', style = {} }) {
  return (
    <div className={`pastel-gradient-wrap ${className}`} style={style}>
      {/* Layer 1 — slow clockwise */}
      <div className="pastel-gradient-layer pastel-layer-1" aria-hidden="true" />
      {/* Layer 2 — faster counter-clockwise */}
      <div className="pastel-gradient-layer pastel-layer-2" aria-hidden="true" />
      {/* Radial vignette for depth */}
      <div className="pastel-gradient-vignette" aria-hidden="true" />
      {/* Content sits above everything */}
      <div className="pastel-gradient-content">{children}</div>
    </div>
  );
}
