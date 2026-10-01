import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";

const QUICK = [
  { key: "PAY-6883", label: "PAY-6883 · Split Payments" },
  { key: "PAY-7086", label: "PAY-7086 · Buy Physical GC" },
];

// Jira connection (the PAT) now lives in Settings; this panel only loads epics
// into the board. The token is read from the shared store (useJira → jira:pat).
export default function SetupPanel({ token, log, busy, initialKeys = [], onLoad, onImport }) {
  const [epicText, setEpicText] = useState(initialKeys.join(", "));
  const fileRef = useRef(null);

  const importBoard = (e) => {
    const file = e.target.files?.[0];
    if (file) onImport?.(file);
    e.target.value = "";
  };

  const addEpic = (key) => {
    const cur = epicText.split(",").map((s) => s.trim()).filter(Boolean);
    if (!cur.includes(key)) cur.push(key);
    setEpicText(cur.join(", "));
  };
  const doLoad = () => {
    const keys = epicText.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (keys.length) onLoad(keys);
  };

  const connected = !!(token && token.trim());

  return (
    <section className="panel setup-panel">
      {!connected && (
        <div style={{ marginBottom: 14, padding: "10px 12px", background: "var(--panel-soft)", border: "1px solid var(--line)", fontSize: 13 }}>
          Connect Jira in <Link to="/settings">Settings</Link> to load epics from the board.
        </div>
      )}
      <p className="eyebrow">Load epics</p>
      <div className="chip-row">
        {QUICK.map((q) => (
          <button key={q.key} className="chip" type="button" onClick={() => addEpic(q.key)}>{q.label}</button>
        ))}
      </div>
      <label className="field">
        Epic key(s) — comma separated
        <input type="text" value={epicText} placeholder="PAY-6883, PAY-7086"
          onChange={(e) => setEpicText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doLoad(); } }} />
      </label>
      <div className="row-actions">
        <button className="button primary" type="button" disabled={!connected || !epicText.trim() || busy} onClick={doLoad}>
          {busy ? <span className="spinner" /> : "Load epics"}
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importBoard} />
        <button className="button ghost with-icon" type="button" onClick={() => fileRef.current?.click()} title="Rebuild the board from a JSON export — no Jira token needed"><Icon name="import" />Import board…</button>
      </div>
      <small className="muted">Loads these epic(s) as one board (replaces the current one). List several to combine them. Or <strong>Import board</strong> from a previous export — no token required.</small>
      <div className={"setup-log muted" + (log.error ? " error" : "")}>{log.text}</div>
    </section>
  );
}
