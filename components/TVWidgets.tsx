'use client';

import { useEffect, useRef, useState } from 'react';

// Shared free TradingView embeds — manual script injection (the exact pattern
// TradingView documents). next/script sometimes never executes the widget on
// client-side navigation, leaving an empty box with no fallback.
//
// WHY BLANK? These boxes load from TradingView's own website (s3.tradingview.com),
// NOT from Kraken. If the browser / ad-blocker / network blocks TradingView,
// they stay empty — while Kraken prices elsewhere in the app keep working.
// So every widget below now has a BUILT-IN Kraken-powered fallback: if the
// TradingView iframe doesn't appear in 10s, the fallback renders instead and
// the box is never blank.

type TickerRow = { symbol: string; price: number; changePct: number; volume24: number };

async function fetchTickers(pairs: string): Promise<TickerRow[]> {
  const r = await fetch(`/api/ticker?pair=${pairs}`, { cache: 'no-store' });
  const j = await r.json();
  if (!j.ok || !Array.isArray(j.data)) throw new Error('ticker unavailable');
  return j.data as TickerRow[];
}

const HEAT_PAIRS = 'XBTUSD,ETHUSD,SOLUSD,XRPUSD,DOGEUSD,ADAUSD,AVAXUSD,LINKUSD,DOTUSD,MATICUSD';

/** Fallback ticker tape: scrolling Kraken prices (no TradingView needed). */
function FallbackTicker() {
  const [rows, setRows] = useState<TickerRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchTickers(HEAT_PAIRS).then((d) => alive && setRows(d)).catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, []);
  if (!rows) return <p className="text-xs text-slate-400 px-3 py-2">Loading prices…</p>;
  if (!rows.length) return <p className="text-xs text-slate-400 px-3 py-2">Prices unavailable — retry shortly.</p>;
  const items = [...rows, ...rows];
  return (
    <div className="overflow-hidden whitespace-nowrap py-2">
      <div className="inline-flex gap-6 animate-[ticker_30s_linear_infinite]">
        {items.map((t, i) => (
          <span key={`${t.symbol}-${i}`} className="text-xs font-mono">
            <span className="font-bold text-white">{t.symbol}</span>{' '}
            <span className="text-slate-300">${t.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>{' '}
            <span className={t.changePct >= 0 ? 'text-up' : 'text-down'}>
              {t.changePct >= 0 ? '+' : ''}{t.changePct.toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
      <style>{`@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}

/** Fallback heatmap: Kraken 24h-change boxes (no TradingView needed). */
function FallbackHeatmap() {
  const [rows, setRows] = useState<TickerRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchTickers(HEAT_PAIRS).then((d) => alive && setRows(d)).catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, []);
  if (!rows) return <p className="text-xs text-slate-400 text-center py-8">Loading heatmap…</p>;
  if (!rows.length) return <p className="text-xs text-slate-400 text-center py-8">Heatmap unavailable — retry shortly.</p>;
  return (
    <div className="p-3">
      <p className="text-[11px] text-slate-500 mb-2">Built-in heatmap · Kraken 24h change (demo fallback — box color = 24h change)</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {rows.map((t) => {
          const up = t.changePct >= 0;
          const intensity = Math.min(0.85, 0.25 + Math.abs(t.changePct) / 10);
          return (
            <div
              key={t.symbol}
              className="rounded-xl px-3 py-3 text-center"
              style={{ background: up ? `rgba(38,166,154,${intensity})` : `rgba(239,83,80,${intensity})` }}
            >
              <div className="text-sm font-extrabold text-white">{t.symbol}</div>
              <div className="text-xs font-mono text-white/90">${t.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
              <div className="text-xs font-mono font-bold text-white">{up ? '+' : ''}{t.changePct.toFixed(2)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Fallback news: live headlines from the AI Bot's news route (RSS, no TradingView). */
function FallbackNews() {
  const [heads, setHeads] = useState<{ title: string; url: string }[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/assistant?q=market%20news&mode=news`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => alive && setHeads(Array.isArray(j.sources) ? j.sources.slice(0, 8) : []))
      .catch(() => alive && setHeads([]));
    return () => { alive = false; };
  }, []);
  if (!heads) return <p className="text-xs text-slate-400 text-center py-8">Loading headlines…</p>;
  if (!heads.length) return <p className="text-xs text-slate-400 text-center py-8">Headlines unavailable — retry shortly.</p>;
  return (
    <div className="p-4 space-y-2.5 overflow-y-auto h-full">
      <p className="text-[11px] text-slate-500">Built-in headlines · CoinDesk / CoinTelegraph / Economic Times (demo fallback)</p>
      {heads.map((h, i) => (
        <a key={i} href={h.url || '#'} target="_blank" rel="noreferrer" className="block text-sm text-slate-200 hover:text-white leading-snug">
          • {h.title}
        </a>
      ))}
    </div>
  );
}

function WidgetShell({
  src,
  config,
  height,
  label,
  fallback,
}: {
  src: string;
  config: Record<string, unknown>;
  height: number | string;
  label: string;
  fallback?: React.ReactNode;
}) {
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
    box.querySelectorAll('script[data-tv-injected]').forEach((s) => s.remove());

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute('data-tv-injected', '1');
    script.text = JSON.stringify(config);
    box.appendChild(script);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, attempt]);

  return (
    <div ref={boxRef} className="tradingview-widget-container rounded-2xl overflow-hidden border border-edge bg-panel relative" style={{ height }}>
      <div ref={widgetRef} className="tradingview-widget-container__widget h-full" aria-label={label} />
      {!loaded && !failed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-slate-400">Loading {label}…</p>
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 overflow-y-auto">
          {fallback ?? (
            <div className="flex flex-col items-center justify-center gap-2 p-4 text-center h-full">
              <p className="text-xs text-amber-300">{label} didn&apos;t load — your browser or network may block TradingView widgets.</p>
              <button
                onClick={() => setAttempt((a) => a + 1)}
                className="text-xs font-bold bg-panel2 border border-edge text-white rounded-lg px-3 py-1.5 hover:border-accent/60"
              >
                Retry TradingView
              </button>
            </div>
          )}
          <button
            onClick={() => setAttempt((a) => a + 1)}
            className="absolute top-2 right-2 text-[10px] font-bold bg-panel2 border border-edge text-slate-300 rounded-lg px-2 py-1 hover:border-accent/60"
          >
            Retry TradingView
          </button>
        </div>
      )}
    </div>
  );
}

