import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useGit } from '../context/GitContext';
import { Modal } from './Modal';
import { Markdown } from './Markdown';

function safePretty(txt) {
  try {
    return JSON.stringify(JSON.parse(txt), null, 2);
  } catch {
    return txt;
  }
}

export function ArtifactViewer({ path, repoCtx, onClose }) {
  const [artifact, setArtifact] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const git = useGit();

  useEffect(() => {
    let live = true;
    setArtifact(null);
    setError(null);
    setEditing(false);
    setSaveError(null);
    apiClient
      .artifact(path)
      .then((a) => {
        if (!live) return;
        setArtifact(a);
        setDraft(a.content);
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [path]);

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await apiClient.saveArtifact(path, draft);
      setArtifact((a) => ({ ...a, content: draft, size: res.size }));
      setEditing(false);
      git.refresh(); // reflect the new change in the top-bar count + file dots
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const name = path.split('/').pop();

  const actions = artifact ? (
    editing ? (
      <>
        <button
          className="btn sm"
          onClick={() => {
            setEditing(false);
            setDraft(artifact.content);
            setSaveError(null);
          }}
          disabled={saving}
        >
          Cancel
        </button>
        <button className="btn sm primary" onClick={save} disabled={saving || draft === artifact.content}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </>
    ) : (
      <button
        className="btn sm"
        onClick={() => {
          setDraft(artifact.content);
          setEditing(true);
        }}
      >
        Edit
      </button>
    )
  ) : null;

  return (
    <Modal title={name} subtitle={path} actions={actions} onClose={onClose}>
      {saveError && (
        <div className="zone red" style={{ marginBottom: 12 }}>
          <h4>Could not save</h4>
          <div className="muted" style={{ fontSize: 12 }}>{saveError}</div>
        </div>
      )}

      {error && <div className="muted">Could not load: {error}</div>}
      {!artifact && !error && <div className="spinner">Loading…</div>}

      {artifact &&
        (editing ? (
          <textarea
            className="artifact-editor"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
          />
        ) : (
          <>
            {artifact.ext === '.md' && <Markdown repoCtx={repoCtx}>{artifact.content}</Markdown>}
            {artifact.ext === '.json' && (
              <pre className="md">
                <code>{safePretty(artifact.content)}</code>
              </pre>
            )}
            {!['.md', '.json'].includes(artifact.ext) && (
              <pre className="md">
                <code>{artifact.content}</code>
              </pre>
            )}
          </>
        ))}
    </Modal>
  );
}
