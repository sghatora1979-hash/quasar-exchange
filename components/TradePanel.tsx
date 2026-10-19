'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, BadgeDollarSign, TriangleAlert, ShieldAlert, X } from 'lucide-react';
import {
  FEE_RATE,
  BROKER_FEE_RATE,
  LEVERAGE_STEPS,
  MAX_LEVERAGE,
  fmtQty,
  fmtUSD,
  liquidationPrice,
  wipeoutPct,
  optionPremium,
  type TradeResult,
  type BuyOptionResult,
  type PosSide,
  type OrderType,
  type OptionKind,
} from '@/lib/quasar';
import { cn } from '@/lib/utils';

type Props = {
  symbol: string;
  price: number;
  cash: number;
  holdingQty: number;
  onTrade: (side: 'buy' | 'sell', amount: number, mode: 'usd' | 'coin', orderType?: OrderType) => TradeResult;
  onLeveraged?: (
    dir: PosSide,
    marginUsd: number,
    leverage: number,
    opts?: { stopLoss?: number; takeProfit?: number; orderType?: 'intraday' | 'leveraged' }
  ) => TradeResult;
  onOption?: (kind: OptionKind, strike: number, expiry: number, contracts: number) => BuyOptionResult;
  /** When false, the leverage selector is hidden (spot trading only). Default true. */
  allowLeverage?: boolean;
  /** Optional display label for the market price row (e.g. native currency for stocks). */
  priceLabel?: string;
};

const RISK_ACK_KEY = 'quasar-lev-risk-ack';

const EXPIRIES = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
];

