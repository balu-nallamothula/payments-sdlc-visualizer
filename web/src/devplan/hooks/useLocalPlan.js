import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage.js";
import { KEYS, SYSTEM_BY_NAME } from "../config.js";
import { isMoved, sprintKey, sprintShort } from "../derive.js";

// Local (browser-only) re-planning + view state: sprint overrides, lane collapse,
// selected sprint, and card sort. Never writes to Jira.
export function useLocalPlan(allIssues, systemsPresent, showToast) {
  const [overrides, setOverrides] = useLocalStorage(KEYS.overrides, {});
  const [collapsedLanes, setCollapsedLanes] = useLocalStorage(KEYS.collapsed, []);
  const [selectedSprint, setSelectedSprint] = useLocalStorage(KEYS.selectedSprint, null);
  const [sortMode, setSortMode] = useLocalStorage(KEYS.sortMode, "status-done");

  const applyMove = useCallback((key, targetSprint) => {
    const iss = allIssues.find((i) => i.key === key);
    if (!iss) return;
    if (targetSprint === sprintKey(iss.baseSprint)) return; // dropped on its own sprint → no-op
    setOverrides((prev) => ({ ...prev, [key]: { sprint: targetSprint } }));
    showToast(`${key} → ${sprintShort(targetSprint === "backlog" ? null : Number(targetSprint))} (local only)`);
  }, [allIssues, setOverrides, showToast]);

  const undoOne = useCallback((key) => setOverrides((prev) => { const n = { ...prev }; delete n[key]; return n; }), [setOverrides]);
  const undoAll = useCallback(() => { setOverrides({}); showToast("Local changes undone"); }, [setOverrides, showToast]);
  const replaceOverrides = useCallback((obj) => setOverrides(obj && typeof obj === "object" ? obj : {}), [setOverrides]);

  const dirtyCount = useMemo(() => allIssues.filter((i) => isMoved(i, overrides)).length, [allIssues, overrides]);
  const localChanges = useMemo(() => {
    return allIssues.filter((i) => isMoved(i, overrides)).map((i) => {
      const ovSprint = overrides[i.key].sprint;
      return {
        key: i.key, title: i.title, system: i.system,
        color: SYSTEM_BY_NAME[i.system]?.color,
        from: sprintShort(i.baseSprint), to: sprintShort(ovSprint === "backlog" ? null : Number(ovSprint)),
      };
    });
  }, [allIssues, overrides]);

  const toggleLane = useCallback((name) => setCollapsedLanes((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name])), [setCollapsedLanes]);
  const toggleAllLanes = useCallback(() => {
    setCollapsedLanes((p) => (systemsPresent.length && systemsPresent.every((s) => p.includes(s)) ? [] : [...systemsPresent]));
  }, [systemsPresent, setCollapsedLanes]);
  const lanesAllCollapsed = systemsPresent.length > 0 && systemsPresent.every((s) => collapsedLanes.includes(s));

  return {
    overrides, applyMove, undoOne, undoAll, replaceOverrides, dirtyCount, localChanges,
    collapsedLanes, toggleLane, toggleAllLanes, lanesAllCollapsed,
    selectedSprint, setSelectedSprint, sortMode, setSortMode,
  };
}
