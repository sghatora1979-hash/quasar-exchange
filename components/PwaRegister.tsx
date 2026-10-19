'use client';
import { useEffect } from 'react';

/** Registers the PWA service worker. Safe no-op when unsupported or in dev. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Don't fight dev hot-reload.
    if (window.location.hostname === 'localhost') return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
