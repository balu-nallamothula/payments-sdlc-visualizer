// Runtime config store. Bundled DEFAULTS below mirror config.json at the repo
// root, which is the source of truth: server.js reads it at startup and serves
// it at /api/config, and the client hydrates from it at boot (see main.jsx).
// The DEFAULTS are the fallback used when that fetch fails (e.g. dev with no
// server running). Editable, exported values are live bindings — hydrateConfig()
// reassigns them, so hydrate BEFORE the app's modules read them (main.jsx does).

// ---- Board filter facets (Controls "Filters" popover) ----------------------
// Grouped toggle facets. ids must match statusFacet()/flag ids in derive.js.
// Type = bug/story (partition), Status = one facet per raw status (partition),
// Flags = overlays (rollover, blockers).
export const FILTER_GROUPS = [
  { key: "type", label: "Type", facets: [
    { id: "bug", label: "Bugs" },
    { id: "story", label: "Stories" },
  ] },
  { key: "status", label: "Status", facets: [
    { id: "todo", label: "To do" },
    { id: "inprogress", label: "In Progress" },
    { id: "review", label: "Code Review" },
    { id: "inqa", label: "In QA" },
    { id: "qeverified", label: "QE Verified" },
    { id: "resolved", label: "Resolved" },
    { id: "done", label: "Done" },
    { id: "dropped", label: "Dropped" },
    { id: "blocked", label: "Blocked" },
  ] },
  { key: "flags", label: "Flags", facets: [
    { id: "rollover", label: "Rolled over" },
    { id: "blockers", label: "Blockers" },
  ] },
];

// Every facet id, in display order.
export const FILTER_FACET_IDS = FILTER_GROUPS.flatMap((g) => g.facets.map((f) => f.id));

// A fresh show-map: every facet shown, except Dropped (hidden by default,
// preserving the old hideDropped:true behaviour).
export function defaultShow() {
  return Object.fromEntries(FILTER_FACET_IDS.map((id) => [id, id !== "dropped"]));
}

const DEFAULTS = {
  jira: {
    base: "https://jira.sephora.com",
    browseBase: "https://jira.sephora.com/browse",
    storyPointsField: "customfield_10173",
    sprintField: "customfield_10510",
    epicLinkJql: '"Epic Link"',
    sprintNumberPattern: "\\b20\\d\\d\\.(\\d+)",
  },
  sprints: [
    { number: 14, year: 2026, start: "2026-06-24", end: "2026-07-07" },
    { number: 15, year: 2026, start: "2026-07-08", end: "2026-07-21" },
    { number: 16, year: 2026, start: "2026-07-22", end: "2026-08-04" },
    { number: 17, year: 2026, start: "2026-08-05", end: "2026-08-18" },
    { number: 18, year: 2026, start: "2026-08-19", end: "2026-09-01" },
  ],
  // System swimlanes. Array order = lane display order.
  //   cap   = per-sprint SP capacity (null = no capacity bar).
  //   tags  = [system] summary tags that map here (exact, case-insensitive match).
  //   comps = Jira component name fragments that map here (substring match).
  // systemOf() in derive.js reads these to classify a ticket; the match *priority*
  // (platforms before services) lives there in TAG_ORDER / COMP_ORDER.
  systems: [
    { name: "CNC", color: "#5b2b90", cap: 80, tags: ["cnc", "cart service", "cartservice", "cart & checkout"], comps: ["cartservice", "checkout"] },
    { name: "Payment Service", color: "#1c7fc0", cap: 21, tags: ["payment service"], comps: ["payment service", "venmo"] },
    { name: "UFE", color: "#0f9a9a", cap: 21, tags: ["ufe"], comps: ["ufe"] },
    { name: "iOS", color: "#7a3fb0", cap: 20, tags: ["ios"], comps: ["ios"] },
    { name: "Android", color: "#4a9e2f", cap: 20, tags: ["android"], comps: ["android"] },
    { name: "OMS", color: "#c98a00", cap: null, tags: ["oms"], comps: ["oms"] },
    { name: "C3", color: "#98a2b3", cap: null, tags: ["c3"], comps: ["c3"] },
    { name: "Email", color: "#d24d8c", cap: null, tags: [], comps: ["email"] },
    { name: "Data Platform", color: "#546074", cap: null, tags: [], comps: ["data"] },
    { name: "Other", color: "#98a2b3", cap: null, tags: [], comps: [] },
  ],
  epicColors: ["#5b2b90", "#1c7fc0", "#4a9e2f", "#d24d8c", "#c98a00"],
  defaultDevBase: 40,
  historyCap: 100,
  defaultFilters: { epic: "all", system: "all", q: "", show: defaultShow() },
};

