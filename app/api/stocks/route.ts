// GET /api/stocks — daily stock closes via Yahoo Finance (free, no key).
// Query params:
//   ?symbols=RELIANCE,TCS   → quotes for these display symbols only
//   ?region=in_nse           → quotes for one region
//   ?regions=in_nse,us,uk    → quotes for several regions
//   (no params)              → featured set (keeps homepage fast)
// Per-symbol server cache (5 min). Symbols with no data are skipped — never faked.
// All prices are DEMO/indicative (daily closes), not live ticks.

import { STOCKS, stockBySymbol, stocksByRegion, type Stock } from '@/lib/stocks';
import { fetchYahooQuote, fxPerUsd } from '@/lib/yahoo';

export const dynamic = 'force-dynamic';

export type StockQuote = {
  symbol: string;
  name: string;
  region: string;
  exchange: string;
  currency: string;
  price: number;
  priceUSD: number;
  changePct: number | null;
  volume: number;
};

type CacheEntry = { t: number; q: StockQuote | null };
const cache = new Map<string, CacheEntry>();
const TTL = 300_000;

const FEATURED = [
  // homepage default — keeps first paint fast
  ...['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'TATAPOWER', 'ETERNAL', 'HAL'],
  ...['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'JPM', 'LLY'],
  ...['RY', 'TD', 'SHOP', 'ENB'],
  ...['SHEL', 'AZN', 'HSBA'],
  ...['D05', 'U11', 'O39'],
  ...['7203', '9984', '8031'],
  ...['0700', '0388'],
  ...['SAP', 'MC', 'ASML'],
];

async function quoteFor(s: Stock): Promise<StockQuote | null> {
  const hit = cache.get(s.yahoo);
  if (hit && Date.now() - hit.t < TTL) return hit.q;
  const q = await fetchYahooQuote(s.yahoo);
  if (!q) {
    cache.set(s.yahoo, { t: Date.now(), q: null });
    return null;
  }
  let priceUSD = q.price;
  if (s.currency !== 'USD') {
    const fx = s.currency === 'GBp' ? await fxPerUsd('GBP') : await fxPerUsd(s.currency);
    if (s.currency === 'GBp') {
      priceUSD = fx > 0 ? q.price / 100 / fx : 0;
    } else {
      priceUSD = fx > 0 ? q.price / fx : 0;
    }
  }
  const out: StockQuote | null =
    priceUSD > 0
      ? {
          symbol: s.symbol,
          name: s.name,
          region: s.region,
          exchange: s.exchange,
          currency: s.currency,
          price: q.price,
          priceUSD,
          changePct: q.changePct,
          volume: q.volume,
        }
      : null;
  cache.set(s.yahoo, { t: Date.now(), q: out });
  return out;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const symbolsParam = url.searchParams.get('symbols');
    const regionParam = url.searchParams.get('region');
    const regionsParam = url.searchParams.get('regions');

    let list: Stock[];
    if (symbolsParam) {
      const wanted = symbolsParam.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
      list = wanted.map((w) => stockBySymbol(w)).filter((s): s is Stock => !!s);
    } else if (regionParam) {
      list = stocksByRegion(regionParam as Stock['region']);
    } else if (regionsParam) {
      const regs = regionsParam.split(',').map((x) => x.trim()).filter(Boolean);
      list = regs.flatMap((r) => stocksByRegion(r as Stock['region']));
    } else {
      list = FEATURED.map((w) => stockBySymbol(w)).filter((s): s is Stock => !!s);
    }

    const quotes: StockQuote[] = [];
    const CHUNK = 12;
    for (let i = 0; i < list.length; i += CHUNK) {
      const batch = list.slice(i, i + CHUNK);
      const results = await Promise.all(batch.map(quoteFor));
      for (const qq of results) if (qq) quotes.push(qq);
    }
    return Response.json({ ok: true, quotes, count: quotes.length, total: list.length });
  } catch {
    return Response.json({ ok: false, error: 'Stock data unavailable (demo).' }, { status: 500 });
  }
}
