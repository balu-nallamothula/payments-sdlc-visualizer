import { impactBucket } from '../lib/impact';
import { CountUp } from './CountUp';
import { EmptyTab } from './EmptyTab';

const LEVELS = [
  { key: 'critical', label: 'Critical', color: 'var(--crit)' },
  { key: 'high', label: 'High', color: 'var(--crit)' },
  { key: 'medium', label: 'Medium', color: 'var(--warn)' },
  { key: 'low', label: 'Low', color: 'var(--ok)' },
];
const DOT = { critical: 'impact-critical', high: 'impact-high', medium: 'impact-medium', low: 'impact-low' };

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>
        <CountUp value={value} />
      </div>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
    </div>
  );
}

// Impact distribution + blast radius for one initiative. Source: normalized
// jiras[].impactLevel / targetRepositories / component / storyPoints.
export function ImpactAssessment({ jiras }) {
  const scored = jiras.filter((j) => impactBucket(j.impactLevel));
  if (!scored.length) return <EmptyTab reason="No impact levels scored on this initiative's Jiras yet." />;

  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  const repos = new Set();
  const components = new Set();
  let points = 0;
  for (const j of jiras) {
    const b = impactBucket(j.impactLevel);
    if (b) counts[b] += 1;
    (j.targetRepositories || []).forEach((r) => r.name && repos.add(r.name));
    if (j.component) components.add(j.component);
    if (typeof j.storyPoints === 'number') points += j.storyPoints;
  }
  const max = Math.max(1, ...LEVELS.map((l) => counts[l.key]));

  return (
    <div className="card">
      <h2>Impact assessment</h2>
      <div className="row wrap" style={{ gap: 28, marginBottom: 22 }}>
        <Stat label="Scored Jiras" value={scored.length} />
        <Stat label="Repos impacted" value={repos.size} />
        <Stat label="Components" value={components.size} />
        <Stat label="Story points" value={points} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {LEVELS.map((l) => (
          <div key={l.key} className="row" style={{ gap: 12, alignItems: 'center' }}>
            <span className={`impact-chip ${DOT[l.key]}`} style={{ width: 86 }}>
              <span className="dot" />
              {l.label}
            </span>
            <div style={{ flex: 1, height: 10, background: 'var(--panel-2)' }}>
              <div style={{ width: `${(counts[l.key] / max) * 100}%`, height: '100%', background: l.color }} />
            </div>
            <span className="mono" style={{ width: 28, textAlign: 'right' }}>{counts[l.key]}</span>
          </div>
        ))}
      </div>
      {jiras.length > scored.length && (
        <div className="muted" style={{ fontSize: 12, marginTop: 14 }}>
          {jiras.length - scored.length} Jira(s) not impact-scored.
        </div>
      )}
    </div>
  );
}
