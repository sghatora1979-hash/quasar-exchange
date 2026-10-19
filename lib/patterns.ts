// Classic chart-pattern detection (simplified, educational).
// Diamond tops/bottoms + harmonic XABCD (Gartley/Bat/Butterfly/Crab).
// Approximate by design — real patterns need precise Fibonacci confluence.
// Demo/educational only.

export type Pivot = { i: number; price: number; type: 'H' | 'L' };

/** Swing pivots: local high/low over ±k bars. */
export function findPivots(h: number[], l: number[], k = 5): Pivot[] {
  const out: Pivot[] = [];
  for (let i = k; i < h.length - k; i++) {
    let isH = true, isL = true;
    for (let j = i - k; j <= i + k; j++) {
      if (j === i) continue;
      if (h[j] > h[i]) isH = false;
      if (l[j] < l[i]) isL = false;
    }
    if (isH) out.push({ i, price: h[i], type: 'H' });
    else if (isL) out.push({ i, price: l[i], type: 'L' });
  }
  // Keep strictly alternating (drop the weaker of consecutive same-type pivots)
  const alt: Pivot[] = [];
  for (const p of out) {
    const last = alt[alt.length - 1];
    if (last && last.type === p.type) {
      if (p.type === 'H' && p.price > last.price) alt[alt.length - 1] = p;
      else if (p.type === 'L' && p.price < last.price) alt[alt.length - 1] = p;
    } else alt.push(p);
  }
  return alt;
}

// ---------- Diamond ----------

export type DiamondResult = {
  found: boolean;
  bias: 'bearish' | 'bullish' | 'neutral';
  pivots: Pivot[];
  note: string;
};

/**
 * Simplified diamond: last 7 alternating pivots whose swing widths
 * first widen then narrow (tolerance 15%). Bias from pre-pattern trend.
 */
export function detectDiamond(
  h: number[], l: number[], c: number[]
): DiamondResult {
  const pivots = findPivots(h, l, 5);
  const empty = { found: false, bias: 'neutral' as const, pivots: [], note: 'No diamond shape in recent swings.' };
  if (pivots.length < 7) return empty;
  const seq = pivots.slice(-7);
  const widths: number[] = [];
  for (let i = 0; i < 6; i++) widths.push(Math.abs(seq[i + 1].price - seq[i].price));
  if (widths.some((w) => w <= 0)) return empty;
  const T = 0.85; // tolerance
  const widening = widths[1] > widths[0] * T && widths[2] > widths[1] * T;
  const apex = widths[2] === Math.max(...widths);
  const narrowing = widths[3] < widths[2] / T && widths[4] < widths[3] / T && widths[5] < widths[4] / T;
  if (!(widening && apex && narrowing)) return empty;
  // Bias: trend before the pattern
  const start = seq[0].i;
  const lookback = c.slice(Math.max(0, start - 50), start);
  const avg = lookback.reduce((a, b) => a + b, 0) / Math.max(1, lookback.length);
  const bias = c[start] > avg ? 'bearish' : 'bullish'; // top after uptrend, bottom after downtrend
  return {
    found: true,
    bias,
    pivots: seq,
    note: bias === 'bearish'
      ? 'Possible DIAMOND TOP (bearish reversal) — volatility expanded then contracted. Watch for a break below the lower boundary with volume.'
      : 'Possible DIAMOND BOTTOM (bullish reversal) — volatility expanded then contracted. Watch for a break above the upper boundary with volume.',
  };
}

// ---------- Harmonics ----------

export type HarmonicName = 'Gartley' | 'Bat' | 'Butterfly' | 'Crab';

export type HarmonicResult = {
  found: boolean;
  name: HarmonicName | null;
  direction: 'bullish' | 'bearish' | null;
  dZone: number | null;   // price level of D
  pivots: Pivot[];        // X,A,B,C,D
  ratios: { abXa: number; bcAb: number; xdXa: number } | null;
  note: string;
};

const within = (v: number, target: number, tol = 0.08) => Math.abs(v - target) / target <= tol;
const withinRange = (v: number, lo: number, hi: number, tol = 0.08) =>
  v >= lo * (1 - tol) && v <= hi * (1 + tol);

