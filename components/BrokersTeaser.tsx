'use client';

import { useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { getNotifyList, addNotify } from '@/lib/promptbot';
import { cn } from '@/lib/utils';

// Brokers we plan to connect, grouped by region. All greyed/disabled —
// coming soon. Real broker connections need exchange licensing.
export const BROKER_REGIONS: { region: string; brokers: string[] }[] = [
  { region: 'India', brokers: ['Zerodha', 'Upstox', 'Angel One', 'Groww'] },
  { region: 'Canada', brokers: ['Wealthsimple', 'Questrade', 'Interactive Brokers', 'Qtrade'] },
  { region: 'USA', brokers: ['Robinhood', 'Charles Schwab', 'Fidelity', 'E*TRADE', 'Interactive Brokers'] },
  { region: 'Europe', brokers: ['DEGIRO', 'Trading 212', 'eToro', 'Saxo Bank'] },
  { region: 'UK', brokers: ['Hargreaves Lansdown', 'AJ Bell', 'interactive investor', 'Freetrade'] },
  { region: 'Switzerland', brokers: ['Swissquote', 'PostFinance'] },
  { region: 'Singapore', brokers: ['DBS Vickers', 'OCBC Securities', 'POEMS', 'moomoo'] },
  { region: 'Malaysia', brokers: ['Rakuten Trade', 'M+ Online', 'Kenanga', 'RHB Investment Bank', 'moomoo MY'] },
  { region: 'China', brokers: ['Futu', 'Tiger Brokers'] },
  { region: 'Russia', brokers: ['T-Bank Investments', 'BCS', 'Finam'] },
];

export function BrokerRegionChips() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
      {BROKER_REGIONS.map(({ region, brokers }) => (
        <div key={region}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
            {region}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {brokers.map((b) => (
              <span
                key={b}
                className="text-[11px] font-semibold text-slate-500 bg-void border border-edge rounded-lg px-2.5 py-1 opacity-60 select-none"
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function BrokerNotifyButton() {
  const [notify, setNotify] = useState<string[]>(() => getNotifyList());
  const onList = notify.includes('brokers');
  return (
    <button
      onClick={() => setNotify(addNotify('brokers'))}
      disabled={onList}
      className={cn(
        'flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border transition',
        onList
          ? 'text-emerald-300 border-emerald-400/40 bg-emerald-400/10 cursor-default'
          : 'text-slate-200 border-edge bg-panel2 hover:border-accent/60'
      )}
    >
      {onList ? <BellRing size={13} /> : <Bell size={13} />}
      {onList ? "You're on the list" : 'Notify me'}
    </button>
  );
}
