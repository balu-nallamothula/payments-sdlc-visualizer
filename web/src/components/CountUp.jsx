import { useEffect, useRef, useState } from 'react';

/**
 * Animation 7 — animated count-up for a numeric value. Ticks 0→value on mount
 * and prev→value whenever it changes, adding a brief `.count-flash` highlight on
 * change. Honors `prefers-reduced-motion` (jumps straight to the value).
 *
 * To remove animation 7: drop this file, its usages, and the `.count-flash`
 * block in theme.css.
 */
export function CountUp({ value, suffix = '', duration = 650, className = '' }) {
  const [display, setDisplay] = useState(0);
  const [flash, setFlash] = useState(false);
  const fromRef = useRef(0);
  const firstRef = useRef(true);
  const rafRef = useRef(0);

  useEffect(() => {
    const to = Number.isFinite(value) ? value : 0;
    const from = fromRef.current;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduce || from === to) {
      fromRef.current = to;
      setDisplay(to);
      firstRef.current = false;
      return undefined;
    }
    if (!firstRef.current) setFlash(true);
    firstRef.current = false;

    const start = performance.now();
    cancelAnimationFrame(rafRef.current);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return (
    <span
      className={`${className} ${flash ? 'count-flash' : ''}`.trim()}
      onAnimationEnd={() => setFlash(false)}
    >
      {display}
      {suffix}
    </span>
  );
}
