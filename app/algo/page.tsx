'use client';

import { useMemo, useState } from 'react';
import { Bot, FlaskConical, Play, TriangleAlert } from 'lucide-react';
import { fmtUSD } from '@/lib/quasar';
import { supertrendSeries, quasarTrendSeries } from '@/lib/indicators';
import { cn } from '@/lib/utils';

// ---------- Backtest engine (client-side, demo data only) ----------

const FEE = 0.0015; // 0.1% exchange + 0.05% broker per side (demo)

type Bar = { t: number; o: number; h: number; l: number; c: number };

type Trade = { t: number; side: 'BUY' | 'SELL'; price: number; qty: number; pnl: number | null; ind?: number | null; label?: string | null };

type BacktestResult = {
  trades: Trade[];
  finalEquity: number;
  totalReturnPct: number;
  winRate: number;
  maxDrawdownPct: number;
  numRoundTrips: number;
  equityCurve: { t: number; equity: number }[];
};

const sma = (arr: number[], n: number, i: number): number => {
  if (i < n - 1) return NaN;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += arr[k];
  return s / n;
};

const emaArr = (arr: number[], n: number): number[] => {
  const out: number[] = new Array(arr.length).fill(NaN);
  const k = 2 / (n + 1);
  let prev = NaN;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (!(v > 0)) { out[i] = prev; continue; }
    prev = Number.isNaN(prev) ? v : v * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
};

const rsiArr = (closes: number[], n = 14): number[] => {
  const out: number[] = new Array(closes.length).fill(NaN);
  let gain = 0, loss = 0;
  for (let i = 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    const g = Math.max(0, ch), l = Math.max(0, -ch);
    if (i <= n) {
      gain += g; loss += l;
      if (i === n) {
        gain /= n; loss /= n;
        out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
      }
    } else {
      gain = (gain * (n - 1) + g) / n;
      loss = (loss * (n - 1) + l) / n;
      out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    }
  }
  return out;
};

const stddev = (arr: number[], n: number, i: number): number => {
  const m = sma(arr, n, i);
  if (Number.isNaN(m)) return NaN;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += (arr[k] - m) ** 2;
  return Math.sqrt(s / n);
};

// Each strategy returns a target position per bar (1 = long, 0 = flat),
// plus optional indicator-line values and BUY/SELL/STRONG labels for display.
type Series = { c: number[]; h: number[]; l: number[] };
type SignalOut = { target: number[]; line?: number[]; labels?: (string | null)[] };
type SignalFn = (s: Series) => SignalOut;

const smaCross: SignalFn = ({ c }) => {
  const out = new Array(c.length).fill(0);
  for (let i = 0; i < c.length; i++) {
    const f = sma(c, 20, i), s = sma(c, 50, i);
    if (Number.isNaN(f) || Number.isNaN(s)) { out[i] = i > 0 ? out[i - 1] : 0; continue; }
    out[i] = f > s ? 1 : f < s ? 0 : (i > 0 ? out[i - 1] : 0);
  }
  return { target: out };
};

const rsiMean: SignalFn = ({ c }) => {
  const r = rsiArr(c, 14);
  const out = new Array(c.length).fill(0);
  for (let i = 0; i < c.length; i++) {
    if (Number.isNaN(r[i])) { out[i] = i > 0 ? out[i - 1] : 0; continue; }
    out[i] = r[i] < 30 ? 1 : r[i] > 70 ? 0 : (i > 0 ? out[i - 1] : 0);
  }
  return { target: out };
};

const breakout: SignalFn = ({ h, l, c }) => {
  const out = new Array(c.length).fill(0);
  for (let i = 0; i < c.length; i++) {
    if (i < 20) { out[i] = i > 0 ? out[i - 1] : 0; continue; }
    let hi = -Infinity, lo = Infinity;
    for (let k = i - 20; k < i; k++) { hi = Math.max(hi, h[k]); lo = Math.min(lo, l[k]); }
    out[i] = c[i] > hi ? 1 : c[i] < lo ? 0 : out[i - 1];
  }
  return { target: out };
};

