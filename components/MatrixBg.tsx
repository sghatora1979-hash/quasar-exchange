'use client';

// Fixed "AI Matrix" backdrop: faint grid + two slow-drifting glow orbs.
// Very subtle by design — numbers stay readable. Respects reduced motion.
export function MatrixBg() {
  return (
    <div className="matrix-bg" aria-hidden>
      <div className="matrix-grid" />
      <div className="matrix-orb matrix-orb-a" />
      <div className="matrix-orb matrix-orb-b" />
    </div>
  );
}
