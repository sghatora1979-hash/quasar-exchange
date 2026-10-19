// Quasar Strategy Hub — ONE shared registry used by Algo Lab, Tester, Copy,
// Grid Board, Auto Trading and the AI Bot. DEMO ONLY — no real money.
// Tax figures are DEMO ESTIMATES, never real tax advice.

import { STRATEGIES as JS_STRATEGIES } from './backtest';
import {
  loadState,
  portfolioValue,
  feesPaid,
  START_CASH,
  fmtUSD,
  type PaperState,
} from './quasar';

// ---------------------------------------------------------------------------
// Strategy registry
// ---------------------------------------------------------------------------

export type HubStrategy = {
  id: string;
  name: string;
  tag: string; // Trend | Reversal | Momentum | Grid | Scalping | ICT | Breakout | Structure
  desc: string;
  source: 'quasar' | 'pine';
  pineFile?: string;
  pineVersion?: string;
  risk: 1 | 2 | 3 | 4 | 5; // 1 = lowest risk … 5 = highest
  backtestable: boolean; // true when a JS engine exists in lib/backtest
  scalping: boolean; // usable in scalping / short-timeframe mode
};

/** The 10 built-in JS strategies (backtestable in Algo Lab + Tester). */
const JS_META: Record<string, { risk: 1 | 2 | 3 | 4 | 5; scalping: boolean; desc: string }> = {
  sma: { risk: 2, scalping: false, desc: 'Fast SMA crosses slow SMA — classic trend following.' },
  rsi: { risk: 2, scalping: true, desc: 'Buys oversold RSI, exits overbought — mean reversion.' },
  breakout: { risk: 4, scalping: false, desc: 'Buys new 20-day highs — momentum breakout.' },
  macd: { risk: 3, scalping: false, desc: 'MACD line crosses signal line — trend + momentum.' },
  bb: { risk: 2, scalping: true, desc: 'Bounces off the lower Bollinger band — range trading.' },
  supertrend: { risk: 3, scalping: true, desc: 'ATR trailing-stop trend flips — Sandeep\'s own Supertrend (10, 3).' },
  quasartrend: { risk: 3, scalping: false, desc: 'Supertrend + EMA-200 filter — Quasar\'s flagship trend signal.' },
  vwap: { risk: 3, scalping: true, desc: 'VWAP + bullish engulfing entry, swing-low stop, exit below VWAP. Skips sideways chop. Needs volume data.' },
  beardiamond: { risk: 4, scalping: false, desc: 'Bearish diamond-top reversal: SHORT on breakdown below the rising lower trendline, stop-loss above the pattern high, target = 100% of pattern height. Volume confirms the breakdown when volume data exists.' },
};

