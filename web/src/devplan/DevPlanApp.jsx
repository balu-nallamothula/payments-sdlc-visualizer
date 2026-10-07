import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import "./board.css";
import { apiClient } from "../api/client.js";
import { useLocalStorage } from "./hooks/useLocalStorage.js";
import { SYSTEMS, DEFAULT_SPRINTS, DEFAULT_FILTERS } from "./config.js";
import { enrichIssue, presentSystems, shortName, uid, flattenIssues } from "./derive.js";
import { buildSyncRecord } from "./exports.js";
import { useJira } from "./hooks/useJira.js";
import { useTeam } from "./hooks/useTeam.js";
import { useLocalPlan } from "./hooks/useLocalPlan.js";
import { useBoardModel } from "./hooks/useBoardModel.js";
import { useHistory } from "./hooks/useHistory.js";
import { useSprintSnapshots } from "./hooks/useSprintSnapshots.js";
import { useBoardIO } from "./hooks/useBoardIO.js";
import Kpis from "./components/Kpis.jsx";
import Controls from "./components/Controls.jsx";
import TeamPanel from "./components/TeamPanel.jsx";
import HistoryPanel from "./components/HistoryPanel.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";
import Board from "./components/Board.jsx";
import ChangesModal from "./components/ChangesModal.jsx";
import SyncDiffModal from "./components/SyncDiffModal.jsx";
import Toast from "./components/Toast.jsx";

const SYSTEM_NAMES = SYSTEMS.map((s) => s.name);

// `slug` is the URL segment under /dev-plan (board is the index, no segment).
const PAGES = [
  { id: "board", slug: "", label: "Board" },
  { id: "history", slug: "history", label: "History" },
  { id: "teams", slug: "team", label: "Team" },
  { id: "settings", slug: "settings", label: "Settings" },
];

// Map the Jira connection colour onto a host badge variant.
const CONN_BADGE = { green: "ok", red: "crit", yellow: "warn" };

// Jira issue-key shape (e.g. PAY-6883), for filtering initiative epic refs.
const EPIC_KEY_RE = /^[A-Za-z][A-Za-z0-9]+-\d+$/;

// Distinct real epic keys an initiative's Jiras roll up to.
const epicsOfInitiative = (d) =>
  [...new Set((d?.jiras || []).map((j) => j.epic).filter((k) => k && EPIC_KEY_RE.test(k)))];

