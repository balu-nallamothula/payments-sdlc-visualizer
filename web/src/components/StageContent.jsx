import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { artifactsForStage } from '../lib/artifacts';
import { Markdown } from './Markdown';
import { StageBadge } from './StageBadge';
import { IconDoc } from './icons';

function zoneClass(heading) {
  const h = heading.toLowerCase();
  if (h.includes('green flag')) return 'green';
  if (h.includes('red flag')) return 'red';
  if (h.includes('review gate') || h.includes('look for')) return 'blue';
  return null;
}

/**
 * Shared body for a stage: live status, the stage's artifacts, and the coaching
 * card. Used both inline (StageResults) and in the drawer (Stages Help).
 */
export function StageContent({ n, cell, artifacts, onOpenArtifact, perJiraHint }) {
  const [stage, setStage] = useState(null);
  const [error, setError] = useState(null);

  const stageArtifacts = useMemo(
    () => (artifacts ? artifactsForStage(artifacts, n) : []),
    [artifacts, n],
  );

  useEffect(() => {
    let live = true;
    setStage(null);
    setError(null);
    apiClient
      .stage(n)
      .then((s) => live && setStage(s))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [n]);

  const card = stage?.card;

  return (
    <>
      {card?.time && (
        <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
          ⏱ {card.time}
          {card.gate ? ` · Gate: ${card.gate}` : ''}
        </div>
      )}

      {cell && (
        <div className="row wrap" style={{ marginBottom: 12 }}>
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
        </div>
      )}

      {cell?.convergence?.findingsBySeverity && (
        <div className="row wrap" style={{ marginBottom: 12 }}>
          {Object.entries(cell.convergence.findingsBySeverity).map(([sev, count]) => (
            <span key={sev} className={`badge ${sev === 'critical' || sev === 'high' ? 'crit' : sev === 'medium' ? 'warn' : ''}`}>
              {sev}: {count}
            </span>
          ))}
        </div>
      )}

      {artifacts && (
        <div className="zone" style={{ marginBottom: 14 }}>
          <h4 style={{ color: 'var(--accent)' }}>
            Stage artifacts{stageArtifacts.length ? ` (${stageArtifacts.length})` : ''}
          </h4>
          {stageArtifacts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {stageArtifacts.map((a) => (
                <button
                  key={a.relPath}
                  className="file"
                  style={{ padding: '10px 12px' }}
                  onClick={() => onOpenArtifact?.(a.relPath)}
                  title={a.relPath}
                >
                  <span className="ficon">
                    <IconDoc width={16} height={16} />
                  </span>
                  <span className="fmeta">
                    <span className="fname">{a.name}</span>
                    {a.dir && a.dir !== '.' && <span className="fdir">{a.dir}/</span>}
                  </span>
                </button>
              ))}
            </div>
          ) : perJiraHint ? (
            <div className="muted" style={{ fontSize: 12 }}>
              Stages 5–12 run per Jira — open a Jira from the board to see this stage's artifacts.
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 12 }}>No artifacts recorded for this stage yet.</div>
          )}
        </div>
      )}

      {error && <div className="muted">Coaching card unavailable: {error}</div>}
      {!stage && !error && <div className="spinner">Loading coaching card…</div>}

      {card ? (
        <>
          {card.sections.map((s, i) => {
            const zc = zoneClass(s.heading);
            if (zc) {
              return (
                <div key={i} className={`zone ${zc}`}>
                  <h4>{s.heading}</h4>
                  <Markdown>{s.markdown}</Markdown>
                </div>
              );
            }
            return (
              <div key={i} style={{ margin: '14px 0' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 13 }}>{s.heading}</h4>
                <Markdown>{s.markdown}</Markdown>
              </div>
            );
          })}
          {card.epilogue && (
            <div className="zone blue" style={{ marginTop: 16 }}>
              <h4>{card.epilogue.heading}</h4>
              <Markdown>{card.epilogue.markdown}</Markdown>
            </div>
          )}
        </>
      ) : (
        stage && !error && (
          <div className="muted">No coaching card found for this stage. (Is the seph-sdlc-coach skill installed?)</div>
        )
      )}
    </>
  );
}
