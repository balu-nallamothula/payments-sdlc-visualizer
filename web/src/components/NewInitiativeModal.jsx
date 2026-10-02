import { useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { useGit } from '../context/GitContext';

// New initiatives start from the docs repo's trunk; the pipeline branches
// initiative/<slug> off it at kickoff.
const MAIN_BRANCH = 'main';

// Mirror the server's slugify so we can preview the folder name as the user types.
const slugify = (s) =>
  String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

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

// Scaffold a new initiative. Captures the parameters the SDLC agents start from
// (name, id, feature brief, greenfield, figma) and writes a fresh metadata.json;
// the agents drive it forward from Stage 1. Calls onCreated(result) on success.
export function NewInitiativeModal({ onClose, onCreated }) {
  const { branch, checkout, count } = useGit();
  const [name, setName] = useState('');
  const [onePagerPath, setOnePagerPath] = useState('');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [greenfield, setGreenfield] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // The pipeline keys off one kebab-case slug for both the folder and
  // initiative_name, flat under the year dir (<year>/<slug>/).
  const slug = useMemo(() => slugify(name), [name]);
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  // Auto-derived (not asked for): id, branch. The Jira epic isn't set here either
  // — the agents create it at Stage 4 (jira-creator).
  const idPreview = `${slug}-${ym}`;
  const branchPreview = `initiative/${slug}`;

  // New initiatives must be scaffolded on main, not on another initiative's
  // branch (that would mix untracked files into its working tree). If we're off
  // main, switch first as part of Create.
  const needsSwitch = !!branch && branch !== MAIN_BRANCH;

  const submit = async (e) => {
    e?.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (needsSwitch) {
        try {
          await checkout(MAIN_BRANCH);
        } catch (err) {
          setError(
            `Couldn't switch the docs repo to ${MAIN_BRANCH}: ${err.message || 'checkout failed'}. ` +
              `Commit or discard your changes on ${branch} first (use the branch switcher), then retry.`,
          );
          setBusy(false);
          return;
        }
      }
      const { initiative } = await apiClient.createInitiative({
        initiativeName: name.trim(),
        onePagerPath: onePagerPath.trim(),
        figmaUrl: figmaUrl.trim(),
        greenfield,
      });
      onCreated(initiative);
    } catch (err) {
      setError(err.message || 'Could not create the initiative.');
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width: 'min(560px, 96vw)' }} onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h3>New initiative</h3>
          <button className="close" type="button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <form className="body" onSubmit={submit}>
          <p className="muted" style={{ marginTop: 0, fontSize: 12, lineHeight: 1.6 }}>
            Creates the initiative scaffold the SDLC agents start from. It appears in the list at Stage 1, ready for the
            PRD creator to pick up.
          </p>

          {needsSwitch && (
            <div className="live-warning" style={{ marginTop: 4 }}>
              <span>
                The docs repo is on <span className="mono">{branch}</span>. New initiatives start from{' '}
                <span className="mono">{MAIN_BRANCH}</span> — <strong>Create will switch to {MAIN_BRANCH} first</strong>.
                {count > 0 && (
                  <>
                    {' '}You have {count} uncommitted change{count === 1 ? '' : 's'}; if the switch is blocked, commit or
                    discard them first.
                  </>
                )}
              </span>
            </div>
          )}

          <label style={labelStyle}>Initiative name *</label>
          <input
            type="text"
            value={name}
            autoFocus
            placeholder="paze-discover"
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />

          <label style={labelStyle}>Feature brief / one-pager path</label>
          <input
            type="text"
            value={onePagerPath}
            placeholder="inputs/one-pager.md"
            onChange={(e) => setOnePagerPath(e.target.value)}
            style={inputStyle}
          />

          <label style={labelStyle}>Figma URL</label>
          <input
            type="text"
            value={figmaUrl}
            placeholder="https://www.figma.com/design/…"
            onChange={(e) => setFigmaUrl(e.target.value)}
            style={inputStyle}
          />

          <label className="row" style={{ gap: 8, marginTop: 16, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={greenfield} onChange={(e) => setGreenfield(e.target.checked)} />
            Greenfield (no existing codebase to extend)
          </label>

          {slug && (
            <div style={{ marginTop: 18, padding: '12px 14px', background: 'var(--panel-2)', border: '1px solid var(--border)', fontSize: 12, lineHeight: 1.7 }}>
              <div className="muted" style={{ marginBottom: 4 }}>Generated automatically:</div>
              <div>Name &amp; folder <span className="mono">{slug}</span> · ID <span className="mono">{idPreview}</span></div>
              <div className="muted">Branch <span className="mono">{branchPreview}</span> — created by the pipeline off <span className="mono">main</span> at kickoff.</div>
              <div className="muted">Jira epic — created by the agents at Stage 4.</div>
            </div>
          )}

          {error && (
            <div className="row" style={{ marginTop: 16 }}>
              <span className="badge crit">{error}</span>
            </div>
          )}

          <div className="row" style={{ gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
            <button className="btn ghost" type="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn primary" type="submit" disabled={!name.trim() || busy}>
              {busy
                ? needsSwitch
                  ? 'Switching & creating…'
                  : 'Creating…'
                : needsSwitch
                  ? `Switch to ${MAIN_BRANCH} & create`
                  : 'Create initiative'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