// ---- Editable, hydratable values (live bindings) ---------------------------
export let SPRINTS = DEFAULTS.sprints;
export let SYSTEMS = DEFAULTS.systems;
export let EPIC_COLORS = DEFAULTS.epicColors;
export let JIRA_BROWSE = DEFAULTS.jira.browseBase;
// Full Jira block (base + custom fields + patterns). The board only needs
// browseBase; the Settings editor / export need the rest, including server-side
// fields, so we keep the whole object here.
let _jira = { ...DEFAULTS.jira };
export let DEFAULT_DEV_BASE = DEFAULTS.defaultDevBase; // full-sprint SP for one dev (≈ 40)
export let HISTORY_CAP = DEFAULTS.historyCap; // max sync events kept per browser
export let DEFAULT_FILTERS = DEFAULTS.defaultFilters;

// ---- Derived (recomputed whenever the above change) ------------------------
export let DEFAULT_SPRINTS;
export let SPRINT_BY_NUM;
export let DEFAULT_SPRINT_YEAR;
export let SPRINT_DATES; // number -> "Jun 24 – Jul 7"
export let SPRINT_END; //   number -> ISO end date (fallback for "finished" sprint)
export let SYSTEM_BY_NAME;
export let MAIN_SYSTEMS; // systems that carry a capacity bar

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDay = (iso) => { const [, m, d] = iso.split("-").map(Number); return `${MONTHS[m - 1]} ${d}`; };

// Human date range for a sprint ("Jun 24 – Jul 7"), derived from start/end.
export const sprintDateRange = (s) => (s && s.start && s.end ? `${fmtDay(s.start)} – ${fmtDay(s.end)}` : "");

function recompute() {
  DEFAULT_SPRINTS = SPRINTS.map((s) => s.number);
  SPRINT_BY_NUM = Object.fromEntries(SPRINTS.map((s) => [s.number, s]));
  DEFAULT_SPRINT_YEAR = SPRINTS[0]?.year ?? new Date().getFullYear();
  SPRINT_DATES = Object.fromEntries(SPRINTS.map((s) => [s.number, sprintDateRange(s)]));
  SPRINT_END = Object.fromEntries(SPRINTS.map((s) => [s.number, s.end]));
  SYSTEM_BY_NAME = Object.fromEntries(SYSTEMS.map((s) => [s.name, s]));
  MAIN_SYSTEMS = SYSTEMS.filter((s) => s.cap != null).map((s) => s.name);
}
recompute();

// Overlay a raw config object (from config.json / an imported file) onto the
// live bindings. Only known keys are applied; anything missing keeps its default.
export function hydrateConfig(raw) {
  if (!raw || typeof raw !== "object") return;
  if (Array.isArray(raw.sprints) && raw.sprints.length) SPRINTS = raw.sprints;
  if (Array.isArray(raw.systems) && raw.systems.length) SYSTEMS = raw.systems;
  if (Array.isArray(raw.epicColors) && raw.epicColors.length) EPIC_COLORS = raw.epicColors;
  if (raw.jira && typeof raw.jira === "object") {
    _jira = { ...DEFAULTS.jira, ...raw.jira };
    JIRA_BROWSE = _jira.browseBase;
  }
  if (Number.isFinite(raw.defaultDevBase)) DEFAULT_DEV_BASE = raw.defaultDevBase;
  if (Number.isFinite(raw.historyCap)) HISTORY_CAP = raw.historyCap;
  if (raw.defaultFilters && typeof raw.defaultFilters === "object") {
    DEFAULT_FILTERS = {
      ...DEFAULTS.defaultFilters,
      ...raw.defaultFilters,
      // always carry a complete show-map (new facets default in)
      show: { ...defaultShow(), ...(raw.defaultFilters.show || {}) },
    };
  }
  recompute();
}

// The live config as a plain object, in config.json shape — for the Settings
// editor to seed from and for Export to serialize.
export function currentConfig() {
  return {
    jira: { ..._jira },
    sprints: SPRINTS,
    systems: SYSTEMS,
    epicColors: EPIC_COLORS,
    defaultDevBase: DEFAULT_DEV_BASE,
    historyCap: HISTORY_CAP,
    defaultFilters: DEFAULT_FILTERS,
  };
}

// ---- Static (not user-editable) --------------------------------------------
// localStorage keys (token key shared with the Sprint Capacity Planner).
export const KEYS = {
  token: "jira:pat",
  overrides: "devplan:overrides",
  collapsed: "devplan:collapsed",
  selectedSprint: "devplan:selectedSprint",
  sortMode: "devplan:sortMode",
  loaded: "devplan:loadedEpics",
  epicsCache: "devplan:epicsCache",
  history: "devplan:history",
  team: "devplan:team",
  snapshots: "devplan:sprintSnapshots",
};

// Card ordering options within each lane.
export const SORT_OPTIONS = [
  { value: "status-done", label: "Done first" },
  { value: "status-todo", label: "To-do first" },
  { value: "status-active", label: "In progress first" },
  { value: "status-blocked", label: "Blocked first" },
  { value: "bugs", label: "Bugs first" },
  { value: "sp-desc", label: "Most SP first" },
];
