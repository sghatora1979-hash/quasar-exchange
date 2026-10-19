'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, Play, Square, RotateCcw, Sparkles, Bell, BellRing, Lock,
  CandlestickChart, Users, Puzzle, TriangleAlert, Trash2, RefreshCw, Building2,
} from 'lucide-react';
import { PAIRS, pairBySymbol } from '@/lib/pairs';
import { fmtUSD, loadState, saveState, paperBuy, paperSell, type PaperState } from '@/lib/quasar';
import {
  createBot, tickBot, botStats, validateConfig, loadBot, saveBot,
  type GridBotState, type GridBotConfig,
} from '@/lib/gridbot';
import {
  parsePrompt, makePromptBot, loadPromptBots, savePromptBots,
  shouldTrigger, rsi, getNotifyList, addNotify,
  type PromptBot, type ParseResult,
} from '@/lib/promptbot';
import { cn } from '@/lib/utils';
import { BrokerRegionChips, BrokerNotifyButton } from '@/components/BrokersTeaser';

const TOP_PAIRS = PAIRS.slice(0, 20);

const EXAMPLES = [
  'Buy $100 QSR when price drops 3%',
  'Sell all ETH when profit reaches 5%',
  'Buy SOL when RSI goes below 30',
  'Buy QSR when price goes above $0.0002',
  'Stop loss 2% on my ETH',
];

const COMING_SOON = [
  { id: 'futures', icon: CandlestickChart, title: 'Futures Trading', desc: 'Leveraged longs & shorts with isolated margin — long or short any pair.' },
  { id: 'copy', icon: Users, title: 'Copy Trading', desc: 'Follow top demo traders and mirror their moves automatically.' },
  { id: 'plugins', icon: Puzzle, title: 'Strategy Plugins', desc: 'Plug in your own strategy code and let it trade the demo.' },
];

type TickerMap = Record<string, number>; // kraken alt -> price

