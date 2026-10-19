// Quasar paper-trading engine — DEMO ONLY. No real money, no real orders.
// All state lives in the browser's localStorage under QUASAR_KEY.

export const START_CASH = 100000;
export const FEE_RATE = 0.001; // 0.1% exchange fee (demo)
export const BROKER_FEE_RATE = 0.0005; // 0.05% broker commission (demo)
export const TOTAL_FEE_RATE = FEE_RATE + BROKER_FEE_RATE; // 0.15% round cost per side
export const MAX_LEVERAGE = 1000;
const QUASAR_KEY = 'quasar-paper-v1';

/** Split a gross USD amount into exchange fee + broker commission (demo). */
export function feeFor(usd: number): { exchangeFee: number; brokerFee: number; total: number } {
  const exchangeFee = usd * FEE_RATE;
  const brokerFee = usd * BROKER_FEE_RATE;
  return { exchangeFee, brokerFee, total: exchangeFee + brokerFee };
}

export type Side = 'buy' | 'sell';
export type PosSide = 'long' | 'short';

export type Holding = {
  symbol: string;
  qty: number;
  avgCost: number; // average buy price in USD
};

export type OrderType = 'delivery' | 'intraday' | 'option' | 'leveraged';

export type PaperOrder = {
  id: string;
  time: number; // epoch ms
  pair: string; // e.g. BTCUSD or EURUSD
  symbol: string; // e.g. BTC or EUR
  side: Side;
  price: number; // execution price USD
  qty: number; // base quantity
  usd: number; // gross USD value (notional for leveraged)
  fee: number; // total USD fee charged (exchange + broker)
  exchangeFee: number; // 0.1% exchange fee portion
  brokerFee: number; // 0.05% broker commission portion
  leverage?: number; // 1 = spot (omitted for old spot orders)
  orderType?: OrderType;
  status: 'filled' | 'liquidated' | 'stopped' | 'take-profit'; // demo fills instantly
};

export type Position = {
  id: string;
  time: number;
  pair: string; // e.g. BTCUSD
  symbol: string; // e.g. BTC
  side: PosSide;
  entry: number; // entry price
  qty: number; // base units = notional / entry
  margin: number; // USD collateral locked (after open fee)
  leverage: number; // 1..1000
  liqPrice: number; // auto-liquidation price
  fee: number; // open fee paid (total)
  exchangeFee: number;
  brokerFee: number;
  stopLoss?: number; // optional SL trigger price
  takeProfit?: number; // optional TP trigger price
  orderType?: 'intraday' | 'leveraged';
};

export type OptionKind = 'call' | 'put';

export type OptionPosition = {
  id: string;
  time: number; // epoch ms
  symbol: string;
  kind: OptionKind;
  strike: number; // USD
  expiry: number; // epoch ms
  contracts: number; // 1 contract = 1 unit of symbol (demo simplification)
  premiumPerUnit: number; // USD paid per unit
  spotAtBuy: number; // USD
};

export type Snapshot = { t: number; equity: number };

export type PaperState = {
  cash: number;
  holdings: Record<string, Holding>;
  positions: Position[];
  options: OptionPosition[];
  orders: PaperOrder[];
  snapshots: Snapshot[];
  createdAt: number;
};

function blankState(): PaperState {
  return { cash: START_CASH, holdings: {}, positions: [], options: [], orders: [], snapshots: [], createdAt: Date.now() };
}

export function loadState(): PaperState {
  if (typeof window === 'undefined') return blankState();
  try {
    const raw = window.localStorage.getItem(QUASAR_KEY);
    if (!raw) return blankState();
    const s = JSON.parse(raw) as PaperState;
    if (typeof s.cash !== 'number' || !s.holdings || !Array.isArray(s.orders)) return blankState();
    // Migration-safe: old states have no positions array.
    if (!Array.isArray(s.positions)) s.positions = [];
    if (!Array.isArray(s.options)) s.options = [];
    return s;
  } catch {
    return blankState();
  }
}

export function saveState(s: PaperState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(QUASAR_KEY, JSON.stringify(s));
  } catch {
    /* storage full/blocked — demo continues in memory */
  }
}

export function resetState(): PaperState {
  const s = blankState();
  saveState(s);
  return s;
}

/** Top up demo cash to $100,000 (never reduces a higher balance). Existing data untouched otherwise. */
export function topUpState(s: PaperState): PaperState {
  if (s.cash < START_CASH) {
    s.cash = START_CASH;
    saveState(s);
  }
  return s;
}