// MACD Sample style (MT5 built-in EA logic): MACD(12,26) crosses signal(9).
const macdSignal: SignalFn = ({ c }) => {
  const e12 = emaArr(c, 12), e26 = emaArr(c, 26);
  const macd = c.map((_, i) => (Number.isNaN(e12[i]) || Number.isNaN(e26[i]) ? NaN : e12[i] - e26[i]));
  const valid = macd.map((v) => (Number.isNaN(v) ? 0 : v));
  const sig = emaArr(valid, 9);
  const out = new Array(c.length).fill(0);
  for (let i = 1; i < c.length; i++) {
    if (Number.isNaN(macd[i]) || Number.isNaN(macd[i - 1])) { out[i] = out[i - 1]; continue; }
    const crossedUp = macd[i - 1] <= sig[i - 1] && macd[i] > sig[i];
    const crossedDown = macd[i - 1] >= sig[i - 1] && macd[i] < sig[i];
    out[i] = crossedUp ? 1 : crossedDown ? 0 : out[i - 1];
  }
  return { target: out };
};

// Bollinger Bounce (20, 2σ): buy at lower-band touch, exit at upper-band touch.
const bollingerBounce: SignalFn = ({ c }) => {
  const out = new Array(c.length).fill(0);
  for (let i = 0; i < c.length; i++) {
    const m = sma(c, 20, i), sd = stddev(c, 20, i);
    if (Number.isNaN(m) || Number.isNaN(sd) || sd === 0) { out[i] = i > 0 ? out[i - 1] : 0; continue; }
    const lower = m - 2 * sd, upper = m + 2 * sd;
    out[i] = c[i] <= lower ? 1 : c[i] >= upper ? 0 : (i > 0 ? out[i - 1] : 0);
  }
  return { target: out };
};

// Supertrend(10, 3): long when price crosses above the line, flat on cross below.
const supertrendStrat: SignalFn = ({ h, l, c }) => {
  const st = supertrendSeries(h, l, c, 10, 3);
  const out = new Array(c.length).fill(0);
  const line: number[] = new Array(c.length).fill(NaN);
  for (let i = 0; i < c.length; i++) {
    line[i] = st[i].line;
    out[i] = st[i].dir === 1 ? 1 : st[i].dir === -1 ? 0 : (i > 0 ? out[i - 1] : 0);
  }
  return { target: out, line };
};

// Quasar Trend: Supertrend(10,3) + EMA-200 filter, with BUY/SELL/STRONG labels.
const quasarTrendStrat: SignalFn = ({ h, l, c }) => {
  const qt = quasarTrendSeries(h, l, c);
  const out = new Array(c.length).fill(0);
  const line: number[] = new Array(c.length).fill(NaN);
  const labels: (string | null)[] = new Array(c.length).fill(null);
  for (let i = 0; i < c.length; i++) {
    line[i] = qt[i].line;
    labels[i] = qt[i].label;
    out[i] = qt[i].dir === 1 ? 1 : qt[i].dir === -1 ? 0 : (i > 0 ? out[i - 1] : 0);
  }
  return { target: out, line, labels };
};

