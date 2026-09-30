import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useGit } from '../context/GitContext';
import { useConfirm } from '../context/ConfirmContext';
import { IconGit } from './icons';

// Shows the current sephora-project-docs branch and switches to another local
// branch. Switching is repo-wide (it changes the data across the whole app), so
// it confirms first and, on success, returns to the initiatives list — the
// current initiative may not exist on the other branch.
export function BranchSwitcher() {
  const { branch, checkout } = useGit();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    apiClient.gitBranches().then((r) => { if (live) setBranches(r.branches || []); }).catch(() => {});
    return () => { live = false; };
  }, [branch]);

  async function onChange(e) {
    const target = e.target.value;
    if (!target || target === branch) return;
    const ok = await confirm({
      title: `Switch to ${target}?`,
      message:
        `This checks out "${target}" in sephora-project-docs and changes the data shown ` +
        `across the app. Uncommitted changes will block the switch.`,
      confirmLabel: 'Switch',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await checkout(target);
      navigate('/initiatives');
    } catch (err) {
      await confirm({ title: "Couldn't switch branch", message: err.message, confirmLabel: 'OK', alert: true });
    } finally {
      setBusy(false);
    }
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
