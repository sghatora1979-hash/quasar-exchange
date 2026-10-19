// GET /api/forex — USD-base FX reference rates via Frankfurter (ECB data).
// Free, no key. Returns daily reference rates (NOT live ticks) plus the
// day-over-day change vs the previous available day. Cached 1 hour server-side.

export const dynamic = 'force-dynamic';

type Cache = { t: number; payload: unknown };
let cache: Cache | null = null;
const TTL = 3600_000;

async function fetchDay(date: string): Promise<{ rates: Record<string, number>; date: string } | null> {
  try {
    const r = await fetch(`https://api.frankfurter.dev/v1/${date}?base=USD`, {
      next: { revalidate: 3600 },
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j?.rates) return null;
    return { rates: j.rates as Record<string, number>, date: j.date as string };
  } catch {
    return null;
  }
}

function isoDaysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  if (cache && Date.now() - cache.t < TTL) {
    return Response.json({ ok: true, cached: true, ...(cache.payload as object) });
  }
  try {
    const latest = await fetchDay('latest');
    if (!latest) return Response.json({ ok: false, error: 'Forex reference rates unavailable' }, { status: 502 });

    // Previous available day for day-over-day change (skip weekends/holidays).
    let prev: { rates: Record<string, number>; date: string } | null = null;
    for (let n = 1; n <= 6 && !prev; n++) {
      const cand = await fetchDay(isoDaysAgo(n));
      if (cand && cand.date !== latest.date) prev = cand;
    }

    const changes: Record<string, number> = {};
    if (prev) {
      for (const [code, rate] of Object.entries(latest.rates)) {
        const old = prev.rates[code];
        // Note: XXXUSD price = 1/rate, so the % move flips sign vs the raw rate.
        if (old && old > 0) changes[code] = ((rate - old) / old) * 100 * -1;
      }
    }

    const payload = {
      base: 'USD',
      date: latest.date,
      prevDate: prev?.date ?? null,
      rates: latest.rates,
      changes,
      note: 'Daily reference rates (ECB via Frankfurter) — indicative, not live ticks.',
    };
    cache = { t: Date.now(), payload };
    return Response.json({ ok: true, ...payload });
  } catch {
    return Response.json({ ok: false, error: 'Forex reference rates unavailable' }, { status: 502 });
  }
}
