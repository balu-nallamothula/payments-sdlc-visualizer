import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { jiraPath } from '../lib/paths';
import { displayName, initials } from '../lib/people';
import { EmptyTab } from './EmptyTab';
import { IconExternal } from './icons';

const fmt = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return String(iso).slice(0, 10);
  }
};

const avatarStyle = {
  width: 24,
  height: 24,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--accent-soft)',
  color: 'var(--accent)',
  fontSize: 10,
  fontWeight: 700,
  flex: '0 0 auto',
};

// Contribution Hub: a single Contribution Summary (feature → AMP → repos →
// contributors → PRs → stories) plus owners, a PR roll-up and the pipeline's
// activity timeline. Summary fields come from the normalized jiras; owners/PRs/
// timeline from /api/initiatives/:name/contribution (server aggregates progress_log).
export function ContributionHub({ initiativeId, initiativeName, jiras = [] }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    apiClient.contribution(initiativeId).then(setData).catch((e) => setError(e.message));
  }, [initiativeId]);

  if (error) return <div className="card">Failed to load contribution data: {error}</div>;
  if (!data) return <div className="spinner">Loading contribution…</div>;

  const { summary, contributors, prs, timeline } = data;
  if (!summary.jiraCount) return <EmptyTab reason="No contribution activity yet — this initiative has no Jiras." />;

  const repos = [...new Set(jiras.flatMap((j) => (j.targetRepositories || []).map((r) => r.name).filter(Boolean)))];
  const epics = [...new Set(jiras.map((j) => j.epic).filter(Boolean))];
  const reposLabel = repos.length
    ? `${repos.length} — ${repos.slice(0, 6).join(', ')}${repos.length > 6 ? ` +${repos.length - 6} more` : ''}`
    : '—';
  const contribLabel = contributors.length
    ? `${summary.contributorCount} — ${contributors.slice(0, 4).map((c) => displayName(c.name)).join(', ')}${contributors.length > 4 ? '…' : ''}`
    : String(summary.contributorCount);

  return (
    <div>
      <div className="card" style={{ marginBottom: 18 }}>
        <h2>Contribution summary</h2>
        <div className="kv">
          <div className="k">Feature</div>
          <div className="v">{initiativeName || initiativeId}</div>
          <div className="k">AMP</div>
          <div className="v mono">{epics.length ? epics.join(', ') : initiativeId}</div>
          <div className="k">Repositories impacted</div>
          <div className="v">{reposLabel}</div>
          <div className="k">Contributors</div>
          <div className="v">{contribLabel}</div>
          <div className="k">Pull requests</div>
          <div className="v">{summary.prCount}</div>
          <div className="k">Jira stories</div>
          <div className="v">{summary.jiraCount}</div>
          <div className="k">Activity events</div>
          <div className="v">{summary.activityCount}</div>
        </div>
      </div>

      {contributors.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h2>Owners</h2>
          <div className="row wrap" style={{ gap: 10 }}>
            {contributors.map((c) => (
              <span
                key={c.name}
                className="row"
                style={{ gap: 8, alignItems: 'center', border: '1px solid var(--border)', padding: '6px 10px' }}
              >
                <span style={avatarStyle}>{initials(c.name)}</span>
                <span style={{ fontSize: 13 }}>{displayName(c.name)}</span>
                <span className="badge">{c.jiraCount}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {prs.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h2>Pull requests ({prs.length})</h2>
          <table>
            <thead>
              <tr>
                <th style={{ width: 130 }}>Jira</th>
                <th>Pull request</th>
                <th style={{ width: 110 }}>Merged</th>
              </tr>
            </thead>
            <tbody>
              {prs.map((p, i) => (
                <tr key={`${p.jiraId}-${i}`}>
                  <td className="mono">
                    <Link to={jiraPath(initiativeId, p.jiraId)} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      {p.jiraId}
                    </Link>
                  </td>
                  <td>
                    <a href={p.url} target="_blank" rel="noreferrer" className="dev-item">
                      {String(p.url).replace(/^https?:\/\/github\.com\//, '')} <IconExternal width={12} height={12} />
                    </a>
                  </td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{fmt(p.mergedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h2>Activity {summary.activityCount > timeline.length ? `(latest ${timeline.length})` : `(${timeline.length})`}</h2>
        {timeline.length === 0 ? (
          <div className="muted">No activity log recorded.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {timeline.map((t, i) => (
              <div
                key={i}
                className="row"
                style={{ gap: 12, alignItems: 'baseline', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}
              >
                <span className="muted mono" style={{ fontSize: 11, width: 54, flex: '0 0 auto' }}>{fmt(t.timestamp)}</span>
                <span className="badge" style={{ flex: '0 0 auto' }}>{t.stage != null ? `S${t.stage}` : '—'}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13 }}>{t.text}</div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    <Link to={jiraPath(initiativeId, t.jiraId)} style={{ color: 'var(--muted)' }}>{t.jiraId}</Link>
                    {t.agent ? ` · ${t.agent}` : ''}
                    {t.status ? ` · ${t.status}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
