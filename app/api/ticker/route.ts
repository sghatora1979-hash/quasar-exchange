export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { PAIRS, qsrSimPrice } from '@/lib/pairs';
import { krakenGet, resultKey, jsonError } from '../_lib';

type TickerEntry = {
  a: [string, string, string];
  b: [string, string, string];
  c: [string, string];
  v: [string, string];
  p: [string, string];
  t: [number, number];
  l: [string, string];
  h: [string, string];
  o: string;
};

/** Simulated QSR ticker row — DEMO ONLY. QSR is not listed on any real exchange. */
function qsrRow() {
  const now = Date.now();
  const price = qsrSimPrice(now);
  const open = qsrSimPrice(now - 24 * 3600_000);
  const changePct = open > 0 ? ((price - open) / open) * 100 : 0;
  const spark = Array.from({ length: 24 }, (_, i) => qsrSimPrice(now - i * 3600_000));
  return {
    symbol: 'QSR',
    name: 'Quasar Coin (Native)',
    kraken: 'QSRUSD',
    price,
    open,
    changePct,
    high24: Math.max(...spark),
    low24: Math.min(...spark),
    volume24: 1_250_000,
    vwap24: price,
    bid: price * 0.999,
    ask: price * 1.001,
    simulated: true, // demo price — not a market quote
  };
}

// GET /api/ticker?pair=XBTUSD,ETHUSD  (Kraken alt names; defaults to all)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('pair');
  const wanted = q
    ? PAIRS.filter((p) => q.split(',').map((s) => s.trim().toUpperCase()).includes(p.kraken))
    : PAIRS;
  const list = wanted.length ? wanted : PAIRS;

  const natives = list.filter((p) => p.native);
  const live = list.filter((p) => !p.native);

  const out: unknown[] = [];
  if (live.length) {
    const env = await krakenGet<Record<string, TickerEntry>>('/Ticker', {
      pair: live.map((p) => p.kraken).join(','),
    });
    if (env.error.length || !env.result) {
      // If Kraken fails but only the native pair was requested, still serve QSR.
      if (!natives.length) return jsonError(env.error[0] ?? 'Ticker unavailable');
    } else {
      for (const p of live) {
        const e = env.result![resultKey(p.kraken)] ?? env.result![p.kraken];
        if (!e) continue;
        const price = parseFloat(e.c[0]);
        const open = parseFloat(e.o);
        const changePct = open > 0 ? ((price - open) / open) * 100 : 0;
        out.push({
          symbol: p.symbol,
          name: p.name,
          kraken: p.kraken,
          price,
          open,
          changePct,
          high24: parseFloat(e.h[1]),
          low24: parseFloat(e.l[1]),
          volume24: parseFloat(e.v[1]),
          vwap24: parseFloat(e.p[1]),
          bid: parseFloat(e.b[0]),
          ask: parseFloat(e.a[0]),
        });
      }
    }
  }

  // Native demo pairs always appended (pinned first by the UI).
  for (const p of natives) {
    if (p.symbol === 'QSR') out.unshift(qsrRow());
  }
  return Response.json({ ok: true, data: out });
}