const uid = () => `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export type TradeResult = { ok: true; order: PaperOrder } | { ok: false; error: string };

/** Market BUY: spend `usd` (fees included in the debit). */
export function paperBuy(
  s: PaperState,
  symbol: string,
  usd: number,
  price: number,
  pairLabel?: string,
  orderType: OrderType = 'delivery'
): TradeResult {
  if (!(usd > 0)) return { ok: false, error: 'Enter an amount above $0.' };
  if (!(price > 0)) return { ok: false, error: 'Live price unavailable — try again in a moment.' };
  if (usd > s.cash + 1e-9) return { ok: false, error: 'Not enough demo cash for this order.' };
  const f = feeFor(usd);
  const qty = (usd - f.total) / price;
  const h = s.holdings[symbol];
  const newQty = (h?.qty ?? 0) + qty;
  const newCost = ((h?.qty ?? 0) * (h?.avgCost ?? 0) + (usd - f.total)) / newQty;
  s.holdings[symbol] = { symbol, qty: newQty, avgCost: newCost };
  s.cash = Math.max(0, s.cash - usd);
  const order: PaperOrder = {
    id: uid(),
    time: Date.now(),
    pair: pairLabel ?? `${symbol}USD`,
    symbol,
    side: 'buy',
    price,
    qty,
    usd,
    fee: f.total,
    exchangeFee: f.exchangeFee,
    brokerFee: f.brokerFee,
    orderType,
    status: 'filled',
  };
  s.orders.unshift(order);
  saveState(s);
  return { ok: true, order };
}

/** Market SELL: sell `qty` units at `price`. */
export function paperSell(
  s: PaperState,
  symbol: string,
  qty: number,
  price: number,
  pairLabel?: string,
  orderType: OrderType = 'delivery'
): TradeResult {
  if (!(qty > 0)) return { ok: false, error: 'Enter a quantity above 0.' };
  if (!(price > 0)) return { ok: false, error: 'Live price unavailable — try again in a moment.' };
  const h = s.holdings[symbol];
  if (!h || h.qty < qty - 1e-12) return { ok: false, error: `Not enough ${symbol} in your demo portfolio.` };
  const gross = qty * price;
  const f = feeFor(gross);
  const net = gross - f.total;
  const left = h.qty - qty;
  if (left <= 1e-9) delete s.holdings[symbol];
  else s.holdings[symbol] = { ...h, qty: left };
  s.cash += net;
  const order: PaperOrder = {
    id: uid(),
    time: Date.now(),
    pair: pairLabel ?? `${symbol}USD`,
    symbol,
    side: 'sell',
    price,
    qty,
    usd: gross,
    fee: f.total,
    exchangeFee: f.exchangeFee,
    brokerFee: f.brokerFee,
    orderType,
    status: 'filled',
  };
  s.orders.unshift(order);
  saveState(s);
  return { ok: true, order };
}

// ---------- Leveraged positions (paper only) ----------

export const LEVERAGE_STEPS = [1, 5, 10, 25, 50, 100, 200, 1000];

/** Fee buffer baked into the liquidation price (covers round-trip demo fees). */
const LIQ_FEE_BUFFER = TOTAL_FEE_RATE;

/** Liquidation price: adverse move of 1/L (minus a small fee buffer) wipes the margin. */
export function liquidationPrice(entry: number, side: PosSide, leverage: number): number {
  const L = Math.min(Math.max(leverage, 1), MAX_LEVERAGE);
  return side === 'long'
    ? entry * (1 - 1 / L + LIQ_FEE_BUFFER)
    : entry * (1 + 1 / L - LIQ_FEE_BUFFER);
}

export type PositionOpts = {
  stopLoss?: number;
  takeProfit?: number;
  orderType?: 'intraday' | 'leveraged';
};

/** Open a leveraged LONG/SHORT. `marginUsd` is collateral debited from cash. */
export function openPosition(
  s: PaperState,
  symbol: string,
  side: PosSide,
  marginUsd: number,
  leverage: number,
  price: number,
  opts: PositionOpts = {}
): TradeResult {
  const L = Math.round(leverage);
  if (!(marginUsd > 0)) return { ok: false, error: 'Enter a margin above $0.' };
  if (!(price > 0)) return { ok: false, error: 'Live price unavailable — try again in a moment.' };
  if (L < 1 || L > MAX_LEVERAGE) return { ok: false, error: `Leverage must be 1–${MAX_LEVERAGE}x.` };
  if (marginUsd > s.cash + 1e-9) return { ok: false, error: 'Not enough demo cash for this margin.' };
  const f = feeFor(marginUsd);
  const margin = marginUsd - f.total;
  const notional = margin * L;
  const qty = notional / price;
  const liqPrice = liquidationPrice(price, side, L);
  const { stopLoss, takeProfit, orderType = 'leveraged' } = opts;
  if (stopLoss && stopLoss > 0) {
    const bad = side === 'long' ? stopLoss >= price : stopLoss <= price;
    if (bad) return { ok: false, error: side === 'long' ? 'Stop-loss must be below the entry price for a long.' : 'Stop-loss must be above the entry price for a short.' };
  }
  if (takeProfit && takeProfit > 0) {
    const bad = side === 'long' ? takeProfit <= price : takeProfit >= price;
    if (bad) return { ok: false, error: side === 'long' ? 'Take-profit must be above the entry price for a long.' : 'Take-profit must be below the entry price for a short.' };
  }
  s.cash = Math.max(0, s.cash - marginUsd);
  const pos: Position = {
    id: uid(),
    time: Date.now(),
    pair: `${symbol}USD`,
    symbol,
    side,
    entry: price,
    qty,
    margin,
    leverage: L,
    liqPrice,
    fee: f.total,
    exchangeFee: f.exchangeFee,
    brokerFee: f.brokerFee,
    stopLoss: stopLoss && stopLoss > 0 ? stopLoss : undefined,
    takeProfit: takeProfit && takeProfit > 0 ? takeProfit : undefined,
    orderType,
  };
  s.positions.unshift(pos);
  const order: PaperOrder = {
    id: uid(),
    time: Date.now(),
    pair: pos.pair,
    symbol,
    side: side === 'long' ? 'buy' : 'sell',
    price,
    qty,
    usd: notional,
    fee: f.total,
    exchangeFee: f.exchangeFee,
    brokerFee: f.brokerFee,
    leverage: L,
    orderType,
    status: 'filled',
  };
  s.orders.unshift(order);
  saveState(s);
  return { ok: true, order };
}

export type CloseResult = { ok: true; pnl: number; credit: number } | { ok: false; error: string };

export type CloseReason = 'manual' | 'liquidated' | 'stopped' | 'take-profit';

/** Close a position at `price`. */
export function closePosition(
  s: PaperState,
  id: string,
  price: number,
  reason: CloseReason = 'manual'
): CloseResult {
  const idx = s.positions.findIndex((p) => p.id === id);
  if (idx < 0) return { ok: false, error: 'Position not found.' };
  if (!(price > 0)) return { ok: false, error: 'Live price unavailable — try again in a moment.' };
  const pos = s.positions[idx];
  const notional = pos.qty * pos.entry;
  const gross = pos.qty * price;
  const rawPnl = pos.side === 'long' ? gross - notional : notional - gross;
  const f = feeFor(gross);
  const pnl = rawPnl - f.total;
  const credit = Math.max(0, pos.margin + pnl);
  s.positions.splice(idx, 1);
  s.cash += credit;
  s.orders.unshift({
    id: uid(),
    time: Date.now(),
    pair: pos.pair,
    symbol: pos.symbol,
    side: pos.side === 'long' ? 'sell' : 'buy',
    price,
    qty: pos.qty,
    usd: gross,
    fee: f.total,
    exchangeFee: f.exchangeFee,
    brokerFee: f.brokerFee,
    leverage: pos.leverage,
    orderType: pos.orderType ?? 'leveraged',
    status: reason === 'manual' ? 'filled' : reason,
  });
  saveState(s);
  return { ok: true, pnl, credit };
}

/**
 * Auto-close positions whose stop-loss or take-profit was touched.
 * Mutates `s` and saves. Returns closed positions with their trigger.
 */
export function checkStops(
  s: PaperState,
  prices: Record<string, number>
): { closed: { pos: Position; trigger: 'stopped' | 'take-profit'; price: number }[] } {
  const closed: { pos: Position; trigger: 'stopped' | 'take-profit'; price: number }[] = [];
  for (const pos of [...s.positions]) {
    const px = prices[pos.symbol];
    if (!(px > 0)) continue;
    let trigger: 'stopped' | 'take-profit' | null = null;
    let fill = px;
    if (pos.side === 'long') {
      if (pos.stopLoss && px <= pos.stopLoss) { trigger = 'stopped'; fill = pos.stopLoss; }
      else if (pos.takeProfit && px >= pos.takeProfit) { trigger = 'take-profit'; fill = pos.takeProfit; }
    } else {
      if (pos.stopLoss && px >= pos.stopLoss) { trigger = 'stopped'; fill = pos.stopLoss; }
      else if (pos.takeProfit && px <= pos.takeProfit) { trigger = 'take-profit'; fill = pos.takeProfit; }
    }
    if (trigger) {
      const r = closePosition(s, pos.id, fill, trigger);
      if (r.ok) closed.push({ pos, trigger, price: fill });
    }
  }
  return { closed };
}

/** Unrealized P&L + margin health for an open position at `price`. */
export function positionPnl(pos: Position, price: number) {
  const notional = pos.qty * pos.entry;
  const gross = pos.qty * (price > 0 ? price : pos.entry);
  const raw = pos.side === 'long' ? gross - notional : notional - gross;
  const pnl = raw - feeFor(gross).total;
  const pnlPct = pos.margin > 0 ? (pnl / pos.margin) * 100 : 0;
  // Margin level: equity in position vs margin, as %.
  const marginLevel = pos.margin > 0 ? ((pos.margin + pnl) / pos.margin) * 100 : 0;
  // Distance from current price to liquidation, as % of current price.
  const distToLiqPct =
    price > 0
      ? pos.side === 'long'
        ? ((price - pos.liqPrice) / price) * 100
        : ((pos.liqPrice - price) / price) * 100
      : 0;
  return { pnl, pnlPct, marginLevel, distToLiqPct };
}

/**
 * Auto-liquidate positions whose liquidation price was touched.
 * Mutates `s` (removes positions, adjusts cash, appends orders) and saves.
 * Returns the liquidated positions.
 */
export function checkLiquidations(
  s: PaperState,
  prices: Record<string, number>
): { liquidated: Position[] } {
  const liquidated: Position[] = [];
  for (const pos of [...s.positions]) {
    const px = prices[pos.symbol];
    if (!(px > 0)) continue;
    const hit = pos.side === 'long' ? px <= pos.liqPrice : px >= pos.liqPrice;
    if (hit) {
      const r = closePosition(s, pos.id, pos.liqPrice, 'liquidated');
      if (r.ok) liquidated.push(pos);
    }
  }
  return { liquidated };
}

// ---------- Options (paper only, simplified pricing) ----------

/**
 * Simplified option premium: intrinsic value + 2% of spot as time value.
 * This is a teaching simplification, NOT Black-Scholes. Labeled as such in UI.
 * 1 contract = 1 unit of the underlying symbol.
 */
export function optionPremium(kind: OptionKind, spot: number, strike: number): number {
  const intrinsic = kind === 'call' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  return intrinsic + 0.02 * spot;
}

export function optionIntrinsic(kind: OptionKind, spot: number, strike: number): number {
  return kind === 'call' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
}

export type BuyOptionResult = { ok: true; option: OptionPosition } | { ok: false; error: string };

/** Buy call/put contracts. Premium is debited from cash immediately. */
export function buyOption(
  s: PaperState,
  symbol: string,
  kind: OptionKind,
  strike: number,
  expiry: number,
  contracts: number,
  spot: number
): BuyOptionResult {
  if (!(spot > 0)) return { ok: false, error: 'Live price unavailable — try again in a moment.' };
  if (!(strike > 0)) return { ok: false, error: 'Pick a strike price.' };
  if (!(contracts > 0)) return { ok: false, error: 'Enter contracts above 0.' };
  if (!(expiry > Date.now())) return { ok: false, error: 'Expiry must be in the future.' };
  const premiumPerUnit = optionPremium(kind, spot, strike);
  const total = premiumPerUnit * contracts;
  if (total > s.cash + 1e-9) return { ok: false, error: 'Not enough demo cash for this premium.' };
  s.cash = Math.max(0, s.cash - total);
  const opt: OptionPosition = {
    id: uid(),
    time: Date.now(),
    symbol,
    kind,
    strike,
    expiry,
    contracts,
    premiumPerUnit,
    spotAtBuy: spot,
  };
  s.options.unshift(opt);
  const f = feeFor(total);
  s.orders.unshift({
    id: uid(),
    time: Date.now(),
    pair: `${symbol}USD`,
    symbol,
    side: 'buy',
    price: premiumPerUnit,
    qty: contracts,
    usd: total,
    fee: f.total,
    exchangeFee: f.exchangeFee,
    brokerFee: f.brokerFee,
    orderType: 'option',
    status: 'filled',
  });
  saveState(s);
  return { ok: true, option: opt };
}

/** Live value of an open option at `spot` (intrinsic only — time value decays to 0 at expiry). */
export function optionValue(opt: OptionPosition, spot: number): number {
  return optionIntrinsic(opt.kind, spot, opt.strike) * opt.contracts;
}

/**
 * Settle expired options at intrinsic value. Mutates `s` and saves.
 * Returns settled options with their payout.
 */
export function settleOptions(
  s: PaperState,
  prices: Record<string, number>
): { settled: { opt: OptionPosition; payout: number }[] } {
  const settled: { opt: OptionPosition; payout: number }[] = [];
  const now = Date.now();
  for (const opt of [...s.options]) {
    if (opt.expiry > now) continue;
    const px = prices[opt.symbol];
    if (!(px > 0)) continue;
    const payout = optionValue(opt, px);
    s.options = s.options.filter((o) => o.id !== opt.id);
    s.cash += payout;
    s.orders.unshift({
      id: uid(),
      time: now,
      pair: `${opt.symbol}USD`,
      symbol: opt.symbol,
      side: 'sell',
      price: payout / Math.max(1e-9, opt.contracts),
      qty: opt.contracts,
      usd: payout,
      fee: 0,
      exchangeFee: 0,
      brokerFee: 0,
      orderType: 'option',
      status: 'filled',
    });
    settled.push({ opt, payout });
  }
  if (settled.length) saveState(s);
  return { settled };
}

/** Total demo fees paid across all orders (exchange + broker). */
export function feesPaid(s: PaperState): { exchange: number; broker: number; total: number } {
  let exchange = 0;
  let broker = 0;
  for (const o of s.orders) {
    exchange += o.exchangeFee ?? o.fee ?? 0;
    broker += o.brokerFee ?? 0;
  }
  return { exchange, broker, total: exchange + broker };
}

/** Portfolio math given a map of live prices (symbol -> USD). Includes open positions. */
export function portfolioValue(s: PaperState, prices: Record<string, number>) {  let holdingsValue = 0;
  let costBasis = 0;
  const rows = Object.values(s.holdings).map((h) => {
    const px = prices[h.symbol] ?? 0;
    const value = h.qty * px;
    const cost = h.qty * h.avgCost;
    const pnl = value - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    holdingsValue += value;
    costBasis += cost;
    return { ...h, price: px, value, cost, pnl, pnlPct };
  });
  // Open leveraged positions: margin + unrealized P&L counts toward equity.
  let positionsMargin = 0;
  let positionsPnl = 0;
  const posRows = s.positions.map((pos) => {
    const px = prices[pos.symbol] ?? pos.entry;
    const m = positionPnl(pos, px);
    positionsMargin += pos.margin;
    positionsPnl += m.pnl;
    return { ...pos, price: px, ...m };
  });
  const equity = s.cash + holdingsValue + positionsMargin + positionsPnl;
  // Open options: current intrinsic value counts toward equity.
  let optionsValue = 0;
  const optRows = (s.options ?? []).map((opt) => {
    const px = prices[opt.symbol] ?? opt.spotAtBuy;
    const value = optionValue(opt, px);
    const paid = opt.premiumPerUnit * opt.contracts;
    const pnl = value - paid;
    optionsValue += value;
    return { ...opt, price: px, value, paid, pnl, expired: opt.expiry <= Date.now() };
  });
  const equityWithOptions = equity + optionsValue;
  const totalPnl = equityWithOptions - START_CASH;
  const totalPnlPct = (totalPnl / START_CASH) * 100;
  return { rows, posRows, optRows, cash: s.cash, holdingsValue, positionsMargin, positionsPnl, optionsValue, costBasis, equity: equityWithOptions, totalPnl, totalPnlPct };
}

/** Append an equity snapshot (cap history at ~500 points). */
export function recordSnapshot(s: PaperState, equity: number): PaperState {
  const last = s.snapshots[s.snapshots.length - 1];
  if (last && Math.abs(last.equity - equity) < 0.005 && Date.now() - last.t < 60_000) return s;
  s.snapshots.push({ t: Date.now(), equity });
  if (s.snapshots.length > 500) s.snapshots = s.snapshots.slice(-500);
  saveState(s);
  return s;
}

export const fmtUSD = (n: number, dp = 2) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: dp, maximumFractionDigits: dp });

export const fmtQty = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 });

/** % adverse move that wipes a leveraged position, e.g. 500x -> 0.2%. */
export const wipeoutPct = (leverage: number) => 100 / Math.max(1, leverage);
