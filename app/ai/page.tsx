'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkles, TrendingUp, TrendingDown, Zap, TriangleAlert } from 'lucide-react';

type Row = {
  symbol: string;
  name: string;
  price: number;
  changePct: number | null;
  volume24?: number;
  region?: string;
};

type Insight = {
  icon: 'up' | 'down' | 'zap' | 'warn';
  title: string;
  body: string;
  link?: string;
};

export default function AiManagerPage() {
  const [crypto, setCrypto] = useState<Row[]>([]);
  const [stocks, setStocks] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, s] = await Promise.all([
          fetch('/api/ticker', { cache: 'no-store' }).then((r) => r.json()),
          fetch('/api/stocks', { cache: 'no-store' }).then((r) => r.json()),
        ]);
        if (!alive) return;
        // /api/ticker returns { ok, data }, /api/stocks returns { ok, quotes }.
        // Guard both with Array.isArray so a shape mismatch can never
        // set state to undefined and crash the render (spread of undefined).
        if (c.ok) setCrypto(Array.isArray(c.data) ? c.data : []);
        if (s.ok) setStocks(Array.isArray(s.quotes) ? s.quotes : []);
        if (!c.ok && !s.ok) setError('Market data unavailable right now.');
      } catch {
        if (alive) setError('Could not reach market data.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const insights: Insight[] = useMemo(() => {
    const out: Insight[] = [];
    const all: Row[] = [...(crypto ?? []), ...(stocks ?? [])].filter((r) => r && r.changePct !== null);
    if (!all.length) return out;

    const sorted = [...all].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));
    const gainers = sorted.slice(0, 3);
    const losers = sorted.slice(-3).reverse();

    if (gainers[0] && (gainers[0].changePct ?? 0) > 0) {
      const g0 = gainers[0];
      out.push({
        icon: 'up',
        title: `Momentum: ${gainers.map((g) => g.symbol).join(', ')}`,
        body: `Strongest 24h movers: ${gainers
          .map((g) => `${g.symbol} +${(g.changePct ?? 0).toFixed(2)}%`)
          .join(' · ')}. Momentum can reverse fast — this is paper trading, practise position sizing.`,
        link: g0.region ? `/trade/${g0.symbol}` : `/trade/${g0.symbol}USD`,
      });
    }
    if (losers[0] && (losers[0].changePct ?? 0) < 0) {
      const l0 = losers[0];
      out.push({
        icon: 'down',
        title: `Weakness: ${losers.map((g) => g.symbol).join(', ')}`,
        body: `Weakest 24h: ${losers
          .map((g) => `${g.symbol} ${(g.changePct ?? 0).toFixed(2)}%`)
          .join(' · ')}. Falling knives bounce — or keep falling. Never bet the farm on a dip.`,
        link: l0.region ? `/trade/${l0.symbol}` : `/trade/${l0.symbol}USD`,
      });
    }

    const qsr = crypto.find((r) => r.symbol === 'QSR');
    if (qsr && qsr.changePct !== null) {
      out.push({
        icon: 'zap',
        title: `QSR is ${(qsr.changePct >= 0 ? 'up' : 'down')} ${Math.abs(qsr.changePct).toFixed(2)}%`,
        body:
          qsr.changePct >= 2
            ? 'QSR is running hot. Consider taking paper profits into strength — demo only.'
            : qsr.changePct <= -2
              ? 'QSR is cooling off. Dips are for studying charts, not for forcing trades — demo only.'
              : 'QSR is calm. Good time to study the chart and plan — demo only.',
      });
    }

    const stockGainers = stocks
      .filter((r) => r.changePct !== null)
      .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))
      .slice(0, 3);
    if (stockGainers.length) {
      out.push({
        icon: 'up',
        title: `Stocks: ${stockGainers.map((g) => g.symbol).join(', ')} leading`,
        body: `Top stock movers: ${stockGainers
          .map((g) => `${g.symbol} (${g.region}) +${(g.changePct ?? 0).toFixed(2)}%`)
          .join(' · ')}. Stock prices here are daily closes — indicative, not real-time.`,
      });
    }

    out.push({
      icon: 'warn',
      title: 'House rule: paper first',
      body: 'Every suggestion here is computed from public market data — not financial advice. Quasar is a paper-trading demo: no real money moves, ever.',
    });

    return out;
  }, [crypto, stocks]);

  const icons = {
    up: <TrendingUp size={18} className="text-emerald-400" />,
    down: <TrendingDown size={18} className="text-red-400" />,
    zap: <Zap size={18} className="text-amber-300" />,
    warn: <TriangleAlert size={18} className="text-amber-300" />,
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
        <Sparkles size={22} className="text-accent2" />
        AI Market Manager
      </h1>
      <p className="text-sm text-slate-400 mt-1">
        Rule-based insights from live market data. Suggestions only — never financial advice.
      </p>

      {loading && <p className="mt-6 text-slate-400">Reading the markets…</p>}
      {error && <p className="mt-6 text-red-400">{error}</p>}

      <div className="mt-6 space-y-3">
        {insights.map((ins, i) => (
          <div key={i} className="border border-edge rounded-2xl p-4 bg-panel/60">
            <div className="flex items-center gap-2 font-bold text-white">
              {icons[ins.icon]}
              {ins.title}
            </div>
            <p className="text-sm text-slate-300 mt-1.5">{ins.body}</p>
            {ins.link && (
              <Link href={ins.link} className="inline-block mt-2 text-sm font-bold text-accent2 hover:underline">
                Paper-trade it →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
