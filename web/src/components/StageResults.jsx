import { useMemo, useState } from 'react';
import { artifactsForStage } from '../lib/artifacts';
import { useGit } from '../context/GitContext';
import { StageBadge } from './StageBadge';
import { Modal } from './Modal';
import { IconArrowLeft, IconDoc, IconPlay } from './icons';

/**
 * Inline panel shown below the Pipeline for the selected stage. Shows ONLY the
 * actual run output — status/agents/convergence and the artifacts that stage
 * produced. No coaching/example content (that lives in the "Stages Help" modal).
 *
 * When `perJiraHint` is set (a per-jira stage viewed at the INITIATIVE level),
 * artifacts live under each Jira, so instead we list the Jiras at this stage with
 * their own Continue/Start actions.
 */
export function StageResults({
  n,
  cell,
  artifacts,
  onOpenArtifact,
  perJiraHint,
  onClear,
  onStart,
  jiraList,
  onJiraStart,
  jiraArtifacts,
}) {
  const stageArtifacts = useMemo(
    () => (artifacts ? artifactsForStage(artifacts, n) : []),
    [artifacts, n],
  );
  // For per-jira stages viewed at the initiative level, the artifacts live under
  // the Jiras — filter those to this stage.
  const jiraStageArtifacts = useMemo(
    () => (jiraArtifacts ? artifactsForStage(jiraArtifacts, n) : []),
    [jiraArtifacts, n],
  );

  const findings = cell?.convergence?.findingsBySeverity;
  const completed = cell?.status === 'done' || cell?.status === 'skipped';
  const [confirm, setConfirm] = useState(null); // re-run confirmation target
  const { changed } = useGit();

  return (
    <div className="card stage-details" style={{ marginBottom: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>
          <span className="mono muted">Stage {String(n).padStart(2, '0')}</span> — {cell?.name}
        </h2>
        <div className="row" style={{ gap: 8 }}>
          {onStart && (
            <button
              className={`btn sm ${completed ? '' : 'primary'}`}
              onClick={() => (completed ? setConfirm({ kind: 'stage', status: cell?.status }) : onStart(n, cell?.status))}
              title={completed ? 'Re-run this stage' : undefined}
            >
              <IconPlay width={13} height={13} className="nudge" />{' '}
              {completed
                ? 'Re-run stage'
                : cell?.status === 'active'
                  ? 'Continue stage'
                  : cell?.status === 'blocked'
                    ? 'Resume stage'
                    : 'Start this stage'}
            </button>
          )}
          <button className="btn sm ghost" onClick={onClear}>
            <IconArrowLeft width={14} height={14} /> Show all
          </button>
        </div>
      </div>

      {cell && (
        <div className="row wrap" style={{ marginBottom: 16 }}>
          <StageBadge status={cell.status} />
          {cell.aggregate && cell.aggregate.total > 0 && (
            <span className="badge">
              {cell.aggregate.done}/{cell.aggregate.total} jiras
            </span>
          )}
          {cell.agents?.map((a) => (
            <span key={a} className="badge violet">
              {a}
            </span>
          ))}
          {cell.convergence && cell.convergence.iterations != null && (
            <span className="badge warn">
              convergence: {cell.convergence.iterations}
              {cell.convergence.maxIterations ? `/${cell.convergence.maxIterations}` : ''} iter
            </span>
          )}
          {findings &&
            Object.entries(findings).map(([sev, count]) => (
              <span key={sev} className={`badge ${sev === 'critical' || sev === 'high' ? 'crit' : sev === 'medium' ? 'warn' : ''}`}>
                {sev}: {count}
              </span>
            ))}
        </div>
      )}

      {perJiraHint ? (
        <>
          <h2 style={{ marginBottom: 12 }}>Jiras at this stage</h2>
          {jiraList && jiraList.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {jiraList.map((j) => {
                const jDone = j.status === 'done' || j.status === 'skipped';
                return (
                  <div
                    key={j.id}
                    className="row jira-row"
                    style={{ justifyContent: 'space-between', border: '1px solid var(--border)', padding: '10px 12px' }}
                  >
                    <span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{j.id}</span>
                    <div className="row" style={{ gap: 8 }}>
                      <StageBadge status={j.status} />
                      {onJiraStart && (
                        <button
                          className={`btn sm ${jDone ? '' : 'primary'}`}
                          onClick={() =>
                            jDone
                              ? setConfirm({ kind: 'jira', jiraId: j.id, status: j.status })
                              : onJiraStart(j.id, j.status)
                          }
                          title={jDone ? 'Re-run this stage' : undefined}
                        >
                          <IconPlay width={13} height={13} />{' '}
                          {jDone ? 'Re-run' : j.status === 'active' ? 'Continue' : 'Start'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="muted">No Jiras at this stage.</div>
          )}

          {jiraStageArtifacts.length > 0 && (
            <>
              <h2 style={{ margin: '20px 0 12px' }}>Artifacts ({jiraStageArtifacts.length})</h2>
              <div className="files">
                {jiraStageArtifacts.map((a) => (
                  <button key={a.relPath} className="file" onClick={() => onOpenArtifact?.(a.relPath)} title={a.relPath}>
                    {changed.has(a.relPath) && <span className="file-flag" title="Modified (uncommitted)" />}
                    <span className="ficon">
                      <IconDoc width={18} height={18} />
                    </span>
                    <span className="fmeta">
                      <span className="fname">{a.name}</span>
                      {a.dir && a.dir !== '.' && <span className="fdir">{a.dir}/</span>}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <h2 style={{ marginBottom: 12 }}>Artifacts{stageArtifacts.length ? ` (${stageArtifacts.length})` : ''}</h2>
          {stageArtifacts.length > 0 ? (
            <div className="files">
              {stageArtifacts.map((a) => (
                <button key={a.relPath} className="file" onClick={() => onOpenArtifact?.(a.relPath)} title={a.relPath}>
                    {changed.has(a.relPath) && <span className="file-flag" title="Modified (uncommitted)" />}
                    <span className="ficon">
                    <IconDoc width={18} height={18} />
                  </span>
                  <span className="fmeta">
                    <span className="fname">{a.name}</span>
                    {a.dir && a.dir !== '.' && <span className="fdir">{a.dir}/</span>}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="muted">No artifacts recorded for this stage yet.</div>
          )}
        </>
      )}

      {confirm && (
        <Modal title={`Re-run stage ${String(n).padStart(2, '0')}?`} onClose={() => setConfirm(null)}>
          <p className="md">
            Do you really want to re-run <strong>{cell?.name}</strong>
            {confirm.kind === 'jira' ? (
              <>
                {' '}for <span className="mono">{confirm.jiraId}</span>
              </>
            ) : null}
            ? This jumps the pipeline back to this stage and may overwrite its existing artifacts.
          </p>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <button className="btn" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={() => {
                if (confirm.kind === 'jira') onJiraStart?.(confirm.jiraId, confirm.status);
                else onStart?.(n, confirm.status);
                setConfirm(null);
              }}
            >
              <IconPlay width={13} height={13} /> Re-run stage
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
