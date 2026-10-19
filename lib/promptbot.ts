// Quasar "Prompt Bot" — plain-English strategy parser + watcher.
// DEMO-GRADE pattern matching (honest limits: understands common patterns;
// connect an AI key at launch for free-text understanding). Never claims NLP.
// All trades go through the paper engine (lib/quasar.ts). No real money.

import { PAIRS, pairBySymbol } from './pairs';

export type TriggerType =
  | 'price_drop_pct'
  | 'price_rise_pct'
  | 'price_below'
  | 'price_above'
  | 'rsi_below'
  | 'rsi_above'
  | 'take_profit_pct'
  | 'stop_loss_pct';

export type Side = 'buy' | 'sell';

export type PromptRuleDraft = {
  side: Side;
  symbol: string;
  kraken: string;
  amountUsd: number | null; // null = all (sell-all)
  trigger: { type: TriggerType; value: number };
  summary: string;
  warnings: string[];
  confidence: number; // 0..1
};

export type ParseResult =
  | { ok: true; draft: PromptRuleDraft }
  | { ok: false; reason: string; suggestions: string[] };

export type PromptBot = PromptRuleDraft & {
  id: string;
  status: 'watching' | 'triggered';
  createdAt: number;
  baselinePrice: number | null;
  triggerPrice: number | null;
  repeat: boolean;
  note: string | null; // e.g. fill / error info
  pnlUsd: number | null; // realized P&L at trigger (sell bots)
};

