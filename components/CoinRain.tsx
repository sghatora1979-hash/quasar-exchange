'use client';

import { useEffect, useRef } from 'react';

// Quasar "Crypto Yug" coin rain — gold coins with QUASAR / crypto symbols
// falling like matrix rain behind every page. Canvas 2D, subtle by design.
// Respects prefers-reduced-motion.
const SYMBOLS = ['₿', 'Ξ', 'Ł', '₮', '$', 'Q', 'QUASAR'];

type Coin = {
  x: number; y: number; r: number; speed: number;
  sym: string; spin: number; spinSpeed: number; alpha: number;
};

export function CoinRain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0, raf = 0;
    let coins: Coin[] = [];

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const n = Math.min(46, Math.floor(w / 34));
      coins = Array.from({ length: n }, () => spawn(true));
    };

    const spawn = (anywhere = false): Coin => {
      const r = 9 + Math.random() * 17;
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : -r * 2,
        r,
        speed: 0.5 + Math.random() * 1.6,
        sym: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        spin: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 0.06,
        alpha: 0.10 + Math.random() * 0.16,
      };
    };

    const drawCoin = (c: Coin) => {
      ctx.save();
      ctx.globalAlpha = c.alpha;
      ctx.translate(c.x, c.y);
      // spin squish for a 3D flip feel
      const squash = Math.abs(Math.cos(c.spin));
      ctx.scale(0.35 + 0.65 * squash, 1);

      // gold coin body
      const g = ctx.createRadialGradient(-c.r * 0.3, -c.r * 0.3, c.r * 0.1, 0, 0, c.r);
      g.addColorStop(0, '#FFE98A');
      g.addColorStop(0.55, '#F5C542');
      g.addColorStop(1, '#B8860B');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, c.r, 0, Math.PI * 2);
      ctx.fill();

      // rim
      ctx.strokeStyle = '#8a6508';
      ctx.lineWidth = Math.max(1, c.r * 0.09);
      ctx.beginPath();
      ctx.arc(0, 0, c.r * 0.88, 0, Math.PI * 2);
      ctx.stroke();

      // symbol / QUASAR text
      ctx.fillStyle = '#7a5a06';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (c.sym === 'QUASAR') {
        ctx.font = `700 ${Math.max(6, c.r * 0.42)}px system-ui, sans-serif`;
        ctx.fillText('QUASAR', 0, 1);
      } else {
        ctx.font = `700 ${c.r * 1.05}px system-ui, sans-serif`;
        ctx.fillText(c.sym, 0, 1);
      }
      ctx.restore();
    };

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < coins.length; i++) {
        const c = coins[i];
        c.y += c.speed;
        c.spin += c.spinSpeed;
        if (c.y - c.r > h) coins[i] = spawn();
        drawCoin(coins[i]);
      }
      raf = requestAnimationFrame(tick);
    };

    resize();
    tick();
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        position: 'fixed', inset: 0, zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
