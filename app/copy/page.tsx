'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Copy, TriangleAlert, TrendingUp, BadgeCheck, Pause, Play, Square, FlaskConical } from 'lucide-react';
import { loadState, paperBuy, paperSell, saveState, fmtUSD, type PaperState } from '@/lib/quasar';
import { HUB_STRATEGIES } from '@/lib/hub';
import { cn } from '@/lib/utils';

type FictionalTrader = {
  id: string;
  name: string;
  avatar: string;
  style: string;
  winRate: number;
  ret30d: number;
  followers: number;
  bio: string;
  pick: { label: string; symbol: string; yahoo: string; kind: 'crypto' | 'stock' };
  recent: string[]; // simulated recent trade blurbs
};

// All traders are fictional demo personas — their "trades" are simulated.
const TRADERS: FictionalTrader[] = [
  {
    id: 't1', name: 'Aarav "TrendRider" Mehta', avatar: '🧑‍💼', style: 'Trend following',
    winRate: 58, ret30d: 12.4, followers: 12840,
    bio: 'Rides crypto trends with Supertrend + EMA filters. Cuts losers fast.',
    pick: { label: 'DOGE/USD', symbol: 'DOGE', yahoo: 'DOGE-USD', kind: 'crypto' },
    recent: ['Bought DOGE @ 0.21 (Supertrend flip)', 'Sold ETH @ 3,412 (+6.2%)', 'Bought SOL @ 142.8'],
  },
  {
    id: 't2', name: 'Priya "Reversal" Nair', avatar: '👩‍💻', style: 'Mean reversion',
    winRate: 64, ret30d: 8.1, followers: 9320,
    bio: 'Buys fear, sells greed. RSI + Bollinger range trader on large caps.',
    pick: { label: 'RELIANCE (NSE)', symbol: 'RELIANCE', yahoo: 'RELIANCE.NS', kind: 'stock' },
    recent: ['Bought RELIANCE @ 2,412 (RSI 28)', 'Sold TCS @ 3,980 (+3.1%)', 'Bought INFY @ 1,512'],
  },
  {
    id: 't3', name: 'Vikram "Breakout" Singh', avatar: '🧔', style: 'Momentum breakout',
    winRate: 47, ret30d: 18.9, followers: 15230,
    bio: 'High-risk momentum hunter. Big wins, big drawdowns — not for the faint-hearted.',
    pick: { label: 'NVDA', symbol: 'NVDA', yahoo: 'NVDA', kind: 'stock' },
    recent: ['Bought NVDA @ 182.4 (20-day high)', 'Sold TSLA @ 248.1 (+11.7%)', 'Stopped MARA @ -4.2%'],
  },
  {
    id: 't4', name: 'Sofia "Steady" Rossi', avatar: '👩‍🦰', style: 'Swing / low leverage',
    winRate: 61, ret30d: 6.3, followers: 7410,
    bio: 'Slow and steady: 5x max leverage, always with stop-loss. Tortuga mindset. 🐢',
    pick: { label: 'ETH/USD', symbol: 'ETH', yahoo: 'ETH-USD', kind: 'crypto' },
    recent: ['Bought ETH @ 3,298 (5x, SL armed)', 'Sold AAPL @ 232.5 (+2.8%)', 'Bought MSFT @ 428.1'],
  },
  {
    id: 't5', name: 'Kenji "Scalp" Tanaka', avatar: '🧑‍🎤', style: 'Intraday scalping',
    winRate: 71, ret30d: 5.2, followers: 6890,
    bio: 'Dozens of tiny intraday wins. Watch out: commissions eat scalpers alive.',
    pick: { label: 'AAPL', symbol: 'AAPL', yahoo: 'AAPL', kind: 'stock' },
    recent: ['Scalped AAPL +0.4% (12 min)', 'Scalped MSFT +0.3% (8 min)', 'Scalped NVDA -0.2% (stopped)'],
  },
  {
    id: 't6', name: 'Lena "Diamond" Fischer', avatar: '👱‍♀️', style: 'Pattern trading',
    winRate: 52, ret30d: 9.7, followers: 8140,
    bio: 'Trades diamond + harmonic completions at D zones. Patient, selective.',
    pick: { label: 'SOL/USD', symbol: 'SOL', yahoo: 'SOL-USD', kind: 'crypto' },
    recent: ['Bought SOL @ D zone 138.2', 'Waiting: DOGE diamond forming', 'Sold ETH bat completion (+4.4%)'],
  },
  {
    id: 't7', name: 'Harpreet "HODL" Gill', avatar: '🧑‍🦰', style: 'Long-term HODL',
    winRate: 68, ret30d: 4.8, followers: 21400,
    bio: 'Canada-based. Buys DOGE dips and holds for years. Lowest turnover on the board — patience is the strategy.',
    pick: { label: 'DOGE/USD', symbol: 'DOGE', yahoo: 'DOGE-USD', kind: 'crypto' },
    recent: ['Bought DOGE @ 0.142 (dip add)', 'Holding since 2023 — no sells', 'Buys every -5% dip, never sells tops'],
  },
  {
    id: 't8', name: 'Emma "Dividend" Clarke', avatar: '👩‍🦱', style: 'Dividend / value',
    winRate: 66, ret30d: 3.9, followers: 11200,
    bio: 'UK value investor. Buys boring cash-cow stocks, reinvests the paper dividends. Slow compounding.',
    pick: { label: 'MSFT', symbol: 'MSFT', yahoo: 'MSFT', kind: 'stock' },
    recent: ['Bought MSFT @ 418.2 (value zone)', 'Sold overvalued pick (+5.6%)', 'Reinvested demo dividend'],
  },
  {
    id: 't9', name: 'Rajesh "Options" Sharma', avatar: '🧑‍💼', style: 'Options income',
    winRate: 55, ret30d: 7.2, followers: 9870,
    bio: 'India-based. Sells covered calls, buys protective puts. Income first, moonshots never.',
    pick: { label: 'INFY (NSE)', symbol: 'INFY', yahoo: 'INFY.NS', kind: 'stock' },
    recent: ['Sold INFY call @ +2.1% premium', 'Bought INFY put hedge', 'Covered call expired worthless (+premium kept)'],
  },
  {
    id: 't10', name: 'Yuki "DeFi" Nakamura', avatar: '👩‍🎤', style: 'DeFi / altcoins',
    winRate: 49, ret30d: 14.6, followers: 13560,
    bio: 'Japan-based altcoin hunter. High volatility, strict 2% risk per trade. Not for beginners.',
    pick: { label: 'LINK/USD', symbol: 'LINK', yahoo: 'LINK-USD', kind: 'crypto' },
    recent: ['Bought LINK @ 14.2 (oracle thesis)', 'Sold AVAX @ +9.3%', 'Stopped DOT @ -2% (risk rule)'],
  },
  {
    id: 't11', name: 'Carlos "Energy" Mendez', avatar: '🧔‍♂️', style: 'Energy / commodities',
    winRate: 60, ret30d: 6.8, followers: 8760,
    bio: 'Brazil-based. Trades oil & energy majors on macro cycles. Hedges with gold-style safety picks.',
    pick: { label: 'SHEL', symbol: 'SHEL', yahoo: 'SHEL', kind: 'stock' },
    recent: ['Bought SHEL @ 68.4 (oil up)', 'Sold XOM @ +4.1%', 'Holding energy through OPEC week'],
  },
  {
    id: 't12', name: 'Fatima "Earnings" Al-Sayed', avatar: '👩‍💼', style: 'Earnings momentum',
    winRate: 57, ret30d: 11.3, followers: 16780,
    bio: 'UAE-based. Trades earnings surprises only — in after a beat, out before the fade.',
    pick: { label: 'TSLA', symbol: 'TSLA', yahoo: 'TSLA', kind: 'stock' },
    recent: ['Bought TSLA @ 246.8 (earnings beat)', 'Sold NVDA @ +7.9% post-earnings', 'Skipped weak-guidance name'],
  },
];

