import { useState } from 'react';
import { apiClient } from '../api/client';
import { useGit } from '../context/GitContext';
import { Modal } from './Modal';
import { ArtifactViewer } from './ArtifactViewer';
import { IconGit } from './icons';

const READABLE = /\.(md|json|txt|yaml|yml|html)$/i;

/** Top-bar indicator of uncommitted changes in sephora-project-docs + a commit box. */
export function GitChanges() {
  const status = useGit();
  const refresh = status.refresh;
  const [open, setOpen] = useState(false);
  const [openArtifact, setOpenArtifact] = useState(null);
  const [message, setMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [suggesting, setSuggesting] = useState(false);

  async function suggest() {
    setSuggesting(true);
    setError(null);
    try {
      const r = await apiClient.suggestCommitMessage();
      setMessage(r.message || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setSuggesting(false);
    }
  }

  const count = status?.files?.length || 0;

  async function commit() {
    if (!message.trim()) return;
    setCommitting(true);
    setError(null);
    setNotice(null);
    try {
      const r = await apiClient.gitCommit(message.trim());
      setNotice(r.output || 'Committed.');
      setMessage('');
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <>
      <button
        className="iconbtn"
        title={count ? `${count} uncommitted change${count === 1 ? '' : 's'}` : 'No uncommitted changes'}
        onClick={() => {
          setOpen(true);
          refresh();
        }}
      >
        <IconGit width={18} height={18} />
        {count > 0 && <span className="count-badge">{count > 99 ? '99+' : count}</span>}
      </button>

      {open && (
        <Modal
          title="Changes"
          subtitle={status?.branch ? `branch: ${status.branch}` : undefined}
          onClose={() => setOpen(false)}
        >
          {count === 0 ? (
            <div className="muted">No uncommitted changes in sephora-project-docs.</div>
          ) : (
            <>
              <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                {count} changed file{count === 1 ? '' : 's'}
              </div>
              <div className="changes-list">
                {status.files.map((f) => {
                  const readable = READABLE.test(f.path);
                  return (
                    <button
                      key={f.path}
                      className="change-row"
                      disabled={!readable}
                      onClick={() => readable && setOpenArtifact(f.path)}
                      title={readable ? 'Open' : 'Not previewable'}
                    >
                      <span className="change-status">{f.status}</span>
                      <span className="change-path mono">{f.path}</span>
                    </button>
                  );
                })}
              </div>

              <hr />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  className="chat-input"
                  style={{ minHeight: 76, resize: 'vertical', fontFamily: 'var(--sans)' }}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Commit message… (or let Claude draft one)"
                />
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <button className="btn sm" onClick={suggest} disabled={suggesting}>
                    {suggesting ? 'Asking Claude…' : '✨ Ask Claude'}
                  </button>
                  <button className="btn primary" onClick={commit} disabled={committing || !message.trim()}>
                    {committing ? 'Committing…' : `Commit ${count} file${count === 1 ? '' : 's'}`}
                  </button>
                </div>
                <span className="muted" style={{ fontSize: 11 }}>
                  Commits all {count} changes. Review the message before committing.
                </span>
              </div>
            </>
          )}

          {error && (
            <div className="zone red" style={{ marginTop: 12 }}>
              <h4>Commit failed</h4>
              <div className="muted" style={{ fontSize: 12 }}>{error}</div>
            </div>
          )}
          {notice && (
            <div className="zone green" style={{ marginTop: 12 }}>
              <h4>Committed</h4>
              <pre className="md" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{notice}</pre>
            </div>
          )}
        </Modal>
      )}

      {openArtifact && (
        <ArtifactViewer
          path={openArtifact}
          onClose={() => {
            setOpenArtifact(null);
            refresh();
          }}
        />
      )}
    </>
  );
}
