// Liquidity Sweep → BOS → FVG shared strategy engine (v1).
// Pure functions, zero React. Demo/educational — never real trading.
//
// The classic SMC "perfect entry" pipeline:
//   1. EQUAL HIGHS / LOWS — two confirmed swing pivots at ~the same price
//      (stops cluster beyond them).
//   2. LIQUIDITY SWEEP — a wick drives beyond the equal level, then the candle
//      CLOSES back inside (stops raided, no acceptance below/above).
//   3. BOS (break of structure) — a later candle CLOSES beyond the last
//      confirmed swing high (bullish) / low (bearish).
//   4. FVG (fair value gap) — a 3-candle imbalance inside the displacement leg:
//      bullish when candle[i].high < candle[i+2].low.
//   5. ENTRY — the first pullback that touches the FVG zone after BOS.
//
// ZERO LOOK-AHEAD: every signal decision at bar `i` uses only bars[0..i].
// findPivots() needs ±k bars to confirm a pivot, so a pivot at index p is
// only *usable* once the scan reaches bar p + pivotK. Forward exit simulation
// (TP/SL/time) is NOT look-ahead: the entry was already decided from past
// data; exits are mechanical rules applied bar-by-bar afterwards — the same
// way any backtest walks forward.
//
// Shared design: scanLsbFvg() works on full Bar[] (with real timestamps) so
// the SAME function serves the backtester (via lsbFvgStrategy adapter below)
// and future live-signal code. v1 backtests BULLISH signals long only;
// bearish/short support is v2.

import { findPivots, type Pivot } from './patterns';
import { atrSeries } from './indicators';
import type { Bar, Series, SignalOut, StrategyParams } from './backtest';

export type LsbFvgDirection = 'bullish' | 'bearish';

export interface LsbFvgConfig {
  pivotK: number; // ±k bars for swing-pivot confirmation (default 5)
  equalTolPct: number; // max % price difference for an "equal" level (default 0.1)
  atrTolMult: number; // tolerance floor = atrTolMult × ATR (default 0.25); effective tol = max(pct, atr-based)
  atrPeriod: number; // ATR period (default 14)
  lookback: number; // bars to search back for the equal-level pair (default 120)
  riskReward: number; // TP distance = riskReward × risk (default 2)
  slBufferAtr: number; // SL placed slBufferAtr × ATR beyond the sweep extreme (default 0.1)
  maxHold: number; // force-exit N bars after entry if neither SL nor TP hit (default 60)
  setupTimeout: number; // abandon a sweep→BOS→entry setup after N bars without progress (default 50)
}

export const LSB_FVG_DEFAULTS: LsbFvgConfig = {
  pivotK: 5,
  equalTolPct: 0.1,
  atrTolMult: 0.25,
  atrPeriod: 14,
  lookback: 120,
  riskReward: 2,
  slBufferAtr: 0.1,
  maxHold: 60,
  setupTimeout: 50,
};

export type LsbFvgExitReason = 'TP' | 'SL' | 'TIME';

export interface LsbFvgSignal {
  direction: LsbFvgDirection;
  setupBarIndex: number; // index of the sweep bar — unique id of this setup (duplicate suppression)
  sweepExtreme: number; // sweep low (bullish) / sweep high (bearish)
  bosBarIndex: number; // -1 until BOS confirms
  entryBarIndex: number; // -1 until entry triggers
  entryPrice: number; // close of the entry bar (documented fill assumption)
  fvgZone: [number, number] | null; // [bottom, top]
  stopLoss: number;
  target: number;
  exitBarIndex: number; // -1 until exit
  exitPrice: number;
  exitReason: LsbFvgExitReason | null;
}

type ScanState =
  | { phase: 'FLAT' }
  | {
      phase: 'AWAIT_BOS';
      direction: LsbFvgDirection;
      sweepIdx: number;
      sweepExtreme: number;
      level: number; // the equal-highs/lows level that was swept
      refExtreme: number; // last confirmed swing high (bullish) / low (bearish) BEFORE the sweep
      bornAt: number; // bar index when the sweep was detected
    }
  | {
      phase: 'AWAIT_ENTRY';
      direction: LsbFvgDirection;
      sweepIdx: number;
      sweepExtreme: number;
      bosIdx: number;
      zone: [number, number]; // FVG [bottom, top]
      bornAt: number;
    }
  | {
      phase: 'IN_POSITION';
      direction: LsbFvgDirection;
      entryIdx: number;
      stopLoss: number;
      target: number;
    };

