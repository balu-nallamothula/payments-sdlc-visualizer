// Multi-session chat store. Manages N independent /seph-sdlc chat sessions, each
// with its own WebSocket, log, and state. Backs a book-tab UI + persisted history.
//
// React reads via useSyncExternalStore(subscribe, getSnapshot). Snapshot is
// immutable (replaced on every change). Live handles (WebSocket, pending command)
// are kept in side maps off the snapshot so they aren't serialized.

const STORAGE_KEY = 'sdlc-chats-v2';
const MAX_LOG = 300;
const MAX_HISTORY = 40;

const wsMap = new Map(); // id -> WebSocket
const pendingMap = new Map(); // id -> command to auto-send once open

let sessions = []; // open tabs: { id, title, target, createdAt, log[], state, busy, backend, _idCounter }
let history = []; // closed sessions: { id, title, target, createdAt, log[] }
let activeId = null;
let visible = false;
let defaultTarget;
// Bumped whenever a chat turn finishes (result/error). Pages watch this to
// auto-refresh their data — finishing a stage in chat makes new artifacts appear.
let revision = 0;

let snapshot = { sessions, history, activeId, visible, revision };
const listeners = new Set();

function commit() {
  snapshot = { sessions, history, activeId, visible, revision };
  persist();
  listeners.forEach((l) => l());
}

function persist() {
  try {
    const enc = (s) => ({ id: s.id, title: s.title, target: s.target, createdAt: s.createdAt, log: s.log.slice(-MAX_LOG) });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ sessions: sessions.map(enc), history: history.slice(0, MAX_HISTORY).map(enc), activeId }),
    );
  } catch {
    /* ignore quota */
  }
}

function hydrate(s) {
  return {
    ...s,
    state: 'idle',
    busy: false,
    backend: null,
    _idCounter: (s.log || []).reduce((m, i) => Math.max(m, i.id || 0), 0),
    log: s.log || [],
  };
}

(function load() {
  let migrated = false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      sessions = (d.sessions || []).map(hydrate);
      history = d.history || [];
      activeId = d.activeId && sessions.some((x) => x.id === d.activeId) ? d.activeId : sessions[0]?.id || null;
    }
    // One-time migration: the old single-session chat stored its transcript under
    // 'sdlc-chat-log'. Bring it into history so it isn't lost.
    const old = localStorage.getItem('sdlc-chat-log');
    if (old != null) {
      try {
        const log = JSON.parse(old);
        if (Array.isArray(log) && log.length) {
          history = [
            { id: `migrated-${Date.now()}`, title: 'Previous chat', target: undefined, createdAt: new Date().toISOString(), log },
            ...history,
          ];
          migrated = true;
        }
      } catch {
        /* ignore */
      }
      localStorage.removeItem('sdlc-chat-log');
    }
  } catch {
    /* ignore */
  }
  snapshot = { sessions, history, activeId, visible, revision };
  if (migrated) persist();
})();

let counter = 0;
function genId() {
  counter += 1;
  return `c${Date.now()}_${counter}`;
}

function patch(id, changes) {
  sessions = sessions.map((s) => (s.id === id ? { ...s, ...changes } : s));
  commit();
}

function appendEvent(id, event) {
  sessions = sessions.map((s) => {
    if (s.id !== id) return s;
    const last = s.log[s.log.length - 1];
    if (event.kind === 'system' && last && last.event.kind === 'system' && last.event.subtype === event.subtype) {
      const updated = { ...last, count: (last.count || 1) + 1 };
      return { ...s, log: [...s.log.slice(0, -1), updated] };
    }
    const nid = (s._idCounter || 0) + 1;
    return { ...s, _idCounter: nid, log: [...s.log, { id: nid, event, count: 1 }] };
  });
  commit();
}

