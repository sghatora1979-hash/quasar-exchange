import { TriangleAlert } from 'lucide-react';

export function SiteFooter() {
  return (
    <footer className="border-t border-edge mt-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <TriangleAlert size={14} className="text-amber-400/80" />
          <span>
            <strong className="text-slate-300">Quasar is a demo.</strong> All trading is simulated paper
            trading with play money — no real orders, no real crypto, no wallet connections. Market data
            is live via Kraken&apos;s public API. Not financial advice.
          </span>
        </span>
        <span className="sm:ml-auto text-slate-600">Quasar v1 · demo build</span>
      </div>
    </footer>
  );
}
