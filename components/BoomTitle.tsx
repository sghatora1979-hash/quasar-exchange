'use client';

import { useEffect, useRef } from 'react';

// Front-page hero: "QUASAR" letters split apart with a boom, over a
// matrix-rain canvas. Respects reduced motion.
export function BoomTitle() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const word = 'QUASAR';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const chars = '01<>/\\|*+#$%&';
    const fontSize = 14;
    let cols = Math.floor(canvas.width / fontSize);
    let drops: number[] = Array(cols).fill(0).map(() => Math.random() * -50);

    const draw = () => {
      ctx.fillStyle = 'rgba(10, 8, 20, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        // Head of the drop glows in the hourly accent, tail fades green
        ctx.fillStyle = i % 5 === 0 ? 'rgba(34, 211, 238, 0.9)' : 'rgba(52, 211, 153, 0.55)';
        ctx.fillText(ch, x, y);
        if (y > canvas.height && Math.random() > 0.976) drops[i] = 0;
        drops[i]++;
      }
    };

    const t = setInterval(draw, 50);
    return () => {
      clearInterval(t);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-edge bg-void/60 mb-6">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60" aria-hidden />
      <div className="relative px-6 py-10 sm:py-14 text-center">
        <div className="boom-word" aria-label="QUASAR">
          {word.split('').map((ch, i) => (
            <span
              key={i}
              className="boom-letter"
              style={{ animationDelay: `${i * 90}ms` }}
              aria-hidden
            >
              {ch}
            </span>
          ))}
        </div>
        <p className="boom-sub mt-3 text-sm sm:text-base text-slate-300 font-medium">
          The world&apos;s markets — crypto, stocks, forex — one paper-trading playground.
        </p>
        <p className="mt-2 text-[11px] uppercase tracking-widest text-amber-300/90 font-bold">
          Demo only · No real money
        </p>
      </div>
    </div>
  );
}