const STRATEGIES: { id: string; name: string; tag: string; desc: string; fn: SignalFn }[] = [
  {
    id: 'sma', name: 'SMA Crossover (20/50)', tag: 'Trend',
    desc: 'Classic trend-follower: goes long when the 20-day average crosses above the 50-day, exits on cross below.',
    fn: smaCross,
  },
  {
    id: 'rsi', name: 'RSI Mean Reversion (14)', tag: 'Reversal',
    desc: 'Textbook oscillator play: buys when RSI(14) drops under 30 (oversold), exits above 70 (overbought).',
    fn: rsiMean,
  },
  {
    id: 'breakout', name: '20-Day Breakout', tag: 'Momentum',
    desc: 'Donchian-style momentum: buys a 20-day high, exits on a 20-day low. Rides trends, suffers in chop.',
    fn: breakout,
  },
  {
    id: 'macd', name: 'MACD Signal (12,26,9)', tag: 'Trend',
    desc: 'Same idea as MT5\'s free "MACD Sample" EA: long when MACD crosses above its signal line, flat on cross below.',
    fn: macdSignal,
  },
  {
    id: 'bb', name: 'Bollinger Bounce (20, 2σ)', tag: 'Reversal',
    desc: 'Mean-reversion classic: buys touches of the lower band, exits at the upper band. Fails in strong trends.',
    fn: bollingerBounce,
  },
  {
    id: 'supertrend', name: 'Supertrend (10, 3)', tag: 'Trend',
    desc: 'ATR-based trend line: long when price crosses above the line, flat on cross below. Supertrend line values shown in the trade log.',
    fn: supertrendStrat,
  },
  {
    id: 'quasartrend', name: 'Quasar Trend ⭐', tag: 'Trend',
    desc: "Quasar's own indicator: Supertrend(10,3) + EMA-200 filter. BUY/SELL labels on flips, STRONG on high-momentum flips (>2× ATR). Trend systems shine in trends, whipsaw sideways.",
    fn: quasarTrendStrat,
  },
];

const SYMBOLS = [
  { label: 'DOGE/USD', yahoo: 'DOGE-USD' },
  { label: 'ETH/USD', yahoo: 'ETH-USD' },
  { label: 'RELIANCE (NSE)', yahoo: 'RELIANCE.NS' },
  { label: 'TCS (NSE)', yahoo: 'TCS.NS' },
  { label: 'INFY (NSE)', yahoo: 'INFY.NS' },
  { label: 'AAPL (NASDAQ)', yahoo: 'AAPL' },
  { label: 'MSFT (NASDAQ)', yahoo: 'MSFT' },
  { label: 'NVDA (NASDAQ)', yahoo: 'NVDA' },
  { label: 'TSLA (NASDAQ)', yahoo: 'TSLA' },
];

function runBacktest(bars: Bar[], sig: SignalOut, capital: number): BacktestResult {
  const target = sig.target;
  let cash = capital, qty = 0, entryPx = 0, entryFee = 0;
  const trades: Trade[] = [];
  const equityCurve: { t: number; equity: number }[] = [];
  let peak = capital, maxDD = 0;

  for (let i = 0; i < bars.length; i++) {
    const px = bars[i].c;
    if (!(px > 0)) continue;
    const want = target[i] ?? 0;
    const ind = sig.line?.[i] ?? null;
    const label = sig.labels?.[i] ?? null;
    if (want === 1 && qty === 0 && cash > 0) {
      const fee = cash * FEE;
      qty = (cash - fee) / px;
      entryPx = px; entryFee = fee;
      cash = 0;
      trades.push({ t: bars[i].t * 1000, side: 'BUY', price: px, qty, pnl: null, ind, label });
    } else if (want === 0 && qty > 0) {
      const gross = qty * px;
      const fee = gross * FEE;
      const pnl = gross - fee - (entryPx * qty + entryFee);
      cash = gross - fee;
      trades.push({ t: bars[i].t * 1000, side: 'SELL', price: px, qty, pnl, ind, label });
      qty = 0;
    }
    const equity = cash + qty * px;
    equityCurve.push({ t: bars[i].t * 1000, equity });
    peak = Math.max(peak, equity);
    maxDD = Math.max(maxDD, ((peak - equity) / peak) * 100);
  }
  // Close any open position at the last price.
  if (qty > 0) {
    const px = bars[bars.length - 1].c;
    const gross = qty * px;
    const fee = gross * FEE;
    const pnl = gross - fee - (entryPx * qty + entryFee);
    cash = gross - fee;
    trades.push({ t: bars[bars.length - 1].t * 1000, side: 'SELL', price: px, qty, pnl, ind: sig.line?.[bars.length - 1] ?? null, label: null });
  }
  const sells = trades.filter((t) => t.side === 'SELL' && t.pnl !== null);
  const wins = sells.filter((t) => (t.pnl ?? 0) > 0).length;
  return {
    trades,
    finalEquity: cash,
    totalReturnPct: ((cash - capital) / capital) * 100,
    winRate: sells.length ? (wins / sells.length) * 100 : 0,
    maxDrawdownPct: maxDD,
    numRoundTrips: sells.length,
    equityCurve,
  };
}

