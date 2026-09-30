import { useState } from "react";
import { shortAssignee, initialsFrom } from "../derive.js";
import SprintStrip from "./SprintStrip.jsx";
import { CompBar, CompLegend } from "./Composition.jsx";
import { useRichTooltip } from "./Tooltip.jsx";
import TicketLink from "./TicketLink.jsx";
import Icon from "./Icon.jsx";
import { startCardDrag } from "../dnd.js";

export default function Board({ sprints, selectedKey, selected, onSelectSprint, onMove, onToggleLane, multiEpic }) {
  const [draggingKey, setDraggingKey] = useState(null);
  return (
    <div className="board2">
      <SprintStrip sprints={sprints} selectedKey={selectedKey} onSelect={onSelectSprint} onMove={onMove} />
      {selected && (
        <section className="panel sprint-view">
          <div className="sprint-view-head">
            <div className="sprint-view-title">
              <h2><Icon name="cal" size={16} /> {selected.label} <span className="sprint-total-badge">{selected.total} SP</span></h2>
              <small>{selected.dates}</small>
            </div>
            {selected.comp && selected.comp.total > 0 && (
              <div className="sprint-comp">
                <span className="sprint-comp-label">Work composition</span>
                <CompBar comp={selected.comp} />
                <CompLegend comp={selected.comp} />
              </div>
            )}
          </div>
          <div className="lanes">
            {selected.lanes.map((lane) => (
              <Lane key={lane.system} lane={lane} onToggleLane={onToggleLane}
                multiEpic={multiEpic} draggingKey={draggingKey} setDraggingKey={setDraggingKey} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Lane({ lane, onToggleLane, multiEpic, draggingKey, setDraggingKey }) {
  const capPct = lane.showCap ? Math.min(100, Math.round((lane.spUsed / lane.cap) * 100)) : 0;
  const capCls = lane.over ? "over" : lane.showCap && lane.spUsed / lane.cap >= 0.85 ? "warn" : "";
  return (
    <div className={"lane2" + (lane.collapsed ? " is-collapsed" : "")}>
      <div className="lane2-head">
        <button className="lane2-toggle" type="button" onClick={() => onToggleLane(lane.system)}
          title={lane.collapsed ? "Expand lane" : "Collapse lane"}>
          <span className="chev">{lane.collapsed ? "▶" : "▼"}</span>
          <i className="sysdot" style={{ background: lane.color }} />
          <span className="lane-name">{lane.system}</span>
        </button>
        {lane.showCap ? (
          <div className="lane2-cap">
            <div className="cap-bar"><i className={capCls} style={{ width: `${capPct}%` }} /></div>
            <span className={"lane-sp" + (lane.over ? " over" : "")}>{lane.spUsed} / {lane.cap} SP</span>
          </div>
        ) : <span className="lane-sp lane2-cap">{lane.spUsed} SP</span>}
        <div className="lane2-meta">
          <span className="lane-devs"><Icon name="people" size={13} /> {lane.devCount} dev{lane.devCount !== 1 ? "s" : ""}</span>
        </div>
      </div>
      {!lane.collapsed && (
        <div className="lane2-cards">
          {lane.cards.length === 0
            ? <div className="lane-empty">No tickets</div>
            : lane.cards.map((iss) => (
                <Card key={iss.key} iss={iss} multiEpic={multiEpic} dragging={draggingKey === iss.key} setDraggingKey={setDraggingKey} />
              ))}
        </div>
      )}
    </div>
  );
}

function Card({ iss, multiEpic, dragging, setDraggingKey }) {
  const tip = useRichTooltip();
  const cls = iss.statusCls;
  const spVal = Number.isFinite(iss.storyPoints) ? iss.storyPoints : "–";
  const assignee = iss.assignee ? shortAssignee(iss.assignee.displayName) : "";
  const initials = initialsFrom(assignee);
  return (
    <div className={`card s-${cls}` + (iss.isBug ? " is-bug" : "") + (dragging ? " dragging" : "")}
      draggable
      onDragStart={(e) => { startCardDrag(e, iss.key); setDraggingKey(iss.key); }}
      onDragEnd={() => setDraggingKey(null)}>
      {iss._moved && <span className="card-moved">moved</span>}
      <div className="card-top">
        <TicketLink keyText={iss.key} onClick={(e) => e.stopPropagation()}>
          {multiEpic && <i className="card-epic-dot" style={{ background: iss._epicColor }} />}
          <Icon name="doc" size={13} /> {iss.key}
        </TicketLink>
        <span className="card-sp">{spVal} SP</span>
      </div>
      <div className="card-title">{iss.title}</div>
      <div className="card-meta">
        <span className={`badge s-${cls}`}>{iss.status || "—"}</span>
        {iss.isBug && <span className="badge badge-bug">Bug</span>}
        {iss.rollover && (
          <span
            className="badge badge-roll"
            {...tip.bind(
              <span className="tip-roll">
                <span className="tip-roll-head">↩ Carried over {iss.sprintTrail.length - 1}×</span>
                <span className="tip-roll-trail">
                  {iss.sprintTrail.map((n, i) => (
                    <span key={n}>
                      {i > 0 && <b className="tip-roll-arrow"> → </b>}
                      <span className={i === iss.sprintTrail.length - 1 ? "is-now" : ""}>.{n}</span>
                    </span>
                  ))}
                </span>
                <span className="tip-roll-note">Currently in Sprint .{iss.baseSprint}</span>
              </span>
            )}
          >
            ↩ Rollover
          </span>
        )}
        <span className="card-assignee-av" title={assignee || "Unassigned"}>
          {assignee ? <><span className="av">{initials}</span>{assignee}</> : "Unassigned"}
        </span>
      </div>
      {iss.blockedBy && iss.blockedBy.length > 0 && (
        <div className="card-blockers">
          {iss.blockedBy.map((b) => (
            <TicketLink key={b.key} keyText={b.key} className={"blocker" + (b.done ? " is-done" : "")}
              onClick={(e) => e.stopPropagation()}
              {...tip.bind(
                <span className="tip-blocker">
                  <span className={"tip-blocker-head" + (b.done ? " is-done" : "")}>
                    {b.done ? "✓ Resolved · no longer blocking" : "⛔ Blocked by"}
                  </span>
                  <span className="tip-blocker-key">{b.key}{b.status ? ` · ${b.status}` : ""}</span>
                  <span className="tip-blocker-sum">{b.summary}</span>
                </span>
              )}>
              <Icon name="block" size={12} /> {b.key}
            </TicketLink>
          ))}
        </div>
      )}
      {tip.node}
    </div>
  );
}
