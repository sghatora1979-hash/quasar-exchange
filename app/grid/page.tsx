'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createBot, tickBot, botStats, loadBot, saveBot, validateConfig, gridLines,
  type GridBotState, type GridBotConfig,
} from '@/lib/gridbot';
import { TAX_CONFIGS, taxOnFees } from '@/lib/hub';
import { fmtUSD } from '@/lib/quasar';
import { cn } from '@/lib/utils';

const SYMBOLS = [
  { sym: 'DOGE', kraken: 'DOGEUSD', yahoo: 'DOGE-USD' },
  { sym: 'ETH', kraken: 'ETHUSD', yahoo: 'ETH-USD' },
  { sym: 'SOL', kraken: 'SOLUSD', yahoo: 'SOL-USD' },
] as const;

const FEE_RATE = 0.001; // 0.1% demo fee per fill

type GridResult = {
  fills: number;
  roundTrips: number;
  realizedPnl: number;
  floatingPnl: number;
  fees: number;
  tax: number;
  totalNet: number;
  netAfterTax: number;
  maxDrawdownPct: number;
  stopped: boolean;
  closes: number[];
  levels: number[];
  minY: number;
  maxY: number;
  lastClose: number;
};

function geometricLevels(lower: number, upper: number, grids: number): number[] {
  const ratio = Math.pow(upper / lower, 1 / grids);
  const out: number[] = [];
  for (let i = 0; i <= grids; i++) out.push(lower * Math.pow(ratio, i));
  return out;
}

