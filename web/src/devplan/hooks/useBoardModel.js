import { useMemo } from "react";
import {
  effSprint, sprintKey, sp, emptyComposition, addToComposition,
  buildSprintStrip, buildSelectedLanes, buildKpis, isHiddenByFilters,
} from "../derive.js";

// Derived view data: filtered issues, capacity load, sprint strip, the selected
// sprint's lanes, and KPIs. Thin useMemo wiring over the pure builders in
// derive.js — see buildSprintStrip / buildSelectedLanes / buildKpis.
export function useBoardModel({ allIssues, filters, overrides, collapsedLanes, sortMode, team, selectedSprint }) {
  // Keys of tickets that actively block another loaded ticket (the "Blockers"
  // facet). Derived from the inward blockedBy links already on each issue.
  const blockerKeys = useMemo(() => {
    const s = new Set();
    allIssues.forEach((i) => (i.blockedBy || []).forEach((b) => { if (!b.done) s.add(b.key); }));
    return s;
  }, [allIssues]);

  const visible = useMemo(() => {
    return allIssues.filter((iss) => {
      if (filters.epic !== "all" && iss._epic !== filters.epic) return false;
      if (filters.system !== "all" && iss.system !== filters.system) return false;
      if (isHiddenByFilters(iss, filters.show, blockerKeys)) return false;
      if (filters.q && !`${iss.key} ${iss.summary}`.toLowerCase().includes(filters.q.toLowerCase())) return false;
      return true;
    });
  }, [allIssues, filters, blockerKeys]);

  // capacity load = all non-dropped issues' SP by effective placement, per system
  const load = useMemo(() => {
    const map = {};
    allIssues.forEach((iss) => {
      if (iss.statusCls === "dropped") return;
      const k = sprintKey(effSprint(iss, overrides));
      (map[k] ||= {})[iss.system] = (map[k][iss.system] || 0) + sp(iss);
    });
    return map;
  }, [allIssues, overrides]);

  // SP by status per sprint — the work-composition breakdown, scoped to the
  // active epic filter (dropped excluded inside addToComposition).
  const compBySprint = useMemo(() => {
    const scope = filters.epic === "all" ? allIssues : allIssues.filter((i) => i._epic === filters.epic);
    const map = {};
    scope.forEach((iss) => {
      const k = sprintKey(effSprint(iss, overrides));
      addToComposition((map[k] ||= emptyComposition()), iss);
    });
    return map;
  }, [allIssues, overrides, filters.epic]);

  const sprints = useMemo(
    () => buildSprintStrip(allIssues, overrides, load, compBySprint),
    [allIssues, overrides, load, compBySprint]
  );

  const selectedKey = useMemo(() => {
    if (selectedSprint && sprints.some((s) => s.key === selectedSprint)) return selectedSprint;
    if (!sprints.length) return null;
    return sprints.reduce((best, s) => (s.total > (best?.total ?? -1) ? s : best), null)?.key || sprints[0].key;
  }, [selectedSprint, sprints]);

  const selected = useMemo(() => {
    const col = sprints.find((s) => s.key === selectedKey);
    if (!col) return null;
    return { ...col, lanes: buildSelectedLanes(col, visible, overrides, load, collapsedLanes, sortMode, team) };
  }, [sprints, selectedKey, visible, overrides, load, collapsedLanes, sortMode, team]);

  const kpis = useMemo(() => buildKpis(allIssues, filters.epic), [allIssues, filters.epic]);

  return { visible, sprints, selectedKey, selected, kpis };
}
