export const dynamic = 'force-dynamic';

import { krakenGet, jsonError } from '../_lib';

type AssetPair = {
  altname: string;
  wsname?: string;
  aclass_base: string;
  base: string;
  aclass_quote: string;
  quote: string;
};

// GET /api/assetpairs — simplified list of USD spot pairs
export async function GET() {
  const env = await krakenGet<Record<string, AssetPair>>('/AssetPairs', {});
  if (env.error.length || !env.result) return jsonError(env.error[0] ?? 'Asset pairs unavailable');
  const list = Object.values(env.result)
    .filter((p) => p.quote === 'ZUSD' && !p.altname.includes('.'))
    .map((p) => ({ altname: p.altname, base: p.base, quote: p.quote }))
    .sort((a, b) => a.altname.localeCompare(b.altname));
  return Response.json({ ok: true, count: list.length, data: list });
}
