// Shared technical-indicator math for Quasar demo features (AI bot, signals panel, algo lab).
// Pure functions, no React. All prices are demo/indicative data.

export type Ohlc = { t: number; o: number; h: number; l: number; c: number };

export const sma = (arr: number[], n: number, i: number): number => {
  if (i < n - 1) return NaN;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += arr[k];
  return s / n;
};

export const emaSeries = (arr: number[], n: number): number[] => {
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

/** Wilder's RSI. */
export const rsiSeries = (closes: number[], n = 14): number[] => {
  const out: number[] = new Array(closes.length).fill(NaN);
  let gain = 0, loss = 0;
  for (let i = 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    const g = Math.max(0, ch), l = Math.max(0, -ch);
    if (i <= n) {
      gain += g; loss += l;
      if (i === n) { gain /= n; loss /= n; out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss); }
    } else {
      gain = (gain * (n - 1) + g) / n;
      loss = (loss * (n - 1) + l) / n;
      out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    }
  }
  return out;
};

/** Wilder's ATR. */
export const atrSeries = (h: number[], l: number[], c: number[], n = 14): number[] => {
  const out: number[] = new Array(c.length).fill(NaN);
  let atr = NaN;
  for (let i = 1; i < c.length; i++) {
    const tr = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
    if (i <= n) {
      atr = Number.isNaN(atr) ? tr : atr + tr;
      if (i === n) { atr /= n; out[i] = atr; }
    } else {
      atr = (atr * (n - 1) + tr) / n;
      out[i] = atr;
    }
  }
  return out;
};

export type SupertrendPoint = { line: number; dir: 1 | -1 | 0 };

/**
 * Supertrend (Olivier Seban). dir: 1 = uptrend (line below price), -1 = downtrend.
 * Standard algorithm with final upper/lower bands carried forward.
 */
export const supertrendSeries = (
  h: number[], l: number[], c: number[], period = 10, multiplier = 3
): SupertrendPoint[] => {
  const n = c.length;
  const out: SupertrendPoint[] = new Array(n).fill(null).map(() => ({ line: NaN, dir: 0 as const }));
  const atr = atrSeries(h, l, c, period);
  let fUp = NaN, fLow = NaN, dir: 1 | -1 | 0 = 0;
  for (let i = 1; i < n; i++) {
    if (Number.isNaN(atr[i])) continue;
    const hl2 = (h[i] + l[i]) / 2;
    const bUp = hl2 + multiplier * atr[i];
    const bLow = hl2 - multiplier * atr[i];
    if (Number.isNaN(fUp)) {
      fUp = bUp; fLow = bLow;
      dir = c[i] > hl2 ? 1 : -1;
      out[i] = { line: dir === 1 ? fLow : fUp, dir };
      continue;
    }
    fUp = bUp < fUp || c[i - 1] > fUp ? bUp : fUp;
    fLow = bLow > fLow || c[i - 1] < fLow ? bLow : fLow;
    if (dir === -1) {
      if (c[i] > fUp) { dir = 1; out[i] = { line: fLow, dir }; }
      else out[i] = { line: fUp, dir };
    } else if (dir === 1) {
      if (c[i] < fLow) { dir = -1; out[i] = { line: fUp, dir }; }
      else out[i] = { line: fLow, dir };
    } else {
      dir = c[i] > hl2 ? 1 : -1;
      out[i] = { line: dir === 1 ? fLow : fUp, dir };
    }
  }
  return out;
};

/** Wilder's ADX(14) — trend strength 0..100. */
export const adxSeries = (h: number[], l: number[], c: number[], n = 14): number[] => {
  const len = c.length;
  const out: number[] = new Array(len).fill(NaN);
  let sTR = 0, sPDM = 0, sMDM = 0, adx = NaN, dxCount = 0, dxSum = 0;
  for (let i = 1; i < len; i++) {
    const up = h[i] - h[i - 1], dn = l[i - 1] - l[i];
    const pDM = up > dn && up > 0 ? up : 0;
    const mDM = dn > up && dn > 0 ? dn : 0;
    const tr = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
    if (i <= n) {
      sTR += tr; sPDM += pDM; sMDM += mDM;
      if (i < n) continue;
    } else {
      sTR = sTR - sTR / n + tr;
      sPDM = sPDM - sPDM / n + pDM;
      sMDM = sMDM - sMDM / n + mDM;
    }
    const pDI = sTR === 0 ? 0 : (100 * sPDM) / sTR;
    const mDI = sTR === 0 ? 0 : (100 * sMDM) / sTR;
    const dx = pDI + mDI === 0 ? 0 : (100 * Math.abs(pDI - mDI)) / (pDI + mDI);
    dxCount++; dxSum += dx;
    if (dxCount < n) continue;
    adx = dxCount === n ? dxSum / n : (adx * (n - 1) + dx) / n;
    out[i] = adx;
  }
  return out;
};

export type QuasarTrendPoint = {
  line: number;          // Supertrend line value
  dir: 1 | -1 | 0;       // filtered trend direction
  ema200: number;
  label: 'BUY' | 'SELL' | 'STRONG_BUY' | 'STRONG_SELL' | null;
};

/**
 * "Quasar Trend" — Quasar's own trend-following indicator.
 * Supertrend(10, 3) combined with an EMA-200 trend filter:
 *  - Uptrend only when Supertrend is up AND price is above EMA-200
 *  - Downtrend only when Supertrend is down AND price is below EMA-200
 *  - Otherwise the previous trend state holds (avoids flip-flop)
 * Labels: BUY on flip to up, SELL on flip to down;
 * STRONG_BUY / STRONG_SELL when the flip candle's range exceeds 2× ATR(14).
 */
