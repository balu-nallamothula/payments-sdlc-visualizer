import Modal from "./Modal.jsx";
import TicketLink from "./TicketLink.jsx";

export default function ChangesModal({ changes, onUndoOne, onUndoAll, onClose }) {
  return (
    <Modal title="Local changes" count={changes.length} ariaLabel="Local changes" onClose={onClose}>
      <div className="modal-body">
        {changes.length === 0 ? (
          <p className="muted modal-empty">No local changes — everything matches Jira.</p>
        ) : (
          <ul className="changes-list">
            {changes.map((c) => (
              <li key={c.key} className="change-row">
                <span className="change-sys"><i className="sysdot" style={{ background: c.color }} />{c.system}</span>
                <TicketLink keyText={c.key} />
                <span className="change-title" title={c.title}>{c.title}</span>
                <span className="change-move">{c.from} <span className="arrow">→</span> <b>{c.to}</b></span>
                <button className="button ghost sm" type="button" onClick={() => onUndoOne(c.key)}>Undo</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="modal-foot">
        <button className="button ghost" type="button" onClick={onClose}>Close</button>
        <button className="button danger" type="button" onClick={onUndoAll} disabled={!changes.length}>Undo all</button>
      </div>
    </Modal>
  );
}
