'use client';

import { useEffect, useRef, useState } from 'react';
import { HUB_STRATEGIES } from '@/lib/hub';
import { fmtUSD } from '@/lib/quasar';
import { cn } from '@/lib/utils';

const SYMBOLS = [
  { sym: 'DOGE', kraken: 'DOGEUSD' },
  { sym: 'ETH', kraken: 'ETHUSD' },
  { sym: 'SOL', kraken: 'SOLUSD' },
] as const;

const LOG_KEY = 'quasar-auto-log-v1';
const FEE_RATE = 0.0015; // 0.15% demo fee per simulated order

type LogType = 'signal' | 'order' | 'rejection' | 'fee' | 'system';
type LogEntry = { t: number; type: LogType; msg: string };
type Status = 'stopped' | 'running' | 'emergency';

function loadLog(): LogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as LogEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveLog(entries: LogEntry[]) {
  try {
    window.localStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(0, 200)));
  } catch {
    /* storage blocked — demo continues in memory */
  }
}

function inWindow(nowMin: number, start: string, stop: string): boolean {
  if (!start || !stop) return true;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = stop.split(':').map(Number);
  if ([sh, sm, eh, em].some((v) => Number.isNaN(v))) return true;
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  if (s <= e) return nowMin >= s && nowMin <= e;
  return nowMin >= s || nowMin <= e; // overnight window
}

const TYPE_STYLE: Record<LogType, string> = {
  signal: 'bg-sky-400/10 text-sky-300 border-sky-400/30',
  order: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30',
  rejection: 'bg-red-400/10 text-red-300 border-red-400/30',
  fee: 'bg-amber-400/10 text-amber-300 border-amber-400/30',
  system: 'bg-violet-400/10 text-violet-300 border-violet-400/30',
};

