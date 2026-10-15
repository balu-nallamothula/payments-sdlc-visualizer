import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PipelineStrip } from './PipelineStrip';
import { jiraPath } from '../lib/paths';
import { impactClass, impactBucket } from '../lib/impact';

const RANK = { critical: 4, high: 3, medium: 2, low: 1, '': 0 };
const COMPARATORS = {
  impact: (a, b) => RANK[impactBucket(a.impactLevel)] - RANK[impactBucket(b.impactLevel)],
  stage: (a, b) => (a.currentStageN ?? 0) - (b.currentStageN ?? 0),
  percent: (a, b) => (a.percent ?? 0) - (b.percent ?? 0),
};

export function JiraBoard({ initiativeId, jiras }) {
  const navigate = useNavigate();
  // null = the server's default order (numeric by key). A header click sorts by
  // that column (descending first — highest impact / % on top); clicking again flips.
  const [sort, setSort] = useState(null);

  const sorted = useMemo(() => {
    if (!sort || !COMPARATORS[sort.key]) return jiras;
    const arr = [...jiras].sort(COMPARATORS[sort.key]);
    return sort.dir === 'desc' ? arr.reverse() : arr;
  }, [jiras, sort]);

  const toggle = (key) =>
    setSort((s) => (s && s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  const caret = (key) => (sort?.key === key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : '');

  if (jiras.length === 0) {
    return <div className="muted">No Jiras yet — this initiative is still in the initiative phase (stages 1–4).</div>;
  }

  const sortable = { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' };

  return (
    <table>
      <thead>
        <tr>
          <th style={{ width: 130 }}>Jira</th>
          <th>Title</th>
          <th style={{ width: 92, ...sortable }} onClick={() => toggle('impact')} title="Sort by impact">
            Impact{caret('impact')}
          </th>
          <th style={{ width: 72, ...sortable }} onClick={() => toggle('stage')} title="Sort by stage">
            Stage{caret('stage')}
          </th>
          <th style={{ width: 200 }}>Pipeline (5–12)</th>
          <th style={{ width: 64, ...sortable }} onClick={() => toggle('percent')} title="Sort by completeness">
            %{caret('percent')}
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((j) => (
          <tr key={j.id} onClick={() => navigate(jiraPath(initiativeId, j.id))}>
            <td className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              {j.id}
              {j.blockingCount > 0 && <span className="badge crit" style={{ marginLeft: 6 }}>blocked</span>}
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
            <td>
              <PipelineStrip cells={j.stages} />
            </td>
            <td className="mono">{j.percent}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
