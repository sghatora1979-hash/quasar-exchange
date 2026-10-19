'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, TriangleAlert, Globe2 } from 'lucide-react';
import { PAIRS, pairBySymbol, QSR_MINT_ADDRESS } from '@/lib/pairs';
import { forexBySymbol, forexPrices } from '@/lib/forex';
import { stockBySymbol, fmtStockPrice } from '@/lib/stocks';
import {
  loadState,
  paperBuy,
  paperSell,
  openPosition,
  buyOption,
  checkLiquidations,
  checkStops,
  settleOptions,
  fmtUSD,
  type PaperState,
  type TradeResult,
  type BuyOptionResult,
  type PosSide,
  type OrderType,
  type OptionKind,
} from '@/lib/quasar';
import { TradingViewChart } from '@/components/TradingViewChart';
import { SignalPanel } from '@/components/SignalPanel';
import { OrderBook, type BookRow } from '@/components/OrderBook';
import { TradePanel } from '@/components/TradePanel';
import { TVTopStories } from '@/components/TVWidgets';
import { cn } from '@/lib/utils';

type DepthResp = {
  ok: boolean;
  asks: BookRow[];
  bids: BookRow[];
  bestAsk: number;
  bestBid: number;
  mid: number;
  spread: number;
  error?: string;
};

