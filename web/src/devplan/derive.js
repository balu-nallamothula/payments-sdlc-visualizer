// Pure derivation helpers — no React, no state. All take plain data.

import { SYSTEMS, MAIN_SYSTEMS, SYSTEM_BY_NAME, SPRINT_END, SPRINT_BY_NUM, DEFAULT_SPRINT_YEAR, DEFAULT_SPRINTS, SPRINT_DATES } from "./config.js";

// Match priority for systemOf: platform tags win over service tags when a ticket
// carries more than one (e.g. a mobile cart ticket tagged [iOS][CNC] → iOS).
// This is independent of SYSTEMS' array order, which drives lane *display*.
const TAG_ORDER = ["iOS", "Android", "UFE", "CNC", "Payment Service", "OMS", "C3"];
const COMP_ORDER = [...TAG_ORDER, "Email", "Data Platform"];

export function tagsOf(summary) {
  const out = [];
  const re = /\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(summary))) out.push(m[1].trim());
  return out;
}

// System swimlane: prefer the [system] tag in the summary (matches the plan),
// fall back to Jira components. Rules live on the SYSTEMS config; priority is
// TAG_ORDER / COMP_ORDER above.
export function systemOf(issue) {
  const tags = tagsOf(issue.summary).map((t) => t.toLowerCase());
  for (const name of TAG_ORDER) {
    if ((SYSTEM_BY_NAME[name].tags || []).some((t) => tags.includes(t))) return name;
  }
  const comps = (issue.components || []).map((c) => c.toLowerCase());
  for (const name of COMP_ORDER) {
    if ((SYSTEM_BY_NAME[name].comps || []).some((frag) => comps.some((c) => c.includes(frag)))) return name;
  }
  return "Other";
}

// Latest numbered PAY sprint on the ticket; null = backlog / unscheduled.
export function jiraSprintNumber(issue) {
  const nums = (issue.sprints || []).map((s) => s.number).filter((n) => Number.isFinite(n));
  return nums.length ? Math.max(...nums) : null;
}

// Every numbered PAY sprint the ticket has belonged to, ascending & de-duped.
// Jira keeps the full sprint membership on the field, so a ticket carried over
// from .15 into .16 lists both — that's how we know it's a rollover.
export function sprintTrail(issue) {
  const nums = (issue.sprints || []).map((s) => s.number).filter((n) => Number.isFinite(n));
  return [...new Set(nums)].sort((a, b) => a - b);
}

// Map a raw Jira status *name* to the board's coarse status class. Used both by
// statusClass (full issue) and directly by the history/diff, which only has the
// status name text and needs the same colors as the board.
export function statusClassFromName(name) {
  const s = (name || "").toLowerCase();
  if (s.includes("won't") || s.includes("wont")) return "dropped";
  if (s === "in qa" || s === "qa") return "inqa";
  if (s === "code review" || s === "in review") return "review";
  if (s === "in progress") return "progress";
  if (s === "blocked") return "blocked";
  if (s === "done" || s === "resolved" || s === "closed") return "done";
  return "todo";
}

export function statusClass(issue) {
  const res = (issue.resolution || "").toLowerCase();
  if (res.includes("won't") || res.includes("wont") || res.includes("cannot") || res === "duplicate") return "dropped";
  const cls = statusClassFromName(issue.status);
  if (cls === "todo" && issue.statusCategory === "done") return "done";
  return cls;
}

// When the ticket's current sprint began — prefer Jira's own startDate on the
// matching sprint object, fall back to the previous sprint's end date from the
// config map (sprint N starts when N-1 ends). null = unknown.
export function currentSprintStart(issue, baseSprint) {
  if (baseSprint == null) return null;
  const s = (issue.sprints || []).find((sp) => sp.number === baseSprint);
  if (s && s.startDate) return s.startDate;
  return SPRINT_END[baseSprint - 1] || null;
}

// A done ticket is a "real" rollover only if it was resolved DURING the current
// sprint (dragged in pending, then finished). If it was already resolved before
// the sprint started, it wasn't worked on here — just carries its membership.
function isRollover(issue, trail, statusCls, baseSprint) {
  if (trail.length <= 1) return false;
  if (statusCls !== "done") return true;
  const start = currentSprintStart(issue, baseSprint);
  if (!start || !issue.resolutionDate) return true; // can't tell → keep the flag
  return new Date(issue.resolutionDate) >= new Date(start);
}

// Effective placement (a local override wins over Jira truth).
// "backlog" | "<n>" — canonical bucket key for a sprint number (null = backlog).
export function sprintKey(n) {
  return n == null ? "backlog" : String(n);
}

