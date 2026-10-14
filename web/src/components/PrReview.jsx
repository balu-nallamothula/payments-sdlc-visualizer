import { Link } from 'react-router-dom';
import { jiraPath } from '../lib/paths';
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
const prLabel = (u) => String(u).replace(/^https?:\/\/github\.com\//, '');
const hasPr = (j) => (j.prUrl || []).length > 0 || j.deploymentInfo?.pr_url || j.deploymentInfo?.pr_number;

// PR Review (basic): the pipeline's own PR evidence per jira — PR links, branch,
// review-loop count (stage-11 convergence) and merge status. Risk summary,
// FlowGuard results and live CI/approval state need the external PR Review
// Companion, which isn't integrated yet (called out in the banner).
export function PrReview({ jiras, initiativeId }) {
  const rows = jiras.filter(hasPr);
  if (!rows.length) return <EmptyTab reason="No pull requests recorded yet (produced at stage 11)." />;

  return (
    <div>
      <div
        style={{ marginBottom: 18, background: 'var(--panel-2)', border: '1px solid var(--border)', padding: '12px 14px' }}
      >
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
          Showing the pipeline's own PR evidence (links, branch, review loops, merge status).{' '}
          <strong>Risk summary, FlowGuard results and live CI / approval status need the PR Review Companion</strong>,
          which isn't integrated yet.
        </div>
      </div>

      <div className="card">
        <h2>Pull requests ({rows.length})</h2>
        <table>
          <thead>
            <tr>
              <th style={{ width: 130 }}>Jira</th>
              <th>Pull request(s)</th>
              <th style={{ width: 170 }}>Branch</th>
              <th style={{ width: 72 }}>Review</th>
              <th style={{ width: 96 }}>Merged</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((j) => {
              const prs = [...new Set([...(j.prUrl || []), ...(j.deploymentInfo?.pr_url ? [j.deploymentInfo.pr_url] : [])])];
              const branch =
                j.branchName ||
                (j.targetRepositories || []).map((r) => r.branch).filter(Boolean)[0] ||
                j.deploymentInfo?.head_branch ||
                '';
              const conv = (j.stages || []).find((c) => c.n === 11)?.convergence;
              const merged = j.deploymentInfo?.merged_at;
              return (
                <tr key={j.id}>
                  <td className="mono">
                    <Link to={jiraPath(initiativeId, j.id)} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      {j.id}
                    </Link>
                  </td>
                  <td>
                    {prs.length ? (
                      <span className="row wrap" style={{ gap: 10 }}>
                        {prs.map((u, i) => (
                          <a key={i} href={u} target="_blank" rel="noreferrer" className="dev-item">
                            {prLabel(u)} <IconExternal width={12} height={12} />
                          </a>
                        ))}
                      </span>
                    ) : j.deploymentInfo?.pr_number ? (
                      <span className="mono">#{j.deploymentInfo.pr_number}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="mono muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>{branch || '—'}</td>
                  <td className="mono">{conv?.iterations != null ? `${conv.iterations}×` : '—'}</td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{merged ? fmt(merged) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
