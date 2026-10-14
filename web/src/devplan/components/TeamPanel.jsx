import { Fragment, useState } from "react";
import { devCapForSprint } from "../derive.js";
import { SYSTEM_BY_NAME } from "../config.js";
import Combobox from "./Combobox.jsx";
import Icon from "./Icon.jsx";

export default function TeamPanel({ team, sprints, systems, open, onToggle, onAdd, onUpdate, onUpdateCell, onRemove, onLoadFromAssignees }) {
  const [draft, setDraft] = useState({ name: "", lane: "UFE", base: "" });

  const laneOptions = systems.map((s) => ({ value: s, label: s }));
  const lanesOrder = systems.filter((s) => team.some((d) => d.lane === s));
  const laneTotal = (lane, n) => team.filter((d) => d.lane === lane).reduce((s, d) => s + devCapForSprint(d, n), 0);
  const laneBaseTotal = (lane) => team.filter((d) => d.lane === lane).reduce((s, d) => s + (Number(d.base) || 0), 0);

  const submit = (e) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    onAdd({ name: draft.name.trim(), lane: draft.lane, base: draft.base === "" ? undefined : Number(draft.base) });
    setDraft({ name: "", lane: draft.lane, base: draft.base });
  };

  const ncols = sprints.length + 4;

  return (
    <section className="panel team-panel">
      <button className="team-head" type="button" onClick={onToggle} aria-expanded={open} title={open ? "Hide" : "Show"}>
        <span className="lane-name"><span className="chev">{open ? "▼" : "▶"}</span> Team &amp; capacity per sprint</span>
        <small className="muted">Capacity (SP) per dev and sprint → feeds each lane's bars. Empty cell = use Base · 0 = out of the sprint · lower the number for PTO.</small>
      </button>

      {open && (
        <div className="team-body">
          <div className="table-wrap">
            <table className="team-table">
              <thead>
                <tr>
                  <th className="c-dev">Dev</th>
                  <th className="c-lane">Lane</th>
                  <th className="c-base">Base</th>
                  {sprints.map((n) => <th key={n} className="c-sp">.{n}</th>)}
                  <th className="c-x" aria-label="remove" />
                </tr>
              </thead>
              <tbody>
                {team.length === 0 && (
                  <tr>
                    <td colSpan={ncols} className="team-empty">
                      No devs yet — using the default capacities (CNC 80 · Payment Service 21 · UFE 21 · iOS 20 · Android 20). Add devs to override a lane per sprint.
                    </td>
                  </tr>
                )}
                {lanesOrder.map((lane) => (
                  <Fragment key={lane}>
                    {team.filter((d) => d.lane === lane).map((dev) => (
                      <tr key={dev.id}>
                        <td><input className="ti" value={dev.name} onChange={(e) => onUpdate(dev.id, { name: e.target.value })} /></td>
                        <td>
                          <Combobox options={laneOptions} value={dev.lane} onChange={(v) => onUpdate(dev.id, { lane: v })} ariaLabel="Lane" />
                        </td>
                        <td><input className="ti num" type="number" min="0" value={dev.base}
                          onChange={(e) => onUpdate(dev.id, { base: e.target.value === "" ? "" : Number(e.target.value) })} /></td>
                        {sprints.map((n) => (
                          <td key={n}>
                            <input className="ti num cell" type="number" min="0"
                              placeholder={dev.base === "" || dev.base == null ? "" : String(dev.base)}
                              value={dev.perSprint?.[n] ?? ""}
                              onChange={(e) => onUpdateCell(dev.id, n, e.target.value)} />
                          </td>
                        ))}
                        <td><button className="row-x" type="button" title="Remove dev" onClick={() => onRemove(dev.id)}>×</button></td>
                      </tr>
                    ))}
                    <tr className="lane-total-row">
                      <td colSpan={2}>Total <b>{lane}</b></td>
                      <td className="num">{laneBaseTotal(lane)}</td>
                      {sprints.map((n) => (
                        <td key={n} className="num"><b style={{ color: SYSTEM_BY_NAME[lane]?.color }}>{laneTotal(lane, n)}</b></td>
                      ))}
                      <td />
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <form className="add-dev" onSubmit={submit}>
            <input className="ti" placeholder="Dev name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <div className="add-dev-lane"><Combobox options={laneOptions} value={draft.lane} onChange={(v) => setDraft({ ...draft, lane: v })} ariaLabel="Lane" /></div>
            <input className="ti num" type="number" min="0" placeholder="Base SP" value={draft.base} onChange={(e) => setDraft({ ...draft, base: e.target.value })} />
            <button className="button primary with-icon" type="submit"><Icon name="userPlus" />Add dev</button>
            <button className="button secondary with-icon" type="button" onClick={onLoadFromAssignees} title="Create devs from the assignees of the loaded tickets">
              <Icon name="users" />Load from assignees
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
