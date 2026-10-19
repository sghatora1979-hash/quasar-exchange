'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Globe2 } from 'lucide-react';
import { COUNTRIES, REGION_GROUPS, marketStatus } from '@/lib/countries';
import { cn } from '@/lib/utils';

type Props = {
  /** Currently selected region code ('all' or a country code like 'in_nse'). */
  selected: string;
  onSelect: (code: string) => void;
  /** Optional counts per region code. */
  counts?: Record<string, number>;
};

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function CountrySelector({ selected, onSelect, counts }: Props) {
  const [open, setOpen] = useState(false);
  useNow();

  const groups = useMemo(
    () =>
      REGION_GROUPS.map((g) => ({
        group: g,
        items: Object.values(COUNTRIES).filter((c) => c.group === g),
      })),
    []
  );

  const selectedMeta = selected === 'all' ? null : COUNTRIES[selected];
  const total = useMemo(() => Object.values(counts ?? {}).reduce((a, b) => a + b, 0), [counts]);

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 bg-panel border border-edge rounded-2xl px-4 py-3 hover:border-accent/50 transition text-left"
      >
        <span className="text-2xl">{selectedMeta ? selectedMeta.flag : '🌍'}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate">
            {selectedMeta ? `${selectedMeta.country} · ${selectedMeta.exchange}` : 'All countries / exchanges'}
          </div>
          <div className="text-[11px] text-slate-500">
            {selectedMeta
              ? `${selectedMeta.currency} · ${selectedMeta.open}–${selectedMeta.close} local${selectedMeta.limited ? ' · limited data' : ''}`
              : `${groups.reduce((a, g) => a + g.items.length, 0)} exchanges · tap to pick a country`}
          </div>
        </div>
        {selectedMeta && <MarketBadge code={selectedMeta.code} />}
        <ChevronDown size={16} className={cn('text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-2 bg-panel border border-edge rounded-2xl p-4 space-y-4 max-h-[420px] overflow-y-auto">
          <button
            onClick={() => { onSelect('all'); setOpen(false); }}
            className={cn(
              'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border transition text-left',
              selected === 'all'
                ? 'bg-accent/15 border-accent/60'
                : 'bg-void border-edge hover:border-slate-500'
            )}
          >
            <span className="text-xl">🌍</span>
            <span className="text-sm font-bold text-white flex-1">All markets</span>
            <span className="text-[11px] text-slate-400 font-mono">{total}</span>
          </button>
          {groups.map(({ group, items }) => (
            <div key={group}>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                <Globe2 size={12} /> {group}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {items.map((c) => {
                  const st = marketStatus(c.code);
                  const active = selected === c.code;
                  return (
                    <button
                      key={c.code}
                      onClick={() => { onSelect(c.code); setOpen(false); }}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl px-3 py-2.5 border transition text-left',
                        active
                          ? 'bg-accent/15 border-accent/60'
                          : 'bg-void border-edge hover:border-slate-500'
                      )}
                    >
                      <span className="text-xl shrink-0">{c.flag}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-bold text-white truncate">
                          {c.country} <span className="text-slate-500 font-semibold">· {c.exchange}</span>
                        </span>
                        <span className="block text-[10px] text-slate-500 font-mono tabular-nums">
                          {st.localTime} local · {c.open}–{c.close}
                          {c.limited ? ' · limited' : ''}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0',
                          st.open ? 'text-up bg-up/15' : 'text-slate-500 bg-slate-500/15'
                        )}
                      >
                        {st.open ? '● Open' : '○ Shut'}
                      </span>
                      {counts && counts[c.code] != null && (
                        <span className="text-[10px] text-slate-500 font-mono shrink-0">{counts[c.code]}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-slate-600">
            Demo trading stays available 24/7 — the Open/Shut badge reflects the real exchange session for learning market hours. Holidays not modeled.
          </p>
        </div>
      )}
    </div>
  );
}

export function MarketBadge({ code }: { code: string }) {
  useNow(30_000);
  const st = marketStatus(code);
  return (
    <span
      className={cn(
        'text-[10px] font-black uppercase px-2 py-1 rounded-full border shrink-0',
        st.open
          ? 'text-up bg-up/10 border-up/30'
          : 'text-slate-400 bg-slate-500/10 border-slate-500/30'
      )}
      title={`${st.label} · ${st.localTime} local`}
    >
      {st.open ? '🟢 Open' : '🔴 Closed'}
    </span>
  );
}
