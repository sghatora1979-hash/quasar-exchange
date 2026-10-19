// Quasar AI Bot brain — keyword intent parsing + pre-written trading education.
// No external API. Honest limits: pattern matching, not NLP. Demo only, not financial advice.

import { PAIRS } from './pairs';
import { STOCKS } from './stocks';
import { FOREX_PAIRS } from './forex';

export type BotSymbol = { label: string; yahoo: string; kind: 'crypto' | 'stock' | 'forex' };

const CRYPTO_ALIASES: Record<string, string> = {
  ethereum: 'ETH', eth: 'ETH', solana: 'SOL', sol: 'SOL',
  dogecoin: 'DOGE', doge: 'DOGE', cardano: 'ADA', ada: 'ADA', ripple: 'XRP', xrp: 'XRP',
  litecoin: 'LTC', ltc: 'LTC', avalanche: 'AVAX', avax: 'AVAX', chainlink: 'LINK', link: 'LINK',
  polkadot: 'DOT', dot: 'DOT', polygon: 'MATIC', matic: 'MATIC', tron: 'TRX', trx: 'TRX',
  uniswap: 'UNI', uni: 'UNI', cosmos: 'ATOM', atom: 'ATOM', near: 'NEAR',
  arbitrum: 'ARB', arb: 'ARB', optimism: 'OP', op: 'OP', pepe: 'PEPE',
  shiba: 'SHIB', 'shiba inu': 'SHIB', render: 'RENDER', injective: 'INJ', inj: 'INJ',
  sui: 'SUI', aptos: 'APT', apt: 'APT', filecoin: 'FIL', fil: 'FIL',
};

/** Resolve a user mention to a Yahoo symbol for /api/history. Null if unknown. */
export function resolveBotSymbol(text: string): BotSymbol | null {
  const t = ` ${text.toLowerCase()} `;
  // Crypto aliases first
  for (const [alias, sym] of Object.entries(CRYPTO_ALIASES)) {
    if (t.includes(alias)) {
      const p = PAIRS.find((x) => x.symbol === sym);
      if (!p || p.native) continue;
      return { label: `${p.symbol}/USD`, yahoo: `${p.symbol}-USD`, kind: 'crypto' };
    }
  }
  // Exact crypto symbols
  for (const p of PAIRS) {
    if (p.native) continue;
    const re = new RegExp(`\\b${p.symbol.toLowerCase()}\\b`);
    if (re.test(t)) return { label: `${p.symbol}/USD`, yahoo: `${p.symbol}-USD`, kind: 'crypto' };
  }
  // Stocks by symbol or name
  for (const s of STOCKS) {
    const re = new RegExp(`\\b${s.symbol.toLowerCase()}\\b`);
    if (re.test(t) || t.includes(s.name.toLowerCase())) {
      return { label: `${s.symbol} (${s.exchange})`, yahoo: s.yahoo, kind: 'stock' };
    }
  }
  // Forex by pair code
  for (const f of FOREX_PAIRS) {
    if (t.includes(f.pair.toLowerCase()) || t.includes(f.symbol.toLowerCase())) {
      return { label: f.pair, yahoo: `${f.pair}=X`, kind: 'forex' };
    }
  }
  if (/\bqsr\b/.test(t)) return { label: 'QSR/USD', yahoo: '', kind: 'crypto' }; // native, no history
  return null;
}

export type BotIntent =
  | { type: 'analyze'; symbol: BotSymbol }
  | { type: 'teach'; topic: string }
  | { type: 'strategy'; regime: 'trending' | 'sideways' | 'general' }
  | { type: 'wallet'; query: 'profit' | 'balance' | 'commission' | 'tax' | 'trades' | 'ledger' | 'strategies' }
  | { type: 'news' }
  | { type: 'help' }
  | { type: 'fallback' };

const ANALYZE_RE = /(analy[sz]e|signal|trend|outlook|bullish|bearish|should i buy|price prediction|forecast)/;
const STRATEGY_RE = /(best strategy|which strategy|strategy for|sideways|choppy|ranging market|trending market)/;

