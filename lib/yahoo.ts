// Shared Yahoo Finance helpers — DEMO data only. No data is ever faked:
// symbols that return nothing are skipped by callers.

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) QuasarDemo/1.0' };

export type YahooQuote = {
  price: number;
  changePct: number | null;
  volume: number;
};

/** Daily quote for a Yahoo symbol (e.g. 'RELIANCE.NS', 'GC=F'). Null when unavailable. */
export async function fetchYahooQuote(yahoo: string): Promise<YahooQuote | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?interval=1d&range=5d`,
      { headers: UA }
    );
    if (!r.ok) return null;
    const j = await r.json();
    const meta = j?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (!(price > 0)) return null;
    let changePct: number | null =
      typeof meta?.regularMarketChangePercent === 'number' ? meta.regularMarketChangePercent : null;
    if (changePct === null) {
      const prev = meta?.chartPreviousClose ?? meta?.previousClose;
      if (prev > 0) changePct = ((price - prev) / prev) * 100;
    }
    let volume = 0;
    try {
      const vols: (number | null)[] = j.chart.result[0].indicators.quote[0].volume ?? [];
      for (let i = vols.length - 1; i >= 0; i--) {
        if (vols[i] && vols[i]! > 0) {
          volume = vols[i]!;
          break;
        }
      }
    } catch {
      /* volume optional */
    }
    return { price, changePct, volume };
  } catch {
    return null;
  }
}

let fxCache: { t: number; rates: Record<string, number> } | null = null;

/** Units of `currency` per 1 USD (e.g. INR: 83.2). 1 for USD. 0 when unknown. */
export async function fxPerUsd(currency: string): Promise<number> {
  if (currency === 'USD') return 1;
  try {
    if (!fxCache || Date.now() - fxCache.t > 3600_000) {
      const r = await fetch('https://api.frankfurter.dev/v1/latest?base=USD', { headers: UA });
      fxCache = { t: Date.now(), rates: r.ok ? ((await r.json())?.rates ?? {}) : {} };
    }
    const direct = fxCache.rates[currency];
    if (direct > 0) return direct;
  } catch {
    /* fall through to Yahoo */
  }
  // Fallback via Yahoo: {CUR}USD=X = USD per 1 CUR → invert.
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(currency)}USD=X?interval=1d&range=5d`,
      { headers: UA }
    );
    if (!r.ok) return 0;
    const j = await r.json();
    const px = j?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return px > 0 ? 1 / px : 0;
  } catch {
    return 0;
  }
}

export type OHLC = { t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; v: number[] };

/** OHLC history for backtests/sparklines. Null when unavailable. */
export async function fetchYahooHistory(
  yahoo: string,
  range = '1y',
  interval = '1d'
): Promise<OHLC | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?interval=${interval}&range=${range}`,
      { headers: UA }
    );
    if (!r.ok) return null;
    const j = await r.json();
    const res = j?.chart?.result?.[0];
    if (!res) return null;
    const t: number[] = res.timestamp ?? [];
    const q = res.indicators?.quote?.[0] ?? {};
    const n = t.length;
    const pick = (k: string): number[] => {
      const arr: (number | null)[] = q[k] ?? [];
      return Array.from({ length: n }, (_, i) => (typeof arr[i] === 'number' ? arr[i]! : NaN));
    };
    const c = pick('close').filter((x) => !Number.isNaN(x));
    if (c.length < 10) return null;
    return { t, o: pick('open'), h: pick('high'), l: pick('low'), c: pick('close'), v: pick('volume') };
  } catch {
    return null;
  }
}