/**
 * Scan bars for Liquidity Sweep → BOS → FVG setups.
 * `directions` selects which setups to emit (default both). The v1 backtest
 * adapter passes ['bullish'] only — long-only engine, shorts are v2.
 * Returned signals are complete with entries AND mechanical exits.
 */
export function scanLsbFvg(
  bars: Bar[],
  cfg: LsbFvgConfig = LSB_FVG_DEFAULTS,
  directions: LsbFvgDirection[] = ['bullish', 'bearish'],
): LsbFvgSignal[] {
  const n = bars.length;
  const K = Math.max(2, Math.round(cfg.pivotK));
  if (n < 3 * K + 10) return [];

  const h = bars.map((b) => b.h);
  const l = bars.map((b) => b.l);
  const c = bars.map((b) => b.c);
  const atr = atrSeries(h, l, c, Math.max(2, Math.round(cfg.atrPeriod)));
  const pivots = findPivots(h, l, K);
  const lookback = Math.max(20, Math.round(cfg.lookback));

  const atrAt = (i: number): number => {
    const v = atr[Math.min(Math.max(i, 0), n - 1)];
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : NaN;
  };
  // Effective "equal" tolerance at bar i around a reference price.
  const tolAt = (i: number, refPrice: number): number => {
    const pct = (Math.max(0, cfg.equalTolPct) / 100) * refPrice;
    const a = atrAt(i);
    const atrBased = Number.isNaN(a) ? 0 : Math.max(0, cfg.atrTolMult) * a;
    return Math.max(pct, atrBased, 1e-9);
  };

  // Confirmed pivots as of bar `cur` (pivot at p usable once cur >= p + K),
  // restricted to the lookback window, most-recent-first.
  const confirmed = (cur: number, type: 'H' | 'L'): Pivot[] => {
    const out: Pivot[] = [];
    for (let k = pivots.length - 1; k >= 0; k--) {
      const p = pivots[k];
      if (p.i > cur - K) continue; // not yet confirmed — would be look-ahead
      if (p.i < cur - lookback) break; // pivots are time-ordered; older ones are further
      if (p.type === type) out.push(p);
    }
    return out;
  };

  const signals: LsbFvgSignal[] = [];
  // Independent state machine per direction: a bearish setup waiting on BOS
  // must never block a bullish sweep (and vice versa). Within one direction,
  // at most one setup/position is active at a time.
  const states: Record<LsbFvgDirection, ScanState> = { bullish: { phase: 'FLAT' }, bearish: { phase: 'FLAT' } };
  const activeDirs = (['bullish', 'bearish'] as LsbFvgDirection[]).filter((d) => directions.includes(d));

  const newSignalBase = (direction: LsbFvgDirection, sweepIdx: number, sweepExtreme: number): LsbFvgSignal => ({
    direction,
    setupBarIndex: sweepIdx,
    sweepExtreme,
    bosBarIndex: -1,
    entryBarIndex: -1,
    entryPrice: NaN,
    fvgZone: null,
    stopLoss: NaN,
    target: NaN,
    exitBarIndex: -1,
    exitPrice: NaN,
    exitReason: null,
  });

  // One step of a single direction's state machine at bar `cur`.
  const step = (direction: LsbFvgDirection, cur: number): void => {
    const state = states[direction];

    // ---- FLAT: look for a fresh liquidity sweep completing AT this bar ----
    if (state.phase === 'FLAT') {
      if (direction === 'bullish') {
        const lows = confirmed(cur, 'L');
        // Most recent low b, paired with the nearest earlier low a that is
        // "equal" within tolerance (skips noise pivots between the levels).
        const b = lows[0];
        const a = b ? lows.slice(1).find((p) => Math.abs(p.price - b.price) <= tolAt(cur, b.price)) : undefined;
        if (b && a) {
          if (b.i < cur) {
            const level = Math.min(a.price, b.price);
            if (l[cur] < level && c[cur] > level) {
              // Wick below the equal lows, close back above = bullish sweep.
              // Reference: most recent confirmed swing high strictly before this bar.
              const refHighs = confirmed(cur, 'H');
              const ref = refHighs.length ? refHighs[0] : null;
              if (ref) {
                states[direction] = {
                  phase: 'AWAIT_BOS', direction: 'bullish',
                  sweepIdx: cur, sweepExtreme: l[cur], level,
                  refExtreme: ref.price, bornAt: cur,
                };
              }
            }
          }
        }
      } else {
        const highsP = confirmed(cur, 'H');
        const b = highsP[0];
        const a = b ? highsP.slice(1).find((p) => Math.abs(p.price - b.price) <= tolAt(cur, b.price)) : undefined;
        if (b && a) {
          if (b.i < cur) {
            const level = Math.max(a.price, b.price);
            if (h[cur] > level && c[cur] < level) {
              // Wick above the equal highs, close back below = bearish sweep.
              const refLows = confirmed(cur, 'L');
              const ref = refLows.length ? refLows[0] : null;
              if (ref) {
                states[direction] = {
                  phase: 'AWAIT_BOS', direction: 'bearish',
                  sweepIdx: cur, sweepExtreme: h[cur], level,
                  refExtreme: ref.price, bornAt: cur,
                };
              }
            }
          }
        }
      }
      return;
    }

    // ---- AWAIT_BOS: wait for close beyond the reference extreme ----
    if (state.phase === 'AWAIT_BOS') {
      const timedOut = cur - state.bornAt > Math.max(5, Math.round(cfg.setupTimeout));
      const invalidated =
        state.direction === 'bullish' ? c[cur] < state.level : c[cur] > state.level;
      if (timedOut || invalidated) { states[direction] = { phase: 'FLAT' }; return; }

      const bos = state.direction === 'bullish' ? c[cur] > state.refExtreme : c[cur] < state.refExtreme;
      if (!bos) return;

      // Find the most recent FVG inside the displacement leg [sweepIdx, cur].
      let zone: [number, number] | null = null;
      for (let i = cur - 2; i >= state.sweepIdx; i--) {
        if (state.direction === 'bullish') {
          if (h[i] < l[i + 2]) { zone = [h[i], l[i + 2]]; break; }
        } else {
          if (l[i] > h[i + 2]) { zone = [h[i + 2], l[i]]; break; }
        }
      }
      if (!zone) { states[direction] = { phase: 'FLAT' }; return; } // no imbalance → no setup
      states[direction] = {
        phase: 'AWAIT_ENTRY', direction: state.direction,
        sweepIdx: state.sweepIdx, sweepExtreme: state.sweepExtreme,
        bosIdx: cur, zone, bornAt: cur,
      };
      return;
    }

    // ---- AWAIT_ENTRY: first pullback touch of the FVG zone ----
    if (state.phase === 'AWAIT_ENTRY') {
      const timedOut = cur - state.bornAt > Math.max(5, Math.round(cfg.setupTimeout));
      const dead =
        state.direction === 'bullish' ? c[cur] < state.sweepExtreme : c[cur] > state.sweepExtreme;
      if (timedOut || dead) { states[direction] = { phase: 'FLAT' }; return; }

      const [zBot, zTop] = state.zone;
      const touched = state.direction === 'bullish' ? l[cur] <= zTop : h[cur] >= zBot;
      if (!touched) return;

      const a = atrAt(cur);
      const buf = Number.isNaN(a) ? 0 : Math.max(0, cfg.slBufferAtr) * a;
      const entryPrice = c[cur];
      const stopLoss = state.direction === 'bullish' ? state.sweepExtreme - buf : state.sweepExtreme + buf;
      const risk = state.direction === 'bullish' ? entryPrice - stopLoss : stopLoss - entryPrice;
      if (!(risk > 0)) { states[direction] = { phase: 'FLAT' }; return; }
      const target = state.direction === 'bullish'
        ? entryPrice + Math.max(0.5, cfg.riskReward) * risk
        : entryPrice - Math.max(0.5, cfg.riskReward) * risk;

      const sig = newSignalBase(state.direction, state.sweepIdx, state.sweepExtreme);
      sig.bosBarIndex = state.bosIdx;
      sig.entryBarIndex = cur;
      sig.entryPrice = entryPrice;
      sig.fvgZone = state.zone;
      sig.stopLoss = stopLoss;
      sig.target = target;
      signals.push(sig);
      states[direction] = {
        phase: 'IN_POSITION', direction: state.direction,
        entryIdx: cur, stopLoss, target,
      };
      return;
    }

    // ---- IN_POSITION: mechanical exits. Same-bar SL+TP touch → SL first (conservative). ----
    if (state.phase === 'IN_POSITION') {
      const sig = signals[signals.length - 1];
      // Safety: the last signal must belong to this direction's position.
      if (!sig || sig.direction !== direction || sig.entryBarIndex !== state.entryIdx) {
        states[direction] = { phase: 'FLAT' };
        return;
      }
      const hitSL = state.direction === 'bullish' ? l[cur] <= state.stopLoss : h[cur] >= state.stopLoss;
      const hitTP = state.direction === 'bullish' ? h[cur] >= state.target : l[cur] <= state.target;
      const heldTooLong = cur - state.entryIdx >= Math.max(1, Math.round(cfg.maxHold));
      if (hitSL || hitTP || heldTooLong) {
        sig.exitBarIndex = cur;
        if (hitSL) { sig.exitPrice = state.stopLoss; sig.exitReason = 'SL'; }
        else if (hitTP) { sig.exitPrice = state.target; sig.exitReason = 'TP'; }
        else { sig.exitPrice = c[cur]; sig.exitReason = 'TIME'; }
        states[direction] = { phase: 'FLAT' };
      }
      return;
    }
  };

  for (let cur = 0; cur < n; cur++) {
    for (const d of activeDirs) step(d, cur);
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Backtest adapter — StrategyDef-compatible fn.
// v1: BULLISH signals only (long-only runBacktest). Bearish/short = v2.
// Exits ride on SignalOut.fills so TP/SL fill at their exact prices instead
// of the bar close; entries fill at the entry-bar close (documented).
// ---------------------------------------------------------------------------

function numParam(p: StrategyParams, key: string, dflt: number): number {
  const v = p[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : dflt;
}

export function lsbFvgConfigFromParams(p: StrategyParams): LsbFvgConfig {
  return {
    pivotK: Math.max(2, Math.round(numParam(p, 'pivotK', LSB_FVG_DEFAULTS.pivotK))),
    equalTolPct: Math.max(0, numParam(p, 'equalTolPct', LSB_FVG_DEFAULTS.equalTolPct)),
    atrTolMult: Math.max(0, numParam(p, 'atrTolMult', LSB_FVG_DEFAULTS.atrTolMult)),
    atrPeriod: Math.max(2, Math.round(numParam(p, 'atrPeriod', LSB_FVG_DEFAULTS.atrPeriod))),
    lookback: Math.max(20, Math.round(numParam(p, 'lookback', LSB_FVG_DEFAULTS.lookback))),
    riskReward: Math.max(0.5, numParam(p, 'riskReward', LSB_FVG_DEFAULTS.riskReward)),
    slBufferAtr: Math.max(0, numParam(p, 'slBufferAtr', LSB_FVG_DEFAULTS.slBufferAtr)),
    maxHold: Math.max(1, Math.round(numParam(p, 'maxHold', LSB_FVG_DEFAULTS.maxHold))),
    setupTimeout: Math.max(5, Math.round(numParam(p, 'setupTimeout', LSB_FVG_DEFAULTS.setupTimeout))),
  };
}

export function lsbFvgStrategy(s: Series, p: StrategyParams): SignalOut {
  const cfg = lsbFvgConfigFromParams(p);
  const n = s.c.length;
  // The engine's native input is full Bar[]; detection uses h/l/c only,
  // so synthetic t/o are harmless here (real timestamps come from the
  // backtest's own bar array, which drives trade dates).
  const bars: Bar[] = s.c.map((c, i) => ({
    t: i,
    o: i > 0 ? s.c[i - 1] : c,
    h: s.h[i],
    l: s.l[i],
    c,
  }));
  // v1: long-only — bullish signals become long positions.
  // Bearish signals are detected by the engine but NOT traded here; short
  // support (target = -1) is explicitly v2 work.
  const signals = scanLsbFvg(bars, cfg, ['bullish']);

  const target = new Array<number>(n).fill(0);
  const fills: (number | null)[] = new Array(n).fill(null);
  const labels: (string | null)[] = new Array(n).fill(null);

  for (const sg of signals) {
    const e = sg.entryBarIndex;
    const x = sg.exitBarIndex;
    if (e < 0 || e >= n || !(sg.entryPrice > 0)) continue;
    const end = x >= 0 ? Math.min(x, n - 1) : n - 1; // open at data end → runBacktest closes it
    if (end <= e) continue;
    fills[e] = sg.entryPrice;
    labels[e] = 'BUY';
    for (let i = e; i < end; i++) target[i] = 1;
    // target[end] stays 0 → the shared runBacktest() sells at bar `end`.
    if (sg.exitPrice > 0) fills[end] = sg.exitPrice;
    labels[end] = sg.exitReason === 'TP' ? 'SELL_TP' : sg.exitReason === 'SL' ? 'SELL_SL' : 'SELL';
  }
  return { target, labels, fills };
}
