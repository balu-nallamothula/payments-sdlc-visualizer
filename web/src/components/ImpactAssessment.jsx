import { impactBucket } from '../lib/impact';
import { CountUp } from './CountUp';
import { EmptyTab } from './EmptyTab';
import { Mermaid } from './Mermaid';

const LEVELS = [
  { key: 'critical', label: 'Critical', color: 'var(--crit)' },
  { key: 'high', label: 'High', color: 'var(--crit)' },
  { key: 'medium', label: 'Medium', color: 'var(--warn)' },
  { key: 'low', label: 'Low', color: 'var(--ok)' },
];
const DOT = { critical: 'impact-critical', high: 'impact-high', medium: 'impact-medium', low: 'impact-low' };
const RANK = { critical: 4, high: 3, medium: 2, low: 1, '': 0 };

// A Mermaid "Feature → systems" graph, nodes colored by each repo's max impact.
function buildImpactGraph(name, jiras) {
  const byRepo = new Map();
  for (const j of jiras) {
    const b = impactBucket(j.impactLevel);
    for (const r of j.targetRepositories || []) {
      if (!r.name) continue;
      const cur = byRepo.get(r.name) || '';
      if (!byRepo.has(r.name) || RANK[b] > RANK[cur]) byRepo.set(r.name, b);
    }
  }
  const repos = [...byRepo.entries()].sort((a, b) => RANK[b[1]] - RANK[a[1]]).slice(0, 20);
  if (!repos.length) return null;
  const esc = (s) => String(s).replace(/["[\]{}|<>]/g, ' ').trim() || 'unnamed';
  const lines = ['flowchart LR', `  F["${esc(name || 'Feature')}"]:::feat`];
  repos.forEach(([repo, b], i) => lines.push(`  F --> n${i}["${esc(repo)}"]:::${b || 'none'}`));
  lines.push('  classDef feat fill:#5b5bd6,stroke:#4a4ac2,color:#fff;');
  lines.push('  classDef critical fill:#e5484d,stroke:#b01e22,color:#fff;');
  lines.push('  classDef high fill:#e5484d,stroke:#b01e22,color:#fff;');
  lines.push('  classDef medium fill:#f5a623,stroke:#c17d12,color:#111;');
  lines.push('  classDef low fill:#30a46c,stroke:#1a7a4c,color:#fff;');
  lines.push('  classDef none fill:#8b8d98,stroke:#60636c,color:#fff;');
  return { chart: lines.join('\n'), total: byRepo.size, shown: repos.length };
}

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

// Impact distribution + blast radius + a visual impact graph for one initiative.
// Source: normalized jiras[].impactLevel / targetRepositories / component / storyPoints.
export function ImpactAssessment({ jiras, initiativeName }) {
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
  const graph = buildImpactGraph(initiativeName, jiras);

  return (
    <div className="card">
      <h2>Impact assessment</h2>
      <div className="row wrap" style={{ gap: 28, marginBottom: 22 }}>
        <Stat label="Scored Jiras" value={scored.length} />
        <Stat label="Repos impacted" value={repos.size} />
        <Stat label="Components" value={components.size} />
        <Stat label="Story points" value={points} />
      </div>

      {graph && (
        <div style={{ marginBottom: 22 }}>
          <div
            style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}
          >
            Impact graph
          </div>
          <Mermaid chart={graph.chart} />
          {graph.total > graph.shown && (
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              Showing the top {graph.shown} of {graph.total} repos by impact.
            </div>
          )}
        </div>
      )}

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
