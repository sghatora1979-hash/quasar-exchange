'use client';

import { useState } from 'react';
import { Gem, TriangleAlert, ScanSearch, Play } from 'lucide-react';
import { detectDiamond, detectHarmonic } from '@/lib/patterns';
import { fmtUSD } from '@/lib/quasar';
import { cn } from '@/lib/utils';

// ---------- SVG diagrams ----------

function DiamondSVG() {
  // Bullish diamond bottom: swings widen then narrow, breakout up.
  const path = 'M10,95 L50,62 L90,122 L130,42 L170,142 L210,72 L250,112 L292,48';
  return (
    <svg viewBox="0 0 300 180" className="w-full h-auto" role="img" aria-label="Diamond bottom diagram">
      <polygon points="50,62 130,42 210,72 250,112 170,142 90,122" fill="rgba(250,204,21,0.07)" stroke="#facc15" strokeWidth="1.5" strokeDasharray="6 4" />
      <polyline points={path} fill="none" stroke="#e2e8f0" strokeWidth="2" />
      <line x1="250" y1="112" x2="292" y2="48" stroke="#22c55e" strokeWidth="2.5" />
      <polygon points="292,48 282,52 286,60" fill="#22c55e" />
      <text x="256" y="40" fontSize="10" fontWeight="800" fill="#22c55e">BREAKOUT</text>
      <line x1="8" y1="158" x2="292" y2="158" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="5 4" />
      <text x="10" y="172" fontSize="10" fill="#ef4444">Stop-loss below the diamond</text>
      <text x="120" y="20" fontSize="10" fill="#94a3b8">volatility expands → then contracts</text>
    </svg>
  );
}

function HarmonicSVG({ pts, name }: { pts: [number, number][]; name: string }) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3], [x4, y4]] = pts;
  const path = `M${x0},${y0} L${x1},${y1} L${x2},${y2} L${x3},${y3} L${x4},${y4}`;
  const labels: [string, number, number][] = [['X', x0, y0], ['A', x1, y1], ['B', x2, y2], ['C', x3, y3], ['D', x4, y4]];
  return (
    <svg viewBox="0 0 270 170" className="w-full h-auto" role="img" aria-label={`${name} diagram`}>
      <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="#475569" strokeWidth="1" strokeDasharray="4 3" />
      <polyline points={path} fill="none" stroke="#e2e8f0" strokeWidth="2" />
      {labels.map(([t, x, y]) => (
        <g key={t}>
          <circle cx={x} cy={y} r="4" fill={t === 'D' ? '#22c55e' : '#facc15'} />
          <text x={x} y={y - 10} textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">{t}</text>
        </g>
      ))}
      <text x={x4} y={y4 + 22} textAnchor="middle" fontSize="10" fontWeight="800" fill="#22c55e">Entry at D</text>
    </svg>
  );
}

const HARMONICS: { name: string; emoji: string; rules: string[]; pts: [number, number][]; bias: string }[] = [
  {
    name: 'Gartley', emoji: '📐',
    rules: ['B retraces to 0.618 of XA', 'C retraces 0.382–0.886 of AB', 'D completes at 0.786 of XA'],
    pts: [[20, 112], [92, 38], [142, 82], [186, 56], [236, 94]],
    bias: 'The original 1930s pattern — D is a 0.786 retracement, so the reversal zone sits inside the XA leg.',
  },
  {
    name: 'Bat', emoji: '🦇',
    rules: ['B retraces 0.382–0.50 of XA (shallow!)', 'C retraces 0.382–0.886 of AB', 'D completes at 0.886 of XA'],
    pts: [[20, 112], [92, 38], [136, 74], [182, 56], [242, 102]],
    bias: 'Shallow B + deep 0.886 D. Precise D zone makes stops tight — a favorite of harmonic traders.',
  },
  {
    name: 'Butterfly', emoji: '🦋',
    rules: ['B retraces to 0.786 of XA', 'C retraces 0.382–0.886 of AB', 'D extends to 1.27–1.618 of XA'],
    pts: [[24, 108], [88, 44], [132, 96], [176, 60], [246, 128]],
    bias: 'D extends BEYOND X — the reversal starts from a new extreme. Powerful but needs confirmation.',
  },
  {
    name: 'Crab', emoji: '🦀',
    rules: ['B retraces 0.382–0.618 of XA', 'C retraces 0.382–0.886 of AB', 'D extends to 1.618 of XA'],
    pts: [[24, 108], [88, 44], [128, 70], [172, 56], [250, 142]],
    bias: 'The deepest extension (1.618) — explosive reversals from D, but D can overshoot. Wait for the turn.',
  },
];

