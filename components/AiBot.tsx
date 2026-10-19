'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Send, X, Sparkles } from 'lucide-react';
import {
  parseIntent, TEACH, STRATEGY_ADVICE, HELP_TEXT, FALLBACK_TEXT, CHIPS,
  type BotSymbol,
} from '@/lib/aibot';
import { analyzeBars, type Ohlc } from '@/lib/indicators';
import { detectDiamond, detectHarmonic } from '@/lib/patterns';
import { loadState, fmtUSD } from '@/lib/quasar';
import { buildLedger, ledgerSummaryText, HUB_STRATEGIES, TAX_CONFIGS } from '@/lib/hub';
import { cn } from '@/lib/utils';

/** Answers from YOUR real demo state — never made up. Country tax = Canada default (demo estimate). */
function answerWallet(query: 'profit' | 'balance' | 'commission' | 'tax' | 'trades' | 'ledger' | 'strategies'): string {
  const state = loadState();
  const ledger = buildLedger(state, 'CA');
  const m = (n: number) => fmtUSD(n);
  const disclaimer = '\n\n_From your real demo trades in this browser. Demo only — not financial advice._';
  switch (query) {
    case 'profit':
      return `**Your profit today (demo)**\n\n• **Total P&L:** ${m(ledger.totalPnl)} (${ledger.totalPnl >= 0 ? 'profit 🟢' : 'loss 🔴'})\n• **Realized P&L:** ${m(ledger.realizedPnl)} · **Unrealized P&L:** ${m(ledger.unrealizedPnl)}\n• **Gross P&L (before fees):** ${m(ledger.grossPnl)}\n• **Commission + fees:** ${m(ledger.fees.total)}\n• **Tax estimate (Canada GST 5% on fees):** ${m(ledger.tax)}\n• **Net P&L (after fees + tax est.):** ${m(ledger.netPnl)}\n• **Trades:** ${ledger.trades}${disclaimer}`;
    case 'balance':
      return `**Your demo wallet**\n\n• **Equity:** ${m(ledger.equity)}\n• **Available cash:** ${m(ledger.cash)}\n• **Total P&L:** ${m(ledger.totalPnl)}\n• **Trades so far:** ${ledger.trades}\n\nYou started with $100,000 demo cash. Low on cash? Hit **Refill** on the Portfolio page.${disclaimer}`;
    case 'commission':
      return `**Where your commission goes (demo)**\n\n• **Total commission + fees:** ${m(ledger.fees.total)}\n• **Exchange fee (0.1%/side):** ${m(ledger.fees.exchange)}\n• **Broker commission (0.05%/side):** ${m(ledger.fees.broker)}\n• **Tax estimate on fees (Canada GST 5%):** ${m(ledger.tax)}\n\nEvery trade pays 0.1% exchange + 0.05% broker per side — a round trip ≈ 0.3%. Check the full breakdown on the Portfolio page → Trading Ledger.${disclaimer}`;
    case 'tax':
      return `**Tax estimate (demo — not real tax)**\n\n• **On your fees of ${m(ledger.fees.total)}:** ${m(ledger.tax)} (${ledger.taxCfg.label})\n• **Net P&L after tax est.:** ${m(ledger.netPnl)}\n\nOther demo estimates:\n${TAX_CONFIGS.map((t) => `• ${t.label}: ${m(ledger.fees.total * t.rate)}`).join('\n')}\n\nIndia GST (18%) and Canada GST (5%) are NOT the same — change the country on the Portfolio / Tester pages to compare. This is a demo estimate, never a real tax calculation.${disclaimer}`;
    case 'trades': {
      const recent = state.orders.slice(0, 5);
      if (!recent.length) return `**Your trades**\n\nNo trades yet — your order history is empty. Place your first paper trade on the Trade page, then ask me again!${disclaimer}`;
      return `**Your recent trades** (latest ${recent.length} of ${state.orders.length})\n\n${recent.map((o) => `• ${o.side.toUpperCase()} ${o.qty.toFixed(4)} ${o.symbol} @ ${m(o.price)} — fee ${m(o.fee)}`).join('\n')}\n\nFull history lives on the Orders page.${disclaimer}`;
    }
    case 'ledger':
      return ledgerSummaryText(ledger) + disclaimer;
    case 'strategies': {
      const js = HUB_STRATEGIES.filter((s) => s.source === 'quasar');
      const pine = HUB_STRATEGIES.filter((s) => s.source === 'pine');
      return `**Strategy library — ${HUB_STRATEGIES.length} strategies**\n\n**Quasar engine (backtestable):**\n${js.map((s) => `• ${s.name} — ${s.tag}, risk ${s.risk}/5`).join('\n')}\n\n**Pine Script library:**\n${pine.map((s) => `• ${s.name} — ${s.tag}, risk ${s.risk}/5`).join('\n')}\n\nOpen the **Strategy Hub** (top menu) to test, copy or grid any of them.${disclaimer}`;
    }
  }
}

