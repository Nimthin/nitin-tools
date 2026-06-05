'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import DynamicBackground from './DynamicBackground';
import DarkModeToggle from './DarkModeToggle';
import Loading from '@/app/tools/loading';

export default function ClientLayoutWrapper({ children }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check if it's the isolated /d/[code] page
  const isIsolated = pathname.startsWith('/d/') || pathname === '/d';
  const isNotes = pathname.startsWith('/tools/notes');
  const isTool = pathname.startsWith('/tools');

  if (isIsolated) {
    return <main>{children}</main>;
  }

  // Display the Dino Loading Screen during initial page load/hydration for all tools
  if (isTool && !mounted) {
    return <Loading />;
  }

  return (
    <>
      <DynamicBackground />
      {!isNotes && <DarkModeToggle />}
      <main>{children}</main>
    </>
  );
}
