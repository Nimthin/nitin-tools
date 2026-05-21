'use client';

/**
 * PastelGradientBg — Now simplified to just a passthrough wrapper.
 * The retro pixel background is handled by body::before in globals.css.
 */
export default function PastelGradientBg({ children, className = '', style = {} }) {
  return (
    <div className={`pastel-gradient-wrap ${className}`} style={style}>
      <div className="pastel-gradient-content">{children}</div>
    </div>
  );
}
