import { useEffect, useRef } from 'react';

const COLORS = ['#e1b95c', '#f3dc9b', '#c8322b', '#f6efdc', '#2fa36b'];

/** One-shot canvas confetti burst; pointer-events disabled so it never blocks the UI. */
export default function Confetti({ duration = 3200, count = 140, gold = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const fit = () => { c.width = innerWidth * dpr; c.height = innerHeight * dpr; };
    fit();
    const palette = gold ? COLORS.slice(0, 2) : COLORS;
    const parts = Array.from({ length: count }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.4,
      vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 4,
      s: Math.random() * 8 + 5, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      c: palette[Math.floor(Math.random() * palette.length)],
    }));
    const t0 = performance.now(); let raf;
    const tick = (t) => {
      const e = t - t0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, e - duration + 800) / 800);
      for (const p of parts) {
        p.vy += 0.38; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.6); ctx.restore();
      }
      if (e < duration) raf = requestAnimationFrame(tick);
    };
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration, count, gold]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[60] h-full w-full" />;
}
