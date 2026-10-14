import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { testConnection } from '../devplan/jira.js';
import { loadEpicsToBoard, importBoardToStore } from '../devplan/boardStore.js';
import { readJsonFile } from '../devplan/download.js';

// Central place to connect Jira and set up the Dev Plan board. The PAT is shared
// (localStorage 'jira:pat') by the board and the live data on ticket pages;
// loading epics here writes the same board snapshot the board restores on mount.
// Read-only; the token never leaves this browser beyond the per-request proxy.
const TOKEN_KEY = 'jira:pat';

const QUICK = [
  { key: 'PAY-6883', label: 'PAY-6883 · Split Payments' },
  { key: 'PAY-7086', label: 'PAY-7086 · Buy Physical GC' },
];

const inputStyle = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid var(--border)',
  background: 'var(--panel-2)',
  color: 'var(--text)',
  font: 'inherit',
  fontSize: 13,
  outline: 'none',
};

function JiraConnectionCard({ token, onSave }) {
  const [conn, setConn] = useState({ status: 'idle', text: '' });

  const save = (value) => {
    onSave(value);
    setConn({ status: 'idle', text: '' });
  };

  async function test() {
    setConn({ status: 'testing', text: 'Testing…' });
    try {
      const me = await testConnection(token);
      setConn({ status: 'ok', text: `Connected as ${me.displayName || me.name || 'user'}` });
    } catch (e) {
      setConn({ status: 'error', text: e.message });
    }
  }

  return (
    <div className="card" style={{ maxWidth: 680, marginTop: 20 }}>
      <h2 style={{ marginTop: 0 }}>Jira connection</h2>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, margin: '14px 0 6px' }}>
        Personal Access Token
      </label>
      <input
        type="password"
        value={token}
        placeholder="Paste your Jira PAT"
        autoComplete="off"
        onChange={(e) => save(e.target.value)}
        style={inputStyle}
      />
      <div className="row" style={{ gap: 10, marginTop: 14, alignItems: 'center' }}>
        <button className="btn primary" disabled={!token.trim() || conn.status === 'testing'} onClick={test}>
          Test connection
        </button>
        <button className="btn ghost" disabled={!token} onClick={() => save('')}>
          Clear token
        </button>
        {conn.text && (
          <span className={`badge ${conn.status === 'ok' ? 'ok' : conn.status === 'error' ? 'crit' : ''}`}>
            {conn.text}
          </span>
        )}
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 16, lineHeight: 1.6, maxWidth: 560 }}>
        jira.sephora.com → avatar → <strong>Profile → Personal Access Tokens → Create token</strong>. Stored only in
        this browser's localStorage, never on the server. Used for the live Jira data on ticket pages and for loading
        epics into the Dev Plan board. This tool is <strong>read-only</strong>.
      </p>
    </div>
  );
}

function DevPlanBoardCard({ token }) {
  const connected = !!(token && token.trim());
  // Prefill the epic(s) when arriving from an initiative (…/settings?epics=PAY-7867),
  // so you land here ready to just hit "Load epics".
  const [params] = useSearchParams();
  const [epicText, setEpicText] = useState(() => (params.get('epics') || '').replace(/,/g, ', '));
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState({ text: '', error: false, done: false });
  const fileRef = useRef(null);

  const addEpic = (key) => {
    const cur = epicText.split(',').map((s) => s.trim()).filter(Boolean);
    if (!cur.includes(key)) cur.push(key);
    setEpicText(cur.join(', '));
  };

  const load = async () => {
    const keys = epicText.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (!keys.length) return;
    setBusy(true);
    setLog({ text: `Loading ${keys.join(', ')}…`, error: false, done: false });
    try {
      const { count } = await loadEpicsToBoard(token, keys);
      setLog({ text: `Loaded ${keys.length} epic(s), ${count} tickets.`, error: false, done: true });
    } catch (e) {
      setLog({ text: e.message || 'Load failed', error: true, done: false });
    } finally {
      setBusy(false);
    }
  };

  const importBoard = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLog({ text: 'Importing…', error: false, done: false });
    try {
      const data = await readJsonFile(file);
      const { count } = importBoardToStore(data);
      setLog({ text: `Imported ${count} tickets from file.`, error: false, done: true });
    } catch (err) {
      setLog({ text: err.message || 'Import failed', error: true, done: false });
    }
  };

  return (
    <div className="card" style={{ maxWidth: 680, marginTop: 20 }}>
      <h2 style={{ marginTop: 0 }}>Dev Plan board</h2>
      <p className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.6, maxWidth: 560 }}>
        Load epics into the board, or rebuild it from a saved export. Loading replaces the current board; several keys
        combine into one.
      </p>

      {!connected && (
        <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          Connect Jira above to load epics. (Importing a board file works without a token.)
        </div>
      )}

      <div className="row wrap" style={{ gap: 8, marginTop: 16 }}>
        {QUICK.map((q) => (
          <button key={q.key} className="btn ghost sm" type="button" disabled={!connected} onClick={() => addEpic(q.key)}>
            {q.label}
          </button>
        ))}
      </div>

      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, margin: '16px 0 6px' }}>
        Epic key(s) — comma separated
      </label>
      <input
        type="text"
        value={epicText}
        placeholder="PAY-6883, PAY-7086"
        disabled={!connected}
        onChange={(e) => setEpicText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); load(); } }}
        style={{ ...inputStyle, opacity: connected ? 1 : 0.6 }}
      />

      <div className="row" style={{ gap: 10, marginTop: 14, alignItems: 'center' }}>
        <button className="btn primary" type="button" disabled={!connected || !epicText.trim() || busy} onClick={load}>
          {busy ? 'Loading…' : 'Load epics'}
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importBoard} />
        <button className="btn ghost" type="button" onClick={() => fileRef.current?.click()}>
          Import board…
        </button>
      </div>

      {log.text && (
        <div className="row" style={{ gap: 12, marginTop: 14, alignItems: 'center' }}>
          <span className={`badge ${log.error ? 'crit' : log.done ? 'ok' : ''}`}>{log.text}</span>
          {log.done && <Link to="/dev-plan">Open the Dev Plan board →</Link>}
        </div>
      )}
    </div>
  );
}

export function SettingsPage() {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch {
      return '';
    }
  });

  const saveToken = (value) => {
    setToken(value);
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <div className="page-sub">Connections and preferences for the visualizer.</div>

      <JiraConnectionCard token={token} onSave={saveToken} />
      <DevPlanBoardCard token={token} />
    </div>
  );
}
