import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useGit } from '../context/GitContext';
import { useConfirm } from '../context/ConfirmContext';
import { IconGit } from './icons';

// Shows the current sephora-project-docs branch and switches to another local
// branch. Switching is repo-wide (it changes the data across the whole app), so
// it confirms first; on success GitContext updates the branch and views that key
// off it (the initiatives list) refetch.
export function BranchSwitcher() {
  const { branch, checkout, files } = useGit();
  const confirm = useConfirm();
  const [branches, setBranches] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    apiClient.gitBranches().then((r) => { if (live) setBranches(r.branches || []); }).catch(() => {});
    return () => { live = false; };
  }, [branch]);

  // When a switch is blocked by uncommitted changes, offer to discard them.
  // Shows exactly what would be lost and warns it's irreversible.
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

  async function onChange(e) {
    const target = e.target.value;
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
    } catch (err) {
      setBusy(false);
      if (err.status === 409) {
        await offerDiscard(target); // blocked by uncommitted changes → offer discard
      } else {
        await confirm({ title: "Couldn't switch branch", message: err.message, confirmLabel: 'OK', alert: true });
      }
      return;
    }
    setBusy(false);
  }

  if (!branch) return null;

  return (
    <span className="branch-switcher" title="sephora-project-docs branch">
      <IconGit width={14} height={14} />
      <select value={branch} onChange={onChange} disabled={busy}>
        {!branches.includes(branch) && <option value={branch}>{branch}</option>}
        {branches.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
    </span>
  );
}
