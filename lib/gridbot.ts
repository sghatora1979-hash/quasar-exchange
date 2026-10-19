// Quasar grid bot — PAPER-TRADING DEMO ONLY. Simulates a classic spot grid
// strategy against live prices. All state lives in the browser's
// localStorage under GRIDBOT_KEY. No real money, no real orders.

const GRIDBOT_KEY = 'quasar-gridbot-v1';
const FEE_RATE = 0.001; // 0.1% demo fee, same as spot paper trading

export type GridBotConfig = {
  symbol: string; // e.g. BTC
  kraken: string; // e.g. XBTUSD
  upper: number;
  lower: number;
  grids: number; // 5..50
  investment: number; // USD
};

export type GridFill = {
  id: string;
  time: number;
  side: 'buy' | 'sell';
  price: number;
  qty: number;
  usd: number; // gross USD value
  fee: number;
};

export type GridLevel = {
  price: number;
  qty: number; // coins currently held from buying at this level
};

export type GridBotState = {
  running: boolean;
  config: GridBotConfig;
  lines: number[];
  usdPerGrid: number;
  levels: GridLevel[];
  cashLocked: number; // USD still available for grid buys
  realizedPnl: number;
  roundTrips: number;
  fills: GridFill[];
  equityCurve: { t: number; equity: number }[];
  lastPrice: number | null;
  startedAt: number | null;
};

const uid = () => `gb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Evenly spaced grid lines from lower to upper (inclusive). */
export function gridLines(lower: number, upper: number, grids: number): number[] {
  const step = (upper - lower) / grids;
  const out: number[] = [];
  for (let i = 0; i <= grids; i++) out.push(lower + step * i);
  return out;
}

export type BotSetupError = string;

export function validateConfig(c: GridBotConfig): BotSetupError | null {
  if (!(c.lower > 0) || !(c.upper > 0)) return 'Enter upper and lower prices above $0.';
  if (c.upper <= c.lower) return 'Upper price must be above lower price.';
  if (!Number.isInteger(c.grids) || c.grids < 5 || c.grids > 50)
    return 'Grid count must be a whole number between 5 and 50.';
  if (!(c.investment > 0)) return 'Investment must be above $0.';
  if (!c.symbol || !c.kraken) return 'Pick a trading pair.';
  return null;
}

export function createBot(config: GridBotConfig): GridBotState {
  const lines = gridLines(config.lower, config.upper, config.grids);
  return {
    running: true,
    config,
    lines,
    usdPerGrid: config.investment / config.grids,
    levels: lines.map((price) => ({ price, qty: 0 })),
    cashLocked: config.investment,
    realizedPnl: 0,
    roundTrips: 0,
    fills: [],
    equityCurve: [],
    lastPrice: null,
    startedAt: Date.now(),
  };
}

/**
 * Feed one live price tick. Simulates grid fills:
 * - price crosses a line downward  -> BUY usdPerGrid at that line (if cash allows)
 * - price crosses a line upward    -> SELL coins bought at the nearest lower
 *   level that still holds coins (if any)
 * Returns the fills that happened on this tick.
 */
export function tickBot(s: GridBotState, price: number): GridFill[] {
  if (!s.running || !(price > 0)) return [];
  const fills: GridFill[] = [];
  const prev = s.lastPrice;
  s.lastPrice = price;
  if (prev === null || prev === price) {
    recordEquity(s, price);
    return fills;
  }

  for (let i = 0; i < s.lines.length; i++) {
    const L = s.lines[i];
    if (prev > L && price <= L) {
      // Crossed down -> buy one grid at L
      if (s.cashLocked >= s.usdPerGrid) {
        const fee = s.usdPerGrid * FEE_RATE;
        const qty = (s.usdPerGrid - fee) / L;
        s.levels[i].qty += qty;
        s.cashLocked -= s.usdPerGrid;
        fills.push({ id: uid(), time: Date.now(), side: 'buy', price: L, qty, usd: s.usdPerGrid, fee });
      }
    } else if (prev < L && price >= L) {
      // Crossed up -> sell coins from the nearest lower level holding coins
      let lvl = -1;
      for (let j = i - 1; j >= 0; j--) {
        if (s.levels[j].qty > 0) {
          lvl = j;
          break;
        }
      }
      if (lvl >= 0) {
        const q = s.levels[lvl].qty;
        const gross = q * L;
        const fee = gross * FEE_RATE;
        const cost = q * s.levels[lvl].price;
        s.realizedPnl += gross - fee - cost;
        s.cashLocked += gross - fee;
        s.levels[lvl].qty = 0;
        s.roundTrips += 1;
        fills.push({ id: uid(), time: Date.now(), side: 'sell', price: L, qty: q, usd: gross, fee });
      }
    }
  }

  if (fills.length) {
    s.fills = [...fills, ...s.fills].slice(0, 200);
  }
  recordEquity(s, price);
  return fills;
}

function recordEquity(s: GridBotState, price: number) {
  const st = botStats(s, price);
  const last = s.equityCurve[s.equityCurve.length - 1];
  if (!last || Date.now() - last.t > 5000) {
    s.equityCurve = [...s.equityCurve, { t: Date.now(), equity: st.equity }].slice(-120);
  }
}

export type GridBotStats = {
  positionQty: number;
  positionValue: number;
  equity: number;
  unrealizedPnl: number;
  totalPnl: number;
  activeBuys: number; // grid lines below price with cash to buy
  activeSells: number; // levels holding coins
};

export function botStats(s: GridBotState, price: number | null): GridBotStats {
  const px = price ?? s.lastPrice ?? 0;
  let positionQty = 0;
  for (const l of s.levels) positionQty += l.qty;
  const positionValue = positionQty * px;
  const equity = s.cashLocked + positionValue;
  const unrealizedPnl = equity - s.config.investment - s.realizedPnl;
  const activeSells = s.levels.filter((l) => l.qty > 0).length;
  const activeBuys = s.lines.filter((L) => L < px && s.cashLocked >= s.usdPerGrid).length;
  return {
    positionQty,
    positionValue,
    equity,
    unrealizedPnl,
    totalPnl: s.realizedPnl + unrealizedPnl,
    activeBuys,
    activeSells,
  };
}

// ---------- persistence ----------

export function loadBot(): GridBotState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(GRIDBOT_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GridBotState;
    if (!s.config || !Array.isArray(s.lines)) return null;
    s.running = false; // never resume silently after a reload
    return s;
  } catch {
    return null;
  }
}

export function saveBot(s: GridBotState | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (s) window.localStorage.setItem(GRIDBOT_KEY, JSON.stringify(s));
    else window.localStorage.removeItem(GRIDBOT_KEY);
  } catch {
    /* storage blocked — demo continues in memory */
  }
}
