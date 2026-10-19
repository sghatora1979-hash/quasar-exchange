'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, RefreshCw, TriangleAlert, ChevronLeft, ChevronRight, Globe2, Coins, CandlestickChart } from 'lucide-react';
import { PAIRS } from '@/lib/pairs';
import { FOREX_PAIRS, forexPrices } from '@/lib/forex';
import { STOCKS, fmtStockPrice, fmtVol, type StockRegion } from '@/lib/stocks';
import { CountrySelector } from '@/components/CountrySelector';
import { fmtUSD } from '@/lib/quasar';
import { Sparkline } from '@/components/Sparkline';
import { TVTickerTape, TVCryptoHeatmap } from '@/components/TVWidgets';
import { BoomTitle } from '@/components/BoomTitle';
import { cn } from '@/lib/utils';

type TickerRow = {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  high24: number;
  low24: number;
  volume24: number;
};

type FxRow = {
  symbol: string;
  name: string;
  pair: string;
  price: number;
  changePct: number | null;
  decimals: number;
};

type StockRow = {
  symbol: string;
  name: string;
  region: StockRegion;
  exchange: string;
  currency: string;
  price: number;
  changePct: number | null;
  volume: number;
  decimals: number;
};

const PER_PAGE = 25;
type Tab = 'crypto' | 'forex' | 'stocks';
type RegionFilter = 'all' | StockRegion;

