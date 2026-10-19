export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { PAIRS, pairBySymbol, qsrSimPrice, qsrSimBook } from '@/lib/pairs';
import { krakenGet, resultKey, jsonError } from '../_lib';

type DepthBook = {
  asks: [string, string, number][];
  bids: [string, string, number][];
};

// GET /api/depth?pair=BTCUSD&count=20
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const raw = (sp.get('pair') ?? 'BTCUSD').toUpperCase().replace(/USD$/, '');
  const info = pairBySymbol(raw) ?? PAIRS.find((p) => p.kraken === raw + 'USD');
  if (!info) return jsonError('Unknown pair', 400);
  const count = Math.min(Math.max(parseInt(sp.get('count') ?? '20', 10) || 20, 5), 50);

  // Native demo pairs have no real order book — synthesize one around the demo price.
  if (info.native && info.symbol === 'QSR') {
    const price = qsrSimPrice();
    const { asks, bids } = qsrSimBook(price);
    const n = Math.min(count, asks.length);
    const a = asks.slice(0, n);
    const b = bids.slice(0, n);
    const bestAsk = a[0]?.price ?? 0;
    const bestBid = b[0]?.price ?? 0;
    return Response.json({
      ok: true,
      symbol: info.symbol,
      asks: a,
      bids: b,
      bestAsk,
      bestBid,
      mid: (bestAsk + bestBid) / 2,
      spread: bestAsk - bestBid,
      simulated: true,
    });
  }

  const env = await krakenGet<Record<string, DepthBook>>('/Depth', {
    pair: info.kraken,
    count: String(count),
  });
  if (env.error.length || !env.result) return jsonError(env.error[0] ?? 'Order book unavailable');
  const book = env.result[resultKey(info.kraken)] ?? env.result[info.kraken];
  if (!book) return jsonError('Order book unavailable');

  const norm = (rows: [string, string, number][]) =>
    rows.map(([px, vol]) => ({ price: parseFloat(px), vol: parseFloat(vol) }));
  const asks = norm(book.asks).sort((a, b) => a.price - b.price);
  const bids = norm(book.bids).sort((a, b) => b.price - a.price);
  const bestAsk = asks[0]?.price ?? 0;
  const bestBid = bids[0]?.price ?? 0;
  const mid = bestAsk && bestBid ? (bestAsk + bestBid) / 2 : 0;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;

  return Response.json({ ok: true, symbol: info.symbol, asks, bids, bestAsk, bestBid, mid, spread });
}
