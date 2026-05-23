'use client';

import { usePathname } from 'next/navigation';
import DynamicBackground from './DynamicBackground';
import DarkModeToggle from './DarkModeToggle';

export default function ClientLayoutWrapper({ children }) {
  const pathname = usePathname();
  // Check if it's the isolated /d/[code] page
  const isIsolated = pathname.startsWith('/d/') || pathname === '/d';

  if (isIsolated) {
    return <main>{children}</main>;
  }

  return (
    <>
      <DynamicBackground />
      <DarkModeToggle />
      <main>{children}</main>
    </>
  );
}
