// Standalone writers for the Dev Plan board's persisted state. Settings loads /
// imports the board from outside the board's React tree, so it can't reach
// useJira's state — instead it writes the same localStorage keys useJira reads on
// mount (KEYS.epicsCache + KEYS.loaded, plus KEYS.overrides for an import). The
// board picks them up the next time it mounts.
//
// Import ONLY config.js and jira.js here — never derive.js / DevPlanApp.jsx — so a
// top-level Settings import doesn't pull the board's modules in before config is
// hydrated (see DevPlan.jsx for why that ordering matters).
import { KEYS, EPIC_COLORS } from "./config.js";
import { fetchEpic } from "./jira.js";

const countIssues = (epics) =>
  Object.values(epics).reduce((n, e) => n + (e.issues?.length || 0), 0);

function writeBoard(epics, keys) {
  try {
    localStorage.setItem(KEYS.epicsCache, JSON.stringify(epics));
    localStorage.setItem(KEYS.loaded, JSON.stringify(keys));
  } catch {
    /* ignore quota errors */
  }
}

// Fetch the given epics from Jira and persist them as the board snapshot, in the
// exact shape useJira restores on mount. Returns { epics, count }.
export async function loadEpicsToBoard(token, keys) {
  if (!token || !token.trim()) throw new Error("Connect your Jira token first.");
  const fresh = {};
  let idx = 0;
  for (const key of keys) {
    const ep = await fetchEpic(token, key);
    fresh[key] = { ...ep, color: EPIC_COLORS[idx % EPIC_COLORS.length] };
    idx++;
  }
  writeBoard(fresh, keys);
  return { epics: fresh, count: countIssues(fresh) };
}

// Replace the board snapshot from a parsed board-export file (no network), keeping
// parity with the board's own import: snapshot + loaded keys + local overrides.
export function importBoardToStore(data) {
  if (data?.kind !== "dev-plan-board" || !data.state?.epics) {
    throw new Error("That isn't a Dev Plan board export.");
  }
  const epics = data.state.epics;
  writeBoard(epics, Object.keys(epics));
  try {
    localStorage.setItem(KEYS.overrides, JSON.stringify(data.state.overrides || {}));
  } catch {
    /* ignore */
  }
  return { epics, count: countIssues(epics) };
}