export default function MarketsPage() {
  const [tab, setTab] = useState<Tab>('crypto');
  const [rows, setRows] = useState<TickerRow[]>([]);
  const [sparks, setSparks] = useState<Record<string, number[]>>({});
  const [fxRows, setFxRows] = useState<FxRow[]>([]);
  const [fxNote, setFxNote] = useState('');
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [stockNote, setStockNote] = useState('');
  const [region, setRegion] = useState<RegionFilter>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const regionCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of stockRows) m[r.region] = (m[r.region] ?? 0) + 1;
    return m;
  }, [stockRows]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Crypto ticker
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('/api/ticker', { cache: 'no-store' });
        const j = await r.json();
        if (!alive) return;
        if (j.ok) {
          setRows(j.data);
          setError('');
        } else {
          setError(j.error ?? 'Market data unavailable');
        }
      } catch {
        if (alive) setError('Could not reach market data — check your connection.');
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    fetch('/api/sparklines', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setSparks(j.data);
      })
      .catch(() => {});
  }, []);

  // Forex reference rates
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('/api/forex', { cache: 'no-store' });
        const j = await r.json();
        if (!alive) return;
        if (j.ok) {
          const prices = forexPrices(j.rates as Record<string, number>);
          const changes = (j.changes ?? {}) as Record<string, number>;
          setFxRows(
            FOREX_PAIRS.filter((p) => prices[p.symbol] > 0).map((p) => ({
              symbol: p.symbol,
              name: p.name,
              pair: p.pair,
              price: prices[p.symbol],
              changePct: typeof changes[p.symbol] === 'number' ? changes[p.symbol] : null,
              decimals: p.decimals,
            }))
          );
          setFxNote(j.note ?? '');
        }
      } catch {
        /* forex tab shows empty state */
      }
    };
    load();
    const t = setInterval(load, 3600_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // Stock daily closes
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('/api/stocks', { cache: 'no-store' });
        const j = await r.json();
        if (!alive) return;
        if (j.ok) {
          const bySymbol: Record<string, { price: number; changePct: number | null; volume: number }> = {};
          for (const q of j.quotes as { symbol: string; price: number; changePct: number | null; volume: number }[]) {
            bySymbol[q.symbol] = q;
          }
          setStockRows(
            STOCKS.filter((s) => bySymbol[s.symbol]?.price > 0).map((s) => ({
              symbol: s.symbol,
              name: s.name,
              region: s.region,
              exchange: s.exchange,
              currency: s.currency,
              price: bySymbol[s.symbol].price,
              changePct: bySymbol[s.symbol].changePct,
              volume: bySymbol[s.symbol].volume,
              decimals: s.decimals,
            }))
          );
          setStockNote(j.note ?? '');
        }
      } catch {
        /* stocks tab shows empty state */
      }
    };
    load();
    const t = setInterval(load, 1800_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (tab === 'forex') {
      if (!needle) return fxRows;
      return fxRows.filter(
        (r) => r.symbol.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle)
      );
    }
    if (tab === 'stocks') {
      let list = region === 'all' ? stockRows : stockRows.filter((r) => r.region === region);
      if (!needle) return list;
      return list.filter(
        (r) =>
          r.symbol.toLowerCase().includes(needle) ||
          r.name.toLowerCase().includes(needle) ||
          r.exchange.toLowerCase().includes(needle)
      );
    }
    if (!needle) {
      // Pin the native QSR demo pair at the very top of the crypto list.
      const qsr = rows.find((r) => r.symbol === 'QSR');
      return qsr ? [qsr, ...rows.filter((r) => r.symbol !== 'QSR')] : rows;
    }
    return rows.filter(
      (r) => r.symbol.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle)
    );
  }, [rows, fxRows, stockRows, q, tab, region]);

  useEffect(() => {
    setPage(1);
  }, [q, tab, region]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE),
    [filtered, safePage]
  );

  return (
    <div>
      <BoomTitle />
      <div className="mb-5">
        <TVTickerTape />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            Markets
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 rounded-full px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 live-dot" />
              Live
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {tab === 'crypto'
              ? 'Live prices via Kraken · demo trading only — '
              : tab === 'forex'
                ? 'Daily FX reference rates · demo trading only — '
                : 'Daily stock closes · demo trading only — '}
            <span className="text-amber-300/90 font-semibold">no real money</span>
          </p>
        </div>
        <div className="sm:ml-auto relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search markets…"
            className="w-full bg-panel border border-edge rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-accent/60"
          />
        </div>
      </div>

      {/* Crypto | Forex | Stocks tabs */}
      <div className="mb-4 inline-flex bg-panel border border-edge rounded-xl p-1 gap-1">
        {(
          [
            { id: 'crypto', label: 'Crypto', icon: Coins },
            { id: 'forex', label: 'Forex', icon: Globe2 },
            { id: 'stocks', label: 'Stocks', icon: CandlestickChart },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-bold transition',
              tab === t.id ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:text-white'
            )}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Country selector for stocks — region-grouped with live market hours */}
      {tab === 'stocks' && (
        <CountrySelector
          selected={region}
          onSelect={(code) => { setRegion(code as RegionFilter); setPage(1); }}
          counts={regionCounts}
        />
      )}

      {tab === 'forex' && fxNote && (
        <div className="mb-4 flex items-center gap-2 text-xs text-sky-300 bg-sky-400/10 border border-sky-400/30 rounded-xl px-3 py-2.5">
          <Globe2 size={14} />
          {fxNote}
        </div>
      )}

      {tab === 'stocks' && stockNote && (
        <div className="mb-4 flex items-center gap-2 text-xs text-violet-300 bg-violet-400/10 border border-violet-400/30 rounded-xl px-3 py-2.5">
          <CandlestickChart size={14} />
          {stockNote}
        </div>
      )}

      {error && tab === 'crypto' && (
        <div className="mb-4 flex items-center gap-2 text-xs text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-xl px-3 py-2.5">
          <TriangleAlert size={14} />
          {error}
        </div>
      )}

      <div className="bg-panel border border-edge rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-edge">
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Pair</th>
                <th className="px-4 py-3 font-semibold text-right">Price</th>
                <th className="px-4 py-3 font-semibold text-right">{tab === 'crypto' ? '24h %' : 'Day %'}</th>
                {tab === 'crypto' ? (
                  <>
                    <th className="px-4 py-3 font-semibold text-right">24h High</th>
                    <th className="px-4 py-3 font-semibold text-right">24h Low</th>
                    <th className="px-4 py-3 font-semibold text-right">Last 24h</th>
                  </>
                ) : tab === 'stocks' ? (
                  <>
                    <th className="px-4 py-3 font-semibold text-right">Exchange</th>
                    <th className="px-4 py-3 font-semibold text-right">Volume</th>
                  </>
                ) : (
                  <th className="px-4 py-3 font-semibold text-right">Source</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading && tab === 'crypto' &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-edge/60">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="h-4 rounded bg-panel2 animate-pulse" />
                    </td>
                  </tr>
                ))}
              {tab === 'crypto' &&
                !loading &&
                (paged as TickerRow[]).map((r, i) => {
                  const info = PAIRS.find((p) => p.symbol === r.symbol);
                  const up = r.changePct >= 0;
                  return (
                    <tr key={r.symbol} className="border-b border-edge/60 hover:bg-panel2/60 transition">
                      <td className="px-4 py-3 text-slate-500 tabular-nums">{(safePage - 1) * PER_PAGE + i + 1}</td>
                      <td className="px-4 py-3">
                        <Link href={`/trade/${r.symbol}USD`} className="flex items-center gap-2.5 group">
                          {r.symbol === 'QSR' ? (
                            <img
                              src="/quasar-coin-logo.png"
                              alt="QSR coin logo"
                              className="w-8 h-8 rounded-full border border-accent/50 object-cover"
                            />
                          ) : (
                            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/40 to-accent2 border border-edge flex items-center justify-center text-[10px] font-black text-white">
                              {r.symbol.slice(0, 3)}
                            </span>
                          )}
                          <span>
                            <span className="flex items-center gap-1.5 font-bold text-white group-hover:text-accent2 transition">
                              {r.symbol}
                              <span className="text-slate-500 font-medium">/USD</span>
                              {r.symbol === 'QSR' && (
                                <span className="text-[9px] font-black uppercase tracking-wider text-amber-200 bg-amber-400/15 border border-amber-300/40 rounded-md px-1.5 py-0.5">
                                  Native
                                </span>
                              )}
                            </span>
                            <span className="block text-[11px] text-slate-500">
                              {r.name}
                              {r.symbol === 'QSR' && (
                                <span className="text-amber-300/70"> · simulated demo price</span>
                              )}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white tabular-nums">
                        {fmtUSD(r.price, info?.decimals ?? 2)}
                      </td>
                      <td className={cn('px-4 py-3 text-right font-mono font-semibold tabular-nums', up ? 'text-up' : 'text-down')}>
                        {up ? '+' : ''}
                        {r.changePct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400 tabular-nums">
                        {fmtUSD(r.high24, info?.decimals ?? 2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400 tabular-nums">
                        {fmtUSD(r.low24, info?.decimals ?? 2)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Sparkline data={sparks[r.symbol]} positive={up} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              {tab === 'forex' &&
                (paged as FxRow[]).map((r, i) => {
                  const up = (r.changePct ?? 0) >= 0;
                  return (
                    <tr key={r.symbol} className="border-b border-edge/60 hover:bg-panel2/60 transition">
                      <td className="px-4 py-3 text-slate-500 tabular-nums">{(safePage - 1) * PER_PAGE + i + 1}</td>
                      <td className="px-4 py-3">
                        <Link href={`/trade/${r.pair}`} className="flex items-center gap-2.5 group">
                          <span className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400/40 to-accent2 border border-edge flex items-center justify-center text-[10px] font-black text-white">
                            {r.symbol.slice(0, 2)}
                          </span>
                          <span>
                            <span className="block font-bold text-white group-hover:text-accent2 transition">
                              {r.symbol}
                              <span className="text-slate-500 font-medium">/USD</span>
                            </span>
                            <span className="block text-[11px] text-slate-500">{r.name}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white tabular-nums">
                        {fmtUSD(r.price, r.decimals)}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-mono font-semibold tabular-nums',
                          r.changePct === null ? 'text-slate-500' : up ? 'text-up' : 'text-down'
                        )}
                      >
                        {r.changePct === null ? '—' : `${up ? '+' : ''}${r.changePct.toFixed(2)}%`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300 bg-sky-400/10 border border-sky-400/30 rounded-md px-2 py-1">
                          Ref
                        </span>
                      </td>
                    </tr>
                  );
                })}
              {tab === 'stocks' &&
                (paged as StockRow[]).map((r, i) => {
                  const up = (r.changePct ?? 0) >= 0;
                  return (
                    <tr key={r.symbol} className="border-b border-edge/60 hover:bg-panel2/60 transition">
                      <td className="px-4 py-3 text-slate-500 tabular-nums">{(safePage - 1) * PER_PAGE + i + 1}</td>
                      <td className="px-4 py-3">
                        <Link href={`/trade/${r.symbol}`} className="flex items-center gap-2.5 group">
                          <span className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400/40 to-accent2 border border-edge flex items-center justify-center text-[10px] font-black text-white">
                            {r.symbol.slice(0, 2)}
                          </span>
                          <span>
                            <span className="block font-bold text-white group-hover:text-accent2 transition">
                              {r.symbol}
                            </span>
                            <span className="block text-[11px] text-slate-500">{r.name}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white tabular-nums">
                        {fmtStockPrice(r.price, r.currency, r.decimals)}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-mono font-semibold tabular-nums',
                          r.changePct === null ? 'text-slate-500' : up ? 'text-up' : 'text-down'
                        )}
                      >
                        {r.changePct === null ? '—' : `${up ? '+' : ''}${r.changePct.toFixed(2)}%`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-panel2 border border-edge rounded-md px-2 py-1">
                          {r.exchange}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400 tabular-nums">
                        {fmtVol(r.volume)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {tab === 'stocks' && stockRows.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            Stock data unavailable right now — please try again later.
          </div>
        )}
        {tab === 'stocks' && stockRows.length > 0 && filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            No stocks match “{q}”.
          </div>
        )}
        {tab === 'forex' && fxRows.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            Forex reference rates unavailable right now — please try again later.
          </div>
        )}
        {!loading && tab === 'crypto' && filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            No markets match “{q}”.
          </div>
        )}
        {tab === 'forex' && fxRows.length > 0 && filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            No currencies match “{q}”.
          </div>
        )}
      </div>

      {!loading && pageCount > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-panel border border-edge text-sm text-slate-300 hover:border-accent/60 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft size={14} />
            Prev
          </button>
          <span className="text-xs text-slate-400 tabular-nums px-2">
            Page {safePage} of {pageCount} · {filtered.length} markets
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={safePage === pageCount}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-panel border border-edge text-sm text-slate-300 hover:border-accent/60 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-500">
        <RefreshCw size={12} />
        {tab === 'crypto'
          ? `Prices refresh every 15 seconds · ${PAIRS.length} crypto + ${FOREX_PAIRS.length} forex + ${STOCKS.length} stocks demo markets · trading is simulated`
          : tab === 'forex'
            ? `Daily reference rates (ECB) · ${FOREX_PAIRS.length} FX pairs · trading is simulated`
            : `Daily closes (Yahoo Finance) · ${STOCKS.length} stocks · trading is simulated`}
      </p>

      {tab === 'crypto' && (
        <div className="mt-8">
          <h2 className="text-lg font-extrabold text-white mb-3">Market Heatmap</h2>
          <TVCryptoHeatmap />
          <p className="mt-2 text-[11px] text-slate-500">
            Live crypto heatmap by TradingView — box size = market cap, color = 24h change.
          </p>
        </div>
      )}
    </div>
  );
}
