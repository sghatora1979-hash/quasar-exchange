// GET /api/history — OHLC history via Yahoo Finance (free, no key).
// Used by the demo algo backtester. DEMO/indicative data only.
//   ?yahoo=RELIANCE.NS&range=1y&interval=1d

import { fetchYahooHistory } from '@/lib/yahoo';

export const dynamic = 'force-dynamic';

const cache = new Map<string, { t: number; d: unknown }>();
const TTL = 1800_000;

const OK_RANGES = new Set(['1mo', '3mo', '6mo', '1y', '2y', '5y']);
const OK_INTERVALS = new Set(['1d', '1wk']);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const yahoo = (url.searchParams.get('yahoo') || '').trim();
    const range = url.searchParams.get('range') || '1y';
    const interval = url.searchParams.get('interval') || '1d';
    if (!yahoo) return Response.json({ ok: false, error: 'Missing ?yahoo=' }, { status: 400 });
    const key = `${yahoo}|${OK_RANGES.has(range) ? range : '1y'}|${OK_INTERVALS.has(interval) ? interval : '1d'}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < TTL) return Response.json({ ok: true, cached: true, ...(hit.d as object) });
    const [ys, rg, iv] = key.split('|');
    const h = await fetchYahooHistory(ys, rg, iv);
    if (!h) return Response.json({ ok: false, error: 'No history (demo).' }, { status: 502 });
    const payload = { yahoo: ys, range: rg, interval: iv, ...h };
    cache.set(key, { t: Date.now(), d: payload });
    return Response.json({ ok: true, ...payload });
  } catch {
    return Response.json({ ok: false, error: 'History unavailable (demo).' }, { status: 500 });
  }
}
