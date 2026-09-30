import { useRef, useState } from "react";
import Icon from "./Icon.jsx";

const QUICK = [
  { key: "PAY-6883", label: "PAY-6883 · Split Payments" },
  { key: "PAY-7086", label: "PAY-7086 · Buy Physical GC" },
];

export default function SetupPanel({ token, setToken, log, busy, initialKeys = [], onTest, onClear, onLoad, onImport }) {
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

  return (
    <section className="panel setup-panel">
      <div className="setup-grid">
        <div className="setup-col">
          <p className="eyebrow">1 · Connect</p>
          <label className="field">
            Personal Access Token
            <input type="password" value={token} placeholder="Paste your Jira PAT" autoComplete="off"
              onChange={(e) => setToken(e.target.value)} />
          </label>
          <div className="row-actions">
            <button className="button primary" type="button" disabled={!token.trim()} onClick={onTest}>Test connection</button>
            <button className="button ghost" type="button" onClick={onClear}>Clear token</button>
          </div>
          <small className="muted">
            jira.sephora.com → avatar → <strong>Profile → Personal Access Tokens → Create token</strong>.
            Stored only in this browser's localStorage, never on the server. This tool is <strong>read-only</strong>.
          </small>
        </div>

        <div className="setup-col">
          <p className="eyebrow">2 · Load epics</p>
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
            <button className="button primary" type="button" disabled={!token.trim() || !epicText.trim() || busy} onClick={doLoad}>
              {busy ? <span className="spinner" /> : "Load epics"}
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importBoard} />
            <button className="button ghost with-icon" type="button" onClick={() => fileRef.current?.click()} title="Rebuild the board from a JSON export — no Jira token needed"><Icon name="import" />Import board…</button>
          </div>
          <small className="muted">Loads these epic(s) as one board (replaces the current one). List several to combine them; switch epic by changing the keys. Or <strong>Import board</strong> from a previous export — no token required.</small>
        </div>
      </div>
      <div className={"setup-log muted" + (log.error ? " error" : "")}>{log.text}</div>
    </section>
  );
}
