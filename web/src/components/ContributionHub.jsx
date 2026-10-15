import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { jiraPath } from '../lib/paths';
import { displayName, initials } from '../lib/people';
import { EmptyTab } from './EmptyTab';
import { IconDoc, IconExternal, IconGit, IconHealth, IconLayers, IconTicket, IconUsers } from './icons';

const fmt = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return String(iso).slice(0, 10);
  }
};

// Deterministic avatar color per person (so the same name is always the same hue).
const AV_COLORS = ['#e5484d', '#e8792b', '#f5a623', '#30a46c', '#2f6feb', '#8b5cf6', '#d6409f', '#0ea5e9'];
const colorFor = (s) => AV_COLORS[[...String(s)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AV_COLORS.length];

const TONES = {
  accent: { background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid transparent' },
  ok: { background: 'var(--ok-soft)', color: 'var(--ok)', border: '1px solid transparent' },
  plain: { background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--border)' },
};

function Pill({ children, tone = 'plain' }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        lineHeight: 1.4,
        maxWidth: '100%',
        ...TONES[tone],
      }}
    >
      {children}
    </span>
  );
}

// A chiclet list that shows `initial` items then a "+N more" pill to reveal the rest.
function Chiclets({ items, initial, render }) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, initial);
  const rest = items.length - shown.length;
  return (
    <>
      {shown.map(render)}
      {rest > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: 12,
            border: '1px dashed var(--border)',
            background: 'transparent',
            color: 'var(--muted)',
            cursor: 'pointer',
          }}
        >
          +{rest} more
        </button>
      )}
    </>
  );
}

function Row({ icon, label, sub, count, children }) {
  return (
    <div
      className="row"
      style={{ gap: 14, alignItems: 'flex-start', padding: '14px 0', borderBottom: '1px solid var(--border)' }}
    >
      <div className="row" style={{ gap: 9, alignItems: 'flex-start', flex: '0 0 164px' }}>
        <span style={{ color: 'var(--muted)', marginTop: 1 }}>{icon}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {label}
            {count != null && <span className="badge" style={{ marginLeft: 6 }}>{count}</span>}
          </div>
          {sub && <div className="muted" style={{ fontSize: 11 }}>{sub}</div>}
        </div>
      </div>
      <div className="row wrap" style={{ gap: 6, flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div style={{ flex: 1, border: '1px solid var(--border)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>{icon}</span>
      <div>
        <div className="muted" style={{ fontSize: 11 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
  );
}

// Contribution Hub: a Contribution Summary (feature → epics → repos → contributors
// as chiclets, + PR/story/activity stat cards) plus a PR roll-up and the pipeline's
// activity timeline. Summary fields come from the normalized jiras; counts/owners/
// PRs/timeline from /api/initiatives/:name/contribution (aggregates progress_log).
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

  return (
    <div>
      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ marginBottom: 2 }}>Contribution summary</h2>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Key metadata and contributions for this initiative.</div>

        <Row icon={<IconLayers width={17} height={17} />} label="Feature" sub="Main feature or service">
          <Pill tone="accent">{initiativeName || initiativeId}</Pill>
        </Row>

        <Row icon={<IconTicket width={17} height={17} />} label="AMP" sub="Associated Jira epics">
          {epics.length ? (
            <Chiclets items={epics} initial={16} render={(e) => <Pill key={e} tone="accent">{e}</Pill>} />
          ) : (
            <span className="muted mono" style={{ fontSize: 12 }}>{initiativeId}</span>
          )}
        </Row>

        <Row icon={<IconGit width={17} height={17} />} label="Repositories impacted" sub="Services and repositories" count={repos.length}>
          {repos.length ? (
            <Chiclets
              items={repos}
              initial={6}
              render={(r) => (
                <Pill key={r} tone="ok">
                  <IconDoc width={12} height={12} />
                  {r}
                </Pill>
              )}
            />
          ) : (
            <span className="muted">—</span>
          )}
        </Row>

        <Row icon={<IconUsers width={17} height={17} />} label="Contributors" sub="People who contributed" count={summary.contributorCount}>
          {contributors.length ? (
            <Chiclets
              items={contributors}
              initial={9}
              render={(c) => (
                <Pill key={c.name}>
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: colorFor(c.name),
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 700,
                      flex: '0 0 auto',
                    }}
                  >
                    {initials(c.name)}
                  </span>
                  {displayName(c.name)}
                </Pill>
              )}
            />
          ) : (
            <span className="muted">{summary.contributorCount}</span>
          )}
        </Row>

        <div className="row" style={{ gap: 12, marginTop: 16 }}>
          <StatCard icon={<IconGit width={18} height={18} />} label="Pull requests" value={summary.prCount} />
          <StatCard icon={<IconTicket width={18} height={18} />} label="Jira stories" value={summary.jiraCount} />
          <StatCard icon={<IconHealth width={18} height={18} />} label="Activity events" value={summary.activityCount} />
        </div>
      </div>

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
