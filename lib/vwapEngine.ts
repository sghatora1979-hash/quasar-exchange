// VWAP Momentum strategy engine (v1).
// Pure functions, zero React. Demo/educational — never real trading.
//
// Implements the classic "Simple VWAP System" (Entry / Stop Loss / Exit):
//   ENTRY:    the close crosses ABOVE cumulative VWAP, confirmed by a
//             bullish engulfing candle.
//   STOPLOSS: the recent swing low (lowest low of the last `swingN` bars,
//             minus a small ATR buffer).
//   EXIT:     the close crosses back BELOW cumulative VWAP.
//   FILTER:   no entries when the market is chopping sideways — counted as
//             too many VWAP whipsaw crosses inside the lookback window
//             ("avoid VWAP in sideways market").
//
// VWAP needs VOLUME: vwap[i] = Σ(typical×volume) / Σ(volume), cumulative
// ("anchored" variant — the honest choice for the tester's daily demo bars;
// the classic intraday session reset is the same formula anchored to the
// session open). Bars with no volume contribute nothing. If the whole series
// has zero volume, NO signals are produced — a volume-less "VWAP" would be a
// lie, so the engine refuses to fake one.
//
// ZERO LOOK-AHEAD: every decision at bar `i` uses bars[0..i] only.
// v1 backtests BULLISH entries long only; short support is v2 work (the
// reel itself is a bullish-momentum system).

import { atrSeries } from './indicators';
import type { Bar, Series, SignalOut, StrategyParams } from './backtest';

export interface VwapConfig {
  swingN: number; // swing-low lookback for the stop-loss (default 5)
  atrPeriod: number; // ATR period (default 14)
  slBufferAtr: number; // SL buffer below the swing low, × ATR (default 0.1)
  chopN: number; // whipsaw-count window, bars (default 20)
  chopMax: number; // max VWAP crosses allowed inside chopN bars (default 4)
}

export const VWAP_DEFAULTS: VwapConfig = {
  swingN: 5,
  atrPeriod: 14,
  slBufferAtr: 0.1,
  chopN: 20,
  chopMax: 4,
};

export type VwapExitReason = 'VWAP' | 'SL';

export interface VwapSignal {
  entryBarIndex: number; // index of the entry bar — unique id (duplicate suppression)
  entryPrice: number; // close of the entry bar (documented fill assumption)
  stopLoss: number;
  swingLow: number;
  exitBarIndex: number; // -1 until exit
  exitPrice: number;
  exitReason: VwapExitReason | null;
}

