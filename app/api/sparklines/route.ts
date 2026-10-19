export const dynamic = 'force-dynamic';

import { PAIRS, qsrSimSpark } from '@/lib/pairs';
import { krakenGet, resultKey } from '../_lib';

type OhlcRow = [number, string, string, string, string, string, string, number];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Round-robin sparkline fetcher for 100 pairs.
// Each request refreshes the next window of 25 pairs (staggered server-side
// to respect Kraken's public rate limits) and returns the full cache.
// After ~4 requests every pair has fresh data; entries older than 30 min
// are pruned. Never fails the batch — a slow pair just keeps old data.
const WINDOW = 25;
const STALE_MS = 30 * 60 * 1000;

let cache: Record<string, { data: number[]; at: number }> = {};
let cursor = 0;

async function fetchOne(symbol: string, kraken: string): Promise<number[] | null> {
  try {
    const env = await krakenGet<Record<string, OhlcRow[]>>('/OHLC', {
      pair: kraken,
      interval: '60',
    });
    const rows = env.result?.[resultKey(kraken)] ?? env.result?.[kraken] ?? [];
    if (!rows.length) return null;
    return rows.map((r) => parseFloat(r[4]));
  } catch {
    return null;
  }
}

// GET /api/sparklines — 24h hourly closes, round-robin 25 pairs per call.
export async function GET() {
  const now = Date.now();
  // Prune stale entries.
  for (const k of Object.keys(cache)) {
    if (now - cache[k].at > STALE_MS) delete cache[k];
  }

  const window: typeof PAIRS = [];
  for (let i = 0; i < WINDOW; i++) {
    window.push(PAIRS[(cursor + i) % PAIRS.length]);
  }
  cursor = (cursor + WINDOW) % PAIRS.length;

  for (const p of window) {
    if (p.native) continue; // native demo pairs never hit Kraken
    const data = await fetchOne(p.symbol, p.kraken);
    if (data) cache[p.symbol] = { data, at: now };
    await sleep(350);
  }

  // QSR: synthetic demo sparkline (labeled simulated in the UI).
  cache['QSR'] = { data: qsrSimSpark(now), at: now };

  const out: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(cache)) out[k] = v.data;
  return Response.json({ ok: true, cached: true, data: out, pairs: PAIRS.length });
}