/** The 6 Pine Script strategies collected by Sandeep (library entries). */
export const PINE_STRATEGIES: HubStrategy[] = [
  {
    id: 'pine-trendcraft', name: 'TrendCraft ICT SwiftEdge', tag: 'ICT',
    desc: 'SMA(20) high/low bands + ICT Break-of-Structure / Market-Structure-Shift pivot breaks. Buy on bull BoS/MSS crossover + close above both SMAs.',
    source: 'pine', pineFile: '01-trendcraft-ict-swiftedge.pine', pineVersion: '6', risk: 3, backtestable: false, scalping: false,
  },
  {
    id: 'pine-qtrend', name: 'Q-Trend', tag: 'Trend',
    desc: 'Trend line = midpoint of highest/lowest close (200), stepped by ATR(14). Buy/Sell on cross ± epsilon. STRONG variant near range edges.',
    source: 'pine', pineFile: '02-q-trend.pine', pineVersion: '5', risk: 3, backtestable: false, scalping: false,
  },
  {
    id: 'pine-breakout', name: 'Breakout Targets [AlgoAlpha]', tag: 'Breakout',
    desc: 'Range box from pivots (99) on WMA/EMA crossunder. Breakout above top / below bottom with SL = ATR×5 and TP1/2/3 = risk × 0.5/1.0/1.5.',
    source: 'pine', pineFile: '03-breakout-targets-algoalpha.pine', pineVersion: '6', risk: 4, backtestable: false, scalping: false,
  },
  {
    id: 'pine-utbot', name: 'UT Bot Alerts', tag: 'Trend',
    desc: 'ATR trailing stop (Key 1 × ATR 10). Buy when close crosses above the stop, sell on the mirror. Optional Heikin Ashi source.',
    source: 'pine', pineFile: '04-ut-bot-alerts.pine', pineVersion: '4', risk: 3, backtestable: false, scalping: true,
  },
  {
    id: 'pine-smc', name: 'Smart Money Concepts [LuxAlgo]', tag: 'Structure',
    desc: 'Swing (50) + internal (5) BOS/CHoCH breaks, order blocks, EQH/EQL, FVG, premium/discount zones. Signals = bullish/bearish BOS/CHoCH close-crosses.',
    source: 'pine', pineFile: '05-smart-money-concepts-luxalgo.pine', pineVersion: '5', risk: 4, backtestable: false, scalping: false,
  },
  {
    id: 'pine-supertrend', name: 'Supertrend (Sandeep)', tag: 'Trend',
    desc: 'Sandeep\'s own Supertrend — ATR bands, trend flips on band breaks. Buy on flip to uptrend, Sell on flip to downtrend.',
    source: 'pine', pineFile: '06-supertrend-sandeep.pine', pineVersion: '4', risk: 3, backtestable: false, scalping: true,
  },
];

export const HUB_STRATEGIES: HubStrategy[] = [
  ...JS_STRATEGIES.map((s) => ({
    id: s.id,
    name: s.name,
    tag: s.tag,
    desc: JS_META[s.id]?.desc ?? s.desc,
    source: 'quasar' as const,
    risk: JS_META[s.id]?.risk ?? 3,
    backtestable: true,
    scalping: JS_META[s.id]?.scalping ?? false,
  })),
  ...PINE_STRATEGIES,
];

export const hubStrategyById = (id: string) => HUB_STRATEGIES.find((s) => s.id === id);

// ---------------------------------------------------------------------------
// Country tax config — DEMO ESTIMATES on fees only. Not tax advice.
// ---------------------------------------------------------------------------

export type TaxConfig = {
  code: string; // ISO country
  label: string;
  rate: number; // fraction of FEES charged as tax estimate
  note: string;
};

export const TAX_CONFIGS: TaxConfig[] = [
  { code: 'IN', label: 'India — GST 18% on fees', rate: 0.18, note: 'Demo estimate: 18% GST on brokerage/fees (SEBI-style). Not real tax advice.' },
  { code: 'CA', label: 'Canada — GST 5% on fees', rate: 0.05, note: 'Demo estimate: 5% federal GST on fees. PST/HST varies by province — not included.' },
  { code: 'US', label: 'USA — no tax on fees (demo)', rate: 0, note: 'Demo estimate: no sales tax on trading fees in most US states.' },
  { code: 'GB', label: 'UK — VAT 20% on fees', rate: 0.2, note: 'Demo estimate: 20% VAT on fees. Not real tax advice.' },
  { code: 'AU', label: 'Australia — GST 10% on fees', rate: 0.1, note: 'Demo estimate: 10% GST on fees. Not real tax advice.' },
  { code: 'AE', label: 'UAE — VAT 5% on fees', rate: 0.05, note: 'Demo estimate: 5% VAT on fees. Not real tax advice.' },
];

export const taxConfigByCode = (code: string) => TAX_CONFIGS.find((t) => t.code === code) ?? TAX_CONFIGS[1];

/** Tax estimate on a fee amount for a country. Returns { tax, note }. */
export function taxOnFees(fees: number, countryCode: string) {
  const cfg = taxConfigByCode(countryCode);
  return { tax: fees * cfg.rate, cfg };
}