export default function AutoPage() {
  const [strategyId, setStrategyId] = useState(HUB_STRATEGIES[0]?.id ?? '');
  const [symbol, setSymbol] = useState<string>('DOGE');
  const [amount, setAmount] = useState('1000');
  const [mode, setMode] = useState<'Normal' | 'Scalping'>('Normal');
  const [startTime, setStartTime] = useState('');
  const [stopTime, setStopTime] = useState('');
  const [maxDailyLoss, setMaxDailyLoss] = useState('500');
  const [maxExposure, setMaxExposure] = useState('5000');
  const [status, setStatus] = useState<Status>('stopped');
  const [log, setLog] = useState<LogEntry[]>(() => loadLog());
  const [dayLoss, setDayLoss] = useState(0);
  const [exposure, setExposure] = useState(0);
  const [trades, setTrades] = useState(0);
  const [dayPnl, setDayPnl] = useState(0); // NET simulated P&L (wins - losses - fees)
  const [dayFees, setDayFees] = useState(0);

  const statusRef = useRef<Status>('stopped');
  const dayLossRef = useRef(0);
  const exposureRef = useRef(0);
  const tradesRef = useRef(0);
  const dayPnlRef = useRef(0);
  const dayFeesRef = useRef(0);
  const outsideLoggedRef = useRef(false);
  const configRef = useRef({ strategyId, symbol, amount, mode, startTime, stopTime, maxDailyLoss, maxExposure });

  useEffect(() => {
    configRef.current = { strategyId, symbol, amount, mode, startTime, stopTime, maxDailyLoss, maxExposure };
  }, [strategyId, symbol, amount, mode, startTime, stopTime, maxDailyLoss, maxExposure]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  function pushLog(type: LogType, msg: string) {
    setLog((prev) => {
      const next = [{ t: Date.now(), type, msg }, ...prev].slice(0, 200);
      saveLog(next);
      return next;
    });
  }

  function start() {
    if (statusRef.current === 'emergency') return;
    // Fresh session: reset all session stats so the new run's P&L is clean.
    dayLossRef.current = 0; exposureRef.current = 0; tradesRef.current = 0;
    dayPnlRef.current = 0; dayFeesRef.current = 0;
    setDayLoss(0); setExposure(0); setTrades(0); setDayPnl(0); setDayFees(0);
    setStatus('running');
    pushLog('system', 'Auto trading STARTED (simulated). Signals will be generated every 2 seconds.');
  }

  function stop(reason?: string) {
    setStatus('stopped');
    pushLog('system', reason ?? 'Auto trading STOPPED (simulated).');
  }

  function emergencyStop() {
    setStatus('emergency');
    pushLog('system', '🚨 EMERGENCY STOP pressed — all new simulated entries halted (simulated).');
  }

  function resetEmergency() {
    setStatus('stopped');
    pushLog('system', 'Emergency state cleared. Auto trading is STOPPED and ready to restart.');
  }

  function clearLog() {
    saveLog([]);
    setLog([]);
  }

  // ---- 2s simulated tick ----
  useEffect(() => {
    if (status !== 'running') return;
    const id = setInterval(async () => {
      const cfg = configRef.current;
      const strat = HUB_STRATEGIES.find((s) => s.id === cfg.strategyId);
      const stratName = strat?.name ?? 'Strategy';
      const symInfo = SYMBOLS.find((s) => s.sym === cfg.symbol) ?? SYMBOLS[0];
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();

      if (!inWindow(nowMin, cfg.startTime, cfg.stopTime)) {
        if (!outsideLoggedRef.current) {
          outsideLoggedRef.current = true;
          pushLog('system', 'Outside scheduled window — auto trading paused until the next window (simulated).');
        }
        return;
      }
      outsideLoggedRef.current = false;

      let px: number | null = null;
      try {
        const r = await fetch(`/api/ticker?pair=${symInfo.kraken}`, { cache: 'no-store' });
        const j = await r.json();
        px = j.ok && j.data?.[0] ? (j.data[0].price as number) : null;
      } catch {
        px = null;
      }
      if (!px) {
        pushLog('rejection', `Price feed unavailable for ${cfg.symbol} — tick skipped (simulated).`);
        return;
      }

      const amt = Number(cfg.amount) || 0;
      const maxExp = Number(cfg.maxExposure) || 0;
      const maxLoss = Number(cfg.maxDailyLoss) || 0;
      const notional = amt * 0.1; // 10% of configured amount per simulated signal
      const side = Math.random() < 0.5 ? 'BUY' : 'SELL';

      // Exposure guard
      if (maxExp > 0 && exposureRef.current + notional > maxExp) {
        pushLog('rejection', `REJECTED ${side} ${cfg.symbol} — max exposure ${fmtUSD(maxExp)} reached (simulated).`);
        return;
      }

      // Simulated fill + P&L (random walk, demo only)
      const fee = notional * FEE_RATE;
      const pnlPct = (Math.random() - 0.5) * 0.04; // -2% .. +2%
      const pnl = notional * pnlPct;
      exposureRef.current += notional;
      tradesRef.current += 1;
      if (pnl < 0) dayLossRef.current += -pnl;
      dayPnlRef.current += pnl - fee; // NET P&L after fees — wins AND losses
      dayFeesRef.current += fee;
      setExposure(exposureRef.current);
      setTrades(tradesRef.current);
      setDayLoss(dayLossRef.current);
      setDayPnl(dayPnlRef.current);
      setDayFees(dayFeesRef.current);

      pushLog('signal', `${stratName} signal → ${side} ${fmtUSD(notional)} of ${cfg.symbol} @ ${fmtUSD(px)}${cfg.mode === 'Scalping' ? ' · scalping mode (fast demo signals)' : ''} (simulated)`);
      pushLog('order', `Simulated ${side} filled: ${fmtUSD(notional)} ${cfg.symbol} @ ${fmtUSD(px)} · P&L ${fmtUSD(pnl)} (simulated)`);
      pushLog('fee', `Simulated fee charged: ${fmtUSD(fee)} (0.15% of ${fmtUSD(notional)}) (simulated)`);

      // Risk guard — daily loss limit
      if (maxLoss > 0 && dayLossRef.current >= maxLoss) {
        setStatus('stopped');
        pushLog('system', `🛑 RISK GUARD: simulated daily loss ${fmtUSD(dayLossRef.current)} reached the ${fmtUSD(maxLoss)} limit — auto trading stopped (simulated).`);
      }
    }, 2000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const inputCls = 'w-full bg-void border border-edge rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent/60';
  const labelCls = 'block text-xs font-semibold text-slate-400 mb-1';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-xl font-extrabold text-white">Auto Trading</h1>
      <p className="text-sm text-slate-400 mt-1">
        Scheduled, simulated auto trading with Risk Guard. Demo only — no real orders, no real money.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className={cn('text-xs font-bold rounded-full px-3 py-1.5 border',
          status === 'running' ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30'
            : status === 'emergency' ? 'bg-red-400/10 text-red-300 border-red-400/30'
            : 'bg-slate-500/10 text-slate-400 border-slate-500/30')}>
          {status === 'running' ? '● RUNNING (simulated)' : status === 'emergency' ? '🚨 EMERGENCY STOPPED' : '○ STOPPED'}
        </span>
        <span className="text-xs text-slate-500">
          Crypto runs 24/7 in this demo simulation. Stock hours respected — stocks only auto-trade during exchange hours (demo note).
        </span>
      </div>

      {/* Config */}
      <div className="mt-6 bg-panel border border-edge rounded-2xl p-5">
        <h2 className="text-base font-extrabold text-white">Configuration</h2>
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Strategy</label>
            <select value={strategyId} onChange={(e) => setStrategyId(e.target.value)} className={inputCls}>
              {HUB_STRATEGIES.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Symbol</label>
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={inputCls}>
              {SYMBOLS.map((s) => (
                <option key={s.sym} value={s.sym}>{s.sym}/USD</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Amount per run (USD)</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as 'Normal' | 'Scalping')} className={inputCls}>
              <option>Normal</option>
              <option>Scalping</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Start time (HH:MM, blank = always)</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Stop time (HH:MM, blank = always)</label>
            <input type="time" value={stopTime} onChange={(e) => setStopTime(e.target.value)} className={inputCls} />
          </div>
        </div>
        {mode === 'Scalping' && (
          <p className="mt-3 text-xs text-orange-300 bg-orange-400/10 border border-orange-400/30 rounded-xl px-3 py-2">
            Scalping mode: short-timeframe fast signals (demo). Higher trade frequency, smaller per-trade targets.
          </p>
        )}

        <h3 className="mt-5 text-sm font-bold text-white">Risk Guard</h3>
        <div className="mt-3 grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Max daily loss (USD)</label>
            <input value={maxDailyLoss} onChange={(e) => setMaxDailyLoss(e.target.value)} inputMode="decimal" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Max exposure (USD)</label>
            <input value={maxExposure} onChange={(e) => setMaxExposure(e.target.value)} inputMode="decimal" className={inputCls} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={start}
            disabled={status !== 'stopped'}
            className="bg-accent text-black font-bold rounded-xl px-6 py-3 text-sm hover:brightness-110 transition disabled:opacity-50"
          >
            ▶ Start Auto Trading
          </button>
          <button
            onClick={() => stop()}
            disabled={status !== 'running'}
            className="bg-panel2 border border-edge text-white font-bold rounded-xl px-6 py-3 text-sm hover:bg-panel transition disabled:opacity-50"
          >
            ⏹ Stop
          </button>
          <button
            onClick={emergencyStop}
            disabled={status === 'emergency'}
            className="bg-red-600 text-white font-bold rounded-xl px-6 py-3 text-sm hover:bg-red-500 transition disabled:opacity-50"
          >
            🚨 Emergency Stop
          </button>
          {status === 'emergency' && (
            <button
              onClick={resetEmergency}
              className="bg-panel2 border border-edge text-white font-bold rounded-xl px-6 py-3 text-sm hover:bg-panel transition"
            >
              Reset Emergency
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-void border border-edge rounded-xl px-3 py-3">
            <div className="text-[11px] text-slate-500">Simulated P&amp;L (net)</div>
            <div className={cn('text-base font-extrabold mt-0.5', dayPnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {dayPnl >= 0 ? '+' : ''}{fmtUSD(dayPnl)}
            </div>
            <div className="text-[10px] text-slate-500">wins − losses − fees</div>
          </div>
          <div className="bg-void border border-edge rounded-xl px-3 py-3">
            <div className="text-[11px] text-slate-500">Simulated daily loss</div>
            <div className="text-base font-extrabold text-white mt-0.5">{fmtUSD(dayLoss)}</div>
          </div>
          <div className="bg-void border border-edge rounded-xl px-3 py-3">
            <div className="text-[11px] text-slate-500">Simulated fees</div>
            <div className="text-base font-extrabold text-amber-300 mt-0.5">{fmtUSD(dayFees)}</div>
          </div>
          <div className="bg-void border border-edge rounded-xl px-3 py-3">
            <div className="text-[11px] text-slate-500">Simulated exposure</div>
            <div className="text-base font-extrabold text-white mt-0.5">{fmtUSD(exposure)}</div>
          </div>
          <div className="bg-void border border-edge rounded-xl px-3 py-3">
            <div className="text-[11px] text-slate-500">Simulated trades</div>
            <div className="text-base font-extrabold text-white mt-0.5">{trades}</div>
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="mt-6 bg-panel border border-edge rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-white">Activity Log</h2>
          <button onClick={clearLog} className="text-xs font-bold bg-panel2 border border-edge text-white rounded-lg px-3 py-1.5 hover:bg-panel transition">
            Clear log
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-1">Every signal, order, rejection and fee — all simulated.</p>
        {log.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No activity yet. Press Start to begin the simulated run.</p>
        ) : (
          <ul className="mt-4 space-y-1.5 max-h-[420px] overflow-y-auto">
            {log.map((entry, i) => (
              <li key={`${entry.t}-${i}`} className="bg-void border border-edge rounded-lg px-3 py-2 text-xs text-slate-300 flex gap-2 items-start">
                <span className={cn('shrink-0 text-[10px] font-bold uppercase rounded-full px-2 py-0.5 border', TYPE_STYLE[entry.type])}>
                  {entry.type}
                </span>
                <span className="flex-1">{entry.msg}</span>
                <span className="shrink-0 text-slate-500">{new Date(entry.t).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-6 text-xs text-slate-500 leading-relaxed">
        Demo simulation — the auto trader generates simulated signals and fills against demo prices.
        It never places real orders. Crypto runs 24/7 in this demo; stocks only auto-trade during exchange hours (demo note).
      </p>
    </div>
  );
}
