import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { initiativePath } from '../lib/paths';
import { StageNodes } from '../components/StageNodes';
import { CurrentStageHero } from '../components/CurrentStageHero';
import { StageResults } from '../components/StageResults';
import { ArtifactViewer } from '../components/ArtifactViewer';
import { ArtifactGrid } from '../components/ArtifactGrid';
import { CountUp } from '../components/CountUp';
import { useChat } from '../context/ChatContext';
import { IconChat, IconExternal, IconGit, IconPlay, IconTicket } from '../components/icons';

// GitHub links from a normalized target repo (org/name → repo/branch/commit URLs).
const repoBase = (r) => r.url || (r.organization && r.name ? `https://github.com/${r.organization}/${r.name}` : null);
const shortSha = (s) => (s ? s.slice(0, 7) : '');
const assigneeName = (owner) => (owner ? owner.split('@')[0] : 'Unassigned');

export function JiraDetailPage({ name: nameProp, jiraId: jiraIdProp }) {
  const params = useParams();
  const name = nameProp ?? params.name ?? '';
  const jiraId = jiraIdProp ?? params.jiraId ?? '';
  const [searchParams, setSearchParams] = useSearchParams();
  const chat = useChat();
  const [jira, setJira] = useState(null);
  const [error, setError] = useState(null);
  const [artifacts, setArtifacts] = useState([]);
  const [openArtifact, setOpenArtifact] = useState(null);

  // Selected stage lives in the URL (?stage=N) so it's shareable and reload-safe.
  const stageParam = searchParams.get('stage');
  const selectedStage = useMemo(() => {
    if (!jira || !stageParam) return null;
    const n = Number(stageParam);
    return jira.stages.find((c) => c.n === n) || null;
  }, [jira, stageParam]);
  const selectStage = useCallback(
    (cell) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        if (cell) p.set('stage', String(cell.n));
        else p.delete('stage');
        return p;
      });
    },
    [setSearchParams],
  );

  const load = useCallback(() => {
    apiClient.jira(name, jiraId).then((r) => setJira(r.jira)).catch((e) => setError(e.message));
    apiClient.artifacts(name, jiraId).then((r) => setArtifacts(r.artifacts)).catch(() => setArtifacts([]));
  }, [name, jiraId]);

  useEffect(() => {
    setJira(null);
    setError(null);
    chat.setTarget(jiraId);
    load();
  }, [name, jiraId, load]);

  // Auto-refresh when a chat turn finishes (a completed stage's artifacts appear
  // without a manual reload). Skips the initial mount.
  const seenRev = useRef(chat.revision);
  useEffect(() => {
    if (chat.revision === seenRev.current) return;
    seenRev.current = chat.revision;
    load();
  }, [chat.revision, load]);

  const repoCtx = useMemo(
    () =>
      jira
        ? {
            org: jira.targetRepositories?.[0]?.organization,
            repos: jira.targetRepositories || [],
            defaultBranch: 'main',
          }
        : null,
    [jira],
  );

  const startStage = (stageN, status) => {
    const cmd = status === 'active' ? `/seph-sdlc continue ${jiraId}` : `/seph-sdlc stage ${stageN} ${jiraId}`;
    chat.open(jiraId, cmd);
  };

  const activeCell = jira?.stages.find((c) => c.status === 'active');

  if (error) return <div className="card">Failed to load: {error}</div>;
  if (!jira) return <div className="spinner">Loading Jira…</div>;

  return (
    <div>
      <div className="jira-banner">
        <div className="jira-crumbs">
          <Link to="/initiatives">Initiatives</Link>
          <span className="sep">/</span>
          <Link to={initiativePath(name)}>{name}</Link>
          <span className="sep">/</span>
          <span className="jira-crumbs-key">{jira.id}</span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginTop: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div className="jira-eyebrow"><IconTicket width={13} height={13} /> Jira ticket</div>
            <h1 className="page-title" style={{ marginTop: 4 }}>
              <span className="mono" style={{ color: 'var(--accent)' }}>{jira.id}</span> {jira.title || ''}
            </h1>
            <div className="row wrap" style={{ gap: 10, fontSize: 12, marginTop: 6 }}>
              {jira.epic && <span className="muted">epic {jira.epic}</span>}
              {jira.storyPoints != null && <span className="muted">{jira.storyPoints} pts</span>}
              {jira.lifecycleStatus && <span className="muted">{jira.lifecycleStatus}</span>}
            </div>
          </div>
          <div className="row wrap" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <a
              className="btn sm"
              href={jira.url || `https://jira.sephora.com/browse/${jira.id}`}
              target="_blank"
              rel="noreferrer"
              title="Open this ticket in Jira"
            >
              <IconExternal width={14} height={14} /> Open in Jira
            </a>
            {jira.impactLevel && <span className="badge warn">{jira.impactLevel}</span>}
            <span className="badge violet"><CountUp value={jira.percent} suffix="% complete" /></span>
            {activeCell && (
              <button
                className="btn sm"
                onClick={() => chat.open(jira.id, `/seph-sdlc continue ${jira.id}`)}
                title={`Continue ${activeCell.name}`}
              >
                <IconPlay width={13} height={13} className="nudge" /> Continue stage {activeCell.n}
              </button>
            )}
            <button className="btn sm primary" onClick={() => chat.open(jira.id)}>
              <IconChat width={15} height={15} /> Run in chat
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <CurrentStageHero
          cells={jira.stages}
          currentStageN={jira.currentStageN}
          owner={jira.owner}
          variant="jira"
          onAction={activeCell ? () => chat.open(jira.id, `/seph-sdlc continue ${jira.id}`) : undefined}
        />
      </div>

      {jira.blocking.length > 0 && (
        <div className="zone red" style={{ marginBottom: 18 }}>
          <h4>Blocking conditions</h4>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {jira.blocking.map((b, i) => (
              <li key={i}>
                <strong>{b.type}:</strong> {b.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card" style={{ marginBottom: 18 }}>
        <h2>
          {selectedStage
            ? `Pipeline · Stage ${String(selectedStage.n).padStart(2, '0')} — ${selectedStage.name}`
            : 'Per-Jira Pipeline (stages 5–12)'}
        </h2>
        <StageNodes cells={jira.stages} onSelect={selectStage} selectedN={selectedStage?.n} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 18 }}>
        <div className="card">
          <h2>Details</h2>
          <div className="jira-details">
            <div><span className="k">Status</span><span className="v">{jira.status || '—'}</span></div>
            <div><span className="k">Story points</span><span className="v">{jira.storyPoints ?? '—'}</span></div>
            <div><span className="k">Assignee</span><span className="v">{assigneeName(jira.owner)}</span></div>
            <div><span className="k">Impact</span><span className="v">{jira.impactLevel || '—'}</span></div>
            <div><span className="k">Epic</span><span className="v">{jira.epic || '—'}</span></div>
            <div className="full">
              <span className="k">Labels</span>
              <span className="v">
                {jira.labels && jira.labels.length ? (
                  <span className="row wrap" style={{ gap: 6 }}>
                    {jira.labels.map((l) => <span key={l} className="badge">{l}</span>)}
                  </span>
                ) : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Development</h2>
          {jira.targetRepositories.length === 0 && jira.prUrl.length === 0 && !jira.branchName ? (
            <div className="muted">No development activity recorded yet.</div>
          ) : (
            <>
              {jira.targetRepositories.map((r, i) => {
                const base = repoBase(r);
                return (
                  <div className="dev-repo" key={i}>
                    <div className="dev-repo-name">
                      {base ? (
                        <a href={base} target="_blank" rel="noreferrer">
                          {r.organization ? `${r.organization}/${r.name}` : r.name}
                        </a>
                      ) : (
                        r.name || '—'
                      )}
                    </div>
                    <div className="dev-repo-meta">
                      {r.branch && (
                        <span className="dev-item">
                          <IconGit width={12} height={12} />
                          {base ? (
                            <a className="mono" href={`${base}/tree/${r.branch}`} target="_blank" rel="noreferrer">{r.branch}</a>
                          ) : (
                            <span className="mono">{r.branch}</span>
                          )}
                        </span>
                      )}
                      {r.featureCommit && (
                        <span className="dev-item">
                          commit
                          {base ? (
                            <a className="mono" href={`${base}/commit/${r.featureCommit}`} target="_blank" rel="noreferrer">{shortSha(r.featureCommit)}</a>
                          ) : (
                            <span className="mono">{shortSha(r.featureCommit)}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {jira.branchName && jira.targetRepositories.length === 0 && (
                <div className="dev-repo-meta">
                  <span className="dev-item"><IconGit width={12} height={12} /> <span className="mono">{jira.branchName}</span></span>
                </div>
              )}
              {jira.prUrl.length > 0 && (
                <div className="dev-prs">
                  {jira.prUrl.map((u, i) => (
                    <a key={i} className="btn sm ghost" href={u} target="_blank" rel="noreferrer">
                      <IconExternal width={13} height={13} /> PR #{i + 1}
                    </a>
                  ))}
                </div>
              )}
              {(jira.blockedBy.length > 0 || jira.blocks.length > 0) && (
                <div className="dev-blocks">
                  {jira.blockedBy.length > 0 && <div className="muted">Blocked by: {jira.blockedBy.join(', ')}</div>}
                  {jira.blocks.length > 0 && <div className="muted">Blocks: {jira.blocks.join(', ')}</div>}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedStage ? (
        <StageResults
          key={selectedStage.n}
          n={selectedStage.n}
          cell={selectedStage}
          artifacts={artifacts}
          onOpenArtifact={setOpenArtifact}
          onClear={() => selectStage(null)}
          onStart={startStage}
        />
      ) : (
        <div className="card">
          <h2>Artifacts ({artifacts.length})</h2>
          <ArtifactGrid artifacts={artifacts} onOpen={setOpenArtifact} />
        </div>
      )}

      {openArtifact && <ArtifactViewer path={openArtifact} repoCtx={repoCtx} onClose={() => setOpenArtifact(null)} />}
    </div>
  );
}
