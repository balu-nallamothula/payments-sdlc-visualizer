import { useMemo, useRef, useState } from "react";
import Combobox from "./Combobox.jsx";
import ChangeList from "./ChangeList.jsx";
import { CompBar, COMP_SEGMENTS } from "./Composition.jsx";
import { downloadJson, todayStamp } from "../download.js";
import { buildHistoryExport } from "../exports.js";
import { pct } from "../derive.js";
import Icon from "./Icon.jsx";

const fmtWhen = (ts) => {
  try { return new Date(ts).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
  catch { return String(ts); }
};

// Final composition of a finished sprint, frozen at close (count + SP + %).
function SnapshotCard({ snap, onRecapture, onRemove }) {
  const { comp, tickets } = snap;
  return (
    <div className="snap-card">
      <div className="snap-head">
        <div className="snap-title">
          <span className="snap-label">{snap.label}</span>
          {snap.dates && <span className="snap-dates">{snap.dates}</span>}
        </div>
        <div className="snap-actions">
          <span className="snap-totals">{comp.total} SP · {tickets.total} ticket{tickets.total !== 1 ? "s" : ""}</span>
          <button className="button ghost snap-btn" type="button" title="Re-freeze using the current board state" onClick={() => onRecapture(snap.number)}>Recapture</button>
          <button className="hist-remove" type="button" title="Delete this snapshot" onClick={() => onRemove(snap.number)}>×</button>
        </div>
      </div>
      <CompBar comp={comp} />
      <div className="snap-legend">
        {COMP_SEGMENTS.map((s) => {
          const spv = comp[s.key] || 0;
          const tv = tickets[s.key] || 0;
          if (!spv && !tv) return null;
          return (
            <div className="snap-row" key={s.key}>
              <span className="snap-row-label"><i className={`dot ${s.cls}`} />{s.label}</span>
              <span className="snap-row-val">{tv} tkt · {pct(tv, tickets.total)}%</span>
              <span className="snap-row-val">{spv} SP · {pct(spv, comp.total)}%</span>
            </div>
          );
        })}
      </div>
      <div className="snap-captured">Frozen {fmtWhen(snap.capturedAt)}</div>
    </div>
  );
}

function Counts({ counts }) {
  return (
    <span className="hist-counts">
      {counts.changed > 0 && <em className="hc changed">{counts.changed} changed</em>}
      {counts.added > 0 && <em className="hc added">{counts.added} new</em>}
      {counts.removed > 0 && <em className="hc removed">{counts.removed} removed</em>}
    </span>
  );
}

function Entry({ entry, open, onToggle, onRemove }) {
  return (
    <div className={"hist-entry" + (open ? " is-open" : "")}>
      <div className="hist-entry-head">
        <button className="hist-toggle" type="button" onClick={onToggle} aria-expanded={open}>
          <span className="chev">{open ? "▼" : "▶"}</span>
          <span className="hist-when">{fmtWhen(entry.ts)}</span>
          <span className="hist-epics">{entry.epicLabel}</span>
          <Counts counts={entry.counts} />
        </button>
        <button className="hist-remove" type="button" title="Delete this entry" onClick={() => onRemove(entry.id)}>×</button>
      </div>
      {open && (
        <div className="hist-entry-body">
          <ChangeList changes={entry.changes} />
        </div>
      )}
    </div>
  );
}

export default function HistoryPanel({
  history,
  onRemove,
  onClear,
  snapshots = [],
  onRecaptureSnapshot,
  onRemoveSnapshot,
  onClearSnapshots,
  onImport,
}) {
  const [filterEpic, setFilterEpic] = useState("all");
  const [openIds, setOpenIds] = useState(() => new Set());
  const fileRef = useRef(null);

  const importHistory = (e) => {
    const file = e.target.files?.[0];
    if (file) onImport?.(file);
    e.target.value = "";
  };

  const epicOpts = useMemo(() => {
    const seen = [];
    for (const e of history) for (const k of e.epics || []) if (!seen.includes(k)) seen.push(k);
    return [{ value: "all", label: "All initiatives" }, ...seen.map((k) => ({ value: k, label: k }))];
  }, [history]);

  const filtered = useMemo(
    () => (filterEpic === "all" ? history : history.filter((e) => (e.epics || []).includes(filterEpic))),
    [history, filterEpic]
  );

  const exportHistory = () => {
    downloadJson(`dev-plan-history-${todayStamp()}.json`, buildHistoryExport({
      history, snapshots, exportedAt: new Date().toISOString(),
    }));
  };

  const toggle = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <section className="panel history-panel">
      <div className="history-head">
        <div className="history-title">
          <h2>History</h2>
          <small>{history.length} sync event{history.length !== 1 ? "s" : ""} recorded</small>
        </div>
        <div className="history-actions">
          {epicOpts.length > 2 && (
            <Combobox options={epicOpts} value={filterEpic} onChange={setFilterEpic} ariaLabel="Filter by initiative" placeholder="All initiatives" />
          )}
          <button className="button ghost with-icon" type="button" onClick={exportHistory} disabled={!history.length && !snapshots.length}><Icon name="export" />Export</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importHistory} />
          <button className="button ghost with-icon" type="button" onClick={() => fileRef.current?.click()} title="Replace history &amp; snapshots from a JSON export"><Icon name="import" />Import</button>
          <button className="button ghost with-icon" type="button" onClick={onClear} disabled={!history.length}><Icon name="trash" />Clear history</button>
        </div>
      </div>

      {snapshots.length > 0 && (
        <div className="snap-section">
          <div className="snap-section-head">
            <h3>Closed sprint outcomes</h3>
            <button className="button ghost with-icon" type="button" onClick={onClearSnapshots}><Icon name="trash" />Clear snapshots</button>
          </div>
          <p className="snap-section-sub">Final composition frozen when each sprint closed — before its unfinished tickets rolled forward.</p>
          <div className="snap-grid">
            {snapshots.map((snap) => (
              <SnapshotCard key={snap.number} snap={snap} onRecapture={onRecaptureSnapshot} onRemove={onRemoveSnapshot} />
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-card history-empty">
          <h2>No sync history yet</h2>
          <p>When you <b>Sync from Jira</b> and something changed (assignee, status, points, sprint, or added/removed tickets), it's summarized and saved here per initiative.</p>
        </div>
      ) : (
        <div className="hist-list">
          {filtered.map((entry) => (
            <Entry key={entry.id} entry={entry} open={openIds.has(entry.id)} onToggle={() => toggle(entry.id)} onRemove={onRemove} />
          ))}
        </div>
      )}
    </section>
  );
}
