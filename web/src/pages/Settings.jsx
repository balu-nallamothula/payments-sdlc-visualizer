import { useState } from 'react';
import { testConnection } from '../devplan/jira.js';

// Central place to connect Jira. The PAT is shared (localStorage 'jira:pat') by
// the Dev Plan board and the live data on ticket pages. Read-only; never sent to
// our server beyond the per-request proxy header.
const TOKEN_KEY = 'jira:pat';

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

export function SettingsPage() {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch {
      return '';
    }
  });
  const [conn, setConn] = useState({ status: 'idle', text: '' });

  const save = (value) => {
    setToken(value);
    setConn({ status: 'idle', text: '' });
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
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
    <div>
      <h1 className="page-title">Settings</h1>
      <div className="page-sub">Connections and preferences for the visualizer.</div>

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
          epics in the Dev Plan board. This tool is <strong>read-only</strong>.
        </p>
      </div>
    </div>
  );
}
