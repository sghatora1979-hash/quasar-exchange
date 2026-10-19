// Bear Diamond strategy engine (v1) — bearish diamond-top reversal.
// Pure functions, zero React. Demo/educational — never real trading.
//
// THE PATTERN (the classic "Bear Diamond" / diamond top, from the reel):
//   1. BROADENING:  higher highs + lower lows  (swings expand).
//   2. CONTRACTING: lower highs + higher lows  (symmetrical triangle).
//   Together the six pivots L1,H1,L2,H2,L3,H3 draw a diamond (rhombus).
//   3. BREAKDOWN: the close drops below the rising lower trendline drawn
//      through the two higher lows (L2 → L3) → SHORT.
//   4. STOP-LOSS: above the pattern's highest high H2 (+ ATR buffer).
//   5. TARGET: 100% of the pattern height projected down from the breakdown
//      bar (configurable multiplier).
//
// Pivot math is REUSED from ./patterns (findPivots) — no duplication. A pivot
// at bar p is only "known" once cur >= p + k (same confirmation convention as
// lsbFvgEngine) — the engine never uses a pivot before its confirmation bar,
// so there is zero look-ahead: every decision at bar `cur` uses bars[0..cur]
// and pivots confirmed by `cur` only.
//
// Volume (from the reel: the breakdown bar's volume spike) is a CONFIRMATION
// filter, not a requirement: it applies only when volume data exists at the
// breakdown bar. With no volume data anywhere, the price pattern alone
// triggers — documented, never faked.
//
// v1 trades the SHORT side (target = -1). This is the first bearish strategy
// in the shared tester, so lib/backtest.ts runBacktest() learned short
// positions for it (all-in, no leverage, per-side fee — the exact mirror of a
// long). Existing long-only strategies are unaffected: none of them emit -1.

import { atrSeries, sma } from './indicators';
import { findPivots, type Pivot } from './patterns';
import type { Bar, Series, SignalOut, StrategyParams } from './backtest';

export interface DiamondConfig {
  pivotK: number; // pivot confirmation (±bars) (default 3)
  minBars: number; // min pattern width L1→H3, bars (default 15)
  maxBars: number; // max pattern width L1→H3, bars (default 80)
  minHeightAtr: number; // min pattern height H2−L2, × ATR (default 1.5)
  slBufferAtr: number; // SL buffer above the pattern high, × ATR (default 0.2)
  targetMult: number; // target projection, × pattern height (default 1.0)
  volN: number; // breakdown-volume SMA period (default 20)
  volMult: number; // breakdown volume must exceed volMult × SMA (default 1.25)
  maxHold: number; // max bars to hold the short (default 60)
}

export const DIAMOND_DEFAULTS: DiamondConfig = {
  pivotK: 3,
  minBars: 15,
  maxBars: 80,
  minHeightAtr: 1.5,
  slBufferAtr: 0.2,
  targetMult: 1.0,
  volN: 20,
  volMult: 1.25,
  maxHold: 60,
};

export type DiamondExitReason = 'TP' | 'SL' | 'TIME';

export interface DiamondSignal {
  entryBarIndex: number; // breakdown bar — unique id (duplicate suppression)
  entryPrice: number; // close of the breakdown bar (documented fill assumption)
  stopLoss: number; // pattern high + buffer
  target: number; // entry − targetMult × pattern height
  patternHigh: number; // H2
  patternLow: number; // L2
  patternHeight: number; // H2 − L2
  exitBarIndex: number; // -1 until exit
  exitPrice: number;
  exitReason: DiamondExitReason | null;
}

