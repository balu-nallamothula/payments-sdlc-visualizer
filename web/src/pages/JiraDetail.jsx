import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { jiraFetch } from '../devplan/jira.js';
import { initiativePath } from '../lib/paths';
import { PipelineStrip } from '../components/PipelineStrip';
import { StageResults } from '../components/StageResults';
import { StageBadge } from '../components/StageBadge';
import { ArtifactViewer } from '../components/ArtifactViewer';
import { useChat } from '../context/ChatContext';
import { IconChat, IconCheck, IconExternal, IconGit, IconPlay, IconTicket } from '../components/icons';

const JIRA_BROWSE = 'https://jira.sephora.com/browse';

// Labels can run long; show the first two and tuck the rest behind a toggle.
const LABELS_SHOWN = 2;
function LabelList({ labels }) {
  const [expanded, setExpanded] = useState(false);
  if (!labels.length) return '—';
  const shown = expanded ? labels : labels.slice(0, LABELS_SHOWN);
  const hidden = labels.length - LABELS_SHOWN;
  return (
    <span className="row wrap" style={{ gap: 6 }}>
      {shown.map((l) => <span key={l} className="badge">{l}</span>)}
      {hidden > 0 && (
        <button type="button" className="label-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'show less' : `+${hidden} more`}
        </button>
      )}
    </span>
  );
}

// GitHub links from a normalized target repo (org/name → repo/branch/commit URLs).
const repoBase = (r) => r.url || (r.organization && r.name ? `https://github.com/${r.organization}/${r.name}` : null);
const shortSha = (s) => (s ? s.slice(0, 7) : '');