export default function BotsPage() {
  const [tab, setTab] = useState<'grid' | 'prompt'>('grid');
  const [prices, setPrices] = useState<TickerMap>({});
  const [paper, setPaper] = useState<PaperState>(() => loadState());

  // ---- grid bot ----
  const [grid, setGrid] = useState<GridBotState | null>(() => loadBot());
  const [gSymbol, setGSymbol] = useState('QSR');
  const [gUpper, setGUpper] = useState('');
  const [gLower, setGLower] = useState('');
  const [gGrids, setGGrids] = useState('10');
  const [gInvest, setGInvest] = useState('1000');
  const [gError, setGError] = useState('');

  // ---- prompt bot ----
  const [pInput, setPInput] = useState('');
  const [pDraft, setPDraft] = useState<Extract<ParseResult, { ok: true }>['draft'] | null>(null);
  const [pFail, setPFail] = useState<Extract<ParseResult, { ok: false }> | null>(null);
  const [pRepeat, setPRepeat] = useState(false);
  const [bots, setBots] = useState<PromptBot[]>(() => loadPromptBots());
  const [notify, setNotify] = useState<string[]>(() => getNotifyList());

  const rsiCache = useRef<Record<string, { rsi: number | null; at: number }>>({});

  // ---- shared live price poll (all pairs, one Kraken call) ----
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch('/api/ticker', { cache: 'no-store' });
        const j = await r.json();
        if (!alive || !j.ok) return;
        const map: TickerMap = {};
        for (const row of j.data as { kraken: string; price: number }[]) map[row.kraken] = row.price;
        setPrices(map);

        // Grid bot tick
        setGrid((g) => {
          if (!g || !g.running) return g;
          const px = map[g.config.kraken];
          if (!px) return g;
          const next = { ...g };
          tickBot(next, px);
          saveBot(next);
          return next;
        });

        // Prompt bot evaluation
        setBots((list) => {
          if (!list.length) return list;
          let paperState = loadState();
          let changed = false;
          const next = list.map((b) => {
            if (b.status !== 'watching') return b;
            const px = map[b.kraken];
            if (!px) return b;
            const holding = paperState.holdings[b.symbol];
            const ctx = {
              price: px,
              baseline: b.baselinePrice,
              rsi14: null as number | null,
              avgCost: holding ? holding.avgCost : null,
              holdingQty: holding ? holding.qty : 0,
            };
            if (!shouldTrigger(b, ctx)) return b;
            // Trigger! Execute via the paper engine.
            if (b.side === 'buy') {
              const usd = b.amountUsd ?? 100;
              const res = paperBuy(paperState, b.symbol, usd, px);
              if (!res.ok) return { ...b, note: res.error };
              saveState(paperState);
              const done = { ...b, status: 'triggered' as const, triggerPrice: px, note: `Bought ${fmtUSD(usd)} at ${fmtUSD(px)}` };
              if (b.repeat && (b.trigger.type === 'price_drop_pct' || b.trigger.type === 'price_rise_pct')) {
                return { ...done, status: 'watching' as const, baselinePrice: px, note: `Filled at ${fmtUSD(px)} — watching again` };
              }
              changed = true;
              return done;
            } else {
              const qty = b.amountUsd !== null ? b.amountUsd / px : ctx.holdingQty;
              const res = paperSell(paperState, b.symbol, qty, px);
              if (!res.ok) return { ...b, note: res.error };
              saveState(paperState);
              const pnl = ctx.avgCost !== null ? (px - ctx.avgCost) * qty : null;
              changed = true;
              return { ...b, status: 'triggered' as const, triggerPrice: px, pnlUsd: pnl, note: `Sold at ${fmtUSD(px)}` };
            }
          });
          if (changed) {
            savePromptBots(next);
            setPaper(loadState());
          }
          return changed ? next : list;
        });
      } catch {
        /* poll failed — keep old prices, never crash */
      }
    };
    poll();
    const t = setInterval(poll, 15_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // RSI fetch helper (cached per poll cycle)
  const getRsi = async (kraken: string): Promise<number | null> => {
    const c = rsiCache.current[kraken];
    if (c && Date.now() - c.at < 60_000) return c.rsi;
    try {
      const r = await fetch(`/api/ohlc?pair=${kraken}&interval=60`, { cache: 'no-store' });
      const j = await r.json();
      const closes: number[] = j.ok && Array.isArray(j.data) ? j.data.map((x: { close: number }) => x.close) : [];
      const v = rsi(closes, 14);
      rsiCache.current[kraken] = { rsi: v, at: Date.now() };
      return v;
    } catch {
      return null;
    }
  };

  // Evaluate RSI-trigger bots shortly after each poll
  useEffect(() => {
    const watching = bots.filter(
      (b) => b.status === 'watching' && (b.trigger.type === 'rsi_below' || b.trigger.type === 'rsi_above')
    );
    if (!watching.length) return;
    let cancelled = false;
    (async () => {
      for (const b of watching) {
        const v = await getRsi(b.kraken);
        if (cancelled || v === null) continue;
        const px = prices[b.kraken];
        if (!px) continue;
        setBots((list) => {
          const target = list.find((x) => x.id === b.id);
          if (!target || target.status !== 'watching') return list;
          const fire =
            (target.trigger.type === 'rsi_below' && v <= target.trigger.value) ||
            (target.trigger.type === 'rsi_above' && v >= target.trigger.value);
          if (!fire) return list;
          const paperState = loadState();
          const usd = target.amountUsd ?? 100;
          const res = paperBuy(paperState, target.symbol, usd, px);
          if (!res.ok) return list.map((x) => (x.id === b.id ? { ...x, note: res.error } : x));
          saveState(paperState);
          const next = list.map((x) =>
            x.id === b.id
              ? { ...x, status: 'triggered' as const, triggerPrice: px, note: `RSI ${v.toFixed(1)} — bought ${fmtUSD(usd)} at ${fmtUSD(px)}` }
              : x
          );
          savePromptBots(next);
          setPaper(loadState());
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices]);

  // ---- grid bot actions ----
  const startGrid = () => {
    const info = pairBySymbol(gSymbol) ?? TOP_PAIRS[0];
    const cfg: GridBotConfig = {
      symbol: info.symbol,
      kraken: info.kraken,
      upper: parseFloat(gUpper),
      lower: parseFloat(gLower),
      grids: parseInt(gGrids, 10),
      investment: parseFloat(gInvest),
    };
    const err = validateConfig(cfg);
    if (err) {
      setGError(err);
      return;
    }
    setGError('');
    const bot = createBot(cfg);
    saveBot(bot);
    setGrid({ ...bot });
  };

  const stopGrid = () => {
    setGrid((g) => {
      if (!g) return g;
      const next = { ...g, running: false };
      saveBot(next);
      return next;
    });
  };

  const resetGrid = () => {
    saveBot(null);
    setGrid(null);
  };

  const fillRange = async () => {
    const info = pairBySymbol(gSymbol) ?? TOP_PAIRS[0];
    try {
      const r = await fetch(`/api/ticker?pair=${info.kraken}`, { cache: 'no-store' });
      const j = await r.json();
      const px = j.ok && j.data[0] ? j.data[0].price : null;
      if (px) {
        setGLower((px * 0.9).toFixed(info.decimals > 4 ? 6 : 2));
        setGUpper((px * 1.1).toFixed(info.decimals > 4 ? 6 : 2));
      }
    } catch {
      /* ignore */
    }
  };

  // ---- prompt bot actions ----
  const createDraft = () => {
    const res = parsePrompt(pInput);
    if (res.ok) {
      setPDraft(res.draft);
      setPFail(null);
    } else {
      setPDraft(null);
      setPFail(res);
    }
  };

  const confirmDraft = () => {
    if (!pDraft) return;
    const px = prices[pDraft.kraken] ?? null;
    const bot = makePromptBot(pDraft, px, pRepeat);
    const next = [bot, ...bots];
    setBots(next);
    savePromptBots(next);
    setPDraft(null);
    setPInput('');
    setPRepeat(false);
  };

  const deleteBot = (id: string) => {
    const next = bots.filter((b) => b.id !== id);
    setBots(next);
    savePromptBots(next);
  };

  const gridStats = useMemo(() => {
    if (!grid) return null;
    const px = prices[grid.config.kraken] ?? grid.lastPrice;
    return { stats: botStats(grid, px), price: px };
  }, [grid, prices]);

  const gridPrice = grid ? prices[grid.config.kraken] ?? grid.lastPrice : null;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <Bot size={24} className="text-accent" />
          Trading Bots
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-300 live-dot" />
            Paper trading
          </span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Automate demo strategies on live prices — <span className="text-amber-300/90 font-semibold">no real money</span>
        </p>
      </div>

      <div className="flex gap-2 mb-5">
        {(['grid', 'prompt'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition',
              tab === t
                ? 'bg-accent/15 border-accent/50 text-white'
                : 'bg-panel border-edge text-slate-400 hover:text-white'
            )}
          >
            {t === 'grid' ? <CandlestickChart size={15} /> : <Sparkles size={15} />}
            {t === 'grid' ? 'Grid Bot' : 'Prompt Bot'}
          </button>
        ))}
      </div>

      {tab === 'grid' && (
        <GridBotSection
          grid={grid}
          prices={prices}
          gridStats={gridStats}
          gridPrice={gridPrice}
          gSymbol={gSymbol}
          setGSymbol={setGSymbol}
          gUpper={gUpper}
          setGUpper={setGUpper}
          gLower={gLower}
          setGLower={setGLower}
          gGrids={gGrids}
          setGGrids={setGGrids}
          gInvest={gInvest}
          setGInvest={setGInvest}
          gError={gError}
          startGrid={startGrid}
          stopGrid={stopGrid}
          resetGrid={resetGrid}
          fillRange={fillRange}
        />
      )}

      {tab === 'prompt' && (
        <PromptBotSection
          pInput={pInput}
          setPInput={setPInput}
          pDraft={pDraft}
          pFail={pFail}
          pRepeat={pRepeat}
          setPRepeat={setPRepeat}
          createDraft={createDraft}
          confirmDraft={confirmDraft}
          cancelDraft={() => {
            setPDraft(null);
            setPFail(null);
          }}
          bots={bots}
          prices={prices}
          deleteBot={deleteBot}
        />
      )}

      <div className="mt-10">
        <h2 className="text-lg font-extrabold text-white mb-1 flex items-center gap-2">
          <Lock size={17} className="text-accent2" />
          Coming soon
        </h2>
        <p className="text-xs text-slate-500 mb-4">Locked for now — tap “Notify me” and we will remember your interest (demo).</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {COMING_SOON.map(({ id, icon: Icon, title, desc }) => {
            const onList = notify.includes(id);
            return (
              <div key={id} className="scanlines bg-panel border border-edge rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-void/40" />
                <div className="relative">
                  <span className="w-10 h-10 rounded-xl bg-panel2 border border-edge flex items-center justify-center text-slate-400">
                    <Icon size={18} />
                  </span>
                  <h3 className="mt-3 font-bold text-white flex items-center gap-2">
                    {title}
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 border border-edge rounded-full px-2 py-0.5">
                      Soon
                    </span>
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{desc}</p>
                  <button
                    onClick={() => setNotify(addNotify(id))}
                    disabled={onList}
                    className={cn(
                      'mt-4 flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border transition',
                      onList
                        ? 'text-emerald-300 border-emerald-400/40 bg-emerald-400/10 cursor-default'
                        : 'text-slate-200 border-edge bg-panel2 hover:border-accent/60'
                    )}
                  >
                    {onList ? <BellRing size={13} /> : <Bell size={13} />}
                    {onList ? "You're on the list" : 'Notify me'}
                  </button>
                </div>
              </div>
            );
          })}
          {/* Brokers — coming soon (spans the row) */}
          <div className="sm:col-span-3 scanlines bg-panel border border-edge rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-void/40" />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="w-10 h-10 rounded-xl bg-panel2 border border-edge flex items-center justify-center text-slate-400">
                  <Building2 size={18} />
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 border border-edge rounded-full px-2 py-0.5">
                  Soon
                </span>
              </div>
              <h3 className="font-bold text-white">Brokers</h3>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed max-w-2xl">
                Paper trading now. Real broker connections need exchange licensing — coming after launch.
              </p>
              <div className="mt-4">
                <BrokerRegionChips />
              </div>
              <div className="mt-4">
                <BrokerNotifyButton />
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-6 text-[11px] text-slate-500 leading-relaxed">
        Demo only: bots trade play money on live prices. Prompt Bot understands common patterns —
        connect an AI key at launch for free-text understanding. Nothing here is financial advice.
      </p>
    </div>
  );
}

/* ================= GRID BOT SECTION ================= */

function GridBotSection(props: {
  grid: GridBotState | null;
  prices: Record<string, number>;
  gridStats: { stats: ReturnType<typeof botStats>; price: number | null } | null;
  gridPrice: number | null;
  gSymbol: string;
  setGSymbol: (s: string) => void;
  gUpper: string;
  setGUpper: (s: string) => void;
  gLower: string;
  setGLower: (s: string) => void;
  gGrids: string;
  setGGrids: (s: string) => void;
  gInvest: string;
  setGInvest: (s: string) => void;
  gError: string;
  startGrid: () => void;
  stopGrid: () => void;
  resetGrid: () => void;
  fillRange: () => void;
}) {
  const {
    grid, gridStats, gridPrice, gSymbol, setGSymbol, gUpper, setGUpper, gLower, setGLower,
    gGrids, setGGrids, gInvest, setGInvest, gError, startGrid, stopGrid, resetGrid, fillRange,
  } = props;

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      {/* Config */}
      <div className="lg:col-span-2 scanlines bg-panel border border-edge rounded-2xl p-5">
        <h2 className="font-extrabold text-white">Grid bot setup</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Buys low and sells high inside your range — automatically, on live prices.
        </p>
        <label className="block text-xs font-semibold text-slate-400 mb-1">Pair</label>
        <select
          value={gSymbol}
          onChange={(e) => setGSymbol(e.target.value)}
          disabled={!!grid}
          className="w-full bg-void border border-edge rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/60 disabled:opacity-50 mb-3"
        >
          {TOP_PAIRS.map((p) => (
            <option key={p.symbol} value={p.symbol}>
              {p.symbol}/USD — {p.name}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Lower price $</label>
            <input
              value={gLower}
              onChange={(e) => setGLower(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              disabled={!!grid}
              className="w-full bg-void border border-edge rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-accent/60 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Upper price $</label>
            <input
              value={gUpper}
              onChange={(e) => setGUpper(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              disabled={!!grid}
              className="w-full bg-void border border-edge rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-accent/60 disabled:opacity-50"
            />
          </div>
        </div>
        <button onClick={fillRange} disabled={!!grid} className="text-xs font-semibold text-accent2 hover:underline disabled:opacity-40 mb-3">
          Set ±10% around live price
        </button>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Grids (5–50)</label>
            <input
              value={gGrids}
              onChange={(e) => setGGrids(e.target.value)}
              inputMode="numeric"
              disabled={!!grid}
              className="w-full bg-void border border-edge rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-accent/60 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Investment $</label>
            <input
              value={gInvest}
              onChange={(e) => setGInvest(e.target.value)}
              inputMode="decimal"
              disabled={!!grid}
              className="w-full bg-void border border-edge rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-accent/60 disabled:opacity-50"
            />
          </div>
        </div>
        {gError && (
          <p className="flex items-center gap-1.5 text-xs text-amber-300 mb-3">
            <TriangleAlert size={13} />
            {gError}
          </p>
        )}
        {!grid ? (
          <button
            onClick={startGrid}
            className="w-full flex items-center justify-center gap-2 font-bold text-sm text-white rounded-xl px-4 py-3 bg-gradient-to-r from-accentdeep to-accent hover:brightness-110 transition shadow-lg shadow-accent/25"
          >
            <Play size={15} />
            Start grid bot (demo)
          </button>
        ) : (
          <div className="flex gap-2">
            {grid.running ? (
              <button
                onClick={stopGrid}
                className="flex-1 flex items-center justify-center gap-2 font-bold text-sm text-white rounded-xl px-4 py-3 bg-down/90 hover:bg-down transition"
              >
                <Square size={14} />
                Stop
              </button>
            ) : (
              <button
                onClick={() => {
                  const next = { ...grid, running: true };
                  saveBot(next);
                  window.location.reload();
                }}
                className="flex-1 flex items-center justify-center gap-2 font-bold text-sm text-white rounded-xl px-4 py-3 bg-gradient-to-r from-accentdeep to-accent hover:brightness-110 transition"
              >
                <Play size={14} />
                Resume
              </button>
            )}
            <button
              onClick={resetGrid}
              className="flex items-center justify-center gap-2 font-bold text-sm text-slate-300 rounded-xl px-4 py-3 bg-panel2 border border-edge hover:border-down/60 transition"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </div>
        )}
        <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
          How it works: your investment is split across grid lines. When the price drops through a
          line, the bot buys; when it rises through a line holding coins, it sells for a profit.
        </p>
      </div>

      {/* Live status */}
      <div className="lg:col-span-3 scanlines bg-panel border border-edge rounded-2xl p-5">
        {!grid ? (
          <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center text-slate-500 text-sm">
            <Bot size={32} className="mb-3 text-slate-600" />
            No grid bot running.
            <span className="text-xs mt-1">Configure on the left and press Start.</span>
          </div>
        ) : (
          <GridBotLive grid={grid} gridStats={gridStats} gridPrice={gridPrice} />
        )}
      </div>
    </div>
  );
}

function GridBotLive({
  grid, gridStats, gridPrice,
}: {
  grid: GridBotState;
  gridStats: { stats: ReturnType<typeof botStats>; price: number | null } | null;
  gridPrice: number | null;
}) {
  const st = gridStats?.stats;
  const px = gridPrice;
  const pnl = st ? st.totalPnl : 0;
  const pnlUp = pnl >= 0;

  // Ladder rows high -> low with a current-price marker
  const rows = useMemo(() => {
    const desc = grid.lines.map((L, i) => ({ L, i })).reverse();
    const out: { kind: 'line' | 'marker'; L?: number; i?: number }[] = [];
    let markerPlaced = false;
    for (const r of desc) {
      if (!markerPlaced && px !== null && px >= r.L) {
        out.push({ kind: 'marker' });
        markerPlaced = true;
      }
      out.push({ kind: 'line', L: r.L, i: r.i });
    }
    if (!markerPlaced) out.push({ kind: 'marker' });
    return out;
  }, [grid.lines, px]);

  const eq = grid.equityCurve;
  const eqMin = eq.length ? Math.min(...eq.map((e) => e.equity)) : 0;
  const eqMax = eq.length ? Math.max(...eq.map((e) => e.equity)) : 1;
  const eqPath =
    eq.length > 1
      ? eq
          .map((e, i) => {
            const x = (i / (eq.length - 1)) * 100;
            const y = 34 - ((e.equity - eqMin) / Math.max(1e-9, eqMax - eqMin)) * 30;
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ')
      : '';

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h3 className="font-extrabold text-white">
          {grid.config.symbol}/USD grid
          <span className={cn('ml-2 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border', grid.running ? 'text-emerald-300 border-emerald-400/40 bg-emerald-400/10' : 'text-slate-400 border-edge bg-panel2')}>
            {grid.running ? 'Running' : 'Paused'}
          </span>
        </h3>
        <span className="ml-auto font-mono text-lg font-bold text-white glow-accent2">
          {px !== null ? fmtUSD(px) : '—'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {[
          { label: 'Total P&L', value: `${pnlUp ? '+' : ''}${fmtUSD(pnl)}`, up: pnlUp },
          { label: 'Realized', value: `${grid.realizedPnl >= 0 ? '+' : ''}${fmtUSD(grid.realizedPnl)}`, up: grid.realizedPnl >= 0 },
          { label: 'Round trips', value: String(grid.roundTrips), up: null },
          { label: 'Fills', value: String(grid.fills.length), up: null },
        ].map(({ label, value, up }) => (
          <div key={label} className="bg-void border border-edge rounded-xl px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
            <div className={cn('font-mono font-bold text-sm mt-0.5', up === null ? 'text-white' : up ? 'text-up' : 'text-down')}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Price ladder */}
        <div>
          <div className="text-xs font-semibold text-slate-400 mb-2">Price ladder</div>
          <div className="bg-void border border-edge rounded-xl max-h-64 overflow-y-auto py-1">
            {rows.map((r, idx) =>
              r.kind === 'marker' ? (
                <div key={`m-${idx}`} className="flex items-center gap-2 px-3 py-1 bg-accent2/10 border-y border-accent2/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent2 live-dot" />
                  <span className="text-[11px] font-mono font-bold text-accent2">
                    {px !== null ? fmtUSD(px) : '—'}
                  </span>
                </div>
              ) : (
                (() => {
                  const lvl = grid.levels[r.i!];
                  const isBuySide = px !== null && r.L! < px;
                  return (
                    <div key={`l-${r.i}`} className="flex items-center gap-2 px-3 py-1 text-[11px] font-mono">
                      <span className={cn('w-10 font-black text-[9px] px-1.5 py-0.5 rounded text-center', isBuySide ? 'text-up bg-up/10' : 'text-down bg-down/10')}>
                        {isBuySide ? 'BUY' : 'SELL'}
                      </span>
                      <span className="text-slate-300 tabular-nums">{fmtUSD(r.L!)}</span>
                      {lvl.qty > 0 && (
                        <span className="ml-auto text-[10px] text-amber-300 bg-amber-400/10 rounded px-1.5 py-0.5">
                          holding {lvl.qty.toFixed(6)}
                        </span>
                      )}
                    </div>
                  );
                })()
              )
            )}
          </div>
        </div>
        {/* Equity curve + fills */}
        <div>
          <div className="text-xs font-semibold text-slate-400 mb-2">Bot equity</div>
          <div className="bg-void border border-edge rounded-xl p-2 h-[104px]">
            {eqPath ? (
              <svg viewBox="0 0 100 36" className="w-full h-full" preserveAspectRatio="none">
                <path d={eqPath} fill="none" stroke="var(--accent2, #22d3ee)" strokeWidth="1.5" />
              </svg>
            ) : (
              <div className="h-full flex items-center justify-center text-[11px] text-slate-600">
                Waiting for price data…
              </div>
            )}
          </div>
          <div className="text-xs font-semibold text-slate-400 mt-3 mb-2">Recent fills</div>
          <div className="bg-void border border-edge rounded-xl max-h-32 overflow-y-auto">
            {grid.fills.length === 0 && (
              <div className="px-3 py-4 text-[11px] text-slate-600 text-center">No fills yet.</div>
            )}
            {grid.fills.slice(0, 12).map((f) => (
              <div key={f.id} className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono border-b border-edge/50 last:border-0">
                <span className={cn('font-black text-[9px] px-1.5 py-0.5 rounded', f.side === 'buy' ? 'text-up bg-up/10' : 'text-down bg-down/10')}>
                  {f.side.toUpperCase()}
                </span>
                <span className="text-slate-300 tabular-nums">{fmtUSD(f.price)}</span>
                <span className="ml-auto text-slate-500 tabular-nums">{new Date(f.time).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= PROMPT BOT SECTION ================= */

function PromptBotSection(props: {
  pInput: string;
  setPInput: (s: string) => void;
  pDraft: Extract<ParseResult, { ok: true }>['draft'] | null;
  pFail: Extract<ParseResult, { ok: false }> | null;
  pRepeat: boolean;
  setPRepeat: (b: boolean) => void;
  createDraft: () => void;
  confirmDraft: () => void;
  cancelDraft: () => void;
  bots: PromptBot[];
  prices: Record<string, number>;
  deleteBot: (id: string) => void;
}) {
  const { pInput, setPInput, pDraft, pFail, pRepeat, setPRepeat, createDraft, confirmDraft, cancelDraft, bots, prices, deleteBot } = props;

  return (
    <div>
      <div className="scanlines bg-panel border border-edge rounded-2xl p-5 mb-4">
        <h2 className="font-extrabold text-white flex items-center gap-2">
          <Sparkles size={17} className="text-accent2" />
          Describe your strategy in plain English
        </h2>
        <p className="text-xs text-slate-500 mt-1 mb-3">
          Demo: understands common patterns. Connect an AI key at launch for free-text understanding.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={pInput}
            onChange={(e) => setPInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createDraft()}
            placeholder="e.g. Buy $100 QSR when price drops 3%"
            className="flex-1 bg-void border border-edge rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent/60"
          />
          <button
            onClick={createDraft}
            className="font-bold text-sm text-white rounded-xl px-6 py-3 bg-gradient-to-r from-accentdeep to-accent hover:brightness-110 transition shadow-lg shadow-accent/25"
          >
            Create bot
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setPInput(ex)}
              className="text-[11px] text-slate-400 border border-edge rounded-full px-3 py-1.5 hover:text-white hover:border-accent/60 transition"
            >
              {ex}
            </button>
          ))}
        </div>

        {pFail && (
          <div className="mt-4 bg-amber-400/5 border border-amber-400/30 rounded-xl p-4">
            <p className="text-xs text-amber-300 font-semibold">{pFail.reason}</p>
            <p className="text-[11px] text-slate-500 mt-1">Try one of these:</p>
            <ul className="mt-1 space-y-1">
              {pFail.suggestions.map((s) => (
                <li key={s}>
                  <button onClick={() => setPInput(s)} className="text-[11px] text-accent2 hover:underline font-mono">
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {pDraft && (
          <div className="mt-4 bg-void border border-accent/40 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">I understood:</p>
            <p className="text-sm font-bold text-white">{pDraft.summary}</p>
            <p className="text-[11px] text-slate-500 mt-1 font-mono term-caret">
              confidence {Math.round(pDraft.confidence * 100)}%
            </p>
            {pDraft.warnings.map((w) => (
              <p key={w} className="text-[11px] text-amber-300/90 mt-1">
                Note: {w}
              </p>
            ))}
            <label className="flex items-center gap-2 mt-3 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={pRepeat}
                onChange={(e) => setPRepeat(e.target.checked)}
                className="w-4 h-4 accent-[#FF9933]"
              />
              Repeat after each fill (for drop/rise triggers)
            </label>
            <div className="flex gap-2 mt-3">
              <button
                onClick={confirmDraft}
                className="font-bold text-sm text-white rounded-xl px-5 py-2.5 bg-gradient-to-r from-accentdeep to-accent hover:brightness-110 transition"
              >
                Confirm & activate
              </button>
              <button
                onClick={cancelDraft}
                className="text-sm font-semibold text-slate-400 rounded-xl px-5 py-2.5 border border-edge hover:text-white transition"
              >
                Edit
              </button>
            </div>
          </div>
        )}
      </div>

      <h3 className="text-sm font-extrabold text-white mb-2 flex items-center gap-2">
        <RefreshCw size={14} className="text-accent2" />
        My prompt bots ({bots.length})
      </h3>
      {bots.length === 0 && (
        <div className="bg-panel border border-edge rounded-2xl px-4 py-8 text-center text-sm text-slate-500">
          No prompt bots yet — describe a strategy above to create one.
        </div>
      )}
      <div className="space-y-2.5">
        {bots.map((b) => {
          const px = prices[b.kraken] ?? null;
          let pnl: number | null = null;
          if (b.status === 'triggered' && b.side === 'buy' && b.triggerPrice && b.amountUsd && px) {
            pnl = ((px - b.triggerPrice) / b.triggerPrice) * b.amountUsd;
          } else if (b.status === 'triggered' && b.side === 'sell' && b.pnlUsd !== null) {
            pnl = b.pnlUsd;
          }
          const watching = b.status === 'watching';
          return (
            <div key={b.id} className="scanlines bg-panel border border-edge rounded-2xl px-4 py-3.5 flex flex-wrap items-center gap-3">
              <span className={cn('text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border', watching ? 'text-sky-300 border-sky-400/40 bg-sky-400/10' : 'text-emerald-300 border-emerald-400/40 bg-emerald-400/10')}>
                {watching ? 'Watching' : 'Triggered'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{b.summary}</p>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {b.repeat ? 'repeat on · ' : ''}
                  created {new Date(b.createdAt).toLocaleString()}
                  {b.note ? ` · ${b.note}` : ''}
                </p>
              </div>
              {pnl !== null && (
                <span className={cn('font-mono text-sm font-bold tabular-nums', pnl >= 0 ? 'text-up' : 'text-down')}>
                  {pnl >= 0 ? '+' : ''}{fmtUSD(pnl)}
                </span>
              )}
              <button
                onClick={() => deleteBot(b.id)}
                className="text-slate-500 hover:text-down transition p-1.5"
                aria-label="Delete bot"
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
