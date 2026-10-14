import { CountUp } from './CountUp';
import { rowGates, gatePasses } from '../lib/gates';

const bandColor = (pct) => (pct >= 85 ? 'var(--ok)' : pct >= 60 ? 'var(--warn)' : 'var(--crit)');

// A transparent, client-computed release-readiness score. Indicative only — it is
// derived from normalized signals, not an authoritative sign-off.
export function ReadinessScore({ initiative, pipeline, jiras }) {
  const dims = [];

  dims.push({ label: 'Pipeline completion', pct: pipeline.percent, detail: `${pipeline.percent}% of 12 stages complete` });

  const gated = jiras.map((j) => rowGates(j)).filter(Boolean);
  if (gated.length) {
    let pass = 0;
    let total = 0;
    gated.forEach((g) =>
      Object.values(g).forEach((v) => {
        total += 1;
        if (gatePasses(v)) pass += 1;
      }),
    );
    dims.push({
      label: 'Quality gates',
      pct: total ? Math.round((pass / total) * 100) : 0,
      detail: `${pass}/${total} gate checks pass across ${gated.length} Jira(s)`,
    });
  }

  const blockers = (initiative.blockingCount || 0) + jiras.reduce((n, j) => n + (j.blockingCount || 0), 0);
  dims.push({
    label: 'Unblocked',
    pct: blockers === 0 ? 100 : 0,
    detail: blockers === 0 ? 'No blocking conditions' : `${blockers} blocking condition(s)`,
  });

  const conv = [];
  jiras.forEach((j) =>
    (j.stages || []).forEach((c) => {
      if (c.convergence && c.convergence.nextStageReady != null) conv.push(!!c.convergence.nextStageReady);
    }),
  );
  if (conv.length) {
    const ready = conv.filter(Boolean).length;
    dims.push({ label: 'Review convergence', pct: Math.round((ready / conv.length) * 100), detail: `${ready}/${conv.length} review loops ready for next stage` });
  }

  const score = Math.round(dims.reduce((s, d) => s + d.pct, 0) / dims.length);

  return (
    <div className="card">
      <h2>Release readiness</h2>
      <div className="row" style={{ gap: 20, alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 44, fontWeight: 800, color: bandColor(score), lineHeight: 1 }}>
          <CountUp value={score} suffix="%" />
        </div>
        <div className="muted" style={{ fontSize: 13, maxWidth: 420 }}>
          Derived from pipeline progress, quality gates, blockers and review convergence. Indicative — not an
          authoritative release sign-off.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {dims.map((d) => (
          <div key={d.label}>
            <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <strong>{d.label}</strong>
              <span className="mono">{d.pct}%</span>
            </div>
            <div style={{ height: 8, background: 'var(--panel-2)' }}>
              <div style={{ width: `${d.pct}%`, height: '100%', background: bandColor(d.pct) }} />
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{d.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
