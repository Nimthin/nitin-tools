'use client';

import { usePathname } from 'next/navigation';
import DynamicBackground from './DynamicBackground';
import DarkModeToggle from './DarkModeToggle';

export default function ClientLayoutWrapper({ children }) {
  const pathname = usePathname();
  // Check if it's the isolated /d/[code] page
  const isIsolated = pathname.startsWith('/d/') || pathname === '/d';
  const isNotes = pathname.startsWith('/tools/notes');

  if (isIsolated) {
    return <main>{children}</main>;
  }

  return (
    <>
      <DynamicBackground />
      {!isNotes && <DarkModeToggle />}
      <main>{children}</main>
    </>
  );
}
