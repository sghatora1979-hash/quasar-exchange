import { notFound } from 'next/navigation';
import { PAIRS, pairBySymbol } from '@/lib/pairs';
import { forexByPair } from '@/lib/forex';
import { stockBySymbol } from '@/lib/stocks';
import { TradeClient } from './TradeClient';
import { AuthGate } from '@/components/AuthGate';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { pair: string } }) {
  const raw = params.pair.toUpperCase();
  const fx = forexByPair(raw);
  if (fx) return { title: `Trade ${fx.pair} — Quasar Demo` };
  const stock = stockBySymbol(raw);
  if (stock) return { title: `Trade ${stock.symbol} — Quasar Demo` };
  const symbol = raw.replace(/USD$/, '');
  const info = pairBySymbol(symbol);
  return { title: info ? `Trade ${info.symbol}/USD — Quasar Demo` : 'Trade — Quasar Demo' };
}

export default function TradePage({ params }: { params: { pair: string } }) {
  const raw = params.pair.toUpperCase();
  // Resolution order: forex (XXXUSD pairs) → stocks (bare tickers) → crypto (strip USD suffix).
  // No collisions: crypto/forex URLs always carry the USD suffix; stock tickers are bare.
  const fx = forexByPair(raw);
  if (fx)
    return (
      <AuthGate>
        <TradeClient symbol={fx.symbol} market="forex" />
      </AuthGate>
    );
  const stock = stockBySymbol(raw);
  if (stock)
    return (
      <AuthGate>
        <TradeClient symbol={stock.symbol} market="stock" />
      </AuthGate>
    );
  const symbol = raw.replace(/USD$/, '');
  const info = pairBySymbol(symbol) ?? PAIRS.find((p) => p.kraken === symbol + 'USD');
  if (!info) notFound();
  return (
    <AuthGate>
      <TradeClient symbol={info.symbol} market="crypto" />
    </AuthGate>
  );
}
