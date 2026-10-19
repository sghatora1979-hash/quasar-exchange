'use client';

import { useEffect, useRef, useState } from 'react';

// Free TradingView Advanced Chart embed — manual script injection (the exact
// pattern TradingView documents). next/script sometimes never executes the
// widget on client-side navigation, leaving an empty box with no fallback.
// This version: injects the script by hand, watches for the TradingView iframe,
// and after 10s without it shows a BUILT-IN fallback candle chart from
// /api/history so the chart area is never empty.

type Bar = { t: number; o: number; h: number; l: number; c: number };

/** Built-in fallback: SVG candles from Yahoo history (same data as SignalPanel). */
function FallbackChart({ yahoo, symbol }: { yahoo: string | null; symbol: string }) {
  const [bars, setBars] = useState<Bar[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!yahoo) { setErr(true); return; }
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/history?yahoo=${encodeURIComponent(yahoo)}&range=3mo&interval=1d`, { cache: 'no-store' });
        const j = await r.json();
        if (!alive || !j.ok || !Array.isArray(j.c)) { setErr(true); return; }
        const out: Bar[] = [];
        for (let i = 0; i < (j.t as number[]).length; i++) {
          const c = (j.c as number[])[i];
          if (!(c > 0)) continue;
          out.push({ t: (j.t as number[])[i], o: (j.o as number[])[i] || c, h: (j.h as number[])[i] || c, l: (j.l as number[])[i] || c, c });
        }
        if (alive) setBars(out.slice(-60));
      } catch {
        if (alive) setErr(true);
      }
    })();
    return () => { alive = false; };
  }, [yahoo]);

  if (err) return <p className="text-xs text-slate-400 text-center py-8">Fallback chart unavailable — check your connection and retry.</p>;
  if (!bars) return <p className="text-xs text-slate-400 text-center py-8">Loading built-in chart…</p>;
  if (bars.length < 2) return <p className="text-xs text-slate-400 text-center py-8">Not enough history for a chart.</p>;

  const W = 720, H = 420, P = 12;
  const hi = Math.max(...bars.map((b) => b.h)), lo = Math.min(...bars.map((b) => b.l));
  const span = hi - lo || 1;
  const X = (i: number) => P + (i / (bars.length - 1)) * (W - 2 * P);
  const Y = (v: number) => H - P - ((v - lo) / span) * (H - 2 * P);
  const bw = Math.max(2, (W - 2 * P) / bars.length * 0.6);
  const last = bars[bars.length - 1];

  return (
    <div>
      <div className="flex items-center justify-between px-1 pt-1 pb-2">
        <span className="text-xs font-bold text-slate-300">Built-in chart · {symbol} · daily candles (demo fallback)</span>
        <span className="text-xs font-mono text-white">Last {last.c.toLocaleString('en-US', { maximumFractionDigits: 4 })}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[380px] sm:h-[440px]">
        {bars.map((b, i) => {
          const up = b.c >= b.o;
          const col = up ? '#26a69a' : '#ef5350';
          return (
            <g key={b.t}>
              <line x1={X(i)} x2={X(i)} y1={Y(b.h)} y2={Y(b.l)} stroke={col} strokeWidth={1} />
              <rect x={X(i) - bw / 2} y={Y(Math.max(b.o, b.c))} width={bw} height={Math.max(1, Math.abs(Y(b.o) - Y(b.c)))} fill={col} />
            </g>
          );
        })}
      </svg>
      <p className="text-[11px] text-slate-500 px-1 pb-1">Green = up day · Red = down day · From public market history. Demo only.</p>
    </div>
  );
}

export function TradingViewChart({ tvSymbol, yahoo }: { tvSymbol: string; yahoo?: string | null }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    const widget = widgetRef.current;
    if (!box || !widget) return;
    setLoaded(false);
    setFailed(false);
    widget.innerHTML = '';
    // Remove any previous injected script for this widget.
    box.querySelectorAll('script[data-tv-injected]').forEach((s) => s.remove());

    const config = {
      autosize: true,
      symbol: tvSymbol,
      interval: '60',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      hide_side_toolbar: false,
      allow_symbol_change: false,
      save_image: false,
      backgroundColor: 'rgba(13, 20, 36, 1)',
      gridColor: 'rgba(28, 39, 64, 0.6)',
      overrides: {
        'mainSeriesProperties.candleStyle.upColor': '#26a69a',
        'mainSeriesProperties.candleStyle.downColor': '#ef5350',
        'mainSeriesProperties.candleStyle.borderUpColor': '#26a69a',
        'mainSeriesProperties.candleStyle.borderDownColor': '#ef5350',
        'mainSeriesProperties.candleStyle.wickUpColor': '#26a69a',
        'mainSeriesProperties.candleStyle.wickDownColor': '#ef5350',
      },
    };
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.setAttribute('data-tv-injected', '1');
    script.text = JSON.stringify(config);
    box.appendChild(script);

    // Watch for the TradingView iframe; give up after 10s → fallback chart.
    const start = Date.now();
    const iv = setInterval(() => {
      if (widget.querySelector('iframe')) {
        setLoaded(true);
        clearInterval(iv);
      } else if (Date.now() - start > 10000) {
        setFailed(true);
        clearInterval(iv);
      }
    }, 500);
    return () => {
      clearInterval(iv);
      script.remove();
    };
  }, [tvSymbol, attempt]);

  return (
    <div ref={boxRef} className="tradingview-widget-container min-h-[480px] sm:min-h-[560px] rounded-2xl overflow-hidden border border-edge bg-panel relative">
      <div ref={widgetRef} className="tradingview-widget-container__widget h-full" />
      {!loaded && !failed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-slate-400">Loading TradingView chart…</p>
        </div>
      )}
      {failed && (
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <p className="text-xs text-amber-300">
              TradingView chart didn&apos;t load (browser or network may block it). Showing the built-in chart instead.
            </p>
            <button
              onClick={() => setAttempt((a) => a + 1)}
              className="text-xs font-bold bg-panel2 border border-edge text-white rounded-lg px-3 py-1.5 hover:border-accent/60"
            >
              Retry TradingView
            </button>
          </div>
          <FallbackChart yahoo={yahoo ?? null} symbol={tvSymbol} />
        </div>
      )}
    </div>
  );
}
