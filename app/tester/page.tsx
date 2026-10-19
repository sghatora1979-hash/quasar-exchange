'use client';

import { useMemo, useState } from 'react';
import { Activity, ChevronDown, Download, Play, Settings2, TriangleAlert, Trophy } from 'lucide-react';
import { fmtUSD, TOTAL_FEE_RATE } from '@/lib/quasar';
import { TAX_CONFIGS, taxOnFees } from '@/lib/hub';
import { cn } from '@/lib/utils';
import {
  Bar,
  BacktestResult,
  Series,
  STRATEGIES,
  StrategyDef,
  StrategyParams,
  Trade,
  runBacktest,
  strategyScore,
  synthQsrBars,
} from '@/lib/backtest';

// ---------------------------------------------------------------------------
// Symbol universe (Yahoo symbols feed /api/history; QSR is simulated demo)
// ---------------------------------------------------------------------------

type SymOpt = { key: string; label: string; yahoo: string | null; group: string };

const SYMBOLS: SymOpt[] = [
  // Crypto (Yahoo: BASE-USD)
  { key: 'DOGE', label: 'DOGE/USD', yahoo: 'DOGE-USD', group: 'Crypto' },
  { key: 'ETH', label: 'ETH/USD', yahoo: 'ETH-USD', group: 'Crypto' },
  { key: 'SOL', label: 'SOL/USD', yahoo: 'SOL-USD', group: 'Crypto' },
  { key: 'BNB', label: 'BNB/USD', yahoo: 'BNB-USD', group: 'Crypto' },
  { key: 'XRP', label: 'XRP/USD', yahoo: 'XRP-USD', group: 'Crypto' },
  { key: 'DOGE', label: 'DOGE/USD', yahoo: 'DOGE-USD', group: 'Crypto' },
  { key: 'ADA', label: 'ADA/USD', yahoo: 'ADA-USD', group: 'Crypto' },
  { key: 'QSR', label: 'QSR/USD (Native · simulated)', yahoo: null, group: 'Crypto' },
  // Stocks
  { key: 'RELIANCE.NS', label: 'RELIANCE (NSE)', yahoo: 'RELIANCE.NS', group: 'Stocks' },
  { key: 'TCS.NS', label: 'TCS (NSE)', yahoo: 'TCS.NS', group: 'Stocks' },
  { key: 'INFY.NS', label: 'INFY (NSE)', yahoo: 'INFY.NS', group: 'Stocks' },
  { key: 'HDFCBANK.NS', label: 'HDFC Bank (NSE)', yahoo: 'HDFCBANK.NS', group: 'Stocks' },
  { key: 'AAPL', label: 'AAPL (NASDAQ)', yahoo: 'AAPL', group: 'Stocks' },
  { key: 'MSFT', label: 'MSFT (NASDAQ)', yahoo: 'MSFT', group: 'Stocks' },
  { key: 'NVDA', label: 'NVDA (NASDAQ)', yahoo: 'NVDA', group: 'Stocks' },
  { key: 'TSLA', label: 'TSLA (NASDAQ)', yahoo: 'TSLA', group: 'Stocks' },
  { key: 'RY.TO', label: 'RBC (TSX)', yahoo: 'RY.TO', group: 'Stocks' },
  { key: 'DBS.SI', label: 'DBS (SGX)', yahoo: 'D05.SI', group: 'Stocks' },
  // Commodities (Yahoo futures)
  { key: 'GC=F', label: 'Gold', yahoo: 'GC=F', group: 'Commodities' },
  { key: 'SI=F', label: 'Silver', yahoo: 'SI=F', group: 'Commodities' },
  { key: 'CL=F', label: 'Crude Oil (WTI)', yahoo: 'CL=F', group: 'Commodities' },
  { key: 'NG=F', label: 'Natural Gas', yahoo: 'NG=F', group: 'Commodities' },
  { key: 'HG=F', label: 'Copper', yahoo: 'HG=F', group: 'Commodities' },
];

const RANGES = [
  { id: '3mo', label: '3M', days: 92 },
  { id: '6mo', label: '6M', days: 183 },
  { id: '1y', label: '1Y', days: 365 },
  { id: '2y', label: '2Y', days: 730 },
];

const GROUPS = ['Crypto', 'Stocks', 'Commodities'];

const fmtPx = (n: number) => {
  if (!Number.isFinite(n)) return '—';
  if (n < 0.01) return fmtUSD(n, 6);
  if (n < 1) return fmtUSD(n, 4);
  return fmtUSD(n, 2);
};

