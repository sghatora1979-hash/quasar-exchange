// Quasar "living theme" — saffron is ALWAYS the primary brand colour;
// a secondary accent rotates HOURLY (deterministic per hour, same for all
// visitors). Pure CSS variables — no images, SSR-safe fallback.

export type HourlyAccent = {
  name: string;
  /** Secondary accent hex for the hour */
  accent2: string;
};

const ACCENTS: { name: string; accent2: string }[] = [
  { name: 'Cyan Pulse', accent2: '#22D3EE' },
  { name: 'Violet Nebula', accent2: '#A78BFA' },
  { name: 'Emerald Flare', accent2: '#34D399' },
  { name: 'Gold Rush', accent2: '#FBBF24' },
  { name: 'Rose Burst', accent2: '#FB7185' },
  { name: 'Sky Wave', accent2: '#38BDF8' },
  { name: 'Lime Spark', accent2: '#A3E635' },
  { name: 'Magenta Warp', accent2: '#E879F9' },
  { name: 'Teal Drift', accent2: '#2DD4BF' },
  { name: 'Orange Nova', accent2: '#FB923C' },
  { name: 'Indigo Surge', accent2: '#818CF8' },
  { name: 'Red Giant', accent2: '#F87171' },
];

/** Saffron brand gradient — fixed, every hour. */
export const SAFFRON = '#FF9933';
export const SAFFRON_DEEP = '#FF6B1A';

/** Neutral first-paint / SSR fallback (matches the pre-theme design). */
export const ACCENT_FALLBACK = '#22D3EE';

function hashHour(year: number, doy: number, hour: number): number {
  let h = (year * 372 + doy * 24 + hour) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** 0-based day of year (UTC-safe, no DST wobble). */
export function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getFullYear(), 0, 1);
  const day = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((day - start) / 86400000);
}

/** This hour's secondary accent — deterministic, same for all visitors. */
export function getHourlyAccent(at: Date = new Date()): HourlyAccent {
  const idx =
    hashHour(at.getFullYear(), dayOfYear(at), at.getHours()) % ACCENTS.length;
  return ACCENTS[idx];
}

/** Backwards-compatible alias. */
export type DailyAccent = HourlyAccent;
export const getTodayAccent = getHourlyAccent;