export const quasarTrendSeries = (h: number[], l: number[], c: number[]): QuasarTrendPoint[] => {
  const n = c.length;
  const out: QuasarTrendPoint[] = new Array(n).fill(null).map(() => ({ line: NaN, dir: 0 as const, ema200: NaN, label: null }));
  const st = supertrendSeries(h, l, c, 10, 3);
  const e200 = emaSeries(c, 200);
  const atr = atrSeries(h, l, c, 14);
  let dir: 1 | -1 | 0 = 0;
  for (let i = 0; i < n; i++) {
    const s = st[i];
    if (s.dir === 0 || Number.isNaN(e200[i])) { out[i] = { line: s.line, dir, ema200: e200[i], label: null }; continue; }
    let want: 1 | -1 | 0 = dir;
    if (s.dir === 1 && c[i] > e200[i]) want = 1;
    else if (s.dir === -1 && c[i] < e200[i]) want = -1;
    // else: hold previous (filter blocks the flip)
    let label: QuasarTrendPoint['label'] = null;
    if (want !== dir && want !== 0) {
      const strong = !Number.isNaN(atr[i]) && atr[i] > 0 && (h[i] - l[i]) > 2 * atr[i];
      label = want === 1 ? (strong ? 'STRONG_BUY' : 'BUY') : (strong ? 'STRONG_SELL' : 'SELL');
      dir = want;
    }
    out[i] = { line: s.line, dir, ema200: e200[i], label };
  }
  return out;
};

export type MarketVerdict = {
  verdict: 'bullish' | 'bearish' | 'neutral';
  supertrend: number;      // line value (NaN if unavailable)
  supertrendDir: 1 | -1 | 0;
  rsi: number;
  sma20: number; sma50: number;
  adx: number;
  trending: boolean;       // ADX >= 20
  notes: string[];
  quasarTrend: 'up' | 'down' | 'none';
  quasarLine: number;
  ema200: number;
};

/** Combine Supertrend + RSI + SMA trend + ADX into one honest summary. */
export function analyzeBars(bars: Ohlc[]): MarketVerdict | null {
  const c = bars.map((b) => b.c).filter((x) => x > 0);
  if (c.length < 60) return null;
  const h = bars.map((b) => (b.h > 0 ? b.h : b.c));
  const l = bars.map((b) => (b.l > 0 ? b.l : b.c));
  const i = c.length - 1;
  const st = supertrendSeries(h, l, c, 10, 3);
  const rsi = rsiSeries(c, 14);
  const adx = adxSeries(h, l, c, 14);
  const s20 = sma(c, 20, i), s50 = sma(c, 50, i);
  const last = st[i];
  const r = rsi[i], ax = adx[i];
  const trending = !Number.isNaN(ax) && ax >= 20;
  const notes: string[] = [];
  let score = 0;
  if (last.dir === 1) { score += 2; notes.push('Supertrend is in UPTREND (line below price) — trend-followers see strength.'); }
  else if (last.dir === -1) { score -= 2; notes.push('Supertrend is in DOWNTREND (line above price) — trend-followers see weakness.'); }
  else notes.push('Supertrend has no clear direction on recent data.');
  if (!Number.isNaN(s20) && !Number.isNaN(s50)) {
    if (s20 > s50) { score += 1; notes.push('Price is above its medium-term average (SMA20 > SMA50) — medium-term trend up.'); }
    else if (s20 < s50) { score -= 1; notes.push('Price is below its medium-term average (SMA20 < SMA50) — medium-term trend down.'); }
  }
  if (!Number.isNaN(r)) {
    if (r < 30) { score += 1; notes.push(`RSI(14) is ${r.toFixed(1)} — oversold zone; bounces happen, but oversold can stay oversold.`); }
    else if (r > 70) { score -= 1; notes.push(`RSI(14) is ${r.toFixed(1)} — overbought zone; pullbacks happen, but strong trends stay overbought.`); }
    else notes.push(`RSI(14) is ${r.toFixed(1)} — neutral momentum.`);
  }
  if (!Number.isNaN(ax)) {
    notes.push(trending
      ? `ADX(14) is ${ax.toFixed(1)} — market is TRENDING, trend-following tools (Supertrend, SMA cross) fit best.`
      : `ADX(14) is ${ax.toFixed(1)} — market looks SIDEWAYS/choppy; trend tools whipsaw here, range tools (RSI, Bollinger) fit best.`);
  }
  const qt = quasarTrendSeries(h, l, c);
  const qLast = qt[i];
  let quasarTrend: 'up' | 'down' | 'none' = 'none';
  if (qLast.dir === 1) { quasarTrend = 'up'; notes.push('Quasar Trend: 🟢 UPTREND — Supertrend(10,3) is up and price holds above EMA-200.'); }
  else if (qLast.dir === -1) { quasarTrend = 'down'; notes.push('Quasar Trend: 🔴 DOWNTREND — Supertrend(10,3) is down and price holds below EMA-200.'); }
  else notes.push('Quasar Trend: ⚪ no confirmed trend (filter waiting for Supertrend + EMA-200 agreement).');
  const verdict = score >= 2 ? 'bullish' : score <= -2 ? 'bearish' : 'neutral';
  return {
    verdict,
    supertrend: last.line, supertrendDir: last.dir,
    rsi: r, sma20: s20, sma50: s50, adx: ax, trending, notes,
    quasarTrend, quasarLine: qLast.line, ema200: qLast.ema200,
  };
}
