import { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { useGit } from '../context/GitContext';
import { useConfirm } from '../context/ConfirmContext';
import { IconGit, IconCheck } from './icons';

// Shows the current sephora-project-docs branch and switches to another local
// branch via a filterable combobox (type to filter). Switching is repo-wide (it
// changes the data across the whole app), so it confirms first; on success
// GitContext updates the branch and views that key off it (the initiatives list)
// refetch. A switch blocked by uncommitted changes offers to discard them.
export function BranchSwitcher() {
  const { branch, checkout, files } = useGit();
  const confirm = useConfirm();
  const [branches, setBranches] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let live = true;
    apiClient.gitBranches().then((r) => { if (live) setBranches(r.branches || []); }).catch(() => {});
    return () => { live = false; };
  }, [branch]);

  // Close on outside click / Escape; focus the filter input when opening.
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? branches.filter((b) => b.toLowerCase().includes(q)) : branches;
  }, [branches, query]);

  // When a switch is blocked by uncommitted changes, offer to discard them.
  async function offerDiscard(target) {
    const tracked = (files || []).filter((f) => f.status !== '??');
    const discard = await confirm({
      title: 'Discard local changes and switch?',
      message:
        `Switching to "${target}" is blocked by uncommitted changes in sephora-project-docs. ` +
        `You can discard them and switch anyway${tracked.length ? ` — ${tracked.length} file(s) will be reverted:` : '.'}`,
      details: tracked.map((f) => `${f.status || 'M'}  ${f.path}`),
      warning: 'This permanently discards these changes. It cannot be undone.',
      confirmLabel: 'Discard & switch',
      cancelLabel: 'Keep changes',
      danger: true,
    });
    if (!discard) return;
    setBusy(true);
    try {
      await checkout(target, { force: true });
    } catch (err) {
      await confirm({ title: "Couldn't switch branch", message: err.message, confirmLabel: 'OK', alert: true });
    } finally {
      setBusy(false);
    }
  }

  async function switchTo(target) {
    setOpen(false);
    if (!target || target === branch) return;
    const ok = await confirm({
      title: `Switch to ${target}?`,
      message:
        `This checks out "${target}" in sephora-project-docs and reloads the initiatives ` +
        `for that branch. Uncommitted changes will block the switch.`,
      confirmLabel: 'Switch',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await checkout(target);
      setBusy(false);
    } catch (err) {
      setBusy(false);
      if (err.status === 409) await offerDiscard(target);
      else await confirm({ title: "Couldn't switch branch", message: err.message, confirmLabel: 'OK', alert: true });
    }
  }

  function onInputKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const t = filtered[active];
      if (t) switchTo(t);
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
            {filtered.length === 0 ? (
              <li className="branch-combo-empty">No branches match</li>
            ) : (
              filtered.map((b, i) => (
                <li key={b}>
                  <button
                    type="button"
                    className={`branch-combo-opt${b === branch ? ' is-current' : ''}${i === active ? ' is-active' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => switchTo(b)}
                    role="option"
                    aria-selected={b === branch}
                  >
                    <span className="branch-combo-tick">{b === branch && <IconCheck width={12} height={12} />}</span>
                    <span className="branch-combo-name">{b}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
