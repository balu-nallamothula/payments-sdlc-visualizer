import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage.js";
import { KEYS, DEFAULT_DEV_BASE } from "../config.js";
import { shortAssignee, sp, uid } from "../derive.js";

// Team roster + per-sprint capacity. Feeds the lane capacity bars.
export function useTeam(allIssues, showToast) {
  const [team, setTeam] = useLocalStorage(KEYS.team, []);

  const addDev = useCallback((dev) => {
    setTeam((t) => [...t, { id: uid(), name: dev.name || "New dev", lane: dev.lane || "UFE", base: dev.base ?? DEFAULT_DEV_BASE, perSprint: {} }]);
  }, [setTeam]);
  const updateDev = useCallback((id, patch) => setTeam((t) => t.map((d) => (d.id === id ? { ...d, ...patch } : d))), [setTeam]);
  const updateCell = useCallback((id, sprintNum, value) => setTeam((t) => t.map((d) => (d.id === id ? { ...d, perSprint: { ...d.perSprint, [sprintNum]: value } } : d))), [setTeam]);
  const removeDev = useCallback((id) => setTeam((t) => t.filter((d) => d.id !== id)), [setTeam]);

  // Build the roster from the assignees of the loaded tickets. Each dev's lane =
  // the system where they hold the most story points. Skips dropped + unassigned,
  // and devs already in the team (matched by name).
  const loadFromAssignees = useCallback(() => {
    const byPerson = new Map();
    allIssues.forEach((iss) => {
      if (iss.statusCls === "dropped") return;
      const dn = iss.assignee && iss.assignee.displayName;
      if (!dn) return;
      const name = shortAssignee(dn);
      const key = name.toLowerCase();
      const weight = (sp(iss) || 0) + 0.001; // count 0-SP (QA) tickets too
      const rec = byPerson.get(key) || { name, sysSP: {} };
      rec.sysSP[iss.system] = (rec.sysSP[iss.system] || 0) + weight;
      byPerson.set(key, rec);
    });
    const existing = new Set(team.map((d) => d.name.toLowerCase()));
    const toAdd = [];
    let i = 0;
    byPerson.forEach((rec, key) => {
      if (existing.has(key)) return;
      const lane = Object.entries(rec.sysSP).sort((a, b) => b[1] - a[1])[0]?.[0] || "Other";
      toAdd.push({ id: uid(i++), name: rec.name, lane, base: DEFAULT_DEV_BASE, perSprint: {} });
    });
    if (!toAdd.length) { showToast("No new assignees to add", false); return; }
    setTeam((t) => [...t, ...toAdd]);
    showToast(`Added ${toAdd.length} dev${toAdd.length > 1 ? "s" : ""} from assignees`);
  }, [allIssues, team, setTeam, showToast]);

  return { team, addDev, updateDev, updateCell, removeDev, loadFromAssignees };
}
