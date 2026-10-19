export const dynamic = 'force-dynamic';

// GET /api/chainstats — public blockchain network stats. No API keys.
// BTC: blockchain.info public feed. Quasar: honest design stats (the QSR
// chain is a laptop testnet — this is NOT a live explorer feed).

type BtcStats = {
  height: number | null;
  hashRatePH: number | null;
  difficulty: number | null;
  avgBlockMinutes: number | null;
  txCount24h: number | null;
  priceUSD: number | null;
};

export async function GET() {
  let btc: BtcStats | null = null;
  try {
    const r = await fetch('https://blockchain.info/stats?format=json', {
      cache: 'no-store',
      signal: AbortSignal.timeout(9000),
      headers: { 'User-Agent': 'QuasarDemo/1.0 (paper trading demo)' },
    });
    if (r.ok) {
      const j = await r.json();
      btc = {
        height: typeof j.n_blocks_total === 'number' ? j.n_blocks_total : null,
        // blockchain.info hash_rate is in GH/s -> convert to PH/s
        hashRatePH:
          typeof j.hash_rate === 'number' ? j.hash_rate / 1e6 : null,
        difficulty: typeof j.difficulty === 'number' ? j.difficulty : null,
        avgBlockMinutes:
          typeof j.minutes_between_blocks === 'number'
            ? j.minutes_between_blocks
            : null,
        txCount24h: typeof j.n_tx === 'number' ? j.n_tx : null,
        priceUSD:
          typeof j.market_price_usd === 'number' ? j.market_price_usd : null,
      };
    }
  } catch {
    btc = null;
  }

  const quasar = {
    name: 'Quasar (QSR)',
    network: 'Stage-2 testnet',
    live: false,
    note: 'Design stats — the QSR chain currently runs on the founder’s laptop. Not a public explorer feed.',
    blockTimeSec: 30,
    rewardNow: '50,000 QSR / block (Phase 1)',
    schedule: '300B @ 50k → 25k → 12.5k → stop',
    hardCap: 500_000_000_000,
    minedTotal: 398_617_500_000,
    founderAllocation: 100_000_000_000,
    vesting: '1 week linear (20,160 blocks)',
  };

  return Response.json({ ok: true, data: { btc, quasar } });
}
