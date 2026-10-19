'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TradingViewChart } from '@/components/TradingViewChart';
import { Sparkline } from '@/components/Sparkline';
import { PAIRS } from '@/lib/pairs';

type TickerRow = {
  symbol: string;
  name: string;
  kraken: string;
  price: number;
  open: number;
  changePct: number;
  high24: number;
  low24: number;
  volume24: number;
  simulated?: boolean;
};

type ChainStats = {
  btc: {
    height: number | null;
    hashRatePH: number | null;
    difficulty: number | null;
    avgBlockMinutes: number | null;
    txCount24h: number | null;
    priceUSD: number | null;
  } | null;
  quasar: {
    name: string;
    network: string;
    live: boolean;
    note: string;
    blockTimeSec: number;
    rewardNow: string;
    schedule: string;
    hardCap: number;
    minedTotal: number;
    founderAllocation: number;
    vesting: string;
  };
};

function fmtPrice(v: number): string {
  if (!(v > 0)) return '—';
  const d = v >= 1000 ? 1 : v >= 100 ? 2 : v >= 1 ? 3 : v >= 0.01 ? 4 : 6;
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtBig(v: number | null): string {
  if (v == null || !(v > 0)) return '—';
  if (v >= 1e12) return (v / 1e12).toFixed(2) + 'T';
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="text-xl font-bold text-white mt-1 font-mono">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function TrackPage() {
  const [rows, setRows] = useState<TickerRow[]>([]);
  const [sparks, setSparks] = useState<Record<string, number[]>>({});
  const [chain, setChain] = useState<ChainStats | null>(null);
  const [selected, setSelected] = useState('ETH');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, s, c] = await Promise.all([
        fetch('/api/ticker', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/sparklines', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/chainstats', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      if (t?.ok) setRows(t.data as TickerRow[]);
      else if (!rows.length) setErr(t?.error ?? 'Price feed unavailable');
      if (s?.ok) setSparks(s.data as Record<string, number[]>);
      if (c?.ok) setChain(c.data as ChainStats);
      setUpdatedAt(new Date());
    } catch {
      if (!rows.length) setErr('Network error — check connection and retry.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const tvOf = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of PAIRS) m[p.symbol] = p.tv;
    return m;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const sel = rows.find((r) => r.symbol === selected) ?? rows[0];
  const selTv = sel && !sel.simulated ? tvOf[sel.symbol] : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Track</h1>
          <p className="text-sm text-slate-400 mt-1">
            Live crypto prices, charts &amp; blockchain stats. Demo — paper data, no real trading.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : 'Connecting…'}
          <span className="ml-2 inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse align-middle" />
        </div>
      </div>

      {err && (
        <div className="bg-red-950/50 border border-red-800 rounded-2xl p-4 text-sm text-red-200">{err}</div>
      )}

      {/* Chart */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <span className="text-lg font-bold text-white">{sel?.symbol ?? '—'}/USD</span>
            <span className="text-sm text-slate-400 ml-2">{sel?.name ?? ''}</span>
            {sel?.simulated && (
              <span className="ml-2 text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full px-2 py-0.5">
                Simulated demo price
              </span>
            )}
          </div>
          <div className={`text-lg font-mono font-bold ${((sel?.changePct ?? 0) >= 0) ? 'text-emerald-400' : 'text-red-400'}`}>
            ${sel ? fmtPrice(sel.price) : '—'}
            <span className="text-sm ml-2">
              {sel ? `${sel.changePct >= 0 ? '+' : ''}${sel.changePct.toFixed(2)}%` : ''}
            </span>
          </div>
        </div>
        {selTv ? (
          <TradingViewChart key={selTv} tvSymbol={`KRAKEN:${selTv}USD`} yahoo={`${sel!.symbol}-USD`} />
        ) : (
          <div className="py-10 text-center">
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              {sel?.simulated
                ? 'QSR is not listed on any real exchange — this demo price is simulated. No live chart exists yet.'
                : 'Select a coin from the list below to see its live chart.'}
            </p>
            {sel?.symbol && sparks[sel.symbol] && (
              <div className="mt-4 flex justify-center">
                <Sparkline data={sparks[sel.symbol]} width={320} height={90} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Prices */}
        <div className="lg:col-span-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-white">Crypto prices</h2>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search coins…"
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-500/60 w-40"
            />
          </div>
          {loading && !rows.length ? (
            <p className="text-sm text-slate-500 py-8 text-center">Loading live prices…</p>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                    <th className="py-2 pr-2 font-semibold">Coin</th>
                    <th className="py-2 pr-2 font-semibold text-right">Price</th>
                    <th className="py-2 pr-2 font-semibold text-right">24h</th>
                    <th className="py-2 font-semibold text-right">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const up = r.changePct >= 0;
                    const active = sel?.symbol === r.symbol;
                    return (
                      <tr
                        key={r.symbol}
                        onClick={() => setSelected(r.symbol)}
                        className={`border-b border-slate-800/60 cursor-pointer transition-colors ${active ? 'bg-amber-500/10' : 'hover:bg-slate-800/40'}`}
                      >
                        <td className="py-2.5 pr-2">
                          <span className="font-bold text-white">{r.symbol}</span>
                          <span className="text-slate-500 ml-2 hidden sm:inline">{r.name}</span>
                          {r.simulated && (
                            <span className="ml-2 text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 rounded-full px-1.5 py-0.5">demo</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-2 text-right font-mono text-slate-200">${fmtPrice(r.price)}</td>
                        <td className={`py-2.5 pr-2 text-right font-mono font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                          {up ? '+' : ''}{r.changePct.toFixed(2)}%
                        </td>
                        <td className="py-2.5 text-right">
                          <div className="inline-block"><Sparkline data={sparks[r.symbol]} width={110} height={32} /></div>
                        </td>
                      </tr>
                    );
                  })}
                  {!filtered.length && (
                    <tr><td colSpan={4} className="py-8 text-center text-slate-500 text-sm">No coins match “{query}”.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-slate-600 mt-3">Live public prices via Kraken · refreshes every 30s · demo only</p>
        </div>

        {/* Blockchain */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/30 rounded-2xl p-4">
            <h2 className="text-base font-bold text-white mb-1">Blockchain — Quasar (QSR)</h2>
            <p className="text-[11px] text-amber-200/70 mb-3">{chain?.quasar.note ?? 'Stage-2 testnet'}</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Block time</span><span className="font-mono text-white">~30 sec</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Reward now</span><span className="font-mono text-white">50,000 / block</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Schedule</span><span className="font-mono text-white text-right">50k → 25k → 12.5k → stop</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Hard cap</span><span className="font-mono text-white">500B QSR</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Founder vesting</span><span className="font-mono text-white">1 week linear</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