const RULES: { name: HarmonicName; abXa: [number, number] | number; bcAb: [number, number]; xdXa: [number, number] | number }[] = [
  { name: 'Gartley', abXa: 0.618, bcAb: [0.382, 0.886], xdXa: 0.786 },
  { name: 'Bat', abXa: [0.382, 0.5], bcAb: [0.382, 0.886], xdXa: 0.886 },
  { name: 'Butterfly', abXa: 0.786, bcAb: [0.382, 0.886], xdXa: [1.27, 1.618] },
  { name: 'Crab', abXa: [0.382, 0.618], bcAb: [0.382, 0.886], xdXa: 1.618 },
];

function matchRule(abXa: number, bcAb: number, xdXa: number): HarmonicName | null {
  let best: HarmonicName | null = null;
  let bestScore = Infinity;
  for (const r of RULES) {
    const abOk = typeof r.abXa === 'number' ? within(abXa, r.abXa) : withinRange(abXa, r.abXa[0], r.abXa[1]);
    const bcOk = withinRange(bcAb, r.bcAb[0], r.bcAb[1]);
    const xdOk = typeof r.xdXa === 'number' ? within(xdXa, r.xdXa) : withinRange(xdXa, r.xdXa[0], r.xdXa[1]);
    if (abOk && bcOk && xdOk) {
      const tAb = typeof r.abXa === 'number' ? r.abXa : (r.abXa[0] + r.abXa[1]) / 2;
      const tXd = typeof r.xdXa === 'number' ? r.xdXa : (r.xdXa[0] + r.xdXa[1]) / 2;
      const score = Math.abs(abXa - tAb) / tAb + Math.abs(xdXa - tXd) / tXd;
      if (score < bestScore) { bestScore = score; best = r.name; }
    }
  }
  return best;
}

/** Scan recent 5-pivot windows for XABCD harmonic shapes. */
export function detectHarmonic(h: number[], l: number[], c: number[]): HarmonicResult {
  const pivots = findPivots(h, l, 5);
  const empty: HarmonicResult = { found: false, name: null, direction: null, dZone: null, pivots: [], ratios: null, note: 'No harmonic XABCD shape in recent swings.' };
  if (pivots.length < 5) return empty;
  // Check the most recent windows (up to 6), prefer the freshest match
  for (let w = pivots.length - 5; w >= Math.max(0, pivots.length - 10); w--) {
    const [X, A, B, C, D] = pivots.slice(w, w + 5);
    const bullish = X.type === 'L' && A.type === 'H' && B.type === 'L' && C.type === 'H' && D.type === 'L';
    const bearish = X.type === 'H' && A.type === 'L' && B.type === 'H' && C.type === 'L' && D.type === 'H';
    if (!bullish && !bearish) continue;
    const XA = Math.abs(A.price - X.price);
    if (XA <= 0) continue;
    const abXa = Math.abs(A.price - B.price) / XA;
    const bcAb = Math.abs(C.price - B.price) / Math.max(1e-9, Math.abs(A.price - B.price));
    const xdXa = Math.abs(D.price - X.price) / XA;
    const name = matchRule(abXa, bcAb, xdXa);
    if (!name) continue;
    const direction = bullish ? 'bullish' : 'bearish';
    const fresh = D.i >= h.length - 12; // D formed very recently
    return {
      found: true,
      name,
      direction,
      dZone: D.price,
      pivots: [X, A, B, C, D],
      ratios: { abXa, bcAb, xdXa },
      note: `Possible ${direction === 'bullish' ? 'BULLISH' : 'BEARISH'} ${name.toUpperCase()} ${fresh ? 'completing' : 'completed'} — D zone near ${D.price.toFixed(2)}. ` +
        (direction === 'bullish'
          ? 'Bullish harmonics complete at D: watch for reversal up; invalidation below D.'
          : 'Bearish harmonics complete at D: watch for reversal down; invalidation above D.'),
    };
  }
  return empty;
}
