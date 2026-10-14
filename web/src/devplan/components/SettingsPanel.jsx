import { useMemo, useRef, useState } from "react";
import { currentConfig, FILTER_GROUPS } from "../config.js";
import { downloadJson, readJsonFile } from "../download.js";
import Icon from "./Icon.jsx";

// Deep-ish clone so edits don't mutate the live config bindings.
const clone = (o) => JSON.parse(JSON.stringify(o));
const parseList = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);

// Client-only row keys so React tracks rows across add/remove — index keys make
// focus and in-progress edits jump to the wrong row when a middle row is deleted.
let _rid = 0;
const rid = () => `row-${_rid++}`;

// Seed a config into an editable draft: deep-clone it (so edits never touch the
// live bindings) and attach a stable _key to sprint/system rows plus a parallel
// key list for the (string) epic colors.
const seed = (cfg) => {
  const c = clone(cfg);
  return {
    ...c,
    sprints: c.sprints.map((s) => ({ ...s, _key: rid() })),
    systems: c.systems.map((s) => ({ ...s, _key: rid() })),
    _colorKeys: c.epicColors.map(() => rid()),
  };
};

// Inverse of seed: a clean config.json-shaped object with the client-only keys
// removed. Used for Export and the raw-JSON preview.
const strip = (d) => ({
  jira: d.jira,
  sprints: d.sprints.map(({ _key, ...s }) => s),
  systems: d.systems.map(({ _key, ...s }) => s),
  epicColors: d.epicColors,
  defaultDevBase: d.defaultDevBase,
  historyCap: d.historyCap,
  defaultFilters: d.defaultFilters,
});

