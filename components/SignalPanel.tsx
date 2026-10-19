'use client';

import { useEffect, useState } from 'react';
import { Activity, TriangleAlert } from 'lucide-react';
import { analyzeBars, type MarketVerdict, type Ohlc } from '@/lib/indicators';
import { fmtUSD } from '@/lib/quasar';
import { cn } from '@/lib/utils';

type Props = {
  yahoo: string | null; // Yahoo symbol for history; null hides the panel
  symbolLabel: string;
  priceDecimals?: number;
};

/**
 * Per-symbol signal panel: Supertrend + Quasar Trend + RSI + ADX
 * computed from recent daily history. Educational, demo only.
 */
export function SignalPanel({ yahoo, symbolLabel, priceDecimals = 4 }: Props) {
  const [verdict, setVerdict] = useState<MarketVerdict | null | undefined>(undefined);
  const [barsCount, setBarsCount] = useState(0);

  useEffect(() => {
    if (!yahoo) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/history?yahoo=${encodeURIComponent(yahoo)}&range=6mo&interval=1d`, { cache: 'no-store' });
        const j = await r.json();
        if (!alive || !j.ok || !Array.isArray(j.c)) { setVerdict(null); return; }
        const n = (j.t as number[]).length;
        const bars: Ohlc[] = [];
        for (let i = 0; i < n; i++) {
          const c = (j.c as number[])[i];
          if (!(c > 0)) continue;
          bars.push({ t: (j.t as number[])[i], o: (j.o as number[])[i] || c, h: (j.h as number[])[i] || c, l: (j.l as number[])[i] || c, c });
        }
        setBarsCount(bars.length);
        setVerdict(analyzeBars(bars));
      } catch {
        if (alive) setVerdict(null);
      }
    })();
    return () => { alive = false; };
  }, [yahoo]);

  if (!yahoo) return null;

  const badge = (() => {
    if (verdict === undefined)
      return { emoji: '⚪', text: 'LOADING', cls: 'text-slate-400 bg-slate-500/10 border-slate-500/30' };
    if (verdict === null)
      return { emoji: '⚪', text: 'NEUTRAL', cls: 'text-slate-400 bg-slate-500/10 border-slate-500/30' };
    if (verdict.verdict === 'bullish')
      return { emoji: '🟢', text: 'BULLISH', cls: 'text-up bg-up/10 border-up/30' };
    if (verdict.verdict === 'bearish')
      return { emoji: '🔴', text: 'BEARISH', cls: 'text-down bg-down/10 border-down/30' };
    return { emoji: '⚪', text: 'NEUTRAL', cls: 'text-slate-400 bg-slate-500/10 border-slate-500/30' };
  })();

  return (
    <div className="bg-panel border border-edge rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={15} className="text-accent" />
        <h3 className="text-sm font-extrabold text-white">Signal Panel</h3>
        <span className={cn('ml-auto text-[11px] font-black px-2.5 py-1 rounded-full border', badge.cls)}>
          {badge.emoji} {badge.text}
        </span>
      </div>
      {verdict === undefined ? (
        <p className="text-xs text-slate-500">Computing indicators from recent history…</p>
      ) : verdict === null ? (
        <p className="text-xs text-slate-500">Not enough history for {symbolLabel} to compute signals.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div className="bg-void/60 rounded-xl px-3 py-2">
              <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Supertrend (10,3)</dt>
              <dd className="font-mono text-slate-200 mt-0.5">
                {Number.isNaN(verdict.supertrend) ? '—' : fmtUSD(verdict.supertrend, priceDecimals)}{' '}
                <span className={verdict.supertrendDir === 1 ? 'text-up' : verdict.supertrendDir === -1 ? 'text-down' : 'text-slate-500'}>
                  {verdict.supertrendDir === 1 ? '▲ up' : verdict.supertrendDir === -1 ? '▼ down' : '—'}
                </span>
              </dd>
            </div>
            <div className="bg-void/60 rounded-xl px-3 py-2">
              <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Quasar Trend</dt>
              <dd className="font-mono text-slate-200 mt-0.5">
                {verdict.quasarTrend === 'up' ? '🟢 Uptrend' : verdict.quasarTrend === 'down' ? '🔴 Downtrend' : '⚪ None'}
              </dd>
            </div>
            <div className="bg-void/60 rounded-xl px-3 py-2">
              <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">RSI (14)</dt>
              <dd className="font-mono text-slate-200 mt-0.5">
                {Number.isNaN(verdict.rsi) ? '—' : verdict.rsi.toFixed(1)}
                {!Number.isNaN(verdict.rsi) && verdict.rsi < 30 && <span className="text-up"> · oversold</span>}
                {!Number.isNaN(verdict.rsi) && verdict.rsi > 70 && <span className="text-down"> · overbought</span>}
              </dd>
            </div>
            <div className="bg-void/60 rounded-xl px-3 py-2">
              <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">ADX (14)</dt>
              <dd className="font-mono text-slate-200 mt-0.5">
                {Number.isNaN(verdict.adx) ? '—' : verdict.adx.toFixed(1)}
                {!Number.isNaN(verdict.adx) && (
                  <span className="text-slate-400"> · {verdict.trending ? 'trending' : 'sideways'}</span>
                )}
              </dd>
            </div>
          </dl>
          <ul className="text-[11px] text-slate-400 space-y-1 mb-2">
            {verdict.notes.map((n, i) => <li key={i}>• {n}</li>)}
          </ul>
        </>
      )}
      <p className="flex items-start gap-1.5 text-[10px] text-slate-600">
        <TriangleAlert size={11} className="shrink-0 mt-0.5" />
        Indicators from {barsCount > 0 ? `${barsCount} daily bars` : 'recent history'} — trend tools whipsaw sideways; no indicator wins every trade. Demo only, not financial advice.
      </p>
    </div>
  );
}
