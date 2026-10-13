import { rowGates, gatePasses } from '../lib/gates';
import { EmptyTab } from './EmptyTab';

const KILL_RE = /(kill[- ]?switch|feature[- ]?flag|circuit[- ]?breaker)/i;

const chipClass = (ratio) => (ratio >= 1 ? 'ok' : ratio > 0 ? 'warn' : 'crit');

// Derived payment-guardrails scorecard. Built entirely from Jira-level pipeline
// signals (gate results, deployment info, labels/titles) — deliberately labeled as
// derived, NOT an authoritative compliance verdict. No file fetches.
export function GuardrailsPanel({ jiras }) {
  if (!jiras.length) {
    return <EmptyTab reason="No Jiras yet — guardrails are derived from Jira-level signals." />;
  }

  const gated = jiras.map((j) => rowGates(j)).filter(Boolean);
  let gPass = 0;
  let gTotal = 0;
  gated.forEach((g) =>
    Object.values(g).forEach((v) => {
      gTotal += 1;
      if (gatePasses(v)) gPass += 1;
    }),
  );
  const sec = gated.filter((g) => g.security != null);
  const secPass = sec.filter((g) => gatePasses(g.security)).length;

  const rollback = jiras.filter((j) => j.deploymentInfo && (j.deploymentInfo.base_branch || j.deploymentInfo.merge_commit));
  const merged = jiras.filter((j) => j.deploymentInfo && j.deploymentInfo.merged_at);
  const killSwitch = jiras.filter((j) => KILL_RE.test(j.title || '') || (j.labels || []).some((l) => KILL_RE.test(l)));

  // ratio != null → render a pass/warn/fail chip; ratio == null → neutral count only.
  const groups = [
    {
      group: 'Payment integrity & quality',
      items: [
        { label: 'Quality gate checks passing', value: gTotal ? `${gPass}/${gTotal}` : 'no gate data', ratio: gTotal ? gPass / gTotal : null },
        { label: 'Security gate passing', value: sec.length ? `${secPass}/${sec.length} jiras` : 'no data', ratio: sec.length ? secPass / sec.length : null },
      ],
    },
    {
      group: 'Operational readiness',
      items: [
        { label: 'Rollback path recorded', value: `${rollback.length}/${jiras.length} jiras`, ratio: null },
        { label: 'Kill switch / feature flag referenced', value: `${killSwitch.length} jira(s)`, ratio: null },
      ],
    },
    {
      group: 'Release',
      items: [{ label: 'Merged / deployed', value: `${merged.length}/${jiras.length} jiras`, ratio: null }],
    },
  ];

  return (
    <div className="card">
      <h2>Payment guardrails</h2>
      <div className="muted" style={{ fontSize: 12, marginBottom: 16, lineHeight: 1.6, maxWidth: 620 }}>
        Derived from Jira-level pipeline signals (quality gates, deployment info, labels) — indicative, <strong>not</strong>{' '}
        an authoritative compliance sign-off. Full reports live under each Jira's Quality Evidence.
      </div>
      {groups.map((c) => (
        <div key={c.group} style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
            }}
          >
            {c.group}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {c.items.map((it) => (
              <div
                key={it.label}
                className="row"
                style={{ justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}
              >
                <span style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {it.ratio != null && <span className={`badge ${chipClass(it.ratio)}`}>{it.ratio >= 1 ? 'pass' : it.ratio > 0 ? 'partial' : 'fail'}</span>}
                  {it.label}
                </span>
                <span className="muted mono" style={{ fontSize: 12 }}>{it.value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