// Config editor. Edits a local draft seeded from the live config; Export writes
// a config.json to download, Import loads one into the form. Changes take effect
// once that file is at the repo root and the page is reloaded (server-only Jira
// fields also need a server restart) — see the banner.
export default function SettingsPanel({ onToast }) {
  const [draft, setDraft] = useState(() => seed(currentConfig()));
  const fileRef = useRef(null);

  const json = useMemo(() => JSON.stringify(strip(draft), null, 2), [draft]);

  const setJira = (k, v) => setDraft((d) => ({ ...d, jira: { ...d.jira, [k]: v } }));
  const setTop = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const updateRow = (list, i, patch) =>
    setDraft((d) => ({ ...d, [list]: d[list].map((row, j) => (j === i ? { ...row, ...patch } : row)) }));
  const removeRow = (list, i) => setDraft((d) => ({ ...d, [list]: d[list].filter((_, j) => j !== i) }));
  const addSprint = () => setDraft((d) => ({ ...d, sprints: [...d.sprints, { number: 0, year: d.sprints.at(-1)?.year ?? new Date().getFullYear(), start: "", end: "", _key: rid() }] }));
  const addSystem = () => setDraft((d) => ({ ...d, systems: [...d.systems, { name: "", color: "#888888", cap: null, tags: [], comps: [], _key: rid() }] }));

  const setColor = (i, v) => setDraft((d) => ({ ...d, epicColors: d.epicColors.map((c, j) => (j === i ? v : c)) }));
  const addColor = () => setDraft((d) => ({ ...d, epicColors: [...d.epicColors, "#888888"], _colorKeys: [...d._colorKeys, rid()] }));
  const removeColor = (i) => setDraft((d) => ({ ...d, epicColors: d.epicColors.filter((_, j) => j !== i), _colorKeys: d._colorKeys.filter((_, j) => j !== i) }));

  const exportJson = () => {
    downloadJson("config.json", strip(draft));
    onToast?.("config.json downloaded — drop it at the repo root and reload");
  };

  const importJson = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed = await readJsonFile(file);
      setDraft(seed({ ...currentConfig(), ...parsed, jira: { ...currentConfig().jira, ...(parsed.jira || {}) } }));
      onToast?.("Config imported into the form — review, then Export");
    } catch (err) {
      onToast?.(err.message || "That file isn't valid JSON", true);
    }
  };

  const resetToLoaded = () => { setDraft(seed(currentConfig())); onToast?.("Reverted to the loaded config"); };

  return (
    <section className="panel settings-panel">
      <div className="settings-head">
        <div>
          <h2>Settings</h2>
          <small className="muted">Edit the board config. These map to <code>config.json</code> at the repo root.</small>
        </div>
        <div className="row-actions">
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importJson} />
          <button className="button secondary with-icon" type="button" onClick={() => fileRef.current?.click()}><Icon name="import" />Import…</button>
          <button className="button secondary with-icon" type="button" onClick={resetToLoaded}><Icon name="reset" />Reset</button>
          <button className="button primary with-icon" type="button" onClick={exportJson}><Icon name="export" />Export config.json</button>
        </div>
      </div>

      <p className="settings-note">
        Changes here don't apply live. <b>Export config.json</b>, place it at the repo root, then reload the page.
        Jira fields (base, custom fields, patterns) are read by the server — restart <code>node server.js</code> for those.
      </p>

      <details className="settings-section" open>
        <summary>Jira connection &amp; fields <span className="muted">(server-side · restart to apply)</span></summary>
        <div className="settings-grid">
          {[
            ["base", "Base URL", "https://jira.sephora.com"],
            ["browseBase", "Browse URL", "https://jira.sephora.com/browse"],
            ["storyPointsField", "Story Points field", "customfield_10173"],
            ["sprintField", "Sprint field", "customfield_10510"],
            ["epicLinkJql", "Epic Link JQL field", "\"Epic Link\""],
            ["sprintNumberPattern", "Sprint number regex", "\\b20\\d\\d\\.(\\d+)"],
          ].map(([k, label, ph]) => (
            <label key={k} className="field">
              {label}
              <input className="ti" value={draft.jira[k] ?? ""} placeholder={ph} onChange={(e) => setJira(k, e.target.value)} />
            </label>
          ))}
        </div>
      </details>

      <details className="settings-section" open>
        <summary>Sprints <span className="muted">({draft.sprints.length})</span></summary>
        <div className="table-wrap">
          <table className="settings-table">
            <thead><tr><th>Number</th><th>Year</th><th>Start</th><th>End</th><th aria-label="remove" /></tr></thead>
            <tbody>
              {draft.sprints.map((s, i) => (
                <tr key={s._key}>
                  <td><input className="ti num" type="number" value={s.number} onChange={(e) => updateRow("sprints", i, { number: Number(e.target.value) })} /></td>
                  <td><input className="ti num" type="number" value={s.year} onChange={(e) => updateRow("sprints", i, { year: Number(e.target.value) })} /></td>
                  <td><input className="ti" type="date" value={s.start || ""} onChange={(e) => updateRow("sprints", i, { start: e.target.value })} /></td>
                  <td><input className="ti" type="date" value={s.end || ""} onChange={(e) => updateRow("sprints", i, { end: e.target.value })} /></td>
                  <td><button className="row-x" type="button" title="Remove sprint" onClick={() => removeRow("sprints", i)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="button secondary with-icon" type="button" onClick={addSprint}><Icon name="plus" />Add sprint</button>
      </details>

      <details className="settings-section" open>
        <summary>Systems (swimlanes) <span className="muted">({draft.systems.length} · order = display order)</span></summary>
        <div className="table-wrap">
          <table className="settings-table">
            <thead><tr><th>Name</th><th>Color</th><th>Cap (SP)</th><th>Tags</th><th>Components</th><th aria-label="remove" /></tr></thead>
            <tbody>
              {draft.systems.map((s, i) => (
                <tr key={s._key}>
                  <td><input className="ti" value={s.name} onChange={(e) => updateRow("systems", i, { name: e.target.value })} /></td>
                  <td className="c-color"><input type="color" value={s.color} onChange={(e) => updateRow("systems", i, { color: e.target.value })} /></td>
                  <td><input className="ti num" type="number" min="0" placeholder="—" value={s.cap ?? ""} onChange={(e) => updateRow("systems", i, { cap: e.target.value === "" ? null : Number(e.target.value) })} /></td>
                  <td><input className="ti" placeholder="ios, cnc…" value={(s.tags || []).join(", ")} onChange={(e) => updateRow("systems", i, { tags: parseList(e.target.value) })} /></td>
                  <td><input className="ti" placeholder="checkout, venmo…" value={(s.comps || []).join(", ")} onChange={(e) => updateRow("systems", i, { comps: parseList(e.target.value) })} /></td>
                  <td><button className="row-x" type="button" title="Remove system" onClick={() => removeRow("systems", i)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="button secondary with-icon" type="button" onClick={addSystem}><Icon name="plus" />Add system</button>
      </details>

      <details className="settings-section" open>
        <summary>Epic colors <span className="muted">({draft.epicColors.length})</span></summary>
        <div className="color-row">
          {draft.epicColors.map((c, i) => (
            <div key={draft._colorKeys[i]} className="color-chip">
              <input type="color" value={c} onChange={(e) => setColor(i, e.target.value)} />
              <button className="row-x" type="button" title="Remove color" onClick={() => removeColor(i)}>×</button>
            </div>
          ))}
          <button className="button secondary with-icon" type="button" onClick={addColor}><Icon name="plus" />Add color</button>
        </div>
      </details>

      <details className="settings-section" open>
        <summary>Defaults</summary>
        <div className="settings-grid">
          <label className="field">Dev base capacity (SP / sprint)
            <input className="ti num" type="number" min="0" value={draft.defaultDevBase} onChange={(e) => setTop("defaultDevBase", Number(e.target.value))} />
          </label>
          <label className="field">History cap (sync events kept)
            <input className="ti num" type="number" min="0" value={draft.historyCap} onChange={(e) => setTop("historyCap", Number(e.target.value))} />
          </label>
        </div>
        <small className="muted">Shown on the board by default (unchecked = hidden until toggled on in Filters)</small>
        <div className="settings-checks">
          {FILTER_GROUPS.flatMap((g) => g.facets).map((f) => (
            <label key={f.id} className="check">
              <input
                type="checkbox"
                checked={draft.defaultFilters?.show?.[f.id] !== false}
                onChange={(e) => setTop("defaultFilters", { ...draft.defaultFilters, show: { ...(draft.defaultFilters?.show || {}), [f.id]: e.target.checked } })}
              />
              {f.label}
            </label>
          ))}
        </div>
      </details>

      <details className="settings-section">
        <summary>Raw JSON preview</summary>
        <pre className="settings-json">{json}</pre>
      </details>
    </section>
  );
}
