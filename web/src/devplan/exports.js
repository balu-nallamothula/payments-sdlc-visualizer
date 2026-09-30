// Builders for the JSON export payloads (pure — no React, no DOM). App wires
// these to downloadJson() from download.js.

import { effSprint, isMoved } from "./derive.js";

// A portable snapshot of the current board. Two parts:
//   - a human-readable report (epics summary, filters, KPIs, sprint strip, the
//     flattened enriched issues);
//   - `state`: the raw data needed to re-import and rebuild the board exactly
//     (epicsCache as-is from Jira + local sprint overrides), so a board can be
//     opened on another machine without a Jira token.
export function buildBoardExport({ epics, allIssues, overrides, filters, board, exportedAt }) {
  return {
    kind: "dev-plan-board",
    exportedAt,
    epics: Object.values(epics).map((e) => ({ key: e.key, name: e.name })),
    filters,
    kpis: board.kpis,
    sprints: board.sprints.map((s) => ({ key: s.key, label: s.label, dates: s.dates, totalSP: s.total })),
    state: { epics, overrides },
    issues: allIssues.map((i) => ({
      key: i.key,
      title: i.title,
      epic: i._epic,
      system: i.system,
      status: i.status,
      statusClass: i.statusCls,
      storyPoints: i.storyPoints ?? null,
      assignee: (i.assignee && i.assignee.displayName) || null,
      isBug: i.isBug,
      baseSprint: i.baseSprint,
      effectiveSprint: effSprint(i, overrides),
      moved: isMoved(i, overrides),
      sprintTrail: i.sprintTrail,
      blockedBy: (i.blockedBy || []).map((b) => b.key),
    })),
  };
}

// One sync-history record: the changes plus their counts bucketed by kind. `id`
// and `ts` are passed in to keep this pure (see buildBoardExport).
export function buildSyncRecord({ keys, changes, id, ts }) {
  return {
    id,
    ts,
    epics: keys,
    epicLabel: keys.join(" + "),
    counts: {
      changed: changes.filter((c) => c.kind === "changed").length,
      added: changes.filter((c) => c.kind === "new").length,
      removed: changes.filter((c) => c.kind === "removed").length,
    },
    changes,
  };
}

// The full sync history + frozen closed-sprint snapshots.
export function buildHistoryExport({ history, snapshots, exportedAt }) {
  return {
    kind: "dev-plan-history",
    exportedAt,
    syncEvents: history,
    closedSprintSnapshots: snapshots,
  };
}