// Full sprint label for columns / snapshots ("Sprint 2026.15"). null = Backlog.
export function sprintLabel(n) {
  if (n == null) return "Backlog";
  const year = SPRINT_BY_NUM[n]?.year ?? DEFAULT_SPRINT_YEAR;
  return `Sprint ${year}.${n}`;
}

// Compact sprint label for chips / diffs ("Sprint .15"). null = Backlog.
export function sprintShort(n) {
  return n == null ? "Backlog" : `Sprint .${n}`;
}

// Precompute the fields the UI reads everywhere, once per issue. `statusCls` is
// the coarse status class, kept separate from the raw Jira `status` name.
export function enrichIssue(issue) {
  const trail = sprintTrail(issue);
  const statusCls = statusClass(issue);
  const baseSprint = jiraSprintNumber(issue);
  return {
    ...issue,
    system: systemOf(issue),
    statusCls,
    baseSprint,
    sprintTrail: trail,
    rollover: isRollover(issue, trail, statusCls, baseSprint),
    title: cleanTitle(issue.summary),
    isBug: /bug/i.test(issue.issueType || ""),
  };
}

function baseSprintOf(issue) {
  return issue.baseSprint !== undefined ? issue.baseSprint : jiraSprintNumber(issue);
}

// Effective sprint (a local override wins over Jira). null = backlog.
export function effSprint(issue, overrides) {
  const ov = overrides[issue.key];
  if (ov && ov.sprint != null) return ov.sprint === "backlog" ? null : Number(ov.sprint);
  return baseSprintOf(issue);
}

// A ticket is "moved" only when its sprint override differs from Jira.
export function isMoved(issue, overrides) {
  const ov = overrides[issue.key];
  if (!ov || ov.sprint == null) return false;
  return ov.sprint !== sprintKey(baseSprintOf(issue));
}

export function presentSystems(issues) {
  const set = new Set(MAIN_SYSTEMS);
  issues.forEach((i) => set.add(i.system || systemOf(i)));
  return SYSTEMS.map((s) => s.name).filter((n) => set.has(n));
}

// Group a status class into a coarse bucket used for ordering.
function bucket(cls) {
  if (cls === "done") return "done";
  if (cls === "dropped") return "dropped";
  if (cls === "blocked") return "blocked";
  if (cls === "todo") return "todo";
  return "inflight"; // inqa, review, progress
}
const BUCKET_ORDERS = {
  "status-done": ["done", "inflight", "todo", "blocked", "dropped"],
  "status-todo": ["todo", "inflight", "blocked", "done", "dropped"],
  "status-active": ["inflight", "todo", "blocked", "done", "dropped"],
  "status-blocked": ["blocked", "inflight", "todo", "done", "dropped"],
};

const isBug = (iss) => (iss.isBug !== undefined ? !!iss.isBug : /bug/i.test(iss.issueType || ""));

// Blocked tiers for the "Blocked first" mode:
// 0 = currently blocked (blocked status, or at least one unresolved blocker),
// 1 = previously blocked (has blockers, all of them resolved), 2 = never blocked.
function blockedTier(iss) {
  const links = iss.blockedBy || [];
  if (bucket(iss.statusCls || statusClass(iss)) === "blocked") return 0;
  if (links.some((b) => !b.done)) return 0;
  return links.length > 0 ? 1 : 2;
}

// Returns a comparator for cards within a lane. Secondary sort: SP descending.
export function makeCardSort(mode) {
  if (mode === "sp-desc") return (a, b) => (b.storyPoints || 0) - (a.storyPoints || 0);
  if (mode === "sp-asc") return (a, b) => (a.storyPoints || 0) - (b.storyPoints || 0);
  const order = BUCKET_ORDERS[mode] || BUCKET_ORDERS["status-done"];
  const rank = Object.fromEntries(order.map((k, i) => [k, i]));
  return (a, b) => {
    if (mode === "bugs") {
      const ba = isBug(a) ? 0 : 1;
      const bb = isBug(b) ? 0 : 1;
      if (ba !== bb) return ba - bb;
    }
    if (mode === "status-blocked") {
      const ta = blockedTier(a);
      const tb = blockedTier(b);
      if (ta !== tb) return ta - tb;
    }
    const ra = rank[bucket(a.statusCls || statusClass(a))] ?? 99;
    const rb = rank[bucket(b.statusCls || statusClass(b))] ?? 99;
    if (ra !== rb) return ra - rb;
    return (b.storyPoints || 0) - (a.storyPoints || 0);
  };
}

