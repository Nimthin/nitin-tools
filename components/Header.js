'use client';

import Link from 'next/link';
import { useTheme } from './ThemeProvider';

export default function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="header-logo">
          <span className="header-logo-icon">⚡</span>
          <span>Nitin Tools</span>
        </Link>
        <nav className="header-nav">
          <Link href="/" className="header-nav-link">
            Home
          </Link>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <span className="theme-toggle-knob">
              {theme === 'dark' ? '🌙' : '☀️'}
            </span>
          </button>
        </nav>
      </div>
    </header>
  );
}
