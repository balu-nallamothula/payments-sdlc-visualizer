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
import { IconArrowLeft, IconChat, IconPlay } from '../components/icons';

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
      <Link to={initiativePath(name)} className="breadcrumb">
        <IconArrowLeft width={15} height={15} /> {name}
      </Link>

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', margin: '4px 0 20px' }}>
        <div>
          <h1 className="page-title">
            <span className="mono" style={{ color: 'var(--accent)' }}>{jira.id}</span> {jira.title || ''}
          </h1>
          <div className="row wrap" style={{ gap: 10, fontSize: 12, marginTop: 4 }}>
            {jira.epic && <span className="muted">epic {jira.epic}</span>}
            {jira.storyPoints != null && <span className="muted">{jira.storyPoints} pts</span>}
            {jira.lifecycleStatus && <span className="muted">{jira.lifecycleStatus}</span>}
          </div>
        </div>
        <div className="row wrap" style={{ gap: 8, justifyContent: 'flex-end' }}>
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

      <div style={{ marginBottom: 18 }}>
        <CurrentStageHero
          cells={jira.stages}
          currentStageN={jira.currentStageN}
          owner={jira.owner}
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
          <h2>Repositories</h2>
          {jira.targetRepositories.length === 0 ? (
            <div className="muted">None recorded.</div>
          ) : (
            <ul className="md" style={{ paddingLeft: 18, margin: 0 }}>
              {jira.targetRepositories.map((r, i) => (
                <li key={i}>
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer">{r.name}</a>
                  ) : (
                    r.name
                  )}
                  {r.branch && <span className="muted mono" style={{ fontSize: 11 }}> · {r.branch}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h2>Links & flow</h2>
          <ul className="md" style={{ paddingLeft: 18, margin: 0 }}>
            {jira.prUrl.map((u, i) => (
              <li key={i}>
                <a href={u} target="_blank" rel="noreferrer">Pull request #{i + 1}</a>
              </li>
            ))}
            {jira.branchName && (
              <li className="muted">branch: <span className="mono">{jira.branchName}</span></li>
            )}
            {jira.blockedBy.length > 0 && <li>blocked by: {jira.blockedBy.join(', ')}</li>}
            {jira.blocks.length > 0 && <li>blocks: {jira.blocks.join(', ')}</li>}
            {jira.prUrl.length === 0 && !jira.branchName && <li className="muted">No PR/branch yet.</li>}
          </ul>
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
