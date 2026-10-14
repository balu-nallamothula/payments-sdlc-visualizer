import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';

// Impact badges shown on each repo card (critical/high → crit, medium → warn, low → ok).
const CHIPS = [
  { key: 'critical', label: 'C', cls: 'crit' },
  { key: 'high', label: 'H', cls: 'crit' },
  { key: 'medium', label: 'M', cls: 'warn' },
  { key: 'low', label: 'L', cls: 'ok' },
];

export function SystemsPage() {
  const [systems, setSystems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient
      .systems()
      .then((r) => setSystems(r.systems))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="card">Failed to load: {error}</div>;
  if (!systems) return <div className="spinner">Loading systems…</div>;

  return (
    <div>
      <h1 className="page-title">Systems</h1>
      <div className="page-sub">Every repository impacted across all AMPs — the cross-initiative steward view.</div>

      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14, marginTop: 20 }}
      >
        {systems.map((s) => (
          <Link
            key={s.repo}
            to={`/systems/${encodeURIComponent(s.repo)}`}
            className="card"
            style={{ color: 'inherit', display: 'block' }}
          >
            <div className="mono" style={{ fontWeight: 700, fontSize: 14, wordBreak: 'break-all' }}>{s.repo}</div>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 12 }}>
              <span className="muted">
                {s.jiraCount} jira{s.jiraCount === 1 ? '' : 's'} · {s.initiativeCount} AMP{s.initiativeCount === 1 ? '' : 's'}
              </span>
              <span className="row" style={{ gap: 6 }}>
                {CHIPS.map((c) =>
                  s.impactCounts[c.key] > 0 ? (
                    <span key={c.key} className={`badge ${c.cls}`} title={c.key}>
                      {c.label} {s.impactCounts[c.key]}
                    </span>
                  ) : null,
                )}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
