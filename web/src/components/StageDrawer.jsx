import { Modal } from './Modal';
import { StageContent } from './StageContent';

/** Coaching card in a modal — used by the "Stages Help" reference page. */
export function StageDrawer({ n, name, cell, artifacts, onOpenArtifact, perJiraHint, onClose }) {
  return (
    <Modal
      title={
        <span>
          <span className="mono muted">Stage {n}</span> — {name || cell?.name || ''}
        </span>
      }
      onClose={onClose}
    >
      <StageContent n={n} cell={cell} artifacts={artifacts} onOpenArtifact={onOpenArtifact} perJiraHint={perJiraHint} />
    </Modal>
  );
}
