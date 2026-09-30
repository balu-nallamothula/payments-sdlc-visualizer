import { statusClassFromName } from "../derive.js";
import TicketLink from "./TicketLink.jsx";

// A status name shown with the same color the board uses for that status.
function StatusPill({ name }) {
  if (!name || name === "—") return <span className="diff-none">—</span>;
  return <span className={`badge s-${statusClassFromName(name)}`}>{name}</span>;
}

// Renders a computeSyncDiff() array: changed tickets (field-by-field), then the
// New and Removed groups. Shared by SyncDiffModal and the History page.
export default function ChangeList({ changes }) {
  const changed = changes.filter((c) => c.kind === "changed");
  const added = changes.filter((c) => c.kind === "new");
  const removed = changes.filter((c) => c.kind === "removed");
  const link = (key) => <TicketLink keyText={key} />;

  if (!changes.length) return <p className="muted modal-empty">No changes.</p>;

  return (
    <>
      {changed.map((c) => (
        <div key={c.key} className="diff-row">
          <div className="diff-head">{link(c.key)}<span className="diff-title" title={c.title}>{c.title}</span></div>
          <ul className="diff-fields">
            {c.fields.map((f) => (
              <li key={f.label}>
                <span className="diff-label">{f.label}</span>{" "}
                {f.label === "Status" ? (
                  <><StatusPill name={f.from} /> <span className="arrow">→</span> <StatusPill name={f.to} /></>
                ) : (
                  <>{f.from} <span className="arrow">→</span> <b>{f.to}</b></>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {added.length > 0 && (
        <div className="diff-group">
          <h3>New ({added.length})</h3>
          {added.map((c) => (
            <div key={c.key} className="diff-row simple">{link(c.key)}<span className="diff-title">{c.title}</span></div>
          ))}
        </div>
      )}
      {removed.length > 0 && (
        <div className="diff-group">
          <h3>Removed ({removed.length})</h3>
          {removed.map((c) => (
            <div key={c.key} className="diff-row simple removed"><span className="card-key">{c.key}</span><span className="diff-title">{c.title}</span></div>
          ))}
        </div>
      )}
    </>
  );
}