const BOT_KEY = 'quasar-promptbots-v1';
const uid = () => `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Common coin name aliases -> symbol
const ALIASES: Record<string, string> = {
  ethereum: 'ETH',
  solana: 'SOL',
  dogecoin: 'DOGE',
  cardano: 'ADA',
  ripple: 'XRP',
  xrp: 'XRP',
  litecoin: 'LTC',
  avalanche: 'AVAX',
  chainlink: 'LINK',
  polkadot: 'DOT',
  polygon: 'POL',
  cosmos: 'ATOM',
  uniswap: 'UNI',
  shiba: 'SHIB',
  pepe: 'PEPE',
  bonk: 'BONK',
  tron: 'TRX',
  stellar: 'XLM',
  filecoin: 'FIL',
  arbitrum: 'ARB',
  optimism: 'OP',
  aptos: 'APT',
  sui: 'SUI',
  near: 'NEAR',
  injective: 'INJ',
  aave: 'AAVE',
  tether: 'USDT',
};

function detectSymbol(text: string): { symbol: string; kraken: string; viaAlias: boolean } | null {
  const lower = ` ${text.toLowerCase()} `;
  // Direct symbol match against pairs list (word-boundary-ish)
  for (const p of PAIRS) {
    const re = new RegExp(`\\b${p.symbol.toLowerCase()}\\b`, 'i');
    if (re.test(lower)) return { symbol: p.symbol, kraken: p.kraken, viaAlias: false };
  }
  for (const [alias, sym] of Object.entries(ALIASES)) {
    if (lower.includes(alias)) {
      const p = pairBySymbol(sym);
      if (p) return { symbol: p.symbol, kraken: p.kraken, viaAlias: true };
    }
  }
  return null;
}

function detectSide(text: string): Side | null {
  const t = text.toLowerCase();
  if (/stop[\s-]*loss/.test(t)) return 'sell';
  if (/\btake[\s-]*profit\b/.test(t)) return 'sell';
  if (/\bbuy\b/.test(t) && /\bsell\b/.test(t)) return null; // ambiguous
  if (/\bbuy\b/.test(t)) return 'buy';
  if (/\bsell\b/.test(t)) return 'sell';
  return null;
}

function detectAmount(text: string, side: Side): { amountUsd: number | null; given: boolean } {
  const t = text.toLowerCase();
  if (/\ball\b/.test(t)) return { amountUsd: null, given: true };
  const m = t.match(/\$\s?([\d,]+(?:\.\d+)?)/);
  if (m) return { amountUsd: parseFloat(m[1].replace(/,/g, '')), given: true };
  // default for buys so the rule is still usable
  if (side === 'buy') return { amountUsd: 100, given: false };
  return { amountUsd: null, given: false };
}

function detectTrigger(text: string): { type: TriggerType; value: number } | null {
  const t = text.toLowerCase().replace(/,/g, '');
  let m: RegExpMatchArray | null;

  // RSI first (so "below 30" in an RSI sentence isn't read as price_below)
  m = t.match(/rsi[^\d]{0,12}below\s*(\d+(?:\.\d+)?)/);
  if (m) return { type: 'rsi_below', value: parseFloat(m[1]) };
  m = t.match(/rsi[^\d]{0,12}above\s*(\d+(?:\.\d+)?)/);
  if (m) return { type: 'rsi_above', value: parseFloat(m[1]) };

  m = t.match(/stop[\s-]*loss[^\d]{0,20}(\d+(?:\.\d+)?)\s*%/);
  if (m) return { type: 'stop_loss_pct', value: parseFloat(m[1]) };
  m = t.match(/(?:take[\s-]*profit|profit)[^\d]{0,20}(\d+(?:\.\d+)?)\s*%/);
  if (m) return { type: 'take_profit_pct', value: parseFloat(m[1]) };

  m = t.match(/(?:drops?|falls?|dips?)[^\d]{0,12}(\d+(?:\.\d+)?)\s*%/);
  if (m) return { type: 'price_drop_pct', value: parseFloat(m[1]) };
  m = t.match(/(?:rises?|goes?\s*up|jumps?|pumps?)[^\d]{0,12}(\d+(?:\.\d+)?)\s*%/);
  if (m) return { type: 'price_rise_pct', value: parseFloat(m[1]) };

  m = t.match(/(?:below|under|less than)\s*\$?\s*(\d+(?:\.\d+)?)/);
  if (m) return { type: 'price_below', value: parseFloat(m[1]) };
  m = t.match(/(?:above|over|more than|exceeds?)[^\d$]{0,12}\$?\s*(\d+(?:\.\d+)?)/);
  if (m) return { type: 'price_above', value: parseFloat(m[1]) };

  return null;
}

const TRIGGER_WORDS: Record<TriggerType, (v: number) => string> = {
  price_drop_pct: (v) => `price drops ${v}%`,
  price_rise_pct: (v) => `price rises ${v}%`,
  price_below: (v) => `price falls below $${v.toLocaleString()}`,
  price_above: (v) => `price goes above $${v.toLocaleString()}`,
  rsi_below: (v) => `RSI(14) drops below ${v}`,
  rsi_above: (v) => `RSI(14) rises above ${v}`,
  take_profit_pct: (v) => `profit reaches ${v}%`,
  stop_loss_pct: (v) => `loss reaches ${v}% (stop loss)`,
};

/** Parse a plain-English strategy into a rule draft. */
export function parsePrompt(text: string): ParseResult {
  const input = text.trim();
  if (input.length < 8) {
    return {
      ok: false,
      reason: 'That looks too short — describe the coin, the action, and the trigger.',
      suggestions: ['Buy $100 ETH when price drops 3%', 'Sell all ETH when profit reaches 5%'],
    };
  }

  const side = detectSide(input);
  if (!side) {
    return {
      ok: false,
      reason: 'I could not tell whether you want to BUY or SELL.',
      suggestions: ['Buy $100 ETH when price drops 3%', 'Sell all ETH when profit reaches 5%'],
    };
  }
  const coin = detectSymbol(input);
  if (!coin) {
    return {
      ok: false,
      reason: 'I could not find a coin name (e.g. ETH, SOL, DOGE).',
      suggestions: ['Buy $100 ETH when price drops 3%', 'Buy SOL when RSI goes below 30'],
    };
  }
  const trigger = detectTrigger(input);
  if (!trigger) {
    return {
      ok: false,
      reason: 'I could not find a trigger (e.g. "drops 3%", "below $90000", "RSI below 30").',
      suggestions: [
        'Buy $100 ETH when price drops 3%',
        'Buy ETH when price goes above $4000',
        'Buy SOL when RSI goes below 30',
      ],
    };
  }
  const { amountUsd, given: amountGiven } = detectAmount(input, side);

  const warnings: string[] = [];
  let confidence = 0.95;
  if (coin.viaAlias) {
    warnings.push(`Matched "${coin.symbol}" by coin name.`);
    confidence -= 0.05;
  }
  if (!amountGiven && side === 'buy') {
    warnings.push('No amount given — will use $100 demo.');
    confidence -= 0.15;
  }
  if (!amountGiven && side === 'sell' && !/\ball\b/i.test(input)) {
    warnings.push('No amount given — will sell your full holding.');
    confidence -= 0.1;
  }

  const amt = amountUsd === null ? 'all' : `$${amountUsd.toLocaleString()}`;
  const summary = `${side === 'buy' ? 'Buy' : 'Sell'} ${amt} ${coin.symbol} when ${TRIGGER_WORDS[trigger.type](trigger.value)}`;

  return {
    ok: true,
    draft: {
      side,
      symbol: coin.symbol,
      kraken: coin.kraken,
      amountUsd,
      trigger,
      summary,
      warnings,
      confidence: Math.max(0.4, Math.min(1, confidence)),
    },
  };
}

/** Classic RSI (Wilder's smoothing) over closes. Returns null if not enough data. */
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  if (loss === 0) return 100;
  const rs = gain / loss;
  return 100 - 100 / (1 + rs);
}

export type EvalContext = {
  price: number | null;
  baseline: number | null; // price when the bot was created
  rsi14: number | null;
  avgCost: number | null; // portfolio avg cost for the symbol (for profit/loss triggers)
  holdingQty: number; // portfolio qty held
};

/** Should this bot's trigger fire given the current context? */
export function shouldTrigger(bot: PromptBot, ctx: EvalContext): boolean {
  const { price } = ctx;
  if (price === null || !(price > 0)) return false;
  const { type, value } = bot.trigger;
  switch (type) {
    case 'price_drop_pct':
      return ctx.baseline !== null && price <= ctx.baseline * (1 - value / 100);
    case 'price_rise_pct':
      return ctx.baseline !== null && price >= ctx.baseline * (1 + value / 100);
    case 'price_below':
      return price <= value;
    case 'price_above':
      return price >= value;
    case 'rsi_below':
      return ctx.rsi14 !== null && ctx.rsi14 <= value;
    case 'rsi_above':
      return ctx.rsi14 !== null && ctx.rsi14 >= value;
    case 'take_profit_pct':
      return ctx.avgCost !== null && ctx.avgCost > 0 && price >= ctx.avgCost * (1 + value / 100);
    case 'stop_loss_pct':
      return ctx.avgCost !== null && ctx.avgCost > 0 && price <= ctx.avgCost * (1 - value / 100);
    default:
      return false;
  }
}

export function makePromptBot(draft: PromptRuleDraft, baselinePrice: number | null, repeat: boolean): PromptBot {
  return {
    ...draft,
    id: uid(),
    status: 'watching',
    createdAt: Date.now(),
    baselinePrice,
    triggerPrice: null,
    repeat,
    note: null,
    pnlUsd: null,
  };
}

// ---------- persistence ----------

export function loadPromptBots(): PromptBot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BOT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as PromptBot[];
    return Array.isArray(arr) ? arr.filter((b) => b && b.id && b.symbol) : [];
  } catch {
    return [];
  }
}

export function savePromptBots(bots: PromptBot[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BOT_KEY, JSON.stringify(bots));
  } catch {
    /* storage blocked — demo continues in memory */
  }
}

const NOTIFY_KEY = 'quasar-notify-v1';

export function getNotifyList(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(NOTIFY_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addNotify(topic: string): string[] {
  const list = getNotifyList();
  if (!list.includes(topic)) {
    const next = [...list, topic];
    try {
      window.localStorage.setItem(NOTIFY_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    return next;
  }
  return list;
}
