import { CountUp } from './CountUp';
import { rowGates, gatePasses } from '../lib/gates';
import { impactBucket } from '../lib/impact';
import { artifactsForStage } from '../lib/artifacts';

const bandColor = (pct) => (pct >= 85 ? 'var(--ok)' : pct >= 60 ? 'var(--warn)' : 'var(--crit)');

// % of jiras whose canonical stage `n` is done/skipped.
const pctStageDone = (jiras, n) => {
  if (!jiras.length) return 0;
  const done = jiras.filter((j) => {
    const c = (j.stages || []).find((x) => x.n === n);
    return c && (c.status === 'done' || c.status === 'skipped');
  }).length;
  return Math.round((done / jiras.length) * 100);
};

// A transparent, client-computed release-readiness score across the six steward
// areas. Indicative only — derived from pipeline signals, not an authoritative
// sign-off. Each area degrades gracefully when its data is absent.
export function ReadinessScore({ initiative, pipeline, jiras, artifacts }) {
  const n = jiras.length || 1;

  const arch = artifactsForStage(artifacts || [], 3);
  const hasCurrent = arch.some((a) => /current-state/i.test(a.dir || ''));
  const hasTarget = arch.some((a) => /target-state/i.test(a.dir || ''));

  const scored = jiras.filter((j) => impactBucket(j.impactLevel)).length;
  const withPr = jiras.filter(
    (j) => (j.prUrl || []).length > 0 || j.deploymentInfo?.pr_url || j.deploymentInfo?.pr_number,
  ).length;

  const gates = jiras.map((j) => rowGates(j)).filter(Boolean);
  const testGates = gates.map((g) => g.test).filter((v) => v != null);
  const testPct = testGates.length
    ? Math.round((testGates.filter(gatePasses).length / testGates.length) * 100)
    : pctStageDone(jiras, 7);
  let gp = 0;
  let gt = 0;
  gates.forEach((g) =>
    Object.values(g).forEach((v) => {
      gt += 1;
      if (gatePasses(v)) gp += 1;
    }),
  );

  const dims = [
    {
      label: 'Architecture evidence',
      pct: (hasCurrent ? 50 : 0) + (hasTarget ? 50 : 0),
      detail: arch.length ? `${arch.length} doc(s) · current ${hasCurrent ? '✓' : '—'} / target ${hasTarget ? '✓' : '—'}` : 'No architecture docs',
    },
    { label: 'Impact assessment', pct: Math.round((scored / n) * 100), detail: `${scored}/${jiras.length} Jira(s) impact-scored` },
    { label: 'PR reviews', pct: Math.round((withPr / n) * 100), detail: `${withPr}/${jiras.length} Jira(s) with a PR` },
    {
      label: 'Testing evidence',
      pct: testPct,
      detail: testGates.length ? `${testGates.filter(gatePasses).length}/${testGates.length} test gates pass` : `${pctStageDone(jiras, 7)}% of Jiras past test creation`,
    },
    { label: 'Guardrails', pct: gt ? Math.round((gp / gt) * 100) : 0, detail: gt ? `${gp}/${gt} gate checks pass` : 'No gate data' },
    { label: 'Documentation', pct: pctStageDone(jiras, 10), detail: `${pctStageDone(jiras, 10)}% of Jiras past documentation` },
  ];

  // Blockers knock the headline score down without hiding the per-area detail.
  const blockers = (initiative.blockingCount || 0) + jiras.reduce((s, j) => s + (j.blockingCount || 0), 0);
  const base = Math.round(dims.reduce((s, d) => s + d.pct, 0) / dims.length);
  const score = blockers > 0 ? Math.min(base, 59) : base;

  return (
    <div className="card">
      <h2>Release readiness</h2>
      <div className="row" style={{ gap: 20, alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 44, fontWeight: 800, color: bandColor(score), lineHeight: 1 }}>
          <CountUp value={score} suffix="%" />
        </div>
        <div className="muted" style={{ fontSize: 13, maxWidth: 440 }}>
          Averaged across the six steward areas{blockers > 0 ? ` (capped — ${blockers} blocking condition(s))` : ''}.
          Indicative — derived from pipeline signals, not an authoritative release sign-off.
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