/** P&L chart (SVG) with TradingView-style BUY/SELL/STRONG markers at trade points. */
function EquityChart({ result }: { result: BacktestResult }) {
  const W = 800, H = 260, P = 34;
  const curve = result.equityCurve;
  if (curve.length < 2) return null;
  const eqs = curve.map((p) => p.equity);
  const min = Math.min(...eqs), max = Math.max(...eqs);
  const span = max - min || 1;
  const X = (i: number) => P + (i / (curve.length - 1)) * (W - 2 * P);
  const Y = (e: number) => H - P - ((e - min) / span) * (H - 2 * P);
  const pts = curve.map((p, i) => `${X(i).toFixed(1)},${Y(p.equity).toFixed(1)}`).join(' ');
  const tIndex = new Map<number, number>();
  curve.forEach((p, i) => { if (!tIndex.has(p.t)) tIndex.set(p.t, i); });
  const markers = result.trades
    .filter((t) => t.label)
    .map((t) => ({ t, i: tIndex.get(t.t) ?? -1 }))
    .filter((m) => m.i >= 0);
  const up = result.totalReturnPct >= 0;
  const labelColor = (l: string) =>
    l.includes('BUY') ? '#22c55e' : '#ef4444';
  return (
    <div className="bg-panel border border-edge rounded-2xl overflow-hidden mb-5">
      <div className="px-4 py-3 border-b border-edge text-sm font-semibold text-white flex items-center gap-2">
        P&amp;L chart
        <span className="text-[10px] text-slate-500 font-normal">markers show strategy signals (demo)</span>
      </div>
      <div className="p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Equity curve with signal markers">
          <line x1={P} y1={Y(result.equityCurve[0].equity)} x2={W - P} y2={Y(result.equityCurve[0].equity)} stroke="#475569" strokeDasharray="5 4" strokeWidth="1" />
          <polyline points={pts} fill="none" stroke={up ? '#22c55e' : '#ef4444'} strokeWidth="2" />
          {markers.map((m, k) => {
            const cx = X(m.i), cy = Y(curve[m.i].equity);
            const col = labelColor(m.t.label!);
            const strong = m.t.label!.startsWith('STRONG');
            const isBuy = m.t.label!.includes('BUY');
            const ty = isBuy ? cy + 14 : cy - 14;
            return (
              <g key={k}>
                <polygon
                  points={isBuy ? `${cx},${ty + 7} ${cx - 6},${ty - 4} ${cx + 6},${ty - 4}` : `${cx},${ty - 7} ${cx - 6},${ty + 4} ${cx + 6},${ty + 4}`}
                  fill={col}
                  opacity={strong ? 1 : 0.85}
                />
                {strong && (
                  <polygon
                    points={isBuy ? `${cx},${ty + 14} ${cx - 6},${ty + 3} ${cx + 6},${ty + 3}` : `${cx},${ty - 14} ${cx - 6},${ty - 3} ${cx + 6},${ty - 3}`}
                    fill={col}
                  />
                )}
                <text x={cx} y={isBuy ? ty + 26 : ty - 20} textAnchor="middle" fontSize="10" fontWeight="800" fill={col}>
                  {strong ? 'STRONG' : isBuy ? 'BUY' : 'SELL'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function AlgoPage() {
  const [stratId, setStratId] = useState('sma');
  const [symIdx, setSymIdx] = useState(0);
  const [capital, setCapital] = useState('10000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [barsCount, setBarsCount] = useState(0);

  const strat = STRATEGIES.find((s) => s.id === stratId)!;

  const run = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const cap = Math.max(100, parseFloat(capital) || 10000);
      const sym = SYMBOLS[symIdx];
      const r = await fetch(`/api/history?yahoo=${encodeURIComponent(sym.yahoo)}&range=2y&interval=1d`, { cache: 'no-store' });
      const j = await r.json();
      if (!j.ok || !Array.isArray(j.c)) throw new Error('No history returned');
      const n = (j.t as number[]).length;
      const bars: Bar[] = [];
      for (let i = 0; i < n; i++) {
        const c = (j.c as number[])[i];
        if (!(c > 0)) continue;
        bars.push({ t: (j.t as number[])[i], o: (j.o as number[])[i] || c, h: (j.h as number[])[i] || c, l: (j.l as number[])[i] || c, c });
      }
      if (bars.length < 60) throw new Error('Not enough history for this symbol');
      setBarsCount(bars.length);
      const sig = strat.fn({ c: bars.map((b) => b.c), h: bars.map((b) => b.h), l: bars.map((b) => b.l) });
      setResult(runBacktest(bars, sig, cap));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Backtest failed (demo).');
    } finally {
      setLoading(false);
    }
  };

  const recentTrades = useMemo(() => (result ? [...result.trades].reverse().slice(0, 40) : []), [result]);
  const pos = result ? result.totalReturnPct >= 0 : true;
  const showInd = stratId === 'supertrend' || stratId === 'quasartrend';
  const indName = stratId === 'quasartrend' ? 'Q-Trend line' : 'Supertrend';

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <Bot size={22} className="text-accent" /> Algo Lab
        </h1>
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-full px-2.5 py-1">
          Demo backtester
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-5 max-w-2xl">
        Paper-run classic trading strategies over 2 years of daily history. These are well-known{' '}
        <span className="text-slate-200 font-semibold">textbook strategies for LEARNING</span> — no strategy wins
        all the time. Test in demo, never assume past performance repeats.
      </p>

      {/* Strategy picker */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-5">
        {STRATEGIES.map((s) => (
          <button
            key={s.id}
            onClick={() => { setStratId(s.id); setResult(null); }}
            className={cn(
              'text-left rounded-2xl border p-4 transition',
              stratId === s.id
                ? 'bg-accent/10 border-accent/60'
                : 'bg-panel border-edge hover:border-slate-500'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-extrabold text-white">{s.name}</span>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-panel2 text-slate-400 border border-edge">{s.tag}</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{s.desc}</p>
          </button>
        ))}
        <div className="rounded-2xl border border-dashed border-edge p-4 flex items-center gap-2 text-slate-500">
          <FlaskConical size={16} />
          <p className="text-[11px]">More strategies coming — suggest one any time.</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-panel border border-edge rounded-2xl p-4 mb-5 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs font-semibold text-slate-400 mb-1 block">Symbol</label>
          <select
            value={symIdx}
            onChange={(e) => { setSymIdx(Number(e.target.value)); setResult(null); }}
            className="w-full bg-void border border-edge rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/60"
          >
            {SYMBOLS.map((s, i) => (
              <option key={s.yahoo} value={i}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="w-40">
          <label className="text-xs font-semibold text-slate-400 mb-1 block">Demo capital (USD)</label>
          <input
            type="number"
            min="100"
            value={capital}
            onChange={(e) => setCapital(e.target.value)}
            className="w-full bg-void border border-edge rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-accent/60"
          />
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-2 bg-accent hover:bg-accent/85 disabled:opacity-50 text-white font-bold rounded-xl px-6 py-2.5 transition"
        >
          <Play size={15} /> {loading ? 'Running…' : 'Paper-run'}
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-xs text-down bg-down/10 border border-down/30 rounded-xl px-3 py-2.5">
          <TriangleAlert size={14} /> {error}
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
            {[
              { label: 'Final equity', value: fmtUSD(result.finalEquity), tone: 'text-white' },
              { label: 'Total return', value: `${pos ? '+' : ''}${result.totalReturnPct.toFixed(2)}%`, tone: pos ? 'text-up' : 'text-down' },
              { label: 'Win rate', value: `${result.winRate.toFixed(1)}%`, tone: 'text-white' },
              { label: 'Max drawdown', value: `-${result.maxDrawdownPct.toFixed(1)}%`, tone: 'text-down' },
              { label: 'Round trips', value: String(result.numRoundTrips), tone: 'text-white' },
            ].map((c) => (
              <div key={c.label} className="bg-panel border border-edge rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{c.label}</div>
                <div className={cn('mt-1 text-xl font-extrabold font-mono tabular-nums', c.tone)}>{c.value}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mb-5">
            {barsCount} daily bars · {SYMBOLS[symIdx].label} · {strat.name} · 0.15% cost per side · long-only demo simulation. Past performance ≠ future results.
          </p>

          <EquityChart result={result} />

          <div className="bg-panel border border-edge rounded-2xl overflow-hidden mb-5">
            <div className="px-4 py-3 border-b border-edge text-sm font-semibold text-white flex items-center gap-2">
              Trade log <span className="text-[10px] text-slate-500 font-normal">(latest {recentTrades.length})</span>
            </div>
            {recentTrades.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No trades triggered — try another symbol or strategy.</p>
            ) : (
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full text-sm min-w-[680px]">
                  <thead className="sticky top-0 bg-panel">
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-edge">
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Side</th>
                      {showInd && <th className="px-4 py-3 font-semibold">Signal</th>}
                      <th className="px-4 py-3 font-semibold text-right">Price</th>
                      {showInd && <th className="px-4 py-3 font-semibold text-right">{indName}</th>}
                      <th className="px-4 py-3 font-semibold text-right">Qty</th>
                      <th className="px-4 py-3 font-semibold text-right">Trade P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrades.map((t, i) => (
                      <tr key={i} className="border-b border-edge/60">
                        <td className="px-4 py-2.5 text-slate-400 font-mono text-xs tabular-nums">
                          {new Date(t.t).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded', t.side === 'BUY' ? 'text-up bg-up/15' : 'text-down bg-down/15')}>
                            {t.side}
                          </span>
                        </td>
                        {showInd && (
                          <td className="px-4 py-2.5">
                            {t.label ? (
                              <span className={cn(
                                'text-[10px] font-black uppercase px-1.5 py-0.5 rounded',
                                t.label.includes('BUY') ? 'text-up bg-up/15' : 'text-down bg-down/15'
                              )}>
                                {t.label.replace('_', ' ')}
                              </span>
                            ) : <span className="text-slate-600 text-xs">—</span>}
                          </td>
                        )}
                        <td className="px-4 py-2.5 text-right font-mono text-slate-200 tabular-nums">{fmtUSD(t.price, 4)}</td>
                        {showInd && (
                          <td className="px-4 py-2.5 text-right font-mono text-amber-200/90 tabular-nums">
                            {t.ind != null && !Number.isNaN(t.ind) ? fmtUSD(t.ind, 4) : '—'}
                          </td>
                        )}
                        <td className="px-4 py-2.5 text-right font-mono text-slate-400 tabular-nums">{t.qty.toFixed(6)}</td>
                        <td className={cn('px-4 py-2.5 text-right font-mono tabular-nums', t.pnl === null ? 'text-slate-600' : t.pnl >= 0 ? 'text-up' : 'text-down')}>
                          {t.pnl === null ? '—' : `${t.pnl >= 0 ? '+' : ''}${fmtUSD(t.pnl)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-void/60 border border-edge rounded-xl px-3 py-2.5">
        <TriangleAlert size={13} className="shrink-0 mt-0.5 text-amber-300" />
        <p>
          Educational tool only. Backtests use daily closes with simplified fills — real markets have slippage,
          gaps and costs this demo ignores. <span className="text-slate-300 font-semibold">No strategy is shown with, or should be expected to deliver, any guaranteed win rate.</span>
        </p>
      </div>
    </div>
  );
}
