// Work-composition (SP by status) visuals, shared by the KPI card, the sprint
// header, and the sprint strip. Colors match the board's status classes.
// `comp` = { done, inqa, review, progress, todo, blocked, total }.
import { useRichTooltip } from "./Tooltip.jsx";
import { pct } from "../derive.js";

export const COMP_SEGMENTS = [
  { key: "done", label: "Done", cls: "s-done" },
  { key: "inqa", label: "In QA", cls: "s-inqa" },
  { key: "review", label: "Code review", cls: "s-review" },
  { key: "progress", label: "In progress", cls: "s-progress" },
  { key: "todo", label: "To do", cls: "s-todo" },
  { key: "blocked", label: "Blocked", cls: "s-blocked" },
];

export function CompBar({ comp, mini = false }) {
  const tip = useRichTooltip();
  const total = (comp && comp.total) || 0;
  if (!total) return mini ? null : <div className="comp-bar comp-empty" />;
  return (
    <>
      <div className={"comp-bar" + (mini ? " comp-mini" : "")}>
        {COMP_SEGMENTS.map((s) =>
          comp[s.key] > 0 ? (
            <i key={s.key} className={s.cls} style={{ width: `${pct(comp[s.key], total)}%` }}
               {...tip.bind(
                 <span className="tip-seg">
                   <span className="tip-seg-head"><i className={`tip-dot ${s.cls}`} />{s.label}</span>
                   <span className="tip-seg-val"><b>{comp[s.key]} SP</b> · {pct(comp[s.key], total)}% of {total} SP</span>
                 </span>
               )} />
          ) : null
        )}
      </div>
      {tip.node}
    </>
  );
}

export function CompLegend({ comp }) {
  const total = (comp && comp.total) || 0;
  return (
    <div className="comp-legend">
      {COMP_SEGMENTS.map((s) => {
        const v = (comp && comp[s.key]) || 0;
        return <span key={s.key}><i className={`dot ${s.cls}`} />{v} {s.label} ({pct(v, total)}%)</span>;
      })}
    </div>
  );
}