export function TradeClient({ symbol, market }: { symbol: string; market: 'crypto' | 'forex' | 'stock' }) {
  const cryptoInfo = market === 'crypto' ? pairBySymbol(symbol) ?? PAIRS[0] : null;
  const fxInfo = market === 'forex' ? forexBySymbol(symbol) : null;
  const stockInfo = market === 'stock' ? stockBySymbol(symbol) : null;
  const name = cryptoInfo?.name ?? fxInfo?.name ?? stockInfo?.name ?? symbol;
  const decimals = cryptoInfo?.decimals ?? fxInfo?.decimals ?? stockInfo?.decimals ?? 4;
  const currency = stockInfo?.currency ?? 'USD';
  const tvSymbol =
    market === 'forex' ? fxInfo!.tv : market === 'stock' ? stockInfo!.tv : `KRAKEN:${cryptoInfo!.tv}USD`;
  // Yahoo symbol for the SignalPanel's indicator math (null = no history available).
  const signalYahoo =
    symbol === 'QSR'
      ? null
      : market === 'crypto'
        ? `${symbol}-USD`
        : market === 'stock'
          ? stockInfo!.yahoo
          : `${fxInfo!.pair}=X`;

  const [state, setState] = useState<PaperState>(() => loadState());
  const [depth, setDepth] = useState<DepthResp | null>(null);
  const [price, setPrice] = useState(0); // display price (native currency for stocks)
  const [priceUSD, setPriceUSD] = useState(0); // engine price (always USD)
  const [depthError, setDepthError] = useState('');
  const [liqNotice, setLiqNotice] = useState('');
  const priceRef = useRef(0); // engine (USD) price for order execution
  const displayRef = useRef(0);

  // Apply price update + run liquidation / stop / option-settlement checks.
  // pxUSD: engine price (USD). pxDisplay: what the user sees (native currency for stocks).
  const applyPrice = useCallback(
    (pxUSD: number, pxDisplay?: number) => {
      if (!(pxUSD > 0)) return;
      priceRef.current = pxUSD;
      displayRef.current = pxDisplay ?? pxUSD;
      setPriceUSD(pxUSD);
      setPrice(displayRef.current);
      setState((prev) => {
        if (!prev.positions.length && !(prev.options ?? []).length) return prev;
        const s: PaperState = {
          ...prev,
          positions: prev.positions.map((p) => ({ ...p })),
          options: (prev.options ?? []).map((o) => ({ ...o })),
          orders: [...prev.orders],
          snapshots: [...prev.snapshots],
        };
        const prices = { [symbol]: pxUSD };
        const { liquidated } = checkLiquidations(s, prices);
        const { closed } = checkStops(s, prices);
        const { settled } = settleOptions(s, prices);
        if (!liquidated.length && !closed.length && !settled.length) return prev;
        const bits: string[] = [];
        if (liquidated.length) bits.push(`${liquidated.length} liquidated`);
        if (closed.length)
          bits.push(
            closed
              .map((c) => `${c.pos.side} ${c.trigger === 'stopped' ? 'stop-loss' : 'take-profit'} hit @ ${fmtUSD(c.price, decimals)}`)
              .join('; ')
          );
        if (settled.length) bits.push(`${settled.length} option${settled.length > 1 ? 's' : ''} expired & settled`);
        setLiqNotice(`${bits.join(' · ')} — demo funds only, no real money moved.`);
        return { ...s };
      });
    },
    [symbol, decimals]
  );

  useEffect(() => {
    let alive = true;
    const loadCrypto = async () => {
      try {
        const r = await fetch(`/api/depth?pair=${cryptoInfo!.symbol}USD&count=25`, { cache: 'no-store' });
        const j = (await r.json()) as DepthResp;
        if (!alive) return;
        if (j.ok) {
          setDepth(j);
          if (j.mid > 0) applyPrice(j.mid);
          setDepthError('');
        } else {
          setDepthError(j.error ?? 'Order book unavailable');
        }
      } catch {
        if (alive) setDepthError('Could not reach market data.');
      }
    };
    const loadForex = async () => {
      try {
        const r = await fetch('/api/forex', { cache: 'no-store' });
        const j = await r.json();
        if (!alive || !j.ok) return;
        const prices = forexPrices(j.rates as Record<string, number>);
        const px = prices[symbol];
        if (px > 0) {
          applyPrice(px);
          setDepthError('');
        }
      } catch {
        if (alive) setDepthError('Forex reference rates unavailable.');
      }
    };
    const loadStock = async () => {
      try {
        const r = await fetch('/api/stocks', { cache: 'no-store' });
        const j = await r.json();
        if (!alive || !j.ok) return;
        const q = (j.quotes as { symbol: string; price: number; priceUSD: number }[]).find(
          (x) => x.symbol === symbol
        );
        if (q && q.priceUSD > 0) {
          applyPrice(q.priceUSD, q.price);
          setDepthError('');
        }
      } catch {
        if (alive) setDepthError('Stock data unavailable.');
      }
    };
    if (market === 'crypto') {
      loadCrypto();
      const t = setInterval(loadCrypto, 5000);
      return () => {
        alive = false;
        clearInterval(t);
      };
    }
    if (market === 'stock') {
      loadStock();
      const t = setInterval(loadStock, 60_000);
      return () => {
        alive = false;
        clearInterval(t);
      };
    }
    loadForex();
    const t = setInterval(loadForex, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [market, symbol, cryptoInfo, applyPrice]);

  const execute = useCallback(
    (side: 'buy' | 'sell', amount: number, mode: 'usd' | 'coin', orderType: OrderType = 'delivery'): TradeResult => {
      const s: PaperState = {
        ...state,
        holdings: { ...state.holdings },
        positions: [...state.positions],
        options: [...(state.options ?? [])],
        orders: [...state.orders],
        snapshots: [...state.snapshots],
      };
      // Stocks: engine trades in USD (priceUSD); display uses native currency.
      // Pair label: bare ticker for stocks, XXXUSD for crypto/forex.
      const pairLabel = market === 'stock' ? symbol : undefined;
      let res: TradeResult;
      if (side === 'buy') {
        const usd = mode === 'usd' ? amount : amount * priceRef.current;
        res = paperBuy(s, symbol, usd, priceRef.current, pairLabel, orderType);
      } else {
        const qty = mode === 'coin' ? amount : amount / (priceRef.current || 1);
        res = paperSell(s, symbol, qty, priceRef.current, pairLabel, orderType);
      }
      if (res.ok) setState({ ...s });
      return res;
    },
    [state, symbol, market]
  );

  const executeLeveraged = useCallback(
    (
      dir: PosSide,
      marginUsd: number,
      leverage: number,
      opts?: { stopLoss?: number; takeProfit?: number; orderType?: 'intraday' | 'leveraged' }
    ): TradeResult => {
      const s: PaperState = {
        ...state,
        holdings: { ...state.holdings },
        positions: state.positions.map((p) => ({ ...p })),
        options: [...(state.options ?? [])],
        orders: [...state.orders],
        snapshots: [...state.snapshots],
      };
      const res = openPosition(s, symbol, dir, marginUsd, leverage, priceRef.current, opts);
      if (res.ok) setState({ ...s });
      return res;
    },
    [state, symbol]
  );

  const executeOption = useCallback(
    (kind: OptionKind, strike: number, expiry: number, contracts: number): BuyOptionResult => {
      const s: PaperState = {
        ...state,
        holdings: { ...state.holdings },
        positions: [...state.positions],
        options: [...(state.options ?? [])],
        orders: [...state.orders],
        snapshots: [...state.snapshots],
      };
      const res = buyOption(s, symbol, kind, strike, expiry, contracts, priceRef.current);
      if (res.ok) setState({ ...s });
      return res;
    },
    [state, symbol]
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-slate-400 hover:text-white transition" aria-label="Back to markets">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            {symbol}
            {market !== 'stock' && <span className="text-slate-500 font-semibold">/USD</span>}
            <span className="ml-1 text-sm font-medium text-slate-400">{name}</span>
            {market === 'forex' && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300 bg-sky-400/10 border border-sky-400/30 rounded-md px-2 py-0.5">
                Ref rate
              </span>
            )}
            {market === 'stock' && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300 bg-violet-400/10 border border-violet-400/30 rounded-md px-2 py-0.5">
                Daily close · {stockInfo?.exchange}
              </span>
            )}
            {symbol === 'QSR' && (
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-200 bg-amber-400/15 border border-amber-300/40 rounded-md px-2 py-0.5">
                Native
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 font-mono tabular-nums">
            {price > 0
              ? market === 'stock'
                ? `${fmtStockPrice(price, currency, decimals)} (${fmtUSD(priceUSD)})`
                : fmtUSD(price, decimals)
              : 'Connecting…'}
          </p>
        </div>
        <span className="ml-auto text-[11px] font-bold uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-full px-3 py-1.5">
          Paper trading — no real money
        </span>
      </div>

      {depthError && (
        <div className="mb-4 flex items-center gap-2 text-xs text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-xl px-3 py-2.5">
          <TriangleAlert size={14} />
          {depthError}
        </div>
      )}

      {liqNotice && (
        <div className="mb-4 flex items-center gap-2 text-xs text-red-300 bg-red-400/10 border border-red-400/30 rounded-xl px-3 py-2.5">
          <TriangleAlert size={14} />
          {liqNotice}
          <button onClick={() => setLiqNotice('')} className="ml-auto underline hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {market === 'forex' && (
        <div className="mb-4 flex items-center gap-2 text-xs text-sky-300 bg-sky-400/10 border border-sky-400/30 rounded-xl px-3 py-2.5">
          <Globe2 size={14} />
          Daily reference rate (ECB via Frankfurter) — indicative pricing for demo trading, not a live tick feed.
        </div>
      )}

      {market === 'stock' && (
        <div className="mb-4 flex items-center gap-2 text-xs text-violet-300 bg-violet-400/10 border border-violet-400/30 rounded-xl px-3 py-2.5">
          <Globe2 size={14} />
          Daily stock close (Yahoo Finance) — indicative pricing for demo trading. Spot buy/sell only, no leverage on stocks.
        </div>
      )}

      {symbol === 'QSR' && (
        <div className="mb-4 flex items-center gap-2 text-xs text-amber-200 bg-amber-400/10 border border-amber-300/30 rounded-xl px-3 py-2.5">
          <TriangleAlert size={14} />
          QSR demo price is <strong>simulated</strong> (gentle random walk from $0.0001) — QSR is not listed on any real
          exchange yet. All trading here is paper trading.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          {symbol === 'QSR' ? (
            <div className="bg-panel border border-accent/40 rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-5">
                <img
                  src="/quasar-coin-logo.png"
                  alt="Quasar coin logo"
                  className="w-16 h-16 rounded-full border-2 border-accent/60 object-cover"
                />
                <div>
                  <h2 className="text-lg font-extrabold text-white">Quasar Coin (QSR)</h2>
                  <p className="text-xs text-slate-400">Native demo token of the Quasar exchange</p>
                </div>
                <span className="ml-auto text-[10px] font-black uppercase tracking-wider text-amber-200 bg-amber-400/15 border border-amber-300/40 rounded-md px-2 py-1">
                  Devnet in progress
                </span>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="bg-panel2 border border-edge rounded-xl px-4 py-3">
                  <dt className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Total supply</dt>
                  <dd className="text-white font-mono font-bold mt-1">500,000,000,000 QSR</dd>
                </div>
                <div className="bg-panel2 border border-edge rounded-xl px-4 py-3">
                  <dt className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Demo price</dt>
                  <dd className="text-white font-mono font-bold mt-1">
                    {priceUSD > 0 ? fmtUSD(priceUSD, 6) : '—'}{' '}
                    <span className="text-[10px] text-slate-500 font-sans font-normal">simulated</span>
                  </dd>
                </div>
                <div className="bg-panel2 border border-edge rounded-xl px-4 py-3 sm:col-span-2">
                  <dt className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                    Quasar Core network
                  </dt>
                  <dd className="text-amber-200/90 font-mono font-bold mt-1 break-all">{QSR_MINT_ADDRESS}</dd>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Quasar Core is Quasar's own independent blockchain (educational P2P network). QSR is the best coin — live, the future, everything. No Solana mint, no real market value — demo price is simulated.
                  </p>
                </div>
              </dl>
              <p className="mt-4 text-[11px] text-slate-500">
                No TradingView chart exists for QSR yet — the demo order book and price above are simulated for paper
                trading practice.
              </p>
            </div>
          ) : (
            <TradingViewChart key={tvSymbol} tvSymbol={tvSymbol} yahoo={signalYahoo} />
          )}
          <SignalPanel yahoo={signalYahoo} symbolLabel={symbol} priceDecimals={decimals} />
          <div>
            <h2 className="text-lg font-extrabold text-white mb-3">Crypto News</h2>
            <TVTopStories />
            <p className="mt-2 text-[11px] text-slate-500">Live crypto headlines by TradingView.</p>
          </div>
        </div>
        <div className="space-y-4">
          <TradePanel
            symbol={symbol}
            price={priceUSD}
            cash={state.cash}
            holdingQty={state.holdings[symbol]?.qty ?? 0}
            onTrade={execute}
            onOption={executeOption}
            priceLabel={
              market === 'stock' && price > 0
                ? `${fmtStockPrice(price, currency, decimals)} ≈ ${fmtUSD(priceUSD)}`
                : undefined
            }
            {...(market === 'stock'
              ? { allowLeverage: false }
              : { onLeveraged: executeLeveraged })}
          />
          {market === 'crypto' ? (
            depth ? (
              <OrderBook asks={depth.asks} bids={depth.bids} decimals={decimals} spread={depth.spread} />
            ) : (
              <div className="bg-panel border border-edge rounded-2xl p-6 text-center text-xs text-slate-500">
                Loading order book…
              </div>
            )
          ) : (
            <div className="bg-panel border border-edge rounded-2xl p-6 text-center text-xs text-slate-500">
              {market === 'forex'
                ? 'No live order book for reference FX rates — demo fills execute at the reference price.'
                : 'No live depth for daily stock data — demo fills execute at the daily close.'}
            </div>
          )}
        </div>
      </div>

      <p className={cn('mt-4 text-[11px] text-slate-500')}>
        Chart by TradingView ·{' '}
        {market === 'crypto'
          ? 'order book live from Kraken'
          : market === 'forex'
            ? 'FX rates: ECB daily reference'
            : 'stock prices: Yahoo Finance daily closes (indicative) · spot only'} · demo fills execute instantly
        at market price.
      </p>
    </div>
  );
}
