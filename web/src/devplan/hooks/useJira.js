import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalStorage } from "./useLocalStorage.js";
import { fetchEpic, testConnection } from "../jira.js";
import { EPIC_COLORS, KEYS } from "../config.js";
import { jiraSprintNumber, shortAssignee, cleanTitle, sprintShort, flattenIssues, countIssues } from "../derive.js";

function issueMap(epicsObj) {
  return new Map(flattenIssues(epicsObj).map((i) => [i.key, i]));
}
const assigneeLabel = (iss) => (iss.assignee && iss.assignee.displayName ? shortAssignee(iss.assignee.displayName) : "Unassigned");
const pointsLabel = (iss) => (iss.storyPoints == null ? "—" : String(iss.storyPoints));
const sprintLabel = (iss) => sprintShort(jiraSprintNumber(iss));

// Diff two epic snapshots into a list of per-ticket changes (assignee, status,
// points, sprint) plus new / removed tickets.
function computeSyncDiff(oldMap, newEpics) {
  const changes = [];
  const newMap = issueMap(newEpics);
  newMap.forEach((n, key) => {
    const o = oldMap.get(key);
    if (!o) { changes.push({ key, title: cleanTitle(n.summary), kind: "new", fields: [] }); return; }
    const fields = [];
    if (assigneeLabel(o) !== assigneeLabel(n)) fields.push({ label: "Assignee", from: assigneeLabel(o), to: assigneeLabel(n) });
    if ((o.status || "") !== (n.status || "")) fields.push({ label: "Status", from: o.status || "—", to: n.status || "—" });
    if (pointsLabel(o) !== pointsLabel(n)) fields.push({ label: "Points", from: pointsLabel(o), to: pointsLabel(n) });
    if (sprintLabel(o) !== sprintLabel(n)) fields.push({ label: "Sprint", from: sprintLabel(o), to: sprintLabel(n) });
    if (fields.length) changes.push({ key, title: cleanTitle(n.summary), kind: "changed", fields });
  });
  oldMap.forEach((o, key) => { if (!newMap.has(key)) changes.push({ key, title: cleanTitle(o.summary), kind: "removed", fields: [] }); });
  return changes;
}

// Connection + epic loading. Owns token/conn/epics/busy/log, the auto-restore,
// and the sync diff (what changed in Jira since the last pull).
export function useJira(showToast, onSyncEvent) {
  const [token, setToken] = useLocalStorage(KEYS.token, "");
  const [loadedKeys, setLoadedKeys] = useLocalStorage(KEYS.loaded, []);
  // Board snapshot persists across sessions so it's visible before any Jira call
  // and gives Sync a baseline to diff against.
  const [epics, setEpics] = useLocalStorage(KEYS.epicsCache, {});
  const [conn, setConn] = useState({ color: "gray", text: token ? "Token loaded (not tested)" : "Not connected" });
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState({ text: "Paste your token, then load one or more epics.", error: false });
  const [syncDiff, setSyncDiff] = useState(null);
  const clearSyncDiff = useCallback(() => setSyncDiff(null), []);

  const epicsRef = useRef(epics);
  useEffect(() => { epicsRef.current = epics; }, [epics]);

  const loadEpics = useCallback(
    async (keys, { silent = false, diff = false } = {}) => {
      if (!token) { showToast("Paste your token and Test connection first.", true); return false; }
      const oldMap = diff ? issueMap(epicsRef.current) : null;
      setBusy(true);
      if (!silent) setLog({ text: `Loading ${keys.join(", ")}…`, error: false });
      try {
        const fresh = {};
        let idx = 0;
        for (const key of keys) {
          const ep = await fetchEpic(token, key);
          fresh[key] = { ...ep, color: EPIC_COLORS[idx % EPIC_COLORS.length] };
          idx++;
        }
        setEpics(fresh);
        setLoadedKeys(keys);
        const total = countIssues(fresh);
        setLog({ text: `Loaded ${keys.length} epic(s), ${total} tickets · ${new Date().toLocaleTimeString()}.`, error: false });
        if (diff && oldMap) {
          const changes = computeSyncDiff(oldMap, fresh);
          if (changes.length) {
            setSyncDiff(changes);
            if (onSyncEvent) onSyncEvent({ epics: keys, changes });
          } else showToast("Synced — no field changes from Jira");
        } else if (silent) {
          showToast("Synced from Jira (local moves kept)");
        }
        return true;
      } catch (e) {
        setLog({ text: e.message, error: true });
        showToast(e.message, true);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [token, showToast, setLoadedKeys, setEpics, onSyncEvent]
  );

  // On mount the board restores from the persisted snapshot (no network). Only
  // auto-fetch when there's no cached snapshot yet (e.g. first run / migration);
  // otherwise the cache stays the baseline so the next Sync can diff against it.
  // The effect runs exactly once, reading its inputs through refs so the empty
  // dep array is honest (and stays correct even if these ever hydrate async).
  const tokenRef = useRef(token);
  const loadedKeysRef = useRef(loadedKeys);
  const loadEpicsRef = useRef(loadEpics);
  useEffect(() => {
    tokenRef.current = token;
    loadedKeysRef.current = loadedKeys;
    loadEpicsRef.current = loadEpics;
  });

  const didAuto = useRef(false);
  useEffect(() => {
    if (didAuto.current) return;
    didAuto.current = true;
    if (!Object.keys(epicsRef.current).length && tokenRef.current && loadedKeysRef.current.length) {
      loadEpicsRef.current(loadedKeysRef.current, { silent: true });
    }
  }, []);

  const doTest = useCallback(async () => {
    try {
      setConn({ color: "yellow", text: "Testing…" });
      const me = await testConnection(token);
      const name = me.displayName || me.name || "user";
      setConn({ color: "green", text: `Connected as ${name}`, name });
      showToast("Jira connection OK");
    } catch (e) {
      setConn({ color: "red", text: "Connection error" });
      setLog({ text: e.message, error: true });
      showToast(e.message, true);
    }
  }, [token, showToast]);

  const clearToken = useCallback(() => {
    setToken("");
    setConn({ color: "gray", text: "Not connected" });
    showToast("Token cleared");
  }, [setToken, showToast]);

  const sync = useCallback(() => loadEpics(Object.keys(epics), { silent: true, diff: true }), [loadEpics, epics]);

  // Replace the board snapshot from an imported file (no network). Keeps the
  // loaded-keys list in step so a later Sync targets the same epics.
  const importBoard = useCallback((epicsObj) => {
    const obj = epicsObj && typeof epicsObj === "object" ? epicsObj : {};
    setEpics(obj);
    setLoadedKeys(Object.keys(obj));
    const total = countIssues(obj);
    setLog({ text: `Imported ${Object.keys(obj).length} epic(s), ${total} tickets from file.`, error: false });
  }, [setEpics, setLoadedKeys]);

  return { token, setToken, conn, epics, busy, log, doTest, clearToken, loadEpics, sync, syncDiff, clearSyncDiff, importBoard, hasData: Object.keys(epics).length > 0 };
}
