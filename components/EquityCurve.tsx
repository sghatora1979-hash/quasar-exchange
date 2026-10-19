'use client';

import type { Snapshot } from '@/lib/quasar';

export function EquityCurve({ snapshots, width = 640, height = 180 }: { snapshots: Snapshot[]; width?: number; height?: number }) {
  if (snapshots.length < 2) {
    return (
      <div
        style={{ width: '100%', height }}
        className="flex items-center justify-center text-xs text-slate-500 border border-dashed border-edge rounded-2xl"
      >
        Your equity curve appears here after a few demo trades.
      </div>
    );
  }
  const vals = snapshots.map((s) => s.equity);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const stepX = width / (snapshots.length - 1);
  const pts = snapshots
    .map((s, i) => `${(i * stepX).toFixed(1)},${(height - 12 - ((s.equity - min) / span) * (height - 28)).toFixed(1)}`)
    .join(' ');
  const up = vals[vals.length - 1] >= vals[0];
  const color = up ? '#16c784' : '#ea3943';
  const id = 'eqg';
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
