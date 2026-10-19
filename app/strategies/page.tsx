'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { HUB_STRATEGIES, type HubStrategy } from '@/lib/hub';
import { cn } from '@/lib/utils';

const TAGS = ['All', 'Trend', 'Reversal', 'Momentum', 'Grid', 'Scalping', 'ICT', 'Breakout', 'Structure'] as const;

function RiskDots({ risk }: { risk: number }) {
  return (
    <span className="flex items-center gap-1" title={`Risk ${risk} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn('w-2 h-2 rounded-full', i <= risk ? 'bg-amber-400' : 'bg-slate-700')}
        />
      ))}
      <span className="text-[11px] text-slate-400 ml-1">Risk {risk}/5</span>
    </span>
  );
}

function Card({ s }: { s: HubStrategy }) {
  return (
    <div className="bg-panel border border-edge rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-extrabold text-white leading-snug">{s.name}</h3>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider bg-accent/15 text-accent border border-accent/30 rounded-full px-2 py-1">
          {s.tag}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {s.source === 'quasar' ? (
          <span className="text-[10px] font-semibold bg-emerald-400/10 text-emerald-300 border border-emerald-400/30 rounded-full px-2 py-0.5">
            QUASAR engine
          </span>
        ) : (
          <span className="text-[10px] font-semibold bg-violet-400/10 text-violet-300 border border-violet-400/30 rounded-full px-2 py-0.5">
            Pine Script v{s.pineVersion}
          </span>
        )}
        {s.backtestable ? (
          <span className="text-[10px] font-semibold bg-sky-400/10 text-sky-300 border border-sky-400/30 rounded-full px-2 py-0.5">
            Backtestable
          </span>
        ) : (
          <span className="text-[10px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/30 rounded-full px-2 py-0.5">
            Library
          </span>
        )}
        {s.scalping && (
          <span className="text-[10px] font-semibold bg-orange-400/10 text-orange-300 border border-orange-400/30 rounded-full px-2 py-0.5">
            Scalping
          </span>
        )}
      </div>
      <p className="text-sm text-slate-400 leading-relaxed flex-1">{s.desc}</p>
      <RiskDots risk={s.risk} />
      <div className="flex gap-2 pt-1">
        <Link
          href="/tester"
          className="flex-1 text-center text-xs font-bold bg-accent text-black rounded-lg px-3 py-2 hover:brightness-110 transition"
        >
          Test →
        </Link>
        <Link
          href="/copy"
          className="flex-1 text-center text-xs font-bold bg-panel2 border border-edge text-white rounded-lg px-3 py-2 hover:bg-panel transition"
        >
          Copy →
        </Link>
        <Link
          href="/grid"
          className="flex-1 text-center text-xs font-bold bg-panel2 border border-edge text-white rounded-lg px-3 py-2 hover:bg-panel transition"
        >
          Grid →
        </Link>
      </div>
      {!s.backtestable && (
        <p className="text-[11px] text-slate-500 leading-snug">
          Pine logic runs as library reference — JS engine coming. Tester shows the
          built-in engine for now.
        </p>
      )}
    </div>
  );
}

export default function StrategiesPage() {
  const [tag, setTag] = useState<(typeof TAGS)[number]>('All');
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return HUB_STRATEGIES.filter((s) => {
      if (tag !== 'All' && s.tag !== tag) return false;
      if (needle && !`${s.name} ${s.desc} ${s.tag}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [tag, q]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-xl font-extrabold text-white">Strategy Hub</h1>
      <p className="text-sm text-slate-400 mt-1">
        One library for Tester, Copy Trading, Grid Board and Auto Trading. Demo only.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {TAGS.map((t) => (
          <button
            key={t}
            onClick={() => setTag(t)}
            className={cn(
              'text-xs font-semibold rounded-full px-3.5 py-1.5 border transition',
              tag === t
                ? 'bg-accent text-black border-accent'
                : 'bg-panel border-edge text-slate-300 hover:text-white'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search strategies…"
        className="mt-4 w-full max-w-md bg-panel border border-edge rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-accent/60"
      />

      <p className="mt-4 text-xs text-slate-500">
        Showing {filtered.length} of {HUB_STRATEGIES.length} strategies.
      </p>

      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((s) => (
          <Card key={s.id} s={s} />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="mt-8 text-center text-sm text-slate-500">
          No strategies match that filter. Try another tag or search term.
        </p>
      )}

      <p className="mt-10 text-xs text-slate-500 leading-relaxed border-t border-edge pt-4">
        Past performance never guarantees future profit. All strategies here run on
        simulated demo data. Demo only — not financial advice.
      </p>
    </div>
  );
}