const numParam = (p: StrategyParams, key: string, dflt: number): number => {
  const v = p[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : dflt;
};

export function diamondConfigFromParams(p: StrategyParams): DiamondConfig {
  return {
    pivotK: Math.max(2, Math.round(numParam(p, 'pivotK', DIAMOND_DEFAULTS.pivotK))),
    minBars: Math.max(5, Math.round(numParam(p, 'minBars', DIAMOND_DEFAULTS.minBars))),
    maxBars: Math.max(20, Math.round(numParam(p, 'maxBars', DIAMOND_DEFAULTS.maxBars))),
    minHeightAtr: Math.max(0.25, numParam(p, 'minHeightAtr', DIAMOND_DEFAULTS.minHeightAtr)),
    slBufferAtr: Math.max(0, numParam(p, 'slBufferAtr', DIAMOND_DEFAULTS.slBufferAtr)),
    targetMult: Math.max(0.25, numParam(p, 'targetMult', DIAMOND_DEFAULTS.targetMult)),
    volN: Math.max(5, Math.round(numParam(p, 'volN', DIAMOND_DEFAULTS.volN))),
    volMult: Math.max(1, numParam(p, 'volMult', DIAMOND_DEFAULTS.volMult)),
    maxHold: Math.max(5, Math.round(numParam(p, 'maxHold', DIAMOND_DEFAULTS.maxHold))),
  };
}

type ScanState = { phase: 'FLAT' } | { phase: 'SHORT'; signal: DiamondSignal };

/**
 * Try to enter a short at bar `cur`: walk the confirmed pivots newest-first
 * for a top-right vertex H3 whose five predecessors form a valid bearish
 * diamond, then check breakdown / invalidation / staleness at `cur`.
 * Returns the signal on breakdown, else null (pattern stays live or dies).
 */
function findBreakdown(
  known: Pivot[],
  usedH3: Set<number>,
  cur: number,
  c: number[],
  v: number[],
  atr: number[],
  cfg: DiamondConfig,
): DiamondSignal | null {
  for (let qi = known.length - 1; qi >= 5; qi--) {
    const H3 = known[qi];
    if (cur - H3.i > cfg.maxBars) break; // time-ordered: older ones are further out
    if (H3.type !== 'H') continue;
    if (usedH3.has(H3.i)) continue;
    const L3 = known[qi - 1];
    const H2 = known[qi - 2];
    const L2 = known[qi - 3];
    const H1 = known[qi - 4];
    const L1 = known[qi - 5];
    // findPivots() guarantees strict alternation; assert anyway — a broken
    // sequence can never be a diamond.
    if (L3.type !== 'L' || H2.type !== 'H' || L2.type !== 'L' || H1.type !== 'H' || L1.type !== 'L') {
      usedH3.add(H3.i);
      continue;
    }
    // Geometry: broadening (higher high + lower low) then contracting
    // (lower high + higher low).
    if (!(H1.price < H2.price) || !(L1.price > L2.price)) {
      usedH3.add(H3.i);
      continue;
    }
    if (!(H3.price < H2.price) || !(L3.price > L2.price)) {
      usedH3.add(H3.i);
      continue;
    }
    const width = H3.i - L1.i;
    if (width < cfg.minBars || width > cfg.maxBars) {
      usedH3.add(H3.i);
      continue;
    }
    const height = H2.price - L2.price;
    const a = atr[cur];
    if (!(a > 0) || height < cfg.minHeightAtr * a) {
      usedH3.add(H3.i);
      continue;
    }
    // Lower trendline through the two rising lows, extended to bar cur.
    const run = L3.i - L2.i;
    if (run <= 0) {
      usedH3.add(H3.i);
      continue;
    }
    const trend = L2.price + ((L3.price - L2.price) * (cur - L2.i)) / run;
    const cc = c[cur];
    if (!Number.isFinite(cc)) continue;
    // Invalidated: closed back above the pattern top — the bears failed.
    if (cc > H2.price) {
      usedH3.add(H3.i);
      continue;
    }
    // Breakdown: close below the rising lower trendline.
    if (!(cc < trend)) continue; // still alive — keep waiting (and check older setups)
    // Volume confirmation — only when volume data actually exists.
    const vv = v[cur];
    const vAvg = sma(v, cfg.volN, cur);
    if (Number.isFinite(vv) && Number.isFinite(vAvg) && vAvg > 0 && vv < cfg.volMult * vAvg) {
      continue; // weak breakdown bar — wait for a stronger one
    }
    usedH3.add(H3.i);
    const stopLoss = H2.price + cfg.slBufferAtr * a;
    return {
      entryBarIndex: cur,
      entryPrice: cc,
      stopLoss,
      target: cc - cfg.targetMult * height,
      patternHigh: H2.price,
      patternLow: L2.price,
      patternHeight: height,
      exitBarIndex: -1,
      exitPrice: NaN,
      exitReason: null,
    };
  }
  return null;
}

/**
 * Scan full Bar[] for bearish-diamond short setups. One position at a time;
 * exits: stop-loss first (wick through the level covers at the SL price),
 * then target, then max-hold timeout.
 */
export function scanDiamond(bars: Bar[], cfg: DiamondConfig): DiamondSignal[] {
  const n = bars.length;
  const signals: DiamondSignal[] = [];
  if (n < 2 * cfg.pivotK + 6) return signals;

  const h = bars.map((b) => b.h);
  const l = bars.map((b) => b.l);
  const c = bars.map((b) => b.c);
  const v = bars.map((b) => (typeof b.v === 'number' ? (b.v as number) : NaN));
  const atr = atrSeries(h, l, c, 14);

  // Pivots computed once (same convention as lsbFvgEngine); each becomes
  // "known" only at its confirmation bar p + k — never earlier.
  const pivots = findPivots(h, l, cfg.pivotK);
  const known: Pivot[] = [];
  let pi = 0;
  const usedH3 = new Set<number>();
  let state: ScanState = { phase: 'FLAT' };

  for (let cur = 0; cur < n; cur++) {
    while (pi < pivots.length && pivots[pi].i + cfg.pivotK <= cur) known.push(pivots[pi++]);

    if (state.phase === 'SHORT') {
      const sg = state.signal;
      if (Number.isFinite(h[cur]) && h[cur] >= sg.stopLoss) {
        sg.exitBarIndex = cur;
        sg.exitPrice = sg.stopLoss;
        sg.exitReason = 'SL';
        state = { phase: 'FLAT' };
      } else if (Number.isFinite(l[cur]) && l[cur] <= sg.target) {
        sg.exitBarIndex = cur;
        sg.exitPrice = sg.target;
        sg.exitReason = 'TP';
        state = { phase: 'FLAT' };
      } else if (cur - sg.entryBarIndex >= cfg.maxHold) {
        sg.exitBarIndex = cur;
        sg.exitPrice = c[cur];
        sg.exitReason = 'TIME';
        state = { phase: 'FLAT' };
      }
      continue;
    }

    const sig = findBreakdown(known, usedH3, cur, c, v, atr, cfg);
    if (sig) {
      signals.push(sig);
      state = { phase: 'SHORT', signal: sig };
    }
  }
  return signals;
}

/** Backtest adapter: (Series, params) → SignalOut for the shared runBacktest().
 *  Short side: target = -1 while short, 0 flat; fills carry the exact
 *  breakdown / TP / SL prices. */
export function diamondStrategy(s: Series, p: StrategyParams): SignalOut {
  const cfg = diamondConfigFromParams(p);
  const n = s.c.length;
  const target = new Array<number>(n).fill(0);
  const fills: (number | null)[] = new Array(n).fill(null);
  const labels: (string | null)[] = new Array(n).fill(null);
  const line: number[] = new Array(n).fill(NaN);

  const bars: Bar[] = s.c.map((c, i) => ({
    t: i,
    o: s.o && Number.isFinite(s.o[i]) ? (s.o as number[])[i] : c,
    h: s.h[i],
    l: s.l[i],
    c,
    v: s.v ? s.v[i] : undefined,
  }));

  const signals = scanDiamond(bars, cfg);
  for (const sg of signals) {
    const e = sg.entryBarIndex;
    const x = sg.exitBarIndex;
    if (e < 0 || e >= n || !(sg.entryPrice > 0)) continue;
    const end = x >= 0 ? Math.min(x, n - 1) : n - 1; // open at data end → runBacktest covers it
    if (end <= e) continue;
    fills[e] = sg.entryPrice;
    labels[e] = 'SELL_DIAMOND';
    for (let i = e; i < end; i++) target[i] = -1;
    // target[end] stays 0 → the shared runBacktest() buys back at bar `end`.
    if (sg.exitPrice > 0) fills[end] = sg.exitPrice;
    labels[end] =
      sg.exitReason === 'TP'
        ? 'BUY_TP'
        : sg.exitReason === 'SL'
          ? 'BUY_SL'
          : sg.exitReason === 'TIME'
            ? 'BUY_TIME'
            : 'BUY_END';
  }
  return { target, labels, fills, line };
}