type Msg = { role: 'bot' | 'user'; text: string };

/** Minimal markdown-lite: **bold**, _italic_, newlines. Escapes HTML first. */
function renderLite(text: string) {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = esc
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
    .replace(/_(.+?)_/g, '<em class="text-slate-400">$1</em>')
    .replace(/\n/g, '<br/>');
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

async function askWeb(question: string, mode?: 'news'): Promise<string> {
  try {
    const url = `/api/assistant?q=${encodeURIComponent(question)}${mode ? `&mode=${mode}` : ''}`;
    const r = await fetch(url, { cache: 'no-store' });
    const j = await r.json();
    if (j.ok && typeof j.answer === 'string' && j.answer.trim()) return j.answer;
    return FALLBACK_TEXT;
  } catch {
    return FALLBACK_TEXT;
  }
}

async function analyzeSymbol(sym: BotSymbol): Promise<string> {
  if (!sym.yahoo) {
    return `**${sym.label}** — Quasar's native demo coin.\n\nIts price is **simulated** (gentle random walk from $0.0001), so there is no real history to run indicators on. You can still paper-trade it with the full ticket — leverage, SL/TP included.\n\n_Demo only — not financial advice._`;
  }
  try {
    const r = await fetch(`/api/history?yahoo=${encodeURIComponent(sym.yahoo)}&range=6mo&interval=1d`, { cache: 'no-store' });
    const j = await r.json();
    if (!j.ok || !Array.isArray(j.c)) throw new Error('no data');
    const n = (j.t as number[]).length;
    const bars: Ohlc[] = [];
    for (let i = 0; i < n; i++) {
      const c = (j.c as number[])[i];
      if (!(c > 0)) continue;
      bars.push({ t: (j.t as number[])[i], o: (j.o as number[])[i] || c, h: (j.h as number[])[i] || c, l: (j.l as number[])[i] || c, c });
    }
    const v = analyzeBars(bars);
    if (!v) return `Not enough history for **${sym.label}** to compute signals yet.\n\n_Demo only — not financial advice._`;
    const badge = v.verdict === 'bullish' ? '🟢 **BULLISH**' : v.verdict === 'bearish' ? '🔴 **BEARISH**' : '⚪ **NEUTRAL**';
    const h = bars.map((b) => b.h), l = bars.map((b) => b.l), c = bars.map((b) => b.c);
    const d = detectDiamond(h, l, c);
    const hm = detectHarmonic(h, l, c);
    const lines = [
      `**${sym.label}** — signal summary ${badge}`,
      '',
      `• **Quasar Trend:** ${v.quasarTrend === 'up' ? '🟢 Uptrend' : v.quasarTrend === 'down' ? '🔴 Downtrend' : '⚪ No confirmed trend'}`,
      `• **Supertrend (10,3):** ${v.supertrendDir === 1 ? '▲ up' : v.supertrendDir === -1 ? '▼ down' : '—'}`,
      `• **RSI (14):** ${Number.isNaN(v.rsi) ? '—' : v.rsi.toFixed(1)}`,
      `• **SMA 20/50:** ${Number.isNaN(v.sma20) || Number.isNaN(v.sma50) ? '—' : v.sma20 > v.sma50 ? 'bullish cross state' : 'bearish cross state'}`,
      `• **ADX (14):** ${Number.isNaN(v.adx) ? '—' : `${v.adx.toFixed(1)} (${v.trending ? 'trending' : 'sideways'})`}`,
    ];
    if (d.found) lines.push(`• **Diamond:** 💎 possible ${d.bias} diamond — watch for breakout`);
    if (hm.found && hm.name) lines.push(`• **Harmonic:** 🦇 possible ${hm.direction} ${hm.name} near ${hm.dZone?.toFixed(2)} — caution ${hm.direction === 'bearish' ? 'on longs' : 'on shorts'}`);
    lines.push('', v.trending
      ? 'Regime: **trending** → trend tools (Quasar Trend, Supertrend, SMA cross) fit best.'
      : 'Regime: **sideways** → range tools (RSI, Bollinger) fit best; trend signals may whipsaw.');
    lines.push('', '_Computed live from public demo data. Demo only — not financial advice._');
    return lines.join('\n');
  } catch {
    return `Couldn't fetch history for **${sym.label}** right now — try again in a moment.\n\n_Demo only — not financial advice._`;
  }
}

export function AiBot() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'bot', text: `Hey! I'm the **Quasar AI Bot** 🤖 — your demo trading tutor.\n\nAsk me **"My profit?"** or **"My commission?"** for answers from YOUR real demo trades, **"Analyze ETH"** for live signals, or **"What is RSI?"** to learn a concept.\n\n_Everything here is educational. Demo only — not financial advice._` },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, open]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setMsgs((m) => [...m, { role: 'user', text }]);
    setInput('');
    setBusy(true);
    try {
      const intent = parseIntent(text);
      let reply: string;
      if (intent.type === 'analyze') reply = await analyzeSymbol(intent.symbol);
      else if (intent.type === 'wallet') reply = answerWallet(intent.query);
      else if (intent.type === 'news') reply = await askWeb(text, 'news');
      else if (intent.type === 'teach') reply = TEACH[intent.topic] ?? FALLBACK_TEXT;
      else if (intent.type === 'strategy') reply = STRATEGY_ADVICE[intent.regime];
      else if (intent.type === 'help') reply = HELP_TEXT;
      else reply = await askWeb(text); // fallback = web search, never a dead end
      setMsgs((m) => [...m, { role: 'bot', text: reply }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open Quasar AI Bot"
        className={cn(
          'fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition border',
          open
            ? 'bg-panel border-edge text-slate-300'
            : 'bg-gradient-to-br from-amber-400 to-yellow-600 border-amber-300/50 text-black hover:scale-105'
        )}
      >
        {open ? <X size={22} /> : <Bot size={26} />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[92vw] max-w-[380px] h-[540px] max-h-[70vh] bg-panel border border-accent/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-edge bg-gradient-to-r from-amber-400/15 to-transparent">
            <span className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-black">
              <Bot size={20} />
            </span>
            <div>
              <div className="text-sm font-extrabold text-white flex items-center gap-1.5">
                Quasar AI Bot <Sparkles size={13} className="text-accent" />
              </div>
              <div className="text-[10px] text-slate-500">Demo tutor · not financial advice</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {msgs.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
                    m.role === 'user'
                      ? 'bg-accent/90 text-white rounded-br-md'
                      : 'bg-void border border-edge text-slate-300 rounded-bl-md'
                  )}
                >
                  {renderLite(m.text)}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-void border border-edge rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[13px] text-slate-500">
                  thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-3 pb-1.5 flex gap-1.5 overflow-x-auto">
            {CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => send(c)}
                disabled={busy}
                className="shrink-0 text-[11px] font-semibold text-accent bg-accent/10 border border-accent/30 rounded-full px-3 py-1.5 hover:bg-accent/20 transition disabled:opacity-50"
              >
                {c}
              </button>
            ))}
          </div>

          <div className="p-3 border-t border-edge flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(input); }}
              placeholder="Ask: Analyze ETH…"
              className="flex-1 bg-void border border-edge rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent/60"
            />
            <button
              onClick={() => send(input)}
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 text-black flex items-center justify-center hover:scale-105 transition disabled:opacity-40"
            >
              <Send size={17} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
