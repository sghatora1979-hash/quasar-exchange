'use client';

import { useEffect } from 'react';
import { getHourlyAccent } from '@/lib/theme';

// Sets the hourly secondary accent on <html> after mount (SSR-safe:
// first paint uses the saffron + cyan fallback from CSS).
// Re-checks every minute so the colour flips right when the hour changes.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apply = () => {
      document.documentElement.style.setProperty('--accent2', getHourlyAccent().accent2);
    };
    apply();
    const t = setInterval(apply, 60_000);
    return () => clearInterval(t);
  }, []);
  return <>{children}</>;
}
