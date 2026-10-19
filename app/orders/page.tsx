'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ScrollText } from 'lucide-react';
import { loadState, fmtUSD, fmtQty, type PaperState } from '@/lib/quasar';
import { cn } from '@/lib/utils';

export default function OrdersPage() {
  const [state] = useState<PaperState>(() => loadState());

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-white flex items-center gap-2 mb-1">
        <ScrollText size={22} className="text-accent2" />
        Orders
      </h1>
      <p className="text-sm text-slate-400 mb-5">
        Your demo order history — every fill is simulated, <span className="text-amber-300/90 font-semibold">no real money</span>.
      </p>

      <div className="bg-panel border border-edge rounded-2xl overflow-hidden">
        {state.orders.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            No demo orders yet.{' '}
            <Link href="/" className="text-accent2 hover:underline font-semibold">
              Place your first trade
            </Link>
            .
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-edge">
                  <th className="px-4 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3 font-semibold">Pair</th>
                  <th className="px-4 py-3 font-semibold">Side</th>
                  <th className="px-4 py-3 font-semibold text-right">Lev</th>
                  <th className="px-4 py-3 font-semibold text-right">Price</th>
                  <th className="px-4 py-3 font-semibold text-right">Qty</th>
                  <th className="px-4 py-3 font-semibold text-right">Value</th>
                  <th className="px-4 py-3 font-semibold text-right">Fee</th>
                  <th className="px-4 py-3 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {state.orders.map((o) => (
                  <tr key={o.id} className="border-b border-edge/60 hover:bg-panel2/60 transition">
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap tabular-nums">
                      {new Date(o.time).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 font-bold text-white">{o.pair}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-md',
                          o.side === 'buy' ? 'text-up bg-up/15' : 'text-down bg-down/15'
                        )}
                      >
                        {o.side}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">
                      {o.leverage && o.leverage > 1 ? (
                        <span className={cn('px-1.5 py-0.5 rounded', o.leverage >= 50 ? 'text-red-300 bg-red-500/15' : 'text-accent bg-accent/15')}>
                          {o.leverage}x
                        </span>
                      ) : (
                        <span className="text-slate-500">1x</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtUSD(o.price)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtQty(o.qty)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtUSD(o.usd)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400 tabular-nums">{fmtUSD(o.fee)}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          'text-[11px] font-semibold rounded-md px-2 py-1 capitalize',
                          o.status === 'liquidated' || o.status === 'stopped'
                            ? 'text-red-200 bg-red-500/15 border border-red-500/40'
                            : o.status === 'take-profit'
                              ? 'text-up bg-up/15 border border-up/40'
                              : 'text-slate-400 bg-panel2 border border-edge'
                        )}
                      >
                        {o.status === 'take-profit' ? 'take-profit ✓' : o.status}
                      </span>
                      {o.orderType && o.orderType !== 'delivery' && (
                        <span className="ml-1.5 text-[10px] font-bold uppercase text-accent bg-accent/10 border border-accent/30 rounded px-1.5 py-0.5">
                          {o.orderType}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
