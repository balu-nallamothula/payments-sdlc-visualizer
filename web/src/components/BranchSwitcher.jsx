import { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { useGit } from '../context/GitContext';
import { useConfirm } from '../context/ConfirmContext';
import { IconGit, IconCheck } from './icons';

// Human label for a git porcelain status code (M, A, D, R, ??, …).
function describeStatus(code) {
  const c = (code || '').replace(/\s/g, '');
  if (c === '??') return 'Untracked';
  const map = { M: 'Modified', A: 'Added', D: 'Deleted', R: 'Renamed', C: 'Copied', U: 'Conflicted', T: 'Type changed' };
  return map[c[0]] || (c || 'Changed');
}

// "origin/feature/x" -> "feature/x" (the local branch name it maps to).
const localNameOf = (ref) => ref.slice(ref.indexOf('/') + 1);

// Repos can have thousands of remote branches — cap the rendered list and let the
// filter narrow it, so opening the dropdown never renders a huge DOM.
const MAX_SHOWN = 50;

// Shows the current sephora-project-docs branch and switches to another branch
// via a filterable combobox (type to filter). Lists local branches plus remote
// branches that have no local counterpart (grouped). Switching is repo-wide, so
// it confirms first; a switch blocked by uncommitted changes offers to discard.
export function BranchSwitcher() {
  const { branch, checkout, files } = useGit();
  const confirm = useConfirm();
  const [branches, setBranches] = useState([]);
  const [remotes, setRemotes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let live = true;
    apiClient.gitBranches().then((r) => {
      if (!live) return;
      setBranches(r.branches || []);
      setRemotes(r.remotes || []);
    }).catch(() => {});
    return () => { live = false; };
  }, [branch]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Local branches, then remote branches with no local counterpart, filtered.
  const options = useMemo(() => {
    const locals = branches.map((b) => ({ value: b, label: b, remote: false }));
    const remoteOnly = remotes
      .filter((r) => !branches.includes(localNameOf(r)))
      .map((r) => ({ value: r, label: r, remote: true }));
    const all = [...locals, ...remoteOnly];
    const q = query.trim().toLowerCase();
    return q ? all.filter((o) => o.label.toLowerCase().includes(q)) : all;
  }, [branches, remotes, query]);

  const shown = useMemo(() => options.slice(0, MAX_SHOWN), [options]);
  const overflow = options.length - shown.length;

  async function offerDiscard(opt) {
    const tracked = (files || []).filter((f) => f.status !== '??');
    const discard = await confirm({
      title: 'Discard local changes and switch?',
      message:
        `Switching to "${opt.value}" is blocked by uncommitted changes in sephora-project-docs. ` +
        `You can discard them and switch anyway${tracked.length ? ` — ${tracked.length} file(s) will be reverted:` : '.'}`,
      details: tracked.map((f) => `${describeStatus(f.status)} · ${f.path}`),
      warning: 'This permanently discards these changes. It cannot be undone.',
      confirmLabel: 'Discard & switch',
      cancelLabel: 'Keep changes',
      danger: true,
    });
    if (!discard) return;
    setBusy(true);
    try {
      await checkout(opt.value, { force: true });
    } catch (err) {
      await confirm({ title: "Couldn't switch branch", message: err.message, confirmLabel: 'OK', alert: true });
    } finally {
      setBusy(false);
    }
  }

  async function switchTo(opt) {
    setOpen(false);
    if (!opt || opt.value === branch) return;
    const ok = await confirm({
      title: `Switch to ${opt.value}?`,
      message: opt.remote
        ? `This creates a local branch tracking "${opt.value}", switches to it, and reloads the ` +
          `initiatives for that branch. Uncommitted changes will block the switch.`
        : `This checks out "${opt.value}" in sephora-project-docs and reloads the initiatives for ` +
          `that branch. Uncommitted changes will block the switch.`,
      confirmLabel: 'Switch',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await checkout(opt.value);
      setBusy(false);
    } catch (err) {
      setBusy(false);
      if (err.status === 409) await offerDiscard(opt);
      else await confirm({ title: "Couldn't switch branch", message: err.message, confirmLabel: 'OK', alert: true });
    }
  }

  function onInputKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (shown[active]) switchTo(shown[active]);
    }
  }

  if (!branch) return null;

  return (
    <div className="branch-combo" ref={rootRef} title="sephora-project-docs branch">
      <button
        type="button"
        className="branch-combo-trigger"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <IconGit width={14} height={14} />
        <span className="branch-combo-current">{branch}</span>
        <span className="branch-combo-caret">▾</span>
      </button>
      {open && (
        <div className="branch-combo-pop" role="listbox">
          <input
            ref={inputRef}
            className="branch-combo-input"
            placeholder="Filter branches…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onInputKeyDown}
          />
          <ul className="branch-combo-list">
            {shown.length === 0 ? (
              <li className="branch-combo-empty">No branches match</li>
            ) : (
              shown.map((o, i) => {
                const firstRemote = o.remote && (i === 0 || !shown[i - 1].remote);
                return (
                  <li key={o.value}>
                    {firstRemote && <div className="branch-combo-group">Remote</div>}
                    <button
                      type="button"
                      className={`branch-combo-opt${o.value === branch ? ' is-current' : ''}${i === active ? ' is-active' : ''}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => switchTo(o)}
                      role="option"
                      aria-selected={o.value === branch}
                    >
                      <span className="branch-combo-tick">{o.value === branch && <IconCheck width={12} height={12} />}</span>
                      <span className="branch-combo-name">{o.label}</span>
                    </button>
                  </li>
                );
              })
            )}
            {overflow > 0 && (
              <li className="branch-combo-empty">+{overflow} more — type to filter</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
