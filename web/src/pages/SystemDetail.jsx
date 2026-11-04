import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { initiativePath, jiraPath } from '../lib/paths';
import { impactClass } from '../lib/impact';
import { IconArrowLeft } from '../components/icons';

const QUARTERS = ['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4'];

const selectStyle = {
  padding: '7px 10px',
  background: 'var(--panel-2)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  font: 'inherit',
  fontSize: 13,
};

// One repository's cross-AMP view: every AMP/Jira impacting it, filterable by
// quarter (?quarter=). Answers "every AMP impacting Payment Service [in Q4]".
export function SystemDetailPage() {
  const { repo } = useParams();
  const [params, setParams] = useSearchParams();
  const quarter = params.get('quarter') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    apiClient
      .system(repo, quarter || undefined)
      .then((r) => setData(r.system))
      .catch((e) => setError(e.message));
  }, [repo, quarter]);

  const setQuarter = (q) =>
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (q) p.set('quarter', q);
      else p.delete('quarter');
      return p;
    });

  if (error) return <div className="card">Failed to load: {error}</div>;

  return (
    <div>
      <Link to="/systems" className="breadcrumb">
        <IconArrowLeft width={15} height={15} /> Back to Systems
      </Link>

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', margin: '4px 0 20px' }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title mono" style={{ wordBreak: 'break-all' }}>{repo}</h1>
          {data && (
            <div className="page-sub">
              {data.jiraCount} jira{data.jiraCount === 1 ? '' : 's'} across {data.initiativeCount} AMP
              {data.initiativeCount === 1 ? '' : 's'}
              {quarter ? ` · ${quarter}` : ''}
            </div>
          )}
        </div>
        <select value={quarter} onChange={(e) => setQuarter(e.target.value)} style={selectStyle}>
          <option value="">All quarters</option>
          {QUARTERS.map((q) => (
            <option key={q} value={q}>{q}</option>
          ))}
        </select>
      </div>

      {!data ? (
        <div className="spinner">Loading…</div>
      ) : data.jiras.length === 0 ? (
        <div className="card">
          <div className="muted">No AMPs impacting this repo{quarter ? ` in ${quarter}` : ''}.</div>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>AMP</th>
                <th style={{ width: 120 }}>Jira</th>
                <th>Title</th>
                <th style={{ width: 90 }}>Impact</th>
                <th style={{ width: 60 }}>Stage</th>
                <th style={{ width: 110 }}>Quarter</th>
              </tr>
            </thead>
            <tbody>
              {data.jiras.map((j) => (
                <tr key={`${j.initiativeId}/${j.jiraId}`}>
                  <td>
                    <Link to={initiativePath(j.initiativeId)} style={{ color: 'var(--accent)' }}>{j.initiativeName}</Link>
                  </td>
                  <td className="mono">
                    <Link to={jiraPath(j.initiativeId, j.jiraId)} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      {j.jiraId}
                    </Link>
                  </td>
                  <td>{j.title || <span className="muted">—</span>}</td>
                  <td>
                    {j.impactLevel ? (
                      <span className={`badge ${impactClass(j.impactLevel)}`}>{j.impactLevel}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="mono">{j.currentStageN ?? '—'}</td>
                  <td className="mono muted" style={{ fontSize: 12 }}>{j.quarter || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