export default function GridPage() {
  const [symbol, setSymbol] = useState<string>('DOGE');
  const [gridType, setGridType] = useState<'Arithmetic' | 'Geometric'>('Arithmetic');
  const [lower, setLower] = useState('80000');
  const [upper, setUpper] = useState('120000');
  const [grids, setGrids] = useState('20');
  const [investment, setInvestment] = useState('10000');
  const [country, setCountry] = useState('CA');
  const [maxExposure, setMaxExposure] = useState('');
  const [stopLossPct, setStopLossPct] = useState('10');
  const [alertOn, setAlertOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<GridResult | null>(null);

  // ---- Live grid bot (lib/gridbot) ----
  const [bot, setBot] = useState<GridBotState | null>(null);
  const [liveRunning, setLiveRunning] = useState(false);
  const [liveError, setLiveError] = useState('');
  const botRef = useRef<GridBotState | null>(null);

  useEffect(() => {
    const b = loadBot();
    if (b) {
      botRef.current = b;
      setBot(b);
    }
  }, []);

  function applyBot(next: GridBotState | null) {
    botRef.current = next;
    setBot(next);
  }

  useEffect(() => {
    if (!liveRunning) return;
    const id = setInterval(async () => {
      const cur = botRef.current;
      if (!cur) return;
      try {
        const r = await fetch(`/api/ticker?pair=${cur.config.kraken}`, { cache: 'no-store' });
        const j = await r.json();
        const px = j.ok && j.data?.[0] ? (j.data[0].price as number) : null;
        if (!px) return;
        const clone: GridBotState = JSON.parse(JSON.stringify(cur));
        tickBot(clone, px);
        saveBot(clone);
        applyBot(clone);
      } catch {
        /* ticker hiccup — keep polling */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [liveRunning]);

  const symInfo = SYMBOLS.find((s) => s.sym === symbol) ?? SYMBOLS[0];

  async function fillRange() {
    try {
      const r = await fetch(`/api/ticker?pair=${symInfo.kraken}`, { cache: 'no-store' });
      const j = await r.json();
      const px = j.ok && j.data?.[0] ? (j.data[0].price as number) : null;
      if (px) {
        setLower((px * 0.9).toFixed(2));
        setUpper((px * 1.1).toFixed(2));
      }
    } catch {
      /* ignore */
    }
  }

  async function runBacktest() {
    setError('');
    setResult(null);
    const lo = Number(lower);
    const hi = Number(upper);
    const g = Math.round(Number(grids));
    const inv = Number(investment);
    const stopPct = Number(stopLossPct);
    const maxExp = maxExposure.trim() === '' ? 0 : Number(maxExposure);
    if (!(lo > 0) || !(hi > 0)) return setError('Enter upper and lower prices above $0.');
    if (hi <= lo) return setError('Upper price must be above lower price.');
    if (!Number.isInteger(g) || g < 5 || g > 50) return setError('Grid count must be 5–50.');
    if (!(inv > 0)) return setError('Investment must be above $0.');
    setBusy(true);
    try {
      const r = await fetch(`/api/history?yahoo=${encodeURIComponent(symInfo.yahoo)}&range=6mo&interval=1d`, { cache: 'no-store' });
      const j = await r.json();
      if (!j.ok || !Array.isArray(j.c)) throw new Error('no data');
      const n = (j.t as number[]).length;
      const closes: number[] = [];
      const lows: number[] = [];
      const highs: number[] = [];
      for (let i = 0; i < n; i++) {
        const c = (j.c as number[])[i];
        if (!(c > 0)) continue;
        closes.push(c);
        lows.push((j.l as number[])[i] || c);
        highs.push((j.h as number[])[i] || c);
      }
      if (closes.length < 10) throw new Error('not enough history');

      const effectiveInv = maxExp > 0 ? Math.min(inv, maxExp) : inv;
      const levels = gridType === 'Arithmetic' ? gridLines(lo, hi, g) : geometricLevels(lo, hi, g);
      const usdPerGrid = effectiveInv / g;
      const qtyAt: number[] = new Array(levels.length).fill(0);
      const costAt: number[] = new Array(levels.length).fill(0);
      let cash = effectiveInv;
      let fees = 0;
      let fills = 0;
      let roundTrips = 0;
      let realizedNet = 0;
      let stopped = false;
      let peak = effectiveInv;
      let maxDdSeen = 0;

      for (let i = 1; i < closes.length && !stopped; i++) {
        const prev = closes[i - 1];
        const barLow = lows[i];
        const barHigh = highs[i];
        for (let li = 0; li < levels.length; li++) {
          const L = levels[li];
          if (prev > L && barLow <= L) {
            // crossed down -> buy
            if (cash >= usdPerGrid) {
              const fee = usdPerGrid * FEE_RATE;
              const qty = (usdPerGrid - fee) / L;
              qtyAt[li] += qty;
              costAt[li] += qty * L;
              cash -= usdPerGrid;
              fees += fee;
              fills += 1;
            }
          } else if (prev < L && barHigh >= L) {
            // crossed up -> sell nearest lower level holding coins
            let lvl = -1;
            for (let jj = li - 1; jj >= 0; jj--) {
              if (qtyAt[jj] > 0) { lvl = jj; break; }
            }
            if (lvl >= 0) {
              const q = qtyAt[lvl];
              const gross = q * L;
              const fee = gross * FEE_RATE;
              realizedNet += gross - fee - costAt[lvl];
              cash += gross - fee;
              fees += fee;
              qtyAt[lvl] = 0;
              costAt[lvl] = 0;
              roundTrips += 1;
              fills += 1;
            }
          }
        }
        // equity + drawdown check at bar close
        let posValue = 0;
        let costOpen = 0;
        for (let li = 0; li < levels.length; li++) {
          posValue += qtyAt[li] * closes[i];
          costOpen += costAt[li];
        }
        const equity = cash + posValue;
        if (equity > peak) peak = equity;
        const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
        if (dd > maxDdSeen) maxDdSeen = dd;
        if (stopPct > 0 && dd >= stopPct) {
          stopped = true;
          // equity at stop moment is the final equity
          const floatingPnl = posValue - costOpen;
          const totalNet = equity - effectiveInv;
          const { tax } = taxOnFees(fees, country);
          setResult({
            fills, roundTrips, realizedPnl: realizedNet, floatingPnl, fees, tax,
            totalNet, netAfterTax: totalNet - tax,
            maxDrawdownPct: maxDdSeen, stopped: true, closes, levels,
            minY: Math.min(...closes, ...levels), maxY: Math.max(...closes, ...levels),
            lastClose: closes[i],
          });
          return;
        }
      }

      let posValue = 0;
      let costOpen = 0;
      for (let li = 0; li < levels.length; li++) {
        posValue += qtyAt[li] * closes[closes.length - 1];
        costOpen += costAt[li];
      }
      const equity = cash + posValue;
      const floatingPnl = posValue - costOpen;
      const totalNet = equity - effectiveInv;
      const { tax } = taxOnFees(fees, country);
      setResult({
        fills, roundTrips, realizedPnl: realizedNet, floatingPnl, fees, tax,
        totalNet, netAfterTax: totalNet - tax,
        maxDrawdownPct: maxDdSeen, stopped: false, closes, levels,
        minY: Math.min(...closes, ...levels), maxY: Math.max(...closes, ...levels),
        lastClose: closes[closes.length - 1],
      });
    } catch {
      setError('Could not fetch price history — try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  function startLive() {
    setLiveError('');
    const cfg: GridBotConfig = {
      symbol,
      kraken: symInfo.kraken,
      lower: Number(lower),
      upper: Number(upper),
      grids: Math.round(Number(grids)),
      investment: Number(investment),
    };
    const err = validateConfig(cfg);
    if (err) return setLiveError(err);
    const b = createBot(cfg);
    saveBot(b);
    applyBot(b);
    setLiveRunning(true);
  }

  function stopLive() {
    const cur = botRef.current;
    if (cur) {
      const clone: GridBotState = JSON.parse(JSON.stringify(cur));
      clone.running = false;
      saveBot(clone);
      applyBot(clone);
    }
    setLiveRunning(false);
  }

  function resetLive() {
    saveBot(null);
    applyBot(null);
    setLiveRunning(false);
  }

  const liveStats = bot ? botStats(bot, bot.lastPrice) : null;

  // SVG chart geometry
  const W = 720;
  const H = 260;
  const chart = result
    ? (() => {
        const { closes, levels, minY, maxY } = result;
        const span = maxY - minY || 1;
        const x = (i: number) => (closes.length <= 1 ? 0 : (i / (closes.length - 1)) * W);
        const y = (v: number) => H - ((v - minY) / span) * H;
        const pts = closes.map((c, i) => `${x(i).toFixed(1)},${y(c).toFixed(1)}`).join(' ');
        return { pts, levels: levels.map((L) => ({ L, y: y(L) })) };
      })()
    : null;

  const inputCls = 'w-full bg-void border border-edge rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent/60';
  const labelCls = 'block text-xs font-semibold text-slate-400 mb-1';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-xl font-extrabold text-white">Grid Board 2.0</h1>
      <p className="text-sm text-slate-400 mt-1">
        Grid levels, fills and P&amp;L — simulated. Demo only, no real orders.
      </p>

      {/* Controls */}
      <div className="mt-6 bg-panel border border-edge rounded-2xl p-5">
        <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>Symbol</label>
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={inputCls}>
              {SYMBOLS.map((s) => (
                <option key={s.sym} value={s.sym}>{s.sym}/USD</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Grid type</label>
            <select value={gridType} onChange={(e) => setGridType(e.target.value as 'Arithmetic' | 'Geometric')} className={inputCls}>
              <option>Arithmetic</option>
              <option>Geometric</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Lower price (USD)</label>
            <input value={lower} onChange={(e) => setLower(e.target.value)} inputMode="decimal" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Upper price (USD)</label>
            <input value={upper} onChange={(e) => setUpper(e.target.value)} inputMode="decimal" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Grids (5–50)</label>
            <input value={grids} onChange={(e) => setGrids(e.target.value)} inputMode="numeric" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Investment (USD)</label>
            <input value={investment} onChange={(e) => setInvestment(e.target.value)} inputMode="decimal" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Country (tax estimate)</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls}>
              {TAX_CONFIGS.map((t) => (
                <option key={t.code} value={t.code}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={fillRange} className="w-full text-xs font-bold bg-panel2 border border-edge text-white rounded-xl px-3 py-2.5 hover:bg-panel transition">
              Fill ±10% from live price
            </button>
          </div>
        </div>

        {/* Stop conditions */}
        <div className="mt-5 border-t border-edge pt-4">
          <h3 className="text-sm font-bold text-white">Stop conditions</h3>
          <div className="mt-3 grid sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Max exposure (USD, blank = full investment)</label>
              <input value={maxExposure} onChange={(e) => setMaxExposure(e.target.value)} inputMode="decimal" placeholder="e.g. 5000" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Stop-loss on drawdown (%)</label>
              <input value={stopLossPct} onChange={(e) => setStopLossPct(e.target.value)} inputMode="decimal" className={inputCls} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={alertOn} onChange={(e) => setAlertOn(e.target.checked)} className="accent-amber-400 w-4 h-4" />
              Alert me when a stop condition hits (demo)
            </label>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        <button
          onClick={runBacktest}
          disabled={busy}
          className="mt-5 bg-accent text-black font-bold rounded-xl px-6 py-3 text-sm hover:brightness-110 transition disabled:opacity-50"
        >
          {busy ? 'Running…' : 'Run Grid Backtest'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="mt-6 bg-panel border border-edge rounded-2xl p-5">
          {result.stopped && (
            <p className="mb-4 text-sm font-semibold text-red-400 bg-red-400/10 border border-red-400/30 rounded-xl px-3 py-2">
              ⛔ Stopped: stop condition hit — drawdown reached the stop-loss limit.
              {alertOn ? ' (Alert shown — demo)' : ''}
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Fills', value: String(result.fills) },
              { label: 'Round trips', value: String(result.roundTrips) },
              { label: 'Realized P&L', value: fmtUSD(result.realizedPnl) },
              { label: 'Floating P&L', value: fmtUSD(result.floatingPnl) },
              { label: 'Fees (0.1%/fill)', value: fmtUSD(result.fees) },
              { label: 'Tax estimate', value: fmtUSD(result.tax) },
              { label: 'Total net P&L', value: fmtUSD(result.totalNet) },
              { label: 'Net after tax', value: fmtUSD(result.netAfterTax) },
            ].map((k) => (
              <div key={k.label} className="bg-void border border-edge rounded-xl px-3 py-3">
                <div className="text-[11px] text-slate-500">{k.label}</div>
                <div className="text-base font-extrabold text-white mt-0.5">{k.value}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Max drawdown: {result.maxDrawdownPct.toFixed(2)}% · Last close: {fmtUSD(result.lastClose)} ·
            Tax is a demo estimate on fees, not real tax advice.
          </p>

          {chart && (
            <div className="mt-5 overflow-x-auto">
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px] h-auto bg-void border border-edge rounded-xl">
                {chart.levels.map(({ L, y: yy }, i) => (
                  <line key={i} x1={0} x2={W} y1={yy} y2={yy} stroke="#f59e0b" strokeOpacity={0.25} strokeDasharray="4 4" />
                ))}
                <polyline points={chart.pts} fill="none" stroke="#38bdf8" strokeWidth={1.5} />
              </svg>
              <p className="mt-2 text-[11px] text-slate-500">
                Blue line = daily closes (6 months). Dashed amber = grid levels.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Live Grid Bot */}
      <div className="mt-6 bg-panel border border-edge rounded-2xl p-5">
        <h2 className="text-base font-extrabold text-white">Live Grid Bot <span className="text-[11px] font-semibold text-amber-300">(simulated)</span></h2>
        <p className="text-sm text-slate-400 mt-1">
          Uses the same controls above. Ticks against the live {symbol} price every 5 seconds.
          Simulated fills only — no real orders.
        </p>
        {liveError && <p className="mt-3 text-sm text-red-400">{liveError}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={startLive} disabled={liveRunning} className="bg-accent text-black font-bold rounded-xl px-5 py-2.5 text-sm hover:brightness-110 transition disabled:opacity-50">
            ▶ Start Live Bot
          </button>
          <button onClick={stopLive} disabled={!liveRunning} className="bg-panel2 border border-edge text-white font-bold rounded-xl px-5 py-2.5 text-sm hover:bg-panel transition disabled:opacity-50">
            ⏹ Stop
          </button>
          <button onClick={resetLive} className="bg-panel2 border border-edge text-white font-bold rounded-xl px-5 py-2.5 text-sm hover:bg-panel transition">
            Reset
          </button>
          <span className={cn('ml-1 self-center text-xs font-bold rounded-full px-3 py-1.5 border',
            liveRunning ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30' : 'bg-slate-500/10 text-slate-400 border-slate-500/30')}>
            {liveRunning ? '● LIVE (simulated)' : '○ STOPPED'}
          </span>
        </div>
        {bot && liveStats && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Equity', value: fmtUSD(liveStats.equity) },
              { label: 'Total P&L', value: fmtUSD(liveStats.totalPnl) },
              { label: 'Realized P&L', value: fmtUSD(bot.realizedPnl) },
              { label: 'Round trips', value: String(bot.roundTrips) },
              { label: 'Last price', value: bot.lastPrice ? fmtUSD(bot.lastPrice) : '—' },
              { label: 'Cash locked', value: fmtUSD(bot.cashLocked) },
              { label: 'Active buys', value: String(liveStats.activeBuys) },
              { label: 'Active sells', value: String(liveStats.activeSells) },
            ].map((k) => (
              <div key={k.label} className="bg-void border border-edge rounded-xl px-3 py-3">
                <div className="text-[11px] text-slate-500">{k.label}</div>
                <div className="text-base font-extrabold text-white mt-0.5">{k.value}</div>
              </div>
            ))}
          </div>
        )}
        {bot && bot.fills.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-bold text-white">Recent fills (simulated)</h3>
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              {bot.fills.slice(0, 10).map((f) => (
                <li key={f.id} className="bg-void border border-edge rounded-lg px-3 py-2">
                  {new Date(f.time).toLocaleTimeString()} · {f.side.toUpperCase()} {f.qty.toFixed(6)} {symbol} @ {fmtUSD(f.price)} · fee {fmtUSD(f.fee)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-slate-500 leading-relaxed">
        Demo simulation — grid fills are simulated against historical / live demo prices.
        No real trading, no real money. Not financial advice.
      </p>
    </div>
  );
}
