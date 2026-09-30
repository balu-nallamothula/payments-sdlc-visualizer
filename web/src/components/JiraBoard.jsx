import { useNavigate } from 'react-router-dom';
import { PipelineStrip } from './PipelineStrip';

function impactClass(level) {
  switch ((level || '').toUpperCase()) {
    case 'CRITICAL':
    case 'HIGH':
      return 'crit';
    case 'MEDIUM':
      return 'warn';
    case 'LOW':
      return 'ok';
    default:
      return '';
  }
}

export function JiraBoard({ initiativeId, jiras }) {
  const navigate = useNavigate();

  if (jiras.length === 0) {
    return <div className="muted">No Jiras yet — this initiative is still in the initiative phase (stages 1–4).</div>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th style={{ width: 130 }}>Jira</th>
          <th>Title</th>
          <th style={{ width: 90 }}>Impact</th>
          <th style={{ width: 70 }}>Stage</th>
          <th style={{ width: 200 }}>Pipeline (5–12)</th>
          <th style={{ width: 60 }}>%</th>
        </tr>
      </thead>
      <tbody>
        {jiras.map((j) => (
          <tr
            key={j.id}
            onClick={() => navigate(`/initiatives/${encodeURIComponent(initiativeId)}/jiras/${encodeURIComponent(j.id)}`)}
          >
            <td className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              {j.id}
              {j.blockingCount > 0 && <span className="badge crit" style={{ marginLeft: 6 }}>blocked</span>}
            </td>
            <td>{j.title || <span className="muted">—</span>}</td>
            <td>{j.impactLevel ? <span className={`badge ${impactClass(j.impactLevel)}`}>{j.impactLevel}</span> : <span className="muted">—</span>}</td>
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
