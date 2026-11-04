import { IconLive } from './icons';
import { useConfirm } from '../context/ConfirmContext';

/** Opt-in live-refresh toggle. Enabling asks for permission first. */
export function LiveToggle({ enabled, connected, onToggle }) {
  const confirm = useConfirm();
  async function handleClick() {
    if (!enabled) {
      const ok = await confirm({
        title: 'Enable live refresh?',
        message:
          'The app will watch sephora-project-docs for changes and update the view ' +
          'automatically as the pipeline runs. Read-only; nothing is written.',
        confirmLabel: 'Enable',
      });
      if (!ok) return;
      onToggle(true);
    } else {
      onToggle(false);
    }
  }

  return (
    <button className={`btn sm ${enabled ? 'primary' : ''}`} onClick={handleClick} title="Live refresh (opt-in)">
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: 0,
          background: enabled ? (connected ? 'var(--ok)' : 'var(--warn)') : 'var(--muted)',
        }}
      />
      <IconLive width={14} height={14} />
      {enabled ? (connected ? 'Live' : 'Connecting…') : 'Live off'}
    </button>
  );
}