const fmtPF = (pf: number) => (pf >= 99 ? '∞' : pf.toFixed(2));

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

async function loadBars(sym: SymOpt, rangeId: string): Promise<{ bars: Bar[]; simulated: boolean }> {
  const range = RANGES.find((r) => r.id === rangeId)!;
  if (sym.yahoo === null) {
    // QSR: deterministic simulated daily demo bars.
    return { bars: synthQsrBars(range.days), simulated: true };
  }
  const r = await fetch(`/api/history?yahoo=${encodeURIComponent(sym.yahoo)}&range=${range.id}&interval=1d`, { cache: 'no-store' });
  const j = await r.json();
  if (!j.ok || !Array.isArray(j.c)) throw new Error('No history returned (demo).');
  const n = (j.t as number[]).length;
  const bars: Bar[] = [];
  for (let i = 0; i < n; i++) {
    const c = (j.c as number[])[i];
    if (!(c > 0)) continue;
    const vv = Array.isArray(j.v) ? (j.v as number[])[i] : undefined;
    bars.push({
      t: (j.t as number[])[i],
      o: (j.o as number[])[i] || c,
      h: (j.h as number[])[i] || c,
      l: (j.l as number[])[i] || c,
      c,
      v: typeof vv === 'number' && vv > 0 ? vv : undefined,
    });
  }
  return { bars, simulated: false };
}

// ---------------------------------------------------------------------------
// SVG charts
// ---------------------------------------------------------------------------

function EquityChart({ result }: { result: BacktestResult }) {
  const W = 820, H = 280, P = 36;
  const curve = result.equityCurve;
  if (curve.length < 2) return null;
  const vals = curve.flatMap((p) => [p.equity, p.peak]);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const X = (i: number) => P + (i / (curve.length - 1)) * (W - 2 * P);
  const Y = (e: number) => H - P - ((e - min) / span) * (H - 2 * P);
  const eqPts = curve.map((p, i) => `${X(i).toFixed(1)},${Y(p.equity).toFixed(1)}`).join(' ');
  // Drawdown shading: polygon between running peak and equity.
  const ddPts =
    curve.map((p, i) => `${X(i).toFixed(1)},${Y(p.peak).toFixed(1)}`).join(' ') +
    ' ' +
    [...curve].reverse().map((p, i) => `${X(curve.length - 1 - i).toFixed(1)},${Y(p.equity).toFixed(1)}`).join(' ');
  const up = result.totalReturnPct >= 0;
  return (
    <div className="bg-void/60 border border-edge rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-edge text-sm font-semibold text-white flex items-center gap-2">
        Equity curve
        <span className="text-[10px] text-slate-500 font-normal">red shading = underwater (drawdown) · demo</span>
      </div>
      <div className="p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Equity curve with drawdown shading">
          <polygon points={ddPts} fill="#ef4444" opacity="0.18" />
          <polyline points={eqPts} fill="none" stroke={up ? '#22c55e' : '#ef4444'} strokeWidth="2" />
          <text x={W - P} y={Y(curve[curve.length - 1].equity) - 8} textAnchor="end" fontSize="11" fontWeight="700" fill={up ? '#22c55e' : '#ef4444'}>
            {fmtUSD(curve[curve.length - 1].equity)}
          </text>
        </svg>
      </div>
    </div>
  );
}

