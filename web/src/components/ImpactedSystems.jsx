import { Link } from 'react-router-dom';
import { impactBucket, impactClass } from '../lib/impact';
import { EmptyTab } from './EmptyTab';
import { IconExternal } from './icons';

// GitHub URL for a normalized target repo (org/name → repo URL).
const repoBase = (r) => r.url || (r.organization && r.name ? `https://github.com/${r.organization}/${r.name}` : null);
const RANK = { critical: 4, high: 3, medium: 2, low: 1, '': 0 };

// The repos this initiative touches (distinct across its Jiras), each linking into
// the cross-AMP steward view. Source: normalized jiras[].targetRepositories.
export function ImpactedSystems({ jiras }) {
  const byRepo = new Map();
  for (const j of jiras) {
    for (const r of j.targetRepositories || []) {
      if (!r.name) continue;
      let e = byRepo.get(r.name);
      if (!e) {
        e = { name: r.name, repo: r, jiraCount: 0, maxImpact: '', labels: new Set() };
        byRepo.set(r.name, e);
      }
      e.jiraCount += 1;
      if (RANK[impactBucket(j.impactLevel)] > RANK[e.maxImpact]) e.maxImpact = impactBucket(j.impactLevel);
      if (j.platform) e.labels.add(j.platform);
      if (j.component) e.labels.add(j.component);
      if (r.url && !e.repo.url) e.repo = r; // prefer a repo entry that carries a URL
    }
  }
  const rows = [...byRepo.values()].sort(
    (a, b) => RANK[b.maxImpact] - RANK[a.maxImpact] || b.jiraCount - a.jiraCount || a.name.localeCompare(b.name),
  );

  if (!rows.length) return <EmptyTab reason="No target repositories recorded on this initiative's Jiras yet." />;

  return (
    <div className="card">
      <h2>Impacted systems ({rows.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Repository</th>
            <th style={{ width: 80 }}>Jiras</th>
            <th style={{ width: 110 }}>Max impact</th>
            <th>Platform / component</th>
            <th style={{ width: 44 }} aria-label="link" />
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const href = repoBase(e.repo);
            return (
              <tr key={e.name}>
                <td className="mono">
                  <Link to={`/systems/${encodeURIComponent(e.name)}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    {e.name}
                  </Link>
                </td>
                <td className="mono">{e.jiraCount}</td>
                <td>
                  {e.maxImpact ? (
                    <span className={`badge ${impactClass(e.maxImpact)}`}>{e.maxImpact}</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="muted" style={{ fontSize: 12 }}>{[...e.labels].join(' · ') || '—'}</td>
                <td>
                  {href && (
                    <a href={href} target="_blank" rel="noreferrer" title="Open on GitHub">
                      <IconExternal width={14} height={14} />
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>
        Click a repository to see every AMP impacting it across the program.
      </div>
    </div>
  );
}