export function cleanTitle(summary) {
  let t = summary;
  let prev;
  do {
    prev = t;
    t = t.replace(/^\s*\[[^\]]*\]\s*/, "");
  } while (t !== prev);
  return t || summary;
}

export function shortAssignee(name) {
  if (!name) return "";
  const clean = name.replace(/\s*-\s*Consultant$/i, "");
  const parts = clean.split(",");
  if (parts.length === 2) return `${parts[1].trim().split(" ")[0]} ${parts[0].trim()}`;
  return clean;
}

export function shortName(ep) {
  let n = ep.name.replace(/^\[[^\]]*\]\s*/, "");
  if (n.length > 34) n = n.slice(0, 32) + "…";
  return `${ep.key} · ${n}`;
}

export function sp(issue) {
  return Number.isFinite(issue.storyPoints) ? issue.storyPoints : 0;
}

// Round v as a percentage of total (0 when total is falsy — avoids /0).
export function pct(v, total) {
  return total ? Math.round((v / total) * 100) : 0;
}

// Client-unique id for locally-created records (team devs, history entries).
// Not cryptographic — just needs to be unique within one browser session.
export function uid(i = 0) {
  return `${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 7)}`;
}

// Up-to-two uppercase initials from a display name ("Jane Doe" -> "JD"). "" when
// there's no usable name.
export function initialsFrom(name) {
  const parts = (name || "").trim().split(/[\s,]+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

// ---- Work composition (SP by status class) ----------------------------------
// The status classes that make up the work-composition bar / KPIs / snapshots,
// in display order. `statusClass` can also return "dropped", which every
// composition excludes (dropped work doesn't count toward progress/capacity).
export const STATUS_CLASSES = ["done", "inqa", "review", "progress", "todo", "blocked"];

// A zeroed composition accumulator: { done, inqa, review, progress, todo, blocked, total }.
export function emptyComposition() {
  const c = {};
  for (const k of STATUS_CLASSES) c[k] = 0;
  c.total = 0;
  return c;
}

// Add one issue's story points into a composition accumulator (dropped excluded).
export function addToComposition(acc, iss) {
  if (iss.statusCls === "dropped" || acc[iss.statusCls] === undefined) return acc;
  acc[iss.statusCls] += sp(iss);
  acc.total += sp(iss);
  return acc;
}

// Sum story points by status class over a set of issues (dropped excluded).
export function composeByStatus(issues, acc = emptyComposition()) {
  issues.forEach((iss) => addToComposition(acc, iss));
  return acc;
}

// ---- Epic → issue helpers ---------------------------------------------------
// The loaded board is { [epicKey]: { issues: [...], color, ... } }. Flatten
// every epic's issues into one array, optionally mapping each issue with its
// owning epic (e.g. to tag/enrich it).
export function flattenIssues(epicsObj, mapFn) {
  const out = [];
  for (const ep of Object.values(epicsObj || {})) {
    for (const i of ep.issues || []) out.push(mapFn ? mapFn(i, ep) : i);
  }
  return out;
}

// Total number of issues across all loaded epics.
export function countIssues(epicsObj) {
  return flattenIssues(epicsObj).length;
}

// ---- Board view builders (pure — the useMemo bodies of useBoardModel) --------
const sumLoad = (byLane) => Object.values(byLane || {}).reduce((a, b) => a + b, 0);

// The sprint strip: one column per configured/observed sprint (+ Backlog), each
// with its total SP and status composition. `load`/`compBySprint` are the
// per-sprint aggregations keyed by sprintKey.
export function buildSprintStrip(allIssues, overrides, load, compBySprint) {
  const nums = new Set(DEFAULT_SPRINTS);
  let hasBacklog = false;
  let firstSprint = null; // earliest sprint this board's tickets sit in
  allIssues.forEach((i) => {
    const n = effSprint(i, overrides);
    if (n == null) { hasBacklog = true; return; }
    nums.add(n);
    if (firstSprint == null || n < firstSprint) firstSprint = n;
  });
  // Only show sprints from the project's first active sprint onwards — drop
  // configured sprints that predate any of this board's tickets. If nothing is
  // scheduled yet (all Backlog / no data), keep the full configured range.
  let list = [...nums].sort((a, b) => a - b);
  if (firstSprint != null) list = list.filter((n) => n >= firstSprint);
  const cols = list.map((n) => ({
    key: String(n), num: n, label: sprintLabel(n), dates: SPRINT_DATES[n] || "",
    total: sumLoad(load[String(n)]), comp: compBySprint[String(n)] || null,
  }));
  if (hasBacklog) {
    cols.push({ key: "backlog", num: null, label: "Backlog", dates: "Groomed / unscheduled",
      total: sumLoad(load.backlog), comp: compBySprint.backlog || null });
  }
  return cols;
}

// The swimlanes for the selected sprint column: capacity-carrying systems plus
// any system that has cards here, each with its cap/load/collapse/dev-count and
// sorted, move-flagged cards.
export function buildSelectedLanes(col, visible, overrides, load, collapsedLanes, sortMode, team) {
  const sorter = makeCardSort(sortMode);
  const present = {};
  visible.forEach((iss) => {
    if (sprintKey(effSprint(iss, overrides)) !== col.key) return;
    (present[iss.system] ||= []).push(iss);
  });
  const laneNames = SYSTEMS.map((s) => s.name).filter((n) => MAIN_SYSTEMS.includes(n) || (present[n] && present[n].length));
  return laneNames.map((name) => {
    const sysDef = SYSTEM_BY_NAME[name];
    const spUsed = load[col.key]?.[name] || 0;
    const cap = col.num == null ? null : laneCapacity(team, name, col.num);
    const cards = (present[name] || []).slice().sort(sorter).map((c) => ({ ...c, _moved: isMoved(c, overrides) }));
    return {
      system: name, color: sysDef.color, cap, showCap: cap != null,
      spUsed, over: cap != null && spUsed > cap,
      collapsed: collapsedLanes.includes(name),
      devCount: team.filter((d) => d.lane === name).length,
      cards,
    };
  });
}

// ---- Filter facets (Controls "Filters" popover) -----------------------------
// The single status facet an issue belongs to (mutually exclusive). Dropped is
// resolution-driven (reuse statusCls); the rest match the raw Jira status name so
// Done / QE Verified / Resolved split apart without touching statusClass(). Any
// unknown status falls to "todo" so it stays filterable rather than orphaned.
export function statusFacet(iss) {
  if (iss.statusCls === "dropped") return "dropped";
  const s = (iss.status || "").toLowerCase();
  if (s === "qe verified") return "qeverified";
  if (s === "resolved") return "resolved";
  if (s === "done" || s === "closed") return "done";
  if (s === "blocked") return "blocked";
  if (s === "in qa" || s === "qa") return "inqa";
  if (s === "code review" || s === "in review") return "review";
  if (s === "in progress") return "inprogress";
  return "todo";
}

// A card is hidden when it matches any turned-off facet. `show` is filters.show
// ({ facetId: boolean }); `blockerKeys` is the set of tickets that block another
// loaded ticket (a card "is a blocker" — distinct from the Blocked status).
export function isHiddenByFilters(iss, show, blockerKeys) {
  if (!show) return false;
  if (iss.isBug ? !show.bug : !show.story) return true;
  if (!show[statusFacet(iss)]) return true;
  if (iss.rollover && !show.rollover) return true;
  if (blockerKeys && blockerKeys.has(iss.key) && !show.blockers) return true;
  return false;
}

// Top-line KPIs (ticket/SP totals + status composition) over the epic-filtered scope.
export function buildKpis(allIssues, epicFilter) {
  const scope = allIssues.filter((i) => epicFilter === "all" || i._epic === epicFilter);
  const comp = composeByStatus(scope); // dropped excluded inside
  const liveCount = scope.filter((i) => i.statusCls !== "dropped").length;
  return {
    tickets: liveCount, dropped: scope.length - liveCount, totalSP: comp.total,
    doneSP: comp.done, inqaSP: comp.inqa, reviewSP: comp.review,
    progressSP: comp.progress, todoSP: comp.todo, blockedSP: comp.blocked,
    pct: pct(comp.done, comp.total),
  };
}

// ---- Team capacity ----
// A dev's effective SP for a given sprint: per-sprint override if set, else base.
export function devCapForSprint(dev, sprintNum) {
  const v = dev.perSprint ? dev.perSprint[sprintNum] : undefined;
  if (v === "" || v == null) return Number(dev.base) || 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Lane capacity for a sprint: sum of that lane's devs if any are defined,
// otherwise the static default cap from config (null = no capacity bar).
export function laneCapacity(team, system, sprintNum) {
  const devs = team.filter((d) => d.lane === system);
  if (devs.length) return devs.reduce((s, d) => s + devCapForSprint(d, sprintNum), 0);
  const def = SYSTEM_BY_NAME[system];
  return def && def.cap != null ? def.cap : null;
}

