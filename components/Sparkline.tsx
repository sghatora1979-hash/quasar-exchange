'use client';

export function Sparkline({
  data,
  width = 120,
  height = 36,
  positive,
}: {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
}) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="opacity-20 text-[10px] text-slate-500 flex items-center">—</div>;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data
    .map((v, i) => `${(i * stepX).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`)
    .join(' ');
  const up = positive ?? data[data.length - 1] >= data[0];
  const color = up ? '#16c784' : '#ea3943';
  const id = `sg-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