// ---- WebSocket lifecycle ----
function connect(id) {
  const existing = wsMap.get(id);
  if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) return;
  patch(id, { state: 'connecting' });
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${window.location.host}/ws/chat`);
  wsMap.set(id, ws);

  ws.onopen = () => {
    patch(id, { state: 'open' });
    const cmd = pendingMap.get(id);
    if (cmd) {
      pendingMap.delete(id);
      send(id, cmd);
    }
  };
  ws.onclose = () => patch(id, { state: 'closed', busy: false });
  ws.onerror = () => patch(id, { state: 'error' });
  ws.onmessage = (e) => {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    if (msg.type === 'connected') patch(id, { backend: msg.backend });
    else if (msg.type === 'event') {
      appendEvent(id, msg.event);
      if (msg.event?.kind === 'result' || msg.event?.kind === 'error') {
        revision += 1; // turn finished → let pages refresh their data
        patch(id, { busy: false });
      }
    } else if (msg.type === 'closed') {
      appendEvent(id, { kind: 'system', subtype: 'session-closed' });
      patch(id, { busy: false });
    }
  };
}

function send(id, text) {
  const ws = wsMap.get(id);
  const s = sessions.find((x) => x.id === id);
  // Title a session from its first real message.
  if (s && (!s.title || s.title === 'New chat')) patch(id, { title: text.replace(/^\/seph-sdlc\s*/, '').slice(0, 40) || 'Chat' });
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'send', text }));
    appendEvent(id, { kind: 'user', text });
    patch(id, { busy: true });
  }
}

function interrupt(id) {
  const ws = wsMap.get(id);
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'interrupt' }));
  appendEvent(id, { kind: 'system', subtype: 'stopped' });
  patch(id, { busy: false });
}

function disconnect(id) {
  const ws = wsMap.get(id);
  if (ws) ws.close();
  wsMap.delete(id);
  patch(id, { state: 'idle', busy: false });
}

function newChat(target, command) {
  const id = genId();
  const s = {
    id,
    title: command ? command.replace(/^\/seph-sdlc\s*/, '').slice(0, 40) : 'New chat',
    target: target ?? defaultTarget,
    createdAt: new Date().toISOString(),
    log: [],
    state: 'idle',
    busy: false,
    backend: null,
    _idCounter: 0,
  };
  sessions = [...sessions, s];
  activeId = id;
  commit();
  if (command) {
    pendingMap.set(id, command);
    connect(id);
  }
  return id;
}

function closeSession(id) {
  const s = sessions.find((x) => x.id === id);
  disconnect(id);
  pendingMap.delete(id);
  if (s) history = [{ id: s.id, title: s.title, target: s.target, createdAt: s.createdAt, log: s.log }, ...history.filter((h) => h.id !== id)];
  sessions = sessions.filter((x) => x.id !== id);
  if (activeId === id) activeId = sessions[sessions.length - 1]?.id || null;
  commit();
}

function reopenFromHistory(id) {
  const h = history.find((x) => x.id === id);
  if (!h) return;
  history = history.filter((x) => x.id !== id);
  sessions = [...sessions, hydrate(h)];
  activeId = h.id;
  visible = true;
  commit();
}

function deleteHistory(id) {
  history = history.filter((x) => x.id !== id);
  commit();
}

function renameSession(id, title) {
  const t = (title || '').trim();
  if (!t) return;
  patch(id, { title: t });
}

function renameHistory(id, title) {
  const t = (title || '').trim();
  if (!t) return;
  history = history.map((h) => (h.id === id ? { ...h, title: t } : h));
  commit();
}

export const chatStore = {
  subscribe(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  getSnapshot() {
    return snapshot;
  },
  // dock
  open(target, command) {
    if (target != null) defaultTarget = target;
    visible = true;
    if (command) {
      newChat(target, command);
    } else if (sessions.length === 0) {
      newChat(target);
    } else {
      commit();
    }
  },
  close() {
    visible = false;
    commit();
  },
  toggle() {
    visible = !visible;
    if (visible && sessions.length === 0) newChat();
    else commit();
  },
  setTarget(t) {
    defaultTarget = t;
  },
  newChat: (target) => newChat(target),
  selectSession(id) {
    activeId = id;
    commit();
  },
  closeSession,
  reopenFromHistory,
  deleteHistory,
  renameSession,
  renameHistory,
  // active-session actions
  connect,
  send,
  interrupt,
  disconnect,
};
