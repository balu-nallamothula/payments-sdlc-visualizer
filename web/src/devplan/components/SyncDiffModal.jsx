import Modal from "./Modal.jsx";
import ChangeList from "./ChangeList.jsx";

// Informational modal shown after a Sync: what changed in Jira since the last
// pull. The same changes are also saved to History.
export default function SyncDiffModal({ changes, onClose }) {
  return (
    <Modal title="Changes from Jira" count={changes.length} ariaLabel="Changes from Jira" onClose={onClose}>
      <div className="modal-body">
        <ChangeList changes={changes} />
      </div>

      <div className="modal-foot">
        <span className="muted modal-foot-note">Saved to History</span>
        <button className="button primary" type="button" onClick={onClose}>Got it</button>
      </div>
    </Modal>
  );
}
