import { useEffect, useRef, useState } from 'react';
import { STATUS_LABEL } from '../lib/stages';
import { IconCheck } from './icons';

const isDone = (s) => s === 'done' || s === 'skipped';

/** Node-based pipeline: circular numbered stages joined by a progress line. */
export function StageNodes({ cells, onSelect, selectedN }) {
  // Animations 1 & 2 — when a stage transitions to done between renders (e.g. a
  // live-refresh after `continue`), briefly tag the affected nodes so the
  // connector "fills" (1) and the checkmark "pops" (2). The first paint is
  // static — prevRef starts null, so navigating in / reloading never replays;
  // only genuine state changes animate.
  const prevRef = useRef(null);
  const [anim, setAnim] = useState({}); // n -> { pop, fill }

  useEffect(() => {
    const byN = new Map(cells.map((c) => [c.n, c.status]));
    const prev = prevRef.current;
    prevRef.current = byN;
    if (!prev) return undefined;
    const next = {};
    cells.forEach((c, i) => {
      const pop = isDone(c.status) && !isDone(prev.get(c.n));
      const before = cells[i - 1];
      const fill = i > 0 && isDone(before.status) && !isDone(prev.get(before.n));
      if (pop || fill) next[c.n] = { pop, fill };
    });
    if (!Object.keys(next).length) return undefined;
    setAnim(next);
    const t = setTimeout(() => setAnim({}), 800);
    return () => clearTimeout(t);
  }, [cells]);

  return (
    <div>
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 6 }}>
        <Legend />
      </div>
      <div className="nodes">
        {cells.map((c, i) => {
          const prevDone = i > 0 && isDone(cells[i - 1].status);
          const a = anim[c.n];
          return (
            <div
              key={c.n}
              className={`node-item ${c.status} ${prevDone ? 'lead-done' : ''} ${selectedN === c.n ? 'selected' : ''} ${a?.pop ? 'just-done' : ''} ${a?.fill ? 'just-fill' : ''}`}
              onClick={() => onSelect?.(c)}
              title={`Stage ${c.n}: ${c.name} — ${c.status}`}
            >
              <div className="circle">
                {String(c.n).padStart(2, '0')}
                {c.status === 'done' && (
                  <span className="check">
                    <IconCheck width={11} height={11} />
                  </span>
                )}
              </div>
              <div className="n-label">
                <div className="n-name">{c.name}</div>
                <div className="n-status">
                  {STATUS_LABEL[c.status] || c.status}
                  {c.aggregate && c.aggregate.total > 0 ? ` ${c.aggregate.done}/${c.aggregate.total}` : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend() {
  const items = [
    ['Done', 'var(--ok)'],
    ['Skipped', 'var(--pending)'],
    ['Active', 'var(--active)'],
    ['Pending', 'var(--panel-3)'],
  ];
  return (
    <div className="legend">
      {items.map(([label, color]) => (
        <div className="item" key={label}>
          <span className="swatch" style={{ background: color }} />
          {label}
        </div>
      ))}
    </div>
  );
}
