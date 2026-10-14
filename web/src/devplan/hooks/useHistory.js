import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage.js";
import { KEYS, HISTORY_CAP } from "../config.js";

// Persisted, per-epic log of sync events. Each entry is one Sync that produced
// field changes / new / removed tickets, so you can review what Jira changed
// over time even across sessions.
export function useHistory() {
  const [history, setHistory] = useLocalStorage(KEYS.history, []);

  const record = useCallback(
    (entry) => setHistory((h) => [entry, ...h].slice(0, HISTORY_CAP)),
    [setHistory]
  );
  const removeEntry = useCallback(
    (id) => setHistory((h) => h.filter((e) => e.id !== id)),
    [setHistory]
  );
  const clearHistory = useCallback(() => setHistory([]), [setHistory]);
  const replaceHistory = useCallback(
    (list) => setHistory(Array.isArray(list) ? list.slice(0, HISTORY_CAP) : []),
    [setHistory]
  );

  return { history, record, removeEntry, clearHistory, replaceHistory };
}