// The adapted board root. Renders inside the host Shell content area (already
// wrapped in .devplan-root by DevPlan.jsx) — the host provides the sidebar,
// topbar and page scroll, so this drops the board's own chrome and swaps it for
// a small host-styled tab bar + connect/sync controls.
export default function DevPlanApp() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [toast, setToast] = useState(null);
  const [changesOpen, setChangesOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(true);
  const [kpisOpen, setKpisOpen] = useLocalStorage("devplan:kpisOpen", true);

  // Sub-page lives in the URL (/dev-plan, /dev-plan/history, /dev-plan/team,
  // /dev-plan/settings) so it's deep-linkable and reload-safe. Derived from the
  // splat; the board stays mounted across tabs so its state persists.
  const navigate = useNavigate();
  const location = useLocation();
  const sub = (useParams()["*"] || "").split("/")[0];
  const activePage = PAGES.find((p) => p.slug === sub)?.id || "board";
  const setActivePage = useCallback(
    (id) => {
      const slug = PAGES.find((p) => p.id === id)?.slug ?? "";
      navigate({ pathname: `/dev-plan${slug ? `/${slug}` : ""}`, search: location.search });
    },
    [navigate, location.search],
  );

  // Preload: which epics to show on open, resolved from the URL. `?epics=` is a
  // direct list; `?initiative=<name>` (from the sidebar / "Open in Dev Plan") is
  // resolved to that initiative's epics. Either overrides the cached board and
  // follows a new selection. With no param, fall back once to the last-viewed
  // initiative — but only when the board is empty, so it never clobbers a board
  // you built manually.
  const [searchParams] = useSearchParams();
  const explicitEpics = searchParams.get("epics");
  const initiativeParam = searchParams.get("initiative");
  const [preloadKeys, setPreloadKeys] = useState([]);
  const loadedSig = useRef(null); // signature of the last target we loaded
  const didFallback = useRef(false);

  const showToast = useCallback((msg, error = false) => setToast({ msg, error, id: Math.random() }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const history = useHistory();
  // Must be defined before useJira — it's the sync-event callback.
  const recordSync = useCallback(
    ({ epics: keys, changes }) => history.record(buildSyncRecord({ keys, changes, id: uid(), ts: Date.now() })),
    [history.record]
  );
  const jira = useJira(showToast, recordSync, { autoRestore: !explicitEpics && !initiativeParam });
  const allIssues = useMemo(
    () => flattenIssues(jira.epics, (i, ep) => enrichIssue({ ...i, _epic: ep.key, _epicColor: ep.color })),
    [jira.epics]
  );
  const systemsPresent = useMemo(() => presentSystems(allIssues), [allIssues]);
  const snapshots = useSprintSnapshots(allIssues);
  const team = useTeam(allIssues, showToast);
  const plan = useLocalPlan(allIssues, systemsPresent, showToast);
  const board = useBoardModel({
    allIssues, filters,
    overrides: plan.overrides, collapsedLanes: plan.collapsedLanes,
    sortMode: plan.sortMode, team: team.team, selectedSprint: plan.selectedSprint,
  });
  const io = useBoardIO({
    jira, plan, board, history, snapshots, allIssues, filters, showToast,
  });

  // Resolve the preload target from the URL and load it. Re-runs when the target
  // changes (e.g. picking a different initiative), so the board follows selection.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let keys = [];
      let sig = null;
      if (explicitEpics) {
        keys = explicitEpics.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
        sig = `epics:${keys.join(",")}`;
      } else if (initiativeParam) {
        sig = `init:${initiativeParam}`;
        try {
          keys = epicsOfInitiative(await apiClient.initiative(initiativeParam));
        } catch { /* no server / not found → skip */ }
      } else {
        // No explicit target: fall back once to the last-viewed initiative, and
        // only when the board is empty (don't clobber a manually-built board).
        if (didFallback.current || jira.hasData) return;
        didFallback.current = true;
        let initName = null;
        try { initName = localStorage.getItem("sdlc-current-initiative"); } catch { /* ignore */ }
        if (!initName) return;
        sig = `init:${initName}`;
        try {
          keys = epicsOfInitiative(await apiClient.initiative(initName));
        } catch { return; }
      }
      if (cancelled || !keys.length || loadedSig.current === sig) return;
      loadedSig.current = sig;
      setPreloadKeys(keys);
      // With a token we auto-load; without one the empty state points to Settings
      // (naming the wanted keys), where the board is set up.
      if (jira.token) jira.loadEpics(keys);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explicitEpics, initiativeParam]);

  const hasData = jira.hasData;
  const epicLabel = Object.values(jira.epics).map((e) => shortName(e)).join(" + ");
  const multiEpic = Object.keys(jira.epics).length > 1;

  // A specific board can be requested via ?epics= / ?initiative=. The board caches
  // the last-loaded epics in localStorage, so without this guard, opening a
  // DIFFERENT initiative would show the previous (stale) board whenever the
  // requested one can't load (no token, or a failed fetch). Only treat the board
  // as ready when the loaded epics are exactly the requested ones.
  const loadedKeys = Object.keys(jira.epics);
  const requestedKeys = explicitEpics
    ? explicitEpics.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : preloadKeys;
  const targetMatches =
    requestedKeys.length === 0 ||
    (loadedKeys.length === requestedKeys.length && requestedKeys.every((k) => loadedKeys.includes(k)));
  const showBoard = hasData && targetMatches;
  // Carry the requested epic(s) to Settings so its "Epic key(s)" field is prefilled.
  const settingsHref = requestedKeys.length
    ? `/settings?epics=${encodeURIComponent(requestedKeys.join(","))}`
    : "/settings";

  const connBadge = CONN_BADGE[jira.conn.color] || "";

  return (
    <div className="devplan-board">
      <div className="devplan-header">
        <div>
          <h1 className="page-title">Dev Plan</h1>
          <p className="page-sub">
            {showBoard ? epicLabel : "Load an epic to see its tickets across sprints & systems."}
          </p>
        </div>
      </div>

      <div className="devplan-toolbar row wrap">
        <div className="row" style={{ gap: 4 }}>
          {PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`btn sm ${activePage === p.id ? "primary" : "ghost"}`}
              onClick={() => setActivePage(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <span className={`badge ${connBadge}`} title={jira.conn.text}>{jira.conn.text}</span>
        {showBoard && (
          <button className="btn sm" type="button" disabled={!plan.dirtyCount} onClick={() => setChangesOpen(true)}
            title="Discard local moves and snap tickets back to their Jira sprint">
            Undo Local Changes{plan.dirtyCount ? ` (${plan.dirtyCount})` : ""}
          </button>
        )}
        <button className="btn sm" type="button" disabled={!showBoard || jira.busy} onClick={jira.sync}>
          {jira.busy ? "Syncing…" : "Sync from Jira"}
        </button>
        <Link className="btn sm primary" to="/settings">Board setup</Link>
      </div>

      {activePage === "board" && (showBoard ? (
        <>
          {kpisOpen && <Kpis kpis={board.kpis} />}
          <Controls
            epics={jira.epics} systemsPresent={systemsPresent} filters={filters} setFilters={setFilters}
            sortMode={plan.sortMode} onSortChange={plan.setSortMode}
            lanesAllCollapsed={plan.lanesAllCollapsed} onToggleAllLanes={plan.toggleAllLanes}
            kpisOpen={kpisOpen} onToggleKpis={() => setKpisOpen((o) => !o)}
            onExport={io.onExportBoard}
          />
          <Board
            sprints={board.sprints} selectedKey={board.selectedKey} selected={board.selected}
            onSelectSprint={plan.setSelectedSprint} onMove={plan.applyMove} onToggleLane={plan.toggleLane}
            multiEpic={multiEpic}
          />
        </>
      ) : requestedKeys.length && !targetMatches ? (
        // A specific initiative was requested but its board isn't loaded (loading,
        // failed, or no token) — show that, never the previous cached board.
        <section className="empty-state">
          <div className="empty-card">
            {jira.busy ? (
              <>
                <h2>Loading {requestedKeys.join(", ")}…</h2>
                <p>Fetching this initiative's board from Jira.</p>
              </>
            ) : (
              <>
                <h2>Couldn't load {requestedKeys.join(", ")}</h2>
                <p>
                  {jira.token ? (
                    <>Jira didn't return this board. Check the epic or your token in <Link to={settingsHref}>Settings</Link>.</>
                  ) : (
                    <>Connect Jira in <Link to={settingsHref}>Settings</Link> to load this initiative's board.</>
                  )}
                </p>
              </>
            )}
          </div>
        </section>
      ) : (
        <section className="empty-state">
          <div className="empty-card">
            <h2>No epic loaded yet</h2>
            <p>
              {jira.token ? (
                <>Load an epic in <Link to="/settings">Settings</Link> to build the board.</>
              ) : (
                <>Connect Jira and load an epic in <Link to="/settings">Settings</Link> to build the board.</>
              )}
            </p>
          </div>
        </section>
      ))}

      {activePage === "teams" && (
        <TeamPanel
          team={team.team} sprints={DEFAULT_SPRINTS} systems={SYSTEM_NAMES}
          open={teamOpen} onToggle={() => setTeamOpen((o) => !o)}
          onAdd={team.addDev} onUpdate={team.updateDev} onUpdateCell={team.updateCell} onRemove={team.removeDev}
          onLoadFromAssignees={team.loadFromAssignees}
        />
      )}

      {activePage === "settings" && <SettingsPanel onToast={showToast} />}

      {activePage === "history" && (
        <HistoryPanel
          history={history.history}
          onRemove={history.removeEntry}
          onClear={history.clearHistory}
          snapshots={snapshots.snapshots}
          onRecaptureSnapshot={snapshots.recapture}
          onRemoveSnapshot={snapshots.removeSnapshot}
          onClearSnapshots={snapshots.clearSnapshots}
          onImport={io.onImportHistory}
        />
      )}

      {changesOpen && (
        <ChangesModal
          changes={plan.localChanges} onUndoOne={plan.undoOne}
          onUndoAll={() => { plan.undoAll(); setChangesOpen(false); }}
          onClose={() => setChangesOpen(false)}
        />
      )}
      {jira.syncDiff && <SyncDiffModal changes={jira.syncDiff} onClose={jira.clearSyncDiff} />}

      <Toast toast={toast} />
    </div>
  );
}
