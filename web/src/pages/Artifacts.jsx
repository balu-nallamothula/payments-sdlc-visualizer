import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { ArtifactGrid } from '../components/ArtifactGrid';
import { ArtifactViewer } from '../components/ArtifactViewer';
import { IconArrowRight } from '../components/icons';

export function ArtifactsPage() {
  const [initiatives, setInitiatives] = useState(null);
  const [selected, setSelected] = useState('');
  const [artifacts, setArtifacts] = useState(null);
  const [repoCtx, setRepoCtx] = useState(null);
  const [openArtifact, setOpenArtifact] = useState(null);
  const [error, setError] = useState(null);

  // Load initiative list; default to the last-viewed ("current") project.
  useEffect(() => {
    apiClient
      .initiatives()
      .then((r) => {
        setInitiatives(r.initiatives);
        let current = '';
        try {
          current = localStorage.getItem('sdlc-current-initiative') || '';
        } catch {
          /* ignore */
        }
        const exists = r.initiatives.some((i) => i.id === current);
        setSelected(exists ? current : r.initiatives[0]?.id || '');
      })
      .catch((e) => setError(e.message));
  }, []);

  // Load the selected project's artifacts + repo context (for GitHub links).
  useEffect(() => {
    if (!selected) return;
    setArtifacts(null);
    apiClient.artifacts(selected).then((r) => setArtifacts(r.artifacts)).catch(() => setArtifacts([]));
    apiClient
      .initiative(selected)
      .then((d) => setRepoCtx({ repos: d.jiras.flatMap((j) => j.targetRepositories || []), defaultBranch: 'main' }))
      .catch(() => setRepoCtx(null));
  }, [selected]);

  const selectedInit = useMemo(
    () => initiatives?.find((i) => i.id === selected),
    [initiatives, selected],
  );

  if (error) return <div className="card">Failed to load: {error}</div>;
  if (!initiatives) return <div className="spinner">Loading…</div>;

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <h1 className="page-title">Artifacts</h1>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{
            background: 'var(--panel)',
            color: 'var(--text)',
            border: '1px solid var(--border-strong)',
            padding: '8px 12px',
            fontSize: 13,
            fontFamily: 'var(--sans)',
            cursor: 'pointer',
            maxWidth: 320,
          }}
        >
          {initiatives.map((i) => (
            <option key={i.id} value={i.id}>
              {i.initiativeName}
            </option>
          ))}
        </select>
      </div>
      {selectedInit && (
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
          <span className="page-sub">{selectedInit.relPath}</span>
          <Link to={`/initiatives/${encodeURIComponent(selected)}`} className="btn sm ghost">
            Open initiative <IconArrowRight width={14} height={14} />
          </Link>
        </div>
      )}

      <div className="card">
        <h2>Files{artifacts ? ` (${artifacts.length})` : ''}</h2>
        {!artifacts ? (
          <div className="spinner">Loading artifacts…</div>
        ) : (
          <ArtifactGrid artifacts={artifacts} onOpen={setOpenArtifact} />
        )}
      </div>

      {openArtifact && <ArtifactViewer path={openArtifact} repoCtx={repoCtx} onClose={() => setOpenArtifact(null)} />}
    </div>
  );
}
