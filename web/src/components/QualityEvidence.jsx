import { Link } from 'react-router-dom';
import { jiraPath } from '../lib/paths';
import { GATES, rowGates, gateState } from '../lib/gates';
import { EmptyTab } from './EmptyTab';

// Per-jira quality-gate matrix. Source: each jira's gate map (stage-9 gate_results,
// or a fallback mapped from top-level quality_results — see lib/gates rowGates).
// Each Jira links to its detail page for the full 09-quality-gates reports.
export function QualityEvidence({ jiras, initiativeId }) {
  const rows = jiras.map((j) => ({ id: j.id, gates: rowGates(j) })).filter((r) => r.gates);
  if (!rows.length) return <EmptyTab reason="No quality-gate results recorded yet (produced at stage 9)." />;

  return (
    <div className="card">
      <h2>Quality evidence ({rows.length})</h2>
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
        Per-Jira gate outcomes (security, test, performance, SRE, local integration, supergraph). Open a Jira for the
        full reports.
      </div>
      <table>
        <thead>
          <tr>
            <th style={{ width: 130 }}>Jira</th>
            {GATES.map((g) => (
              <th key={g.key} style={{ width: 84 }}>{g.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="mono">
                <Link to={jiraPath(initiativeId, r.id)} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  {r.id}
                </Link>
              </td>
              {GATES.map((g) => {
                const raw = r.gates[g.key];
                const st = gateState(raw);
                return (
                  <td key={g.key}>
                    {st.label === '—' ? (
                      <span className="muted">—</span>
                    ) : (
                      <span className={`badge ${st.cls}`} title={String(raw)}>{st.label}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