export function TradePanel({ symbol, price, cash, holdingQty, onTrade, onLeveraged, onOption, allowLeverage = true, priceLabel }: Props) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [dir, setDir] = useState<PosSide>('long');
  const [mode, setMode] = useState<'usd' | 'coin'>('usd');
  const [orderType, setOrderType] = useState<'delivery' | 'intraday' | 'options'>('delivery');
  const [amount, setAmount] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [optKind, setOptKind] = useState<OptionKind>('call');
  const [strikePct, setStrikePct] = useState(0); // % offset from spot
  const [expiryIdx, setExpiryIdx] = useState(1);
  const [contracts, setContracts] = useState('1');
  const [riskAck, setRiskAck] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    try {
      setRiskAck(window.localStorage.getItem(RISK_ACK_KEY) === '1');
    } catch {
      setRiskAck(true);
    }
  }, []);

  const dismissRisk = () => {
    setRiskAck(true);
    try {
      window.localStorage.setItem(RISK_ACK_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const amt = parseFloat(amount) || 0;
  const isLev = leverage > 1;
  const isOptions = !isLev && orderType === 'options';

  const strike = useMemo(() => (price > 0 ? price * (1 + strikePct / 100) : 0), [price, strikePct]);
  const expiry = useMemo(() => Date.now() + EXPIRIES[expiryIdx].days * 86_400_000, [expiryIdx]);
  const nContracts = Math.max(1, Math.floor(parseFloat(contracts) || 0));
  const premiumPerUnit = useMemo(
    () => (price > 0 && strike > 0 ? optionPremium(optKind, price, strike) : 0),
    [optKind, price, strike]
  );
  const premiumTotal = premiumPerUnit * nContracts;

  const preview = useMemo(() => {
    if (isOptions) {
      if (!(price > 0) || !(premiumTotal > 0)) return null;
      return {
        kind: 'opt' as const,
        usd: premiumTotal,
        fee: 0,
        label: `${nContracts} × ${optKind.toUpperCase()} @ ${fmtUSD(strike, 4)} strike`,
      };
    }
    if (!(amt > 0) || !(price > 0)) return null;
    if (!isLev) {
      if (side === 'buy') {
        const usd = mode === 'usd' ? amt : amt * price;
        const exFee = usd * FEE_RATE;
        const brFee = usd * BROKER_FEE_RATE;
        const qty = (usd - exFee - brFee) / price;
        return { kind: 'spot' as const, usd, exFee, brFee, qty, label: `You receive ≈ ${fmtQty(qty)} ${symbol}` };
      }
      const qty = mode === 'coin' ? amt : amt / price;
      const gross = qty * price;
      const exFee = gross * FEE_RATE;
      const brFee = gross * BROKER_FEE_RATE;
      return { kind: 'spot' as const, usd: gross, exFee, brFee, qty, label: `You receive ≈ ${fmtUSD(gross - exFee - brFee)}` };
    }
    // Leveraged: amount = margin USD.
    const margin = amt;
    const exFee = margin * FEE_RATE;
    const brFee = margin * BROKER_FEE_RATE;
    const notional = (margin - exFee - brFee) * leverage;
    const qty = notional / price;
    const liq = liquidationPrice(price, dir, leverage);
    return {
      kind: 'lev' as const,
      usd: margin,
      exFee,
      brFee,
      qty,
      notional,
      liq,
      label: `Position ≈ ${fmtQty(qty)} ${symbol} (${fmtUSD(notional)} notional)`,
    };
  }, [amt, mode, price, side, dir, symbol, leverage, isLev, isOptions, premiumTotal, nContracts, optKind, strike]);

  const sl = parseFloat(stopLoss) || 0;
  const tp = parseFloat(takeProfit) || 0;
  const slTpError = useMemo(() => {
    if (!isLev) return null;
    if (sl > 0) {
      if (dir === 'long' && sl >= price) return 'Stop-loss must be below the entry price for a long.';
      if (dir === 'short' && sl <= price) return 'Stop-loss must be above the entry price for a short.';
    }
    if (tp > 0) {
      if (dir === 'long' && tp <= price) return 'Take-profit must be above the entry price for a long.';
      if (dir === 'short' && tp >= price) return 'Take-profit must be below the entry price for a short.';
    }
    return null;
  }, [isLev, sl, tp, dir, price]);

  const submit = () => {
    setMsg(null);
    if (isOptions) {
      if (!onOption) {
        setMsg({ ok: false, text: 'Options unavailable here.' });
        return;
      }
      const res = onOption(optKind, strike, expiry, nContracts);
      if (res.ok) {
        setMsg({
          ok: true,
          text: `Bought ${nContracts} ${optKind.toUpperCase()} @ ${fmtUSD(strike, 4)} strike — premium ${fmtUSD(premiumTotal)} (demo, simplified pricing)`,
        });
      } else {
        setMsg({ ok: false, text: res.error });
      }
      return;
    }
    if (!isLev) {
      const res = onTrade(side, amt, mode, orderType === 'intraday' ? 'intraday' : 'delivery');
      if (res.ok) {
        setMsg({ ok: true, text: `${side === 'buy' ? 'Bought' : 'Sold'} ${fmtQty(res.order.qty)} ${symbol} @ ${fmtUSD(res.order.price)} (demo fill${orderType === 'intraday' ? ', intraday' : ''})` });
        setAmount('');
      } else {
        setMsg({ ok: false, text: res.error });
      }
      return;
    }
    if (!onLeveraged) {
      setMsg({ ok: false, text: 'Leveraged trading unavailable here.' });
      return;
    }
    const res = onLeveraged(dir, amt, leverage, {
      stopLoss: sl > 0 ? sl : undefined,
      takeProfit: tp > 0 ? tp : undefined,
      orderType: 'leveraged',
    });
    if (res.ok) {
      setMsg({
        ok: true,
        text: `Opened ${leverage}x ${dir.toUpperCase()} ${fmtQty(res.order.qty)} ${symbol} @ ${fmtUSD(res.order.price)} — margin ${fmtUSD(amt)}${sl > 0 || tp > 0 ? ' (SL/TP armed)' : ''} (demo)`,
      });
      setAmount('');
      setStopLoss('');
      setTakeProfit('');
    } else {
      setMsg({ ok: false, text: res.error });
    }
  };

  const maxHint = isLev
    ? `Margin available: ${fmtUSD(cash)}`
    : side === 'buy'
      ? `Available: ${fmtUSD(cash)}`
      : `Available: ${fmtQty(holdingQty)} ${symbol}`;

  const wipe = wipeoutPct(leverage);
  const canSubmit = isOptions ? premiumTotal > 0 && price > 0 : amt > 0 && price > 0 && !slTpError;

  return (
    <div className="bg-panel border border-edge rounded-2xl overflow-hidden">
      <div className="px-4 pt-4 flex items-center justify-between">
        <div className="flex bg-void rounded-xl p-1 gap-1">
          {isOptions ? (
            (['call', 'put'] as const).map((k) => (
              <button
                key={k}
                onClick={() => { setOptKind(k); setMsg(null); }}
                className={cn(
                  'px-5 py-2 rounded-lg text-sm font-bold capitalize transition',
                  optKind === k
                    ? k === 'call'
                      ? 'bg-up/20 text-up'
                      : 'bg-down/20 text-down'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                {k}
              </button>
            ))
          ) : !isLev ? (
            (['buy', 'sell'] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setSide(s); setMsg(null); }}
                className={cn(
                  'px-5 py-2 rounded-lg text-sm font-bold capitalize transition flex items-center gap-1.5',
                  side === s
                    ? s === 'buy'
                      ? 'bg-up/20 text-up'
                      : 'bg-down/20 text-down'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                {s === 'buy' ? <ArrowDownToLine size={14} /> : <ArrowUpFromLine size={14} />}
                {s}
              </button>
            ))
          ) : (
            (['long', 'short'] as const).map((d) => (
              <button
                key={d}
                onClick={() => { setDir(d); setMsg(null); }}
                className={cn(
                  'px-5 py-2 rounded-lg text-sm font-bold capitalize transition flex items-center gap-1.5',
                  dir === d
                    ? d === 'long'
                      ? 'bg-up/20 text-up'
                      : 'bg-down/20 text-down'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                {d === 'long' ? <ArrowDownToLine size={14} /> : <ArrowUpFromLine size={14} />}
                {d}
              </button>
            ))
          )}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-full px-2.5 py-1">
          Demo
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Order type: Delivery | Intraday | Options (spot only) */}
        {!isLev && onOption && (
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-1.5">Order type</div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['delivery', 'intraday', 'options'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setOrderType(t); setMsg(null); }}
                  className={cn(
                    'px-2 py-2 rounded-lg text-xs font-bold capitalize border transition',
                    orderType === t
                      ? 'bg-accent/20 border-accent/60 text-accent'
                      : 'bg-void border-edge text-slate-400 hover:text-white hover:border-slate-500'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            {orderType === 'intraday' && (
              <p className="text-[10px] text-amber-200/80 mt-1.5">
                Intraday (demo): flagged as a same-session trade — auto square-off at session end is simulated.
              </p>
            )}
            {orderType === 'options' && (
              <p className="text-[10px] text-slate-500 mt-1.5">
                Options (demo): simplified pricing — premium = intrinsic + 2% of spot. Settles at intrinsic value on expiry. Not Black-Scholes.
              </p>
            )}
          </div>
        )}

        {/* Leverage selector (hidden when allowLeverage is false, e.g. stocks) */}
        {allowLeverage && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-400">Leverage</span>
            <span className="text-xs font-mono font-bold text-accent">{leverage}x</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {LEVERAGE_STEPS.map((L) => (
              <button
                key={L}
                onClick={() => { setLeverage(L); setMsg(null); }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold font-mono whitespace-nowrap border transition',
                  leverage === L
                    ? L >= 50
                      ? 'bg-red-500/20 border-red-400/60 text-red-300'
                      : 'bg-accent/20 border-accent/60 text-accent'
                    : 'bg-void border-edge text-slate-400 hover:text-white hover:border-slate-500'
                )}
              >
                {L}x
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Paper trading only — max {MAX_LEVERAGE}x demo leverage.</p>
        </div>
        )}

        {/* First-use risk education banner */}
        {isLev && !riskAck && (
          <div className="relative text-xs rounded-xl px-3 py-3 pr-9 border text-amber-200 bg-amber-400/10 border-amber-400/40">
            <div className="flex items-start gap-2">
              <ShieldAlert size={15} className="shrink-0 mt-0.5" />
              <p>
                <span className="font-bold">Leverage multiplies losses too.</span> At 1000x, a 0.1%
                move wipes your margin. This is paper trading — never try this with real money.
              </p>
            </div>
            <button
              onClick={dismissRisk}
              aria-label="Dismiss risk warning"
              className="absolute top-2 right-2 text-amber-300/70 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Escalating risk warning */}
        {isLev && leverage >= 50 && (
          <div className="flex items-start gap-2 text-xs rounded-xl px-3 py-2.5 border text-red-200 bg-red-500/10 border-red-500/50">
            <TriangleAlert size={15} className="shrink-0 mt-0.5" />
            <p>
              <span className="font-bold">Extreme risk:</span> a {wipe < 0.01 ? wipe.toFixed(3) : wipe.toFixed(2)}%
              move against you = <span className="font-bold">total loss</span> of your margin.
              {leverage === 1000 && ' At 1000x, normal market noise alone can liquidate you — this is how real accounts get wiped out. Learn here, not with real money.'}
            </p>
          </div>
        )}
        {isLev && leverage > 1 && leverage < 50 && (
          <div className="flex items-start gap-2 text-xs rounded-xl px-3 py-2.5 border text-amber-200/90 bg-amber-400/5 border-amber-400/25">
            <TriangleAlert size={14} className="shrink-0 mt-0.5" />
            <p>
              {leverage}x leverage: a {wipe.toFixed(1)}% adverse move wipes your margin. Losses are multiplied
              just like gains.
            </p>
          </div>
        )}

        {/* Stop-loss / Take-profit (leveraged only) */}
        {isLev && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">Stop-loss <span className="text-slate-600 font-normal">(optional)</span></label>
              <input
                type="number"
                min="0"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder={price > 0 ? (dir === 'long' ? (price * 0.98).toFixed(4) : (price * 1.02).toFixed(4)) : '0.00'}
                className="w-full bg-void border border-edge rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-red-400/60"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1 block">Take-profit <span className="text-slate-600 font-normal">(optional)</span></label>
              <input
                type="number"
                min="0"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder={price > 0 ? (dir === 'long' ? (price * 1.02).toFixed(4) : (price * 0.98).toFixed(4)) : '0.00'}
                className="w-full bg-void border border-edge rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-up/60"
              />
            </div>
          </div>
        )}
        {slTpError && (
          <p className="text-[11px] text-red-300 -mt-1">{slTpError}</p>
        )}

        {/* Options controls */}
        {isOptions && (
          <div className="space-y-2.5">
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-1.5">Strike (vs spot {price > 0 ? fmtUSD(price, 4) : '—'})</div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {[-5, -2.5, 0, 2.5, 5].map((p) => (
                  <button
                    key={p}
                    onClick={() => { setStrikePct(p); setMsg(null); }}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-bold font-mono whitespace-nowrap border transition',
                      strikePct === p
                        ? 'bg-accent/20 border-accent/60 text-accent'
                        : 'bg-void border-edge text-slate-400 hover:text-white hover:border-slate-500'
                    )}
                  >
                    {p === 0 ? 'ATM' : `${p > 0 ? '+' : ''}${p}%`}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-1.5">Expiry</div>
                <div className="flex gap-1.5">
                  {EXPIRIES.map((e, i) => (
                    <button
                      key={e.label}
                      onClick={() => { setExpiryIdx(i); setMsg(null); }}
                      className={cn(
                        'flex-1 px-2 py-2 rounded-lg text-xs font-bold border transition',
                        expiryIdx === i
                          ? 'bg-accent/20 border-accent/60 text-accent'
                          : 'bg-void border-edge text-slate-400 hover:text-white'
                      )}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Contracts <span className="text-slate-600 font-normal">(1 = 1 {symbol})</span></label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={contracts}
                  onChange={(e) => setContracts(e.target.value)}
                  className="w-full bg-void border border-edge rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-accent/60"
                />
              </div>
            </div>
          </div>
        )}

        {!isLev && !isOptions && (
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex bg-void rounded-lg p-0.5 gap-0.5">
              {(['usd', 'coin'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'px-3 py-1.5 rounded-md font-semibold transition',
                    mode === m ? 'bg-panel2 text-white' : 'text-slate-500 hover:text-slate-300'
                  )}
                >
                  {m === 'usd' ? 'USD' : symbol}
                </button>
              ))}
            </div>
            <span>{maxHint}</span>
          </div>
        )}
        {(isLev || isOptions) && (
          <div className="flex items-center justify-end text-xs text-slate-400">
            <span>{isLev ? maxHint : `Premium available: ${fmtUSD(cash)}`}</span>
          </div>
        )}

        {!isOptions && (
          <div className="relative">
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-void border border-edge rounded-xl px-4 py-3.5 text-lg font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-accent/60"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-semibold">
              {isLev ? 'USD margin' : mode === 'usd' ? 'USD' : symbol}
            </span>
          </div>
        )}

        {!isLev && !isOptions && (
          <div className="grid grid-cols-4 gap-1.5">
            {[10, 25, 50, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => {
                  if (side === 'buy') {
                    const usd = (cash * pct) / 100;
                    setAmount(mode === 'usd' ? usd.toFixed(2) : (usd / (price || 1)).toFixed(6));
                  } else {
                    const q = (holdingQty * pct) / 100;
                    setAmount(mode === 'coin' ? q.toFixed(6) : (q * (price || 0)).toFixed(2));
                  }
                }}
                className="text-[11px] font-semibold text-slate-400 bg-void border border-edge rounded-lg py-1.5 hover:text-white hover:border-slate-500 transition"
              >
                {pct}%
              </button>
            ))}
          </div>
        )}
        {isLev && (
          <div className="grid grid-cols-4 gap-1.5">
            {[10, 25, 50, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => setAmount(((cash * pct) / 100).toFixed(2))}
                className="text-[11px] font-semibold text-slate-400 bg-void border border-edge rounded-lg py-1.5 hover:text-white hover:border-slate-500 transition"
              >
                {pct}%
              </button>
            ))}
          </div>
        )}

        <div className="text-xs text-slate-400 space-y-1 bg-void/60 rounded-xl p-3">
          <div className="flex justify-between">
            <span>{isLev ? 'Reference price' : isOptions ? 'Spot price' : 'Market price'}</span>
            <span className="font-mono text-slate-200">{priceLabel ?? (price > 0 ? fmtUSD(price, 6) : '—')}</span>
          </div>
          {preview && (preview.kind === 'spot' || preview.kind === 'lev') && (
            <>
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <BadgeDollarSign size={12} /> Exchange fee (0.1%)
                </span>
                <span className="font-mono text-slate-200">{fmtUSD(preview.exFee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <BadgeDollarSign size={12} /> Broker commission (0.05%)
                </span>
                <span className="font-mono text-slate-200">{fmtUSD(preview.brFee)}</span>
              </div>
            </>
          )}
          {preview && preview.kind === 'lev' && (
            <>
              <div className="flex justify-between">
                <span>Notional ({leverage}x)</span>
                <span className="font-mono text-slate-200">{fmtUSD(preview.notional)}</span>
              </div>
              <div className="flex justify-between">
                <span>Margin required</span>
                <span className="font-mono text-slate-200">{fmtUSD(preview.usd)}</span>
              </div>
              <div className="flex justify-between">
                <span>Liquidation price</span>
                <span className="font-mono text-red-300">{fmtUSD(preview.liq, 6)}</span>
              </div>
            </>
          )}
          {preview && preview.kind === 'opt' && (
            <>
              <div className="flex justify-between">
                <span>Strike</span>
                <span className="font-mono text-slate-200">{fmtUSD(strike, 4)}</span>
              </div>
              <div className="flex justify-between">
                <span>Premium / unit</span>
                <span className="font-mono text-slate-200">{fmtUSD(premiumPerUnit, 4)}</span>
              </div>
              <div className="flex justify-between">
                <span>Expires</span>
                <span className="font-mono text-slate-200">{new Date(expiry).toLocaleDateString()}</span>
              </div>
            </>
          )}
          {preview && (
            <div className="flex justify-between font-semibold text-slate-200 pt-1 border-t border-edge">
              <span>{preview.kind === 'lev' ? 'Position' : preview.kind === 'opt' ? 'Premium' : 'Receive'}</span>
              <span className="font-mono text-right">{preview.kind === 'opt' ? fmtUSD(preview.usd) : preview.label.replace('You receive ≈ ', '')}</span>
            </div>
          )}
        </div>

        <button
          onClick={submit}
          disabled={!canSubmit}
          className={cn(
            'w-full py-3.5 rounded-xl font-bold text-white transition disabled:opacity-40 disabled:cursor-not-allowed',
            isOptions
              ? optKind === 'call'
                ? 'bg-up hover:bg-up/85'
                : 'bg-down hover:bg-down/85'
              : !isLev
                ? side === 'buy'
                  ? 'bg-up hover:bg-up/85'
                  : 'bg-down hover:bg-down/85'
                : dir === 'long'
                  ? 'bg-up hover:bg-up/85'
                  : 'bg-down hover:bg-down/85'
          )}
        >
          {isOptions
            ? `Buy ${nContracts} ${optKind.toUpperCase()} · ${fmtUSD(premiumTotal)} · Demo`
            : !isLev
              ? `${side === 'buy' ? `Buy ${symbol}` : `Sell ${symbol}`} · Demo`
              : `${dir === 'long' ? 'Long' : 'Short'} ${symbol} ${leverage}x · Demo`}
        </button>

        {msg && (
          <div
            className={cn(
              'text-xs rounded-xl px-3 py-2.5 border',
              msg.ok ? 'text-up bg-up/10 border-up/30' : 'text-down bg-down/10 border-down/30'
            )}
          >
            {msg.text}
          </div>
        )}
        <p className="text-[11px] text-slate-500 text-center">
          Paper trading — no real money moves.{' '}
          {isOptions
            ? 'Options use simplified demo pricing and settle at intrinsic value on expiry.'
            : isLev
              ? 'Leveraged fills are simulated instantly.'
              : 'Orders fill instantly at the live market price.'}
        </p>
      </div>
    </div>
  );
}
