import { useCallback, useEffect } from "react";
import { useLocalStorage } from "./useLocalStorage.js";
import { KEYS, SPRINT_DATES, SPRINT_END } from "../config.js";
import { sprintLabel, emptyComposition, composeByStatus } from "../derive.js";

// Frozen final composition of finished sprints. Once a sprint closes, Jira rolls
// its unfinished tickets into the next sprint — so the board can no longer show
// what the closed sprint looked like at its end. We snapshot each finished
// sprint the first time we observe it closed and never overwrite it, preserving
// the count / SP / % that ended in each status.

// Which numbered sprints are finished. Prefer the authoritative Jira sprint
// state (CLOSED with no open membership); fall back to the configured end date
// when older cached data carries no state.
function finishedSprintNums(issues) {
  const states = new Map(); // number -> Set(states)
  const nums = new Set();
  issues.forEach((i) =>
    (i.sprints || []).forEach((s) => {
      if (!Number.isFinite(s.number)) return;
      nums.add(s.number);
      if (!states.has(s.number)) states.set(s.number, new Set());
      if (s.state) states.get(s.number).add(s.state);
    })
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out = [];
  nums.forEach((n) => {
    const st = states.get(n);
    if (st && st.size) {
      const closed = st.has("CLOSED") && !st.has("ACTIVE") && !st.has("FUTURE");
      if (closed) out.push(n);
      return; // has state info: trust it, don't second-guess with dates
    }
    const end = SPRINT_END[n];
    if (end && new Date(`${end}T23:59:59`) < today) out.push(n);
  });
  return out;
}

// Composition of a sprint by membership history: every non-dropped ticket that
// ever belonged to sprint `num`, counted by its status. Rolled-over tickets stay
// counted in the sprint they came from (with their status at snapshot time).
function snapshotFor(num, issues) {
  const members = issues.filter(
    (iss) => iss.statusCls !== "dropped" && (iss.sprintTrail || []).includes(num)
  );
  const comp = composeByStatus(members); // SP by status class
  const tickets = emptyComposition(); // ticket counts by status class
  members.forEach((iss) => {
    if (tickets[iss.statusCls] === undefined) return;
    tickets[iss.statusCls] += 1;
    tickets.total += 1;
  });
  return { comp, tickets };
}

function build(num, issues) {
  return {
    number: num,
    label: sprintLabel(num),
    dates: SPRINT_DATES[num] || "",
    ...snapshotFor(num, issues),
    capturedAt: Date.now(),
  };
}

export function useSprintSnapshots(allIssues) {
  const [snapshots, setSnapshots] = useLocalStorage(KEYS.snapshots, {});

  useEffect(() => {
    if (!allIssues.length) return;
    const finished = finishedSprintNums(allIssues);
    if (!finished.length) return;
    setSnapshots((prev) => {
      let changed = false;
      const next = { ...prev };
      finished.forEach((num) => {
        if (next[String(num)]) return; // freeze once — never overwrite automatically
        const snap = build(num, allIssues);
        if (!snap.tickets.total) return; // nothing observed for this sprint
        next[String(num)] = snap;
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [allIssues, setSnapshots]);

  // Manual re-freeze with the current board state (useful on first run, when a
  // sprint had already rolled over before this feature existed).
  const recapture = useCallback(
    (num) => setSnapshots((prev) => ({ ...prev, [String(num)]: build(num, allIssues) })),
    [allIssues, setSnapshots]
  );
  const removeSnapshot = useCallback(
    (num) =>
      setSnapshots((prev) => {
        const next = { ...prev };
        delete next[String(num)];
        return next;
      }),
    [setSnapshots]
  );
  const clearSnapshots = useCallback(() => setSnapshots({}), [setSnapshots]);

  // Replace all snapshots from an imported list. Exports carry snapshots as an
  // array; internally we key them by String(number), so convert back.
  const replaceSnapshots = useCallback((listOrObj) => {
    if (Array.isArray(listOrObj)) {
      const obj = {};
      listOrObj.forEach((s) => { if (Number.isFinite(s?.number)) obj[String(s.number)] = s; });
      setSnapshots(obj);
    } else {
      setSnapshots(listOrObj && typeof listOrObj === "object" ? listOrObj : {});
    }
  }, [setSnapshots]);

  const list = Object.values(snapshots).sort((a, b) => b.number - a.number);
  return { snapshots: list, recapture, removeSnapshot, clearSnapshots, replaceSnapshots };
}