const TAPE_SYMBOLS = [
  'BTCUSD',
  'ETHUSD',
  'SOLUSD',
  'XRPUSD',
  'DOGEUSD',
  'ADAUSD',
  'AVAXUSD',
  'LINKUSD',
  'DOTUSD',
  'MATICUSD',
].map((s) => ({ proName: `KRAKEN:${s}`, title: s.replace('USD', '') }));

/** Scrolling crypto price tape — place at the top of the markets page. */
export function TVTickerTape() {
  return (
    <WidgetShell
      src="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js"
      height={46}
      label="Live crypto price ticker"
      config={{
        symbols: TAPE_SYMBOLS,
        showSymbolLogo: true,
        colorTheme: 'dark',
        isTransparent: false,
        displayMode: 'adaptive',
        locale: 'en',
      }}
      fallback={<FallbackTicker />}
    />
  );
}

/** Crypto market heatmap (sized by market cap). */
export function TVCryptoHeatmap() {
  return (
    <WidgetShell
      src="https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js"
      height={520}
      label="Crypto market heatmap"
      config={{
        dataSource: 'Crypto',
        blockSize: 'market_cap',
        blockColor: 'change',
        locale: 'en',
        symbolUrl: '',
        colorTheme: 'dark',
        hasTopBar: false,
        isDataSetEnabled: false,
        isZoomEnabled: true,
        hasSymbolTooltip: true,
        width: '100%',
        height: '100%',
      }}
      fallback={<FallbackHeatmap />}
    />
  );
}

/** Crypto news timeline / top stories feed. */
export function TVTopStories() {
  return (
    <WidgetShell
      src="https://s3.tradingview.com/external-embedding/embed-widget-timeline.js"
      height={560}
      label="Crypto news"
      config={{
        feedMode: 'all_symbols',
        colorTheme: 'dark',
        isTransparent: false,
        displayMode: 'regular',
        width: '100%',
        height: '100%',
        locale: 'en',
      }}
      fallback={<FallbackNews />}
    />
  );
}