function PriceChart({ bars, trades }: { bars: Bar[]; trades: Trade[] }) {
  const W = 820, H = 300, P = 36;
  if (bars.length < 2) return null;
  const closes = bars.map((b) => b.c);
  const min = Math.min(...closes), max = Math.max(...closes);
  const span = max - min || 1;
  const X = (i: number) => P + (i / (bars.length - 1)) * (W - 2 * P);
  const Y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const line = closes.map((c, i) => `${X(i).toFixed(1)},${Y(c).toFixed(1)}`).join(' ');
  const tIndex = new Map<number, number>();
  bars.forEach((b, i) => tIndex.set(b.t * 1000, i));
  const markers = trades
    .map((t) => ({ t, i: tIndex.get(t.t) ?? -1 }))
    .filter((m) => m.i >= 0);
  return (
    <div className="bg-void/60 border border-edge rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-edge text-sm font-semibold text-white flex items-center gap-2">
        Price chart with trade markers
        <span className="text-[10px] text-slate-500 font-normal">▲ buy · ▼ sell · demo</span>
      </div>
      <div className="p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Price chart with trade markers">
          <polyline points={line} fill="none" stroke="#f5c518" strokeWidth="1.5" />
          {markers.map((m, k) => {
            const isBuy = m.t.side === 'BUY';
            const cx = X(m.i), cy = Y(closes[m.i]);
            const ty = isBuy ? cy + 16 : cy - 16;
            const col = isBuy ? '#22c55e' : '#ef4444';
            return (
              <g key={k}>
                <polygon
                  points={isBuy ? `${cx},${ty + 7} ${cx - 6},${ty - 4} ${cx + 6},${ty - 4}` : `${cx},${ty - 7} ${cx - 6},${ty + 4} ${cx + 6},${ty + 4}`}
                  fill={col}
                  opacity="0.9"
                />
                {m.t.label && (
                  <text x={cx} y={isBuy ? ty + 22 : ty - 14} textAnchor="middle" fontSize="9" fontWeight="800" fill={col}>
                    {m.t.label.replace('_', ' ')}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function tradesToCsv(trades: Trade[], stratName: string, symLabel: string): string {
  const rows = [
    [`Strategy`, stratName, `Symbol`, symLabel, `Exported`, new Date().toISOString(), `DEMO — not real trading`],
    ['Date', 'Side', 'Price', 'Qty', 'Trade P&L (USD)', 'Signal'],
    ...trades.map((t) => [
      new Date(t.t).toISOString().slice(0, 10),
      t.side,
      String(t.price),
      String(t.qty),
      t.pnl === null ? '' : t.pnl.toFixed(2),
      t.label ?? '',
    ]),
  ];
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type RowData = { def: StrategyDef; result: BacktestResult; score: number };

export default function TesterPage() {
  const [symKey, setSymKey] = useState('DOGE');
  const [rangeId, setRangeId] = useState('2y');
  const [capital, setCapital] = useState('10000');
  const [useFees, setUseFees] = useState(true);
  const [params, setParams] = useState<Record<string, StrategyParams>>(
    Object.fromEntries(STRATEGIES.map((s) => [s.id, { ...s.defaults }]))
  );
  const [openParams, setOpenParams] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bars, setBars] = useState<Bar[] | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [rows, setRows] = useState<RowData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [country, setCountry] = useState('CA');

  const sym = SYMBOLS.find((s) => s.key === symKey)!;

  /** Demo tax estimate: fees ≈ round trips × 2 sides × 0.15% × capital; tax = rate × fees. */
  const taxFor = (result: BacktestResult) => {
    const cap = Math.max(100, parseFloat(capital) || 10000);
    const estFees = result.numRoundTrips * 2 * TOTAL_FEE_RATE * cap;
    const { tax } = taxOnFees(estFees, country);
    return { estFees, tax, netPct: result.totalReturnPct - (tax / cap) * 100 };
  };

  const compute = (barData: Bar[], cap: number, fee: number, p: Record<string, StrategyParams>) => {
    const series: Series = {
      c: barData.map((b) => b.c),
      h: barData.map((b) => b.h),
      l: barData.map((b) => b.l),
      o: barData.map((b) => b.o),
      v: barData.map((b) => b.v),
    };
    const out: RowData[] = STRATEGIES.map((def) => {
      const sig = def.fn(series, p[def.id] ?? def.defaults);
      const result = runBacktest(barData, sig, cap, fee);
      return { def, result, score: strategyScore(result) };
    });
    out.sort((a, b) => b.score - a.score);
    return out;
  };

  const runAll = async () => {
    setLoading(true); setError(''); setRows([]); setSelectedId(null);
    try {
      const cap = Math.max(100, parseFloat(capital) || 10000);
      const fee = useFees ? TOTAL_FEE_RATE : 0;
      const { bars: barData, simulated: sim } = await loadBars(sym, rangeId);
      if (barData.length < 60) throw new Error('Not enough history for this symbol/range (demo).');
      setBars(barData);
      setSimulated(sim);
      setRows(compute(barData, cap, fee, params));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Backtest failed (demo).');
    } finally {
      setLoading(false);
    }
  };

  const updateParam = (stratId: string, key: string, value: number) => {
    const next = { ...params, [stratId]: { ...params[stratId], [key]: value } };
    setParams(next);
    // Re-run live when data is loaded (fast on daily bars).
    if (bars && bars.length >= 60) {
      const cap = Math.max(100, parseFloat(capital) || 10000);
      const fee = useFees ? TOTAL_FEE_RATE : 0;
      setRows(compute(bars, cap, fee, next));
    }
  };

  const selected = useMemo(
    () => rows.find((r) => r.def.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const bestId = rows.length ? rows[0].def.id : null;

  const downloadCsv = () => {
    if (!selected) return;
    const csv = tradesToCsv(selected.result.trades, selected.def.name, sym.label);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quasar-tester-${selected.def.id}-${sym.key}-${rangeId}-demo.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <Activity size={22} className="text-accent" /> Strategy Tester
        </h1>
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-full px-2.5 py-1">
          Demo · PRO
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-5 max-w-3xl">
        Run <span className="text-slate-200 font-semibold">all 7 strategies</span> on the same symbol and period, side by side.
        Tune each strategy&apos;s parameters and watch the ranking change.{' '}
        <span className="text-slate-200 font-semibold">Past performance ≠ future results.</span>
      </p>

      {/* Controls */}
      <div className="bg-panel border border-edge rounded-2xl p-4 mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Symbol</label>
            <select
              value={symKey}
              onChange={(e) => { setSymKey(e.target.value); setRows([]); setBars(null); setSelectedId(null); }}
              className="w-full bg-void border border-edge rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/60"
            >
              {GROUPS.map((g) => (
                <optgroup key={g} label={g}>
                  {SYMBOLS.filter((s) => s.group === g).map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Lookback</label>
            <div className="flex rounded-xl overflow-hidden border border-edge">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setRangeId(r.id); setRows([]); setBars(null); setSelectedId(null); }}
                  className={cn(
                    'px-4 py-2.5 text-sm font-bold transition',
                    rangeId === r.id ? 'bg-accent text-white' : 'bg-void text-slate-400 hover:text-white'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="w-40">
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Capital (USD)</label>
            <input
              type="number" min="100" value={capital}
              onChange={(e) => setCapital(e.target.value)}
              className="w-full bg-void border border-edge rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-accent/60"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 bg-void border border-edge rounded-xl px-3 py-2.5 cursor-pointer select-none">
            <input
              type="checkbox" checked={useFees}
              onChange={(e) => setUseFees(e.target.checked)}
              className="accent-amber-400 w-4 h-4"
            />
            <span>Fees <span className="text-slate-500">0.15%/side</span></span>
          </label>
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Tax country (demo est.)</label>
            <select
              value={country} onChange={(e) => setCountry(e.target.value)}
              className="bg-void border border-edge rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/60"
            >
              {TAX_CONFIGS.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </select>
          </div>
          <button
            onClick={runAll} disabled={loading}
            className="flex items-center gap-2 bg-accent hover:bg-accent/85 disabled:opacity-50 text-white font-bold rounded-xl px-6 py-2.5 transition"
          >
            <Play size={15} /> {loading ? 'Testing…' : 'Run all 7'}
          </button>
        </div>
        {simulated && bars && (
          <p className="mt-3 text-[11px] text-amber-300/90">
            QSR price history is <span className="font-bold">simulated demo data</span> (QSR is not listed on any real market yet).
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-xs text-down bg-down/10 border border-down/30 rounded-xl px-3 py-2.5">
          <TriangleAlert size={14} /> {error}
        </div>
      )}

      {/* Comparison table */}
      {rows.length > 0 && (
        <div className="bg-panel border border-edge rounded-2xl overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-edge text-sm font-semibold text-white flex items-center gap-2">
            Head-to-head <span className="text-[10px] text-slate-500 font-normal">{sym.label} · {RANGES.find((r) => r.id === rangeId)?.label} · ranked by score · demo</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-edge">
                  <th className="px-4 py-3 font-semibold">Strategy</th>
                  <th className="px-4 py-3 font-semibold text-right">Return %</th>
                  <th className="px-4 py-3 font-semibold text-right">Win rate</th>
                  <th className="px-4 py-3 font-semibold text-right">Trades</th>
                  <th className="px-4 py-3 font-semibold text-right">Max DD</th>
                  <th className="px-4 py-3 font-semibold text-right">Profit factor</th>
                  <th className="px-4 py-3 font-semibold text-right">Tax est.</th>
                  <th className="px-4 py-3 font-semibold text-right">Net %</th>
                  <th className="px-4 py-3 font-semibold text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ def, result, score }) => {
                  const best = def.id === bestId;
                  const pos = result.totalReturnPct >= 0;
                  const sel = def.id === selectedId;
                  return (
                    <tr
                      key={def.id}
                      onClick={() => setSelectedId(sel ? null : def.id)}
                      className={cn(
                        'border-b border-edge/60 cursor-pointer transition',
                        best ? 'bg-amber-400/[0.07] hover:bg-amber-400/[0.12]' : 'hover:bg-white/[0.03]',
                        sel && 'bg-accent/10'
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {best && <Trophy size={14} className="text-amber-300 shrink-0" />}
                          <div>
                            <div className={cn('font-bold text-sm', best ? 'text-amber-200' : 'text-white')}>{def.name}</div>
                            <div className="text-[10px] text-slate-500">{def.tag}</div>
                          </div>
                        </div>
                      </td>
                      <td className={cn('px-4 py-3 text-right font-mono font-bold tabular-nums', pos ? 'text-up' : 'text-down')}>
                        {pos ? '+' : ''}{result.totalReturnPct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-200 tabular-nums">{result.winRate.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-200 tabular-nums">{result.numRoundTrips}</td>
                      <td className="px-4 py-3 text-right font-mono text-down tabular-nums">-{result.maxDrawdownPct.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-200 tabular-nums">{fmtPF(result.profitFactor)}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber-200 tabular-nums">{fmtUSD(taxFor(result).tax)}</td>
                      <td className={cn('px-4 py-3 text-right font-mono font-bold tabular-nums', taxFor(result).netPct >= 0 ? 'text-up' : 'text-down')}>
                        {taxFor(result).netPct >= 0 ? '+' : ''}{taxFor(result).netPct.toFixed(2)}%
                      </td>
                      <td className={cn('px-4 py-3 text-right font-mono font-bold tabular-nums', best ? 'text-amber-300' : 'text-slate-400')}>
                        {score.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2.5 text-[11px] text-slate-500 border-t border-edge">
            Click a row for the full detail view. Score = return ÷ (1 + max drawdown). <span className="text-slate-300 font-semibold">Past performance ≠ future results.</span>
          </p>
        </div>
      )}

      {/* Detail view */}
      {selected && bars && (
        <div className="mb-5 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-extrabold text-white">{selected.def.name} <span className="text-xs font-normal text-slate-500">detail · {sym.label}</span></h2>
            <button
              onClick={downloadCsv}
              className="flex items-center gap-2 text-xs font-bold bg-panel2 border border-edge hover:border-accent/60 text-slate-200 rounded-xl px-4 py-2 transition"
            >
              <Download size={14} /> Download CSV
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {[
              { label: 'Return', value: `${selected.result.totalReturnPct >= 0 ? '+' : ''}${selected.result.totalReturnPct.toFixed(2)}%`, tone: selected.result.totalReturnPct >= 0 ? 'text-up' : 'text-down' },
              { label: 'Win rate', value: `${selected.result.winRate.toFixed(1)}%`, tone: 'text-white' },
              { label: 'Trades', value: String(selected.result.numRoundTrips), tone: 'text-white' },
              { label: 'Max DD', value: `-${selected.result.maxDrawdownPct.toFixed(1)}%`, tone: 'text-down' },
              { label: 'Profit factor', value: fmtPF(selected.result.profitFactor), tone: 'text-white' },
              { label: 'Final equity', value: fmtUSD(selected.result.finalEquity), tone: 'text-white' },
            ].map((c) => (
              <div key={c.label} className="bg-panel border border-edge rounded-2xl p-3.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{c.label}</div>
                <div className={cn('mt-1 text-lg font-extrabold font-mono tabular-nums', c.tone)}>{c.value}</div>
              </div>
            ))}
          </div>

          <EquityChart result={selected.result} />
          <PriceChart bars={bars} trades={selected.result.trades} />

          {/* Monthly returns */}
          <div className="bg-panel border border-edge rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-edge text-sm font-semibold text-white">Monthly returns <span className="text-[10px] text-slate-500 font-normal">demo</span></div>
            <div className="p-4 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {selected.result.monthly.map((m) => (
                <div key={m.month} className={cn('rounded-xl border px-3 py-2 text-center', m.retPct >= 0 ? 'border-up/30 bg-up/10' : 'border-down/30 bg-down/10')}>
                  <div className="text-[10px] text-slate-500 font-mono">{m.month}</div>
                  <div className={cn('text-sm font-extrabold font-mono tabular-nums', m.retPct >= 0 ? 'text-up' : 'text-down')}>
                    {m.retPct >= 0 ? '+' : ''}{m.retPct.toFixed(1)}%
                  </div>
                </div>
              ))}
              {selected.result.monthly.length === 0 && (
                <p className="text-xs text-slate-500 col-span-full">No monthly data.</p>
              )}
            </div>
          </div>

          {/* Trade log */}
          <div className="bg-panel border border-edge rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-edge text-sm font-semibold text-white">
              Trade log <span className="text-[10px] text-slate-500 font-normal">({selected.result.trades.length} fills · demo)</span>
            </div>
            <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="sticky top-0 bg-panel">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-edge">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Side</th>
                    <th className="px-4 py-3 font-semibold text-right">Price</th>
                    <th className="px-4 py-3 font-semibold text-right">Qty</th>
                    <th className="px-4 py-3 font-semibold text-right">Trade P&L</th>
                    <th className="px-4 py-3 font-semibold">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {[...selected.result.trades].reverse().map((t, i) => (
                    <tr key={i} className="border-b border-edge/60">
                      <td className="px-4 py-2.5 text-slate-400 font-mono text-xs tabular-nums">{new Date(t.t).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded', t.side === 'BUY' ? 'text-up bg-up/15' : 'text-down bg-down/15')}>{t.side}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-200 tabular-nums">{fmtPx(t.price)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-400 tabular-nums">{t.qty < 0.01 ? t.qty.toExponential(2) : t.qty.toFixed(6)}</td>
                      <td className={cn('px-4 py-2.5 text-right font-mono tabular-nums', t.pnl === null ? 'text-slate-600' : t.pnl >= 0 ? 'text-up' : 'text-down')}>
                        {t.pnl === null ? '—' : `${t.pnl >= 0 ? '+' : ''}${fmtUSD(t.pnl)}`}
                      </td>
                      <td className="px-4 py-2.5">
                        {t.label ? (
                          <span className={cn('text-[10px] font-black uppercase px-1.5 py-0.5 rounded', t.label.includes('BUY') ? 'text-up bg-up/15' : 'text-down bg-down/15')}>
                            {t.label.replace('_', ' ')}
                          </span>
                        ) : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Per-strategy parameter editors */}
      {rows.length > 0 && (
        <div className="mb-5">
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2 mb-3">
            <Settings2 size={17} className="text-accent" /> Tune parameters
          </h2>
          <div className="space-y-2.5">
            {STRATEGIES.map((def) => {
              const open = !!openParams[def.id];
              const p = params[def.id];
              return (
                <div key={def.id} className="bg-panel border border-edge rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setOpenParams((o) => ({ ...o, [def.id]: !o[def.id] }))}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition"
                  >
                    <div className="flex items-center gap-2 text-left">
                      <span className="text-sm font-bold text-white">{def.name}</span>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-panel2 text-slate-400 border border-edge">{def.tag}</span>
                    </div>
                    <ChevronDown size={16} className={cn('text-slate-500 transition-transform', open && 'rotate-180')} />
                  </button>
                  {open && (
                    <div className="px-4 pb-4 pt-1 border-t border-edge/60">
                      <p className="text-[11px] text-slate-500 mb-3">{def.desc}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {def.params.map((pd) => (
                          <div key={pd.key} className="bg-void/60 border border-edge rounded-xl px-3 py-2.5">
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-[11px] font-semibold text-slate-400">{pd.label}</label>
                              <span className="text-xs font-mono font-bold text-amber-200">{p[pd.key]}</span>
                            </div>
                            <input
                              type="range"
                              min={pd.min} max={pd.max} step={pd.step}
                              value={p[pd.key]}
                              onChange={(e) => updateParam(def.id, pd.key, parseFloat(e.target.value))}
                              className="w-full accent-amber-400"
                            />
                            <div className="flex justify-between text-[9px] text-slate-600 font-mono">
                              <span>{pd.min}</span><span>{pd.max}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2.5 text-[10px] text-slate-600">Changing a parameter re-runs that strategy instantly (demo).</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Honest footer */}
      <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-void/60 border border-edge rounded-xl px-3 py-2.5 mb-8">
        <TriangleAlert size={13} className="shrink-0 mt-0.5 text-amber-300" />
        <p>
          Educational tool only — long-only demo backtests on daily closes with simplified fills. Real markets have
          slippage, gaps and costs this demo ignores. QSR history is simulated. <span className="text-slate-300 font-semibold">Past performance ≠ future results. Not financial advice.</span>
        </p>
      </div>
    </div>
  );
}