const WALLET_RE: [RegExp, 'profit' | 'balance' | 'commission' | 'tax' | 'trades' | 'ledger' | 'strategies'][] = [
  [/(my|mera|mere|meri|mujhe).*(profit|kamai|earn|p&l|pnl|gain|loss)|kitn[ai].*(profit|kamai)|how much.*(profit|earn|made)|\bkamai\b/, 'profit'],
  [/(my|mera|mere|meri).*(balance|wallet|paisa|paise|cash|fund)|wallet.*(balance|kitna)|how much.*(balance|cash)/, 'balance'],
  [/(my|mera|mere).*commission|commission.*(kat|cut|charge|deduct|kahan|where)|where.*commission/, 'commission'],
  [/\b(tax|gst|vat)\b/, 'tax'],
  [/(my|mera|mere).*(trade|order|position|holding)/, 'trades'],
  [/(ledger|hisaab|hisab|full.*(report|summary)|poora.*hisaab)/, 'ledger'],
  [/(my|available|all).*(strateg|strategies)|strategy.*(list|library|hub)/, 'strategies'],
];

const NEWS_RE = /(news|headlines|what'?s (happening|going on)|market (today|now|update)|aaj (market|bazaar)|kya (chal|ho) raha|bazaar.*(haal|kaisa))/;

export function parseIntent(text: string): BotIntent {
  const t = text.toLowerCase();
  if (/(help|what can you do|commands)/.test(t)) return { type: 'help' };
  // Personal wallet/ledger questions FIRST — they read YOUR real demo data.
  for (const [re, query] of WALLET_RE) if (re.test(t)) return { type: 'wallet', query };
  // Market news / what's going on — answered from live web headlines.
  if (NEWS_RE.test(t)) return { type: 'news' };
  const sym = resolveBotSymbol(text);
  if (sym && ANALYZE_RE.test(t)) return { type: 'analyze', symbol: sym };
  // "Analyze ETH" without trigger words
  if (sym && /^(analy[sz]e|check|signal)\b/.test(t.trim())) return { type: 'analyze', symbol: sym };
  if (STRATEGY_RE.test(t)) {
    const regime = /sideways|choppy|ranging/.test(t) ? 'sideways' : /trend/.test(t) ? 'trending' : 'general';
    return { type: 'strategy', regime };
  }
  const topic = matchTopic(t);
  if (topic) return { type: 'teach', topic };
  if (sym) return { type: 'analyze', symbol: sym }; // bare symbol mention → analyze
  return { type: 'fallback' };
}

function matchTopic(t: string): string | null {
  const topics: [RegExp, string][] = [
    [/\brsi\b/, 'rsi'],
    [/quasar trend/, 'quasartrend'],
    [/supertrend/, 'supertrend'],
    [/leverage|margin/, 'leverage'],
    [/stop[\s-]?loss/, 'stoploss'],
    [/take[\s-]?profit/, 'takeprofit'],
    [/liquidat/, 'liquidation'],
    [/macd/, 'macd'],
    [/bollinger/, 'bollinger'],
    [/moving average|\bsma\b|\bema\b/, 'ma'],
    [/options?/, 'options'],
    [/intraday/, 'intraday'],
    [/delivery/, 'delivery'],
    [/(broker|exchange).*(fee|commission)|commission|fees/, 'fees'],
    [/copy trad/, 'copytrading'],
    [/algo/, 'algotrading'],
    [/backtest/, 'backtest'],
    [/candlestick|candle/, 'candles'],
    [/support|resistance/, 'sr'],
    [/market (open|hours)|trading hours/, 'hours'],
    [/qsr|quasar coin/, 'qsr'],
    [/diamond/, 'diamond'],
    [/harmonic|gartley|butterfly|\bcrab\b|fibonacci/, 'harmonic'],
    [/\bbat\b/, 'harmonic'],
    [/demo|paper trad|refill/, 'demo'],
    [/risk/, 'risk'],
  ];
  for (const [re, topic] of topics) if (re.test(t)) return topic;
  return null;
}

const DISCLAIMER = '\n\n_Demo only — not financial advice. Practice here, never risk real money you can\'t afford to lose._';

export const TEACH: Record<string, string> = {
  rsi: `**RSI (Relative Strength Index)** — momentum oscillator, 0 to 100.\n\n• Below **30** = oversold (selling may be exhausted — bounces often start here)\n• Above **70** = overbought (buying may be exhausted — pullbacks often start here)\n• Between = neutral momentum\n\n⚠️ Honest catch: in a strong trend, RSI can stay overbought/oversold for a long time. Never trade on RSI alone — combine it with trend (Supertrend, moving averages) and always use a stop-loss.${DISCLAIMER}`,
  supertrend: `**Supertrend** — a popular trend-following indicator (ATR-based).\n\n• Price **above** the line + line is green/below = **uptrend** 🟢\n• Price **below** the line + line is red/above = **downtrend** 🔴\n• It flips only when price closes through it — that's your trend-change signal.\n\n⚠️ Honest catch: it follows trends beautifully but **whipsaws in sideways markets** (lots of false flips). Check ADX: above ~20 = trending (Supertrend shines), below = choppy (be careful).${DISCLAIMER}`,
  quasartrend: `**Quasar Trend** — Quasar's own trend indicator.\n\n• **Supertrend(10, 3)** sets the line, an **EMA-200 filter** confirms it\n• Line turns 🟢 green in uptrend, 🔴 red in downtrend\n• **BUY** label = trend flipped up · **SELL** = flipped down\n• **STRONG** label = the flip candle was extra large (>2× ATR) — high-momentum move\n\n⚠️ Honest catch: like all trend systems, it shines in trending markets and **whipsaws sideways** — that's the price of catching big trends. Demo only, not financial advice.${DISCLAIMER}`,
  leverage: `**Leverage** multiplies both gains AND losses.\n\n• **5x**: a 20% move against you wipes the margin\n• **10x**: a 10% move wipes it\n• **100x**: a 1% move wipes it\n• **1000x**: a **0.1%** move wipes it — normal market noise!\n\nThe app shows your **liquidation price** before you confirm — that price = total loss of margin. In this demo you can try 1000x safely and watch how fast it dies. That's the lesson: learn it HERE, not with real money.${DISCLAIMER}`,
  stoploss: `**Stop-loss (SL)** — your safety net. You set a price; if the market touches it, your position closes automatically to cap the loss.\n\n• For a LONG: SL goes **below** entry\n• For a SHORT: SL goes **above** entry\n• Rule of thumb: risk only 1–2% of capital per trade\n\nOn Quasar's trade ticket you can arm SL + take-profit together — it's called a **bracket**. The demo engine closes you at the SL price when touched.${DISCLAIMER}`,
  takeprofit: `**Take-profit (TP)** — locks in gains automatically. Set a target; when price touches it, the position closes and banks the profit.\n\n• For a LONG: TP goes **above** entry\n• For a SHORT: TP goes **below** entry\n\nPros set TP **before** entering — it removes emotion ("just a little more…"). Pair it with a stop-loss and you have a complete plan: max loss known, target known.${DISCLAIMER}`,
  liquidation: `**Liquidation** — when a leveraged position's loss eats the whole margin, the position is force-closed. You lose the margin, nothing more (in this demo).\n\n• Happens at the **liquidation price** shown on the ticket\n• Higher leverage = liquidation price sits **closer** to entry\n• At 1000x, a 0.1% wiggle liquidates you\n\nThis is the #1 way real traders blow accounts. The demo lets you feel it with play money.${DISCLAIMER}`,
  macd: `**MACD (12, 26, 9)** — trend-momentum indicator.\n\n• **MACD line** = EMA12 − EMA26\n• **Signal line** = 9-period average of MACD\n• MACD crosses **above** signal = bullish momentum 🟢\n• Crosses **below** = bearish momentum 🔴\n\nIt's the same logic as MT5's free "MACD Sample" EA. Lags a bit (it's average-based), so it shines in trends and lags in chop.${DISCLAIMER}`,
  bollinger: `**Bollinger Bands (20, 2σ)** — volatility envelope around a 20-period average.\n\n• Price touches the **lower band** = statistically stretched down → bounce often follows\n• Price touches the **upper band** = stretched up → pullback often follows\n• Bands **squeeze** = low volatility, a big move is brewing (direction unknown!)\n\n⚠️ In a strong trend, price can "walk the band" for a long time — don't fight trends with it.${DISCLAIMER}`,
  ma: `**Moving averages** smooth price to reveal trend.\n\n• **SMA** = simple average of last N closes\n• **EMA** = weighted to recent prices (reacts faster)\n• **Golden cross**: SMA50 crosses above SMA200 = long-term bullish\n• Price above its average = uptrend; below = downtrend\n\nThe classic system: buy when fast average (20) crosses above slow (50). Try it in the Algo Lab!${DISCLAIMER}`,
  options: `**Options (demo, simplified)** — Buy a CALL if you expect price UP, a PUT if DOWN.\n\n• You pay a **premium** upfront — that's your max loss\n• **Strike** = the price you're betting against\n• At **expiry**, the option is worth its **intrinsic value** (how far past the strike price finished)\n• Call pays if price > strike; Put pays if price < strike\n\nReal options use Black-Scholes; this demo uses premium = intrinsic + 2% of spot so you can learn the mechanics safely.${DISCLAIMER}`,
  intraday: `**Intraday** — open and close within the same trading session.\n\n• No overnight risk, but you pay spread/commission on every round trip\n• Needs a plan: entry, stop-loss, take-profit — all decided BEFORE the trade\n• In this demo, intraday orders are flagged and shown as "auto square-off at session end (simulated)"\n\nDay trading looks exciting and is statistically one of the fastest ways beginners lose money for real. Learn the discipline here first.${DISCLAIMER}`,
  delivery: `**Delivery** — you actually buy and HOLD the asset (stock/crypto) in your portfolio.\n\n• No expiry, no leverage decay — you own it until you sell\n• Best for longer-term, "investor" style demo practice\n• You still pay the 0.1% exchange fee + 0.05% broker commission per side\n\nCompare: delivery = own it; intraday = same-day flip; leveraged = borrowed-size bet.${DISCLAIMER}`,
  fees: `**Fees on every demo trade:**\n\n• **Exchange fee: 0.1%** per side\n• **Broker commission: 0.05%** per side\n• Round trip (buy+sell) ≈ **0.3%** total\n\nThey look tiny — but 10 round trips a day = ~3% drag. That's why pros say "fees eat scalpers". Watch the "fees paid" total on your Portfolio page.${DISCLAIMER}`,
  copytrading: `**Copy trading (demo)** — pick a trader from the leaderboard and mirror their demo trades into your paper portfolio.\n\n• You choose the copy amount\n• Their new simulated trades get copied to you\n• Great for learning *how* others structure trades\n\n⚠️ Real copy trading has real risks (you copy losses too, plus slippage). Here it's all simulated — study the *process*, not just the returns.${DISCLAIMER}`,
  algotrading: `**Algo trading (demo)** — rules-based strategies that trade automatically.\n\n• The **Algo Lab** paper-runs 6 classic strategies (SMA cross, RSI, Breakout, MACD, Bollinger, Supertrend) on 2 years of history\n• You see trade log, win rate, max drawdown — full honesty, including losing runs\n• No strategy wins all the time; the lab proves it with numbers\n\nAlgos remove emotion but can't remove risk. Backtest ≠ future profits.${DISCLAIMER}`,
  backtest: `**Backtesting** — running a strategy on historical data to see how it *would have* done.\n\n• The Algo Lab does this on 2 years of daily bars with 0.15% cost per side\n• Watch **max drawdown** (worst losing streak) — that's the pain you'd have felt\n• ⚠️ Past performance ≠ future results. Markets change; curve-fitted strategies die live.\n\nUse backtests to *reject* bad ideas, not to *prove* good ones.${DISCLAIMER}`,
  candles: `**Candlesticks** — each candle = one period (day, hour…).\n\n• 🟢 **Green** = closed higher than opened (buyers won)\n• 🔴 **Red** = closed lower (sellers won)\n• **Wicks** = the full high–low range; long wicks = rejection\n• A long green candle with tiny wicks = strong buying conviction\n\nQuasar charts use classic green/red candles — same language as Binance, Zerodha, TradingView everywhere.${DISCLAIMER}`,
  sr: `**Support & Resistance** — price levels where moves tend to pause or reverse.\n\n• **Support** = floor where buyers step in\n• **Resistance** = ceiling where sellers step in\n• Old resistance, once broken, often becomes new support ("flip")\n• More touches = stronger level; round numbers (100, 1000) act as magnets\n\nThey're zones, not exact lines — and they break. Always have a stop-loss beyond the level.${DISCLAIMER}`,
  hours: `**Market hours** — exchanges don't run 24/7 (crypto does, stocks don't).\n\n• 🇮🇳 NSE/BSE: 9:15–15:30 IST\n• 🇺🇸 NYSE/NASDAQ: 9:30–16:00 ET\n• 🇨🇦 TSX: 9:30–16:00 ET\n• 🇸🇬 SGX: 9:00–17:00 SGT (lunch break!)\n• 🇬🇧 LSE: 8:00–16:30 London\n\nThe country selector shows a live 🟢 Open / 🔴 Closed badge per exchange. Demo trading works 24/7 for practice, but real fills only happen when the exchange is open.${DISCLAIMER}`,
  qsr: `**QSR — Quasar's native coin (demo)**\n\n• Total supply: **500,000,000,000 QSR**\n• Listed at the top of the crypto tab with a **Native** badge\n• Current price is **simulated** (gentle random walk from $0.0001) — it's not on any real exchange yet\n• Quasar Core is Quasar's own independent blockchain (laptop-mined, educational P2P network) — QSR is the best coin, the future — no Solana mint, no real market value\n\nYou can paper-trade QSR/USD with leverage, SL/TP — full ticket, zero real money.${DISCLAIMER}`,
  demo: `**This whole app is a DEMO.**\n\n• You start with **$100,000 play money**\n• Ran low? Hit **Refill** on the Portfolio page — one tap, back to $100,000\n• Nothing here moves real money, places real orders, or touches real exchanges\n• That's the point: blow up 10 demo accounts learning, so you never blow up a real one.${DISCLAIMER}`,
  diamond: `**Diamond pattern** 💎 — a rare reversal formation.\n\n• Volatility first **expands** (wider swings), then **contracts** into a diamond shape\n• **Diamond TOP** (after an uptrend) = bearish reversal\n• **Diamond BOTTOM** (after a downtrend) = bullish reversal\n• The signal is the **break of the diamond boundary** — never trade inside it\n• **Stop-loss** goes just beyond the opposite boundary\n\n⚠️ False breaks are common — wait for a daily close outside + volume. See the Pattern Lab for a diagram + live screener.${DISCLAIMER}`,
  harmonic: `**Harmonic patterns** 🦇 — X-A-B-C-D Fibonacci reversal patterns.\n\n• **Gartley**: B=0.618 of XA, D completes at 0.786\n• **Bat**: B=0.382–0.50 (shallow), D at 0.886\n• **Butterfly**: B=0.786, D extends to 1.27–1.618 past X\n• **Crab**: D extends to 1.618 — deepest, most explosive\n• Entry is at **D** — the completion zone; invalidation just beyond D\n\n⚠️ Detection here is approximate (±8% tolerance). Real harmonics need precise Fibonacci confluence — wait for confirmation at D. Pattern Lab has diagrams + a screener.${DISCLAIMER}`,
  risk: `**Risk basics (the unsexy part that matters most):**\n\n1. **Position size**: risk 1–2% of capital per trade, max\n2. **Stop-loss on every trade** — no exceptions\n3. **Leverage is a magnifier**, not a money printer\n4. **Fees compound** — frequent trading bleeds accounts\n5. **No strategy wins always** — drawdowns are guaranteed; survival is the skill\n\nIf a "guru" promises guaranteed returns, that's a scam. Every time.${DISCLAIMER}`,
};

export const STRATEGY_ADVICE: Record<'trending' | 'sideways' | 'general', string> = {
  trending: `**Trending market?** Use trend-followers from the Algo Lab:\n\n• **Quasar Trend** — our own Supertrend(10,3) + EMA-200 system with BUY/SELL/STRONG labels\n• **Supertrend (10, 3)** — rides the trend, flips on reversals\n• **SMA Crossover (20/50)** — the classic golden-cross logic\n• **MACD Signal** — momentum confirmation\n• **20-Day Breakout** — catches fresh trend starts\n\nRule of thumb: ADX above ~20 confirms trend. Give trades room (wider stops) — trends forgive entries but punish early exits.${DISCLAIMER}`,
  sideways: `**Sideways/choppy market?** Trend tools whipsaw here — use range tools:\n\n• **RSI Mean Reversion (14)** — buy oversold (<30), sell overbought (>70)\n• **Bollinger Bounce** — buy lower band, sell upper band\n• Keep targets small and stops tight — ranges end without warning\n\nRule of thumb: ADX below ~20 = chop. When ADX starts rising, the range is breaking — step aside or switch to breakout mode.${DISCLAIMER}`,
  general: `**Which strategy?** It depends on the market's mood:\n\n• **Trending** (ADX > 20): Supertrend, SMA Crossover, MACD, Breakout\n• **Sideways** (ADX < 20): RSI Mean Reversion, Bollinger Bounce\n\nAsk me to **analyze a symbol** and I'll compute its ADX + indicators and tell you which regime it's in. Or open the **Algo Lab** and paper-run all six on 2 years of history — let the numbers convince you.${DISCLAIMER}`,
};

export const HELP_TEXT = `I'm the **Quasar AI Bot** 🤖 — your demo trading tutor.\n\n**I can:**\n• 💰 **Answer from YOUR demo data** — "My profit?", "My commission?", "My balance?", "My tax?", "My trades?", "Show my ledger"\n  (reads your real paper-trading state in this browser — never made up)\n• 📊 **Analyze any symbol** — "Analyze ETH", "Signal for RELIANCE", "Is NVDA bullish?"\n  (Supertrend + RSI + SMA trend + ADX, computed live from market history)\n• 🎓 **Explain concepts** — "What is RSI?", "How does leverage work?", "What is a stop-loss?"\n• 🧭 **Suggest strategies** — "Best strategy for sideways market?"\n• 📰 **Market news + web answers** — "What's happening in the market?", "Crypto news", or ANY general question — I search live headlines (CoinDesk, CoinTelegraph, Economic Times) + the web\n• 🪙 **Explain QSR**, fees, demo refill, market hours…\n\nEverything is educational, computed from public demo data. **Not financial advice — demo only.**`;

export const FALLBACK_TEXT = `Hmm, I'm a simple pattern-matching bot (no big AI brain yet 🧠), so I didn't quite get that.\n\nTry:\n• **"My profit?"** — your real demo P&L, fees, tax estimate\n• **"Analyze ETH"** — live indicator summary for any coin, stock, or forex pair\n• **"What is RSI?"** — explain any trading concept\n• **"Best strategy for sideways market?"** — strategy guidance\n\n${'_Demo only — not financial advice._'}`;

export const CHIPS = [
  'My profit?',
  "What's happening in the market?",
  'Analyze ETH',
  'What is stop-loss?',
];
