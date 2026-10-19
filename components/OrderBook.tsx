'use client';

import { fmtUSD } from '@/lib/quasar';

export type BookRow = { price: number; vol: number };

export function OrderBook({
  asks,
  bids,
  decimals,
  spread,
}: {
  asks: BookRow[];
  bids: BookRow[];
  decimals: number;
  spread: number;
}) {
  const maxVol = Math.max(
    1e-12,
    ...asks.slice(0, 12).map((r) => r.price * r.vol),
    ...bids.slice(0, 12).map((r) => r.price * r.vol)
  );
  const Row = ({ r, side }: { r: BookRow; side: 'ask' | 'bid' }) => {
    const total = r.price * r.vol;
    const w = Math.max(2, (total / maxVol) * 100);
    const color = side === 'ask' ? 'text-down' : 'text-up';
    const bar = side === 'ask' ? 'bg-down/15' : 'bg-up/15';
    return (
      <div className="relative grid grid-cols-3 text-[11px] font-mono py-[3px] px-2 tabular-nums">
        <div className={`absolute inset-y-0 right-0 ${bar}`} style={{ width: `${w}%` }} />
        <span className={`relative ${color}`}>{r.price.toFixed(decimals)}</span>
        <span className="relative text-right text-slate-300">{r.vol.toFixed(5)}</span>
        <span className="relative text-right text-slate-500">{fmtUSD(total, 0)}</span>
      </div>
    );
  };
  return (
    <div className="bg-panel border border-edge rounded-2xl overflow-hidden">
      <div className="px-3 py-2.5 border-b border-edge text-xs font-semibold text-slate-300 flex justify-between">
        <span>Order Book</span>
        <span className="text-slate-500 font-normal">Price / Amount / Total</span>
      </div>
      <div className="py-1">
        {asks.slice(0, 12).reverse().map((r, i) => (
          <Row key={`a${i}`} r={r} side="ask" />
        ))}
      </div>
      <div className="px-3 py-2 border-y border-edge flex items-center justify-between text-[11px]">
        <span className="text-slate-500">Spread</span>
        <span className="font-mono text-slate-300">{spread.toFixed(decimals)}</span>
      </div>
      <div className="py-1">
        {bids.slice(0, 12).map((r, i) => (
          <Row key={`b${i}`} r={r} side="bid" />
        ))}
      </div>
    </div>
  );
}
