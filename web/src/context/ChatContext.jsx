import { useSyncExternalStore } from 'react';
import { chatStore } from '../chat/chatStore';

// Kept for API symmetry; the store is module-level so no real provider is needed.
export function ChatProvider({ children }) {
  return children;
}

/** Read the multi-session chat store + the actions to drive it. */
export function useChat() {
  const snap = useSyncExternalStore(chatStore.subscribe, chatStore.getSnapshot);
  return {
    sessions: snap.sessions,
    history: snap.history,
    activeId: snap.activeId,
    visible: snap.visible,
    revision: snap.revision,
    target: snap.sessions.find((s) => s.id === snap.activeId)?.target,
    open: chatStore.open,
    close: chatStore.close,
    toggle: chatStore.toggle,
    setTarget: chatStore.setTarget,
    newChat: chatStore.newChat,
    selectSession: chatStore.selectSession,
    closeSession: chatStore.closeSession,
    reopenFromHistory: chatStore.reopenFromHistory,
    deleteHistory: chatStore.deleteHistory,
    renameSession: chatStore.renameSession,
    renameHistory: chatStore.renameHistory,
    connect: chatStore.connect,
    send: chatStore.send,
    interrupt: chatStore.interrupt,
    disconnect: chatStore.disconnect,
  };
}
