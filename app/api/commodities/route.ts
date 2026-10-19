// GET /api/commodities — daily commodity futures via Yahoo Finance (free, no key).
// DEMO/indicative prices only. Missing data is skipped, never faked.

import { COMMODITIES } from '@/lib/commodities';
import { fetchYahooQuote } from '@/lib/yahoo';

export const dynamic = 'force-dynamic';

type CacheEntry = { t: number; q: unknown | null };
const cache = new Map<string, CacheEntry>();
const TTL = 300_000;

export async function GET() {
  try {
    const quotes = [];
    for (const c of COMMODITIES) {
      const hit = cache.get(c.yahoo);
      let q: unknown | null;
      if (hit && Date.now() - hit.t < TTL) {
        q = hit.q;
      } else {
        const live = await fetchYahooQuote(c.yahoo);
        q = live
          ? {
              symbol: c.symbol,
              name: c.name,
              unit: c.unit,
              currency: c.currency,
              price: live.price,
              priceUSD: live.price,
              changePct: live.changePct,
              volume: live.volume,
            }
          : null;
        cache.set(c.yahoo, { t: Date.now(), q });
      }
      if (q) quotes.push(q);
    }
    return Response.json({ ok: true, quotes, count: quotes.length });
  } catch {
    return Response.json({ ok: false, error: 'Commodity data unavailable (demo).' }, { status: 500 });
  }
}