type CopySub = { traderId: string; traderName: string; symbol: string; amount: number; time: number };
const COPY_KEY = 'quasar-copy-subs-v1';

type StratCopy = {
  id: string; strategyId: string; strategyName: string; symbol: string;
  amount: number; qty: number; entryPrice: number;
  risk: number; slPct: number; maxDailyLoss: number;
  status: 'active' | 'paused' | 'stopped'; realizedPnl: number | null; time: number;
};
const STRAT_COPY_KEY = 'quasar-strat-copies-v1';

function loadStratCopies(): StratCopy[] {
  try {
    return JSON.parse(localStorage.getItem(STRAT_COPY_KEY) ?? '[]') as StratCopy[];
  } catch { return []; }
}

function saveStratCopies(list: StratCopy[]) {
  localStorage.setItem(STRAT_COPY_KEY, JSON.stringify(list));
}

const STRAT_SYMBOLS = ['ETH', 'SOL', 'DOGE'];

function loadSubs(): CopySub[] {
  try {
    return JSON.parse(localStorage.getItem(COPY_KEY) ?? '[]') as CopySub[];
  } catch { return []; }
}

export default function CopyPage() {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [subs, setSubs] = useState<CopySub[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Strategy copy (copy a STRATEGY, not a trader)
  const [stratId, setStratId] = useState(HUB_STRATEGIES[0]?.id ?? '');
  const [stratSymbol, setStratSymbol] = useState('ETH');
  const [stratAmount, setStratAmount] = useState('1000');
  const [riskMult, setRiskMult] = useState('1');
  const [slPct, setSlPct] = useState('5');
  const [maxDailyLoss, setMaxDailyLoss] = useState('200');
  const [stratCopies, setStratCopies] = useState<StratCopy[]>([]);
  const [stratBusy, setStratBusy] = useState(false);

  useEffect(() => { setSubs(loadSubs()); setStratCopies(loadStratCopies()); }, []);

  const stratDef = HUB_STRATEGIES.find((s) => s.id === stratId);

  async function startStratCopy() {
    const amount = Math.max(10, parseFloat(stratAmount || '0'));
    if (!(amount > 0)) { setMsg({ ok: false, text: 'Enter a copy amount above $0.' }); return; }
    const def = HUB_STRATEGIES.find((s) => s.id === stratId);
    if (!def) return;
    setStratBusy(true); setMsg(null);
    try {
      const kraken = stratSymbol === 'BTC' ? 'XBTUSD' : `${stratSymbol}USD`;
      const r = await fetch(`/api/ticker?pair=${kraken}`, { cache: 'no-store' });
      const j = await r.json();
      const price = (j.data as { symbol: string; price: number }[] | undefined)?.[0]?.price ?? 0;
      if (!(price > 0)) throw new Error('Live price unavailable — try again.');
      const s: PaperState = (() => {
        const st = loadState();
        return { ...st, holdings: { ...st.holdings }, positions: [...st.positions], options: [...(st.options ?? [])], orders: [...st.orders], snapshots: [...st.snapshots] };
      })();
      const res = paperBuy(s, stratSymbol, amount, price, undefined, 'delivery');
      if (!res.ok) throw new Error(res.error);
      const entry: StratCopy = {
        id: `sc-${Date.now()}`, strategyId: def.id, strategyName: def.name, symbol: stratSymbol,
        amount, qty: res.order.qty, entryPrice: price,
        risk: Math.max(0.1, parseFloat(riskMult) || 1),
        slPct: Math.max(0, parseFloat(slPct) || 0),
        maxDailyLoss: Math.max(0, parseFloat(maxDailyLoss) || 0),
        status: 'active', realizedPnl: null, time: Date.now(),
      };
      const next = [entry, ...loadStratCopies()].slice(0, 20);
      saveStratCopies(next); setStratCopies(next);
      setMsg({ ok: true, text: `Strategy copy started: ${def.name} → bought ${fmtUSD(amount)} of ${stratSymbol} @ ${fmtUSD(price, 4)} (simulated, real demo trade). Risk ×${entry.risk}, SL ${entry.slPct}%, max daily loss ${fmtUSD(entry.maxDailyLoss)}.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Strategy copy failed (demo).' });
    } finally { setStratBusy(false); }
  }

  function setStratStatus(id: string, status: 'active' | 'paused') {
    const next = loadStratCopies().map((c) => (c.id === id ? { ...c, status } : c));
    saveStratCopies(next); setStratCopies(next);
  }

  async function stopStratCopy(c: StratCopy) {
    setStratBusy(true); setMsg(null);
    try {
      const kraken = c.symbol === 'BTC' ? 'XBTUSD' : `${c.symbol}USD`;
      const r = await fetch(`/api/ticker?pair=${kraken}`, { cache: 'no-store' });
      const j = await r.json();
      const price = (j.data as { symbol: string; price: number }[] | undefined)?.[0]?.price ?? 0;
      if (!(price > 0)) throw new Error('Live price unavailable — try again.');
      const s: PaperState = (() => {
        const st = loadState();
        return { ...st, holdings: { ...st.holdings }, positions: [...st.positions], options: [...(st.options ?? [])], orders: [...st.orders], snapshots: [...st.snapshots] };
      })();
      const res = paperSell(s, c.symbol, c.qty, price, undefined, 'delivery');
      if (!res.ok) throw new Error(res.error);
      const net = c.qty * price - res.order.fee;
      const next = loadStratCopies().map((x) => (x.id === c.id ? { ...x, status: 'stopped' as const, realizedPnl: net - c.amount } : x));
      saveStratCopies(next); setStratCopies(next);
      setMsg({ ok: true, text: `Copy stopped: ${c.strategyName} — sold ${c.qty.toFixed(4)} ${c.symbol} @ ${fmtUSD(price, 4)}. Realized P&L ${fmtUSD(net - c.amount)} (demo).` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Stop-copy failed (demo).' });
    } finally { setStratBusy(false); }
  }

  const copyTrader = async (t: FictionalTrader) => {
    const amount = Math.max(10, parseFloat(amounts[t.id] || '0'));
    if (!(amount > 0)) { setMsg({ ok: false, text: 'Enter a copy amount above $0.' }); return; }
    setBusy(t.id); setMsg(null);
    try {
      // Live demo price for the trader's current pick
      let price = 0;
      if (t.pick.kind === 'crypto') {
        const kraken = t.pick.symbol === 'BTC' ? 'XBTUSD' : `${t.pick.symbol}USD`;
        const r = await fetch(`/api/ticker?pair=${kraken}`, { cache: 'no-store' });
        const j = await r.json();
        const row = (j.data as { symbol: string; price: number }[] | undefined)?.[0];
        price = row?.price ?? 0;
      } else {
        const r = await fetch(`/api/stocks?symbols=${t.pick.symbol}`, { cache: 'no-store' });
        const j = await r.json();
        const q = (j.quotes as { symbol: string; priceUSD: number }[] | undefined)?.find((x) => x.symbol === t.pick.symbol);
        price = q?.priceUSD ?? 0;
      }
      if (!(price > 0)) throw new Error('price unavailable');
      const s: PaperState = (() => {
        const st = loadState();
        return { ...st, holdings: { ...st.holdings }, positions: [...st.positions], options: [...(st.options ?? [])], orders: [...st.orders], snapshots: [...st.snapshots] };
      })();
      const res = paperBuy(s, t.pick.symbol, amount, price, t.pick.kind === 'stock' ? t.pick.symbol : undefined, 'delivery');
      if (!res.ok) throw new Error(res.error);
      const sub: CopySub = { traderId: t.id, traderName: t.name, symbol: t.pick.symbol, amount, time: Date.now() };
      const next = [sub, ...loadSubs()].slice(0, 20);
      localStorage.setItem(COPY_KEY, JSON.stringify(next));
      setSubs(next);
      setMsg({ ok: true, text: `Copied ${t.name}: bought ${fmtUSD(amount)} of ${t.pick.label} @ ${fmtUSD(price, 4)} into your demo portfolio (simulated copy).` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Copy failed (demo).' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <Users size={22} className="text-accent" /> Copy Trading
        </h1>
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-full px-2.5 py-1">
          Simulated
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-5 max-w-2xl">
        Mirror <span className="text-slate-200 font-semibold">fictional demo traders</span> into your paper portfolio
        with one tap. Their profiles, stats and "recent trades" are <span className="text-slate-200 font-semibold">simulated personas for learning</span> —
        study their <em>process</em>, not just returns. Copying copies losses too.
      </p>

      {msg && (
        <div className={cn('mb-4 text-xs rounded-xl px-3 py-2.5 border', msg.ok ? 'text-up bg-up/10 border-up/30' : 'text-down bg-down/10 border-down/30')}>
          {msg.text}
        </div>
      )}

      {/* Copy a STRATEGY (from the shared Strategy Hub) */}
      <div className="bg-panel border border-edge rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical size={16} className="text-accent" />
          <h2 className="text-base font-extrabold text-white">Copy a Strategy</h2>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-full px-2 py-0.5">Simulated</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Pick any strategy from the <Link href="/strategies" className="text-accent font-bold">Strategy Hub</Link> and copy it
          into your demo account. It places a real demo trade for your allocation — entry, exit, fees and net P&L all tracked.
          Past performance never guarantees future profit.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
          <div className="col-span-2 lg:col-span-1">
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Strategy</label>
            <select value={stratId} onChange={(e) => setStratId(e.target.value)}
              className="w-full bg-void border border-edge rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/60">
              {HUB_STRATEGIES.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.tag}</option>)}
            </select>
            {stratDef && <p className="text-[11px] text-slate-500 mt-1">{stratDef.desc}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Symbol</label>
            <select value={stratSymbol} onChange={(e) => setStratSymbol(e.target.value)}
              className="w-full bg-void border border-edge rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/60">
              {STRAT_SYMBOLS.map((s) => <option key={s} value={s}>{s}/USD</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Allocation (USD)</label>
            <input type="number" min="10" value={stratAmount} onChange={(e) => setStratAmount(e.target.value)}
              className="w-full bg-void border border-edge rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-accent/60" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Risk multiplier</label>
            <input type="number" min="0.1" step="0.1" value={riskMult} onChange={(e) => setRiskMult(e.target.value)}
              className="w-full bg-void border border-edge rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-accent/60" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Stop-loss %</label>
            <input type="number" min="0" step="0.5" value={slPct} onChange={(e) => setSlPct(e.target.value)}
              className="w-full bg-void border border-edge rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-accent/60" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1 block">Max daily loss (USD)</label>
            <input type="number" min="0" value={maxDailyLoss} onChange={(e) => setMaxDailyLoss(e.target.value)}
              className="w-full bg-void border border-edge rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-accent/60" />
          </div>
        </div>
        <button onClick={startStratCopy} disabled={stratBusy}
          className="flex items-center gap-1.5 bg-accent hover:bg-accent/85 disabled:opacity-50 text-white text-sm font-bold rounded-xl px-5 py-2.5 transition">
          <Copy size={14} /> {stratBusy ? 'Starting…' : 'Start strategy copy'}
        </button>
      </div>

      {stratCopies.length > 0 && (
        <div className="bg-panel border border-edge rounded-2xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-edge text-sm font-semibold text-white flex items-center gap-2">
            <TrendingUp size={15} className="text-accent" /> My strategy copies <span className="text-[10px] text-slate-500 font-normal">(demo)</span>
          </div>
          <div className="divide-y divide-edge/60">
            {stratCopies.map((c) => (
              <div key={c.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-slate-400 text-xs">{new Date(c.time).toLocaleDateString()}</span>
                <span className="text-white font-semibold">{c.strategyName}</span>
                <span className="font-mono text-accent font-bold">{c.symbol}</span>
                <span className="text-slate-400 text-xs">{fmtUSD(c.amount)} @ {fmtUSD(c.entryPrice, 4)} · Risk ×{c.risk} · SL {c.slPct}%</span>
                <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
                  c.status === 'active' ? 'text-up bg-up/15' : c.status === 'paused' ? 'text-amber-300 bg-amber-400/15' : 'text-slate-400 bg-white/10')}>
                  {c.status}
                </span>
                {c.realizedPnl !== null && (
                  <span className={cn('font-mono font-bold', c.realizedPnl >= 0 ? 'text-up' : 'text-down')}>
                    Realized {fmtUSD(c.realizedPnl)}
                  </span>
                )}
                <span className="ml-auto flex gap-1.5">
                  {c.status === 'active' && (
                    <button onClick={() => setStratStatus(c.id, 'paused')}
                      className="flex items-center gap-1 text-xs font-bold bg-panel2 border border-edge rounded-lg px-3 py-1.5 text-slate-200 hover:border-accent/60">
                      <Pause size={12} /> Pause
                    </button>
                  )}
                  {c.status === 'paused' && (
                    <button onClick={() => setStratStatus(c.id, 'active')}
                      className="flex items-center gap-1 text-xs font-bold bg-panel2 border border-edge rounded-lg px-3 py-1.5 text-slate-200 hover:border-accent/60">
                      <Play size={12} /> Resume
                    </button>
                  )}
                  {c.status !== 'stopped' && (
                    <button onClick={() => stopStratCopy(c)} disabled={stratBusy}
                      className="flex items-center gap-1 text-xs font-bold bg-down/15 border border-down/40 rounded-lg px-3 py-1.5 text-down hover:bg-down/25 disabled:opacity-50">
                      <Square size={12} /> Stop copy
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {TRADERS.map((t) => (
          <div key={t.id} className="bg-panel border border-edge rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{t.avatar}</span>
              <div className="flex-1">
                <div className="text-sm font-extrabold text-white flex items-center gap-1.5">
                  {t.name} <BadgeCheck size={14} className="text-accent" />
                </div>
                <div className="text-[11px] text-slate-500">{t.style} · 👥 {t.followers.toLocaleString()} followers</div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-3">{t.bio}</p>
            <div className="grid grid-cols-3 gap-2 mb-3 text-center">
              <div className="bg-void/60 rounded-xl py-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Win rate</div>
                <div className="text-sm font-extrabold font-mono text-white">{t.winRate}%</div>
              </div>
              <div className="bg-void/60 rounded-xl py-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">30d return</div>
                <div className={cn('text-sm font-extrabold font-mono', t.ret30d >= 0 ? 'text-up' : 'text-down')}>
                  {t.ret30d >= 0 ? '+' : ''}{t.ret30d}%
                </div>
              </div>
              <div className="bg-void/60 rounded-xl py-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Pick</div>
                <div className="text-sm font-extrabold font-mono text-accent">{t.pick.label.split(' ')[0]}</div>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 mb-3">
              <span className="font-bold text-slate-400">Recent (simulated):</span>
              <ul className="mt-1 space-y-0.5">
                {t.recent.map((r, i) => <li key={i}>• {r}</li>)}
              </ul>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min="10"
                placeholder="$ amount"
                value={amounts[t.id] ?? ''}
                onChange={(e) => setAmounts((a) => ({ ...a, [t.id]: e.target.value }))}
                className="flex-1 bg-void border border-edge rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-accent/60"
              />
              <button
                onClick={() => copyTrader(t)}
                disabled={busy === t.id}
                className="flex items-center gap-1.5 bg-accent hover:bg-accent/85 disabled:opacity-50 text-white text-sm font-bold rounded-xl px-5 py-2.5 transition"
              >
                <Copy size={14} /> {busy === t.id ? 'Copying…' : `Copy ${t.pick.label.split(' ')[0]}`}
              </button>
            </div>
          </div>
        ))}
      </div>

      {subs.length > 0 && (
        <div className="bg-panel border border-edge rounded-2xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-edge text-sm font-semibold text-white flex items-center gap-2">
            <TrendingUp size={15} className="text-accent" /> Your copy subscriptions <span className="text-[10px] text-slate-500 font-normal">(demo)</span>
          </div>
          <div className="divide-y divide-edge/60">
            {subs.map((s, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3 text-sm">
                <span className="text-slate-400 text-xs">{new Date(s.time).toLocaleDateString()}</span>
                <span className="text-white font-semibold">{s.traderName}</span>
                <span className="text-slate-500 text-xs">→</span>
                <span className="font-mono text-accent font-bold">{s.symbol}</span>
                <span className="ml-auto font-mono text-slate-300">{fmtUSD(s.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-void/60 border border-edge rounded-xl px-3 py-2.5">
        <TriangleAlert size={13} className="shrink-0 mt-0.5 text-amber-300" />
        <p>
          All traders here are <span className="text-slate-300 font-semibold">fictional</span>; stats and trades are
          simulated for education. Real copy trading copies losses, slippage and fees too.
          <span className="text-slate-300 font-semibold"> Demo only — not financial advice.</span>
        </p>
      </div>
    </div>
  );
}