const numParam = (p: StrategyParams, key: string, dflt: number): number => {
  const v = p[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : dflt;
};

export function vwapConfigFromParams(p: StrategyParams): VwapConfig {
  return {
    swingN: Math.max(2, Math.round(numParam(p, 'swingN', VWAP_DEFAULTS.swingN))),
    atrPeriod: Math.max(2, Math.round(numParam(p, 'atrPeriod', VWAP_DEFAULTS.atrPeriod))),
    slBufferAtr: Math.max(0, numParam(p, 'slBufferAtr', VWAP_DEFAULTS.slBufferAtr)),
    chopN: Math.max(5, Math.round(numParam(p, 'chopN', VWAP_DEFAULTS.chopN))),
    chopMax: Math.max(1, Math.round(numParam(p, 'chopMax', VWAP_DEFAULTS.chopMax))),
  };
}

/** Cumulative VWAP series. NaN until the first bar with positive cumulative volume. */
export function vwapSeries(
  h: number[],
  l: number[],
  c: number[],
  v: (number | undefined)[],
): number[] {
  const n = c.length;
  const out = new Array<number>(n).fill(NaN);
  let pv = 0;
  let vol = 0;
  for (let i = 0; i < n; i++) {
    const typical = (h[i] + l[i] + c[i]) / 3;
    const vi = typeof v[i] === 'number' && (v[i] as number) > 0 ? (v[i] as number) : 0;
    if (vi > 0 && Number.isFinite(typical)) {
      pv += typical * vi;
      vol += vi;
    }
    out[i] = vol > 0 ? pv / vol : NaN;
  }
  return out;
}

/** True when bar i is a bullish engulfing of bar i-1 (needs real opens). */
function bullishEngulfing(o: number[], c: number[], i: number): boolean {
  if (i < 1) return false;
  const po = o[i - 1], pc = c[i - 1], co = o[i], cc = c[i];
  if (![po, pc, co, cc].every((x) => Number.isFinite(x))) return false;
  return cc > co && co < pc && cc > po;
}

type ScanState =
  | { phase: 'FLAT' }
  | {
      phase: 'LONG';
      signal: VwapSignal;
    };

/**
 * Scan full Bar[] for VWAP-momentum long setups.
 * `bars` need o (engulfing confirmation) and v (VWAP). Missing opens are
 * synthesized from previous closes — with them the engulfing check can never
 * fire, so the engine simply produces no entries (documented safe default).
 * Missing volume everywhere also yields zero signals (no fake VWAP).
 */
export function scanVwap(bars: Bar[], cfg: VwapConfig): VwapSignal[] {
  const n = bars.length;
  const signals: VwapSignal[] = [];
  if (n < 2) return signals;

  const o = bars.map((b) => b.o);
  const h = bars.map((b) => b.h);
  const l = bars.map((b) => b.l);
  const c = bars.map((b) => b.c);
  const v = bars.map((b) => b.v);
  const vw = vwapSeries(h, l, c, v);
  const atr = atrSeries(h, l, c, cfg.atrPeriod);

  // Whipsaw crosses: close crossing VWAP in either direction, bar i.
  const crossed = new Array<boolean>(n).fill(false);
  for (let i = 1; i < n; i++) {
    if (!Number.isFinite(vw[i]) || !Number.isFinite(vw[i - 1])) continue;
    const abovePrev = c[i - 1] > vw[i - 1];
    const aboveNow = c[i] > vw[i];
    crossed[i] = abovePrev !== aboveNow;
  }

  let state: ScanState = { phase: 'FLAT' };

  for (let i = 1; i < n; i++) {
    if (state.phase === 'FLAT') {
      if (!Number.isFinite(vw[i]) || !Number.isFinite(vw[i - 1])) continue;
      const crossUp = c[i - 1] <= vw[i - 1] && c[i] > vw[i];
      if (!crossUp) continue;
      if (!bullishEngulfing(o, c, i)) continue;
      // Sideways filter: too many recent whipsaws → skip ("avoid VWAP in
      // sideways market").
      let whips = 0;
      for (let k = Math.max(1, i - cfg.chopN + 1); k <= i; k++) if (crossed[k]) whips++;
      if (whips > cfg.chopMax) continue;

      let swingLow = Infinity;
      for (let k = Math.max(0, i - cfg.swingN + 1); k <= i; k++) {
        if (l[k] < swingLow) swingLow = l[k];
      }
      const a = atr[i];
      const stopLoss = Number.isFinite(a) && a > 0 ? swingLow - cfg.slBufferAtr * a : swingLow;
      const signal: VwapSignal = {
        entryBarIndex: i,
        entryPrice: c[i],
        stopLoss,
        swingLow,
        exitBarIndex: -1,
        exitPrice: NaN,
        exitReason: null,
      };
      signals.push(signal);
      state = { phase: 'LONG', signal };
    } else {
      const sg = state.signal;
      // Stop-loss first (wick through the level exits at the SL price).
      if (l[i] <= sg.stopLoss) {
        sg.exitBarIndex = i;
        sg.exitPrice = sg.stopLoss;
        sg.exitReason = 'SL';
        state = { phase: 'FLAT' };
        continue;
      }
      // Exit on close back below VWAP.
      if (Number.isFinite(vw[i]) && c[i] < vw[i]) {
        sg.exitBarIndex = i;
        sg.exitPrice = c[i];
        sg.exitReason = 'VWAP';
        state = { phase: 'FLAT' };
      }
    }
  }
  return signals;
}

/** Backtest adapter: (Series, params) → SignalOut for the shared runBacktest(). */
export function vwapStrategy(s: Series, p: StrategyParams): SignalOut {
  const cfg = vwapConfigFromParams(p);
  const n = s.c.length;
  const target = new Array<number>(n).fill(0);
  const fills: (number | null)[] = new Array(n).fill(null);
  const labels: (string | null)[] = new Array(n).fill(null);
  const line: number[] = new Array(n).fill(NaN);

  // The engine's native input is full Bar[]. Opens come from the series when
  // present (the tester supplies real Yahoo opens); without them the
  // engulfing check cannot fire and no entries are produced — documented.
  const bars: Bar[] = s.c.map((c, i) => ({
    t: i,
    o: s.o && Number.isFinite(s.o[i]) ? (s.o as number[])[i] : i > 0 ? s.c[i - 1] : c,
    h: s.h[i],
    l: s.l[i],
    c,
    v: s.v ? s.v[i] : undefined,
  }));

  const vw = vwapSeries(
    s.h,
    s.l,
    s.c,
    s.v ?? [],
  );
  for (let i = 0; i < n; i++) line[i] = vw[i];

  const signals = scanVwap(bars, cfg);
  for (const sg of signals) {
    const e = sg.entryBarIndex;
    const x = sg.exitBarIndex;
    if (e < 0 || e >= n || !(sg.entryPrice > 0)) continue;
    const end = x >= 0 ? Math.min(x, n - 1) : n - 1; // open at data end → runBacktest closes it
    if (end <= e) continue;
    fills[e] = sg.entryPrice;
    labels[e] = 'BUY_VWAP';
    for (let i = e; i < end; i++) target[i] = 1;
    // target[end] stays 0 → the shared runBacktest() sells at bar `end`.
    if (sg.exitPrice > 0) fills[end] = sg.exitPrice;
    labels[end] = sg.exitReason === 'SL' ? 'SELL_SL' : 'SELL_VWAP';
  }
  return { target, labels, fills, line };
}
