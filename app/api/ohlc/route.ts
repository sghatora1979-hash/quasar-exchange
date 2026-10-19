export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { PAIRS, pairBySymbol, qsrSimPrice } from '@/lib/pairs';
import { krakenGet, resultKey, jsonError } from '../_lib';

type OhlcRow = [number, string, string, string, string, string, string, number];

export type FullBar = { t: number; o: number; h: number; l: number; c: number; v: number };

// GET /api/ohlc?pair=BTCUSD&interval=60  (pair = display symbol or Kraken alt)
// Backward compatible: `closes` and `data` ({close}[]) are kept as-is for
// existing consumers (e.g. bots page RSI). `bars` adds full OHLCV bars for
// the strategy engine (5-min and other intraday intervals supported).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const raw = (sp.get('pair') ?? 'BTCUSD').toUpperCase().replace(/USD$/, '');
  const info = pairBySymbol(raw) ?? PAIRS.find((p) => p.kraken === raw + 'USD');
  if (!info) return jsonError('Unknown pair', 400);
  const interval = sp.get('interval') ?? '60';

  // Native demo pair: synthetic candles around the simulated price.
  if (info.native && info.symbol === 'QSR') {
    const now = Date.now();
    const stepMs = parseInt(interval, 10) > 0 ? parseInt(interval, 10) * 60_000 : 3600_000;
    const closes: number[] = [];
    const bars: FullBar[] = [];
    let prev = qsrSimPrice(now - 61 * stepMs);
    for (let i = 60; i >= 1; i--) {
      const t = now - i * stepMs;
      const c = qsrSimPrice(t);
      closes.push(c);
      bars.push({
        t: Math.floor(t / 1000),
        o: prev,
        h: Math.max(prev, c) * 1.001,
        l: Math.min(prev, c) * 0.999,
        c,
        v: 0, // simulated — no real volume
      });
      prev = c;
    }
    return Response.json({
      ok: true,
      symbol: info.symbol,
      closes,
      data: closes.map((close) => ({ close })),
      bars,
      count: closes.length,
      simulated: true,
    });
  }

  const env = await krakenGet<Record<string, OhlcRow[]>>('/OHLC', {
    pair: info.kraken,
    interval,
  });
  if (env.error.length || !env.result) return jsonError(env.error[0] ?? 'OHLC unavailable');
  const rows = env.result[resultKey(info.kraken)] ?? env.result[info.kraken] ?? [];
  const closes = rows.map((r) => parseFloat(r[4]));
  // Kraken OHLC row: [time, open, high, low, close, vwap, volume, count].
  const bars: FullBar[] = rows.map((r) => ({
    t: r[0],
    o: parseFloat(r[1]),
    h: parseFloat(r[2]),
    l: parseFloat(r[3]),
    c: parseFloat(r[4]),
    v: parseFloat(r[6]),
  }));
  return Response.json({ ok: true, symbol: info.symbol, closes, bars, count: closes.length });
}