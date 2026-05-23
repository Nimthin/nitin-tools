'use client';

import { useEffect, useState } from 'react';

// Pixel Art Bulb Grids
const bulbPixels = [
  "0001111000",
  "0013333100",
  "0133333310",
  "0133333310",
  "0133333310",
  "0013333100",
  "0001111000",
  "0001221000",
  "0001221000",
  "0000110000"
];

const renderPixelGrid = (grid, colorMap) => (
  grid.map((row, y) => (
    row.split('').map((char, x) => (
      char !== '0' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={colorMap[char]} /> : null
    ))
  ))
);

const PixelBulb = ({ isOn }) => {
  // 1: border, 2: base, 3: glass/light
  const colorsOn = { '1': '#000000', '2': '#777777', '3': '#ffeb3b' };
  const colorsOff = { '1': '#000000', '2': '#444444', '3': '#555555' };
  
  return (
    <svg 
      viewBox="0 0 10 10" 
      width="32" 
      height="32"
      style={{
        filter: isOn 
          ? 'drop-shadow(0px 0px 8px rgba(255, 235, 59, 0.8)) drop-shadow(2px 2px 0px rgba(0,0,0,0.3))' 
          : 'drop-shadow(2px 2px 0px rgba(0,0,0,0.5))',
        transition: 'filter 0.3s ease'
      }}
    >
      {renderPixelGrid(bulbPixels, isOn ? colorsOn : colorsOff)}
    </svg>
  );
};

export default function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check local storage or system preference on mount
    const savedTheme = localStorage.getItem('dino-theme');
    if (savedTheme) {
      setIsDark(savedTheme === 'dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(prefersDark);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark ? 'dark' : 'light';
    setIsDark(!isDark);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('dino-theme', newTheme);
  };

  return (
    <div
      onClick={toggleTheme}
      className="dark-mode-toggle-minimal"
      aria-label="Toggle Dark Mode"
      title="Toggle Dark Mode"
    >
      <PixelBulb isOn={!isDark} />
    </div>
  );
}
