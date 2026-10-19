'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, CandlestickChart, Wallet, ScrollText, Bot, Sparkles, BrainCircuit, Briefcase, FlaskConical, Gem, Users, Activity, Layers, Grid3x3, Zap, Radar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AccountChip } from '@/components/AuthGate';

const NAV = [
  { href: '/', label: 'Markets', icon: LayoutGrid },
  { href: '/track', label: 'Track', icon: Radar },
  { href: '/trade/QSRUSD', label: 'Trade', icon: CandlestickChart },
  { href: '/ai', label: 'AI Manager', icon: BrainCircuit },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/bots', label: 'Bots', icon: Bot },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/orders', label: 'Orders', icon: ScrollText },
  { href: '/algo', label: 'Algo Lab', icon: FlaskConical },
  { href: '/tester', label: 'Tester', icon: Activity },
  { href: '/strategies', label: 'Strategies', icon: Layers },
  { href: '/grid', label: 'Grid', icon: Grid3x3 },
  { href: '/auto', label: 'Auto', icon: Zap },
  { href: '/patterns', label: 'Patterns', icon: Gem },
  { href: '/copy', label: 'Copy', icon: Users },
];

export function QuasarWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={cn(
        'font-black tracking-tight bg-gradient-to-r from-accentdeep via-accent to-accent2 bg-clip-text text-transparent select-none',
        compact ? 'text-xl' : 'text-2xl'
      )}
      aria-label="Quasar home"
    >
      QUASAR
    </span>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-void/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src="/icons/icon-192.png"
            alt="Quasar logo"
            width={36}
            height={36}
            className="w-9 h-9 rounded-xl shadow-lg shadow-accent/30"
          />
          <QuasarWordmark />
          <span className="hidden md:flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-accent2 border border-edge rounded-full px-2 py-0.5 glow-accent2">
            <Sparkles size={9} />
            AI
          </span>
        </Link>
        <nav className="flex items-center gap-1 ml-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href.split('/').slice(0, 2).join('/'));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition',
                  active ? 'text-white bg-panel2' : 'text-slate-400 hover:text-white hover:bg-panel'
                )}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <AccountChip />
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-300 live-dot" />
            Paper trading
          </div>
        </div>
      </div>
    </header>
  );
}