// Owner is either an email (oscar.solano@…) or an already-formatted name
// ("Solano, Oscar"). Derive a display name and avatar initials handling both.
function displayName(owner) {
  if (!owner) return 'Unassigned';
  if (!owner.includes('@')) return owner; // already a display name
  const parts = owner.split('@')[0].split(/[._-]/).filter(Boolean);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  return parts.length >= 2 ? `${cap(parts[parts.length - 1])}, ${cap(parts[0])}` : cap(parts[0] || owner);
}
function initials(owner) {
  if (!owner) return '—';
  const src = owner.includes('@') ? owner.split('@')[0] : owner;
  const parts = src.split(/[.\s,_-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}
const fmtDate = (iso) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return null;
  }
};
const fmtTime = (iso) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return null;
  }
};
const stageDoneCls = (c) => c.status === 'done' || c.status === 'skipped';
const stageCompletedAt = (c) => {
  const ts = (c.entries || []).map((e) => e.completedAt).filter(Boolean).sort();
  return ts.length ? ts[ts.length - 1] : null;
};
const stageResult = (c) => {
  const e = (c.entries || []).slice().reverse().find((x) => x.result);
  return e ? e.result : null;
};

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
  // Live Jira fields (status/priority/labels/…) overlaid on the docs data when a
  // PAT is connected — the docs reflect the SDLC pipeline, which lags the ticket.
  const [live, setLive] = useState(null);
  const [liveError, setLiveError] = useState(null);

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

  // Pull the live ticket from Jira (via the proxy) when a PAT is present, so the
  // header reflects the real status/priority/labels rather than the docs snapshot.
  useEffect(() => {
    setLive(null);
    setLiveError(null);
    let token = null;
    try { token = localStorage.getItem('jira:pat'); } catch { /* ignore */ }
    if (!token || !token.trim() || !jiraId) return undefined;
    let cancelled = false;
    jiraFetch(token, `issue?key=${encodeURIComponent(jiraId)}`)
      .then((d) => { if (!cancelled) { setLive(d); setLiveError(null); } })
      .catch((e) => { if (!cancelled) { setLive(null); setLiveError(e.message || 'Could not load live Jira data.'); } });
    return () => { cancelled = true; };
  }, [jiraId]);

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
        ? { org: jira.targetRepositories?.[0]?.organization, repos: jira.targetRepositories || [], defaultBranch: 'main' }
        : null,
    [jira],
  );

  const startStage = (stageN, status) => {
    const cmd = status === 'active' ? `/seph-sdlc continue ${jiraId}` : `/seph-sdlc stage ${stageN} ${jiraId}`;
    chat.open(jiraId, cmd);
  };

  if (error) return <div className="card">Failed to load: {error}</div>;
  if (!jira) return <div className="spinner">Loading Jira…</div>;

  const stages = jira.stages || [];
  const doneCount = stages.filter(stageDoneCls).length;
  const totalStages = stages.length;
  const pct = jira.percent ?? (totalStages ? Math.round((doneCount / totalStages) * 100) : 0);
  const activeCell = stages.find((c) => c.status === 'active');
  const current =
    activeCell ||
    stages.find((c) => c.status === 'blocked') ||
    stages.find((c) => !stageDoneCls(c)) ||
    stages[stages.length - 1] ||
    null;

  const completedTimes = stages.flatMap((c) => (c.entries || []).map((e) => e.completedAt)).filter(Boolean).sort();
  const lastUpdated = completedTimes.length ? completedTimes[completedTimes.length - 1] : null;
  const started = jira.activatedAt || (completedTimes.length ? completedTimes[0] : null);

  // A clean short status for the chip (the raw status can be a long lifecycle note).
  const shortStatus = pct >= 100 ? 'Done' : activeCell || doneCount > 0 ? 'In Progress' : 'To do';
  const statusChip = pct >= 100 ? 'ok' : activeCell || doneCount > 0 ? 'active' : '';
  const epicUrl = jira.epic ? `${JIRA_BROWSE}/${jira.epic}` : null;

  // Stage activity order: completed stages newest-first, then the rest ascending.
  const activity = [...stages].sort((a, b) => {
    const ad = stageDoneCls(a);
    const bd = stageDoneCls(b);
    if (ad !== bd) return ad ? -1 : 1;
    return ad ? b.n - a.n : a.n - b.n;
  });

  const phaseLabel = stages.length && stages[0].n >= 5 ? `stages ${stages[0].n}–${stages[stages.length - 1].n}` : 'pipeline';

  // Live Jira overrides (when a PAT is connected) reflect the real ticket; fall
  // back to the docs snapshot otherwise.
  const priorityCls = (p) => {
    const l = (p || '').toLowerCase();
    if (l === 'critical' || l === 'high' || l === 'highest') return 'high';
    if (l === 'medium') return 'medium';
    return 'low';
  };
  const statusName = live?.status || shortStatus;
  const statusCls = live?.status
    ? (live.statusCategory === 'done' ? 'ok' : live.statusCategory === 'indeterminate' ? 'active' : '')
    : statusChip;
  const priority = live?.priority || null;
  const labels = live?.labels && live.labels.length ? live.labels : jira.labels || [];
  const storyPoints = live?.storyPoints ?? jira.storyPoints;
  const assigneeName = live?.assignee?.displayName || displayName(jira.owner);
  const assigneeInitials = initials(live?.assignee?.displayName || live?.assignee?.name || jira.owner);
  const fixVersions = live?.fixVersions && live.fixVersions.length ? live.fixVersions : null;

  const labelsCell = <LabelList labels={labels} />;
  const epicCell = jira.epic ? <a href={epicUrl} target="_blank" rel="noreferrer">{jira.epic}</a> : '—';

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

        <div className="jira-head">
          <div className="jira-head-main">
            <div className="jira-eyebrow">
              <IconTicket width={13} height={13} /> Jira ticket
              {live && <span className="jira-live" title="Live from Jira">live</span>}
            </div>
            <a className="jira-key mono" href={jira.url || `${JIRA_BROWSE}/${jira.id}`} target="_blank" rel="noreferrer" title="Open in Jira">{jira.id}</a>
            <h1 className="jira-title">{jira.title || ''}</h1>
            <div className="row wrap" style={{ gap: 8, marginTop: 16 }}>
              <span className={`badge badge-status ${statusCls}`}>{statusName}</span>
              {storyPoints != null && <span className="badge">{storyPoints} pts</span>}
              {priority ? (
                <span className={`impact-chip impact-${priorityCls(priority)}`}><span className="dot" />{priority} priority</span>
              ) : jira.impactLevel ? (
                <span className={`impact-chip impact-${jira.impactLevel.toLowerCase()}`}><span className="dot" />{jira.impactLevel} impact</span>
              ) : null}
            </div>
            {jira.lifecycleStatus && jira.lifecycleStatus !== shortStatus && (
              <div className="jira-status-note">{jira.lifecycleStatus}</div>
            )}
            <div className="jira-meta">
              <div>
                <span className="k">Assignee</span>
                <span className="v jira-assignee"><span className="avatar">{assigneeInitials}</span>{assigneeName}</span>
              </div>
              <div><span className="k">Epic</span><span className="v">{epicCell}</span></div>
              <div><span className="k">Labels</span><span className="v">{labelsCell}</span></div>
              {fixVersions && <div><span className="k">Fix version</span><span className="v">{fixVersions.join(', ')}</span></div>}
              <div><span className="k">Started</span><span className="v">{fmtDate(started) || '—'}</span></div>
              <div><span className="k">Last updated</span><span className="v">{fmtDate(lastUpdated) || '—'}</span></div>
            </div>
          </div>

          <div className="jira-head-side">
            <div className="k">Delivery progress</div>
            <div className="jira-progress-count"><strong>{doneCount}</strong> / {totalStages} stages complete</div>
            <div className="jira-progress-strip"><PipelineStrip cells={stages} /></div>
            <div className="jira-progress-pct">{pct}%</div>
            {current && (
              <div className="jira-current">
                <div className="k">Current stage</div>
                <div className="v">{current.name} <StageBadge status={current.status} /></div>
              </div>
            )}
          </div>
        </div>

        <div className="jira-actions">
          <a className="btn sm" href={jira.url || `${JIRA_BROWSE}/${jira.id}`} target="_blank" rel="noreferrer" title="Open this ticket in Jira">
            <IconExternal width={14} height={14} /> Open in Jira
          </a>
          {activeCell && (
            <button className="btn sm" onClick={() => chat.open(jira.id, `/seph-sdlc continue ${jira.id}`)} title={`Continue ${activeCell.name}`}>
              <IconPlay width={13} height={13} className="nudge" /> Continue stage {activeCell.n}
            </button>
          )}
          <button className="btn sm primary" onClick={() => chat.open(jira.id)}>
            <IconChat width={15} height={15} /> Run in chat
          </button>
        </div>
      </div>

      {liveError && (
        <div className="live-warning">
          <span>
            <strong>Live Jira data unavailable.</strong> {liveError} Showing the pipeline snapshot (from docs).
            Check your token in <Link to="/settings">Settings</Link>.
          </span>
        </div>
      )}

      {jira.blocking.length > 0 && (
        <div className="zone red" style={{ marginBottom: 18 }}>
          <h4>Blocking conditions</h4>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {jira.blocking.map((b, i) => (
              <li key={i}><strong>{b.type}:</strong> {b.description}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card" style={{ marginBottom: 18 }}>
          <h2>Development</h2>
          {jira.targetRepositories.length === 0 && jira.prUrl.length === 0 && !jira.branchName ? (
            <div className="muted">No development activity recorded yet.</div>
          ) : (
            <div className="kv">
              {jira.targetRepositories.map((r, i) => {
                const base = repoBase(r);
                return (
                  <Fragment key={i}>
                    <div className="k">Repository</div>
                    <div className="v dev-item">
                      <IconGit width={13} height={13} />
                      {base ? <a href={base} target="_blank" rel="noreferrer">{r.organization ? `${r.organization}/${r.name}` : r.name}</a> : (r.name || '—')}
                    </div>
                    {r.branch && (
                      <>
                        <div className="k">Branch</div>
                        <div className="v">{base ? <a className="mono" href={`${base}/tree/${r.branch}`} target="_blank" rel="noreferrer">{r.branch}</a> : <span className="mono">{r.branch}</span>}</div>
                      </>
                    )}
                    {r.featureCommit && (
                      <>
                        <div className="k">Commit</div>
                        <div className="v">{base ? <a className="mono" href={`${base}/commit/${r.featureCommit}`} target="_blank" rel="noreferrer">{shortSha(r.featureCommit)}</a> : <span className="mono">{shortSha(r.featureCommit)}</span>}</div>
                      </>
                    )}
                  </Fragment>
                );
              })}
              {jira.branchName && jira.targetRepositories.length === 0 && (
                <>
                  <div className="k">Branch</div>
                  <div className="v"><span className="mono">{jira.branchName}</span></div>
                </>
              )}
              {jira.prUrl.length > 0 && (
                <>
                  <div className="k">Pull request{jira.prUrl.length > 1 ? 's' : ''}</div>
                  <div className="v">
                    <span className="row wrap" style={{ gap: 10 }}>
                      {jira.prUrl.map((u, i) => (
                        <a key={i} className="dev-item" href={u} target="_blank" rel="noreferrer">#{i + 1} <IconExternal width={12} height={12} /></a>
                      ))}
                    </span>
                  </div>
                </>
              )}
              {jira.epic && (<><div className="k">Jira in Epic</div><div className="v">{epicCell}</div></>)}
              {jira.blockedBy.length > 0 && (<><div className="k">Blocked by</div><div className="v">{jira.blockedBy.join(', ')}</div></>)}
              {jira.blocks.length > 0 && (<><div className="k">Blocks</div><div className="v">{jira.blocks.join(', ')}</div></>)}
            </div>
          )}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Stage activity <span className="muted" style={{ fontWeight: 400 }}>({phaseLabel})</span></h2>
          <div className="row" style={{ gap: 14, alignItems: 'baseline' }}>
            <span className="muted" style={{ fontSize: 12 }}>
              {started && `Started ${fmtDate(started)}`}
              {started && lastUpdated && ' · '}
              {lastUpdated && `Last updated ${fmtDate(lastUpdated)}`}
            </span>
            {activeCell && (
              <button className="btn sm ghost" onClick={() => chat.open(jira.id, `/seph-sdlc continue ${jira.id}`)}>
                <IconPlay width={13} height={13} /> Continue stage
              </button>
            )}
          </div>
        </div>
        <div className="stage-activity">
          {activity.map((c) => {
            const done = stageDoneCls(c);
            const at = stageCompletedAt(c);
            const msg = stageResult(c);
            return (
              <button key={c.n} className={`sa-row${selectedStage?.n === c.n ? ' is-selected' : ''}`} onClick={() => selectStage(c)} title={`Stage ${c.n} — ${c.name}`}>
                <span className={`sa-status sa-${c.status}`}>{done ? <IconCheck width={12} height={12} /> : null}</span>
                <span className="sa-n mono">{String(c.n).padStart(2, '0')}</span>
                <span className="sa-name">{c.name}</span>
                <span className="sa-badge"><StageBadge status={c.status} /></span>
                <span className="sa-date">{at ? fmtDate(at) : '—'}</span>
                <span className="sa-time">{at ? fmtTime(at) : ''}</span>
                <span className="sa-msg muted">{msg || (done ? 'complete' : c.status)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedStage && (
        <StageResults
          key={selectedStage.n}
          n={selectedStage.n}
          cell={selectedStage}
          artifacts={artifacts}
          onOpenArtifact={setOpenArtifact}
          onClear={() => selectStage(null)}
          onStart={startStage}
        />
      )}

      {openArtifact && <ArtifactViewer path={openArtifact} repoCtx={repoCtx} onClose={() => setOpenArtifact(null)} />}
    </div>
  );
}