// ---------------------------------------------------------------------------
// Trading ledger — full hisaab from the real paper-trading state.
// ---------------------------------------------------------------------------

export type Ledger = {
  equity: number;
  cash: number;
  totalPnl: number; // equity - START_CASH (fees already inside)
  realizedPnl: number;
  unrealizedPnl: number;
  grossPnl: number; // P&L before fees
  fees: { exchange: number; broker: number; total: number };
  tax: number;
  taxCfg: TaxConfig;
  netPnl: number; // totalPnl - tax estimate
  trades: number;
  daily: { day: string; trades: number; fees: number; equityEnd: number }[];
};

/** Build the ledger. `state` defaults to the browser's current paper state. */
export function buildLedger(s: PaperState | null, countryCode = 'CA', prices: Record<string, number> = {}): Ledger {
  const st = s ?? loadState();
  const pv = portfolioValue(st, prices);
  const fees = feesPaid(st);
  const { tax, cfg } = taxOnFees(fees.total, countryCode);
  const unrealized = pv.rows.reduce((a, r) => a + r.pnl, 0) + pv.positionsPnl +
    pv.optRows.reduce((a, r) => a + r.pnl, 0);
  const realized = pv.totalPnl - unrealized;
  // Daily: fees + trades per day, equity from snapshots (first/last of day).
  const byDay = new Map<string, { trades: number; fees: number; equityEnd: number }>();
  for (const o of st.orders) {
    const day = new Date(o.time).toISOString().slice(0, 10);
    const d = byDay.get(day) ?? { trades: 0, fees: 0, equityEnd: 0 };
    d.trades += 1;
    d.fees += o.fee;
    byDay.set(day, d);
  }
  const snaps = [...st.snapshots].sort((a, b) => a.t - b.t);
  for (const sn of snaps) {
    const day = new Date(sn.t).toISOString().slice(0, 10);
    const d = byDay.get(day) ?? { trades: 0, fees: 0, equityEnd: 0 };
    d.equityEnd = sn.equity;
    byDay.set(day, d);
  }
  const daily = Array.from(byDay.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 14)
    .map(([day, d]) => ({ day, ...d }));
  return {
    equity: pv.equity,
    cash: pv.cash,
    totalPnl: pv.totalPnl,
    realizedPnl: realized,
    unrealizedPnl: unrealized,
    grossPnl: pv.totalPnl + fees.total,
    fees,
    tax,
    taxCfg: cfg,
    netPnl: pv.totalPnl - tax,
    trades: st.orders.length,
    daily,
  };
}

/** One-line plain-text ledger summary for the AI Bot. */
export function ledgerSummaryText(l: Ledger): string {
  const m = (n: number) => fmtUSD(n);
  const lines = [
    `**Your demo ledger** (from your real trades in this browser)`,
    ``,
    `• **Equity:** ${m(l.equity)} · **Available cash:** ${m(l.cash)}`,
    `• **Total P&L:** ${m(l.totalPnl)} (${l.totalPnl >= 0 ? 'profit' : 'loss'})`,
    `• **Realized P&L:** ${m(l.realizedPnl)} · **Unrealized P&L:** ${m(l.unrealizedPnl)}`,
    `• **Gross P&L (before fees):** ${m(l.grossPnl)}`,
    `• **Commission + fees:** ${m(l.fees.total)} — exchange ${m(l.fees.exchange)} + broker ${m(l.fees.broker)}`,
    `• **Tax estimate (${l.taxCfg.label}):** ${m(l.tax)} — _demo estimate, not real tax_`,
    `• **Net P&L (after fees + tax est.):** ${m(l.netPnl)}`,
    `• **Trades:** ${l.trades} · **Starting balance:** ${fmtUSD(START_CASH)}`,
  ];
  return lines.join('\n');
}

export { fmtUSD };
