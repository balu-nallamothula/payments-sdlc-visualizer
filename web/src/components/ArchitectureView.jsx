import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { artifactsForStage } from '../lib/artifacts';
import { Markdown } from './Markdown';
import { EmptyTab } from './EmptyTab';

// Which half of the architecture a doc belongs to (two folders on disk).
const groupOf = (a) => {
  const d = (a.dir || '').toLowerCase();
  if (d.includes('current-state')) return 'current';
  if (d.includes('target-state')) return 'target';
  return 'other';
};
const LABELS = { target: 'Target state', current: 'Current state', other: 'Reviews & deltas' };

// Interactive architecture view: current vs target vs review/delta docs, rendered
// as Markdown with Mermaid diagrams. Source: stage-3 (03-architecture) artifacts.
export function ArchitectureView({ artifacts, repoCtx }) {
  const archDocs = useMemo(
    () => artifactsForStage(artifacts || [], 3).filter((a) => a.ext === '.md'),
    [artifacts],
  );
  const groups = useMemo(() => {
    const g = { target: [], current: [], other: [] };
    for (const a of archDocs) g[groupOf(a)].push(a);
    return g;
  }, [archDocs]);

  const available = useMemo(() => ['target', 'current', 'other'].filter((k) => groups[k].length), [groups]);
  const [view, setView] = useState(available[0] || 'target');
  const [selected, setSelected] = useState(null);

  // Re-home the view if a refetch empties the group it points at (else the pane
  // strands on an empty group with an endless spinner). Self-terminating.
  useEffect(() => {
    if (available.length && !groups[view]?.length) setView(available[0]);
  }, [available, groups, view]);

  // Default to an overview/summary doc when the group changes, but KEEP the user's
  // current selection if it still exists (a refetch gives `groups` a new identity).
  useEffect(() => {
    const list = groups[view] || [];
    const def = list.find((a) => /overview|summary|diagram/i.test(a.name)) || list[0] || null;
    setSelected((cur) => (list.some((a) => a.relPath === cur) ? cur : def ? def.relPath : null));
  }, [view, groups]);

  const [content, setContent] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    if (!selected) {
      setContent(null);
      return undefined;
    }
    let live = true;
    setContent(null);
    setErr(null);
    apiClient
      .artifact(selected)
      .then((a) => live && setContent(a.content))
      .catch((e) => live && setErr(e.message));
    return () => {
      live = false;
    };
  }, [selected]);

  if (!archDocs.length) return <EmptyTab reason="No architecture documents captured yet (stage 3)." />;

  const docs = groups[view] || [];
  return (
    <div className="card">
      <div className="row wrap" style={{ gap: 8, marginBottom: 16 }}>
        {available.map((k) => (
          <button key={k} type="button" className={`btn sm ${view === k ? 'primary' : ''}`} onClick={() => setView(k)}>
            {LABELS[k]} ({groups[k].length})
          </button>
        ))}
      </div>
      <div className="row" style={{ gap: 18, alignItems: 'flex-start' }}>
        <div style={{ flex: '0 0 230px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {docs.map((a) => (
            <button
              key={a.relPath}
              type="button"
              onClick={() => setSelected(a.relPath)}
              title={a.name}
              style={{
                textAlign: 'left',
                padding: '7px 9px',
                fontSize: 12,
                background: selected === a.relPath ? 'var(--accent-soft)' : 'transparent',
                color: selected === a.relPath ? 'var(--accent)' : 'var(--text)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {a.name}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {err && <div className="muted">Could not load: {err}</div>}
          {selected && content === null && !err && <div className="spinner">Loading…</div>}
          {content !== null && !err && <Markdown repoCtx={repoCtx}>{content}</Markdown>}
        </div>
      </div>
    </div>
  );
}