// ---------- Screener ----------

const SCAN_SYMBOLS = [
  { label: 'DOGE/USD', yahoo: 'DOGE-USD' },
  { label: 'ETH/USD', yahoo: 'ETH-USD' },
  { label: 'SOL/USD', yahoo: 'SOL-USD' },
  { label: 'RELIANCE (NSE)', yahoo: 'RELIANCE.NS' },
  { label: 'TCS (NSE)', yahoo: 'TCS.NS' },
  { label: 'INFY (NSE)', yahoo: 'INFY.NS' },
  { label: 'AAPL', yahoo: 'AAPL' },
  { label: 'NVDA', yahoo: 'NVDA' },
  { label: 'TSLA', yahoo: 'TSLA' },
];

type ScanRow = {
  label: string;
  diamond: string | null;
  diamondBias: string | null;
  harmonic: string | null;
  harmonicDir: string | null;
  dZone: number | null;
  error?: string;
};

export default function PatternsPage() {
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [scanning, setScanning] = useState(false);
  const [done, setDone] = useState(false);

  const scan = async () => {
    setScanning(true); setDone(false); setRows([]);
    const out: ScanRow[] = [];
    await Promise.all(SCAN_SYMBOLS.map(async (s) => {
      try {
        const r = await fetch(`/api/history?yahoo=${encodeURIComponent(s.yahoo)}&range=6mo&interval=1d`, { cache: 'no-store' });
        const j = await r.json();
        if (!j.ok || !Array.isArray(j.c)) throw new Error('no data');
        const n = (j.t as number[]).length;
        const h: number[] = [], l: number[] = [], c: number[] = [];
        for (let i = 0; i < n; i++) {
          const cc = (j.c as number[])[i];
          if (!(cc > 0)) continue;
          c.push(cc); h.push((j.h as number[])[i] || cc); l.push((j.l as number[])[i] || cc);
        }
        if (c.length < 60) throw new Error('thin history');
        const d = detectDiamond(h, l, c);
        const hm = detectHarmonic(h, l, c);
        out.push({
          label: s.label,
          diamond: d.found ? d.note : null,
          diamondBias: d.found ? d.bias : null,
          harmonic: hm.found ? hm.note : null,
          harmonicDir: hm.found ? hm.direction : null,
          dZone: hm.dZone,
        });
      } catch {
        out.push({ label: s.label, diamond: null, diamondBias: null, harmonic: null, harmonicDir: null, dZone: null, error: 'data unavailable' });
      }
    }));
    // Keep scan order stable
    out.sort((a, b) => SCAN_SYMBOLS.findIndex((s) => s.label === a.label) - SCAN_SYMBOLS.findIndex((s) => s.label === b.label));
    setRows(out); setScanning(false); setDone(true);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <Gem size={22} className="text-accent" /> Pattern Lab
        </h1>
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-full px-2.5 py-1">
          Demo education
        </span>
      </div>
      <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-void/60 border border-edge rounded-xl px-3 py-2.5 mb-6">
        <TriangleAlert size={13} className="shrink-0 mt-0.5 text-amber-300" />
        <p>
          Pattern detection is <span className="text-slate-300 font-semibold">approximate</span> — diamonds are rare
          and subjective, harmonics need precise Fibonacci confluence. Always wait for <span className="text-slate-300 font-semibold">breakout confirmation with volume</span>.
          Educational/demo only — not financial advice.
        </p>
      </div>

      {/* Diamond guide */}
      <div className="bg-panel border border-edge rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-extrabold text-white mb-1">💎 Diamond Top &amp; Bottom</h2>
        <p className="text-xs text-slate-400 mb-4 max-w-2xl">
          A rare reversal pattern: volatility first <span className="text-slate-200">expands</span> (wider swings),
          then <span className="text-slate-200">contracts</span> into a diamond shape. The <span className="text-slate-200 font-semibold">break of the diamond boundary</span> is
          the signal — top (after an uptrend) is bearish, bottom (after a downtrend) is bullish.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <DiamondSVG />
          <ul className="text-xs text-slate-400 space-y-2">
            <li><span className="text-white font-bold">1. Formation:</span> 5–9 swings that widen, then narrow symmetrically.</li>
            <li><span className="text-white font-bold">2. Trigger:</span> daily close OUTSIDE the diamond boundary — never trade inside it.</li>
            <li><span className="text-white font-bold">3. Stop-loss:</span> just beyond the opposite boundary (see red line).</li>
            <li><span className="text-white font-bold">4. Target:</span> classic measured move = diamond height projected from breakout.</li>
            <li className="text-amber-200/80">⚠️ False breaks are common — confirmation + volume separates real from fake.</li>
          </ul>
        </div>
      </div>

      {/* Harmonic guides */}
      <h2 className="text-lg font-extrabold text-white mb-3">🦇 Harmonic Patterns (X-A-B-C-D)</h2>
      <p className="text-xs text-slate-400 mb-4 max-w-2xl">
        Harmonics complete at point <span className="text-slate-200 font-semibold">D</span> — that's the entry zone.
        Bullish patterns shown (X low → D low); bearish versions are mirror images. Ratios use Fibonacci levels.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {HARMONICS.map((p) => (
          <div key={p.name} className="bg-panel border border-edge rounded-2xl p-5">
            <h3 className="text-sm font-extrabold text-white mb-2">{p.emoji} {p.name}</h3>
            <HarmonicSVG pts={p.pts} name={p.name} />
            <ul className="text-[11px] text-slate-400 space-y-1 mt-3">
              {p.rules.map((r) => <li key={r} className="font-mono">• {r}</li>)}
            </ul>
            <p className="text-[11px] text-slate-500 mt-2">{p.bias}</p>
          </div>
        ))}
      </div>

      {/* Screener */}
      <div className="bg-panel border border-edge rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <ScanSearch size={18} className="text-accent" /> Pattern Screener
          </h2>
          <button
            onClick={scan}
            disabled={scanning}
            className="ml-auto flex items-center gap-2 bg-accent hover:bg-accent/85 disabled:opacity-50 text-white text-sm font-bold rounded-xl px-5 py-2 transition"
          >
            <Play size={14} /> {scanning ? 'Scanning…' : 'Scan symbols'}
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mb-4">6 months of daily bars · swing-pivot detector · ±8% Fibonacci tolerance.</p>
        {done && rows.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {rows.map((r) => (
              <div key={r.label} className="bg-void border border-edge rounded-xl p-3.5">
                <div className="text-sm font-bold text-white mb-2">{r.label}</div>
                {r.error && <p className="text-[11px] text-slate-600">{r.error}</p>}
                {!r.error && !r.diamond && !r.harmonic && (
                  <p className="text-[11px] text-slate-500">No diamond or harmonic shape in recent swings.</p>
                )}
                {r.diamond && (
                  <div className={cn(
                    'text-[11px] rounded-lg px-2.5 py-2 mb-2 border',
                    r.diamondBias === 'bearish' ? 'text-down bg-down/10 border-down/30' : 'text-up bg-up/10 border-up/30'
                  )}>
                    <span className="font-black">💎 Possible Diamond {r.diamondBias === 'bearish' ? 'Top' : 'Bottom'}</span>
                    <p className="mt-1 text-slate-400">watch for breakout — {r.diamondBias === 'bearish' ? 'bearish bias' : 'bullish bias'}</p>
                  </div>
                )}
                {r.harmonic && (
                  <div className={cn(
                    'text-[11px] rounded-lg px-2.5 py-2 border',
                    r.harmonicDir === 'bearish' ? 'text-down bg-down/10 border-down/30' : 'text-up bg-up/10 border-up/30'
                  )}>
                    <span className="font-black">🦇 {r.harmonic.split('—')[0]}</span>
                    {r.dZone != null && <p className="mt-1 font-mono text-slate-300">D zone ≈ {fmtUSD(r.dZone, 2)}</p>}
                    <p className="mt-1 text-slate-400">caution {r.harmonicDir === 'bearish' ? 'on longs' : 'on shorts'} near D</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {!done && !scanning && (
          <p className="text-xs text-slate-600">Hit <span className="text-slate-400 font-semibold">Scan symbols</span> to hunt for diamonds and harmonics across popular markets.</p>
        )}
      </div>
    </div>
  );
}
