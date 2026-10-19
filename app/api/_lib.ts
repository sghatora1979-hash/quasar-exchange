// Shared Kraken proxy helpers — server-side only.

export const dynamic = 'force-dynamic';

const KRAKEN = 'https://api.kraken.com/0/public';

export type KrakenEnvelope<T> = { error: string[]; result?: T };

/** Map our Kraken alt pair (XBTUSD) to the key Kraken uses in results (XXBTZUSD). */
export function resultKey(krakenAlt: string): string {
  if (krakenAlt === 'XBTUSD') return 'XXBTZUSD';
  if (krakenAlt === 'ETHUSD') return 'XETHZUSD';
  if (krakenAlt === 'ETCUSD') return 'XETCZUSD';
  if (krakenAlt === 'XLMUSD') return 'XXLMZUSD';
  if (krakenAlt === 'ZECUSD') return 'XZECZUSD';
  if (krakenAlt === 'USDTUSD') return 'USDTZUSD';
  if (krakenAlt === 'XRPUSD') return 'XXRPZUSD';
  if (krakenAlt === 'DOGEUSD') return 'XDGUSD';
  if (krakenAlt === 'LTCUSD') return 'XLTCZUSD';
  return krakenAlt;
}

export async function krakenGet<T>(path: string, params: Record<string, string>): Promise<KrakenEnvelope<T>> {
  const url = `${KRAKEN}${path}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'QuasarDemo/1.0 (paper trading demo)' },
    // Kraken public data changes constantly; never cache at the edge.
    cache: 'no-store',
  });
  if (!res.ok) {
    return { error: [`Kraken HTTP ${res.status} — please retry in a moment.`] };
  }
  const json = (await res.json()) as KrakenEnvelope<T>;
  if (json.error && json.error.length > 0) {
    const rate = json.error.some((e) => e.toLowerCase().includes('rate limit'));
    return {
      error: [
        rate
          ? 'Kraken rate limit reached — cooling down, please retry shortly.'
          : `Kraken: ${json.error.join('; ')}`,
      ],
    };
  }
  return json;
}

export function jsonError(message: string, status = 502) {
  return Response.json({ ok: false, error: message }, { status });
}
