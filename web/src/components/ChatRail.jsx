import { useState } from 'react';
import { useChat } from '../context/ChatContext';
import { IconPencil } from './icons';

/** Vertical rail of chat sessions (book tabs) + new-chat + reopenable history.
 *  Double-click a tab title to rename it. */
export function ChatRail() {
  const chat = useChat();
  const [showHistory, setShowHistory] = useState(false);
  const [editing, setEditing] = useState(null); // { scope: 'session' | 'history', id }
  const [draft, setDraft] = useState('');

  const startEdit = (scope, id, current) => {
    setEditing({ scope, id });
    setDraft(current || '');
  };
  const commitEdit = () => {
    if (!editing) return;
    if (editing.scope === 'session') chat.renameSession(editing.id, draft);
    else chat.renameHistory(editing.id, draft);
    setEditing(null);
  };
  const onEditKey = (e) => {
    if (e.key === 'Enter') commitEdit();
    else if (e.key === 'Escape') setEditing(null);
  };

  const editInput = (
    <input
      className="rail-edit"
      value={draft}
      autoFocus
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onEditKey}
      onBlur={commitEdit}
    />
  );

  return (
    <div className="chat-rail">
      <button className="rail-new" onClick={() => chat.newChat()} title="New chat">
        + New chat
      </button>

      <div className="rail-list">
        {chat.sessions.length === 0 && <div className="muted" style={{ fontSize: 11, padding: 8 }}>No open chats</div>}
        {chat.sessions.map((s) => {
          const isEditing = editing?.scope === 'session' && editing.id === s.id;
          return (
            <div
              key={s.id}
              className={`rail-tab ${s.id === chat.activeId ? 'active' : ''}`}
              onClick={() => chat.selectSession(s.id)}
              title={s.title}
            >
              <span className={`rail-dot ${s.state === 'open' ? 'live' : s.busy ? 'busy' : ''}`} />
              {isEditing ? (
                editInput
              ) : (
                <span
                  className="rail-title"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startEdit('session', s.id, s.title);
                  }}
                  title="Double-click to rename"
                >
                  {s.title || 'New chat'}
                </span>
              )}
              {!isEditing && (
                <button
                  className="rail-icon-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit('session', s.id, s.title);
                  }}
                  title="Rename chat"
                >
                  <IconPencil width={12} height={12} />
                </button>
              )}
              <button
                className="rail-close"
                onClick={(e) => {
                  e.stopPropagation();
                  chat.closeSession(s.id);
                }}
                title="Close chat (moves to history)"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <button className="rail-history-toggle" onClick={() => setShowHistory((v) => !v)}>
        History ({chat.history.length})
      </button>
      {showHistory && (
        <div className="rail-history">
          {chat.history.length === 0 && <div className="muted" style={{ fontSize: 11, padding: '6px 8px' }}>No past chats</div>}
          {chat.history.map((h) => {
            const isEditing = editing?.scope === 'history' && editing.id === h.id;
            return (
              <div key={h.id} className="rail-tab" onClick={() => chat.reopenFromHistory(h.id)} title="Reopen chat">
                {isEditing ? (
                  editInput
                ) : (
                  <span
                    className="rail-title"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startEdit('history', h.id, h.title);
                    }}
                    title="Double-click to rename"
                  >
                    {h.title || 'Chat'}
                  </span>
                )}
                {!isEditing && (
                  <button
                    className="rail-icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit('history', h.id, h.title);
                    }}
                    title="Rename chat"
                  >
                    <IconPencil width={12} height={12} />
                  </button>
                )}
                <button
                  className="rail-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    chat.deleteHistory(h.id);
                  }}
                  title="Delete from history"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
