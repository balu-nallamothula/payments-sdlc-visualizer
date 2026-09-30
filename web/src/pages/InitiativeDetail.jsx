import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { StageNodes } from '../components/StageNodes';
import { CurrentStageHero } from '../components/CurrentStageHero';
import { JiraBoard } from '../components/JiraBoard';
import { StageResults } from '../components/StageResults';
import { ArtifactViewer } from '../components/ArtifactViewer';
import { ArtifactGrid } from '../components/ArtifactGrid';
import { CountUp } from '../components/CountUp';
import { LiveToggle } from '../components/LiveToggle';
import { useChat } from '../context/ChatContext';
import { useSSE } from '../hooks/useSSE';
import { IconArrowLeft, IconChat, IconPlay, IconStar } from '../components/icons';

export function InitiativeDetailPage({ name: nameProp }) {
  const params = useParams();
  const name = nameProp ?? params.name ?? '';
  const [searchParams, setSearchParams] = useSearchParams();
  const chat = useChat();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [artifacts, setArtifacts] = useState([]);
  const [openArtifact, setOpenArtifact] = useState(null);
  const [live, setLive] = useState(false);
  const [stageJiraArtifacts, setStageJiraArtifacts] = useState([]);

  // The selected pipeline stage lives in the URL (?stage=N) so it's shareable and
  // survives a reload; it's derived from the loaded pipeline rather than stored.
  const stageParam = searchParams.get('stage');
  const selectedStage = useMemo(() => {
    if (!detail || !stageParam) return null;
    const n = Number(stageParam);
    return detail.pipeline.cells.find((c) => c.n === n) || null;
  }, [detail, stageParam]);
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
    apiClient.initiative(name).then(setDetail).catch((e) => setError(e.message));
    apiClient.artifacts(name).then((r) => setArtifacts(r.artifacts)).catch(() => setArtifacts([]));
  }, [name]);

  useEffect(() => {
    setDetail(null);
    setError(null);
    chat.setTarget(name);
    try {
      localStorage.setItem('sdlc-current-initiative', name);
    } catch {
      /* ignore */
    }
    load();
  }, [name, load]);

  const { connected } = useSSE(live, load);

  // Auto-refresh when a chat turn finishes (e.g. a stage completes in chat →
  // its new artifacts show up without a manual reload). Skips the initial mount.
  const seenRev = useRef(chat.revision);
  useEffect(() => {
    if (chat.revision === seenRev.current) return;
    seenRev.current = chat.revision;
    load();
  }, [chat.revision, load]);

  // For a per-jira stage (5–12), load the artifacts from each Jira so the stage
  // panel can show them (they live under jiras/<id>/, not at the initiative root).
  useEffect(() => {
    if (!detail || !selectedStage || selectedStage.n < 5) {
      setStageJiraArtifacts([]);
      return undefined;
    }
    let live2 = true;
    Promise.all(
      detail.jiras.map((j) => apiClient.artifacts(name, j.id).then((r) => r.artifacts).catch(() => [])),
    ).then((lists) => {
      if (live2) setStageJiraArtifacts(lists.flat());
    });
    return () => {
      live2 = false;
    };
  }, [detail, selectedStage, name]);

  const repoCtx = useMemo(
    () =>
      detail
        ? { repos: detail.jiras.flatMap((j) => j.targetRepositories || []), defaultBranch: 'main' }
        : null,
    [detail],
  );

  const startStage = (stageN, status) => {
    const cmd = status === 'active' ? `/seph-sdlc continue ${name}` : `/seph-sdlc stage ${stageN} ${name}`;
    chat.open(name, cmd);
  };

  if (error) return <div className="card">Failed to load: {error}</div>;
  if (!detail) return <div className="spinner">Loading initiative…</div>;

  const { initiative, pipeline, jiras } = detail;
  // The current stage to continue. In the initiative phase that's an initiative
  // stage (target = initiative). In the per-jira phase with a single Jira it's
  // that Jira's active stage (target = jira id).
  let continueInfo = null;
  if (initiative.phase === 'initiative') {
    const c = pipeline.cells.find((x) => x.status === 'active');
    if (c) continueInfo = { n: c.n, name: c.name, target: name };
  } else if (jiras.length === 1) {
    const c = jiras[0].stages.find((x) => x.status === 'active');
    if (c) continueInfo = { n: c.n, name: c.name, target: jiras[0].id };
  }

  // When a per-jira stage (5–12) is selected at the initiative level, offer a
  // per-Jira Continue/Start action (those stages run per Jira).
  const perJiraList =
    selectedStage && selectedStage.n >= 5
      ? jiras.map((j) => ({ id: j.id, status: j.stages.find((c) => c.n === selectedStage.n)?.status || 'pending' }))
      : [];
  const startJiraStage = (jiraId, status) => {
    const cmd = status === 'active' ? `/seph-sdlc continue ${jiraId}` : `/seph-sdlc stage ${selectedStage.n} ${jiraId}`;
    chat.open(jiraId, cmd);
  };

  return (
    <div>
      <Link to="/initiatives" className="breadcrumb">
        <IconArrowLeft width={15} height={15} /> Back to Initiatives
      </Link>

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', margin: '4px 0 20px' }}>
        <div>
          <div className="row" style={{ gap: 10 }}>
            <h1 className="page-title">{initiative.initiativeName}</h1>
            <IconStar width={18} height={18} color="var(--muted)" />
          </div>
          <div className="page-sub">{initiative.relPath}</div>
        </div>
        <div className="row wrap" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <span className={`badge ${initiative.phase === 'per-jira' ? 'rose' : 'violet'}`}>{initiative.phase}</span>
          {initiative.greenfield && <span className="badge">greenfield</span>}
          {initiative.lateEntry && <span className="badge warn">late entry</span>}
          <span className="badge violet"><CountUp value={pipeline.percent} suffix="% complete" /></span>
          <LiveToggle enabled={live} connected={connected} onToggle={setLive} />
          {continueInfo && (
            <button
              className="btn sm"
              onClick={() => chat.open(continueInfo.target, `/seph-sdlc continue ${continueInfo.target}`)}
              title={`Continue ${continueInfo.name}`}
            >
              <IconPlay width={13} height={13} className="nudge" /> Continue stage {continueInfo.n}
            </button>
          )}
          <button className="btn sm primary" onClick={() => chat.open(name)}>
            <IconChat width={15} height={15} /> Run in chat
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <CurrentStageHero
          cells={pipeline.cells}
          currentStageN={initiative.currentStageN}
          onAction={
            continueInfo
              ? () => chat.open(continueInfo.target, `/seph-sdlc continue ${continueInfo.target}`)
              : undefined
          }
        />
      </div>

      {initiative.blocking.length > 0 && (
        <div className="zone red" style={{ marginBottom: 18 }}>
          <h4>Blocking conditions</h4>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {initiative.blocking.map((b, i) => (
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
            : 'Pipeline'}
        </h2>
        <StageNodes cells={pipeline.cells} onSelect={selectStage} selectedN={selectedStage?.n} />
        <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>
          Stages 1–4 reflect this initiative; stages 5–12 aggregate across its Jiras. Click a stage to see its results.
        </div>
      </div>

      {selectedStage ? (
        <StageResults
          key={selectedStage.n}
          n={selectedStage.n}
          cell={selectedStage}
          artifacts={artifacts}
          perJiraHint={selectedStage.n >= 5}
          onOpenArtifact={setOpenArtifact}
          onClear={() => selectStage(null)}
          onStart={selectedStage.n <= 4 ? startStage : undefined}
          jiraList={perJiraList}
          onJiraStart={startJiraStage}
          jiraArtifacts={stageJiraArtifacts}
        />
      ) : (
        <>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Jiras ({jiras.length})</h2>
            </div>
            <JiraBoard initiativeId={name} jiras={jiras} />
          </div>

          <div className="card">
            <h2>Artifacts ({artifacts.length})</h2>
            <ArtifactGrid artifacts={artifacts} onOpen={setOpenArtifact} />
          </div>
        </>
      )}

      {openArtifact && <ArtifactViewer path={openArtifact} repoCtx={repoCtx} onClose={() => setOpenArtifact(null)} />}
    </div>
  );
}
