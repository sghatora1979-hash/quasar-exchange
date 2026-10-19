// Shared parameterized backtest engine for Quasar demo (Algo Lab + Strategy Tester).
// Pure functions, no React. All data is demo/indicative — never real trading.
// Indicator math is REUSED from ./indicators (no duplication).

import {
  sma,
  emaSeries,
  rsiSeries,
  atrSeries,
  supertrendSeries,
} from './indicators';
import { TOTAL_FEE_RATE } from './quasar';
import { lsbFvgStrategy, LSB_FVG_DEFAULTS } from './lsbFvgEngine';
import { vwapStrategy, VWAP_DEFAULTS } from './vwapEngine';
import { diamondStrategy, DIAMOND_DEFAULTS } from './diamondPatternEngine';

export type Bar = { t: number; o: number; h: number; l: number; c: number; v?: number };

export type Trade = {
  t: number; // ms
  side: 'BUY' | 'SELL';
  price: number;
  qty: number;
  pnl: number | null; // round-trip P&L on SELL, null on BUY
  ind?: number | null; // indicator line value at the bar (supertrend/quasar-trend)
  label?: string | null; // BUY / SELL / STRONG_BUY / STRONG_SELL
};

export type BacktestResult = {
  trades: Trade[];
  finalEquity: number;
  totalReturnPct: number;
  winRate: number;
  maxDrawdownPct: number;
  numRoundTrips: number;
  profitFactor: number; // gross profit / gross loss (0 if no winning trades)
  equityCurve: { t: number; equity: number; peak: number; ddPct: number }[];
  monthly: { month: string; retPct: number }[];
};

export type Series = {
  c: number[];
  h: number[];
  l: number[];
  /** Optional opens (for candle-pattern confirmation, e.g. VWAP engulfing). */
  o?: number[];
  /** Optional per-bar volume (for VWAP). Absent/zero everywhere = no VWAP signals. */
  v?: (number | undefined)[];
};
export type SignalOut = {
  target: number[];
  line?: number[];
  labels?: (string | null)[];
  /** Optional per-bar fill-price override (used by the Sweep→BOS→FVG strategy
   *  so TP/SL exits fill at their exact prices instead of the bar close).
   *  Absent/null entries fall back to the bar close — existing strategies are
   *  unaffected. */
  fills?: (number | null)[];
};
export type StrategyParams = Record<string, number>;
export type ParamDef = { key: string; label: string; min: number; max: number; step: number };

export type StrategyDef = {
  id: string;
  name: string;
  tag: string;
  desc: string;
  defaults: StrategyParams;
  params: ParamDef[];
  fn: (s: Series, p: StrategyParams) => SignalOut;
};

const hold = (out: number[], i: number, v: number) => {
  out[i] = v;
};

