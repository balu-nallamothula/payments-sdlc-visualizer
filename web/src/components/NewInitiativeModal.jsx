import { useState } from 'react';
import { useChat } from '../context/ChatContext';

const inputStyle = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid var(--border)',
  background: 'var(--panel-2)',
  color: 'var(--text)',
  font: 'inherit',
  fontSize: 13,
  outline: 'none',
};
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, margin: '16px 0 6px' };

// New initiatives are created by the pipeline itself: this just captures the idea
// (or a brief path) and runs `/seph-sdlc create <idea-or-brief>` in the chat. The
// pipeline creates the branch, folders and full metadata, confirms a name with
// the user, and runs Stage 1 — so the visualizer never writes a scaffold.
export function NewInitiativeModal({ onClose }) {
  const chat = useChat();
  const [intent, setIntent] = useState('');

  const start = (e) => {
    e?.preventDefault();
    const text = intent.trim();
    if (!text) return;
    chat.open('new initiative', `/seph-sdlc create ${text}`);
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 'min(560px, 96vw)' }} onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h3>New initiative</h3>
          <button className="close" type="button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <form className="body" onSubmit={start}>
          <p className="muted" style={{ marginTop: 0, fontSize: 12, lineHeight: 1.6 }}>
            The pipeline sets the initiative up — it creates the branch, folders and full metadata, then runs Stage 1
            (PRD). It'll confirm the initiative name with you in the chat.
          </p>

          <label style={labelStyle}>Idea or feature-brief path *</label>
          <textarea
            value={intent}
            rows={4}
            autoFocus
            placeholder={'Let shoppers pay with Paze at checkout.\n\n…or a path to an existing brief, e.g. inputs/one-pager.md'}
            onChange={(e) => setIntent(e.target.value)}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <div className="muted" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.6 }}>
            Runs <span className="mono">/seph-sdlc create</span> in the chat. A short idea is enough — the pipeline
            authors the brief. It checks out <span className="mono">main</span> and branches the initiative off it.
          </div>

          <div className="row" style={{ gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
            <button className="btn ghost" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" type="submit" disabled={!intent.trim()}>
              Start in chat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