function param(p: StrategyParams, key: string, dflt: number): number {
  const v = p[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : dflt;
}

const stddev = (arr: number[], n: number, i: number): number => {
  const m = sma(arr, n, i);
  if (Number.isNaN(m)) return NaN;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += (arr[k] - m) ** 2;
  return Math.sqrt(s / n);
};

// ---------------------------------------------------------------------------
// The 9 strategies (parameterized). Each returns target position per bar:
// 1 = long, 0 = flat. Long-only demo backtests.
// ---------------------------------------------------------------------------

const smaCross = (s: Series, p: StrategyParams): SignalOut => {
  const fast = Math.max(2, Math.round(param(p, 'fast', 20)));
  const slow = Math.max(3, Math.round(param(p, 'slow', 50)));
  const { c } = s;
  const out = new Array(c.length).fill(0);
  for (let i = 0; i < c.length; i++) {
    const f = sma(c, fast, i), sl = sma(c, slow, i);
    if (Number.isNaN(f) || Number.isNaN(sl)) { hold(out, i, i > 0 ? out[i - 1] : 0); continue; }
    hold(out, i, f > sl ? 1 : f < sl ? 0 : (i > 0 ? out[i - 1] : 0));
  }
  return { target: out };
};

const rsiMean = (s: Series, p: StrategyParams): SignalOut => {
  const period = Math.max(2, Math.round(param(p, 'period', 14)));
  const os = param(p, 'oversold', 30);
  const ob = param(p, 'overbought', 70);
  const { c } = s;
  const r = rsiSeries(c, period);
  const out = new Array(c.length).fill(0);
  for (let i = 0; i < c.length; i++) {
    if (Number.isNaN(r[i])) { hold(out, i, i > 0 ? out[i - 1] : 0); continue; }
    hold(out, i, r[i] < os ? 1 : r[i] > ob ? 0 : (i > 0 ? out[i - 1] : 0));
  }
  return { target: out };
};

const breakout = (s: Series, p: StrategyParams): SignalOut => {
  const n = Math.max(5, Math.round(param(p, 'lookback', 20)));
  const { h, l, c } = s;
  const out = new Array(c.length).fill(0);
  for (let i = 0; i < c.length; i++) {
    if (i < n) { hold(out, i, i > 0 ? out[i - 1] : 0); continue; }
    let hi = -Infinity, lo = Infinity;
    for (let k = i - n; k < i; k++) { hi = Math.max(hi, h[k]); lo = Math.min(lo, l[k]); }
    hold(out, i, c[i] > hi ? 1 : c[i] < lo ? 0 : out[i - 1]);
  }
  return { target: out };
};

const macdSignal = (s: Series, p: StrategyParams): SignalOut => {
  const fast = Math.max(2, Math.round(param(p, 'fast', 12)));
  const slow = Math.max(3, Math.round(param(p, 'slow', 26)));
  const sigN = Math.max(2, Math.round(param(p, 'signal', 9)));
  const { c } = s;
  const eF = emaSeries(c, fast), eS = emaSeries(c, slow);
  const macd = c.map((_, i) => (Number.isNaN(eF[i]) || Number.isNaN(eS[i]) ? NaN : eF[i] - eS[i]));
  const sig = emaSeries(macd.map((v) => (Number.isNaN(v) ? 0 : v)), sigN);
  const out = new Array(c.length).fill(0);
  for (let i = 1; i < c.length; i++) {
    if (Number.isNaN(macd[i]) || Number.isNaN(macd[i - 1])) { hold(out, i, out[i - 1]); continue; }
    const up = macd[i - 1] <= sig[i - 1] && macd[i] > sig[i];
    const dn = macd[i - 1] >= sig[i - 1] && macd[i] < sig[i];
    hold(out, i, up ? 1 : dn ? 0 : out[i - 1]);
  }
  return { target: out };
};

const bollingerBounce = (s: Series, p: StrategyParams): SignalOut => {
  const period = Math.max(5, Math.round(param(p, 'period', 20)));
  const mult = Math.max(0.5, param(p, 'mult', 2));
  const { c } = s;
  const out = new Array(c.length).fill(0);
  for (let i = 0; i < c.length; i++) {
    const m = sma(c, period, i), sd = stddev(c, period, i);
    if (Number.isNaN(m) || Number.isNaN(sd) || sd === 0) { hold(out, i, i > 0 ? out[i - 1] : 0); continue; }
    hold(out, i, c[i] <= m - mult * sd ? 1 : c[i] >= m + mult * sd ? 0 : (i > 0 ? out[i - 1] : 0));
  }
  return { target: out };
};

const supertrendStrat = (s: Series, p: StrategyParams): SignalOut => {
  const period = Math.max(2, Math.round(param(p, 'atrPeriod', 10)));
  const mult = Math.max(0.5, param(p, 'multiplier', 3));
  const { h, l, c } = s;
  const st = supertrendSeries(h, l, c, period, mult);
  const out = new Array(c.length).fill(0);
  const line: number[] = new Array(c.length).fill(NaN);
  for (let i = 0; i < c.length; i++) {
    line[i] = st[i].line;
    hold(out, i, st[i].dir === 1 ? 1 : st[i].dir === -1 ? 0 : (i > 0 ? out[i - 1] : 0));
  }
  return { target: out, line };
};

// Quasar Trend = Supertrend(atrPeriod, multiplier) + EMA-200 filter, with
// BUY/SELL/STRONG labels. Reuses supertrendSeries / emaSeries / atrSeries.
const quasarTrendStrat = (s: Series, p: StrategyParams): SignalOut => {
  const period = Math.max(2, Math.round(param(p, 'atrPeriod', 10)));
  const mult = Math.max(0.5, param(p, 'multiplier', 3));
  const { h, l, c } = s;
  const st = supertrendSeries(h, l, c, period, mult);
  const e200 = emaSeries(c, 200);
  const atr = atrSeries(h, l, c, 14);
  const out = new Array(c.length).fill(0);
  const line: number[] = new Array(c.length).fill(NaN);
  const labels: (string | null)[] = new Array(c.length).fill(null);
  let dir: 1 | -1 | 0 = 0;
  for (let i = 0; i < c.length; i++) {
    line[i] = st[i].line;
    const sv = st[i];
    if (sv.dir !== 0 && !Number.isNaN(e200[i])) {
      let want: 1 | -1 | 0 = dir;
      if (sv.dir === 1 && c[i] > e200[i]) want = 1;
      else if (sv.dir === -1 && c[i] < e200[i]) want = -1;
      if (want !== dir && want !== 0) {
        const strong = !Number.isNaN(atr[i]) && atr[i] > 0 && h[i] - l[i] > 2 * atr[i];
        labels[i] = want === 1 ? (strong ? 'STRONG_BUY' : 'BUY') : (strong ? 'STRONG_SELL' : 'SELL');
        dir = want;
      }
    }
    hold(out, i, dir === 1 ? 1 : dir === -1 ? 0 : (i > 0 ? out[i - 1] : 0));
  }
  return { target: out, line, labels };
};

export const STRATEGIES: StrategyDef[] = [
  {
    id: 'sma', name: 'SMA Crossover', tag: 'Trend',
    desc: 'Long when the fast average crosses above the slow average; flat on cross below.',
    defaults: { fast: 20, slow: 50 },
    params: [
      { key: 'fast', label: 'Fast SMA', min: 2, max: 100, step: 1 },
      { key: 'slow', label: 'Slow SMA', min: 3, max: 200, step: 1 },
    ],
    fn: smaCross,
  },
  {
    id: 'rsi', name: 'RSI Mean Reversion', tag: 'Reversal',
    desc: 'Buys when RSI drops under the oversold level, exits above the overbought level.',
    defaults: { period: 14, oversold: 30, overbought: 70 },
    params: [
      { key: 'period', label: 'RSI period', min: 2, max: 50, step: 1 },
      { key: 'oversold', label: 'Oversold level', min: 5, max: 45, step: 1 },
      { key: 'overbought', label: 'Overbought level', min: 55, max: 95, step: 1 },
    ],
    fn: rsiMean,
  },
  {
    id: 'breakout', name: 'Breakout', tag: 'Momentum',
    desc: 'Buys a new N-day high, exits on a new N-day low. Rides trends, suffers in chop.',
    defaults: { lookback: 20 },
    params: [{ key: 'lookback', label: 'Lookback (days)', min: 5, max: 100, step: 1 }],
    fn: breakout,
  },
  {
    id: 'macd', name: 'MACD Signal', tag: 'Trend',
    desc: 'Long when MACD crosses above its signal line (MT5 "MACD Sample" logic); flat on cross below.',
    defaults: { fast: 12, slow: 26, signal: 9 },
    params: [
      { key: 'fast', label: 'Fast EMA', min: 2, max: 50, step: 1 },
      { key: 'slow', label: 'Slow EMA', min: 3, max: 100, step: 1 },
      { key: 'signal', label: 'Signal EMA', min: 2, max: 30, step: 1 },
    ],
    fn: macdSignal,
  },
  {
    id: 'bb', name: 'Bollinger Bounce', tag: 'Reversal',
    desc: 'Buys touches of the lower band, exits at the upper band. Fails in strong trends.',
    defaults: { period: 20, mult: 2 },
    params: [
      { key: 'period', label: 'Period', min: 5, max: 60, step: 1 },
      { key: 'mult', label: 'Std-dev multiplier', min: 0.5, max: 4, step: 0.1 },
    ],
    fn: bollingerBounce,
  },
  {
    id: 'supertrend', name: 'Supertrend', tag: 'Trend',
    desc: 'ATR-based trend line: long when price crosses above the line, flat on cross below.',
    defaults: { atrPeriod: 10, multiplier: 3 },
    params: [
      { key: 'atrPeriod', label: 'ATR period', min: 2, max: 30, step: 1 },
      { key: 'multiplier', label: 'Multiplier', min: 0.5, max: 10, step: 0.1 },
    ],
    fn: supertrendStrat,
  },
  {
    id: 'quasartrend', name: 'Quasar Trend ⭐', tag: 'Trend',
    desc: "Quasar's own indicator: Supertrend + EMA-200 filter. BUY/SELL labels on flips, STRONG on high-momentum flips (>2× ATR).",
    defaults: { atrPeriod: 10, multiplier: 3 },
    params: [
      { key: 'atrPeriod', label: 'ATR period', min: 2, max: 30, step: 1 },
      { key: 'multiplier', label: 'Multiplier', min: 0.5, max: 10, step: 0.1 },
    ],
    fn: quasarTrendStrat,
  },
  {
    // v1: BULLISH signals only → long positions. The engine detects bearish
    // setups too; short support (target = -1) in runBacktest() landed with
    // the Bear Diamond strategy — a bearish engine may now emit -1.
    id: 'lsbfvg', name: 'Sweep → BOS → FVG', tag: 'SMC',
    desc: 'Smart-money entry: liquidity sweep of equal highs/lows → break of structure → pullback into the fair-value gap. Exits at TP (configurable R:R), SL beyond the sweep extreme, or time stop. Zero look-ahead: signals use closed candles only.',
    defaults: { ...LSB_FVG_DEFAULTS },
    params: [
      { key: 'pivotK', label: 'Pivot confirmation (±bars)', min: 2, max: 10, step: 1 },
      { key: 'equalTolPct', label: 'Equal-level tolerance (%)', min: 0.05, max: 1, step: 0.05 },
      { key: 'atrTolMult', label: 'Tolerance floor (× ATR)', min: 0, max: 1, step: 0.05 },
      { key: 'atrPeriod', label: 'ATR period', min: 7, max: 21, step: 1 },
      { key: 'lookback', label: 'Equal-level lookback (bars)', min: 50, max: 300, step: 10 },
      { key: 'riskReward', label: 'Risk : reward', min: 1, max: 4, step: 0.5 },
      { key: 'slBufferAtr', label: 'SL buffer beyond sweep (× ATR)', min: 0, max: 0.5, step: 0.05 },
      { key: 'maxHold', label: 'Max hold (bars)', min: 10, max: 200, step: 5 },
      { key: 'setupTimeout', label: 'Setup timeout (bars)', min: 10, max: 200, step: 5 },
    ],
    fn: lsbFvgStrategy,
  },
  {
    // v1: BULLISH signals only → long positions. Short support (target = -1)
    // in runBacktest() landed with the Bear Diamond strategy — a bearish
    // engine may now emit -1. Needs real volume — with none, produces no
    // trades (a volume-less "VWAP" would be dishonest).
    id: 'vwap', name: 'VWAP Momentum', tag: 'Momentum',
    desc: 'Simple VWAP System: enter when the close crosses above cumulative VWAP confirmed by a bullish engulfing candle, stop-loss at the swing low, exit on close back below VWAP. Skips entries in sideways chop (too many VWAP whipsaws). Zero look-ahead: closed candles only.',
    defaults: { ...VWAP_DEFAULTS },
    params: [
      { key: 'swingN', label: 'Swing-low lookback (bars)', min: 2, max: 20, step: 1 },
      { key: 'atrPeriod', label: 'ATR period', min: 2, max: 30, step: 1 },
      { key: 'slBufferAtr', label: 'SL buffer below swing (× ATR)', min: 0, max: 0.5, step: 0.05 },
      { key: 'chopN', label: 'Chop window (bars)', min: 5, max: 60, step: 5 },
      { key: 'chopMax', label: 'Max whipsaws in window', min: 1, max: 10, step: 1 },
    ],
    fn: vwapStrategy,
  },
  {
    // v1: BEARISH signals only → short positions (target = -1). The first
    // bearish strategy in the tester — runBacktest() handles the short side
    // (all-in, no leverage, per-side fee). Long-only strategies are
    // unaffected: none of them emit -1.
    id: 'beardiamond', name: 'Bear Diamond', tag: 'Reversal',
    desc: 'Bearish diamond-top reversal: broadening swings (higher highs + lower lows) then a contracting triangle (lower highs + higher lows). SHORT on the breakdown below the rising lower trendline, stop-loss above the pattern high, target = 100% of the pattern height. Breakdown volume confirms the move when volume data exists. Zero look-ahead: confirmed pivots + closed candles only.',
    defaults: { ...DIAMOND_DEFAULTS },
    params: [
      { key: 'pivotK', label: 'Pivot confirmation (±bars)', min: 2, max: 10, step: 1 },
      { key: 'minBars', label: 'Min pattern width (bars)', min: 5, max: 60, step: 5 },
      { key: 'maxBars', label: 'Max pattern width (bars)', min: 20, max: 200, step: 10 },
      { key: 'minHeightAtr', label: 'Min pattern height (× ATR)', min: 0.25, max: 5, step: 0.25 },
      { key: 'slBufferAtr', label: 'SL buffer above high (× ATR)', min: 0, max: 1, step: 0.1 },
      { key: 'targetMult', label: 'Target projection (× height)', min: 0.25, max: 2, step: 0.25 },
      { key: 'volMult', label: 'Breakdown volume (× avg)', min: 1, max: 3, step: 0.25 },
      { key: 'maxHold', label: 'Max hold (bars)', min: 5, max: 200, step: 5 },
    ],
    fn: diamondStrategy,
  },
];

// ---------------------------------------------------------------------------
// Backtest engine — long/short, all-in, per-side fee.
// target = 1 → long, -1 → short, 0 → flat. Shorts are the exact mirror of
// longs: borrow + sell at the open (proceeds + collateral stay in cash),
// buy back at the close. No leverage, no margin interest (demo).
// ---------------------------------------------------------------------------

export function runBacktest(
  bars: Bar[],
  sig: SignalOut,
  capital: number,
  feeRate: number = TOTAL_FEE_RATE,
  slippage: number = 0, // v1: fill-price slippage as a fraction (e.g. 0.0005 = 5 bps).
  // Default 0 = disabled, so every existing strategy's results are unchanged.
  // Applied against the fill price: BUY fills worse (× (1 + slippage)),
  // SELL fills worse (× (1 − slippage)).
): BacktestResult {
  const target = sig.target;
  let cash = capital, qty = 0, entryCost = 0;
  const trades: Trade[] = [];
  const equityCurve: BacktestResult['equityCurve'] = [];
  let peak = capital, maxDD = 0;

  // Fill price for bar i: explicit override from the strategy (e.g. TP/SL
  // levels) when present, else the bar close. Slippage degrades the fill.
  const fillPx = (i: number, closePx: number, side: 'BUY' | 'SELL'): number => {
    const f = sig.fills?.[i];
    const base = typeof f === 'number' && f > 0 ? f : closePx;
    const slip = slippage > 0 ? base * slippage : 0;
    return side === 'BUY' ? base + slip : base - slip;
  };

  for (let i = 0; i < bars.length; i++) {
    const px = bars[i].c;
    if (!(px > 0)) continue;
    const want = target[i] ?? 0;
    const ind = sig.line?.[i] ?? null;
    const label = sig.labels?.[i] ?? null;
    if (qty === 0 && cash > 0) {
      if (want === 1) {
        const buyPx = fillPx(i, px, 'BUY');
        const fee = cash * feeRate;
        qty = (cash - fee) / buyPx;
        entryCost = cash; // total cost basis incl. entry fee
        cash = 0;
        trades.push({ t: bars[i].t * 1000, side: 'BUY', price: buyPx, qty, pnl: null, ind, label });
      } else if (want === -1) {
        // SHORT open: borrow + sell. Proceeds join the collateral in cash;
        // equity = cash + qty*px with qty negative.
        const sellPx = fillPx(i, px, 'SELL');
        const fee = cash * feeRate;
        const notional = cash - fee;
        qty = -notional / sellPx;
        entryCost = cash;
        cash = cash - fee + notional;
        trades.push({ t: bars[i].t * 1000, side: 'SELL', price: sellPx, qty, pnl: null, ind, label });
      }
    } else if (want === 0 && qty !== 0) {
      if (qty > 0) {
        const sellPx = fillPx(i, px, 'SELL');
        const gross = qty * sellPx;
        const fee = gross * feeRate;
        cash = gross - fee;
        const pnl = cash - entryCost;
        trades.push({ t: bars[i].t * 1000, side: 'SELL', price: sellPx, qty, pnl, ind, label });
        qty = 0;
      } else {
        // BUY to cover a short.
        const buyPx = fillPx(i, px, 'BUY');
        const cost = -qty * buyPx;
        const fee = cost * feeRate;
        cash = cash - cost - fee;
        const pnl = cash - entryCost;
        trades.push({ t: bars[i].t * 1000, side: 'BUY', price: buyPx, qty, pnl, ind, label });
        qty = 0;
      }
    }
    const equity = cash + qty * px;
    peak = Math.max(peak, equity);
    const ddPct = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    maxDD = Math.max(maxDD, ddPct);
    equityCurve.push({ t: bars[i].t * 1000, equity, peak, ddPct });
  }

  // Close any open position at the last price.
  if (qty > 0) {
    const last = bars.length - 1;
    const px = fillPx(last, bars[last].c, 'SELL');
    const gross = qty * px;
    cash = gross - gross * feeRate;
    const pnl = cash - entryCost;
    trades.push({
      t: bars[last].t * 1000, side: 'SELL', price: px, qty, pnl,
      ind: sig.line?.[last] ?? null, label: null,
    });
    const n = equityCurve.length - 1;
    if (n >= 0) {
      peak = Math.max(peak, cash);
      equityCurve[n] = { t: equityCurve[n].t, equity: cash, peak, ddPct: ((peak - cash) / peak) * 100 };
      maxDD = Math.max(maxDD, equityCurve[n].ddPct);
    }
  } else if (qty < 0) {
    // Cover an open short at the last price.
    const last = bars.length - 1;
    const px = fillPx(last, bars[last].c, 'BUY');
    const cost = -qty * px;
    cash = cash - cost - cost * feeRate;
    const pnl = cash - entryCost;
    trades.push({
      t: bars[last].t * 1000, side: 'BUY', price: px, qty, pnl,
      ind: sig.line?.[last] ?? null, label: null,
    });
    const n = equityCurve.length - 1;
    if (n >= 0) {
      peak = Math.max(peak, cash);
      equityCurve[n] = { t: equityCurve[n].t, equity: cash, peak, ddPct: ((peak - cash) / peak) * 100 };
      maxDD = Math.max(maxDD, equityCurve[n].ddPct);
    }
  }

  // Round trips = every trade that closed a position (SELL closes for longs,
  // BUY covers for shorts). For long-only strategies this filter is identical
  // to the old SELL-only one — their results are unchanged.
  const roundTrips = trades.filter((t) => t.pnl !== null) as (Trade & { pnl: number })[];
  const wins = roundTrips.filter((t) => t.pnl > 0);
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = roundTrips.filter((t) => t.pnl < 0).reduce((s, t) => s + Math.abs(t.pnl), 0);

  // Monthly returns from equity curve.
  const monthly: { month: string; retPct: number }[] = [];
  const byMonth = new Map<string, { first: number; last: number }>();
  for (const p of equityCurve) {
    const d = new Date(p.t);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const e = byMonth.get(key);
    if (!e) byMonth.set(key, { first: p.equity, last: p.equity });
    else e.last = p.equity;
  }
  let prevEnd = capital;
  byMonth.forEach(({ first, last }, month) => {
    const base = prevEnd > 0 ? prevEnd : first;
    monthly.push({ month, retPct: ((last - base) / base) * 100 });
    prevEnd = last;
  });

  return {
    trades,
    finalEquity: cash,
    totalReturnPct: ((cash - capital) / capital) * 100,
    winRate: roundTrips.length ? (wins.length / roundTrips.length) * 100 : 0,
    maxDrawdownPct: maxDD,
    numRoundTrips: roundTrips.length,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0,
    equityCurve,
    monthly,
  };
}

/** Composite score for ranking: return penalized by drawdown. */
export function strategyScore(r: BacktestResult): number {
  return r.totalReturnPct / (1 + r.maxDrawdownPct);
}

/** Deterministic synthetic daily bars for QSR (simulated demo price — NOT a market). */
export function synthQsrBars(days: number): Bar[] {
  // mulberry32 seeded PRNG — same bars every load.
  let seed = 0x51ab3d; // fixed seed — same demo bars every load
  const rand = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const bars: Bar[] = [];
  const now = Date.now();
  const dayMs = 86_400_000;
  let px = 0.00008;
  const startT = now - days * dayMs;
  for (let d = 0; d < days; d++) {
    const t = Math.floor(startT / 1000) + d * 86400;
    const drift = 0.0004;
    const shock = (rand() - 0.5) * 0.09; // ~4.5% daily vol
    const o = px;
    const c = Math.max(0.00001, o * (1 + drift + shock));
    const h = Math.max(o, c) * (1 + rand() * 0.02);
    const l = Math.min(o, c) * (1 - rand() * 0.02);
    bars.push({ t, o, h, l, c });
    px = c;
  }
  return bars;
}
